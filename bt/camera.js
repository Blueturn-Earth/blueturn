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

// When the user takes a picture
document.getElementById("cameraInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Request GPS NOW
  let gps = null;
  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
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

  // Display popup with photo + GPS + timestamp + orientation
  const imgURL = URL.createObjectURL(file);
  const popup = window.open("", "_blank", "width=400,height=600");
  popup.document.write(`<h2>Photo Preview</h2>`);
  popup.document.write(`<img src="${imgURL}" style="max-width:100%;"><br>`);
  popup.document.write(`<p>Timestamp: ${timestamp}</p>`);
  if (gps) popup.document.write(`<p>GPS: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}</p>`);
  popup.document.write(`<p>Orientation (degrees):<br>Yaw/Alpha: ${alpha.toFixed(1)}<br>Pitch/Beta: ${beta.toFixed(1)}<br>Roll/Gamma: ${gamma.toFixed(1)}</p>`);

  // Close popup when clicking anywhere
  popup.document.body.addEventListener('click', () => popup.close());
});
