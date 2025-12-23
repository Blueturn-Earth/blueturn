import {gCalculateScreenCoordFromLatLon, gGetDateFromTimeSec} from './utils.js';
import {gEpicImageData, gEpicTimeSec, gEpicDB} from '././app.js';
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

console.log("Sky Photos module loaded");

const canvas = document.getElementById('glcanvas');
const skyPhotosEarthGallery = document.getElementById('skyPhotosEarthGallery');

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

export function updateSkyPhotoPosition(picDiv)
{
    const timestamp = picDiv.data.takenTime || picDiv.data.createdAt;
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
            picDiv.style.display = 'none';
            return;
        }
    }

    const picPos = gGetScreenCoordFromLatLon(picDiv.data.gps.lat, picDiv.data.gps.lon);
    if (picPos.z < -0.2) {
        picDiv.style.display = 'none';
        return;
    }    
    picDiv.style.display = 'block';
    const dpr = window.devicePixelRatio || 1;
    picDiv.style.left = `${picPos.x / dpr}px`;
    picDiv.style.top = `${picPos.y / dpr}px`;
    picDiv.style.zIndex = picPos.z <= 0.0 ? '-1' : '5'; 

    // process timestamp
    const diffSec = timeDiffSecondsWithTZ(currentDate, timestampDate);
    const absDiffSec = Math.abs(diffSec);
    const scaleWindow = gControlState.speed;
    const minScale = .02;
    const maxScale = 0.5;
    const scaleAlpha = smoothstep
        (1.0 - Math.min(absDiffSec, scaleWindow) / scaleWindow);
    const scaleFactor = scaleAlpha*(maxScale - minScale) + minScale;
    if (diffSec < 0) {
        picDiv.style.opacity = 1;
        picDiv.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;
    }
    else {
        picDiv.style.opacity = scaleFactor/maxScale;
        picDiv.style.transform = `translate(-50%, -50%) scale(${maxScale})`;
    }
    picDiv.style.zIndex = 5 + Math.round(scaleFactor/maxScale * 4);

    const borderWindow = gControlState.speed / 2;
    const minBorderFactor = 0;
    const maxBorderFactor = 4.0;
    const borderAlpha = smoothstep
        (1.0 - Math.min(absDiffSec, borderWindow) / borderWindow);
    const borderFactor = borderAlpha*(maxBorderFactor - minBorderFactor) + minBorderFactor;
    const borderColor = Math.round(borderAlpha * 255);    
    picDiv.style.border = `${borderFactor}px solid rgba(${borderColor}, ${borderColor}, ${borderColor}, ${borderAlpha})`;
}

function createPicDiv(data)
{
    const picDiv = document.createElement('img');
    picDiv.className = 'sky-photo-thumb';
    picDiv.src = data.image.thumbnailUrl;
    picDiv.data = data;
    picDiv.onclick = () => {
        openPopupFromThumbnail(picDiv);
    }
    return picDiv;
}

async function setPic(docId, data)
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
    let picDiv;
    if (!picsMap.has(docId)) {
        picDiv = createPicDiv(data);
        skyPhotosEarthGallery.appendChild(picDiv);
        picsMap.set(docId, picDiv);
    }
    else {
        picDiv = picsMap.get(docId);
    }
    updateSkyPhotoPosition(picDiv);
    return true;
}

async function updateSkyPhotos(isOn)
{
    if (!isOn) {
        skyPhotosEarthGallery.style.display = 'none';
        return;
    }

    skyPhotosEarthGallery.style.display = 'block';

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
    snap.forEach(d => {
        if (setPic(d.id, d.data()))
            nPics++;
    });
    console.log("Pics created:", nPics);
}

export function updateSkyPhotosPositions()
{
    picsMap.forEach((picDiv, docId) => {
        updateSkyPhotoPosition(picDiv);
    });
}

const cameraButton = document.getElementById("cameraButton");
const skyPhotosBtn = document.getElementById('skyPhotosBtn');
skyPhotosBtn.addEventListener('click', () => {
    skyPhotosBtn.dataset.state =
        skyPhotosBtn.dataset.state === "on" ? "off" : "on";
    const showSkyPhotos = skyPhotosBtn.dataset.state === "on";
    cameraButton.style.display = showSkyPhotos ? "block" : "none";
    updateSkyPhotos(showSkyPhotos);
});
