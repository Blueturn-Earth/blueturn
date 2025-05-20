// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

import { gCalcLatLonNorthRotationMatrix} from './utils.js';
import { gControlState } from './controlparams.js';
import { gEpicTimeSec, gSetEpicTimeSec } from './app.js';

export let gEpicImageDataMap = new Map(); 
export let gEpicStartTimeSec = undefined;
export let gEpicEndTimeSec = undefined;

const NASA_API_KEY="mkFSJvkb5TdUAEUtdWpAwPDEJxicFOCmuKuht0q4";
//const NASA_API_KEY="DEMO_KEY";
const CACHE_DATE="";
const EPIC_JSON_URL="https://api.nasa.gov/EPIC/api/natural/";
const EPIC_IMAGE_URL="https://api.nasa.gov/EPIC/archive/natural/"
const today = new Date().toISOString().slice(0, 10); // e.g., "2025-04-13"
const NO_CACHE=false;

function GetAPIKey()
{
    return NASA_API_KEY != "" ? "?api_key=" + NASA_API_KEY : "";
}

function GetNoiseKey()
{
    return NO_CACHE ? "&noise=" + Math.floor(Date.now() / 1000) : "";
}

async function nasa_api_json(call) 
{
    console.log("Loading JSON: \'" + call + "\'");

    if (!NO_CACHE) {
        const cacheDate = localStorage.getItem(CACHE_DATE);
        const cachedData = localStorage.getItem(call);
        if (cacheDate === today && cachedData) {
            try {
                return JSON.parse(cachedData);
            } catch (e) {
                console.error('Invalid JSON in cache: ', e);
            }
        }
    }

    try {
        const url = EPIC_JSON_URL + call + GetAPIKey();
        //console.log("Loading image URL: " + url);
        const response = await fetch(url);
        const text = await response.text();

        localStorage.setItem(CACHE_DATE, today);
        localStorage.setItem(call, text);

        return JSON.parse(text);
    } catch (error) {
        console.error('Error loading JSON:', error);
        return null;
    }
}

async function nasa_api_image(imageData) 
{
    let dateStr = imageData.date;
    dateStr = dateStr
        .replaceAll("-", "/")
        .split(" ")
        [0];

    const imageName = imageData.image;
    
    try {
        const formatStr = "jpg";
        const url = EPIC_IMAGE_URL + dateStr + "/" + formatStr + "/" + imageName + "." + formatStr + GetAPIKey() + GetNoiseKey();
        //console.log("Loading image URL: " + url);
        const response = await fetch(url);
        const imageBlob = await response.blob();
        imageData.imageBlob = imageBlob;
    } catch (error) {
        console.error('Error loading image:', error);
    }
}

function earthRadius(distance)
{
    return ((1024-158) / 1024) * (1386540) / distance;
}

function addEpicMetadata(epicImageData)
{
    const dx = epicImageData.dscovr_j2000_position.x;
    const dy = epicImageData.dscovr_j2000_position.y;
    const dz = epicImageData.dscovr_j2000_position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    epicImageData.earthRadius = earthRadius(distance);
    epicImageData.centroid_matrix = gCalcLatLonNorthRotationMatrix(
        epicImageData.centroid_coordinates.lat, 
        epicImageData.centroid_coordinates.lon);
}

document.getElementById("loading-text").textContent = 
    "Loading...";

let all_days;
let epicImageDataArray;
const latestDayIndex = 0;

nasa_api_json("all")
.then((all_days1) => {
    all_days = all_days1;
    return gLoadEpicImagesForDate(gControlState.date ? gControlState.date : all_days[latestDayIndex].date);
});

export async function gLoadEpicImagesForDate(date)
{
    return nasa_load_epic_day(date);
}

function getEndOfDayMidnight(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setUTCHours(0, 0, 0, 0); // reset to start of current day
  nextDay.setDate(nextDay.getDate() + 1); // move to start of next day
  return nextDay;
}

function getStartOfDayMidnight(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return startOfDay;
}

function getCurrentTimeAtDay(date = new Date()) {
    // set the current hour within the current day
    const currTime = new Date();
    const currHour = currTime.getUTCHours();
    const currMinute = currTime.getUTCMinutes();
    const currSecond = currTime.getUTCSeconds();
    date.setUTCHours(currHour, currMinute, currSecond, 0);
    return date;
}

function nasa_load_epic_day(date)
{
    document.getElementById("loading-text").textContent = 
        "Loading data from " + date;
    nasa_api_json('date/' + date)
    .then((dayEpicImageDataArray1) => {
        epicImageDataArray = dayEpicImageDataArray1;
        // load the previous day string after date string
        // Find the previous date string from the current date string
        const dateIndex = all_days.findIndex(day => day.date === date);
        const prevDate = (dateIndex !== -1 && dateIndex + 1 < all_days.length)
            ? all_days[dateIndex + 1].date
            : null;
        if (prevDate) {
            document.getElementById("loading-text").textContent = 
                "Loading data from " + prevDate;
            return nasa_api_json('date/' + prevDate);
        }
        else {
            console.log("No previous date found.");
            return Promise.resolve(null);
        }
    })
    .then((prevDayEpicImageDataArray) => {
        epicImageDataArray = prevDayEpicImageDataArray ?
            prevDayEpicImageDataArray.concat(epicImageDataArray) :
            epicImageDataArray
        // load the next day string after date string
        // Find the next date string from the current date string
        const dateIndex = all_days.findIndex(day => day.date === date);
        const nextDate = dateIndex >= 1
            ? all_days[dateIndex - 1].date
            : null;
        if (nextDate) {
            document.getElementById("loading-text").textContent = 
                "Loading data from " + nextDate;
            return nasa_api_json('date/' + nextDate);
        }
        else {
            console.log("No previous date found.");
            return Promise.resolve(null);
        }
    })
    .then((nextDayEpicImageDataArray) => {
        epicImageDataArray = nextDayEpicImageDataArray ?
            epicImageDataArray.concat(nextDayEpicImageDataArray) :
            epicImageDataArray

        let curr_date = new Date(date);
        const start_date = getStartOfDayMidnight(curr_date);
        const end_date = getEndOfDayMidnight(curr_date);
        gEpicStartTimeSec = start_date.getTime() / 1000;
        gEpicEndTimeSec = end_date.getTime() / 1000;

        if (!gEpicTimeSec || gEpicTimeSec < gEpicStartTimeSec || gEpicTimeSec > gEpicEndTimeSec)
        {
            // set the current hour within the current day
            curr_date = getCurrentTimeAtDay(curr_date);
            gSetEpicTimeSec(curr_date.getTime() / 1000);
        }

        let start_i = 0;
        for(; start_i <= epicImageDataArray.length; start_i++)
        {
            if (start_date <= new Date(epicImageDataArray[start_i].date))
                break;
            // 
        }
        start_i--;
        let end_i = 0;
        for(; end_i < epicImageDataArray.length; end_i++)
        {
            if (end_date <= new Date(epicImageDataArray[end_i].date))
                break;
            // 
        }

        let numLoadedImages = 0;
        let totalImagesToLoad = end_i - start_i;
        for(let i = start_i; i <= end_i; i++)
        {
            let epicImageData = epicImageDataArray[i];
            if (!epicImageData)
            {
                document.getElementById("loading-text").textContent = "";
                break;
            }
            gEpicImageDataMap.set(
                (new Date(epicImageData.date)).getTime() / 1000,
                epicImageData);
            addEpicMetadata(epicImageData);
            // load image
            nasa_api_image(epicImageData)
            .then(() => {
                console.log("Loaded image: " + epicImageData.image + ", for date " + epicImageData.date);
                numLoadedImages++;
                if (numLoadedImages < totalImagesToLoad)
                {
                    document.getElementById("loading-text").textContent = 
                        "Loading... "
                        + Math.round(10 + (numLoadedImages * 90) / totalImagesToLoad) 
                        + "%";
                }
                else
                {
                    document.getElementById("loading-text").textContent = "";
                }
            });
            const epicImageDataDate = new Date(epicImageData.date);
            if (epicImageDataDate >= end_date)
            {
                document.getElementById("loading-text").textContent = "";
                break;
            }
        }
    });
}
