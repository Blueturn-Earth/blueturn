import DB_Interface from "./db_interface.js";

export default class CachedDB extends DB_Interface {
    #local = new Map();
    #newRecordCallbacks = new Map();

    #nextCbId = 0;

    addNewRecordCallback(cb)
    {
        const cbId = this.#nextCbId;
        this.#newRecordCallbacks.set(this.#nextCbId++, cb);
        return cbId;
    }

    removeNewRecordCallback(cbId)
    {
        if (!this.#newRecordCallbacks.has(cbId))
            throw new Error("cb id " + cbId + " not in callbacks");
        this.#newRecordCallbacks.delete(cbId);
    }

    async forEachLocal(cb)
    {
        return await this.#local.forEach(cb);
    }

    async cacheRecord(docId, record, serialCb) {
        if (this.#local.has(docId))
            return false;

        record.docId = docId;
        for (const [cbId, cb] of this.#newRecordCallbacks) {
            if (serialCb) {
                if (!await cb(record))
                    return false;
            }
            else {
                if (!cb(record))
                    return false;
            }
        };
        this.#local.set(docId, record);
        return true;
    }
}
