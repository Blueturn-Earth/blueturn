
export default class ISSLocator
{
    localLocation = {};// = {lat: 48.8584, lon: 2.2945, name="Paris, France"}; // Paris
    prevPasses; // timestamp of previous pass at location
    nextPasses; // timestamp of next pass at location
    locateBtn;
    prevPassBtns;
    nextPassBtns;
    issTrackers;
    lastPassCallback;

    constructor(locateButtonId, prevPassButtonClassName, nextPassButtonClassName, issTrackerClassName, lastPassCallback)
    {
        this.issTrackers = document.querySelectorAll("." + issTrackerClassName);
        this.locateBtn = document.getElementById(locateButtonId);
        this.prevPassBtns = document.getElementsByClassName(prevPassButtonClassName);
        this.nextPassBtns = document.getElementsByClassName(nextPassButtonClassName);

        this.lastPassCallback = lastPassCallback;

        let self = this;

        this.locateBtn.addEventListener("click", () => {self.locate();});
        this.prevPassBtns[0].addEventListener("click", () => {self.gotoPrevPass();});
        this.nextPassBtns[0].addEventListener("click", () => {self.remindNextPass();});

        window.addEventListener("message", (event)=>{
            if (event.data.type === "prevPassTimeDiffAtLocation")
            {
                self.handlePrevPassesInfo(event.data.passes);
            }
            if (event.data.type === "nextPassTimeDiffAtLocation")
            {
                self.handleNextPassesInfo(event.data.passes);
            }
        });
    }

    locate() 
    {
        let self = this;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {self.locateSuccess(position);}, 
                () => {self.locateError();}
            );
        } else {
            this.locateBtn.innerHTML = "Geolocation is not supported by this browser.";
        }
    }

    locateSuccess(position)
    {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        this.locateBtn.innerHTML = "Latitude: " + lat + ", Longitude: " + lon;

        // send msg to iss tracker with lat lon
        console.log("Sending location to ISS Trackers:", lat, lon);
        this.issTrackers.forEach(function(issTracker) {
            issTracker.contentWindow.postMessage(
                {
                    type: "location",
                    location: {
                        lat: lat,
                        lon: lon
                    }
                }, 
                '*'
            );
        });

        console.log("Fetching geocode for lat:", lat, "lon:", lon);
        this.getCityCountry(lat, lon)
        .then(data => {
            this.localLocation = {lat: lat, lon: lon, name: `${data.city}, ${data.country}`};
            this.locateBtn.innerHTML = this.localLocation.name;
        })
        .catch(err => {
            console.error("Geo API error:", err);
        });

    }

    locateError()
    {
        alert("Sorry, no position available.");        
    }

    async getCityCountry(lat, lng) {
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

    handlePrevPassesInfo(passes)
    {
        const prevPassBtn = this.prevPassBtns[0];
        if (!passes || passes.length == 0)
        {
            prevPassBtn.innerHTML = "No prev pass found";
            prevPassBtn.disabled = true;
            return;
        }
        this.prevPasses = passes;
        const prevPass = this.prevPasses[0];
        const prevDate = new Date(Date.now() - prevPass.delay * 1000);
        prevPass.timeAtLocation = prevDate;
        const label = this.getTimeString(prevDate);
        prevPassBtn.innerHTML = "Last pass:\n" + label;
        prevPassBtn.disabled = false;
    }

    handleNextPassesInfo(passes)
    {
        const nextPassBtn = this.nextPassBtns[0];
        if (!passes || passes.length == 0)
        {
            nextPassBtn.innerHTML = "No next pass found";
            nextPassBtn.disabled = true;
            return;
        }
        this.nextPasses = passes;
        // duplicate nextPassBtn for every pass, or remove it
        for (let i = 1; i < this.nextPasses.length; i++) {
            const newBtn = nextPassBtn.cloneNode(true);
            this.nextPassBtns[0].parentNode.insertBefore(newBtn, this.nextPassBtns[0].nextSibling);
        }
        // remove extra buttons
        while (this.nextPassBtns.length > this.nextPasses.length) {
            this.nextPassBtns[this.nextPassBtns.length - 1].remove();
        }
        // for each next-btn set the corresponding pass
        for (let i = 0; i < this.nextPasses.length; i++) {
            const nextPassBtn = this.nextPassBtns[i];
            const nextPass = this.nextPasses[i];
            const nextDate = new Date(Date.now() - nextPass.delay * 1000);
            nextPass.timeAtLocation = nextDate;
            const label = this.getTimeString(nextDate);
            nextPassBtn.innerHTML = "Next pass:\n" + label;
            nextPassBtn.disabled = false;
        }
    }

    getTimeString(date)
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

    getLocalURL(time, location)
    {
        const currentURLWithoutQuery = window.location.origin + window.location.pathname;
        const locationNameURI = encodeURIComponent(location.name);
        const url = `${currentURLWithoutQuery}?date=${time.toISOString()}&loc=${location.lat},${location.lon}&locName=${locationNameURI}`;
        return url;
    }

    openURL(url, replace=false)
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

    gotoPrevPass()
    {
        if (!this.prevPasses || this.prevPasses.length == 0)
        {
            this.locate();
            return;
        }
        const prevPass = this.prevPasses[0];
        const now = new Date();
        const delay = (now - prevPass.timeAtLocation) / 1000;
        this.lastPassCallback(delay);

        //let localURL = this.getLocalURL(prevPass.timeAtLocation, this.localLocation);
        //this.openURL(localURL, true);
    }

    remindNextPass()
    {
        if (!this.nextPasses || this.nextPasses.length == 0)
        {
            this.locate();
            return;
        }

        // find out which one of the buttons of class nextPassBtn was clicked
        var nextPass;
        for (let i = 0; i < this.nextPassBtns.length; i++) {
            if (this.nextPassBtns[i] === document.activeElement) {
                nextPass = this.nextPasses[i];
                break;
            }
        }
        if (!nextPass)
        {
            console.error("remindNextPass: No next pass found");
            return;
        }
        let summary = `See ${this.localLocation.name} from the ISS now!`;
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
        const localLocationNameURI = encodeURIComponent(this.localLocation.name);
        const localURL = this.getLocalURL(nextPass.timeAtLocation, this.localLocation);
        const accuracyKm = nextPass.accuracyKm;
        const descriptionHtml = `The International Space Station will fly over ${this.localLocation.name} at ${nextPass.timeAtLocation.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} on ${nextPass.timeAtLocation.toLocaleDateString()}.\n\nAccuracy: ${accuracyKm} km\n\nWatch the live video stream from the ISS here:\n\n${localURL}\n\n(You may need to copy and paste the link in your browser.)`;
        const description = encodeURIComponent(descriptionHtml);
        // https://www.google.com/calendar/render?action=TEMPLATE&text=Your+Event+Name&dates=20140127T224000Z/20140320T221500Z&details=For+details,+link+here:+http://www.example.com&location=Waldorf+Astoria,+301+Park+Ave+,+New+York,+NY+10022&sf=true&output=xml
        // https://www.google.com/calendar/event?action=TEMPLATE&text=Your+Event+Name&dates=20140127T224000Z/20140320T221500Z&details=For+details,+link+here:+http://www.example.com&location=Waldorf+Astoria,+301+Park+Ave+,+New+York,+NY+10022&sf=true&output=xml
        const googleCalendarUrl = `http://www.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${startDate}/${endDate}&details=${description}&location=${this.localLocation.name}&trp=false`;
        console.log(googleCalendarUrl);
        this.openURL(googleCalendarUrl);
    };
}
