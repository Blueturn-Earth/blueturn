import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


export let app;
export let auth;
export let db;


export async function initFirebase() {
    app = initializeApp({
        apiKey: "AIzaSyCrF263rcJ3fyNyQtnfSSwPg4U-jvUeEYg",
        authDomain: "blueturnskyphotos.firebaseapp.com",
        projectId: "blueturnskyphotos",
        storageBucket: "blueturnskyphotos.firebasestorage.app",
        messagingSenderId: "903849020310",
        appId: "1:903849020310:web:459beba9eeb829194bebb7",
        measurementId: "G-BK6RXHKBR3"
    });


    auth = getAuth(app);
    db = getFirestore(app);
}


export async function signInAnon() {
    await signInAnonymously(auth);
}