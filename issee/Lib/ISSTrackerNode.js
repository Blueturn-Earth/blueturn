/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * ISS Tracker Node
 * Copyright Michael Boccara, Blueturn - 2025
 */

import LivePlayer from "./LivePlayer.js"

export default class ISSTrackerNode extends LivePlayer
{
    #issTracker;

    constructor(elementId)
    {
        super(elementId);
        this.#issTracker = document.getElementById(elementId);
        window.addEventListener("message", (event)=>{
            if (event.data.type === "issDelay")
            {
                LivePlayer.group.setDelay(event.data.delay);
            }
        });
    }

    _setPlayState(playing) {
        this.#issTracker.contentWindow.postMessage(
            {
                type: "delay",
                delay: this.getDelay(), 
                play: playing, 
                map_scale: 1
            }, '*'
        );
    }

    _setDelay(delaySec) {
        this.#issTracker.contentWindow.postMessage(
            {
                type: "delay",
                delay: delaySec, 
                play: this.getPlayState(), 
                map_scale: 1
            }, '*'
        );
    }
}

