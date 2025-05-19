import { vec3, mat3 } from 'https://esm.sh/gl-matrix';

import { gEpicImageDataMap, gEpicStartTimeSec, gEpicEndTimeSec, getLatLonNorthRotationMatrix} from './epic.js';
import { gScreen} from './screen.js';

export let gTimeSpeed = 3600;
export let gEpicPlaying = true;
export let gEpicZoom = false;
export let gEpicTimeSec = undefined;
export let gEpicImageData0 = undefined; 
export let gEpicImageData1 = undefined; 
export let gEpicImageData = undefined;
export let gPivotEpicImageData = undefined;

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
    let normal = getNormalFromScreenCoord(
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

function setEpicTimeSec(timeSec)
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

gScreen.addEventListener("drag", (e) => {
    const deltaEpicTime = (e.deltaPos.x) / canvas.width * 3600 * 24;
    if (epicPressTime)
    {
        const prevEpicTimeSec = gEpicTimeSec;

        setEpicTimeSec(gEpicTimeSec + deltaEpicTime, e.startPos);

        currentTimeSpeed = (gEpicTimeSec - prevEpicTimeSec) / e.deltaTime;
        //console.log("gEpicTimeSec: " + gEpicTimeSec + ", deltaEpicTime: " + deltaEpicTime + ", currentTimeSpeed: " + currentTimeSpeed);
    }
});

function getNormalFromScreenCoord(screenCoord, earthRadiusPx, screenWidth, screenHeight) 
{
  // Convert screen coordinates to normalized device coordinates (NDC)
  const minSize = Math.min(screenWidth, screenHeight);
  let uv = {
    x: (2.0 * screenCoord.x - screenWidth) / minSize,
    y: (2.0 * screenCoord.y - screenHeight) / minSize
  };

  // Project to sphere in view space
  let earth_uv = {
    x: uv.x / (earthRadiusPx / (minSize / 2.0)),
    y: uv.y / (earthRadiusPx / (minSize / 2.0))
  };

  let xySq = earth_uv.x * earth_uv.x + earth_uv.y * earth_uv.y;
  let z = Math.sqrt(1.0 - xySq);
  // Normal in view space
  let normal = [earth_uv.x, earth_uv.y, z];
  return normal;
}

function getLatLonFromScreenCoord(screenCoord, centroidMatrix, earthRadiusPx, screenWidth, screenHeight) 
{
  let normal = getNormalFromScreenCoord(screenCoord, earthRadiusPx, screenWidth, screenHeight);
  if (normal.z < 0.0) {
    // Normal is pointing away from the sphere
    return null;
  }

  let transCentroidMatrix = mat3.create();
  mat3.transpose(transCentroidMatrix, centroidMatrix);
  // Transform normal to globe coordinates
  let globeNormal = vec3.create();
  vec3.transformMat3(globeNormal, normal, transCentroidMatrix);

  const globeNormalLengthXZ = Math.sqrt(
    globeNormal[0] * globeNormal[0] + 
    globeNormal[2] * globeNormal[2]);
  
  let lat = Math.atan2(globeNormalLengthXZ, globeNormal[1]) / Math.PI * 180.0 - 90.0;
  let lon = 180.0 - Math.atan2(globeNormal[2], globeNormal[0]) / Math.PI * 180.0;
  if (lon >  180.0) lon -= 360.0;
  if (lon < -180.0) lon += 360.0;
  if (lat >  90.0 ) lat -= 180.0;
  if (lat < -90.0 ) lat += 180.0;
  return {
    lat: lat,
    lon: lon
  };
}

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

    const latlon = getLatLonFromScreenCoord(
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

gScreen.addEventListener("long-press", (e) => {
    longPressing = true;
    setZoom(true, e.startPos);
});

gScreen.addEventListener("double-click", (e) => {
    if (!gEpicPlaying)
        setZoom(!gEpicZoom, e.clickPos);
    else if (gEpicZoom)
        setZoom(false, e.clickPos);
});

gScreen.addEventListener("click", (e) => {
    gEpicPlaying = !gEpicPlaying;
    holding = false;
});

gScreen.addEventListener("mousewheel", (e) => {
    if (!gEpicZoom && e.wheelDelta > 0)
        setZoom(true, e.wheelPos);
    if (gEpicZoom && e.wheelDelta < 0)
        setZoom(false, e.wheelPos);
});

gScreen.addEventListener("pinch", (e) => {
    if (!gEpicZoom && e.pinchDelta > 0)
        setZoom(true, e.pinchCenterPos);
    if (gEpicZoom && e.pinchDelta < 0)
        setZoom(false, e.pinchCenterPos);
});

function mix(x, y, a) {
    return x * (1 - a) + y * a;
}

let lastUpdateTime = undefined;

function lerp( a, b, alpha ) {
    return a + alpha * ( b - a );
}

export function gUpdateEpicTime(time)
{
    if (!gEpicStartTimeSec || !gEpicEndTimeSec)
    {
        return;
    }

    if (!gEpicTimeSec)
    {
        gEpicTimeSec = gEpicStartTimeSec;
    }

    const targetSpeed = gEpicPlaying ? gTimeSpeed : 0.0;
    if (!holding)
    {
        if (lastUpdateTime)
        {
            const deltaTime = (time - lastUpdateTime) / 1000.0;
            currentTimeSpeed = lerp(currentTimeSpeed, targetSpeed, 0.1);
            setEpicTimeSec(gEpicTimeSec + deltaTime * currentTimeSpeed);
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
    for (let [timeSec, epicImageData] of gEpicImageDataMap) {
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

    epicImageData.centroid_matrix = getLatLonNorthRotationMatrix(
        epicImageData.centroid_coordinates.lat, 
        epicImageData.centroid_coordinates.lon);

    gEpicImageData = epicImageData;

}

function updateDateText(timeSec)
{
    const date = new Date(timeSec * 1000);
    let dateStr = "";
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
    }
    else
    {
        options.timeZone = "GMT";
        options.timeZoneName = "short";
    }
    dateStr += date.toLocaleString("en-GB", options);
    dateStr = dateStr.replace(/(.*\d{2}:\d{2})\s*(.*)$/, '$1 ($2)');

    document.getElementById("current-time-text").textContent = dateStr;
}
