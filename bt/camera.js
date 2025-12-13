const modal = document.getElementById('photoModal');
const modalImage = document.getElementById('modalImage');
const modalTimestamp = document.getElementById('modalTimestamp');
const modalGPS = document.getElementById('modalGPS');
const modalOrientation = document.getElementById('modalOrientation');
const modalSky = document.getElementById('modalSkyCoverage');
const closeModal = document.getElementById('closeModal');
const loading = document.getElementById("loadingOverlay");

let latestOrientation = { alpha: 0, beta: 0, gamma: 0 };

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

// Capture photo and metadata
document.getElementById("cameraButton").addEventListener("click", async () => {
  // Trigger camera
  document.getElementById("cameraInput").click();
});

function analyzeSky(ctx, width, height, gps, orientation) {
  const imageData = ctx.getImageData(0, 0, width, height);
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
        "Sky photo: " + (isSkyPhoto ? 'Likely' : 'Unlikely') + " (" + skyRatio.toFixed(2) + ")";
    
  return isSkyPhoto;

}

let preparedImageDataURL = null;

// When the user takes a picture
document.getElementById("cameraInput").addEventListener("change", async (event) => {
  preparedImageDataURL = null;

  const file = event.target.files[0];
  if (!file) return;

  // Show loading spinner immediately after accepting the photo
  loading.style.display = "flex";

  // Request GPS NOW
  let gps = null;
  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      gps = { lat: pos.coords.latitude, lon: pos.coords.longitude, alt: pos.coords.altitude };
    } catch (err) {
      console.warn("GPS not available:", err.message);
    }
  }

  // Attempt to get GPS from EXIF (optional, only if stored)
  if (!gps) {
    console.log("Trying to get GPS from EXIF");
    EXIF.getData(file, function() {
        const tags = EXIF.getAllTags(this);
        let gps = null;
        if (tags.GPSLatitude && tags.GPSLongitude) {
            const lat = tags.GPSLatitude[0] + tags.GPSLatitude[1]/60 + tags.GPSLatitude[2]/3600;
            const lon = tags.GPSLongitude[0] + tags.GPSLongitude[1]/60 + tags.GPSLongitude[2]/3600;
            gps = { lat, lon };
            console.log("Got GPS from EXIF:", gps);
        }
        else {
            console.log("No GPS in EXIF data");
        }
    });
  }

  // Get timestamp
  const timestamp = new Date().toISOString();

  // Get latest device orientation
  const alpha = latestOrientation.alpha;
  const beta = latestOrientation.beta;
  const gamma = latestOrientation.gamma;

 // Show modal
  modalImage.src = URL.createObjectURL(file);
  modalTimestamp.textContent = `Timestamp: ${timestamp}`;
  modalGPS.textContent = gps ? `GPS: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` : "GPS: unavailable";
  modalOrientation.textContent = `Orientation: yaw/alpha ${alpha.toFixed(1)}, pitch/beta ${beta.toFixed(1)}, roll/gamma ${gamma.toFixed(1)}`;

  // Sky coverage
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img,0,0);
    const isSky = analyzeSky(ctx, canvas.width, canvas.height, gps, latestOrientation);
    console.log("Sky photo analysis:", isSky);
  };
  img.src = URL.createObjectURL(file);

  preparedImageDataURL = await addExif(
    file,
    gps,
    latestOrientation.alpha
  );

  // All ready → Hide spinner + show modal
  loading.style.display = "none";
  modal.style.display = 'flex';
});


// Close modal when clicking outside or on close button
closeModal.addEventListener('click', () => modal.style.display='none');
modal.addEventListener('click', e => {
  if(e.target === modal) modal.style.display='none';
});

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

async function addExif(file, gps, heading) {
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

    if (heading != null) {
      exifObj["GPS"][piexif.GPSIFD.GPSImgDirection] = toRational(heading);
      exifObj["GPS"][piexif.GPSIFD.GPSImgDirectionRef] = "T";
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

async function saveImage(dataURL) {
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid && window.showSaveFilePicker) {
    const handle = await showSaveFilePicker({
      suggestedName: `Blueturn_${Date.now()}.jpg`,
      types: [{ accept: { "image/jpeg": [".jpg"] } }]
    });
    const w = await handle.createWritable();
    await w.write(await (await fetch(dataURL)).blob());
    await w.close();
  } else {
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `Blueturn_${Date.now()}.jpg`;
    a.click();
  }

  showToast("Saved to gallery");
}

function showToast(text) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2000);
}

document.getElementById("saveImageBtn").addEventListener("click", async (e) => {
  e.stopPropagation(); // empêche la popup de se fermer
  if (!preparedImageDataURL) return;

  await saveImage(preparedImageDataURL);
});
