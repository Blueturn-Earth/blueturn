import DB_Interface from "./db_interface.js";

export default class VirtualizedDB extends DB_Interface {
    #db;
    #virtualSize;
    #fetchMultiplier;
    #virtualizer;

    constructor(db, {
        virtualSize = 1_000_000,
        fetchMultiplier = 10,
        virtualizer
    } = {}) {
        super();
        this.#db = db;
        this.#virtualSize = virtualSize;
        this.#fetchMultiplier = fetchMultiplier;
        this.#virtualizer = virtualizer;
    }

    /* ---------------- passthrough ---------------- */

    setCollectionName(name) {
        this.#db.setCollectionName(name);
    }

    async saveRecord(record) {
        return this.#db.saveRecord(record);
    }

    /* ---------------- constraint wrappers ---------------- */

    where(field, op, value, scope = "virtual") {
        const c = this.#db.where(field, op, value);
        c.__virtual = { type: "where", field, op, value, scope };
        return c;
    }

    orderBy(field, direction = "asc", scope = "virtual") {
        const c = this.#db.orderBy(field, direction);
        c.__virtual = { type: "orderBy", field, direction, scope };
        return c;
    }

    limit(n) {
        const c = this.#db.limit(n);
        c.__virtual = { type: "limit", value: n };
        return c;
    }

    endBefore(value) {
        const c = this.#db.endBefore(value);
        c.__virtual = { type: "cursor", value };
        return c;
    }

    buildQuery(...constraints) {
        return this.#db.buildQuery(...constraints);
    }

    addNewRecordCallback(cb)
    {
        return this.#db.addNewRecordCallback(cb);
    }

    removeNewRecordCallback(cbId)
    {
        return this.#db.removeNewRecordCallback(cbId);
    }

    async forEachLocal(cb) {
        return await this.#db.forEachLocal(cb);
    }

    /* ---------------- virtualization ---------------- */

    async fetchRecords(query, serialCb = true) {
        const constraints = query._queryConstraints ?? [];

        const virtual = {
            where: [],
            orderBy: null,
            limit: 20,
            cursor: 0
        };

        const realConstraints = [];

        for (const c of constraints) {
            if (!c.__virtual) {
                realConstraints.push(c);
                continue;
            }

            const v = c.__virtual;

            switch (v.type) {
                case "where":
                    (v.scope === "real"
                        ? realConstraints
                        : virtual.where
                    ).push(v);
                    break;

                case "orderBy":
                    v.scope === "real"
                        ? realConstraints.push(c)
                        : (virtual.orderBy = v);
                    break;

                case "limit":
                    virtual.limit = v.value;
                    break;

                case "cursor":
                    virtual.cursor = v.value;
                    break;
            }
        }

        // Inflate real fetch
        realConstraints.push(
            this.#db.limit(virtual.limit * this.#fetchMultiplier)
        );

        const realQuery = this.#db.buildQuery(...realConstraints);
        const docs = await this.#db.fetchRecords(realQuery, serialCb);

        if (!docs.length) return [];

        const baseDocs = docs.map(d => d.data());

        // Virtual expansion
        const results = [];
        let i = virtual.cursor;

        while (
            results.length < virtual.limit &&
            i < this.#virtualSize
        ) {
            const base = baseDocs[i % baseDocs.length];
            const vdoc = this.#virtualizer(base, i);

            if (this.#passesVirtualWhere(vdoc, virtual.where)) {
                vdoc.virtualId = i;
                results.push(vdoc);
            }

            i++;
        }

        if (virtual.orderBy) {
            const { field, direction } = virtual.orderBy;
            results.sort((a, b) =>
                direction === "asc"
                    ? a[field] - b[field]
                    : b[field] - a[field]
            );
        }

        return results;
    }

    #passesVirtualWhere(doc, wheres) {
        for (const w of wheres) {
            if (!compare(doc[w.field], w.op, w.value))
                return false;
        }
        return true;
    }
}
