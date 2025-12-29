import React from "https://esm.sh/react@18";
import {
    collection,
    query,
    orderBy,
    limit,
    startAfter,
    getDocs,
    deleteDoc, 
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { deleteDriveFile } from "./drive.js";
import { requestGoogleAuth, googleAccessToken, googleProfile, SUPER_USER_ID } from "./auth_google.js";
import { db, auth } from "./firebase.js";


const PAGE_SIZE = 24;


export function Gallery({ docs, onOpen, onDelete }) {
    function observeImage(img) {
        const obs = new IntersectionObserver(
            ([entry]) => {
            if (!entry.isIntersecting) return;

            img.src = img.dataset.src;
            img.onload = () => {
                img.style.opacity = "1";
            };

            obs.disconnect();
            },
            { rootMargin: "300px" }
        );

        obs.observe(img);
    }

    function createTile(doc, {onOpen, onDelete}) 
    {
        const tpl = document.getElementById("tile-template");
        const el = tpl.cloneNode(true);

        el.style.display = "";
        el.id = "";

        // Elements
        const thumb = el.querySelector(".thumb");
        const full = el.querySelector(".full");
        const avatar = el.querySelector(".avatar");
        const ts = el.querySelector(".timestamp");
        const del = el.querySelector(".delete");

        // Thumbnail (always)
        thumb.src = doc.image.thumbnailUrl;

        // Progressive full image
        full.dataset.src = doc.image.imageUrl;
        full.style.opacity = "0";

        avatar.src = doc.profile.picture;
        ts.textContent = new Date(
            doc.createdAt.seconds * 1000
        ).toLocaleString();

        // Click handlers
        thumb.onclick = () => onOpen(doc);
        full.onclick = () => onOpen(doc);
        del.onclick = (e) => {
            e.stopPropagation();
            onDelete(doc);
        };

        return el;
    }

    React.useEffect(() => {
        const root = document.getElementById("gallery");
        if (!root) return;

        root.innerHTML = "";

        docs.forEach(doc => {
            const tile = createTile(doc, { onOpen, onDelete });
            root.appendChild(tile);

            const fullImg = tile.querySelector(".full");
            observeImage(fullImg);
        });
    }, [docs]);

    return null;
}
