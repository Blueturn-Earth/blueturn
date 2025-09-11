/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Timer Class
 * Copyright Michael Boccara, Blueturn - 2017-2024
 */

class Timer {
    // private
    #date = new Date(Date.now());
    #dateWhenTaken = new Date(Date.now());
    #play = true;
    #timeCallbacks = [];
    #playCallbacks = [];
    #isLive = true;

    static secStr(s, decimals = 3) 
    {
        let thousands = Math.pow(10, decimals);
        return Math.round(s * thousands) / thousands;
    };

    get isLive() {return this.#isLive;}
    
    // public interface
    set date(t)
    {
        this.#date = t;
        this.#dateWhenTaken = new Date(Date.now());
        this.callAllTimeCallbacks();
        if (Math.abs(t - Date.now()) > 1000)
        {
            this.#isLive = false;
        }
    }

    get date()
    {
        if (this.#play)
        {
            let timeSinceItWasTakenInMs = new Date(Date.now()) - this.#dateWhenTaken;
            let returnedDate = new Date(this.#date);
            returnedDate.setMilliseconds(returnedDate.getMilliseconds() + timeSinceItWasTakenInMs);
            return returnedDate;
        }
        else
        {
            return this.#date;
        }
    }

    get delayFromLiveSec()
    {
        if (this.#isLive)
            return 0;
        return Math.floor((Date.now() - this.#date) / 1000);
    }

    set playState(p)
    {
        if (this.#play == p)
        {
            console.debug("Timer: already in play state " + p);
            return;
        }
        console.debug("Timer: Play State: " + p);
        // snap date when taken
        this.#date = this.date;
        this.#dateWhenTaken = new Date(Date.now());
        if (!p)
        {
            this.#isLive = false;
        }
        this.#play = p;
        this.callAllPlayCallbacks();
    }

    get playState()
    {
        return this.#play;
    }

    pause()
    {
        this.playState = false;
        this.#isLive = false;
    }

    play()
    {
        this.playState = true;
    }

    live() {
        const TIME_EPSILON_MS = 500;

        let nowDate = new Date(Date.now());
        let delta = nowDate - this.date;
        let isTimeJump = Math.abs(delta) > TIME_EPSILON_MS;
        if (this.#isLive || !isTimeJump)
        {
            return;
        }
        let moveStr = "";
        if (delta < 0) moveStr = "backward";
        if (delta > 0) moveStr = "forward";
        console.log("Timer: Live: " + nowDate + " (jumping " + Math.abs(delta) + "ms " + moveStr + " from " + this.date + ")");
        this.date = nowDate;
        this.#isLive = true;
        this.play();
    }

    addTimeCallback(cb, interval)
    {
        this.#timeCallbacks.push({cb:cb, interval:interval});
        if (interval)
        {
            console.log("Timer: Add time callback every interval of " + interval + "ms");
            setInterval(timer => {
                cb(timer);
            }, interval, this);
        }
    }

    callAllTimeCallbacks()
    {
        var t = this;
        this.#timeCallbacks.forEach(cbData => {
            cbData.cb(t);
        });
    }

    addPlayCallback(cb)
    {
        this.#playCallbacks.push(cb);
    }

    callAllPlayCallbacks()
    {
        var timer = this;
        this.#playCallbacks.forEach(cb => {
            cb(timer);
        });
    }
}
