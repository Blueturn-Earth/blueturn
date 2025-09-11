/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Stereo YouTube Live Player
 * Copyright Michael Boccara, Blueturn - 2017-2024
 */

function InitYoutubePlayerAPI() 
{
    console.log("Waiting for Youtube Player API...");
    let tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    let firstScriptTag = document.getElementsByTagName('script')[0];
    if(firstScriptTag)
    {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    else
    {
      document.getElementsByTagName('head')[0].appendChild(tag);
    }
}

// Main YouTube API callback, don't change the name!
function onYouTubeIframeAPIReady() 
{
    console.log("EVENT: YouTube I-Frame API Ready");
    Timer.yt = {initialized: true};
    if (MultiPlayer.instance)
        MultiPlayer.instance._init();
}


class MultiPlayer
{
    static instance = undefined;
    #videoId = undefined;
    #players = [];
    #delay_s = 0;
    #timer = undefined;
    #isLive = true;
    #onUpdate = undefined;
    #ready = false;
    #readyCheckIntervalId = undefined;
    #totalStepRequest = 0;

    // 300ms to consider it a jump, 
    // 300ms gets to be the max variance between players seek time 
    SEEK_THRESHOLD_MS = 300;
    SEEK_PERIOD_MS = 100;

    // Breathe time before going live
    #GO_LIVE_DELAY_MS = 500;

    constructor(videoId, timer, elements, delay_s, onUpdate = undefined)
    {
        this.#videoId = videoId;
        this.#delay_s = delay_s;
        this.#onUpdate = onUpdate;
        for (let i = 0; i < elements.length; i++)
            this.#players.push({element:elements[i], name:elements[i].id, index:i});
        this.#timer = timer;

        if (!MultiPlayer.instance)
        {
            MultiPlayer.instance = this;
            InitYoutubePlayerAPI();
        }
        else
        {
            this._init();
        }
    }

    _init()
    {        
        this.#createPlayer();
    }

    #createPlayer(index = 0)
    {
        let player = this.#players[index];
        if (player.ytPlayer)
            return false;
        let self = this;
        console.log("Create YT Player " + player.name + " with video id " + self.#videoId);
        player.delay_s = this.#delay_s * index;
        player.ytPlayer = new YT.Player(player.element, {
            name: player.name,
            videoId: self.#videoId,
            playerVars: { 
                'autoplay': 1, 
                'fs': 0, 
                'cc_load_policy': 0, 
                'iv_load_policy': 0, 
                'loop': 0, 
                'enablejsapi': 1, 
                'modestbranding': 1, 
                'controls': 1, 
                'autohide': 1, 
                'wmode':'opaque' 
            },
            events: {
                'onReady': function() {self._onYTPlayerReady(player);},
                'onStateChange': function(event) {self._onYTPlayerStateChange(player, event);}
            }
        });
        return true;
    }

    _onYTPlayerReady(player) 
    {
        console.log("EVENT: " + player.name + " Ready");
        player.ytPlayer.setPlaybackQuality('hd720');
        player.ytPlayer.mute();
        player.ready = true;

        let next_index = player.index + 1;
        if (next_index < this.#players.length)
        {
            this.#createPlayer(next_index);
            return;
        }
        console.log("All players ready");
        let self = this;
        this.#readyCheckIntervalId = setInterval(
            function() {
                self.#checkIfFullyReady();
            },
            this.SEEK_PERIOD_MS
        );
    }

    #checkIfFullyReady()
    {
        let allPlayersAreFullyReady = true;
        let self = this;
        this.#players.forEach(p => {
            if (
                !p.ytPlayer ||
                !p.ytPlayer.getCurrentTime() ||
                !p.ytPlayer.getDuration()) {
                allPlayersAreFullyReady = false;
                return;
            }

            console.log("player " + p.name + ": Duration=" + p.ytPlayer.getDuration() + "s, Current=" + p.ytPlayer.getCurrentTime() + "s");

            console.log("All players ready");
        });

        if (!allPlayersAreFullyReady)
            return;

        this.#ready = true;
        clearInterval(this.#readyCheckIntervalId);
        this.#readyCheckIntervalId = 0;

        console.log("All players are fully ready");
        this.goLive(this.#GO_LIVE_DELAY_MS);
        this.#players.forEach(p => {
            self.#startSeekJob(p);
        });
    }

    goLive(postpone_ms)
    {
        this.#isLive = true;

        if (postpone_ms)
        {
            let self = this;
            setTimeout(function() {self.goLive();}, postpone_ms);
            return;
        }

        let player = this.#players[0];
        let duration = player.ytPlayer.getDuration();
        if (duration <= 0)
        {
            console.warn("Player " + player.name + " is not really ready - getDuration() returned " + duration);
            this.goLive(this.#GO_LIVE_DELAY_MS);
            return;
        }

        if (this.delay_s)
        {
            console.log(`Set delay ${this.delay_s} from live`);
            duration -= this.delay_s;
            this.#timer.play();
        }
        else
        {
            console.log("Going live");
            this.#timer.live();
        }
        this.#players[0].ytPlayer.seekTo(duration);
    }

    #startSeekJob(player)
    {
        var self = this;
        // React to shared timer changes
        this.#timer.addPlayCallback(t => {self._onTimerPlayStateChange(t);});
        this.#timer.addTimeCallback(t => {self._onTimerDateChange(t.date);});
        // Check seek every frame or so (40ms at 25Hz)
        player.seekIntervalId = setInterval(
            function() {
                self.#checkSeek(player);
            }, 
            self.SEEK_PERIOD_MS); 
    }    

    #stopSeekJob(player)
    {
        if (player.seekIntervalId)
        {
            clearInterval(player.seekIntervalId); 
            player.seekIntervalId = undefined;
        }
    }    

    #checkSeek(player)
    {
        let current_seek = player.ytPlayer.getCurrentTime();

        if (!current_seek)
            return;

        let isJump = true;
        let diffSec = undefined;
        if (player.next_expected_seek)
        {
            diffSec = current_seek - player.next_expected_seek;
            isJump = (Math.abs(diffSec)*1000 >= this.SEEK_THRESHOLD_MS);
        }

        if (isJump)
        {
            if (diffSec == undefined)
            {
                console.log("EVENT: " + player.name + " Detected First Seek " + Timer.secStr(current_seek));
            }
            else
            {
                console.log("EVENT: " + player.name + " Detected Seek " + Timer.secStr(current_seek) + ", a jump of " + Timer.secStr(diffSec) + "s from " + player.next_expected_seek);
            }
            this.#onSeek(player);
        }

        player.next_expected_seek = current_seek
        if (player.ytPlayer.getPlayerState() == YT.PlayerState.PLAYING)
        {
            player.next_expected_seek += this.SEEK_PERIOD_MS / 1000;
        }
    }

    _onYTPlayerStateChange(player, event)
    {
        console.assert(player.ytPlayer == event.target);

        switch  (event.data) {
          case YT.PlayerState.PLAYING:
            console.log("EVENT: " + player.name + " PLAYING");
            this.#playAll(player);
            break;
          case YT.PlayerState.PAUSED:
            console.log("EVENT: " + player.name + " PAUSED");
            this.#pauseAll(player);
            break;
          case YT.PlayerState.BUFFERING:
            console.log("EVENT: " + player.name + " BUFFERING");
            //this.#pauseAll(player);
            break;
          case YT.PlayerState.UNSTARTED:
            console.debug("EVENT: " + player.name + " UNSTARTED");
            break;
          case YT.PlayerState.ENDED:
            console.debug("EVENT: " + player.name + " ENDED");
            break;
          case YT.PlayerState.CUED:
            console.debug("EVENT: " + player.name + " CUED");
            break;
          default:
            console.warn("Unrecognized EVENT on player " + player.name + ": " + event.data);
            break;
          }
    }

    #onSeek(sourcePlayer)
    {
        let currentTime = sourcePlayer.ytPlayer.getCurrentTime();

        if (currentTime == 0)
            return;

        if (sourcePlayer == this.#players[0])
            this.#totalStepRequest = 0;

        // If in live mode, calculate the sync function between Timer and Youtube players
        let duration = sourcePlayer.ytPlayer.getDuration();
        if (this.#isLive)
        {
            if(!Timer.yt.convert)
            {
                let current_date = this.#timer.date;
                console.log("***SYNC***: LIVE SYNC (by " + sourcePlayer.name + "): seek=" + Timer.secStr(currentTime) + "s | date: " + current_date);

                Timer.yt.convert = {
                    getSeekFromDate: function(date) {return (date.getTime() - current_date.getTime()) / 1000 + currentTime;},
                    getDateFromSeek: function(seekValue) {let d = new Date(); d.setTime((seekValue - currentTime) * 1000 + current_date.getTime()); return d;}
                };
            }
        }

        // Calculate time variance between Youtube players
        {
            Timer.yt.range = {
                min_seek : currentTime,
                max_seek : currentTime
            };
            let numReadyPlayers = 0;
            this.#players.forEach(player => {
                let seek = player.ytPlayer.getCurrentTime();
                if (!seek)
                    return;
                numReadyPlayers++;
                if (seek < Timer.yt.range.min_seek) Timer.yt.range.min_seek = seek;
                if (seek > Timer.yt.range.max_seek) Timer.yt.range.max_seek = seek;
            });
            if (numReadyPlayers >= 2)
            {
                let sync_delta_s = Timer.yt.range.max_seek - Timer.yt.range.min_seek;
                console.log("SYNC: DELTA (" + numReadyPlayers + ")= " + Timer.secStr(sync_delta_s) + "s");
            }
        }

        // Synchronize players directly
        let self = this;
        this.#players.forEach(player => {
            if (player == sourcePlayer)
                return;
            let player_seek = currentTime - (player.delay_s - sourcePlayer.delay_s);
            console.log("CALL: Seek other player " + player.name + " to " + Timer.secStr(player_seek) + "s (delay=" + player.delay_s + "s)");
            player.ytPlayer.seekTo(player_seek);
        });

        // Synchronize the timer from first player only
        if (sourcePlayer.index == 0)
        {
            if (Timer.yt && Timer.yt.convert && Timer.yt.convert.getDateFromSeek)
            {
                let source_date = Timer.yt.convert.getDateFromSeek(currentTime);
                console.log("SYNC: Set Timer to = " + source_date);
                this.#timer.date = source_date;
            }
        }

        if (this.#ready)
            this.#update();
    }

    #update()
    {
        if (this.#onUpdate)
        {
            this.#onUpdate();
        }
    }

    #playAll(sourcePlayer)
    {        
        var self = this;

        if (sourcePlayer.index == 0)
        {
            this.#timer.play();
        }

        this.#players.forEach(player => {
            if (player == sourcePlayer)
                return;

            if (!player.ready || !player.ytPlayer || !player.ytPlayer.playVideo)
            {
                console.warn("Other player " + player.name + " not ready yet");
                return;
            }

            console.debug("CALL: Play other player " + player.name);
            player.ytPlayer.playVideo();  
        });
    }

    #pauseAll(sourcePlayer)
    {
        this.#players.forEach(player => {
            if (player == sourcePlayer)
                return;
            if (player.ytPlayer)
            {
                console.debug("CALL: Pause other player " + player.name);
                player.ytPlayer.pauseVideo();  
            }
        });

        if (sourcePlayer.index == 0)
        {
            this.#timer.pause();
        }            
    }


    _onTimerPlayStateChange(timer)
    {
        if (this.#timer != timer)
        {
            console.error("Inconsistent event timer");
            return;
        }
        
        console.log("EVENT: Timer Play State: " + this.#timer.playState);
        let player = this.#players[0];
        if (this.#timer.playState)
        {
            player.ytPlayer.playVideo();
        }
        else
        {
            player.ytPlayer.pauseVideo();
        }    
    }

    _onTimerDateChange(date)
    {
        if (!Timer.yt || !Timer.yt.convert)
        {
          console.warn("Cannot process timer event, as no completed live sync yet");
          return;
        }

        let live_date = new Date();
        let live_delay_s = (live_date - date) / 1000;        
        console.log("EVENT: Timer Date changed to Live-" + live_delay_s + "s : " + date);

        let date_seek = Timer.yt.convert.getSeekFromDate(date);
                
        let player = this.#players[0];
        let current_seek = player.ytPlayer.getCurrentTime();
        if (Math.abs(date_seek - current_seek) * 1000 < this.SEEK_THRESHOLD_MS)
            return;
        console.debug("CALL: Seek player " + player.name + " to " + date_seek);
        player.ytPlayer.seekTo(date_seek);
    }

    set delay_s(d)
    {
        this.#delay_s = d;
        let self = this;
        this.#players.forEach(player => {
            player.delay_s = self.#delay_s * player.index;
        });
    }

    get delay_s()
    {
        return this.#delay_s;
    }

    get playerState()
    {
        return this.#players[0].ytPlayer.getPlayerState();
    }

    get currentTime()
    {
        return this.#players[0].ytPlayer.getCurrentTime();
    }

    get duration()
    {
        return this.#players[0].ytPlayer.getDuration();
    }

    goBackward(step_s)
    {
        let player = this.#players[0];
        this.#isLive = false;
        this.#totalStepRequest -= step_s;
        player.ytPlayer.seekTo(player.ytPlayer.getCurrentTime() + this.#totalStepRequest);
    }

    goForward(step_s)
    {
        let player = this.#players[0].ytPlayer;
        this.#totalStepRequest += step_s;
        player.seekTo(player.getCurrentTime() + this.#totalStepRequest);
    }

    setLiveDelay(liveDelay)
    {
        let player = this.#players[0].ytPlayer;
        console.log("Multiplayer: Set live delay " + liveDelay + " seconds to player " + player.name);
        player.seekTo(player.getDuration() - liveDelay);
        player.playVideo();
    }
}

