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
    static group = new LiveGroup;
    #name;

    constructor(name)
    {
        super();
        this.#name = name;
        LivePlayer.group.addNode(this);
    }

    get name() {
        return this.#name;
    }
}

window.addDelay = (delaySec) => {LivePlayer.group.addDelay(delaySec);}
window.goLive = () => {LivePlayer.group.goLive();}