import {gCalculateScreenCoordFromLatLon, gFindClosestIndexInSortedArray} from './utils.js';
import {gEpicImageData, gEpicTimeSec, gEpicDB, gSetPlayState, gJumpToEpicTime} from '././app.js';
import { db } from "./firebase_db.js";
import { ensureAuthReady } from "./firebase_auth.js";
import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { openPopupFromThumbnail } from './sky-photos-popup.js';
import { gZoom, gPivotEpicImageData } from './app.js';
import { glZoomFactor } from './gl.js';
import { gControlState } from './controlparams.js';
import DragScroller from './drag_scroller.js'

console.log("Sky Photos module loaded");

const canvas = document.getElementById('glcanvas');
const skyPhotosEarthGallery = document.getElementById('skyPhotosEarthGallery');
const skyPhotosScrollGallery = new DragScroller('skyPhotosScrollGallery');
skyPhotosScrollGallery.hide();

function gGetScreenCoordFromLatLon(lat, lon)
{
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
  const SECONDS_IN_DAY = 86400;
  return sign * Math.min(absDateiff, SECONDS_IN_DAY - absDateiff);
}

function smoothstep (x) {
   return x * x * (3.0 - 2.0 * x);
}

function updateEarthSkyPhotoPosition(picItem)
{
    const earthPicDiv = picItem.earthPicDiv;
    const timestamp = earthPicDiv.data.takenTime || earthPicDiv.data.createdAt;
    const timestampDate = timestamp.toDate();
    const currentDate = new Date(gEpicTimeSec * 1000);

    const dateDiff = dateDiffSecondsWithTZ(currentDate, timestampDate);
    if (Math.abs(dateDiff) > 12 * 3600)
    {
        const latestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec();
        const timestampTimeSec = timestampDate.getTime() / 1000;
        const currentDateTimeSec = currentDate.getTime() / 1000;
        const SECONDS_IN_DAY = 24*3600;
        if (latestEpicTimeSec - timestampTimeSec > SECONDS_IN_DAY ||
            latestEpicTimeSec - currentDateTimeSec > SECONDS_IN_DAY)
        {
            earthPicDiv.style.display = 'none';
            return;
        }
    }

    const picPos = gGetScreenCoordFromLatLon(earthPicDiv.data.gps.lat, earthPicDiv.data.gps.lon);
    if (picPos.z < -0.2) {
        earthPicDiv.style.display = 'none';
        return;
    }    
    earthPicDiv.style.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    earthPicDiv.style.left = `${picPos.x / dpr}px`;
    earthPicDiv.style.top = `${picPos.y / dpr}px`;
    earthPicDiv.style.zIndex = picPos.z <= 0.0 ? '-1' : '5'; 

    // process timestamp
    const diffSec = timeDiffSecondsWithTZ(currentDate, timestampDate);
    const absDiffSec = Math.abs(diffSec);
    const scaleWindow = gControlState.speed;
    const minScale = .02;
    const maxScale = 0.25;
    const overScale = 0.35;
    const scaleAlpha = smoothstep
        (1.0 - Math.min(absDiffSec, scaleWindow) / scaleWindow);
    const scaleFactor = scaleAlpha*(maxScale - minScale) + minScale;
    if (diffSec < 0) {
        earthPicDiv.style.opacity = 1;
        earthPicDiv.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
    }
    else {
        earthPicDiv.style.opacity = scaleFactor/maxScale;
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

    const scrollDivImg = picItem.scrollPicDiv.querySelector("img");
    scrollDivImg.style.border = earthPicDiv.style.border;

    return scaleAlpha;
}

function createEarthPicDiv(data)
{
    const earthPicDiv = document.createElement('img');
    earthPicDiv.className = 'sky-earth-photo-thumb';
    earthPicDiv.src = data.image.thumbnailUrl;
    earthPicDiv.data = data;
    earthPicDiv.onclick = () => {
        openPopupFromThumbnail(earthPicDiv);
    }
    skyPhotosEarthGallery.appendChild(earthPicDiv);
    return earthPicDiv;
}

function createScrollPicDiv(data)
{
    let scrollPicDiv = document.querySelector(".sky-scroll-photo-thumb");
    if (!scrollPicDiv) {
        console.error("No sample scroller pic div available");
        return;
    }
    if (scrollPicDiv.data)
        scrollPicDiv = scrollPicDiv.cloneNode(true);
    const scrollImg = scrollPicDiv.querySelector("img");
    scrollImg.src = data.image.thumbnailUrl;
    scrollPicDiv.data = data;
    // scrollImg.onclick = () => {
    //     openPopupFromThumbnail(scrollImg);
    // }
    return scrollPicDiv;
}

function checkData(data)
{
    if (!data) {
        console.warn("No data for pic:", docId);
        return false;
    }
    if (!data.image || !data.image.thumbnailUrl) {
        console.warn("No image field for pic data:", docId);
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

function setPic(docId, data)
{
    if (!docId || !checkData(data))
        return null;

    if (!picsMap.has(docId)) {
        const picItem = {
            earthPicDiv: createEarthPicDiv(data),
            scrollPicDiv: createScrollPicDiv(data),
            data: data
        }
        picsMap.set(docId, picItem);
    }
    const returnedPicItem = picsMap.get(docId);
    return returnedPicItem;
}

let sortedPicItems = [];
let selectedItemIndex = undefined;

async function updateSkyPhotos(isOn)
{
    if (!isOn) {
        skyPhotosEarthGallery.style.display = 'none';
        skyPhotosScrollGallery.hide();
        return;
    }

    skyPhotosEarthGallery.style.display = 'block';
    skyPhotosScrollGallery.show();

    if (!db) {
        console.warn("No Firestore DB available, skipping gallery");
        return;
    }

    await ensureAuthReady();

    const q = query(
        collection(db, "images")
    );

    let snap;
    try {
        snap = await getDocs(q);
    } catch (e) {
        console.error("Error fetching gallery documents:", e);
        return;
    }

    console.log("DB documents fetched:", snap.size);

    let nPics = 0;
    sortedPicItems = [];
    const latestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec();
    snap.forEach(d => {
        const data = d.data();
        const timestamp = data.takenTime || data.createdAt;
        const timestampDate = timestamp.toDate();
        let timeSec = timestampDate.getTime() / 1000;
        const SECONDS_IN_DAY = 3600*24;
        while (timeSec > latestEpicTimeSec)
            timeSec -= SECONDS_IN_DAY;
        const picItem = setPic(d.id, data);
        if (picItem) {
            picItem.timeSec = timeSec;
            picItem.data = data;
            sortedPicItems.push(picItem);
            nPics++;
        }
    });

    sortedPicItems.sort((a, b) => a.timeSec - b.timeSec);

    for(let i = 0; i < sortedPicItems.length; i++)
    {
        const picItem = sortedPicItems[i];
        const scrollPicDiv = picItem.scrollPicDiv;
        const timestamp = picItem.data.takenTime || picItem.data.createdAt;
        console.log(`Pic #${i}: real date: \"${timestamp.toDate()}\", fake date:\"${new Date(sortedPicItems[i].timeSec * 1000)}\"`)
        skyPhotosScrollGallery.appendItem(scrollPicDiv); 
    }
    skyPhotosScrollGallery.show();


    skyPhotosScrollGallery.setSelectItemCb((node, index) => {
        if (index == selectedItemIndex)
            return;
        selectedItemIndex = index;
        if (index == undefined)
            return;
        const picItem = sortedPicItems[index];
        const timeSec = picItem.timeSec;
        gSetPlayState(false);
        gJumpToEpicTime(timeSec);
    });

    skyPhotosScrollGallery.setSelectedItemClickCb((node, index) => {
        const picItem = sortedPicItems[index];
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

        openPopupFromThumbnail(picImg);
    })

    console.log("Pics created:", nPics);
}

export function updateSkyPhotosPositions()
{
    if (sortedPicItems.length > 0)
    {
        const currentDate = new Date(gEpicTimeSec * 1000);
        const currentTimeSec = currentDate.getTime() / 1000;
        const closestPicIndex = gFindClosestIndexInSortedArray(sortedPicItems, currentTimeSec, picItem => picItem.timeSec);
        if (closestPicIndex < 0 || closestPicIndex >= sortedPicItems.length)
            return;
        const closestPicTimeSec = sortedPicItems[closestPicIndex].timeSec;
        const prevPicIndex = closestPicTimeSec <= currentTimeSec ? closestPicIndex : closestPicIndex - 1;
        const nextPicIndex = closestPicTimeSec >= currentTimeSec ? closestPicIndex : closestPicIndex + 1;
        //console.log("indices: " + prevPicIndex + " - " + closestPicIndex + " - " + nextPicIndex);
        let currentTimeIndexFloat;
        if (prevPicIndex == nextPicIndex ||
            prevPicIndex < 0 ||
            nextPicIndex >= sortedPicItems.length
        )
            currentTimeIndexFloat = closestPicIndex;
        else 
            currentTimeIndexFloat = prevPicIndex + 
                (currentTimeSec - sortedPicItems[prevPicIndex].timeSec) / 
                (sortedPicItems[nextPicIndex].timeSec - sortedPicItems[prevPicIndex].timeSec);
        const currentTimeAlpha = currentTimeIndexFloat / (sortedPicItems.length - 1);
        skyPhotosScrollGallery.scrollToAlpha(currentTimeAlpha);
        //skyPhotosScrollGallery.scrollToAlpha((Math.sin(currentTimeSec / 3600) + 1) / 2);


    }

    let closestEarthPicDiv;
    let maxAlpha = 0;
    picsMap.forEach((picItem, docId) => {
        const alpha = updateEarthSkyPhotoPosition(picItem);
        if (alpha && alpha > maxAlpha) {
            closestEarthPicDiv = picItem.earthPicDiv;
            maxAlpha = alpha;
        }
    });
    if (closestEarthPicDiv)
        closestEarthPicDiv.style.zIndex = 10;
}

const skyPhotosBtn = document.getElementById('skyPhotosBtn');
const cameraButton = document.getElementById("cameraButton");
const scrollCursor = document.getElementById('scrollCursor');
cameraButton.style.display = 'none';
scrollCursor.style.display = 'none';
skyPhotosBtn.addEventListener('click', () => {
    skyPhotosBtn.dataset.state =
        skyPhotosBtn.dataset.state === "on" ? "off" : "on";
    const showSkyPhotos = skyPhotosBtn.dataset.state === "on";
    gControlState.blockSnapping = showSkyPhotos;
    cameraButton.style.display = showSkyPhotos ? "block" : "none";
    scrollCursor.style.display = showSkyPhotos ? "block" : "none";
    updateSkyPhotos(showSkyPhotos);
});
