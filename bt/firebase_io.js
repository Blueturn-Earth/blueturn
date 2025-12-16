import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import { db } from "./firebase_db.js";

let auth;

try {
  auth = getAuth();
  console.log("Current Firebase user before signin:", auth ? auth.currentUser : null);
} catch (e) {
  console.error("Firebase getAuth error:", e);
  auth = null;
}

export async function ensureAuthReady() {
  if (!auth) {
    console.warn("No Firebase Auth available");
    return;
  }
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        unsub();
        resolve();
      }
    });

    if (!auth.currentUser) {
      signInAnonymously(auth).catch(reject);
    }
  });
}

export default async function saveMetadata(imageUrl, metadata) {
  if (!db) {
    console.warn("No Firestore DB available, skipping metadata save");
    return;
  }

  await ensureAuthReady();

  let auth;

  try {
    auth = getAuth();
    console.log("Firebase User at write time:", auth.currentUser);
  } catch (e) {
    console.warn("Abort as no Firebase user at write time:", e);
    auth = null;
    return;
  }

/*
Typical document:
{
  imageUrl: "https://drive.google.com/uc?id=...",
  provider: "drive",

  createdAt: Timestamp,

  gps: {
    lat: 48.8566,
    lon: 2.3522,
    alt: 1234.5
  },

  orientation: {
    yaw: 182.4,
    pitch: -31.0,
    roll: 2.1
  }
}
*/
  const doc = {
    imageUrl,
    provider: metadata.provider,
    createdAt: serverTimestamp(),
    gps: metadata.gps,
    orientation: metadata.orientation
  };
  console.log("Saving doc to Firestore:", doc);
  console.log("DB:", db);
  console.log("DB type:", typeof db);
  await addDoc(collection(db, "images"), doc);
  console.log("Saved metadata to Firestore:", imageUrl, metadata);
}
