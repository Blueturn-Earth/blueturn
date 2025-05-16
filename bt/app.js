import { gEpicImageDataMap, gEpicStartTimeSec, gEpicEndTimeSec} from './epic.js';
import { gScreen} from './screen.js';

export let gTimeScale = 3600;
export let gEpicPlaying = true;
export let gEpicZoom = false;
export let gEpicZoomPivotScreenCoord = undefined;
export let gEpicTime = undefined;
export let gEpicImageData0 = undefined; 
export let gEpicImageData1 = undefined; 
export let gEpicImageData = undefined;
export let gPivotEpicImageData = undefined;

const canvas = document.getElementById('glcanvas');

let epicPressTime = undefined;
let holding = false;
let longPressing = false;

gScreen.addEventListener("down", (e) => {
    if (gEpicTime)
    {
        epicPressTime = gEpicTime;
        holding = true;
    }
});

gScreen.addEventListener("up", (e) => {
    if (longPressing)
    {
        gEpicZoom = false;
        epicPressTime = undefined;
        gPivotEpicImageData = undefined;
        longPressing = false;
    }
    holding = false;
});

gScreen.addEventListener("drag", (e) => {
    const deltaEpicTime = (e.dragPos.x - e.startPos.x) / canvas.width * 3600 * 12;
    if (epicPressTime)
    {
        let newEpicTimeSec = epicPressTime + deltaEpicTime;
        if (newEpicTimeSec > gEpicEndTimeSec)
        {
            newEpicTimeSec = gEpicEndTimeSec;
        }
        if (newEpicTimeSec < gEpicStartTimeSec)
        {
            newEpicTimeSec = gEpicStartTimeSec;
        }
        gEpicTime = newEpicTimeSec;
    }
});

function zoom(pivotPos)
{
    gEpicZoom = true;
    gEpicZoomPivotScreenCoord = pivotPos;

    if (gEpicImageData)
    {
        // deep copy
        gPivotEpicImageData = JSON.parse(JSON.stringify(gEpicImageData));
    }
    //console.log('gPivotEpicImageData: ' + JSON.stringify(gPivotEpicImageData) + ', gEpicImageData: ' + JSON.stringify(gEpicImageData));
}

gScreen.addEventListener("long-press", (e) => {
    longPressing = true;
    zoom(e.startPos);
});

gScreen.addEventListener("double-click", (e) => {
    if (!gEpicPlaying && !gEpicZoom)
    {
        zoom(e.clickPos);
    }
    else
    {
        gEpicZoom = false;
    }
});

gScreen.addEventListener("click", (e) => {
    gEpicPlaying = !gEpicPlaying;
    holding = false;
});

function mix(x, y, a) {
    return x * (1 - a) + y * a;
}

export function gUpdateEpicTime(time)
{
    if (!gEpicStartTimeSec || !gEpicEndTimeSec)
    {
        return;
    }

    if (!gEpicTime)
    {
        gEpicTime = gEpicStartTimeSec;
    }

    if (gEpicPlaying && !holding)
    {
        gEpicTime += 1.0 / 60 * gTimeScale;
        if (gEpicTime > gEpicEndTimeSec)
        {
            gEpicTime = gEpicStartTimeSec;
        }
    }

    let epicImageDataSec0 = undefined;
    let epicImageDataSec1 = undefined;
    for (let [timeSec, epicImageData] of gEpicImageDataMap) {
        if (timeSec <= gEpicTime && (epicImageDataSec0 == undefined || epicImageDataSec0 < timeSec))
        {
            epicImageDataSec0 = epicImageData.timeSec = timeSec;
            gEpicImageData0  = epicImageData;
        }
        if (timeSec > gEpicTime && (epicImageDataSec1 == undefined || epicImageDataSec1 > timeSec))
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
        epicImageDat0 = gEpicImageData1;
        epicImageDataSec0 = epicImageDataSec1;

        gEpicTime = gEpicStartTimeSec;
        mixFactor = 1.0;
    }
    else if (epicImageDataSec1 == undefined)
    {
        gEpicImageData1 = gEpicImageData0 ;
        epicImageDataSec1 = epicImageDataSec0;

        gEpicTime = gEpicStartTimeSec;
        mixFactor = 0.0;
    }
    // else if (epicImageDataSec1 - epicImageDataSec0 > MAX_EPIC_GAP_SEC)
    // {
    //   mixFactor  = -10;
    // } 
    else
    {
        mixFactor  = (gEpicTime - epicImageDataSec0) / (epicImageDataSec1 - epicImageDataSec0);
    }
    //console.log("0: " + gEpicImageData0 .date + ", 1: " + gEpicImageData1.date);

    if (!gEpicImageData)
        gEpicImageData = {};

    gEpicImageData.time_sec = gEpicTime;
    gEpicImageData.mix01 = mixFactor;

    // Interpolate Radius:
    let earthRadius0 = gEpicImageData0.earthRadius;
    let earthRadius1 = gEpicImageData1.earthRadius;
    gEpicImageData.earthRadius = mix(earthRadius0, earthRadius1, gEpicImageData.mix01);

    // Interpolate lat, lon
    let epicCentroidLat0 = gEpicImageData0.centroid_coordinates.lat;
    let epicCentroidLon0 = gEpicImageData0.centroid_coordinates.lon;
    let epicCentroidLat1 = gEpicImageData1.centroid_coordinates.lat;
    let epicCentroidLon1 = gEpicImageData1.centroid_coordinates.lon;
    if (epicCentroidLon1 > epicCentroidLon0)
        epicCentroidLon0 += 360.0;
    gEpicImageData.centroid_coordinates = {};
    gEpicImageData.centroid_coordinates.lat = mix(epicCentroidLat0, epicCentroidLat1, gEpicImageData.mix01);
    gEpicImageData.centroid_coordinates.lon = mix(epicCentroidLon0, epicCentroidLon1, gEpicImageData.mix01);
}

export function gUpdateDateText(timeSec)
{
  const date = new Date(timeSec * 1000);
  let dateStr = date.toLocaleString("en-GB", {
    timeZoneName: 'short',
    hour12: false,
    minute: '2-digit',
    hour: '2-digit',
    day: '2-digit',      // Include day
    month: '2-digit',    // Include month
    year: 'numeric'      // Include year
  });
  dateStr = dateStr.replace(/(.*\d{2}:\d{2})\s*(.*)$/, '$1 ($2)');

  document.getElementById("current-time-text").textContent = dateStr;
}
