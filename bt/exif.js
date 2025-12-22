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
        alert(errorMsg);
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
        alert(errorMsg);
        throw new Error(errorMsg);
    }

    const dateTaken = 
        tags.DateTimeOriginal || 
        tags.CreateDate || 
        tags.ModifyDate;
    if (!dateTaken) {
        const errorMsg = "No Timestamp in image file " + imgFile.name;
        alert(errorMsg);
        throw new Error(errorMsg);
    }
    console.log('EXIF date:', dateTaken);
    return {
        takenTime: dateTaken,
        gps: gps
    };
}
