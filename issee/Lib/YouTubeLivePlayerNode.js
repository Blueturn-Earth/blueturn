/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * YouTube Live Player Node
 * Copyright Michael Boccara, Blueturn - 2025
 */

import LivePlayerNode from "./LivePlayerNode.js"

// If running in a browser, ensure your script tag uses type="module":
// <script type="module" src="Lib/YouTubeLivePlayerNode.js"></script>
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
    YouTubeLivePlayerNode.apiReady = true;
    YouTubeLivePlayerNode.instances.forEach(instance => {
        instance._init();
    });
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function secStr(s, decimals = 3) 
{
    let thousands = Math.pow(10, decimals);
    return Math.round(s * thousands) / thousands;
};

export default class YouTubeLivePlayerNode extends LivePlayerNode
{
    static instances = [];
    static apiReady;
    #videoId;
    #elementId;
    #ytPlayer;
    #readyCheckIntervalId;
    #seekIntervalId;
    #next_expected_seek;

    // 300ms to consider it a jump, 
    // 300ms gets to be the max variance between players seek time 
    SEEK_THRESHOLD_MS = 300;
    SEEK_PERIOD_MS = 100;

    constructor(videoId, element)
    {
        super(element);
        this.#videoId = videoId;
        this.#elementId = element;
        const firstInstance = !YouTubeLivePlayerNode.instances.length;
        YouTubeLivePlayerNode.instances.push(this);
        if (firstInstance)
        {
            InitYoutubePlayerAPI();
        }
        else if(YouTubeLivePlayerNode.apiReady)
        {
            this._init();
        }
    }

    _init()
    {        
        this.#createPlayer();
    }

    #createPlayer()
    {
        if (this.#ytPlayer)
            return false;
        console.log("Create YT Player on element " + this.#elementId + " with video id " + this.#videoId);
        let self = this;
        this.#ytPlayer = new YT.Player(this.#elementId, {
            name: this.#elementId,
            videoId: this.#videoId,
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
                'onReady': function() {self._onYTPlayerReady();},
                'onStateChange': function(event) {self._onYTPlayerStateChange(event);}
            }
        });
        return true;
    }

    _onYTPlayerReady() 
    {
        console.log("EVENT: " + this.#elementId + " Ready");
        this.#ytPlayer.setPlaybackQuality('hd720');
        this.#ytPlayer.mute();
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
        if (
            !this.#ytPlayer ||
            !this.#ytPlayer.getCurrentTime() ||
            !this.#ytPlayer.getDuration()) {
            return;
        }

        console.log("this " + this.#elementId + ": Duration=" + this.#ytPlayer.getDuration() + "s, Current=" + this.#ytPlayer.getCurrentTime() + "s");
        clearInterval(this.#readyCheckIntervalId);
        this.#readyCheckIntervalId = 0;
        this.#startSeekJob();
    }

    setPlayState(playing) {
        if (!super.setPlayState(playing))
            return false;
        if (playing)
            this.#ytPlayer.playVideo();
        else
            this.#ytPlayer.pauseVideo();
        return true;
    }

    setDelay(delaySec) {
        if (!super.setDelay(delaySec))
            return false;
        const seek = this.#ytPlayer.getDuration() - delaySec;
        //this.#next_expected_seek = seek;
        console.log(this.#elementId + ": seekTo(" + seek + ")");
        this.#ytPlayer.seekTo(seek);
        return true;
    }

    _onYTPlayerStateChange(event)
    {
        console.assert(this.#ytPlayer == event.target);

        switch  (event.data) {
          case YT.PlayerState.PLAYING:
            console.log("EVENT: " + this.#elementId + " PLAYING");
            this.setPlayState(true);
            break;
          case YT.PlayerState.PAUSED:
            console.log("EVENT: " + this.#elementId + " PAUSED");
            this.setPlayState(false);
            break;
          case YT.PlayerState.BUFFERING:
            console.log("EVENT: " + this.#elementId + " BUFFERING");
            break;
          case YT.PlayerState.UNSTARTED:
            console.debug("EVENT: " + this.#elementId + " UNSTARTED");
            break;
          case YT.PlayerState.ENDED:
            console.debug("EVENT: " + this.#elementId + " ENDED");
            break;
          case YT.PlayerState.CUED:
            console.debug("EVENT: " + this.#elementId + " CUED");
            break;
          default:
            console.warn("Unrecognized EVENT on player " + this.#elementId + ": " + event.data);
            break;
          }
    }

    #startSeekJob()
    {
        var self = this;
        // Check seek every frame or so (40ms at 25Hz)
        this.#seekIntervalId = setInterval(
            function() {
                self.#checkSeek();
            }, 
            self.SEEK_PERIOD_MS); 
    }    

    #stopSeekJob()
    {
        if (this.#seekIntervalId)
        {
            clearInterval(this.#seekIntervalId); 
            this.#seekIntervalId = undefined;
        }
    }    

    #checkSeek()
    {
        let current_seek = this.#ytPlayer.getCurrentTime();

        if (!current_seek)
            return;

        let isJump = true;
        let diffSec = undefined;
        if (this.#next_expected_seek)
        {
            diffSec = current_seek - this.#next_expected_seek;
            isJump = (Math.abs(diffSec)*1000 >= this.SEEK_THRESHOLD_MS);
        }

        if (isJump)
        {
            if (diffSec == undefined)
            {
                console.log("EVENT: " + this.#elementId + " Detected First Seek " + secStr(current_seek));
            }
            else
            {
                console.log("EVENT: " + this.#elementId + " Detected Seek " + secStr(current_seek) + ", a jump of " + secStr(diffSec) + "s from " + secStr(this.#next_expected_seek));
                this.setDelay(this.#ytPlayer.getDuration() - current_seek);
            }
        }

        this.#next_expected_seek = current_seek
        if (this.#ytPlayer.getPlayerState() == YT.PlayerState.PLAYING)
        {
            this.#next_expected_seek += this.SEEK_PERIOD_MS / 1000;
        }
    }
}

