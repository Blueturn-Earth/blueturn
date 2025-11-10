/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Satellite Live Player Node
 * Copyright Michael Boccara, Blueturn - 2025
 */

import ISSSatelliteNode from "./ISSSatelliteNode.js";

export default class WindyUpdater
{
    #windyIframe;
    #satelliteNode = new ISSSatelliteNode(5000);
    #windyThresLatLon = 10; // degrees

    constructor(windyIframe)
    {
        this.#windyIframe = windyIframe;
        this.#satelliteNode.addListener((node, position) => {
            this.updateWindy(position);
        });
    }

    update()
    {
        this.#satelliteNode.updateLivePosition();
    }

    updateWindy(position)
    {
        // Update Windy only if moved enough
        const lastPosition = this.#satelliteNode.getLastPosition();
        if (!lastPosition || !position ||
            Math.abs(position.latitude - lastPosition.latitude) > this.#windyThresLatLon || 
            Math.abs(position.longitude - lastPosition.longitude) > this.#windyThresLatLon)
        {
            if (!position) 
            {
                if (!lastPosition) {
                    console.warn("No last position available");
                    return; // no position at all
                }
                position = lastPosition;
            }
            console.log("Updating Windy to lat:", position.latitude, "lon:", position.longitude);
            this.#windyIframe.src = "https://embed.windy.com/embed.html?lat=" + position.latitude + "&lon=" + position.longitude + "&zoom=2&type=map&overlay=satellite";
        }
    }   
}