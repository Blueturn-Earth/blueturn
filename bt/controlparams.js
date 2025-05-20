export let gControlState = {
    timeSpeed: 3600,
    playing: true,
    date: undefined
};

let controlMap = new Map();
controlMap.set('timespeed', (v) => {gControlState.timeSpeed = parseInt(v);});
controlMap.set('play', (v) => {gControlState.playing = parseInt(v);});
controlMap.set('date', (v) => {gControlState.date = v;});

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
