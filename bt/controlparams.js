export let gTimeSpeed = 3600;
export let gPlaying = true;
export let gDate = undefined;

let controlMap = new Map();
controlMap.set('timespeed', (v) => {gTimeSpeed = parseInt(v);});
controlMap.set('play', (v) => {gPlaying = parseInt(v);});
controlMap.set('date', (v) => {gDate = v;});

const urlParams = new URLSearchParams(window.location.search);

controlMap.forEach((cb, param) => {
    const paramValue = urlParams.get(param);
    if (paramValue === null)
        return;
    cb(paramValue);
});

window.addEventListener("message", (event) => {
    //if (event.origin !== "https://app.blueturn.earth") return; // security check
    console.log("Received message: ", event.data);
    controlMap.forEach((cb, param) => {
        if (event.data.type === param) {
            console.log("Handling message: ", event.data);
            cb(event.data.value);
        }
    });
});