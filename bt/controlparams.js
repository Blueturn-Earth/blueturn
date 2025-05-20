// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

import {gLoadEpicImagesForDate} from './epic.js';

export let gControlState = {
    timeSpeed: 3600,
    playing: true,
    date: undefined,
    showText: true,
    zoomEnabled: true,
    showZoomCircle: false
};

let controlMap = new Map();
controlMap.set('timespeed', (v) => {gControlState.timeSpeed = parseInt(v);});
controlMap.set('play', (v) => {gControlState.playing = parseInt(v);});
controlMap.set('date', (v) => {gControlState.date = v; gLoadEpicImagesForDate(gControlState.date)});
controlMap.set('showText', (v) => {gControlState.showText = parseInt(v);});
controlMap.set('zoomEnabled', (v) => {gControlState.zoomEnabled = parseInt(v);});
controlMap.set('showZoomCircle', (v) => {gControlState.showZoomCircle = parseInt(v);});

const urlParams = new URLSearchParams(window.location.search);

controlMap.forEach((cb, param) => {
    const paramValue = urlParams.get(param);
    if (paramValue === null)
        return;
    console.log("URL param: ", param, " = ", paramValue);
    cb(paramValue);
});

console.log("Listening to messages...");

window.addEventListener("message", (event) => {
    //if (event.origin !== "https://app.blueturn.earth") return; // security check
    //console.log("Received message: ", event.data);
    controlMap.forEach((cb, param) => {
        if (event.data.type === param) {
            console.log("Handling message: ", event.data);
            cb(event.data.value);
        }
    });
});
