// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyCrF263rcJ3fyNyQtnfSSwPg4U-jvUeEYg",
    authDomain: "blueturnskyphotos.firebaseapp.com",
    projectId: "blueturnskyphotos",
    storageBucket: "blueturnskyphotos.firebasestorage.app",
    messagingSenderId: "903849020310",
    appId: "1:903849020310:web:459beba9eeb829194bebb7",
    measurementId: "G-BK6RXHKBR3"
};

let app;

try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase app initialized");
} catch (e) {
    console.warn("Firebase app initialization error:", e);
    app = null;
}

export { app };
