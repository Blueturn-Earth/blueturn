/*
 * LivePlayer
 * Copyright Michael Boccara, Blueturn - 2025
 */

import ILivePlayer from './ILivePlayer.js'
import LiveGroup from './LiveGroup.js'

// LivePlayer class
// A node in a group of LivePlayer instances
// It has a static list of other LivePlayer instances
// For example, when play() is called, it calls play() on all other nodes
// Takes care of avoiding edging cycles
export default class LivePlayer extends ILivePlayer {
    static group = new LiveGroup("Live Players Group");
    #name;
    #playing = false;
    #delaySec = 0;
    // 300ms to consider it a jump, 
    // 300ms gets to be the max variance between players seek time 
    SEEK_THRESHOLD_MS = 300;

    constructor(name)
    {
        super();
        this.#name = name;
        LivePlayer.group.addNode(this);
    }

    get name() {
        return this.#name;
    }

    setPlayState(playing) {
        if (this.#playing == playing)
            return false;
        this.#playing = playing;
        this._setPlayState(playing);
        return true;
    }
    getPlayState() {return this.#playing;}
    
    setDelay(delaySec) {
        if (Math.abs(this.#delaySec - delaySec)*1000 < this.SEEK_THRESHOLD_MS)
            return false;
        this.#delaySec = delaySec;
        this._setDelay(delaySec);
        return true;
    }
    getDelay() {return this.#delaySec;}

    // utility
    addDelay(delayOffsetSec) {
        this.setDelay(this.#delaySec + delayOffsetSec);
    }
    goLive() {
        this.setDelay(0);
        this.setPlayState(true);
    }
}

window.addDelay = (delaySec) => {LivePlayer.group.addDelay(delaySec);}
window.goLive = () => {LivePlayer.group.goLive();}