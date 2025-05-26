import gNasaEpicAPI from './epic_api.js';

class EpicDataLoader
{
    #CACHE_DATE = "";

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

            const url = gNasaEpicAPI.getEpicCallURL(call, nocache);
            //console.log("Loading Epic Data URL: " + url);
            fetch(url)
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

    loadEpicDataForTimeSec(timeSec) 
    {
    }
};

const gEpicDataLoader = new EpicDataLoader();
export default gEpicDataLoader;
