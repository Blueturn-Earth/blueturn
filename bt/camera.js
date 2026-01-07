import {getStorageProvider} from './gdrive_provider.js';
import {skyPhotosDB} from './sky_photos_db.js';
import {processEXIF, addEXIF} from './exif.js';
import {setSkyPhotosState, selectPhotoByDocId} from './sky_photos.js';
import {analyzeSkyFromImg} from './sky_analyzer.js'
import {safeSetCapturedImageInLocalStorage} from './safe_localStorage.js';
import {gSetPlayState} from './app.js';

if (window.navigator.standalone && window.screen.height === window.innerHeight) {
  console.warn("Running in fullscreen mode — camera may be unstable");
}

function dataURLtoFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

window.addEventListener("load", () => {
  //alert("Page loaded, checking for pending camera capture...");
  const pending = sessionStorage.getItem("cameraPending");
  const imgURL = localStorage.getItem("capturedImage");

  if (pending && imgURL) {
    //alert("Found pending camera capture. Restoring...");
    console.log("Restoring from camera capture");
    // We *intended* to come back from camera,
    // but page was reloaded or restored
    sessionStorage.removeItem("cameraPending");
    localStorage.removeItem("capturedImage");

    const imgFile = dataURLtoFile(imgURL, "camera.jpg");

    openNewPhoto(imgURL, imgFile, true);
  }
});

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
let latestImageUploaded;

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

enableOrientation();

const cameraButton = document.getElementById("cameraButton");
const cameraInput = document.getElementById("cameraInput");
cameraInput.style.display = "none";

// Capture photo and metadata
cameraButton.addEventListener("click", async () => {
  sessionStorage.setItem("cameraPending", "1");
  sessionStorage.setItem("returnUrl", location.href);  
  console.log("Camera button clicked, set pending flag with return URL: ", location.href);
  // Trigger camera
  cameraInput.click();
});

const addPhotoButton = document.getElementById("addPhotoButton");
const addPhotoInput = document.getElementById("addPhotoInput");
addPhotoInput.style.display = "none";

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
  saveImageBtn.disabled = /*!skyOK ||*/ !tsOK || !gpsOK;
}

async function provideEXIF(imgFile, fromCamera)
{
  try {
    let result;
    if (fromCamera) {
      console.log("Adding EXIF to camera image");
      result = await addEXIF(imgFile);
    }
    else {
      console.log("Processing EXIF from uploaded image");
      result = await processEXIF(imgFile);
    }
    return {
      takenTime: result.takenTime,
      gps: result.gps,
      error: result.error
    };
  }
  catch(e) {
    console.error("Error providing EXIF data: ", e.message);
    alert(e.message);  
    return {
      error: e
    };
  }
}

async function openNewPhotoWithImg(img, imgFile, fromCamera)
{
  console.log("Show new photo image in modal");
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
    console.log("Sky analysis completed: ", skyData);
    updateModal({skyData: skyData});
  })
  .catch((error) => {
    console.error("Sky analysis failed: ", error);
    updateModal({error: error});
  });
  
  provideEXIF(imgFile, fromCamera)
  .then((result) => {
    console.log("EXIF provided: ", result);
    updateModal({
      timestamp: result.takenTime,
      gps: result.gps,
      error: result.error
    });
  })
  .catch((error) => {
    console.error("EXIF providing failed: ", error);
    updateModal({error: error});
  });
}

function openNewPhoto(imgURL, imgFile, fromCamera)
{
  console.log("Opening new photo from file:", imgFile);

  latestTakenTime = undefined;
  latestGPS = undefined;
  latestSkyRatio = undefined;

  // Show loading spinner immediately after accepting the photo
  loading.style.display = "flex";

  latestImageFile = imgFile;
  latestImageUploaded = false;

  // Show modal
  console.log("Loading new photo");
  modalImage.onload = () => {
    console.log("New photo loaded");
    openNewPhotoWithImg(modalImage, imgFile, fromCamera);
  }
  modalImage.onerror = () => {
    console.error("Failed to load image: ", imgFile);
    //alert("Failed to open " + imgFile);
    loading.style.display = "none";
  }
  modalImage.src = imgURL;
}

function cameraInputChange(event)
{
  //alert("Camera capture returned, processing...");
  const file = event.target.files && event.target.files[0];
  if (!file) {
    //alert("No file captured from camera");
    console.warn("No file captured from camera");
    return;
  }

  console.log("File captured from camera: ", file);
  const reader = new FileReader();

  reader.onload = () => {
    //alert("Camera image ready, opening...");

    const imgURL = reader.result;

    // Persist immediately, and asynchronously
    safeSetCapturedImageInLocalStorage(imgURL);

    //alert("Opening captured image...");
    openNewPhoto(imgURL, file, true);
  };

  reader.readAsDataURL(file);
}

function fileInputChange(event)
{
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  return openNewPhoto(url, file, false);
}

// When the user takes a picture
cameraInput.addEventListener("change", cameraInputChange);
// When the user adds a picture
addPhotoInput.addEventListener("change", fileInputChange);

// Close modal when clicking outside or on close button
closeModal.addEventListener('click', () => modal.style.display='none');
modal.addEventListener("click", () => {
  if (latestImageUploaded)
    modal.style.display='none';
});

const progressEl = document.getElementById("uploadProgress");
const barEl = progressEl.querySelector(".bar");
const labelEl = progressEl.querySelector(".label");

const SUPER_USER_ID = "115698886322844446345";

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
  console.log("Saving image file: ", imgFile);

  if (needsConversion(imgFile)) {
    console.log("Image needs conversion before upload");
    imgFile = await heicToJpeg(imgFile);
  }

  const dataURL = URL.createObjectURL(imgFile);

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
    const record = {
      image: uploadResult,
      takenTime: latestTakenTime,
      gps: latestGPS,
      skyRatio: latestSkyRatio,
      profile: profile
    };
    docId = await skyPhotosDB.saveSkyPhoto(record);

    labelEl.textContent = "Thank you " + (profile ? profile.given_name : "user") + "!";
    barEl.style.width = "100%";
    saveImageBtn.disabled = true;
    latestImageUploaded = true;
  } catch (e) {    
    labelEl.textContent = "Upload failed";
    barEl.style.width = "0%";
    console.error(e);
    alert(e);
    return;
  }

  try {
    await setSkyPhotosState(true);
    selectPhotoByDocId(docId);
  } catch (e) {    
    console.error(e);
    //alert(e);
  }
}

saveImageBtn.addEventListener("click", async (e) => {
  // First do a user-triggered authentication
  await getStorageProvider().ensureAuth();
  e.stopPropagation(); // empêche la popup de se fermer
  if (!latestImageFile) 
    return;

  await saveImage(latestImageFile);
});

const skyPhotosBtn = document.getElementById('skyPhotosBtn');
skyPhotosBtn.addEventListener('click', () => {
    // toggle
    const isOn = skyPhotosBtn.dataset.state === "off";
    skyPhotosBtn.dataset.state = isOn ? "on" : "off";
    if (isOn) {
        setSkyPhotosState(true);
        gSetPlayState(true);
    }
    else {
        setSkyPhotosState(false);
    }
});
