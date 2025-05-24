// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

const { vec3, mat3 } = window.glMatrix;
import { gControlState } from './controlparams.js';

import { gEpicStartTimeSec, gEpicEndTimeSec} from './epic.js';
import { gEpicImageLoader} from './epic_image_loader.js';
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

gScreen.addEventListener("down", (e) => {
    if (gEpicTimeSec)
    {
        epicPressTime = gEpicTimeSec;
        holding = true;
    }
});

gScreen.addEventListener("up", (e) => {
    if (longPressing)
    {
        setZoom(false, e.upPos);
        epicPressTime = undefined;
        longPressing = false;
    }
    holding = false;
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
    const prevEpicTimeSec = gEpicTimeSec;

    gEpicTimeSec = timeSec;

    if(gEpicZoom)
    {
        gUpdateEpicInterpolation();

        // Check that pivot's lat lon is facing the 
        const pivotNormal = getPivotNormal(pivotStartPos, gPivotEpicImageData, gEpicImageData);
        //console.log("pivotStartPos: " + JSON.stringify(pivotStartPos) + ", pivotNormal: " + JSON.stringify(pivotNormal));
        if (pivotNormal[2] < 0.0)
        {
            gEpicTimeSec = timeSec = prevEpicTimeSec;
            gUpdateEpicInterpolation();
        }
        if (timeSec > gEpicEndTimeSec)
            timeSec = gEpicEndTimeSec;
        if (timeSec < gEpicStartTimeSec)
            timeSec = gEpicStartTimeSec;
    }
    else
    {
        if (timeSec > gEpicEndTimeSec)
            timeSec = gEpicStartTimeSec;
        if (timeSec < gEpicStartTimeSec)
            timeSec = gEpicEndTimeSec;
    }

    gEpicTimeSec = timeSec;
    gUpdateEpicInterpolation();

    updateDateText(gEpicTimeSec);
}

function gTagZoomEvent(triggerEvent)
{
    const gtagEventInfo = {
        'zoom': gEpicZoom,
        'trigger-event': triggerEvent,
        'playing': gControlState.playing,
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
    if (!gControlState.playing)
        setZoom(!gEpicZoom, e.clickPos);
    else if (gEpicZoom)
        setZoom(false, e.clickPos);

    gTagZoomEvent("double-click");
});

gScreen.addEventListener("click", (e) => {
    gControlState.playing = !gControlState.playing;
    gtag('event', 'play', {
        'playing': gControlState.playing,
        'trigger-event': 'click',
        'zoom': gEpicZoom
    });
    holding = false;
});

gScreen.addEventListener("drag", (e) => {
    const deltaEpicTime = (e.deltaPos.x) / canvas.width * 3600 * 24;
    if (epicPressTime)
    {
        const prevEpicTimeSec = gEpicTimeSec;

        gSetEpicTimeSec(gEpicTimeSec + deltaEpicTime, e.startPos);

        currentTimeSpeed = (gEpicTimeSec - prevEpicTimeSec) / e.deltaTime;
        //console.log("gEpicTimeSec: " + gEpicTimeSec + ", deltaEpicTime: " + deltaEpicTime + ", currentTimeSpeed: " + currentTimeSpeed);
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
    
    return pivotEpicImageData;
}

function setZoom(on, pivotPos)
{
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
    if (!gEpicStartTimeSec || !gEpicEndTimeSec || !gEpicTimeSec)
    {
        return;
    }

    const targetSpeed = gControlState.playing ? gControlState.timeSpeed : 0.0;
    if (!holding)
    {
        if (lastUpdateTime)
        {
            const deltaTime = (time - lastUpdateTime) / 1000.0;
            currentTimeSpeed = lerp(currentTimeSpeed, targetSpeed, 0.1);
            gSetEpicTimeSec(gEpicTimeSec + deltaTime * currentTimeSpeed);
            //console.log("gEpicTimeSec: " + gEpicTimeSec + ", deltaTime: " + deltaTime + ", currentTimeSpeed: " + currentTimeSpeed);
        }
    }
    lastUpdateTime = time;

    gUpdateEpicInterpolation();
}

export function gUpdateEpicInterpolation()
{
    let epicImageDataSec0 = undefined;
    let epicImageDataSec1 = undefined;
    for (let [timeSec, epicImageData] of gEpicImageLoader.epicImageDataMap) {
        if (timeSec <= gEpicTimeSec && (epicImageDataSec0 == undefined || epicImageDataSec0 < timeSec))
        {
            epicImageDataSec0 = epicImageData.timeSec = timeSec;
            gEpicImageData0  = epicImageData;
        }
        if (timeSec > gEpicTimeSec && (epicImageDataSec1 == undefined || epicImageDataSec1 > timeSec))
        {
            epicImageDataSec1 = epicImageData.timeSec = timeSec;
            gEpicImageData1 = epicImageData;
        }
    }

    if (epicImageDataSec0 == undefined && epicImageDataSec1 == undefined)
    {
        console.log("Failed to find pair of bound images");
        return
    }
    
    let mixFactor;

    if (epicImageDataSec0 == undefined)
    {
        gEpicImageData0 = gEpicImageData1;
        epicImageDataSec0 = epicImageDataSec1;
        mixFactor = 1.0;
    }
    else if (epicImageDataSec1 == undefined)
    {
        gEpicImageData1 = gEpicImageData0 ;
        epicImageDataSec1 = epicImageDataSec0;
        mixFactor = 0.0;
    }
    // else if (epicImageDataSec1 - epicImageDataSec0 > MAX_EPIC_GAP_SEC)
    // {
    //   mixFactor  = -10;
    // } 
    else
    {
        mixFactor  = (gEpicTimeSec - epicImageDataSec0) / (epicImageDataSec1 - epicImageDataSec0);
    }
    //console.log("0: " + gEpicImageData0 .date + ", 1: " + gEpicImageData1.date);

    let epicImageData = {}

    epicImageData.time_sec = gEpicTimeSec;
    epicImageData.mix01 = mixFactor;

    // Interpolate Radius:
    let earthRadius0 = gEpicImageData0.earthRadius;
    let earthRadius1 = gEpicImageData1.earthRadius;
    epicImageData.earthRadius = mix(earthRadius0, earthRadius1, epicImageData.mix01);

    // Interpolate lat, lon
    let epicCentroidLat0 = gEpicImageData0.centroid_coordinates.lat;
    let epicCentroidLon0 = gEpicImageData0.centroid_coordinates.lon;
    let epicCentroidLat1 = gEpicImageData1.centroid_coordinates.lat;
    let epicCentroidLon1 = gEpicImageData1.centroid_coordinates.lon;
    if (epicCentroidLon1 > epicCentroidLon0)
        epicCentroidLon0 += 360.0;
    epicImageData.centroid_coordinates = {};
    epicImageData.centroid_coordinates.lat = mix(epicCentroidLat0, epicCentroidLat1, epicImageData.mix01);
    epicImageData.centroid_coordinates.lon = mix(epicCentroidLon0, epicCentroidLon1, epicImageData.mix01);

    epicImageData.centroid_matrix = gCalcLatLonNorthRotationMatrix(
        epicImageData.centroid_coordinates.lat, 
        epicImageData.centroid_coordinates.lon);

    gEpicImageData = epicImageData;

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
