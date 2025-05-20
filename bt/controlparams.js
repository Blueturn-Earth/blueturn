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
    // Uncomment and set the correct origin for security in production
    // if (event.origin !== "https://app.blueturn.earth") return; // security check

    // Log the origin and data for debugging
    console.log("Received message from origin:", event.origin, "data:", event.data);

    // Ensure event.data is an object and has a 'type' property
    if (typeof event.data === "object" && event.data !== null && "type" in event.data) {
        controlMap.forEach((cb, param) => {
            if (event.data.type === param) {
                console.log("Handling message: ", event.data);
                cb(event.data.value);
            }
        });
    } else {
        console.warn("Message received with unexpected format:", event.data);
    }
});