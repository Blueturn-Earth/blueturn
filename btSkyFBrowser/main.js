import React from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";


import { initFirebase, signInAnon } from "./firebase.js";
import { initGoogleAuth } from "./auth_google.js";
import { Gallery } from "./gallery.js";


function App() {
    React.useEffect(() => {
        async function init() {
        showLoading(true);

        await initFirebase();
        await signInAnon();
        initGoogleAuth();

        await initGallery();   // fetch first page
        showLoading(false);
        }

        init();
    }, []);

    return null;
}

export async function initGallery() {
  const docs = await loadFirstPage();
  renderGallery(docs);
}

function showLoading(show) {
  document.getElementById("loading").style.display =
    show ? "block" : "none";
}

async function handleDelete(item) {
    await requestGoogleAuth();

    if (!googleAccessToken || !googleProfile || googleProfile.sub != SUPER_USER_ID) {
        alert("You don't have permission to delete");
        return;
    }

    if (!confirm("Delete this image from DB?")) 
        return;
    //Don't delete from Drive
    /*
    try {
        // 1️⃣ delete Drive file (only if owner)
        if (item.image.provider === "GoogleDrive") {
            await deleteDriveFile(item.image.fileId);
        }
    }
    catch (e) {
        console.warn("Could not delete Drive file:", e);
    }
    */

    try {
        //console.log("Current Firebase user UID:", auth.currentUser?.uid);
        console.log("Deleting Firestore document:", item.id);
        // 2️⃣ delete Firestore document
        await deleteDoc(doc(db, "images", item.id));
        // Remove from local state
        setItems(prev => prev.filter(i => i.id !== item.id));
        setSelected(null);
    }
    catch (e) {
        console.error("Could not delete Firestore document:", e);
    }
}

let currentDoc = null;

export function handleOpen(doc) {
    const modal = document.getElementById("image-modal");
    const img = document.getElementById("modal-image");

    currentDoc = doc;

    img.src = doc.image.imageUrl;
    modal.classList.remove("hidden");

    // prevent background scroll
    document.body.style.overflow = "hidden";
}

function closeModal() {
    const modal = document.getElementById("image-modal");
    const img = document.getElementById("modal-image");

    modal.classList.add("hidden");
    img.src = "";

    document.body.style.overflow = "";
    currentDoc = null;
}

document.getElementById("modal-close")
  .addEventListener("click", closeModal);

document.querySelector("#image-modal .modal-backdrop")
  .addEventListener("click", closeModal);

window.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

const root = ReactDOM.createRoot(
  document.getElementById("react-root")
);

root.render(React.createElement(App));

// ReactDOM.createRoot(
//     document.getElementById("root")
// ).render(
//     React.createElement(Gallery, {
//         docs,
//         onOpen: handleOpen,
//         onDelete: handleDelete
//     })
// );

