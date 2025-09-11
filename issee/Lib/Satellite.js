class Satellite
{
    #sgp4 = null;
    #initCb = null;

    constructor(initCb)
    {
        this.#initCb = initCb;
    }

    initSatellite(tleStr)
    {
        let tleLines = tleStr.split(/\r?\n|\r|\n/g);
        this.#sgp4 = new SGP4(tleLines[1], tleLines[2]);
        if (this.#initCb)
        {
            this.#initCb(this);
        }
    }

    setDate(date)
    {
        this.#sgp4.propagateToDate(date);
    }

    get Latitude() {return this.#sgp4.Latitude;}
    get Longitude() {return this.#sgp4.Longitude;}
}