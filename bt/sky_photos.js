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

function updateEarthSkyPhoto(picItem)
{
    if (buildingSkyPics)
        return 0;
    if (!picItem || !picItem.earthPicDiv)
        return 0;
    const earthPicDiv = picItem.earthPicDiv;
    const timestampTimeSec = picItem.epicTimeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);
    const currentDate = new Date(gEpicTimeSec * 1000);

    const dateDiff = dateDiffSecondsWithTZ(currentDate, timestampDate);
    if (Math.abs(dateDiff) > 12 * 3600)
    {
        earthPicDiv.style.display = 'none';
        return 0;
    }

    const picRecord = picItem;
    const picPos = gGetScreenCoordFromLatLon(picRecord.gps.lat, picRecord.gps.lon);
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

function createPicElements(skyPhotoRecord)
{
    if (!skyPhotoRecord) {
        console.error("Null skyPhotoRecord");
        return;
    }

    skyPhotoRecord.earthPicDiv = createEarthPicDiv(skyPhotoRecord);
    skyPhotoRecord.scrollPicDiv = createScrollPicDiv(skyPhotoRecord);
}

function jumpToPicEpicTimeByIndex(index)
{
    if (index == undefined)
        return;
    const picItem = skyPhotosDB.getSkyPhotoAtEpicTimeIndex(index);
    if (!picItem)
    {
        console.error("No sky pic at index ", index);
        return;
    }
    const timeSec = picItem.epicTimeSec;
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

function setEpicTimeByPicsAlpha(alpha)
{
    const timeSec = skyPhotosDB.getEpicTimeSecByAlpha(alpha);
    if (!timeSec) {
        console.error("Could not resolve Epic Time by alpha ", alpha);
        return;
    }
    gSetPlayState(false);
    gControlState.blockSnapping = true;
    gJumpToEpicTime(timeSec);
}

skyPhotosDB.addNewSkyPhotoCallback(async (record, index) => {    
    const picItem = record;

    const timestampTimeSec = picItem.epicTimeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);

    console.debug("Placing new sky photo of time " + timestampDate + " at index " + index);
    createPicElements(picItem);

    const earthPicDiv = picItem.earthPicDiv;
    const scrollPicDiv = picItem.scrollPicDiv;
    skyPhotosEarthGallery.insertBefore(earthPicDiv, 
        skyPhotosEarthGallery.children.length == 0 ? null :
            skyPhotosEarthGallery.children[index]);
    skyPhotosScrollGallery.insertItemAtIndex(scrollPicDiv, 
        skyPhotosScrollGallery.getNumItems() == 0 ? -1 : index); 
});

function setSkyPhotosScrollGalleryCallbacks()
{
    skyPhotosScrollGallery.setSelectItemCb((node, index) => {
        const scrollDivImg = skyPhotosScrollGallery.getItemImg(node);
        scrollDivImg.style.border = `4px solid rgba(255, 255, 255, 1)`;

        if (buildingSkyPics)
            return;
        jumpToPicEpicTimeByIndex(index);
    });

    skyPhotosScrollGallery.setUnselectItemCb((node, index) => {
        const scrollDivImg = skyPhotosScrollGallery.getItemImg(node);
        scrollDivImg.style.border = `0px solid`;
    });

    skyPhotosScrollGallery.setSelectedItemClickCb((node, index) => {
        if (buildingSkyPics)
            return;
        let picImg = skyPhotosScrollGallery.getItemImg(node);
        openPopupFromThumbnail(picImg, picItem);
    });

    skyPhotosScrollGallery.setScrollAlphaCb((alpha) => {
        if (buildingSkyPics)
            return;
        setEpicTimeByPicsAlpha(alpha);
    });

}

async function addSkyPhotos()
{
    console.log("Adding current sky photos to gallery");
    await addCurrentSkyPhotos();
    console.log("Adding sky photos before first one in gallery");
    if (!addSkyPhotosBefore()) 
    {
        console.warn("Adding all sky photos to gallery");
        addAllSkyPhotos();
    }
}

async function addCurrentSkyPhotos()
{
    const dayBeforeLatestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec() - SECONDS_IN_DAY;
    const dayBeforeLatestEpicDate = new Date(dayBeforeLatestEpicTimeSec * 1000);
    buildingSkyPics = true;
    await skyPhotosDB.fetchSkyPhotosAfterDate(dayBeforeLatestEpicDate);
    buildingSkyPics = false;
}

async function addSkyPhotosBefore(nDocsBefore = 0)
{
    buildingSkyPics = true;
    await skyPhotosDB.fetchMoreSkyPhotosBefore(nDocsBefore);
    buildingSkyPics = false;
}

async function addAllSkyPhotos()
{
    buildingSkyPics = true;
    await skyPhotosDB.fetchAllSkyPhotos();
    buildingSkyPics = false;
}

export function updateSkyPhotos()
{
    updateScrollSkyPhotos();
    updateEarthSkyPhotos();
}

function updateScrollSkyPhotos()
{
    const alpha = skyPhotosDB.getAlphaByEpicTimeSec(gEpicTimeSec);
    if (alpha < 0 || alpha > 1)
    {
        //console.error("Could not get alpha from EPIC timeSec ", gEpicTimeSec);
        return;
    }
    skyPhotosScrollGallery.scrollToAlpha(alpha);
}

function updateEarthSkyPhotos()
{

    let closestEarthPicDiv;
    let maxAlpha = 0;
    skyPhotosDB.forEachLocal((picItem) => {
        const alpha = updateEarthSkyPhoto(picItem);
        if (alpha && alpha > maxAlpha) {
            closestEarthPicDiv = picItem.earthPicDiv;
            maxAlpha = alpha;
        }
    });
    if (closestEarthPicDiv)
        closestEarthPicDiv.style.zIndex = 10;
}

export async function setSkyPhotosState(isOn)
{
    const showSkyPhotos = isOn;
    if (showSkyPhotos)
        gSetPlayState(false);
    gControlState.blockSnapping = showSkyPhotos;

    if (!showSkyPhotos) {
        skyPhotosEarthGallery.style.display = 'none';
        skyPhotosScrollGallery.hide();
        return;
    }

    skyPhotosEarthGallery.style.display = 'block';
    skyPhotosScrollGallery.show();

    return addSkyPhotos();
}

export async function selectPhotoByDocId(docId)
{
    const picItemIndex = skyPhotosDB.getEpicTimeIndexByDocId(docId);
    if (picItemIndex != undefined)
    {
        jumpToPicEpicTimeByIndex(picItemIndex);
    }
}