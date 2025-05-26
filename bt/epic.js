// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

import { gControlState } from './controlparams.js';
import { gEpicTimeSec, gSetEpicTimeSec } from './app.js';
import gEpicDataLoader from './epic_data_loader.js';
import gEpicImageLoader from './epic_image_loader.js';

export let gEpicStartTimeSec = undefined;
export let gEpicEndTimeSec = undefined;

function updateLoadingText(loadingText)
{
    if (!gControlState || !gControlState.showText)
        loadingText = "";
    document.getElementById("loading-text").textContent = loadingText;
}   

document.getElementById("loading-text").textContent = "Loading...";

let all_days;
let epicImageDataArray;
const latestDayIndex = 0;

gEpicDataLoader.loadEpicAvailableDays()
.then((all_days1) => {
    all_days = all_days1;
    console.log("Last available day from EPIC: " + all_days[latestDayIndex].date);
    return gLoadEpicImagesForDay(
        gControlState.date ? gControlState.date : all_days[latestDayIndex].date,
        gControlState.date ? false : true // don't use cache for latest date, as it may update
    );
});

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

export async function gLoadEpicImagesForDay(date, nocache = false)
{
    updateLoadingText("Loading data from " + date);
    gEpicDataLoader.loadEpicDay(date, nocache) 
    .then((dayEpicImageDataArray1) => {
        //console.log("Loaded data for day: " + date);
        epicImageDataArray = dayEpicImageDataArray1;
        // load the previous day string after date string
        // Find the previous date string from the current date string
        const dateIndex = all_days.findIndex(day => day.date === date);
        const prevDate = (dateIndex !== -1 && dateIndex + 1 < all_days.length)
            ? all_days[dateIndex + 1].date
            : null;
        if (prevDate) {
            updateLoadingText("Loading data from " + prevDate);
            return gEpicDataLoader.loadEpicDay(prevDate);
        }
        else {
            console.log("No previous date found.");
            return Promise.resolve(null);
        }
    })
    .then((prevDayEpicImageDataArray) => {
        if (prevDayEpicImageDataArray)
        {
            //console.log("Loaded data for day before: " + date);
            epicImageDataArray = prevDayEpicImageDataArray.concat(epicImageDataArray);
        }

        // load the next day string after date string
        // Find the next date string from the current date string
        const dateIndex = all_days.findIndex(day => day.date === date);
        const nextDate = dateIndex >= 1
            ? all_days[dateIndex - 1].date
            : null;
        if (nextDate) {
            updateLoadingText("Loading data from " + nextDate);
            return gEpicDataLoader.loadEpicDay(nextDate);
        }
        else {
            console.log("No next date found.");
            return Promise.resolve(null);
        }
    })
    .then((nextDayEpicImageDataArray) => {
        if (nextDayEpicImageDataArray)
        {
            console.log("Loaded data for day after: " + date);
            epicImageDataArray = epicImageDataArray.concat(nextDayEpicImageDataArray);
        }

        let curr_date = new Date(date);
        const end_date = getEndOfDayMidnight(curr_date);
        gEpicEndTimeSec = end_date.getTime() / 1000;
        let lastAvailableTimeSec;
        for (let i = 0; i < epicImageDataArray.length; i++)
        {
            if (epicImageDataArray[epicImageDataArray.length - 1 - i])
            {
                lastAvailableTimeSec = (new Date(epicImageDataArray[epicImageDataArray.length - 1].date)).getTime() / 1000;
                break;
            }
        }
        if (gEpicEndTimeSec > lastAvailableTimeSec)
            gEpicEndTimeSec = lastAvailableTimeSec;
        // subtract 24 hours from the end time to get the start time
        gEpicStartTimeSec = gEpicEndTimeSec - 24 * 60 * 60;
        const start_date = new Date(gEpicStartTimeSec * 1000);

        if (!gEpicTimeSec || gEpicTimeSec < gEpicStartTimeSec || gEpicTimeSec > gEpicEndTimeSec)
        {
            // set the current hour within the current day
            curr_date = getCurrentTimeAtDay(curr_date);
            gSetEpicTimeSec(curr_date.getTime() / 1000);
        }

        let start_i = 0;
        for(; start_i <= epicImageDataArray.length; start_i++)
        {
            if (epicImageDataArray[start_i] &&
                start_date <= new Date(epicImageDataArray[start_i].date))
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
                updateLoadingText("");
                break;
            }
            const epicImageDataDate = new Date(epicImageData.date);
            if (epicImageDataDate >= end_date)
            {
                updateLoadingText("");
                break;
            }

            // load image
            gEpicImageLoader.loadImage(epicImageData, {
                onLoaded: () => {
                    numLoadedImages++;
                    if (numLoadedImages < totalImagesToLoad)
                    {
                        updateLoadingText(
                            "Loading... "
                            + Math.round(10 + (numLoadedImages * 90) / totalImagesToLoad) 
                            + "%");
                    }
                    else
                    {
                        updateLoadingText("");
                    }
                },
                onEvict: () => {
                    numLoadedImages--;
                }
            });
        }
    })
    .catch((error) => {
        console.error("Error loading EPIC images for day:", error);
        updateLoadingText("Error loading data: " + error.message);
    });
}
