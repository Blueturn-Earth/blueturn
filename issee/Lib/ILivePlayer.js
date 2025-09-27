/*
 * LivePlayer
 * Copyright Michael Boccara, Blueturn - 2025
 */

// LivePlayer class
// A node in a group of LivePlayer instances
// It has a static list of other LivePlayer instances
// For example, when play() is called, it calls play() on all other nodes
// Takes care of avoiding edging cycles
export default class ILivePlayer {
    #playing = false;
    #delaySec = 0;

    setPlayState(playing) {
        if (this.#playing == playing)
            return false;
        this.#playing = playing;
        return true;
    }
    getPlayState() {return this.#playing;}
    
    // 300ms to consider it a jump, 
    // 300ms gets to be the max variance between players seek time 
    SEEK_THRESHOLD_MS = 300;

    setDelay(delaySec) {
        if (Math.abs(this.#delaySec - delaySec)*1000 < this.SEEK_THRESHOLD_MS)
            return false;
        this.#delaySec = delaySec;
        return true;
    }
    getDelay() {return this.#delaySec;}

    // utility
    addDelay(delayOffsetSec) {this.setDelay(this.#delaySec + delayOffsetSec);}
    goLive() {this.setDelay(0);}

}
