class TextureLoader {
  constructor(gl, { maxGPUMemoryBytes = 64 * 1024 * 1024 } = {}) {
    this.gl = gl;
    this.maxMemory = maxGPUMemoryBytes;
    this.textureCache = new Map(); // url → { texture, size, lastUsed }
    this.pendingLoads = new Map(); // url → { controller }
    this.totalMemory = 0;
  }

  load(url, { forceReload = false, onSuccess, onError, onAbort } = {}) {
    if (!forceReload && this.textureCache.has(url)) {
      const entry = this.textureCache.get(url);
      entry.lastUsed = performance.now();
      onSuccess?.(entry.texture);
      return;
    }

    if (!forceReload && this.pendingLoads.has(url)) return;

    const controller = new AbortController();
    const signal = controller.signal;
    this.pendingLoads.set(url, { controller });

    fetch(url, { mode: 'cors', cache: 'force-cache', signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => createImageBitmap(blob))
      .then(bitmap => {
        const texture = this._createTextureFromBitmap(bitmap);
        const size = bitmap.width * bitmap.height * 4; // estimate in bytes
        this._insertIntoCache(url, texture, size);
        bitmap.close();
        this.pendingLoads.delete(url);
        onSuccess?.(texture);
      })
      .catch(err => {
        this.pendingLoads.delete(url);
        if (err.name === 'AbortError') {
          onAbort?.(err);
        } else {
          onError?.(err);
        }
      });
  }

  _createTextureFromBitmap(bitmap) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  _insertIntoCache(url, texture, size) {
    this._evictIfNeeded(size);

    this.textureCache.set(url, {
      texture,
      size,
      lastUsed: performance.now()
    });
    this.totalMemory += size;
  }

  _evictIfNeeded(incomingSize) {
    while (this.totalMemory + incomingSize > this.maxMemory && this.textureCache.size > 0) {
      // Find LRU entry
      let oldestUrl = null;
      let oldestTime = Infinity;

      for (const [url, entry] of this.textureCache.entries()) {
        if (entry.lastUsed < oldestTime) {
          oldestUrl = url;
          oldestTime = entry.lastUsed;
        }
      }

      if (oldestUrl) {
        const entry = this.textureCache.get(oldestUrl);
        this.gl.deleteTexture(entry.texture);
        this.totalMemory -= entry.size;
        this.textureCache.delete(oldestUrl);
      } else {
        break;
      }
    }
  }

  markUsed(url) {
    const entry = this.textureCache.get(url);
    if (entry) entry.lastUsed = performance.now();
  }

  abort(url) {
    const entry = this.pendingLoads.get(url);
    if (entry) {
      entry.controller.abort();
      this.pendingLoads.delete(url);
    }
  }

  clearCache() {
    for (const entry of this.textureCache.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.textureCache.clear();
    this.pendingLoads.clear();
    this.totalMemory = 0;
  }
}

const EPIC_IMAGE_URL="https://api.nasa.gov/EPIC/archive/natural/2025/05/17/jpg/epic_1b_20250517092934.jpg?api_key=mkFSJvkb5TdUAEUtdWpAwPDEJxicFOCmuKuht0q4";

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

const loader = new TextureLoader(gl, {
  maxGPUMemoryBytes: 32 * 1024 * 1024 // 32MB
});

loader.load(EPIC_IMAGE_URL, {
  onSuccess: tex => { console.log('Using texture: ' + JSON.stringify(tex)); },
  onError: err => console.error(err),
  onAbort: () => console.log('Aborted'),
});

// Later, you can mark texture as used again (for LRU priority)
loader.markUsed(EPIC_IMAGE_URL);
