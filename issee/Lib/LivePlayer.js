/*
 * LivePlayer
 * Copyright Michael Boccara, Blueturn - 2025
 */

// LivePlayer class
// A node in a group of LivePlayer instances
// It has a static list of other LivePlayer instances
// For example, when play() is called, it calls play() on all other nodes
// Takes care of avoiding edging cycles
export default class LivePlayer {
    static #allNodes = [];
    #name;
    #playing = false;
    #delaySec = 0;

    // 300ms to consider it a jump, 
    // 300ms gets to be the max variance between players seek time 
    SEEK_THRESHOLD_MS = 300;

    constructor(name)
    {
        this.#name = name;
        LivePlayer.#allNodes.push(this);
    }

    get name() {
        return this.#name;
    }
    
    setPlayState(playing) {throw "Not implemented";}

    setDelay(delaySec) {throw "Not implemented";}
    
    onPlayStateChange(playing) {
        if (this.#playing == playing)
            return;
        this.#playing = playing;
        for (let node of LivePlayer.#allNodes) {
            if (node != this)
            {
                node.#playing = playing;
                node.setPlayState(playing);
            }
        }
    }

    getPlayState() {
        return this.#playing;
    }

    onDelayChange(delaySec) {
        if (Math.abs(this.#delaySec - delaySec)*1000 < this.SEEK_THRESHOLD_MS)
            return;
        this.#delaySec = delaySec;
        for (let node of LivePlayer.#allNodes) {
            if (node != this)
            {
                node.#delaySec = delaySec;
                node.setDelay(delaySec);
            }
        }
    }

    getDelay() {
        return this.#delaySec;
    }
}
