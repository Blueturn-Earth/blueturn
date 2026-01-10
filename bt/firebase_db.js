import CachedDB from "./cached_db.js";

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    endBefore,
    limit
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export default class FirebaseDB extends CachedDB {
    #auth;
    #app;
    #db;
    #collection;
    #authPromise;
    #fetchingPromise;

    #firebaseConfig = {
        apiKey: "AIzaSyCrF263rcJ3fyNyQtnfSSwPg4U-jvUeEYg",
        authDomain: "blueturnskyphotos.firebaseapp.com",
        projectId: "blueturnskyphotos",
        storageBucket: "blueturnskyphotos.firebasestorage.app",
        messagingSenderId: "903849020310",
        appId: "1:903849020310:web:459beba9eeb829194bebb7",
        measurementId: "G-BK6RXHKBR3"
    };

    constructor(collection) {
        super();
        this.#collection = collection;
        try {
            this.#app = initializeApp(this.#firebaseConfig);
            console.debug("Firebase app initialized");
        } catch (e) {
            console.error("Firebase app initialization error:", e);
            this.#app = null;
        }

        try {
            this.#db = this.#app ? getFirestore(this.#app) : null;
            if (this.#db) 
                console.debug("Firebase DB initialized");
            else
                console.warn("Firebase DB not initialized");
        }
        catch (e) {
            console.error("Firebase DB initialization error:", e);
            this.#db = null;
        }
    }

    async _authenticate() {
        if (this.#auth) {
            return this.#auth;
        }

        try {
            this.#auth = getAuth();
            console.debug("Current Firebase user before signin:", this.#auth ? this.#auth.currentUser : null);
        } catch (e) {
            throw new Error("Firebase getAuth error:", e);
        }

        if (!this.#authPromise)
        {
            this.#authPromise = new Promise((resolve, reject) => {
                const unsub = onAuthStateChanged(this.#auth, user => {
                    //console.log("Firebase auth state changed, current user:", user);
                    if (user) {
                        unsub();
                        resolve(this.#auth);
                        this.#authPromise = null;
                    }
                });

                if (!this.#auth.currentUser) {
                    //console.debug("Signing in anonymously to Firebase");
                    signInAnonymously(this.#auth)
                    .catch(reject);
                }
            });
        }
        return this.#authPromise;
    }

    _makeDocId(userId) {
        const pad = (n, w = 2) => String(n).padStart(w, "0");
        const date = new Date();
        return (
            date.getFullYear() +
            pad(date.getMonth() + 1) +
            pad(date.getDate()) +
            "_" +
            pad(date.getHours()) +
            pad(date.getMinutes()) +
            pad(date.getSeconds()) +
            "_" +
            userId
        );
    }

    async saveRecord(record) {
        try {
            if (!this.#db) {
                console.warn("No Firestore DB available, skipping metadata save");
                return;
            }

            await this._authenticate();

            record.docId = this._makeDocId(record.profile.sub);
            console.log("Generated document ID:", record.docId);

            record.ownerUid = this.#auth.currentUser.uid; // 🔑 used for rules
            record.createdAt = serverTimestamp();
            await setDoc(doc(this.#db, this.#collection, record.docId), record);
            console.log("Saved document to Firestore:", record);
            return record;
        } catch (e) {
            console.error("Error saving record to Firestore:", e);
            throw e;
        }
    }

    where(...args) {
        return where(...args);
    }
    
    orderBy(...args) {
        return orderBy(...args);
    }

    endBefore(fieldValue) {
        return endBefore(fieldValue);
    }

    limit(...args) {
        return limit(...args);
    }

    buildQuery(...queryConstraints) {
        return query(
            collection(this.#db, this.#collection),
            ...queryConstraints);
    }

    async _fetchDocs(query, fetchCount)
    {
        if (this.#fetchingPromise) {
            console.debug("Waiting on pending fetch before request #" + fetchCount + " ...");
            await this.#fetchingPromise;
            console.debug("Pending fetch done");
        }
        console.debug("Fetch request #" + fetchCount + " with query ", query);
        const fetchingPromise = getDocs(query);
        this.#fetchingPromise = fetchingPromise;
        const snap = await fetchingPromise;
        console.debug("Fetch request #" + fetchCount + " done with " + snap.docs.length + " records");
        this.#fetchingPromise = null;
        return fetchingPromise;
    }

    #fetchCount = 0;
    async fetchRecords(query, serialCb = true) {
        await this._authenticate();

        this.#fetchCount++;
        const fetchCount = this.#fetchCount;
        const snap = await this._fetchDocs(query, fetchCount);
        let newRecordCount = 0;
        const docs = snap.docs;
        for (const doc of docs) {
            if (this.cacheRecord(doc.id, doc.data()))
                newRecordCount++;
        }

        if (newRecordCount > 0)
            console.debug("Fetch request #" + fetchCount + " done with " + newRecordCount + " new records");
        return docs.map(d => d.data());
    }
}
