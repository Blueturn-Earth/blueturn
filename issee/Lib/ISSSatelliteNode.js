/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Satellite Live Player Node
 * Copyright Michael Boccara, Blueturn - 2025
 */

//import forEach from "for-each";
import LivePlayer from "./LivePlayer.js"

export default class ISSSatelliteNode extends LivePlayer
{
    satrec;
    listeners = [];
    periodMs = 1000;
    lastPosition;
    tle = 
    {
        ready: false,
        sat : "",
        L1 : "",
        L2 : ""
    };

    constructor(periodMs = 1000)
    {
        super("ISS Satellite Node");

        this.periodMs = periodMs;

        // fix binding
        this.loadTle(
            this.tleReady.bind(this), 
            this.tleError.bind(this));
    }

    _setPlayState(playing) 
    {
        if (playing) {
            this.requestLoop();
        }
        else {
            this.cancelLoop();
            this.updateLivePosition();
        }
    }

    _setDelay(delaySec) 
    {
        this.updateLivePosition();
    }

    addListener(cb) 
    {
        const listenerIndex = this.listeners.length;
        this.listeners.push(cb);
        return listenerIndex;
    }

    removeListener(index) 
    {
        this.listeners.splice(index, 1);
    }

    requestLoop() 
    {
        if (this.#loopId)
            return; // already running

        this.#loopId = setInterval(() => {
            this.updateLivePosition();
        }, this.periodMs);
    }

    cancelLoop() 
    {
        if (this.#loopId) {
            // cancel interval loop
            clearInterval(this.#loopId);
            this.#loopId = null;
        }
    }
    #loopId = null;

    loadTle(callbackOk, callbackError) 
    {
        console.log("Loading TLE...");
        let isst_xmlhttp = new XMLHttpRequest();
        isst_xmlhttp.onreadystatechange = function() {
            if (isst_xmlhttp.readyState == 4)
            {
                switch (isst_xmlhttp.status) {
                    case 0:
                        break;
                    case 200:
                        callbackOk(isst_xmlhttp.responseText);
                        return;
                        default:
                        callbackError();
                        break;
                }
            }
        };
        //const tle_url = 'http://wsn.spaceflight.esa.int/iss/tledata.txt';
        //const tle_url = 'https://isstracker.spaceflight.esa.int/tledata.txt';
        //const tle_url = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544';
        const tle_url = 'https://api.wheretheiss.at/v1/satellites/25544/tles?format=text';
        isst_xmlhttp.open('GET', tle_url);
        isst_xmlhttp.send();                
    }

    tleReady(tleData) 
    {
        var tle_eles = tleData.split('\n');
        this.tle.sat = tle_eles[0];
        this.tle.L1 = tle_eles[1];
        this.tle.L2 = tle_eles[2];
        this.tle.ready = true;
        console.log("TLE: " + this.tle.sat + "\n" + this.tle.L1 + "\n" + this.tle.L2);

        this.satrec = satellite.twoline2satrec(
            this.tle.L1.trim(), 
            this.tle.L2.trim()
        );

        this.updateLivePosition();

        if (this.getPlayState()) {
            this.requestLoop();
        }
    }

    tleError() 
    {
        console.warn("Failed to load TLE, using default");
        var tle = "ISS (ZARYA)\n1 25544U 98067A   18197.23268516  .00001143  00000-0  24639-4 0  9996\n2 25544  51.6395 233.9354 0003899 320.6076 211.2954 15.53978402123030";
        this.tleReady(tle);
    }

    updateLivePosition()
    {
        if (!this.tle.ready)
        {
            console.warn("TLE not ready yet");
            return null;
        }
        
        // Get the position of the satellite at the given date
        let date = new Date();
        // subtract delay (keep a Date object, avoid numeric conversion that produced NaN)
        const delay = this.getDelay();
        if (delay > 0) {
            date = new Date(date.getTime() - delay * 1000);
        }

        const positionAndVelocity = satellite.propagate(this.satrec, date);
        const gmst = satellite.gstime(date);
        const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

        this.listeners.forEach((cb) => {cb(this, position)});

        this.lastPosition = position;
        return this.lastPosition;
    }

    getLastPosition() {
        return this.lastPosition;
    }

}

