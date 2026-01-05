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

    async getAllSkyPhotos() {
        const query = this.db.buildQuery(
            this.db.orderBy("takenTime", "asc")
        );
        const records = await this.db.getRecords(query);
        return records;
    }

    async getSkyPhotosAfterDate(date) {
        const queryConstraints = [
            this.db.where("takenTime", ">", date),
            this.db.orderBy("takenTime", "asc")
        ];
        const query = this.db.buildQuery(...queryConstraints);
        const records = await this.db.getRecords(query);
        return records;
    }

    async getSkyPhotosBeforeDate(date, maxNumRecords) {
        const queryConstraints = [
            this.db.orderBy("takenTime"),
            this.db.endBefore(date)
        ];
        if (maxNumRecords > 0) {
            queryConstraints.push(this.db.limitToLast(maxNumRecords));
        }
        const query = this.db.buildQuery(...queryConstraints);
        const records = await this.db.getRecords(query);
        return records;
    }
}

export const skyPhotosDB = new SkyPhotosDB();
