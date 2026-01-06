import { db } from './db_factory.js';
import { gEpicDB } from './app.js';
import { gGetDateTimeStringFromTimeSec } from './utils.js';

class SkyPhotosDB {
    constructor() {
        this.db = db;
    }

    async saveSkyPhoto(record) {
    /*
        // Expected record format:
        {
            image: <GoogleDriveUploadResult>,
            takenTime: <Date>,
            gps: {lat:, lon:},
            skyRatio: [0..1],
            profile: <GoogleProfile>
        }
    */
        const savedRecord = await this.db.saveRecord(record);
        console.log("Sky photo record saved with ID:", savedRecord.id);
        return savedRecord;
    }

    async fetchAllSkyPhotos(serialCb = true) {
        const query = this.db.buildQuery(
            this.db.orderBy("takenTime", "asc")
        );
        const records = await this.db.fetchRecords(query);
        return records;
    }

    async fetchSkyPhotosAfterDate(date, maxNumRecords = 0) {
        const queryConstraints = [
            this.db.where("takenTime", ">=", date),
            this.db.orderBy("takenTime", "asc")
        ];
        if (maxNumRecords > 0) {
            queryConstraints.push(this.db.limitToLast(maxNumRecords));
        }
        const query = this.db.buildQuery(...queryConstraints);
        const records = await this.db.fetchRecords(query);
        return records;
    }

    async fetchSkyPhotosBeforeDate(date, maxNumRecords = 0) {
        const queryConstraints = [
            this.db.where("takenTime", "<=", date),
            this.db.orderBy("takenTime", "desc")
        ];
        if (maxNumRecords > 0) {
            queryConstraints.push(this.db.limitToLast(maxNumRecords));
        }
        const query = this.db.buildQuery(...queryConstraints);
        const records = await this.db.fetchRecords(query);
        return records;
    }

    addNewSkyPhotoCallback(cb)
    {
        const wrapCb = async (record) => {
            await SkyPhotosDB._adjustEpicTimeSec(record);
            await(cb(record));
        };
        return this.db.addNewRecordCallback(wrapCb);
    }

    removeNewSkyPhotoCallback(cbId)
    {
        this.db.removeNewRecordCallback(cbId);
    }

    async forEachLocal(cb) {
        return await this.db.forEachLocal(cb);
    }

    static _checkSkyPhotoRecord(record)
    {
        const docId = record.docId;
        const data = record;
        if (!data) {
            console.warn("No data for pic:", docId);
            return false;
        }
        if (!data.image || !data.image.fileId) {
            console.warn("No image field or file id for pic data:", docId);
            return false;
        }
        if (!data.gps || data.gps.lat === undefined || data.gps.lon === undefined) {
            console.warn("No GPS field for pic data:", docId);
            return false;
        }
        if (!data.createdAt && !data.takenTime) {
            console.warn("No timestamp (takenTime or createdAt) field for pic data:", docId);
            return false;
        }
        return true;
    }


    static async _adjustEpicTimeSec(record)
    {
        const timestamp = record.takenTime || record.createdAt;
        const timestampDate = timestamp.toDate();
        console.debug("Adding new sky photo for time ", timestampDate);
        let timeSec = timestampDate.getTime() / 1000;

        if (!SkyPhotosDB._checkSkyPhotoRecord(record))
        {
            console.warn("Skipping pic due to missing data:", record.docId);
            return;
        }
        const SECONDS_IN_DAY = 3600*24;
        if (timeSec > gEpicDB.getLatestEpicImageTimeSec())
        {
            while (timeSec > gEpicDB.getLatestEpicImageTimeSec())
            {
                timeSec -= SECONDS_IN_DAY;
            }
            const adjusted_timestampDate = new Date(timeSec * 1000);
            console.log("Adjusted pic from " + timestampDate + " to ", adjusted_timestampDate + " to fit in EPIC range");
        }

        //if (adjustTimeForMissingEpicData)
        {
            let boundPair;
            try {
                boundPair = 
                    await gEpicDB.fetchBoundKeyFrames(
                        timeSec,
                        false // don't request same day
                    );
            }
            catch(e) {
                console.warn("Error fetching EPIC image at picture time " + timestampDate + ", " + e);
                boundPair = null;
            }
            const [epicImageData0, epicImageData1] = boundPair ? boundPair : [null, null];
            if (!boundPair) {
                console.warn("Could not fetch EPIC data at picture time ", timestampDate);
            }
            else if (!epicImageData0 && !epicImageData1) {
                console.warn("Could not fetch bound EPIC images at picture time ", timestampDate);
            }
            else if (!epicImageData1 || !epicImageData0 || epicImageData1.epicTimeSec - epicImageData0.epicTimeSec > 12 * 3600)
            {
                console.warn("EPIC data not available at picture time ", timestampDate);
                if (!epicImageData1 || (epicImageData0 && (timeSec - epicImageData0.epicTimeSec < epicImageData1.epicTimeSec - timeSec)))
                {
                    console.log("Closest EPIC data before picture time is previous at ", epicImageData0.date);
                    while (timeSec > epicImageData0.epicTimeSec)
                        timeSec -= SECONDS_IN_DAY;
                }
                else if (!epicImageData0 || (epicImageData1 && (timeSec - epicImageData0.epicTimeSec > epicImageData1.epicTimeSec - timeSec)))
                {
                    console.log("Closest EPIC data after picture time is next at ", epicImageData1.date);
                    while (timeSec < epicImageData1.epicTimeSec)
                        timeSec += SECONDS_IN_DAY;
                }
                const adjusted_timestampDate = new Date(timeSec * 1000);
                console.log("Adjusted pic from " + timestampDate + " to ", adjusted_timestampDate + " to fit in EPIC range");
            }
        }

        record.epicTimeSec = timeSec;
        const realDate = gGetDateTimeStringFromTimeSec(timestamp.toDate().getTime() / 1000);
        const fakeDate = gGetDateTimeStringFromTimeSec(record.epicTimeSec);
        if (realDate != fakeDate)
            console.debug(`Pic docId=${record.docId}: real date: \"${realDate}\", fake date:\"${fakeDate}\"`)
        else
            console.debug(`Pic docId=${record.docId}: date: \"${realDate}\"`);



    }    
}

export const skyPhotosDB = new SkyPhotosDB();
