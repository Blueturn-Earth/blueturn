import GoogleDriveProvider from './gdrive_provider.js';
import {saveMetadata} from './firebase_save.js';
import {processEXIF} from './exif.js'

const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTimestamp = document.getElementById('modalTimestamp');
const modalGPS = document.getElementById('modalGPS');
const modalSky = document.getElementById('modalSkyCoverage');
const closeModal = document.getElementById('closeModal');
const loading = document.getElementById("loadingOverlay");

let latestOrientation = { alpha: 0, beta: 0, gamma: 0 };
let latestGPS = null;
let latestTakenTime;
let latestImageURL;

// Ask for DeviceOrientation permission on iOS
function enableOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      }).catch(console.error);
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

function handleOrientation(e) {
  latestOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
}

console.log("Enabling device orientation");
enableOrientation();

const cameraButton = document.getElementById("cameraButton");
const cameraInput = document.getElementById("cameraInput");
cameraInput.style.display = "none";

console.log("Add camera button click handler");
// Capture photo and metadata
cameraButton.addEventListener("click", async () => {
  // Trigger camera
  cameraInput.click();
});

const imageFileButton = document.getElementById("imageFileButton");
const imageFileInput = document.getElementById("imageInput");
imageFileInput.style.display = "none";

console.log("Add image picker button click handler");
// Capture photo and metadata
imageFileButton.addEventListener("click", async () => {
  // Trigger image file picker
  imageFileInput.click();
});


function analyzeSky(img) {
  console.log("Analyzing sky coverage…");
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let skyPixels = 0;
  const totalPixels = imageData.data.length / 4;

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i+1];
    const b = imageData.data[i+2];
    const luminance = 0.299*r + 0.587*g + 0.114*b;

    // Accept bright pixels or lightly saturated (white/gray clouds)
    const maxColor = Math.max(r,g,b);
    const minColor = Math.min(r,g,b);
    const saturation = (maxColor - minColor)/255;

    if (luminance > 150 && saturation < 0.7) skyPixels++;
    else if (b > r && b > g) skyPixels++;
  }

  const skyRatio = skyPixels / totalPixels;

  const MIN_SKY_RATIO = 0.55;
  let isSkyPhoto = skyRatio > MIN_SKY_RATIO;

    modalSky.textContent = 
        "Sky Ratio: " + (skyRatio.toFixed(2)*100) + "%";

    console.log(modalSky.textContent);
    
  return isSkyPhoto;

}

function updateModal()
{
  // Show modal
  modalImage.src = latestImageURL;
  modalTimestamp.textContent = latestTakenTime;
  modalGPS.textContent = latestGPS ? `GPS: ${latestGPS.lat.toFixed(6)}, ${latestGPS.lon.toFixed(6)}` : "GPS: unavailable";

  // Sky coverage
  const img = new Image();
  img.onload = () => {
    const isSky = analyzeSky(img);
    console.log("Sky photo analysis:", isSky);
  };
  console.log("Loading image");
  img.src = latestImageURL;

  console.log("Show modal");
  // All ready → Hide spinner + show modal
  loading.style.display = "none";
  modal.style.display = 'flex';
  labelEl.style.display = "none";
  barEl.style.width = "0%";
}

console.log("Add camera input change handler");
// When the user takes a picture
document.getElementById("cameraInput").addEventListener("change", async (event) => {
  latestImageURL = undefined;
  latestTakenTime = undefined;
  latestGPS = undefined;

  const file = event.target.files[0];
  if (!file) return;

  // Show loading spinner immediately after accepting the photo
  loading.style.display = "flex";

  // Request GPS NOW
  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      latestGPS = { lat: pos.coords.latitude, lon: pos.coords.longitude, alt: pos.coords.altitude };
    } catch (err) {
      console.warn("GPS not available:", err.message);
      return;
    }
  }

  // Get createdAt
  const createdAt = new Date().toISOString();
  latestTakenTime = createdAt;
  console.log("Using current time as taken time:", latestTakenTime);

  latestImageURL = URL.createObjectURL(file);

  // Show modal
  updateModal();
});

console.log("Add image file input change handler");
// When the user takes a picture
document.getElementById("imageInput").addEventListener("change", async (event) => {
  latestImageURL = undefined;
  latestTakenTime = undefined;
  latestGPS = undefined;

  const imgFile = event.target.files[0];
  if (!imgFile) return;

  // Show loading spinner immediately after accepting the photo
  loading.style.display = "flex";
  try {
    const result = await processEXIF(imgFile);
    latestTakenTime = result.takenTime;
    latestGPS = result.gps;
  }
  catch(e) {
    const errorMsg = "Cannot use selected image";
    alert(errorMsg);
    console.error(errorMsg);
    loading.style.display = "none";
    modal.style.display = 'none';
    labelEl.style.display = "none";
    barEl.style.width = "0%";
    return;
  }

  latestImageURL = URL.createObjectURL(imgFile);

  updateModal();
});

// Close modal when clicking outside or on close button
closeModal.addEventListener('click', () => modal.style.display='none');

const progressEl = document.getElementById("uploadProgress");
const barEl = progressEl.querySelector(".bar");
const labelEl = progressEl.querySelector(".label");

function decodeJwt(token) {
  if (!token)
    return null;
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload));
}

let _storageProvider = null;

function getStorageProvider() {
  if (!_storageProvider) {
    _storageProvider = new GoogleDriveProvider();
  }
  return _storageProvider;
}

document.getElementById("profileBtn").onclick = async () => {
  await getStorageProvider().ensureAuth();
  const driveUserId = getStorageProvider().getProfile()?.sub;
};

async function saveImage(dataURL) {
  const blob = await (await fetch(dataURL)).blob();
  progressEl.classList.remove("hidden");
  barEl.style.width = "0%";
  labelEl.textContent = "Uploading…";
  labelEl.style.display = "block";

  try {
    const uploadResult = await getStorageProvider().upload(blob, (p) => {
      barEl.style.width = `${Math.round(p * 100)}%`;
    });

    labelEl.textContent = "Finalizing…";

    const profile = getStorageProvider().getProfile();

    await saveMetadata(uploadResult, profile, latestGPS);

    labelEl.textContent = "Thank you " + (profile ? profile.given_name : "user") + "!";
    barEl.style.width = "100%";
  } catch (e) {
    labelEl.textContent = "Upload failed";
    barEl.style.width = "0%";
    console.error(e);
  }
}

document.getElementById("saveImageBtn").addEventListener("click", async (e) => {
  e.stopPropagation(); // empêche la popup de se fermer
  if (!latestImageURL) return;

  await saveImage(latestImageURL);
});

