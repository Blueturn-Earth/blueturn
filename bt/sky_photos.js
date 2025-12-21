import {gCalculateScreenCoordFromLatLon} from './utils.js';
import {gEpicImageData} from '././app.js';
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

export function updateSkyPhotoPosition(picDiv)
{
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
}

function createPicDiv(data)
{
    const picDiv = document.createElement('img');
    picDiv.className = 'sky-photo-thumb';
    picDiv.src = data.image.thumbnailUrl;
    picDiv.width = 80;
    picDiv.height = 80;
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
        console.warn("No image data for pic:", docId);
        return false;
    }
    if (!data.gps || data.gps.lat === undefined || data.gps.lon === undefined) {
        console.warn("No GPS data for pic:", docId);
        return false;
    }
    if (!data.createdAt) {
        console.warn("No createdAt data for pic:", docId);
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
