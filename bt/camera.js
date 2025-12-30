import GoogleDriveProvider from './gdrive_provider.js';
import {saveMetadata} from './firebase_save.js';
import {processEXIF, addEXIF} from './exif.js';
import {reloadAndSelectNewSkyPhoto} from './sky_photos.js';
import {analyzeSkyFromImg} from './sky_analyzer.js'

const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTimestamp = document.getElementById('modalTimestamp');
const modalGPS = document.getElementById('modalGPS');
const modalSky = document.getElementById('modalSkyCoverage');
const closeModal = document.getElementById('closeModal');
const loading = document.getElementById("skyPhotoLoadingOverlay");
const saveImageBtn = document.getElementById("saveImageBtn")

let latestOrientation = { alpha: 0, beta: 0, gamma: 0 };
let latestGPS = null;
let latestTakenTime;
let latestSkyRatio;
let latestImageFile;

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

const addPhotoButton = document.getElementById("addPhotoButton");
const addPhotoInput = document.getElementById("addPhotoInput");
addPhotoInput.style.display = "none";

console.log("Add Add-Photo button click handler");
// Capture photo and metadata
addPhotoButton.addEventListener("click", async () => {
  // Trigger camera
  addPhotoInput.click();
});

let skyOK, tsOK, gpsOK; 

function updateModal(newData)
{
  if (newData.skyData !== undefined)
  {
    const skyText = "Sky pixel ratio: " + (newData.skyData.skyRatio*100).toFixed(0) + "%";
    console.log("Got sky data: ", skyText);
    modalSky.textContent = skyText;
    skyOK = newData.skyData.isSkyPhoto;
    modalSky.style.color = skyOK ? "lightgreen" : "pink";
    latestSkyRatio = newData.skyData.skyRatio;
  }
  if (newData.timestamp !== undefined)
  {
    modalTimestamp.textContent = "Timestamp: " + newData.timestamp;
    tsOK = !!newData.timestamp;
    modalTimestamp.style.color = tsOK ? "lightgreen" : "pink";
    latestTakenTime = newData.timestamp;
  }
  if (newData.gps !== undefined)
  {
    modalGPS.textContent = "GPS: " + (newData.gps ? `GPS: ${newData.gps.lat.toFixed(6)}, ${newData.gps.lon.toFixed(6)}` : "unavailable");
    gpsOK = !!newData.gps;
    modalGPS.style.color = gpsOK ? "lightgreen" : "pink";
    latestGPS = newData.gps;
  }
  saveImageBtn.disabled = !skyOK || !tsOK || !gpsOK;
}

async function provideEXIF(imgFile, fromCamera)
{
  try {
    let result;
    if (fromCamera)
      result = await addEXIF(imgFile);
    else
      result = await processEXIF(imgFile);
    if (result.error)
    {
      console.error(result.error.message);
      alert(result.error.message);
    }
    return {
      takenTime: result.takenTime,
      gps: result.gps,
      error: result.error
    };
  }
  catch(e) {
    return {
      error: e
    };
  }
}

async function openNewPhotoWithImg(img, imgFile, camera)
{
  console.log("Show modal");
  // All ready → Hide spinner + show modal
  loading.style.display = "none";
  modal.style.display = 'flex';
  labelEl.style.display = "none";
  barEl.style.width = "0%";
  modalSky.textContent = "Analyzing sky...";
  modalSky.style.color = "white";
  modalTimestamp.textContent = "Timestamp: Determining...";
  modalTimestamp.style.color = "white";
  modalGPS.textContent = "GPS: Determining...";
  modalGPS.style.color = "white";
  saveImageBtn.disabled = true;
  skyOK = tsOK = gpsOK = undefined;

  // Sky coverage
  analyzeSkyFromImg(img)
  .then((skyData) => {
    updateModal({skyData: skyData});
  })
  .catch((error) => {
    updateModal({error: error});
  });
  
  provideEXIF(imgFile, camera)
  .then((result) => {
    updateModal({
      timestamp: result.takenTime,
      gps: result.gps,
      error: result.error
    });
  })
  .catch((error) => {
    updateModal({error: error});
  });
}

function openNewPhotoWithFile(file, camera)
{
  const url = URL.createObjectURL(file);

  // Show modal
  console.log("Loading new photo");
  modalImage.onload = () => {
    openNewPhotoWithImg(modalImage, file, camera);
  }
  modalImage.onerror = () => {
    alert("Failed to open " + file);
    loading.style.display = "none";
  }
  modalImage.src = url;
}

console.log("Add camera input change handler");

async function cameraInputChange(event)
{
  return addPhotoInputChange(event, true);
}

async function addPhotoInputChange(event, camera)
{
  latestImageFile = undefined;
  latestTakenTime = undefined;
  latestGPS = undefined;
  latestSkyRatio = undefined;

  const imgFile = event.target.files[0];
  if (!imgFile) return;

  // Show loading spinner immediately after accepting the photo
  loading.style.display = "flex";

  latestImageFile = imgFile;

  openNewPhotoWithFile(imgFile, camera);
}

// When the user takes a picture
cameraInput.addEventListener("change", cameraInputChange);
// When the user adds a picture
addPhotoInput.addEventListener("change", addPhotoInputChange);

// Close modal when clicking outside or on close button
closeModal.addEventListener('click', () => modal.style.display='none');

const progressEl = document.getElementById("uploadProgress");
const barEl = progressEl.querySelector(".bar");
const labelEl = progressEl.querySelector(".label");

const SUPER_USER_ID = "115698886322844446345";

let _storageProvider = null;

function getStorageProvider() {
  if (!_storageProvider) {
    _storageProvider = new GoogleDriveProvider();
  }
  return _storageProvider;
}

document.getElementById("profileBtn").onclick = async () => {
  const forceNewLogin = true;
  await getStorageProvider().ensureAuth(forceNewLogin);
  const profile = getStorageProvider().getProfile();
  if (profile?.sub == SUPER_USER_ID)
  {
    document.getElementById("showDbBtn").style.display = 'block';
  }
};

function needsConversion(imgFile) {
  // HEIC explicitly
  if (imgFile.type === "image/heic" || imgFile.type === "image/heif") {
    return true;
  }

  // iOS camera often gives empty type
  if (!imgFile.type) {
    return true;
  }

  return false;
}

function getBaseName(filename) {
  if (!filename) return "photo";

  // Remove path if any (some browsers include it)
  const name = filename.split("/").pop().split("\\").pop();

  // Remove last extension only
  const dot = name.lastIndexOf(".");
  if (dot > 0) {
    return name.slice(0, dot);
  }

  return name;
}

async function heicToJpeg(imgFile) {
  console.log("Converting ", imgFile.name);
  const baseName = getBaseName(imgFile.name) || "photo";
  const img = await createImageBitmap(imgFile);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const newFileName = `${baseName}.jpg`;
      console.log("Creating new file ", newFileName);
      resolve(new File(
        [blob], 
        newFileName, 
        { type: "image/jpeg" }
      ));
    }, "image/jpeg", 0.92);
  });
}

async function saveImage(imgFile) {

  let uploadFile = imgFile;

  if (needsConversion(imgFile)) {
    console.log("Image needs conversion before upload");
    uploadFile = await heicToJpeg(imgFile);
  }

  const dataURL = URL.createObjectURL(uploadFile);

  const blob = await (await fetch(dataURL)).blob();
  progressEl.classList.remove("hidden");
  barEl.style.width = "0%";
  labelEl.textContent = "Uploading…";
  labelEl.style.display = "block";

  let docId;
  try {
    const uploadResult = await getStorageProvider().upload(blob, (p) => {
      barEl.style.width = `${Math.round(p * 100)}%`;
    });

    labelEl.textContent = "Finalizing…";

    const profile = getStorageProvider().getProfile();

    docId = await saveMetadata(uploadResult, profile, latestGPS, latestTakenTime, latestSkyRatio);

    labelEl.textContent = "Thank you " + (profile ? profile.given_name : "user") + "!";
    barEl.style.width = "100%";
  } catch (e) {    
    labelEl.textContent = "Upload failed";
    barEl.style.width = "0%";
    console.error(e);
    alert(e);
    return;
  }

  try {
    await reloadAndSelectNewSkyPhoto(docId);
  } catch (e) {    
    console.error(e);
    alert(e);
  }
}

saveImageBtn.addEventListener("click", async (e) => {
  saveImageBtn.disabled = true;
  e.stopPropagation(); // empêche la popup de se fermer
  if (!latestImageFile) return;

  await saveImage(latestImageFile);
});

