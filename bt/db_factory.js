import DB_Interface from "./db_interface.js";
import FirebaseDB from "./firebase_db.js";

class DB_Factory {
    getDB(type, collection) {
        let dbInstance = null;

        if (type == "firebase") {
            dbInstance = new FirebaseDB(collection);
        }

        if (!dbInstance) {
            reject("Failed to create DB instance");
        }
        if (!(dbInstance instanceof DB_Interface)) {
            reject("FirebaseDB does not implement DB_Interface");
        }
        return dbInstance;
    }
}

export const dbFactory = new DB_Factory();
export const db = dbFactory.getDB("firebase", "images");
