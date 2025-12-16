import {
  doc,
  setDoc,
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

function makeDocId(userId) {
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

export default async function saveMetadata(uploadResult, profile, gps, orientation) {
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

  const docId = makeDocId(profile.sub);
  console.log("Generated document ID:", docId);

  const photoDoc = {
    createdAt: serverTimestamp(),
    image: uploadResult,
    gps: gps,
    orientation: orientation,
    profile: profile
  };
  console.log("Saving doc to Firestore:", photoDoc);
  console.log("DB:", db);
  console.log("DB type:", typeof db);
  await setDoc(doc(db, "images", docId), photoDoc);
  console.log("Saved document to Firestore:", photoDoc);
}
