import { gCalculateScreenCoordFromLatLon } from './utils.js';
import { 
    gEpicImageData, 
    gEpicDB, 
    gSetPlayState, 
    gJumpToEpicTime, 
    addEpicTimeChangeCallback, 
    removeEpicTimeChangeCallback } from '././app.js';
import { skyPhotosDB } from "./sky_photos_db.js";
import { openPopupFromThumbnail } from './sky-photos-popup.js';
import { gZoom, gPivotEpicImageData } from './app.js';
import { glZoomFactor } from './gl.js';
import { gControlState } from './controlparams.js';
import { getStorageProvider } from './gdrive_provider.js';
import { addSkyPhotosToggleCallback } from './topUI.js';

const SECONDS_IN_DAY = 3600*24;

const canvas = document.getElementById('glcanvas');
const skyPhotosEarthGallery = document.getElementById('skyPhotosEarthGallery');

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

function updateEarthSkyPhoto(picItem, epicTimeSec)
{
    if (!picItem || !picItem.earthPicDiv)
        return 0;
    const earthPicDiv = picItem.earthPicDiv;
    const timestampTimeSec = picItem.epicTimeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);
    const currentDate = new Date(epicTimeSec * 1000);

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

function createPicElements(skyPhotoRecord)
{
    if (!skyPhotoRecord) {
        console.error("Null skyPhotoRecord");
        return;
    }

    skyPhotoRecord.earthPicDiv = createEarthPicDiv(skyPhotoRecord);
}

skyPhotosDB.addNewSkyPhotoCallback(async (record) => {    
    const index = record.epicTimeIndex;
    const picItem = record;

    const timestampTimeSec = picItem.epicTimeSec;
    const timestampDate = new Date(timestampTimeSec * 1000);

    console.debug("Placing new sky photo of time " + timestampDate + " on Earth at index " + index);
    createPicElements(picItem);

    const earthPicDiv = picItem.earthPicDiv;
    skyPhotosEarthGallery.insertBefore(earthPicDiv, 
        skyPhotosEarthGallery.children.length == 0 ? null :
            skyPhotosEarthGallery.children[index]);
});

function fetchSkyPhotosAroundTimeSec(epicTimeSec)
{
    const latestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec();
    const rangeStartEpicTimeSec = epicTimeSec - 24 * 3600; 
    const rangeEndEpicTimeSec = epicTimeSec + 24 * 3600; 
    const rangeStartEpicTimeDate = new Date(rangeStartEpicTimeSec * 1000);
    const rangeEndEpicTimeDate = new Date(Math.min(rangeEndEpicTimeSec, latestEpicTimeSec) * 1000);
    rangeStartEpicTimeDate.setUTCHours(0,0,0,0);
    rangeEndEpicTimeDate.setUTCHours(23,59,59,999);
    skyPhotosDB.fetchDateRange(rangeStartEpicTimeDate, rangeEndEpicTimeDate);
    
    if (rangeEndEpicTimeSec > latestEpicTimeSec)
        skyPhotosDB.fetchDateRange(rangeEndEpicTimeDate, null);
}

function updateEarthSkyPhotos(epicTimeSec)
{
    // Async fetch
    fetchSkyPhotosAroundTimeSec(epicTimeSec);

    let closestEarthPicDiv;
    let maxAlpha = 0;
    skyPhotosDB.forEachLocal((picItem) => {
        const alpha = updateEarthSkyPhoto(picItem, epicTimeSec);
        if (alpha && alpha > maxAlpha) {
            closestEarthPicDiv = picItem.earthPicDiv;
            maxAlpha = alpha;
        }
    });
    if (closestEarthPicDiv)
        closestEarthPicDiv.style.zIndex = 10;
}

let epicTimeChangeCallbackId = undefined;

addSkyPhotosToggleCallback((isOn) => {
    if (isOn) {
        skyPhotosEarthGallery.style.display = 'block';
        console.assert(epicTimeChangeCallbackId === undefined);
        if (epicTimeChangeCallbackId === undefined)
            epicTimeChangeCallbackId = addEpicTimeChangeCallback(updateEarthSkyPhotos);
    }
    else {
        skyPhotosEarthGallery.style.display = 'none';
        if (epicTimeChangeCallbackId !== undefined) {
            removeEpicTimeChangeCallback(epicTimeChangeCallbackId);
            epicTimeChangeCallbackId = undefined;
        }
    }
});
