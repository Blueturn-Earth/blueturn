// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

export let gControlState = {
    source: 'bt-s3',
    speed: 3600,
    play: true,
    day: undefined,
    time: undefined,
    range: undefined,
    showText: true,
    zoom: undefined,
    // internal state
    holding: false,
    jump: false,
    jumping: false,
    snapping: false,
    blockSnapping: false
};

export let gControlMap = new Map();
gControlMap.set('source', (v) => {gControlState.source = v;}); // 'nasa', 'bt-s3', 'bt-cdn'
gControlMap.set('speed', (v) => {gControlState.speed = parseInt(v);});
gControlMap.set('play', (v) => {gControlState.play = parseInt(v) != 0;});
gControlMap.set('day', (v) => {gControlState.day = v; gControlState.jump = true;});
gControlMap.set('time', (v) => {gControlState.time = v; gControlState.jump = true;});
gControlMap.set('range', (v) => {gControlState.range = parseInt(v) * 24 * 3600;});
gControlMap.set('showText', (v) => {gControlState.showText = parseInt(v) != 0;});
gControlMap.set('zoom', (v) => {gControlState.zoom = v;});

const urlParams = new URLSearchParams(window.location.search);

gControlMap.forEach((cb, param) => {
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
    gControlMap.forEach((cb, param) => {
        if (event.data.type === param) {
            console.log("Handling message: ", event.data);
            cb(event.data.value);
        }
    });
});

(function detectParentAndSendToGA() {
    try {
    const referrer = document.referrer; // This is the URL of the parent site
    //console.log("Analytics: parent URL: " + referrer);
    if (referrer) {
        // Send as custom event
        gtag('event', 'iframe_loaded', {
        'parent_url': referrer
        });
    }
    } catch (e) {
    console.warn('Analytics: Unable to detect parent:', e);
    }
})();
