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

import { db, auth } from "./firebase.js";


const PAGE_SIZE = 24;


export function Gallery() {
    const [items, setItems] = React.useState([]);
    const [lastDoc, setLastDoc] = React.useState(null);
    const [hasMore, setHasMore] = React.useState(true);
    const [loading, setLoading] = React.useState(false);
    const [selected, setSelected] = React.useState(null);


    const sentinelRef = React.useRef();


    async function loadNext() {
        if (loading || !hasMore) return;
        setLoading(true);


        let q = query(
            collection(db, "images"),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );


        if (lastDoc) q = query(q, startAfter(lastDoc));


        const snap = await getDocs(q);


        if (snap.empty) {
            setHasMore(false);
            setLoading(false);
            return;
        }


        setItems(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setLoading(false);
    }

    React.useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => e.isIntersecting && loadNext(),
            { rootMargin: "300px" }
        );


        if (sentinelRef.current) obs.observe(sentinelRef.current);
            return () => obs.disconnect();
    }, [lastDoc, hasMore]);

    console.log("Gallery render, items:", items.length, "hasMore:", hasMore, "selected:", selected);

    return React.createElement(
        "div",
        { id: "gallery" },

        // tiles
        ...items.map(doc =>
            console.log("Rendering gallery item:", doc) ||
            React.createElement(
                "div",
                { className: "tile", key: doc.id },

                React.createElement("img", {
                    className: "thumb",
                    src: doc.image.thumbnailUrl,
                    loading: "lazy",
                    onClick: () => setSelected(doc)
                }),

                React.createElement("img", {
                    className: "avatar",
                    src: doc.profile.picture
                }),

                React.createElement(
                    "button",
                    { 
                        className: "delete", 
                        onClick: () => handleDelete(doc) 
                    },
                    "×"
                ),

                React.createElement(
                    "div",
                    { className: "timestamp" },
                    new Date(doc.createdAt.seconds * 1000).toLocaleString()
                ),

                doc.gps ?
                    React.createElement(
                        "div",
                        { className: "gps" },
                        `GPS: lat:${doc.gps.lat.toFixed(5)}` + 
                        `, lon:${doc.gps.lon.toFixed(5)}` + 
                        (doc.gps.alt ? `, alt:${doc.gps.alt.toFixed(1)}m` : "")
                    ) : 
                    null
            )
        ),

        // sentinel
        hasMore ? 
            React.createElement("div", { ref: sentinelRef }) : 
            null,
        
        selected ? 
            console.log("Showing modal for selected item:", selected) ||
            React.createElement(
                "div",
                {
                    className: "modal-backdrop",
                    onClick: () => setSelected(null)
                },
                React.createElement(
                    "div",
                    {
                        className: "modal-content",
                        onClick: e => e.stopPropagation()
                    },
                    React.createElement("img", {
                        className: "modal-image",
                        //src: selected.image.imageUrl
                        src: selected.image.thumbnailUrl + "&sz=w1600"
                        //src: `https://drive.google.com/file/d/${selected.image.fileId}`
                        //src: `https://drive.google.com/uc?id=${selected.image.fileId}`
                    }),
                    React.createElement(
                        "button",
                        {
                            className: "modal-close",
                            onClick: () => setSelected(null)
                        },
                        "✕"
                    )
                )
            ) : 
            null
    );

    async function handleDelete(item) {
        if (!confirm("Delete this image from DB?")) return;
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
}