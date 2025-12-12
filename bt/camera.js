document.getElementById("cameraButton").addEventListener("click", async () => {
  let coords = null;

  if ("geolocation" in navigator) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      console.log("GPS ready:", coords);
    } catch (err) {
      console.warn("GPS not available:", err.message);
    }
  }

  // Trigger camera input
  document.getElementById("cameraInput").click();
});

document.getElementById("cameraInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Create object URL to display image
  const imgURL = URL.createObjectURL(file);

  // Get current timestamp
  const timestamp = new Date().toISOString();

  // Attempt to get GPS from EXIF (optional, only if stored)
  EXIF.getData(file, function() {
    const tags = EXIF.getAllTags(this);
    let gps = null;
    if (tags.GPSLatitude && tags.GPSLongitude) {
      const lat = tags.GPSLatitude[0] + tags.GPSLatitude[1]/60 + tags.GPSLatitude[2]/3600;
      const lon = tags.GPSLongitude[0] + tags.GPSLongitude[1]/60 + tags.GPSLongitude[2]/3600;
      gps = { lat, lon };
    }

    // Show popup
    const popup = window.open("", "_blank", "width=400,height=600");
    popup.document.write(`<h2>Photo Preview</h2>`);
    popup.document.write(`<img src="${imgURL}" style="max-width:100%;"><br>`);
    popup.document.write(`<p>Timestamp: ${timestamp}</p>`);
    if (gps) popup.document.write(`<p>GPS: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}</p>`);

    // Add click listener to close popup
    popup.document.body.addEventListener('click', () => {
        popup.close();
    });
});
});
