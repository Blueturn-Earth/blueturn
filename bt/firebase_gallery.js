import {
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import { db } from "./firebase_db.js";
import { ensureAuthReady } from "./firebase_auth.js";

const gallery = document.getElementById("gallery");

async function deletePhoto(docId, storageFileId, cardEl, deleteStorageToo, deleteStorageCb) {
  if (!confirm("Delete this entry?")) return;

  try {
    if (deleteStorageToo && deleteStorageCb) {
      await deleteStorageCb(storageFileId);
    }

    await deleteDoc(doc(db, "photos", docId));

    cardEl.remove();
  } catch (e) {
    alert("Delete failed");
    console.error(e);
  }
}

function makeCard(docId, data, currentStorageUserId, deleteStorageCb) {
  const div = document.createElement("div");
  div.className = "card";

  const canDeleteFirestore =
    data.profile.sub === currentStorageUserId ||
    isSuperUser(currentStorageUserId);

  const canDeleteStorage =
    data.profile.sub === currentStorageUserId;

  div.innerHTML = `
    <div class="thumb">
      <img src="${data.image.thumbnailUrl}">
      <div class="actions">
        <button onclick="window.open('${data.image.imageUrl}', '_blank')">
          Open
        </button>
        ${
          canDeleteFirestore
            ? `<button class="danger">Delete</button>`
            : ``
        }
      </div>
      <div>${new Date(data.createdAt.seconds * 1000).toLocaleString()}</div>
      <div>User: ${data.profile.sub}</div>
    </div>
  `;

  if (canDeleteFirestore) {
    div.querySelector(".danger").onclick =
      () => deletePhoto(
        docId,
        data.image.fileId,
        div,
        canDeleteStorage,
        deleteStorageCb
      );
  }

  return div;
}

const SUPER_USER_ID = "115698886322844446345";

function isSuperUser(storageUserId) {
  return storageUserId === SUPER_USER_ID;
}

export async function loadGalleryFiltered(myStorageUserId, deleteStorageCb) {
  if (!db) {
    console.warn("No Firestore DB available, skipping gallery");
    return;
  }

  await ensureAuthReady();

  gallery.innerHTML = "";

  let q;

  if (!myStorageUserId || isSuperUser(myStorageUserId)) {
    q = query(
      collection(db, "images"),
      orderBy("createdAt", "desc")
    );
  } else {
    q = query(
      collection(db, "images"),
      where("profile.sub", "==", myStorageUserId),
      orderBy("createdAt", "desc")
    );
  }

  let snap;
  try {
    snap = await getDocs(q);
  } catch (e) {
    console.error("Error fetching gallery documents:", e);
    gallery.innerHTML = `<div class="error">Error loading gallery.</div>`;
    return;
  }

  console.log("Gallery documents fetched:", snap.size);
  snap.forEach(d => {
    gallery.appendChild(
      makeCard(d.id, d.data(), myStorageUserId, deleteStorageCb)
    );
  });
  console.log("Gallery children:", gallery.children.length);
}

