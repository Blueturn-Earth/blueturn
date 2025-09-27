import LivePlayer from './LivePlayer.js'
import Timer from './Timer.js'

export default class LiveTimer extends LivePlayer
{
    #timer;

    constructor(timer)
    {
        super("Timer");
        this.#timer = !timer ? (new Timer) : timer;
        this.#timer.addPlayCallback((timer) => {this.onPlayStateChange(timer.playState);})
        this.#timer.addTimeCallback((timer) => {this.onDelayChange(timer.delayFromLiveSec);}, 100)
    }

    setPlayState(playing) {
        this.#timer.playState = playing;
    }

    setDelay(delaySec) {
        var date = new Date(Date.now());
        date.setSeconds(date.getSeconds() - delaySec);
        this.#timer.date = date;
    }

    goLive() {
        this.#timer.live();
    }
}