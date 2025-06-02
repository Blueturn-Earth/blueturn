import gEpicAPI from './epic_api.js';
import { TextureLoader} from './texture_loader.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

export default class EpicImageLoader
{
    #MAX_IMAGES=100;
    #textureLoader = new TextureLoader(gl, {
            maxGPUMemoryBytes: this.#MAX_IMAGES * 2048 * 2048 * 4 // 1.6GB
        });
    epicImageDataMap = new Map(); 

    async init() {
        return new Promise((resolve, reject) => {
            this.#textureLoader.init()
            .then(() => {
                console.log("EpicImageLoader initialized");
                resolve();
            })
            .catch((err) => {
                console.error("EpicImageLoader initialization failed: " + err);
                reject(err);
            });
        });
    }

    async loadImage(epicImageData) {
        if (!epicImageData)
            return Promise.reject("epicImageData arg is not set");
        const timeSec = epicImageData.timeSec;
        const foundEpicImageData = this.epicImageDataMap.get(timeSec);
        if (foundEpicImageData !== epicImageData) {
            this.epicImageDataMap.set(timeSec, epicImageData);
        }

        return new Promise((resolve, reject) => {
            const url = gEpicAPI.getEpicImageURL(epicImageData.date, epicImageData.image);
            if (!epicImageData.texture && !this.#textureLoader.isPending(url))
            {
                //console.log("Loading image URL: " + url);
                epicImageData.imageURL = url;
                this.#textureLoader.loadTexture(url, {
                    forceReload: false,
                    onSuccess: (url, tex) => {
                        epicImageData.texture = tex;
                        console.log("Loaded image: " + epicImageData.image + ", for date " + epicImageData.date);
                        resolve(tex);
                    },
                    onError: (url, err) => {
                        console.error('Error loading texture for image ' + epicImageData.image + ', ' + err); 
                        reject(err);},
                    onAbort: (url, err) => {
                        const error = 'Aborted loading texture for image ' + epicImageData.image + ', ' + err;
                        console.warn(error); 
                        reject(error);},
                    onEvict: (url, tex) => {
                        epicImageData.texture = null;
                        console.warn("Evicted image: " + epicImageData.image + ", for date " + epicImageData.date);}
                });
            }
            else if (epicImageData.texture)
            {
                //console.log("Using cached image URL: " + url);
                resolve(epicImageData.texture);
            }
            else
            {
                // can happen by some race condition
                //console.warn("Epic image already currently loading: " + url);
            }
        });
    }

    markUsed(epicImageData) {
        if (!epicImageData)
        {
            return;
        }
        if (!epicImageData.imageURL)
        {
            console.error("Undefined URL for EPIC image data " + epicImageData.date);
            return;
        }
        this.#textureLoader.markUsed(epicImageData.imageURL);
    }

    abortLoad(epicImageData, reason) {
        if (!epicImageData)
        {
            return;
        }
        if (!epicImageData.imageURL)
        {
            console.error("Undefined URL for EPIC image data " + epicImageData.date);
            return;
        }
        this.#textureLoader.abort(epicImageData.imageURL, reason);
    }

    abortEpicImageLoadsExcept(epicImageDataArray, reason) {
        let urls = [];
        epicImageDataArray.forEach((epicImageData) => {
            if (epicImageData && epicImageData.imageURL)
                urls.push(epicImageData.imageURL);
        });
        this.#textureLoader.abortUrlsExcept(urls, reason);
    }

}
