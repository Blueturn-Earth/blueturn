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
	localLocation.lat = parseFloat(startLocationPair[0]);
	localLocation.lon = parseFloat(startLocationPair[1]);
	console.log("Current location from URL param: " + JSON.stringify(localLocation));
}
const locNameParam = urlParams.get("locName");
if (locNameParam)
{
	localLocation.name = locNameParam;
	console.log("Current location name from URL param: " + localLocation.name);
}

const locateBtn = document.getElementById("locateBtn");

if (localLocation.name)
	locateBtn.innerHTML = localLocation.name;

function locate() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error);
  } else {
    locateBtn.innerHTML = "Geolocation is not supported by this browser.";
  }
}

function success(position) {
	const lat = position.coords.latitude;
	const lon = position.coords.longitude;

	locateBtn.innerHTML = "Latitude: " + lat + ", Longitude: " + lon;

	// send msg to iss tracker with lat lon
	console.log("Sending location to ISS Tracker:", lat, lon);
	document.querySelectorAll(".iss-tracker").forEach(function(issTracker) {
		issTracker.contentWindow.postMessage(
			{
				type: "location",
				location: {
					lat: lat,
					lon: lon
				}
			}, '*');
	});

	console.log("Fetching geocode for lat:", lat, "lon:", lon);
	getCityCountry(lat, lon)
	.then(data => {
		localLocation = {lat: lat, lon: lon, name: `${data.city}, ${data.country}`};
		locateBtn.innerHTML = localLocation.name;
	})
	.catch(err => {
		console.error("Geo API error:", err);
	});
}

function error() {
  alert("Sorry, no position available.");
}

async function getCityCountry(lat, lng) {
  const apiKey = "AIzaSyA5G5wpnUkc_3cKFUVGfJVjtCATeTCEFF8";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") throw new Error("Geocoding failed: " + data.status);

  let city = null, country = null;

  for (const result of data.results) {
    for (const comp of result.address_components) {
      if (comp.types.includes("locality")) {
        city = comp.long_name;
      }
      if (comp.types.includes("country")) {
        country = comp.long_name;
      }
    }
    if (city && country) break;
  }

  return { city, country };
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
	var issDivs = document.querySelectorAll(".iss-tracker");
    if (issDivs.size == 0)
	{
		console.error("resize failed: Missing iss-tracker class");
		return;
	}
	issDiv = issDivs[0];
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
}

resize();

var issTrackerDelay = 0;

function UpdateISSTracker()
{
	let delay_t = timer.delayFromLiveSec;
	playing = timer.playState

	SetISSTrackerDelay(delay_t, playing);
}

function getTimeString(date)
{
	const now = new Date();
	let label;

	// Check if date is yesterday
	const isYesterday = date.getDate() === now.getDate() - 1 &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	// Check if date is today
	const isToday = date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	// Check if date is tomorrow
	const isTomorrow = date.getDate() === now.getDate() + 1 &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isTomorrow) {
		label = "Tomorrow, " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	} else if (isToday) {
		label = "Today, " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	} else if (isYesterday) {
		label = "Yesterday, " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	} else {
		label = date.toLocaleDateString([], {weekday: 'short'}) + ", " +
			date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
	}

	return label;
}

window.addEventListener("message", (event)=>{
	if (event.data.type === "issDelay")
	{
		multiPlayer.setLiveDelay(event.data.delay);
	}
	if (event.data.type === "prevPassTimeDiffAtLocation")
	{
		const prevPassBtns = document.getElementsByClassName("prevPassBtn");
		const prevPassBtn = prevPassBtns[0];
		if (!event.data.passes || event.data.passes.length == 0)
		{
			prevPassBtn.innerHTML = "No prev pass found";
			prevPassBtn.disabled = true;
			prevPass = undefined;
			return;
		}
		prevPasses = event.data.passes;
		const prevPass = prevPasses[0];
		const prevDate = new Date(Date.now() - prevPass.delay * 1000);
		prevPass.timeAtLocation = prevDate;
		const label = getTimeString(prevDate);
		prevPassBtn.innerHTML = label;
		prevPassBtn.disabled = false;
	}
	if (event.data.type === "nextPassTimeDiffAtLocation")
	{
		const nextPassBtns = document.getElementsByClassName("nextPassBtn");
		const nextPassBtn = nextPassBtns[0];
		if (!event.data.passes || event.data.passes.length == 0)
		{
			nextPassBtn.innerHTML = "No next pass found";
			nextPassBtn.disabled = true;
			nextPasses = undefined;
			return;
		}
		nextPasses = event.data.passes;		
		// duplicate nextPassBtn for every pass, or remove it
		for (let i = 1; i < nextPasses.length; i++) {
			const newBtn = nextPassBtn.cloneNode(true);
			nextPassBtns[0].parentNode.insertBefore(newBtn, nextPassBtns[0].nextSibling);
		}
		// remove extra buttons
		while (nextPassBtns.length > nextPasses.length) {
			nextPassBtns[nextPassBtns.length - 1].remove();
		}
		// for each next-btn set the corresponding pass
		for (let i = 0; i < nextPasses.length; i++) {
			const nextPassBtn = nextPassBtns[i];
			const nextPass = nextPasses[i];
			const nextDate = new Date(Date.now() - nextPass.delay * 1000);
			nextPass.timeAtLocation = nextDate;
			const label = getTimeString(nextDate);
			nextPassBtn.innerHTML = label;
			nextPassBtn.disabled = false;
		}
	}
});

function getLocalURL(time, location)
{
	let currentURLWithoutQuery = window.location.origin + window.location.pathname;
	currentURLWithoutQuery = window.location.origin + window.location.pathname;
	locationNameURI = encodeURIComponent(location.name);
	let url = `${currentURLWithoutQuery}?date=${time.toISOString()}&loc=${location.lat},${location.lon}&locName=${locationNameURI}`;
	return url;
}

function openURL(url, replace=false)
{
	let a = document.createElement('a');
	a.href = url;
	if (replace)
		a.target = '_self';
	else
	{
		// On iOS open in same tab to avoid issues with popup blockers
		// see https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
		// and https://stackoverflow.com/questions/19761241/javascript-window-open-not-working-in-ios-safari
		const userAgent = navigator.userAgent || navigator.vendor || window.opera;
		if (!/android/i.test(userAgent))
			a.target = '_blank';
	}
	a.click();
}

function gotoPrevPass()
{
	if (!prevPasses || prevPasses.length == 0)
		return;
	const prevPass = prevPasses[0];
	const now = new Date();
	const delay = (now - prevPass.timeAtLocation) / 1000;
	multiPlayer.setLiveDelay(delay);

	//let localURL = getLocalURL(prevPass.timeAtLocation, localLocation);
	//openURL(localURL, true);
}

function remindNextPass()
{
	// find out which one of the buttons of class nextPassBtn was clicked
	const nextPassBtns = document.getElementsByClassName("nextPassBtn");
	var nextPass;
	for (let i = 0; i < nextPassBtns.length; i++) {
		if (nextPassBtns[i] === document.activeElement) {
			nextPass = nextPasses[i];
			break;
		}
	}
	if (!nextPass)
	{
		console.error("remindNextPass: No next pass found");
		return;
	}
	let summary = `See ${localLocation.name} from the ISS now!`;
	summary = encodeURIComponent(summary);
	// set `start` as date as 5 min before pass in Iso 8601	
	let startDate = new Date(nextPass.timeAtLocation.getTime() - 5 * 60 * 1000);
	startDate = startDate.toISOString();
	startDate = startDate.replace(/\.\d{3}Z$/, 'Z');
	startDate = startDate.replace(/-|:/g,'');
	// set `end` as date as 5 min after pass in Iso 8601
	let endDate = new Date(nextPass.timeAtLocation.getTime() + 5 * 60 * 1000);
	endDate = endDate.toISOString();
	endDate = endDate.replace(/\.\d{3}Z$/, 'Z');
	endDate = endDate.replace(/-|:/g,'');
	let currentURLWithoutQuery = window.location.origin + window.location.pathname;
	currentURLWithoutQuery = window.location.origin + window.location.pathname;
	localLocationNameURI = encodeURIComponent(localLocation.name);
	let localURL = getLocalURL(nextPass.timeAtLocation, localLocation);
	const accuracyKm = nextPass.accuracyKm;
	let descriptionHtml = `The International Space Station will fly over ${localLocation.name} at ${nextPass.timeAtLocation.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} on ${nextPass.timeAtLocation.toLocaleDateString()}.\n\nAccuracy: ${accuracyKm} km\n\nWatch the live video stream from the ISS here:\n\n${localURL}\n\n(You may need to copy and paste the link in your browser.)`;
	let description = encodeURIComponent(descriptionHtml);
	// https://www.google.com/calendar/render?action=TEMPLATE&text=Your+Event+Name&dates=20140127T224000Z/20140320T221500Z&details=For+details,+link+here:+http://www.example.com&location=Waldorf+Astoria,+301+Park+Ave+,+New+York,+NY+10022&sf=true&output=xml
	// https://www.google.com/calendar/event?action=TEMPLATE&text=Your+Event+Name&dates=20140127T224000Z/20140320T221500Z&details=For+details,+link+here:+http://www.example.com&location=Waldorf+Astoria,+301+Park+Ave+,+New+York,+NY+10022&sf=true&output=xml
	let googleCalendarUrl = `http://www.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${startDate}/${endDate}&details=${description}&location=${localLocation.name}&trp=false`;
	console.log(googleCalendarUrl);
	openURL(googleCalendarUrl);
};

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
