// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

const { mat3 } = window.glMatrix;
import { gControlState } from './controlparams.js';

import EpicDB from './epic_db.js';
import { gScreen} from './screen.js';
import { gCalcLatLonNorthRotationMatrix, gCalcNormalFromScreenCoord, gCalcLatLonFromScreenCoord} from './utils.js';

export let gEpicZoom = false;
export let gEpicTimeSec = undefined;
export let gEpicImageData0 = undefined; 
export let gEpicImageData1 = undefined; 
export let gEpicImageData = undefined;
export let gPivotEpicImageData = undefined;

document.getElementById('btLogo').addEventListener('click', function() {
  gtag('event', 'button_click', {
    'button_id': 'btLogo'
  });
});

const canvas = document.getElementById('glcanvas');

let epicPressTime = undefined;
let holding = false;
let longPressing = false;
let currentTimeSpeed = 0.0;
let pivotStartPos = undefined;


export const gEpicDB = new EpicDB();

export async function gInitEpicTime()
{
    return new Promise((resolve, reject) => {
        // set first time
        gEpicDB.init()
        .then(() => {
            // Now that we know the limit, set start time
            if (!gControlState.date)
            {
                gControlState.date = gEpicDB.getLastDay();
            }
            if (!gControlState.time)
            {
                // set the current hour within the current day
                const now = new Date();
                gControlState.time = now.toUTCString().split(' ')[4];
            }

            let date_time = gControlState.date + " " + gControlState.time;
            let startTimeSec = EpicDB.getTimeSecFromDateTimeString(date_time);

            if (startTimeSec < gEpicDB.getOldestEpicImageTimeSec())
            {
                const bad_date_time = date_time;
                startTimeSec = gEpicDB.getOldestEpicImageTimeSec();
                const oldestDate = new Date(startTimeSec * 1000);
                gControlState.date = oldestDate.toISOString().split('T')[0];
                gControlState.time = oldestDate.toUTCString().split(' ')[4];
                date_time = gControlState.date + " " + gControlState.time;
                console.warn("Start time " + bad_date_time + " is older than oldest available EPIC image - adjust to oldest time " + date_time);
            }
            while (startTimeSec > gEpicDB.getLatestEpicImageTimeSec() || !gEpicDB.isDayAvailable(gControlState.date))
            {
                const bad_date_time = date_time;
                startTimeSec -= 3600 * 24; // go back one day
                const adjustedDate = new Date(startTimeSec * 1000);
                gControlState.date = adjustedDate.toISOString().split('T')[0];
                gControlState.time = adjustedDate.toUTCString().split(' ')[4];
                date_time = gControlState.date + " " + gControlState.time;
                console.warn("Start time " + bad_date_time + " is not in available EPIC range - adjust to 24 hours backwards: " + date_time);
            }
            // align to exact time of closest EPIC image
            if (gEpicDB.hasEpicDataForTimeSec(startTimeSec))
            {
                console.log("Start time: " + date_time);
                gSetEpicTimeSec(startTimeSec);
                resolve(startTimeSec);
                return;
            }

            gEpicDB.fetchBoundKeyFrames(startTimeSec)
            .then(([epicImageData0, epicImageData1]) => {
                console.assert(epicImageData0 || epicImageData1);
                if (!epicImageData0 && !epicImageData1)
                {
                    // Should really not happen
                    console.error("Failed to fetch bound key EPIC frames - returned null")
                    console.log("Start time: " + date_time);
                    gSetEpicTimeSec(startTimeSec);
                    resolve(startTimeSec);
                    return;
                }
                console.log("Adjusting start time " + date_time + " to closest available EPIC image");
                if (epicImageData0 === epicImageData1) {
                    console.assert(epicImageData0.date == date_time);
                    console.assert(epicImageData1.date == date_time);
                }
                else if (!epicImageData1) {
                    startTimeSec = epicImageData0.timeSec;
                    date_time = epicImageData0.date;
                    gControlState.date = date_time.split(' ')[0];
                    gControlState.time = date_time.split(' ')[1];
                }
                else if (!epicImageData0) {
                    startTimeSec = epicImageData1.timeSec;
                    date_time = epicImageData1.date;
                    gControlState.date = date_time.split(' ')[0];
                    gControlState.time = date_time.split(' ')[1];
                }
                else {
                    const keyTimeSec0 = epicImageData0 ? epicImageData0.timeSec : undefined;
                    const keyTimeSec1 = epicImageData1 ? epicImageData1.timeSec : undefined;
                    if (Math.abs(keyTimeSec0 - startTimeSec) > Math.abs(keyTimeSec1 - startTimeSec))
                        date_time = epicImageData1.date;
                    else
                        date_time = epicImageData0.date;
                    gControlState.date = date_time.split(' ')[0];
                    gControlState.time = date_time.split(' ')[1];
                }
                console.log("Start time: " + date_time);
                gSetEpicTimeSec(startTimeSec);
                resolve(startTimeSec);
                return;
            })
            .catch((error) => {
                console.error("Failed to fetch bound key frames around start time: " + error);
                console.log("Start time: " + date_time);
                gSetEpicTimeSec(startTimeSec);
                resolve(startTimeSec);
                return;
            });
        })
        .catch((error) => {
            reject("Failed to init EpicDB: " + error);
        });
    });
}

gScreen.addEventListener("down", (e) => {
    if (gEpicTimeSec)
    {
        epicPressTime = gEpicTimeSec;
        holding = true;
    }
});

function unhold(pos)
{
    dragging = false;
    if (longPressing)
    {
        setZoom(false, pos);
        epicPressTime = undefined;
        longPressing = false;
    }
    holding = false;
}

gScreen.addEventListener("up", (e) => {
    unhold(e.upPos);
});

gScreen.addEventListener("out", (e) => {
    unhold(e.lastPos);
});

function getPivotNormal(pivotCoord, pivotEpicImageData, currentEpicImageData)
{
    let normal = gCalcNormalFromScreenCoord(
        pivotCoord,
        pivotEpicImageData.earthRadius / 2.0 * Math.min(canvas.width, canvas.height),
        canvas.width, canvas.height
    );
    let pivot2currentMatrix = mat3.create();
    mat3.transpose(pivot2currentMatrix, pivotEpicImageData.centroid_matrix);
    mat3.multiply(pivot2currentMatrix, pivot2currentMatrix, currentEpicImageData.centroid_matrix);
    mat3.multiply(normal, pivot2currentMatrix, normal);
    return normal;
}

export function gSetEpicTimeSec(timeSec)
{
    //console.log("gEpicTimeSec: " + timeSec);
    let prevEpicTimeSec = gEpicTimeSec;

    // Check if the time is within the range of available EPIC images
    const latestEpicTimeSec = gEpicDB.getLatestEpicImageTimeSec();
    const oldestEpicTimeSec = gEpicDB.getOldestEpicImageTimeSec();
    if (timeSec > latestEpicTimeSec)
    {
        // Looping around default loop time range
        prevEpicTimeSec = latestEpicTimeSec;
        timeSec = latestEpicTimeSec - gControlState.loopRangeSec;
        console.log("Past latest available EPIC image time " + latestEpicTimeSec + ", looping back to loop range: " + timeSec);
    }
    if (timeSec < oldestEpicTimeSec)
        // Block at oldest time
        timeSec = oldestEpicTimeSec;

    gEpicTimeSec = timeSec;

    if (prevEpicTimeSec)
    {
        if (!gUpdateEpicInterpolation())
        {
            // block the time change if we cannot interpolate EPIC images
            timeSec = prevEpicTimeSec;
        }
        else if(gEpicZoom)
        {
            // block the time change if we are zoomed in and the pivot is not facing the current image
            // Check that pivot's lat lon is facing the 
            const pivotNormal = getPivotNormal(pivotStartPos, gPivotEpicImageData, gEpicImageData);
            //console.log("pivotStartPos: " + JSON.stringify(pivotStartPos) + ", pivotNormal: " + JSON.stringify(pivotNormal));
            if (pivotNormal[2] < 0.0)
                timeSec = prevEpicTimeSec;
        }
    }

    if (timeSec != gEpicTimeSec || !prevEpicTimeSec)
    {
        gEpicTimeSec = timeSec;
        // Try to interpolate on fixed time
        gUpdateEpicInterpolation();
    }

    updateDateText(gEpicTimeSec);
}

function gTagZoomEvent(triggerEvent)
{
    const gtagEventInfo = {
        'zoom': gEpicZoom,
        'trigger-event': triggerEvent,
        'play': gControlState.play,
        'time': gEpicTimeSec,
        'lat': gPivotEpicImageData ? gPivotEpicImageData.pivot_coordinates.lat : undefined,
        'lon': gPivotEpicImageData ? gPivotEpicImageData.pivot_coordinates.lon : undefined
    };
    console.log("Zoom event: " + JSON.stringify(gtagEventInfo));
    gtag('event', 'zoom', gtagEventInfo);
}

gScreen.addEventListener("long-press", (e) => {
    longPressing = true;
    setZoom(true, e.startPos);

    gTagZoomEvent('long-press');
});

gScreen.addEventListener("double-click", (e) => {
    if (!gControlState.play)
        setZoom(!gEpicZoom, e.clickPos);
    else if (gEpicZoom)
        setZoom(false, e.clickPos);

    gTagZoomEvent("double-click");
});

gScreen.addEventListener("click", (e) => {
    gControlState.play = !gControlState.play;
    gtag('event', 'play', {
        'play': gControlState.play,
        'trigger-event': 'click',
        'zoom': gEpicZoom
    });
    holding = false;
});

let dragging = false;
let dragTimeout = undefined;
gScreen.addEventListener("drag", (e) => {
    if (epicPressTime && gEpicTimeSec)
    {
        const deltaEpicTime = (e.deltaPos.x) / canvas.width * 3600 * 24;
        gSetEpicTimeSec(gEpicTimeSec + deltaEpicTime, e.startPos);

        currentTimeSpeed = deltaEpicTime / e.deltaTime;
        dragging = true;
        //console.log("gEpicTimeSec: " + gEpicTimeSec + ", deltaEpicTime: " + deltaEpicTime + ", currentTimeSpeed: " + currentTimeSpeed);
        // 
        // timeout event to catch absence of drag movement and reset speed accordingly
        if (dragTimeout) clearTimeout(dragTimeout);
        dragTimeout = setTimeout(() => {if (dragging) currentTimeSpeed = 0.0;}, 100);
    }
});

gScreen.addEventListener("mousewheel", (e) => {
    const wasZoom = gEpicZoom;
    if (!gEpicZoom && e.wheelDelta > 0)
        setZoom(true, e.wheelPos);
    if (gEpicZoom && e.wheelDelta < 0)
        setZoom(false, e.wheelPos);
    if (wasZoom != gEpicZoom)
        gTagZoomEvent('mousewheel');
});

gScreen.addEventListener("pinch", (e) => {
    const wasZoom = gEpicZoom;
    if (!gEpicZoom && e.pinchDelta > 0)
        setZoom(true, e.pinchCenterPos);
    if (gEpicZoom && e.pinchDelta < 0)
        setZoom(false, e.pinchCenterPos);
    if (wasZoom != gEpicZoom)
        gTagZoomEvent('pinch');
});

function createPivotEpicImageData(epicImageData, pivotPos, alsoGetTimezone = true)
{
    // deep copy
    let pivotEpicImageData = JSON.parse(JSON.stringify(epicImageData));

    // fix object type
    pivotEpicImageData.centroid_matrix = mat3.fromValues(
        pivotEpicImageData.centroid_matrix[0], 
        pivotEpicImageData.centroid_matrix[1], 
        pivotEpicImageData.centroid_matrix[2],
        pivotEpicImageData.centroid_matrix[3], 
        pivotEpicImageData.centroid_matrix[4], 
        pivotEpicImageData.centroid_matrix[5],
        pivotEpicImageData.centroid_matrix[6], 
        pivotEpicImageData.centroid_matrix[7], 
        pivotEpicImageData.centroid_matrix[8]
    );

    pivotEpicImageData.pivot_coordinates = {
        x: pivotPos.x,
        y: pivotPos.y
    };

    const latlon = gCalcLatLonFromScreenCoord(
        pivotEpicImageData.pivot_coordinates,
        pivotEpicImageData.centroid_matrix,
        pivotEpicImageData.earthRadius / 2.0 * Math.min(canvas.width, canvas.height),
        canvas.width, canvas.height
    );

    if (!latlon)
    {
        // we don't want it then
        return;
    }
    pivotEpicImageData.pivot_coordinates.lat = latlon.lat;
    pivotEpicImageData.pivot_coordinates.lon = latlon.lon;

    if (!alsoGetTimezone)
    {
        return pivotEpicImageData;
    }

    if (gEpicTimeSec)
    {
        const {lat, lon} = pivotEpicImageData.pivot_coordinates;
        const timestamp = Math.floor(Date.now() / 1000);
        const apiKey = "AIzaSyA5G5wpnUkc_3cKFUVGfJVjtCATeTCEFF8";
        console.log("Fetching timezone for lat:", lat, "lon:", lon);
        fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lon}&timestamp=${timestamp}&key=${apiKey}`)
        .then(res => res.json())
        .then(data => {
            console.log("timezone:", data);
            pivotEpicImageData.pivot_timezone = data;
            // You can use data.timeZoneId, data.timeZoneName, data.rawOffset, data.dstOffset, etc.
            // Example: console.log(data.timeZoneId);
            updateDateText(gEpicTimeSec);
        })
        .catch(err => {
            console.error("Timezone API error:", err);
        });
    }

    return pivotEpicImageData;
}

function setZoom(on, pivotPos)
{
    if (!gEpicTimeSec)
        return;
    if (on)
    {
        if (gEpicImageData)
        {
            gPivotEpicImageData = createPivotEpicImageData(
                gEpicImageData, pivotPos);
            if (!gPivotEpicImageData)
            {
                return false;
            }
            pivotStartPos = pivotPos;
            gEpicZoom = true;
            //console.log('pivotStartPos: ' + JSON.stringify(pivotStartPos));
        }
    }
    else
    {
        gEpicZoom = false;
    }

    updateDateText(gEpicTimeSec);
}

function mix(x, y, a) {
    return x * (1 - a) + y * a;
}

let lastUpdateTime = undefined;

function lerp( a, b, alpha ) {
    return a + alpha * ( b - a );
}

export function gUpdateEpicTime(time)
{
    if (!gEpicTimeSec)
    {
        return;
    }

    if (!holding)
    {
        const targetSpeed = gControlState.play ? gControlState.timeSpeed : 0.0;
        if (lastUpdateTime)
        {
            const deltaTime = (time - lastUpdateTime) / 1000.0;
            currentTimeSpeed = lerp(currentTimeSpeed, targetSpeed, 0.05);
            gSetEpicTimeSec(gEpicTimeSec + deltaTime * currentTimeSpeed);
        }
    }

    lastUpdateTime = time;
}

export function gUpdateEpicInterpolation()
{
    if (!gEpicTimeSec)
    {
        return false;
    }

    const boundPair = gEpicDB.fetchBoundFrames(gEpicTimeSec, currentTimeSpeed);

    if (!boundPair)
    {
        gEpicImageData = gEpicImageData0 = gEpicImageData1 = undefined;
        return false;
    }

    const [epicImageData0, epicImageData1] = boundPair;

    console.assert(epicImageData0 && epicImageData1);
    if (!epicImageData0)
    {
        console.error("Failed to fetch prev key EPIC frames - returned null");
        gEpicImageData = gEpicImageData0 = gEpicImageData1 = undefined;
        return false;
    }
    if (!epicImageData1)
    {
        console.error("Failed to fetch next key EPIC frames - returned null");
        gEpicImageData = gEpicImageData0 = gEpicImageData1 = undefined;
        return false;
    }

    console.assert(epicImageData0.timeSec <= gEpicTimeSec && gEpicTimeSec <= epicImageData1.timeSec, 
        "Invalid bounds: " +
        "gEpicTimeSec: " + gEpicTimeSec + 
        ", epicImageData0.timeSec: " + epicImageData0.timeSec + 
        ", epicImageData1.timeSec: " + epicImageData1.timeSec);
    const mixFactor  = (epicImageData0.timeSec != epicImageData1.timeSec) ?
        (gEpicTimeSec - epicImageData0.timeSec) / (epicImageData1.timeSec - epicImageData0.timeSec) :
        0.0

    let epicImageData = {}

    epicImageData.time_sec = gEpicTimeSec;
    epicImageData.mix01 = mixFactor;

    // Interpolate Radius:
    let earthRadius0 = epicImageData0.earthRadius;
    let earthRadius1 = epicImageData1.earthRadius;
    epicImageData.earthRadius = mix(earthRadius0, earthRadius1, epicImageData.mix01);

    // Interpolate lat, lon
    let epicCentroidLat0 = epicImageData0.centroid_coordinates.lat;
    let epicCentroidLon0 = epicImageData0.centroid_coordinates.lon;
    let epicCentroidLat1 = epicImageData1.centroid_coordinates.lat;
    let epicCentroidLon1 = epicImageData1.centroid_coordinates.lon;
    if (epicCentroidLon1 > epicCentroidLon0)
        epicCentroidLon0 += 360.0;
    epicImageData.centroid_coordinates = {};
    epicImageData.centroid_coordinates.lat = mix(epicCentroidLat0, epicCentroidLat1, epicImageData.mix01);
    epicImageData.centroid_coordinates.lon = mix(epicCentroidLon0, epicCentroidLon1, epicImageData.mix01);

    epicImageData.centroid_matrix = gCalcLatLonNorthRotationMatrix(
        epicImageData.centroid_coordinates.lat, 
        epicImageData.centroid_coordinates.lon);

    [gEpicImageData, gEpicImageData0, gEpicImageData1] = 
    [epicImageData, epicImageData0, epicImageData1];

    return true;
}

let lastTimeZoneEvent = undefined;
let wasTimezoneFound = undefined;

function updateDateText(timeSec)
{
    if (!gControlState.showText)
        return;
    const date = new Date(timeSec * 1000);
    let dateStr = "";
    let timezoneFound = undefined;
    if (gEpicZoom &&
        gPivotEpicImageData && 
        gPivotEpicImageData.pivot_coordinates)
    {
        if (gPivotEpicImageData.pivot_timezone &&
            gPivotEpicImageData.pivot_timezone.status != "ZERO_RESULTS")
        {
            dateStr += " (" + gPivotEpicImageData.pivot_timezone.timeZoneId + ")\n";
        }
        else
        {
            dateStr += "[" + 
                gPivotEpicImageData.pivot_coordinates.lat.toFixed(2) + ", " + 
                gPivotEpicImageData.pivot_coordinates.lon.toFixed(2) + "] \n";
        }
    }

    let options = {
        timeZoneName: 'long',
        hour12: false,
        minute: '2-digit',
        hour: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    if (gEpicZoom &&
        gPivotEpicImageData && 
        gPivotEpicImageData.pivot_timezone && 
        gPivotEpicImageData.pivot_timezone.timeZoneId) {
        options.timeZone = gPivotEpicImageData.pivot_timezone.timeZoneId;
        options.timeZoneName = "long";
        timezoneFound = true;
    }
    else
    {
        options.timeZone = "GMT";
        options.timeZoneName = "short";
        timezoneFound = false;
    }
    dateStr += date.toLocaleString("en-GB", options);
    dateStr = dateStr.replace(/(.*\d{2}:\d{2})\s*(.*)$/, '$1 ($2)');

    document.getElementById("current-time-text").textContent = dateStr;

    const timeZoneEventTimeMs = (new Date()).getTime();
    let timezoneEvent = undefined;
    if (timezoneFound && !wasTimezoneFound)
    {
        timezoneEvent = {
            timeZoneId: gPivotEpicImageData && gPivotEpicImageData.pivot_timezone ? gPivotEpicImageData.pivot_timezone.timeZoneId : undefined,
            timeZoneName: gPivotEpicImageData && gPivotEpicImageData.pivot_timezone ? gPivotEpicImageData.pivot_timezone.timeZoneName : undefined,
            timeZoneEventTimeMs: timeZoneEventTimeMs
        };
    };
    if (!timezoneFound && lastTimeZoneEvent)
    {
        const timeZoneDuration = timeZoneEventTimeMs - lastTimeZoneEvent.timeZoneEventTimeMs;
        console.log("Shown Timezone for " + timeZoneDuration + "ms: " + JSON.stringify(lastTimeZoneEvent));
        gtag('event', 'shown-local-time', {
            'timezoneId': lastTimeZoneEvent.timeZoneId,
            'timezoneName': lastTimeZoneEvent.timeZoneName,
            'showDuration': timeZoneDuration
        });
    }
    lastTimeZoneEvent = timezoneEvent;
    wasTimezoneFound = timezoneFound;
}
