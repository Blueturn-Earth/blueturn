import tzLookup from 'https://esm.sh/@photostructure/tz-lookup@latest';
import * as exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.js';

function dumpError(errorMsg)
{
    if (errorMsg && errorMsg !== "")
    {
        console.log(errorMsg);
        alert(errorMsg);
    }
    error = new Error(errorMsg);
}

export async function processEXIF(imgFile)
{
    console.log("Trying to get GPS from EXIF");
    let takenTime = null;
    let gps = null;
    let error = null;
    const tags = await exifr.parse(imgFile, { 
        tiff: true, 
        ifd0: true, 
        exif: true, 
        gps: true,
        pick: ['DateTimeOriginal','CreateDate','ModifyDate','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef']
    });
  
    if (!tags)
    {
        error = dumpError("No EXIF data in image file " + imgFile.name);
    }
    else {
        if (tags.GPSLatitude && tags.GPSLongitude) {
            const lat = tags.GPSLatitude[0] + tags.GPSLatitude[1]/60 + tags.GPSLatitude[2]/3600;
            const lon = tags.GPSLongitude[0] + tags.GPSLongitude[1]/60 + tags.GPSLongitude[2]/3600;
            gps = { lat, lon };
            console.log("Got GPS from EXIF:", gps);
        }
        else {
            error = dumpError("No GPS in image file " + imgFile.name);
        }

        takenTime = 
            tags.DateTimeOriginal || 
            tags.CreateDate || 
            tags.ModifyDate;
        if (!takenTime) {
            error = dumpError("No Timestamp in image file " + imgFile.name);
        }
        console.log('EXIF date:', takenTime);
    }
    return {
        takenTime: takenTime,
        gps: gps,
        error: error
    };
}

async function getGeolocationPromise()
{
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });                
            },
            (geoError) => {
                reject(geoError);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

async function getGeolocation()
{
    let gps;
    try {
        gps = await getGeolocationPromise();
    }
    catch(geoError) {
        switch(geoError.code)
        {
        case 1: // PERMISSION_DENIED
            if (window.confirm("Please allow geolocation to pin your photo on Earth"))
            {
                try {
                    gps = await getGeolocationPromise();
                }
                catch (geoError) {
                    throw new Error("Geolocation error: " + geoError.message);
                }
            }
            throw new Error("");
        case 2: // POSITION_UNAVAILABLE
            throw new Error("Geolocation not available: " + geoError.message);
        case 3: // TIMEOUT
            throw new Error("Geolocation timed out: " + geoError.message);
        }
    }
    return gps;
}

export async function addEXIF(imgFile)
{
    const now = new Date();
    let gps;
    let error;
    if (!navigator.geolocation) {
        error = dumpError("Geolocation not supported");
    }
    else {
        try {
            gps = await getGeolocation();
        }
        catch(e) {
            dumpError(e.message);
            return {
                takenTime: now,
                gps: null,
                error: e
            };
        }
    }
    return {
        takenTime: now,
        gps: gps,
        error: error
    };
}
