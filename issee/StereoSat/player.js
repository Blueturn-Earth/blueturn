/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Dual ISS Player
 * Copyright Michael Boccara, Blueturn - 2017-2024
 */

var timer = new Timer();

let VIDEO_ID = 
	//"iYmvCUonukw"; // ISS front live HD
	"yf5cEJULZXk"; // ISS topdown live HD
	//"xRPjKQtRXR8"; // afarTV

var urlParams = new URLSearchParams(window.location.search);
videoIdParam = urlParams.get("v");
if (videoIdParam)
{
	VIDEO_ID = videoIdParam;
	console.log("Using video ID from URL param: " + VIDEO_ID);
}

let DELAY_S = 15;
var multiPlayer = new MultiPlayer(
	VIDEO_ID, 
	timer, 
	[playerLeft, playerRight], 
	DELAY_S,
	function() {UpdateISSTracker();});

document.addEventListener("visibilitychange", function() {
  console.log( "EVENT: Visibility change = " + document.visibilityState );
});

const DEFAULT_MONO_VALUE = 0;
const DEFAULT_PARALLAX_TIME_OFFSET = -14;
const DEFAULT_ROTATION_ANGLE = -6;
const DEFAULT_HORIZONTAL_PAN = 20;
const DEFAULT_SCALE = 11;
const DEFAULT_ISS_TRACKER_SCALE = 1;
const MAX_ISS_TRACKER_SCALE = 4.36;

var monoValue = DEFAULT_MONO_VALUE;
var videoRotationAngle = DEFAULT_ROTATION_ANGLE;
var videoPanXpc = DEFAULT_HORIZONTAL_PAN;
var videoScale = DEFAULT_SCALE;
var issTrackerScale = DEFAULT_ISS_TRACKER_SCALE;
var issTrackerDelay = 0;

var startTime = -1;
var endTime = -1;
var showUI = true;
var showISSTracker = true;

var urlParams = new URLSearchParams(window.location.search);

var monoInput = document.getElementById("monoValueRangeInput");
monoInput.value = monoValue;
//monoInput.oninput();

applyShowISSTracker();
setISSTrackerScale(issTrackerScale);

window.addEventListener( "keypress", doKeyDown, false )

function doKeyDown(e)
{
	//console.log("Pressed key " + e.keyCode);
	
	switch (e.keyCode)
	{
		case 117: // U
			toggleUI();			
			break;
	}
}

setFullISSTrackerScale();
applyShowUI();
UpdateVideoTransform();

function UpdateISSTracker()
{
	end_t = multiPlayer.duration;
	if (end_t == 0)
	{
		console.log("Multi-Player is not completely ready yet, no duration");
		return;
	}
	
	t = multiPlayer.currentTime;

	let delay_t = end_t - t;

	playing = (multiPlayer.playerState == YT.PlayerState.PLAYING);

	SetISSTrackerDelay(delay_t, playing);
}

window.addEventListener("message", (event)=>{
	if (event.data.type === "issDelay")
	{
		SetISSTrackerDelay(event.data.delay, true);
		multiPlayer.setLiveDelay(event.data.delay);
	}
});

function SetISSTrackerDelay(delay_t, playing)
{
	issTrackerDelay = delay_t;
	
	if(playing != undefined)
		issTrackerPlaying = playing;

	console.log("Sending delay to ISS Tracker: " + delay_t + "s, play: " + playing);
	issTrackers = document.querySelectorAll(".iss-tracker");
	issTrackers.forEach(function(issTracker) {
		issTracker.contentWindow.postMessage(
			{
				type: "delay",
				delay: delay_t, 
				play: playing, 
				map_scale: issTrackerScale
			}, '*');
	});
}

function UpdateVideoTransform()
{
  playerLeftE = document.getElementById("playerLeft");
  playerRightE = document.getElementById("playerRight");

  videoWidth = playerLeftE.offsetWidth * 2;
  videoPanX = videoPanXpc * videoWidth / 100;
  videoScaleF = 0.9 + videoScale * 0.1;
  
  transLeftPanX = "translate(" + videoPanX + "px, 0px) ";
  transRightPanX = "translate(" + (-videoPanX) + "px, 0px) ";
  rotate = "rotate(" + videoRotationAngle + "deg) ";
  scale = "scale(" + videoScaleF + ") ";
  playerLeftE.style.transform = transLeftPanX + rotate + scale;
  playerRightE.style.transform =  transRightPanX + rotate + scale;
}

function submitForm()
{
  document.getElementById("inputForm").submit();
}

function setValue(id, val) {
  document.getElementById(id).value=val; 
}

function toggleUI() {
	showUI = !showUI;
	
	applyShowUI();
}

function applyShowUI()
{
	var uiDiv = document.getElementById("UI");

	if (showUI) {
		console.log("Show UI");
		uiDiv.style.display = "block";
	} else {
		console.log("Hide UI");
		uiDiv.style.display = "none";
	}
}

function toggleISSTracker() {
	showISSTracker = !showISSTracker;
	
	applyShowISSTracker();
}

function applyShowISSTracker() {
    var issDivs = document.querySelectorAll(".iss-pos");
    issDivs.forEach(function(issDiv) {
		if (!showISSTracker)
		{
			console.log("Hide ISS Tracker");      
			issDiv.style.display = "none";
		}
		else
		{
			console.log("Show ISS Tracker");      
			issDiv.style.display = "block";
		}
	});
}

function setTimeOffset(val) {
	multiPlayer.delay_s = val;
}

function setVideoRotation(val) {
	if (val != videoRotationAngle) {       
		console.log("Set video rotation: " + val + "deg");      
		videoRotationAngle=val; 
		UpdateVideoTransform();
	}
}

function setVideoPanX(val) {
	if (val != videoPanXpc) { 
		console.log("Set Video Pan X (%): " + val);      
		videoPanXpc=val; 
		UpdateVideoTransform();
	}
}

function setVideoScale(val) {
	if (val != videoScale) {       
		console.log("Set video scale: x" + val);      
		videoScale=val; 
		UpdateVideoTransform();
	}
}
  
function setFullISSTrackerScale()
{
    var issDivs = document.querySelectorAll(".iss-pos");
    if (issDivs.size == 0)
	{
		console.error("setFullISSTrackerScale failed: Missing iss-pos class");
		return;
	}
	issDiv = issDivs[0];
	issTrackerScale = issDiv.parentNode.offsetWidth / issDiv.offsetWidth;
	setISSTrackerScale(issTrackerScale);
}

function round(s, decimals = 3) 
{
	let thousands = Math.pow(10, decimals);
	return Math.round(s * thousands) / thousands;
};

function setISSTrackerScale(val) {
	val = round(val, 2);
	console.log("Set ISSTracker scale: x" + val);      
	issTrackerScale=val; 
	setValue('issTrackerScaleRangeInput', val); 
    var issDivs = document.querySelectorAll(".iss-pos");
    issDivs.forEach(function(issDiv) {
		issDiv.style.transform =  "scale(" + issTrackerScale + ")";
		//UpdateISSTracker();
	});
}

function setMonoValue(val) {
  setValue('monoValueRangeInput', val); 
  setTimeOffset((1-val) * DEFAULT_PARALLAX_TIME_OFFSET);
  setVideoPanX((1-val) * DEFAULT_HORIZONTAL_PAN);
  //setVideoRotation((1-val) * DEFAULT_ROTATION_ANGLE);
  setVideoScale((1-val) * DEFAULT_SCALE);
  //setISSTrackerScale(val * MAX_ISS_TRACKER_SCALE + (1 - val) * DEFAULT_ISS_TRACKER_SCALE);
  /*
  showISSTracker = val != 0;
  applyShowISSTracker();
  */
}

function resync() {
	console.log("Resync");      
	UpdateVideoTransform();
	setFullISSTrackerScale();
}


function golive() {
	SetISSTrackerDelay(0);
	multiPlayer.goLive();
}

function gobackward() {
	SetISSTrackerDelay(issTrackerDelay + 300);
	multiPlayer.goBackward(300);
}

function goforward() {
	SetISSTrackerDelay(issTrackerDelay - 300);
	multiPlayer.goForward(300);
}
