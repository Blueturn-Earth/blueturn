import { vec3, mat3 } from 'https://esm.sh/gl-matrix';

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

export function getLatLonNorthRotationMatrix(latitudeDeg, longitudeDeg) {
    const lat = latitudeDeg * Math.PI / 180.0;
    const lon = longitudeDeg * Math.PI / 180.0;

    // z axis
    const z = [
        -Math.cos(lat) * Math.cos(lon),
        -Math.sin(lat),
        Math.cos(lat) * Math.sin(lon)
    ];

    const tmpY = [0.0, 1.0, 0.0];

    // x axis
    const x = [];
    vec3.cross(x, tmpY, z);
    vec3.normalize(x, x);

    // y axis
    const y = [];
    vec3.cross(y, z, x);
    vec3.normalize(y, y);

    // mat3 in column-major order: [x, y, z]
    const m = mat3.fromValues(
        x[0], y[0], z[0],
        x[1], y[1], z[1],
        x[2], y[2], z[2]
    );

    return m;
}

function addEpicMetadata(epicImageData)
{
    const dx = epicImageData.dscovr_j2000_position.x;
    const dy = epicImageData.dscovr_j2000_position.y;
    const dz = epicImageData.dscovr_j2000_position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    epicImageData.earthRadius = earthRadius(distance);
    epicImageData.centroid_matrix = getLatLonNorthRotationMatrix(
        epicImageData.centroid_coordinates.lat, 
        epicImageData.centroid_coordinates.lon);
}

document.getElementById("loading-text").textContent = 
    "Loading...";

let all_days;
let latestDayEpicImageDataArray;
let prevDayEpicImageDataArray;
const latestDayIndex = 0;

nasa_api_json("all")
.then((all_days1) => {
    all_days = all_days1;
    const date = all_days[latestDayIndex].date;
    return nasa_load_epic_day(date);
})

function nasa_load_epic_day(date)
{
    document.getElementById("loading-text").textContent = 
        "Loading latest data from " + date;
    nasa_api_json('date/' + date)
    .then((latestDayEpicImageDataArray1) => {
        latestDayEpicImageDataArray = latestDayEpicImageDataArray1;
        document.getElementById("loading-text").textContent = 
            "Loading... 10%";
        return nasa_api_json('date/' + all_days[latestDayIndex+1].date);
    })
    .then((prevDayEpicImageDataArray1) => {
        prevDayEpicImageDataArray = prevDayEpicImageDataArray1;
        const twoDaysEpicImageDataArray = prevDayEpicImageDataArray.concat(latestDayEpicImageDataArray);

        const end_date = new Date(twoDaysEpicImageDataArray[twoDaysEpicImageDataArray.length - 1].date + "Z");
        gEpicEndTimeSec = end_date.getTime() / 1000;
        let start_date = new Date();
        start_date.setTime(end_date.getTime() - 24 * 60 * 60 * 1000);
        let i = 0;
        for(; i <= twoDaysEpicImageDataArray.length; i++)
        {
            if (start_date <= new Date(twoDaysEpicImageDataArray[i].date + "Z"))
                break;
            // 
        }
        i--;
        gEpicStartTimeSec = start_date.getTime() / 1000;

        let numLoadedImages = 0;
        let totalImagesToLoad = twoDaysEpicImageDataArray.length - i;
        for(; i < twoDaysEpicImageDataArray.length; i++)
        {
            let epicImageData = twoDaysEpicImageDataArray[i];
            gEpicImageDataMap.set(
                (new Date(epicImageData.date + "Z")).getTime() / 1000,
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
        }
    });
}
