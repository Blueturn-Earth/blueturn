import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { db } from "./firebase_db.js";
import { ensureAuthReady } from "./firebase_auth.js";

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

export async function saveMetadata(uploadResult, profile, gps, takenTime) {
  if (!db) {
    console.warn("No Firestore DB available, skipping metadata save");
    return;
  }

  const auth = await ensureAuthReady();

  const docId = makeDocId(profile.sub);
  console.log("Generated document ID:", docId);

  const photoDoc = {
    docId: docId,
    ownerUid: auth?.currentUser?.uid, // 🔑 used for rules
    createdAt: serverTimestamp(),
    image: uploadResult,
    takenTime: takenTime,
    gps: gps,
    profile: profile
  };
  console.log("Saving doc to Firestore:", photoDoc);
  console.log("DB:", db);
  console.log("DB type:", typeof db);
  await setDoc(doc(db, "images", docId), photoDoc);
  console.log("Saved document to Firestore:", photoDoc);
  return docId;
}
