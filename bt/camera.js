import GoogleDriveProvider from './gdrive_provider.js';
import {saveMetadata} from './firebase_save.js';

const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTimestamp = document.getElementById('modalTimestamp');
const modalGPS = document.getElementById('modalGPS');
const modalSky = document.getElementById('modalSkyCoverage');
const closeModal = document.getElementById('closeModal');
const loading = document.getElementById("loadingOverlay");

let latestOrientation = { alpha: 0, beta: 0, gamma: 0 };
let latestGPS = null;

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

console.log("Add camera button click handler");
// Capture photo and metadata
document.getElementById("cameraButton").addEventListener("click", async () => {
  // Trigger camera
  document.getElementById("cameraInput").click();
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

let preparedImageDataURL = null;

console.log("Add camera input change handler");
// When the user takes a picture
document.getElementById("cameraInput").addEventListener("change", async (event) => {
  preparedImageDataURL = null;

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
    }
  }

  // Attempt to get GPS from EXIF (optional, only if stored)
  if (!latestGPS) {
    console.log("Trying to get GPS from EXIF");
    EXIF.getData(file, function() {
        const tags = EXIF.getAllTags(this);
        if (tags.GPSLatitude && tags.GPSLongitude) {
            const lat = tags.GPSLatitude[0] + tags.GPSLatitude[1]/60 + tags.GPSLatitude[2]/3600;
            const lon = tags.GPSLongitude[0] + tags.GPSLongitude[1]/60 + tags.GPSLongitude[2]/3600;
            latestGPS = { lat, lon };
            console.log("Got GPS from EXIF:", latestGPS);
        }
        else {
            console.log("No GPS in EXIF data");
        }
    });
  }

  // Get timestamp
  const timestamp = new Date().toISOString();

 // Show modal
  modalImage.src = URL.createObjectURL(file);
  modalTimestamp.textContent = timestamp;
  modalGPS.textContent = latestGPS ? `GPS: ${latestGPS.lat.toFixed(6)}, ${latestGPS.lon.toFixed(6)}` : "GPS: unavailable";

  // Sky coverage
  const img = new Image();
  img.onload = () => {
    const isSky = analyzeSky(img);
    console.log("Sky photo analysis:", isSky);
  };
  console.log("Loading image");
  img.src = URL.createObjectURL(file);

  console.log("Adding EXIF data to image…");
  preparedImageDataURL = await addExif(
    file,
    latestGPS
  );

  console.log("Show modal");
  // All ready → Hide spinner + show modal
  loading.style.display = "none";
  modal.style.display = 'flex';
  labelEl.style.display = "none";
  barEl.style.width = "0%";
});


// Close modal when clicking outside or on close button
closeModal.addEventListener('click', () => modal.style.display='none');

function toRational(number) {
  const denom = 1000000;
  return [Math.round(number * denom), denom];
}

function gpsToExif(coord) {
  const abs = Math.abs(coord);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return [[deg,1], [min,1], toRational(sec)];
}

async function addExif(file, gps) {
  const dataURL = await fileToDataURL(file);
  const exifObj = piexif.load(dataURL);

  // Timestamp
  const now = new Date();
  const exifDate =
    now.getFullYear() + ":" +
    String(now.getMonth()+1).padStart(2,"0") + ":" +
    String(now.getDate()).padStart(2,"0") + " " +
    String(now.getHours()).padStart(2,"0") + ":" +
    String(now.getMinutes()).padStart(2,"0") + ":" +
    String(now.getSeconds()).padStart(2,"0");

  exifObj["0th"][piexif.ImageIFD.DateTime] = exifDate;
  exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = exifDate;

  // GPS
  if (gps) {
    exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef]  = gps.lat >= 0 ? "N" : "S";
    exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = gps.lon >= 0 ? "E" : "W";
    exifObj["GPS"][piexif.GPSIFD.GPSLatitude]  = gpsToExif(gps.lat);
    exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = gpsToExif(gps.lon);

    if (gps.alt != null) {
      exifObj["GPS"][piexif.GPSIFD.GPSAltitude] = toRational(Math.abs(gps.alt));
      exifObj["GPS"][piexif.GPSIFD.GPSAltitudeRef] = gps.alt < 0 ? 1 : 0;
    }
  }

  const exifBytes = piexif.dump(exifObj);
  return piexif.insert(exifBytes, dataURL);
}

function fileToDataURL(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });
}

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
  if (!preparedImageDataURL) return;

  await saveImage(preparedImageDataURL);
});

