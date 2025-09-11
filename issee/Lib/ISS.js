class ISS extends Satellite
{
    constructor(initCb)
    {
        super(initCb);

        let tle_default = "ISS (ZARYA)\n1 25544U 98067A   18197.23268516  .00001143  00000-0  24639-4 0  9996\n2 25544  51.6395 233.9354 0003899 320.6076 211.2954 15.53978402123030";
        let tle_request = new XMLHttpRequest();
        var iss = this;
        tle_request.onreadystatechange = function() {
            if (tle_request.readyState == 4)
                switch (tle_request.status) {
                    case 0:
                        break;
                    case 200:
                        iss.initSatellite(tle_request.responseText);
                        break;
                     default:
                        iss.initSatellite(tle_default);
                        break;
                }
        };
        let tle_url = 'https://api.wheretheiss.at/v1/satellites/25544/tles?format=text';
        tle_request.open('GET', tle_url);
        tle_request.send();                
    }
}