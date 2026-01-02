function safeStore(dataUrl) {
  try {
    localStorage.setItem('capturedImage', dataUrl);
    return true;
  } catch {
    return false;
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function renderToJpeg(img, quality, maxDim) {
  let { width, height } = img;

  if (maxDim && (width > maxDim || height > maxDim)) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

export async function safeSetCapturedImageInLocalStorage(originalDataUrl) {
  console.log("Attempting to store captured image in localStorage");
  alert("Persisting captured image to localStorage...");
  // Attempt 1: store as-is
  if (safeStore(originalDataUrl)) {
    console.log("Captured image stored in localStorage without modifications");
    alert("Captured image persisted to localStorage.");
    return { ok: true, dataUrl: originalDataUrl, strategy: 'original' };
  }

  console.warn("Failed to store captured image in localStorage without modifications");
  alert("Failed to persist captured image to localStorage... Retrying with compressed versions");
  // Load image once for further attempts
  const img = await loadImage(originalDataUrl);

  // Attempt 2: JPEG 0.7, no resize
  console.log("Retrying to store captured image in localStorage with JPEG compression (quality 0.7)");
  alert("Retrying with JPEG compression (quality 0.7)...");
  const jpeg07 = renderToJpeg(img, 0.7);
  if (safeStore(jpeg07)) {
    console.log("Captured image stored in localStorage with JPEG compression (quality 0.7)");
    alert("Captured image persisted to localStorage with JPEG compression.");
    return { ok: true, dataUrl: jpeg07, strategy: 'jpeg-0.7' };
  }

  // Attempt 3: JPEG 0.7 + downscale to max 1280
  console.log("Retrying to store captured image in localStorage with JPEG compression (quality 0.7) and downscaling to max 1280px");
  alert("Retrying with JPEG compression (quality 0.7) and downscaling to max 1280px...");
  const jpeg07Small = renderToJpeg(img, 0.7, 1280);
  if (safeStore(jpeg07Small)) {
    console.log("Captured image stored in localStorage with JPEG compression (quality 0.7) and downscaling to max 1280px");
    alert("Captured image persisted to localStorage with JPEG compression and downscaling.");
    return { ok: true, dataUrl: jpeg07Small, strategy: 'jpeg-0.7-1280' };
  }

  console.error("All attempts to store captured image in localStorage failed");
  alert("All attempts to persist captured image to localStorage failed.");
  // All attempts failed
  return { ok: false };
}
