import gNasaEpicAPI from './epic_api.js';
import {gUpdateLoadingText} from './screen.js';

class EpicDataLoader
{
    #CACHE_DATE = "";
    _pendingLoads = new Map();

    async _loadJsonCallURL(call, nocache = false)
    {
        return new Promise((resolve, reject) => {
            if (gNasaEpicAPI.isUsingCache() && !nocache) {
                const cacheDate = localStorage.getItem(this.#CACHE_DATE);
                const cachedData = localStorage.getItem(call);
                if (cacheDate === gNasaEpicAPI.getTodayDateStr() && cachedData) {
                    try {
                        //console.log("Using cached data for call \"" + call + "\"");
                        resolve(JSON.parse(cachedData));
                        return;
                    } catch (e) {
                        console.log("Error in cached data: " + e);
                        // If cached data is corrupted, we will fetch it again
                        localStorage.removeItem(call);
                        localStorage.removeItem(this.#CACHE_DATE);
                        nocache = true; // Force fetching fresh data
                        console.log("Fetching fresh data due to cache error.");
                    }
                }
            }

            let url = gNasaEpicAPI.getEpicCallURL(call);
            const controller = new AbortController();
            const signal = controller.signal;            
            this._pendingLoads.set(call, controller);
            console.log("Loading Epic Data URL: " + url);
            url += "?" + gNasaEpicAPI.getEpicCallURLSecretQuery(nocache)
            fetch(url, { mode: 'cors', cache: 'force-cache', signal })
            .then(response => {
                if (!response.ok) {
                    reject (new Error('Network response was not ok: ' + response.statusText));
                }
                return response.text();
            })
            .then(text => {
                if (gNasaEpicAPI.isUsingCache() && !nocache) {
                    localStorage.setItem(this.#CACHE_DATE, gNasaEpicAPI.getTodayDateStr());
                    localStorage.setItem(call, text);
                }
                this._pendingLoads.delete(call);
                resolve(JSON.parse(text));
            })
            .catch(error => {
                console.error('Error loading JSON from URL:', error);
                reject(error); // rethrow to handle it in the calling code
            });
        });
    }

    async loadEpicAvailableDays() {
        //console.log("Loading all available days from EPIC API...");
        return this._loadJsonCallURL(gNasaEpicAPI.getEpicAvailableDaysCall());
    }

    async loadEpicDay(date = gNasaEpicAPI.getTodayDateStr(), nocache = false) {
        console.log("Loading data for " + date + " from EPIC API...");
        return this._loadJsonCallURL(gNasaEpicAPI.getEpicDayCall(date), nocache);
    }

    abortEpicDayLoadsExcept(days, reason) {
        days.forEach((date) => {
            const excludedCall = gNasaEpicAPI.getEpicDayCall(date);
            if (this._pendingLoads.has(excludedCall)) {
                // If the call is in pending loads, we will abort it
                console.log("Aborting EPIC API call: " + call + " for reason: " + reason);
                localStorage.removeItem(call);
                controller.abort(reason);
                this._pendingLoads.delete(excludedCall);
            }
        });
    }

    clearCache(dayStr) {
        if (dayStr) {
            const call = gNasaEpicAPI.getEpicDayCall(dayStr);
            localStorage.removeItem(call);
            this._pendingLoads.delete(call);
            console.log("Cleared cache for EPIC API call: " + call);
        } else {
            localStorage.removeItem(this.#CACHE_DATE);
            localStorage.clear();
            this._pendingLoads.clear();
            console.log("Cleared all EPIC API cache.");
        }
    }
};

const gEpicDataLoader = new EpicDataLoader();
export default gEpicDataLoader;
