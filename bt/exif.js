import tzLookup from 'https://esm.sh/@photostructure/tz-lookup@latest';
import * as exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.js';

export async function processEXIF(imgFile)
{
    console.log("Trying to get GPS from EXIF");
    let gps = undefined;

    const tags = await exifr.parse(imgFile, { 
            tiff: true, 
            ifd0: true, 
            exif: true, 
            gps: true,
            pick: ['DateTimeOriginal','CreateDate','ModifyDate','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef']
        });
  
    if (!tags)
    {
        const errorMsg = "No EXIF data in image file " + imgFile.name;
        throw new Error(errorMsg);
    }

    if (tags.GPSLatitude && tags.GPSLongitude) {
        const lat = tags.GPSLatitude[0] + tags.GPSLatitude[1]/60 + tags.GPSLatitude[2]/3600;
        const lon = tags.GPSLongitude[0] + tags.GPSLongitude[1]/60 + tags.GPSLongitude[2]/3600;
        gps = { lat, lon };
        console.log("Got GPS from EXIF:", gps);
    }
    else {
        const errorMsg = "No GPS in image file " + imgFile.name;
        throw new Error(errorMsg);
    }

    const takenTime = 
        tags.DateTimeOriginal || 
        tags.CreateDate || 
        tags.ModifyDate;
    if (!takenTime) {
        const errorMsg = "No Timestamp in image file " + imgFile.name;
        throw new Error(errorMsg);
    }
    console.log('EXIF date:', takenTime);
    return {
        takenTime: takenTime,
        gps: gps
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
            throw new Error("No Geolocation permission: " + geoError.message);
        case 2: // POSITION_UNAVAILABLE
            throw new Error("Geolocation unavailable: " + geoError.message);
        case 3: // TIMEOUT
            throw new Error("Geolocation timeout: " + geoError.message);
        }
    }
}

export async function addEXIF(imgFile)
{
    if (!navigator.geolocation) {
        throw new Error("Geolocation not supported");
    }

    const now = new Date();
    const gps = await getGeolocation();

    return {
        takenTime: now,
        gps: gps
    };
}
