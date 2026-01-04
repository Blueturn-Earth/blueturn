export default class DB_Interface {
    async saveRecord(record, collection = undefined) {
        throw new Error("saveRecord not implemented");
    }

    where(...args) {
        throw new Error("where not implemented");
    }
    
    orderBy(...args) {
        throw new Error("orderBy not implemented");
    }

    endBefore(...args) {
        throw new Error("endBefore not implemented");
    }

    limitToLast(...args) {
        throw new Error("limitToLast not implemented");
    }

    buildQuery(...queryConstraints) {
        throw new Error("query not implemented");
    }

    async getRecords(query) {
        throw new Error("getRecords not implemented");
    }
}