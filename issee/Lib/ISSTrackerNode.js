/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * ISS Tracker Node
 * Copyright Michael Boccara, Blueturn - 2025
 */

import LivePlayerNode from "./LivePlayerNode.js"

export default class ISSTrackerNode extends LivePlayerNode
{
    #issTracker;

    constructor(elementId)
    {
        super(elementId);
        this.#issTracker = document.getElementById(elementId);
        window.addEventListener("message", (event)=>{
            if (event.data.type === "issDelay")
            {
                this.setDelay(event.data.delay);
            }
        });
    }

    setPlayState(playing) {
        if (!super.setPlayState(playing))
            return false;

        this.#updateISSTracker();

        return true;
    }

    setDelay(delaySec) {
        if (!super.setDelay(delaySec))
            return false;

        this.#updateISSTracker();

        return true;
    }

    #updateISSTracker() {
        this.#issTracker.contentWindow.postMessage(
            {
                type: "delay",
                delay: this.getDelay(), 
                play: this.getPlayState(), 
                map_scale: 1
            }, '*'
        );
    }
}

