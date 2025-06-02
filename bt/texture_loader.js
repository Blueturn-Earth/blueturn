import gEpicAPI from './epic_api.js';

export class TextureLoader {

  constructor(gl, { maxGPUMemoryBytes = 64 * 1024 * 1024 } = {}) {
    this.gl = gl;
    this.maxMemory = maxGPUMemoryBytes;
    this.textureCache = new Map(); // url → { texture, size, lastUsed }
    this.pendingLoads = new Map(); // url → { controller }
    this.totalMemory = 0;
    this._indexedDB = undefined
    this._DB_STORE_NAME = 'images';
  }

  async init() {
    return new Promise((resolve, reject) => {
      this._openImageDB()
      .then(() => {
        console.log("TextureLoader initialized successfully");
        resolve();
      })
      .catch(err => {
        console.error("Failed to initialize TextureLoader", err);
        reject(err);
      });
    });
  }

  _openImageDB() {
    if (this._indexedDB) {
      return Promise.resolve(this._indexedDB);
    }
    return new Promise((resolve, reject) => {
      console.log("Initializing IndexedDB...");
      const request = indexedDB.open("imageCacheDB", 1);
      request.onupgradeneeded = () => {
        console.log("IndexedDB upgrade needed");
        this._indexedDB = request.result;
        this._indexedDB.createObjectStore(this._DB_STORE_NAME);
      };
      request.onsuccess = () => {
        console.log("IndexedDB initialized successfully");
        this._indexedDB = request.result;
        resolve(request.result);
      }
      request.onerror = () => {
        console.error("Failed to initialize IndexedDB");
        reject(request.error);
      }
    });
  }

  async _getCachedImageFromDB(url) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) {
        reject(new Error("IndexedDB not initialized"));
        return;
      }
      const tx = this._indexedDB.transaction(this._DB_STORE_NAME, "readonly");
      const store = tx.objectStore(this._DB_STORE_NAME);
      const getRequest = store.get(url);
      getRequest.onsuccess = async () => {
        if (getRequest.result) {
          resolve(getRequest.result); // Already cached blob
        } else {
          reject("No result from indexedDB request");
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async _storeImageInDB(url, blob) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) {
        reject(new Error("IndexedDB not initialized"));
        return;
      }
      const txw = this._indexedDB.transaction(this._DB_STORE_NAME, "readwrite");
      const storew = txw.objectStore(this._DB_STORE_NAME);
      storew.put(blob, url);
      txw.oncomplete = () => {
        console.log("Image stored in IndexedDB successfully");
        resolve();
      };
      txw.onerror = () => {
        console.error("Failed to store image in IndexedDB", txw.error);
        reject(txw.error);
      }
    });
  }

  loadTexture(url, { forceReload = false, onSuccess, onError, onAbort, onEvict } = {}) {
    // 1st level cache: RAM
    if (!forceReload && this.textureCache.has(url)) {
      const entry = this.textureCache.get(url);
      entry.lastUsed = performance.now();
      onSuccess?.(url, entry.texture);
      return;
    }

    if (!forceReload && this.pendingLoads.has(url)) return;
  
    // 2nd level cache: local storage
    this._getCachedImageFromDB(url)
    .then(cachedBlob => {
      return this._createTextureFromBlob(cachedBlob);
    })
    .then(([texture, width, height]) => {
      const size = width * height * 4; // estimate in bytes
      // Store in 1st-level cache in run-time memory
      this._insertIntoCache(url, texture, size, onEvict);
      onSuccess?.(url, texture);
    })
    .catch((err) => {
      //console.log(err);

      // 3rd level: load from internet
      // (maybe there is a cache in the browser, but are agnostic to it)
      const controller = new AbortController();
      const signal = controller.signal;
      this.pendingLoads.set(url, controller);
      
      console.log("Loading Epic Image URL: " + url);
      const NO_CACHE = true;
      const fullUrl = url + "?" + gEpicAPI.getEpicCallURLSecretQuery(NO_CACHE)
      fetch(fullUrl, { mode: 'cors', cache: 'force-cache', signal })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.blob();
        })
        .then(blob => {
          // Store in 2nd-level cache DB
          this._storeImageInDB(url, blob)
          .catch(err => {
            console.warn("Failed to store image in IndexedDB", err);
          });
          return this._createTextureFromBlob(blob);
        })
        .then(([texture, width, height]) => {
          const size = width * height * 4; // estimate in bytes
          this._insertIntoCache(url, texture, size, onEvict);
          this.pendingLoads.delete(url);
          onSuccess?.(url, texture);
        })
        .catch(err => {
          this.pendingLoads.delete(url);
          if (err.name === 'AbortError') {
            onAbort?.(url, err);
          } else {
            onError?.(url, err);
          }
        });
    });
  }

  _createTextureFromImage(image) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }


  async _createTextureFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const tex = this._createTextureFromImage(image);
          const width = image.naturalWidth;
          const height = image.naturalHeight;
          URL.revokeObjectURL(image.src);
          resolve([tex, width, height]);
        } catch (err) {
          reject(err);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(image.src);
        reject(new Error("Failed to load image from blob"));
      };
      image.src = URL.createObjectURL(blob);
    });
  }

  _insertIntoCache(url, texture, size, onEvict) {
    this._evictIfNeeded(size, onEvict);

    this.textureCache.set(url, {
      texture,
      size,
      lastUsed: performance.now()
    });
    this.totalMemory += size;
  }

  _evictIfNeeded(incomingSize, onEvict) {
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
        onEvict?.(oldestUrl, entry.texture);
      } else {
        break;
      }
    }
  }

  isPending(url) {
    return url && this.pendingLoads.has(url);
  }

  markUsed(url) {
    const entry = this.textureCache.get(url);
    if (entry) entry.lastUsed = performance.now();
  }

  abort(url, reason) {
    const entry = this.pendingLoads.get(url);
    if (entry) {
      entry.controller.abort(reason);
      this.pendingLoads.delete(url);
    }
  }

  abortUrlsExcept(urls, reason) {
    let remainingPendingLoads = new Map();
    urls.forEach((excludedUrl) => {
      this._pendingLoads.forEach((controller, url) => {
        if(url != excludedUrl) {
          controller.abort(reason);
        }
        else {
          remainingPendingLoads.set(url, controller);
        }
      });
    });
    this._pendingLoads = remainingPendingLoads;
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
