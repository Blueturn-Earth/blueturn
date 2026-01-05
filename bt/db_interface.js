export default class DB_Interface {
    async saveRecord(record) {
        throw new Error("saveRecord not implemented");
    }

    where(...args) {
        throw new Error("where not implemented");
    }
    
    orderBy(...args) {
        throw new Error("orderBy not implemented");
    }

    endBefore(fieldValue) {
        throw new Error("endBefore not implemented");
    }

    limitToLast(...args) {
        throw new Error("limitToLast not implemented");
    }

    buildQuery(...queryConstraints) {
        throw new Error("buildQuery not implemented");
    }

    async fetchRecords(query) {
        throw new Error("fetchRecords not implemented");
    }

    addNewRecordCallback(cb)
    {
        throw new Error("addNewRecordCallback not implemented");
    }

    removeNewRecordCallback(cbId)
    {
        throw new Error("removeNewRecordCallback not implemented");
    }

    async forEachLocal(cb)
    {
        throw new Error("forEachLocal not implemented");
    }
}