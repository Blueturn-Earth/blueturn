import {gCalculateScreenCoordFromLatLon, gFindClosestIndexInSortedArray, gGetDateTimeStringFromTimeSec} from './utils.js';
import {gEpicImageData, gEpicTimeSec, gEpicDB, gSetPlayState, gJumpToEpicTime} from '././app.js';
import { skyPhotosDB } from "./sky_photos_db.js";
import { openPopupFromThumbnail } from './sky-photos-popup.js';
import { gZoom, gPivotEpicImageData } from './app.js';
import { glZoomFactor } from './gl.js';
import { gControlState } from './controlparams.js';
import DragScroller from './drag_scroller.js'
import {getStorageProvider} from './gdrive_provider.js';

const SECONDS_IN_DAY = 3600*24;

console.log("Sky Photos module loaded");

const canvas = document.getElementById('glcanvas');
const skyPhotosEarthGallery = document.getElementById('skyPhotosEarthGallery');
const skyPhotosScrollGallery = new DragScroller('skyPhotosScrollGallery');
skyPhotosScrollGallery.hide();

let buildingSkyPics = false;

setSkyPhotosScrollGalleryCallbacks();

function gGetScreenCoordFromLatLon(lat, lon)
{
    if(!gEpicImageData)
        return null;

    return gCalculateScreenCoordFromLatLon(lat, lon, 
        gEpicImageData.centroid_matrix,
        gEpicImageData.earthRadius / 2.0 * Math.min(canvas.width, canvas.height),
        canvas.width, canvas.height,
        gZoom, 
        glZoomFactor,
        gPivotEpicImageData?.pivot_coordinates
    );
}

const picsMap = new Map();
let picsSortedArray = [];

function timeOfDayUTCSeconds(d) {
  return (
    d.getUTCHours()   * 3600 +
    d.getUTCMinutes() * 60 +
    d.getUTCSeconds()
  );
}

function dateDiffSecondsWithTZ(a, b) {
  return (a.getTime() - b.getTime()) / 1000;
}

function timeDiffSecondsWithTZ(a, b) {
  const ta = timeOfDayUTCSeconds(a);
  const tb = timeOfDayUTCSeconds(b);
  const dateDiff = ta - tb;
  const sign = dateDiff < 0 ? -1 : 1; 
  const absDateiff = Math.abs(dateDiff);
  return sign * Math.min(absDateiff, SECONDS_IN_DAY - absDateiff);
}

function smoothstep (x) {
   return x * x * (3.0 - 2.0 * x);
}

function updateSkyPhoto(picItem)
{
    const earthPicDiv = picItem.earthPicDiv;
    const scrollDivImg = picItem.scrollPicDiv.querySelector("img");
    const timestampTimeSec = picItem.timeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);
    const currentDate = new Date(gEpicTimeSec * 1000);

    const dateDiff = dateDiffSecondsWithTZ(currentDate, timestampDate);
    if (Math.abs(dateDiff) > 12 * 3600)
    {
        earthPicDiv.style.display = 'none';
        scrollDivImg.style.border = `0px solid`;
        return;
    }

    const picData = picItem.doc;
    const picPos = gGetScreenCoordFromLatLon(picData.gps.lat, picData.gps.lon);
    if (!picPos || picPos.z < -0.2) {
        earthPicDiv.style.display = 'none';
    }
    else {
        earthPicDiv.style.display = 'block';
        const dpr = window.devicePixelRatio || 1;
        earthPicDiv.style.left = `${picPos.x / dpr}px`;
        earthPicDiv.style.top = `${picPos.y / dpr}px`;
        earthPicDiv.style.zIndex = picPos.z <= 0.0 ? '-1' : '5'; 
    }

    // process timestamp
    const diffSec = timeDiffSecondsWithTZ(currentDate, timestampDate);
    const absDiffSec = Math.abs(diffSec);
    const scaleWindow = gControlState.speed;
    const minScale = .02;
    const maxScale = 0.25;
    const overScale = 0.35;
    const scaleAlpha = smoothstep
        (1.0 - Math.min(absDiffSec, scaleWindow) / scaleWindow);
    if (scaleAlpha < 0.001) {
        earthPicDiv.style.display = 'none';
    }    
    const scaleFactor = scaleAlpha*(maxScale - minScale) + minScale;
    if (diffSec < 0) {
        earthPicDiv.style.opacity = 1;
        earthPicDiv.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
    }
    else {
        earthPicDiv.style.opacity = scaleAlpha;
        const extraScaleFactor = (1.0 - scaleAlpha)*(overScale - maxScale) + maxScale;
        earthPicDiv.style.transform = `translate(-50%, -50%) scale(${extraScaleFactor})`;
    }
    earthPicDiv.style.zIndex = 5 + Math.round(scaleFactor/maxScale * 4);

    const borderWindow = gControlState.speed / 2;
    const minBorderFactor = 0;
    const maxBorderFactor = 4.0;
    const borderAlpha = smoothstep
        (1.0 - Math.min(absDiffSec, borderWindow) / borderWindow);
    const borderFactor = borderAlpha*(maxBorderFactor - minBorderFactor) + minBorderFactor;
    const borderColor = Math.round(borderAlpha * 255);    
    earthPicDiv.style.border = `${borderFactor}px solid rgba(${borderColor}, ${borderColor}, ${borderColor}, ${borderAlpha})`;

    scrollDivImg.style.border = earthPicDiv.style.border;

    return scaleAlpha;
}

function createEarthPicDiv(data)
{
    const earthPicDiv = document.createElement('img');
    earthPicDiv.className = 'sky-earth-photo-thumb';
    getStorageProvider().loadImageFromField(earthPicDiv, data.image);
    earthPicDiv.onclick = () => {
        openPopupFromThumbnail(earthPicDiv, data);
    }
    return earthPicDiv;
}

function createScrollPicDiv(data)
{
    const node = skyPhotosScrollGallery.createItem();//.replace(/=s\d+/, `=s${size}`);
    const img = skyPhotosScrollGallery.getItemImg(node);
    getStorageProvider().loadImageFromField(img, data.image);
    return node;
}

function checkSkyPhotoRecord(record)
{
    const docId = record.docId;
    const data = record;
    if (!data) {
        console.warn("No data for pic:", docId);
        return false;
    }
    if (!data.image || !data.image.fileId) {
        console.warn("No image field or file id for pic data:", docId);
        return false;
    }
    if (!data.gps || data.gps.lat === undefined || data.gps.lon === undefined) {
        console.warn("No GPS field for pic data:", docId);
        return false;
    }
    if (!data.createdAt && !data.takenTime) {
        console.warn("No timestamp (takenTime or createdAt) field for pic data:", docId);
        return false;
    }
    return true;
}

function createPicItem(skyPhotoRecord, timeSec)
{
    if (!skyPhotoRecord) {
        console.error("No record for pic");
        return null;
    }

    if (!checkSkyPhotoRecord(skyPhotoRecord)) {
        console.error("Pic data invalid for record id:", skyPhotoRecord.docId);
        return null;
    }

    const picItem = {
        doc: skyPhotoRecord,
        timeSec: timeSec
    };
    picItem.earthPicDiv = createEarthPicDiv(skyPhotoRecord);
    picItem.scrollPicDiv = createScrollPicDiv(skyPhotoRecord);
    return picItem;
}

function jumpToPicTime(index)
{
    if (index == undefined)
        return;
    const picItem = picsSortedArray[index];
    const timeSec = picItem.timeSec;
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

function selectPicItemAlpha(alpha)
{
    if (picsSortedArray.length == 0)
        return;
    const indexFloat = alpha * (picsSortedArray.length - 1);
    const index0 = Math.floor(indexFloat);
    const index1 = Math.ceil(indexFloat);
    const boundAlpha = index0 == index1 ? 0 : (indexFloat - index0) / (index1 - index0);
    const timeSec = (1.0 - boundAlpha) * picsSortedArray[index0].timeSec + boundAlpha * picsSortedArray[index1].timeSec;
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

async function addSkyPhotosFromRecords(skyPhotoRecords)
{
    console.log("Fetching sky photo docs");

    if (!skyPhotoRecords || skyPhotoRecords.length == 0) {
        console.warn("No sky photo docs fetched, skipping gallery update");
        return null;
    }
    console.log("Adding sky pics to gallery, nDocs =" + skyPhotoRecords.length);
    skyPhotosEarthGallery.style.display = 'block';
    skyPhotosScrollGallery.show();

    let numberOfNewPics = 0;
    for (const record of skyPhotoRecords) {
        if (!picsMap.has(record.docId)) {
            const timestamp = record.takenTime || record.createdAt;
            const timestampDate = timestamp.toDate();
            let timeSec = timestampDate.getTime() / 1000;

            if (!checkSkyPhotoRecord(record))
            {
                console.warn("Skipping pic due to missing data:", record.docId);
                continue;
            }
            if (timeSec > gEpicDB.getLatestEpicImageTimeSec())
            {
                while (timeSec > gEpicDB.getLatestEpicImageTimeSec())
                {
                    timeSec -= SECONDS_IN_DAY;
                }
                const adjusted_timestampDate = new Date(timeSec * 1000);
                console.log("Adjusted pic from " + timestampDate + " to ", adjusted_timestampDate + " to fit in EPIC range");
            }

            //if (adjustTimeForMissingEpicData)
            {
                const boundPair = 
                    await gEpicDB.fetchBoundKeyFrames(
                        timeSec,
                        false // don't request same day
                    );
                const [epicImageData0, epicImageData1] = boundPair ? boundPair : [null, null];
                if (!epicImageData0 && !epicImageData1) {
                    console.warn("Could not fetch EPIC image at picture time ", timestampDate);
                    continue;
                }
                if (!epicImageData1 || !epicImageData0 || epicImageData1.timeSec - epicImageData0.timeSec > 12 * 3600)
                {
                    console.warn("EPIC data not available at picture time ", timestampDate);
                    if (!epicImageData1 || (epicImageData0 && (timeSec - epicImageData0.timeSec < epicImageData1.timeSec - timeSec)))
                    {
                        console.log("Closest EPIC data before picture time is previous at ", epicImageData0.date);
                        while (timeSec > epicImageData0.timeSec)
                            timeSec -= SECONDS_IN_DAY;
                    }
                    else if (!epicImageData0 || (epicImageData1 && (timeSec - epicImageData0.timeSec > epicImageData1.timeSec - timeSec)))
                    {
                        console.log("Closest EPIC data after picture time is next at ", epicImageData1.date);
                        while (timeSec < epicImageData1.timeSec)
                            timeSec += SECONDS_IN_DAY;
                    }
                    const adjusted_timestampDate = new Date(timeSec * 1000);
                    console.log("Adjusted pic from " + timestampDate + " to ", adjusted_timestampDate + " to fit in EPIC range");
                }
            }
            const picItem = createPicItem(record, timeSec);
            picsMap.set(record.docId, picItem);
            numberOfNewPics++;
        }
    }

    buildingSkyPics = true;
    picsSortedArray = [...picsMap.values()];
    picsSortedArray.sort((a, b) => a.timeSec - b.timeSec);
    skyPhotosEarthGallery.innerHTML = '';
    skyPhotosScrollGallery.clearItems(); 

    for(let i = 0; i < picsSortedArray.length; i++)
    {
        const picItem = picsSortedArray[i];
        const earthPicDiv = picItem.earthPicDiv;
        const scrollPicDiv = picItem.scrollPicDiv;
        const picData = picItem.doc;
        const timestamp = picData.takenTime || picData.createdAt;
        const realDate = gGetDateTimeStringFromTimeSec(timestamp.toDate().getTime() / 1000);
        const fakeDate = gGetDateTimeStringFromTimeSec(picsSortedArray[i].timeSec);
        if (realDate != fakeDate)
            console.log(`Pic #${i}: real date: \"${realDate}\", fake date:\"${fakeDate}\"`)
        else
            console.log(`Pic #${i}: date: \"${realDate}\"`);
        skyPhotosEarthGallery.appendChild(earthPicDiv);
        skyPhotosScrollGallery.appendItem(scrollPicDiv); 
    }
    skyPhotosScrollGallery.show();

    console.log("New pics created:", numberOfNewPics);
    buildingSkyPics = false;
}

function setSkyPhotosScrollGalleryCallbacks()
{
    console.log("Setting sky photos scroll gallery callbacks");

    skyPhotosScrollGallery.setSelectItemCb((node, index) => {
        if (buildingSkyPics)
            return;
        jumpToPicTime(index);
    });

    skyPhotosScrollGallery.setSelectedItemClickCb((node, index) => {
        if (buildingSkyPics)
            return;
        const picItem = picsSortedArray[index];
        let picImg = picItem.earthPicDiv;
        if (!picImg) {
            console.warn("No earthPicDiv in pic item #", index);
            picImg = picItem.scrollPicDiv;
            if (picImg) {
                picImg = picImg.querySelector("img");
                if (!picImg) {
                    console.warn("No img under scrollPicDiv for pic item #", index);
                    return;
                }
            }
            else {
                console.warn("No scrollPicDiv in pic item #", index);
                return;
            }
        }

        openPopupFromThumbnail(picImg, picItem.doc);
    });

    skyPhotosScrollGallery.setScrollAlphaCb((alpha) => {
        if (buildingSkyPics)
            return;
        selectPicItemAlpha(alpha);
    });

}

async function addSkyPhotos()
{
    // All new pics
    console.log("Clearing existing sky pics from gallery");
    picsMap.clear();

    console.log("Adding current sky photos to gallery");
    await addCurrentSkyPhotos();
    console.log("Adding sky photos before first one in gallery");
    if (!addSkyPhotosBefore()) {
        console.warn("Adding all sky photos to gallery");
        addAllSkyPhotos();
    }
}

async function addCurrentSkyPhotos()
{
    const dayBeforeLatestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec() - SECONDS_IN_DAY;
    const dayBeforeLatestEpicDate = new Date(dayBeforeLatestEpicTimeSec * 1000);
    const skyPhotoRecords = await skyPhotosDB.getSkyPhotosAfterDate(dayBeforeLatestEpicDate);
    return await addSkyPhotosFromRecords(skyPhotoRecords);
}

async function addSkyPhotosBefore(nDocsBefore = 0)
{
    if (picsMap.size == 0) {
        console.warn("No pics for adding sky photos before");
        return null;
    }
    const minimalTakenTimePicItemEntry = [...picsMap].reduce((min, current) => {
        return current[1].takenTime < min[1].takenTime ? current : min;
    });
    const refDoc = minimalTakenTimePicItemEntry[1].doc;
    const skyPhotoRecords = await skyPhotosDB.getSkyPhotosBeforeRecord(refDoc, nDocsBefore);
    return await addSkyPhotosFromRecords(skyPhotoRecords);
}

async function addAllSkyPhotos()
{
    const records = await skyPhotosDB.getAllSkyPhotos();
    return await addSkyPhotosFromRecords(records);
}

export function updateSkyPhotos()
{
    if (picsSortedArray.length > 0)
    {
        const currentDate = new Date(gEpicTimeSec * 1000);
        const currentTimeSec = currentDate.getTime() / 1000;
        const closestPicIndex = gFindClosestIndexInSortedArray(picsSortedArray, currentTimeSec, picItem => picItem.timeSec);
        if (closestPicIndex < 0 || closestPicIndex >= picsSortedArray.length)
            return;
        const closestPicTimeSec = picsSortedArray[closestPicIndex].timeSec;
        const prevPicIndex = closestPicTimeSec <= currentTimeSec ? closestPicIndex : closestPicIndex - 1;
        const nextPicIndex = closestPicTimeSec >= currentTimeSec ? closestPicIndex : closestPicIndex + 1;
        //console.log("indices: " + prevPicIndex + " - " + closestPicIndex + " - " + nextPicIndex);
        let currentTimeIndexFloat;
        if (prevPicIndex == nextPicIndex ||
            prevPicIndex < 0 ||
            nextPicIndex >= picsSortedArray.length
        )
            currentTimeIndexFloat = closestPicIndex;
        else 
            currentTimeIndexFloat = prevPicIndex + 
                (currentTimeSec - picsSortedArray[prevPicIndex].timeSec) / 
                (picsSortedArray[nextPicIndex].timeSec - picsSortedArray[prevPicIndex].timeSec);
        const currentTimeAlpha = currentTimeIndexFloat / (picsSortedArray.length - 1);
        skyPhotosScrollGallery.scrollToAlpha(currentTimeAlpha);
        //skyPhotosScrollGallery.scrollToAlpha((Math.sin(currentTimeSec / 3600) + 1) / 2);


    }

    let closestEarthPicDiv;
    let maxAlpha = 0;
    picsMap.forEach((picItem, docId) => {
        const alpha = updateSkyPhoto(picItem);
        if (alpha && alpha > maxAlpha) {
            closestEarthPicDiv = picItem.earthPicDiv;
            maxAlpha = alpha;
        }
    });
    if (closestEarthPicDiv)
        closestEarthPicDiv.style.zIndex = 10;
}

const skyPhotosBtn = document.getElementById('skyPhotosBtn');
const scrollCursor = document.getElementById('scrollCursor');
scrollCursor.style.display = 'none';
skyPhotosBtn.addEventListener('click', async () => {
    // toggle
    const isOn = skyPhotosBtn.dataset.state === "off";
    if (isOn) {
        await setSkyPhotosState(true);
        gSetPlayState(true);
    }
    else {
        setSkyPhotosState(false);
    }
});

export async function setSkyPhotosState(isOn)
{
    skyPhotosBtn.dataset.state = isOn ? "on" : "off";
    const showSkyPhotos = isOn;
    if (showSkyPhotos)
        gSetPlayState(false);
    gControlState.blockSnapping = showSkyPhotos;
    scrollCursor.style.display = showSkyPhotos ? "block" : "none";

    if (!showSkyPhotos) {
        skyPhotosEarthGallery.style.display = 'none';
        skyPhotosScrollGallery.hide();
        return;
    }

    return addSkyPhotos();
}

export async function selectPhotoByDocId(docId)
{
    const picItemIndex = picsSortedArray.findIndex(pic => pic.doc.id === docId);
    if (picItemIndex != undefined)
    {
        jumpToPicTime(picItemIndex);
    }
}