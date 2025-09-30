/*
 * LivePlayer
 * Copyright Michael Boccara, Blueturn - 2025
 */

import ILivePlayer from './ILivePlayer.js'

// LivePlayer class
// A node in a group of LivePlayer instances
// It has a static list of other LivePlayer instances
// For example, when play() is called, it calls play() on all other nodes
// Takes care of avoiding edging cycles
export default class LiveGroup extends ILivePlayer {
    #nodes = [];

    addNode(node)
    {
        if (!(node instanceof ILivePlayer))
        {
            throw("Invalid node");
        }
        this.#nodes.push(node);
    }

    setPlayState(playing) {
        for (let node of this.#nodes) {
            node.setPlayState(playing);
        }
    }

    setDelay(delaySec) {
        for (let node of this.#nodes) {
            node.setDelay(delaySec);
        }
    }
    addDelay(delayOffsetSec) {
        for (let node of this.#nodes) {
            node.addDelay(delayOffsetSec);
        }
    }
    goLive() {
        for (let node of this.#nodes) {
            node.goLive();
        }
    }
}
