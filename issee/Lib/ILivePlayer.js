/*
 * LivePlayer
 * Copyright Michael Boccara, Blueturn - 2025
 */

// ILivePlayer interface
export default class ILivePlayer {
    setPlayState(playing) {throw("Not implemented"); return false;}
    getPlayState() {throw("Not implemented"); return false;}
    setDelay(delaySec) {throw("Not implemented"); return false;}
    getDelay() {throw("Not implemented"); return 0;}
    addDelay(delayOffsetSec) {throw("Not implemented");}
    goLive() {throw("Not implemented");}
}
