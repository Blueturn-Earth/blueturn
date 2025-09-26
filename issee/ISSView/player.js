/*
 * http://www.opensource.org/licenses/lgpl-2.1.php
 * Dual ISS Player
 * Copyright Michael Boccara, Blueturn - 2017-2024
 */

var localLocation = {};// = {lat: 48.8584, lon: 2.2945, name="Paris, France"}; // Paris
var prevPasses; // timestamp of previous pass at location
var nextPasses; // timestamp of next pass at location
var startDateTime; // in ms or string "YYYY-MM-DDTHH:MM:SSZ"

var timer = new Timer();
let VIDEO_ID = 
	//"iYmvCUonukw"; // ISS front live HD
	"yf5cEJULZXk"; // ISS topdown live HD
	//"xRPjKQtRXR8"; // afarTV

var urlParams = new URLSearchParams(window.location.search);
const videoIdParam = urlParams.get("v");
if (videoIdParam)
{
	VIDEO_ID = videoIdParam;
	console.log("Using video ID from URL param: " + VIDEO_ID);
}
const dateParam = urlParams.get("date");
if (dateParam)
{
	startDateTime = new Date(dateParam);
	console.log("Start date-time from URL param: " + startDateTime);
}
const locParam = urlParams.get("loc");
if (locParam)
{
	const startLocationPair = locParam.split(",");
	const lat = parseFloat(startLocationPair[0]);
	const lon = parseFloat(startLocationPair[1]);
	console.log("Current location from URL param: lat=" + lat + ", lon=" + lon);
}

const locNameParam = urlParams.get("locName");
if (locNameParam)
{
	console.log("Current location name from URL param: " + locNameParam);
}

let initialDelaySec = 0;
if (startDateTime)
{
	const now = new Date();
	console.log("Start date-time from URL param: " + now);
	initialDelaySec = (now - startDateTime) / 1000;
	// A trick to work around some 1-hour mistake bug in MultiPlayer or Timer - I don't know where exactly
	initialDelaySec += 3600;
	console.log("Initial delay (s): " + initialDelaySec);
}	

var multiPlayer = new MultiPlayer(
	VIDEO_ID, 
	timer, 
	[YTPlayer], // order important for correct delay
	initialDelaySec,
	function() {UpdateISSTracker();}
);

function resize() {
	issTrackers = document.querySelectorAll(".iss-tracker");
	issTrackers.forEach(function(issDiv) {
		const screenAspectRatio = window.innerWidth / window.innerHeight;
		var issTrackerScale = 1;
		if (screenAspectRatio > 1) 
		{
			issTrackerScale = issDiv.parentNode.offsetWidth / issDiv.offsetWidth;
			issTrackerScale /= 2;
		}
		else {
			const MAX_ISS_TRACKER_SCALE = 1.43;
			issTrackerScale = issDiv.parentNode.offsetWidth / issDiv.offsetWidth;
			if (issTrackerScale > MAX_ISS_TRACKER_SCALE) 
				issTrackerScale = MAX_ISS_TRACKER_SCALE;
		}
		console.log("Set ISSTracker scale: x" + issTrackerScale);      
		issDiv.style.transform =  "scale(" + issTrackerScale + ")";
	});
}

resize();

var issTrackerDelay = 0;

function UpdateISSTracker()
{
	let delay_t = timer.delayFromLiveSec;
	playing = timer.playState

	SetISSTrackerDelay(delay_t, playing);
}

function SetISSTrackerDelay(delay_t, playing)
{
	issTrackerDelay = delay_t;
	
	if(playing != undefined)
		issTrackerPlaying = playing;

	console.log("Sending delay to ISS Tracker: " + delay_t + "s, play: " + playing);
	document.querySelectorAll(".iss-tracker").forEach(function(issTracker) {
		issTracker.contentWindow.postMessage(
			{
				type: "delay",
				delay: delay_t, 
				play: playing, 
				map_scale: 1
			}, '*');
	});
}

function golive() {
	SetISSTrackerDelay(0, true);
	multiPlayer.delay_s = 0;
	multiPlayer.goLive();
}

function gobackward(stepSec) {
	SetISSTrackerDelay(issTrackerDelay + stepSec);
	multiPlayer.goBackward(stepSec);
}

function goforward(stepSec) {
	SetISSTrackerDelay(issTrackerDelay - stepSec);
	multiPlayer.goForward(stepSec);
}
