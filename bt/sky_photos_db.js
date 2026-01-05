import { db } from './db_factory.js';

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

    async fetchAllSkyPhotos() {
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
        return this.db.addNewRecordCallback(cb);
    }

    removeNewSkyPhotoCallback(cbId)
    {
        this.db.removeNewRecordCallback(cbId);
    }

    async forEachLocal(cb) {
        return await this.db.forEachLocal(cb);
    }

}

export const skyPhotosDB = new SkyPhotosDB();
