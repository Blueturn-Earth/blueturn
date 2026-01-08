import { db } from './db_factory.js';
import { gEpicDB } from './app.js';
import { gGetDateTimeStringFromTimeSec, gFindClosestIndexInSortedArray, gGetDateTimeStringFromDate } from './utils.js';
import { mergeSegment, intersectSegment, negativeCoverage, getIndexOfValueInArray } from './utils_coverage.js'
class SkyPhotosDB {
    #epicTimeSortedArray = [];
    #reachedMin = false;
    #reachedMax = false;
    #dateCoverage = [];

    constructor() {
        this.db = db;
        this.db.addNewRecordCallback(async (record) => {await this._newSkyPhotoCallback(record);});
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

    _markFirstReached()
    {
        if (this.#reachedMin)
            return;
        this.#reachedMin = true;
        console.log("Fetched oldest record");
    }

    _markLastReached()
    {
        if (this.#reachedMax)
            return;
        this.#reachedMax = true;
        console.log("Fetched most recent record");
    }

    _getMinDate()
    {
        if (this.#epicTimeSortedArray.length == 0)
            return;
        const itemWithMinimalTakenTime = this.#epicTimeSortedArray.reduce((minItem, currentItem) => {
            return (currentItem.takenTime.toDate() < minItem.takenTime.toDate()) ? currentItem : minItem;
        });
        return itemWithMinimalTakenTime.takenTime.toDate();
    }

    _getMaxDate()
    {
        if (this.#epicTimeSortedArray.length == 0)
            return;
        const itemWithMaximalTakenTime = this.#epicTimeSortedArray.reduce((maxItem, currentItem) => {
            return (currentItem.takenTime.toDate() > maxItem.takenTime.toDate()) ? currentItem : maxItem;
        });
        return itemWithMaximalTakenTime.takenTime.toDate();
    }

    _isBeyondMaxDate(date, inDB = true)
    {
        if (this.#epicTimeSortedArray.length == 0) {
            if (this.#reachedMax) // means empty also in DB
                return true;
            if (inDB) // means there may be more to find
                return false;
            return true; // means locally empty
        }
        const maximalTakenTime = this._getMaxDate();
        return (date >= maximalTakenTime && (!inDB || this.#reachedMax));
    }
    
    _isBeyondMinDate(date, inDB = true)
    {
        if (this.#epicTimeSortedArray.length == 0) {
            if (this.#reachedMin) // means empty also in DB
                return true;
            if (inDB) // means there may be more to find
                return false;
            return true; // means locally empty
        }
        if (this.#epicTimeSortedArray.length == 0 && !this.#reachedMax)
            return false;
        const minimalTakenTime = this._getMinDate();
        return (date <= minimalTakenTime && (!inDB || this.#reachedMin))

    }
    
    async fetchAll()
    {
        if (this.#reachedMax && this.#reachedMin)
            return [];
        const queryConstraints = [
            this.db.orderBy("takenTime", "desc")
        ];
        const query = this.db.buildQuery(...queryConstraints);
        const records = await this.db.fetchRecords(query);

        this._markLastReached();
        if (maxCount <= 0 || records.length < maxCount) {
            this._markFirstReached();
        }

        return records;
    }

    async fetchAroundDate(date, radiusCount)
    {

        const recordsAfter = await this.fetchDateRange(date, null, radiusCount);
        if (recordsAfter.length < radiusCount)
            this._markLastReached();
        const maxBoundDate = recordsAfter.length > 0 ? recordsAfter[recordsAfter.length - 1] : date;
        const recordsBefore = await this.fetchDateRange(null, date, radiusCount);
        if (recordsBefore.length < radiusCount)
            this._markFirstReached();
        const minBoundDate = recordsBefore.length > 0 ? recordsBefore[recordsBefore.length] : date;
        mergeSegment(this.#dateCoverage, minBoundDate, maxBoundDate);
        const recordsAround = [...recordsBefore.toReversed(), ...recordsAfter];
        return recordsAround;
    }

    _getCoverageString()
    {
        let logLines = "Updated DB fetch date coverage:\n";
        for (let i = 0; i < this.#dateCoverage.length; i+=2) {
            const date0 = this.#dateCoverage[i];
            const date1 = this.#dateCoverage[i+1];
            const dateStr0 = date0 ? gGetDateTimeStringFromDate(date0) : "-INF";
            const dateStr1 = date1 ? gGetDateTimeStringFromDate(date1) : "+INF";
            logLines += "[ " + dateStr0 + ", " + dateStr1 + "]\n";
        }
        return logLines;
    }

    async fetchDateRange(rangeStartEpicTimeDate, rangeEndEpicTimeDate, maxNumRecords, noIntersect = false)
    {
        if (rangeStartEpicTimeDate && rangeEndEpicTimeDate && rangeStartEpicTimeDate > rangeEndEpicTimeDate) {
            console.warn("rangeStartEpicTimeDate=" + rangeStartEpicTimeDate + " > rangeEndEpicTimeDate=" + rangeEndEpicTimeDate);
            return [];
        }

        if (!noIntersect) {
            const addedCoverage = intersectSegment(
                negativeCoverage(this.#dateCoverage),
                rangeStartEpicTimeDate, 
                rangeEndEpicTimeDate,
                (date1, date2) => (date1?.getTime() == date2?.getTime())
            );

            this.#dateCoverage = mergeSegment(this.#dateCoverage, rangeStartEpicTimeDate, rangeEndEpicTimeDate);

            if (addedCoverage.length > 0)
                console.log(this._getCoverageString());

            let records = [];
            for (let i = 0; i < addedCoverage.length; i += 2) {
                const segmentRecords = await this.fetchDateRange(addedCoverage[i], addedCoverage[i+1], maxNumRecords, true);
                maxNumRecords -= segmentRecords.length;
                records = [...records, ...segmentRecords];
            }
            return records;
        }

        if (rangeStartEpicTimeDate && this._isBeyondMaxDate(rangeStartEpicTimeDate))
            return [];
        if (rangeEndEpicTimeDate && this._isBeyondMinDate(rangeEndEpicTimeDate))
            return [];

        const queryConstraints = [];
        if (rangeStartEpicTimeDate)
            queryConstraints.push(this.db.where("takenTime", ">", rangeStartEpicTimeDate));
        if (rangeEndEpicTimeDate)
            queryConstraints.push(this.db.where("takenTime", "<", rangeEndEpicTimeDate));
        queryConstraints.push(this.db.orderBy("takenTime", rangeStartEpicTimeDate ? "asc" : "desc"));
        if ((!rangeStartEpicTimeDate || !rangeEndEpicTimeDate) && maxNumRecords > 0) {
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

    getSkyPhotoAtEpicTimeIndex(index)
    {
        if (index < 0 || index >= this.#epicTimeSortedArray.length)
            return null;
        return this.#epicTimeSortedArray[index];
    }

    getEpicTimeSecByAlpha(alpha)
    {
        if (this.#epicTimeSortedArray.length == 0)
            return null;
        const indexFloat = alpha * (this.#epicTimeSortedArray.length - 1);
        const index0 = Math.floor(indexFloat);
        const index1 = Math.ceil(indexFloat);
        const boundAlpha = index0 == index1 ? 0 : (indexFloat - index0) / (index1 - index0);
        const timeSec = (1.0 - boundAlpha) * this.#epicTimeSortedArray[index0].epicTimeSec + boundAlpha * this.#epicTimeSortedArray[index1].epicTimeSec;
        return timeSec;
    }

    getEpicTimeIndex(epicTimeSec) {
        return getIndexOfValueInArray(epicTimeSec, this.#epicTimeSortedArray, (record) => record.epicTimeSec);
    }

    getAlphaByEpicTimeSec(epicTimeSec)
    {
        if (this.#epicTimeSortedArray.length == 0)
        {
            return -1;
        }

        const currentDate = new Date(epicTimeSec * 1000);
        const currentTimeSec = currentDate.getTime() / 1000;
        const closestPicIndex = gFindClosestIndexInSortedArray(this.#epicTimeSortedArray, currentTimeSec, picItem => picItem.epicTimeSec);
        if (closestPicIndex < 0 || closestPicIndex >= this.#epicTimeSortedArray.length)
            return;
        const closestPicTimeSec = this.#epicTimeSortedArray[closestPicIndex].epicTimeSec;
        const prevPicIndex = closestPicTimeSec <= currentTimeSec ? closestPicIndex : closestPicIndex - 1;
        const nextPicIndex = closestPicTimeSec >= currentTimeSec ? closestPicIndex : closestPicIndex + 1;
        //console.log("indices: " + prevPicIndex + " - " + closestPicIndex + " - " + nextPicIndex);
        let currentTimeIndexFloat;
        if (prevPicIndex == nextPicIndex ||
            prevPicIndex < 0 ||
            nextPicIndex >= this.#epicTimeSortedArray.length
        )
            currentTimeIndexFloat = closestPicIndex;
        else 
            currentTimeIndexFloat = prevPicIndex + 
                (currentTimeSec - this.#epicTimeSortedArray[prevPicIndex].epicTimeSec) / 
                (this.#epicTimeSortedArray[nextPicIndex].epicTimeSec - this.#epicTimeSortedArray[prevPicIndex].epicTimeSec);
        const currentTimeAlpha = currentTimeIndexFloat / (this.#epicTimeSortedArray.length - 1);

        return currentTimeAlpha;
    }

    getEpicTimeIndexByDocId(docId)
    {
        return this.#epicTimeSortedArray.findIndex(pic => pic.docId === docId);
    }

    _addSkyPhotoToEpicSortedArray(record)
    {
        const sortedIndex = this.getEpicTimeIndex(record.epicTimeSec);

        const timestampTimeSec = record.epicTimeSec;
        const timestampDate = new Date(timestampTimeSec * 1000);

        console.debug("Adding new sky photo of time " + timestampDate + " at index " + sortedIndex + " / " + this.#epicTimeSortedArray.length);

        // insert in array
        this.#epicTimeSortedArray.splice(sortedIndex, 0, record);

        return sortedIndex;
    }

    async _newSkyPhotoCallback(record)
    {
        await SkyPhotosDB._adjustEpicTimeSec(record);

        const index = this._addSkyPhotoToEpicSortedArray(record);
        record.epicTimeIndex = index;
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
