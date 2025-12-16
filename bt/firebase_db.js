// Import the functions you need from the SDKs you need
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { app } from "./firebase_init.js";

let db;

try {
    db = app ? getFirestore(app) : null;
    if (db) 
        console.log("Firebase DB initialized");
    else
        console.warn("Firebase DB not initialized");
}
catch (e) {
    console.error("Firebase DB initialization error:", e);
    db = null;
}

export {db};