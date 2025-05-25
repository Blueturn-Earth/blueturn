class NasaEpicAPI 
{
    _NASA_API_KEY = "mkFSJvkb5TdUAEUtdWpAwPDEJxicFOCmuKuht0q4";
    //_NASA_API_KEY = "DEMO_KEY";
    _EPIC_JSON_URL = "https://epic.gsfc.nasa.gov/api/natural/";
    _EPIC_IMAGE_URL = "https://api.nasa.gov/EPIC/archive/natural/";
    _IMAGE_FORMAT = 'jpg';
    _NO_CACHE = false;

    _todayDatesStr = new Date().toISOString().slice(0, 10);

    _getAPIKeyQueryString()
    {
        return this._NASA_API_KEY != "" ? "api_key=" + this._NASA_API_KEY : "";
    }

    _getNoiseQueryString()
    {
        return "&noise=" + Math.floor(Date.now() / 1000);
    }

    isUsingCache()
    {
        return !this._NO_CACHE;
    }

    getTodayDateStr()
    {
        return this._todayDatesStr;
    }

    getEpicCallURL(call, nocache = false)
    {
        const noiseQueryStr = (!nocache && !this._NO_CACHE) ? this._getNoiseQueryString() : "";
        return this._EPIC_JSON_URL + call + this._getAPIKeyQueryString() + noiseQueryStr;
    }

    getEpicAvailableDaysCall()
    {
        return 'all';
    }

    // Date format: e.g., "2025-04-26"

    getEpicDayCall(date = _todayDatesStr)
    {
        return 'date/' + date;
    };

    getPrevDateStr(date = _todayDatesStr)
    {
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        return prevDate.toISOString().slice(0, 10);
    }

    getNextDateStr(date)
    {
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() + 1);
        return prevDate.toISOString().slice(0, 10);
    }

    getEpicImageURL(date, imageName)
    {
        const dateStr = date.replaceAll("-", "/").split(" ")[0];
        return this._EPIC_IMAGE_URL + dateStr + "/" + this._IMAGE_FORMAT + "/" + imageName + "." + this._IMAGE_FORMAT +
            "?" + this._getAPIKeyQueryString();
    }
}

const gNasaEpicAPI = new NasaEpicAPI();
export default gNasaEpicAPI;
