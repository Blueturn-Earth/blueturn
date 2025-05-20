export let gTimeSpeed = 3600;
export let gPlaying = true;
export let gDate = undefined;

let controlMap = new Map();
controlMap.set('timespeed', (v) => {gTimeSpeed = parseInt(v);});
controlMap.set('play', (v) => {gPlaying = parseInt(v);});
controlMap.set('date', (v) => {gDate = v;});

const urlParams = new URLSearchParams(window.location.search);

controlMap.forEach((cb, param, cmap) => {
    const paramValue = urlParams.get(param);
    if (paramValue === null)
        return;
    cb(paramValue);
});
