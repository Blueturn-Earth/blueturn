class SGP4 
{
    CanPropagate = false;
    kUnits       = 1.0;
    EpochTLE     = 0; // in days
    EpochNow     = 0;
    IFLAG        = 0;	
    // COMMON/E1/
    XMO          = 0;
    XNODEO       = 0;
    OMEGAO       = 0;
    EO           = 0;
    XINCL        = 0;
    XNO          = 0;
    XNDT2O       = 0;
    XNDD6O       = 0;
    BSTAR        = 0;
    // COMMON/C1/
    DE2RA        = Math.PI / 180.0;
    PIO2         = Math.PI / 2.0;
    X3PIO2       = Math.PI * 1.5;
    TWOPI        = Math.PI * 2.0;
    E6A          = 1.0E-6;
    TOTHRD       = 2.0 / 3.0;
    XJ3          = -0.253881e-5;
    XKMPER       = 6378.135;
    XMNPDA       = 1440.0;
    AE           = 1.0;
    CK2          = 5.413080E-4;
    CK4          = 0.62098875E-6;
    S            = 1.0122292801892716;
    QOMS2T       = 1.8802791590152709e-9;
    XKE          = 0.074366916133173408;
    TIMCON       = 3600 * 24 * 1000;
    SECDAY       = 86400.0;
    MSS          = 1000;
    OMEGAE       = 1.00273790934;
    // VARS
    X            = 0;
    Y            = 0;
    Z            = 0;
    XDOT         = 0;
    YDOT         = 0;
    ZDOT         = 0;
    Latitude     = 0;
    Longitude    = 0;
    Altitude     = 0;
    Speed        = 0;
    LatitudeLabel = "";
    LongitudeLabel = "";
    AltitudeLabel = "";
    SpeedLabel   = "";
    TimeLabel    = "";
    A1           = 0;
    COSIO        = 0;
    THETA2       = 0;
    X3THM1       = 0;
    EOSQ         = 0;
    BETAO2       = 0;
    BETAO        = 0;
    DEL1         = 0;
    AO           = 0;
    DELO         = 0;
    XNODP        = 0;
    AODP         = 0;
    ISIMP        = 0;
    S4           = 0;
    QOMS24       = 0;
    PERIGE       = 0;
    PINVSQ       = 0;
    TSI          = 0;
    ETA          = 0;
    EETA         = 0;
    ETASQ        = 0;
    COEF         = 0;
    COEF1        = 0;
    PSISQ        = 0;
    C1           = 0;
    C2           = 0;
    C3           = 0;
    SINIO        = 0;
    A3OVK2       = 0;
    C4           = 0;
    C5           = 0;
    X1MTH2       = 0;
    THETA4       = 0;
    TEMP1        = 0;
    TEMP2        = 0;
    TEMP3        = 0;
    XMDOT        = 0;
    X1M5TH       = 0;
    OMGDOT       = 0;
    XHDOT1       = 0;
    OMGCOF       = 0;
    XMCOF        = 0;
    XNODOT       = 0;
    XNODCF       = 0;
    T2COF        = 0;
    XLCOF        = 0;
    AYCOF        = 0;
    DELMO        = 0;
    SINMO        = 0;
    X7THM1       = 0;
    C1SQ         = 0;
    D2           = 0;
    TEMP         = 0;
    D3           = 0;
    D4           = 0;
    T3COF        = 0;
    T4COF        = 0;
    T5COF        = 0;
    
    constructor (tle1, tle2) 
    {
        var _year;
        var _days;
        var rval;
        var checksum_problem = 0;
        var L1 = tle1.split(" ");
        var L2 = tle2.split(" ");
        var tmp;
        var expsign = "";
        var f;
        L1 = this.trim_vector(L1);
        L2 = this.trim_vector(L2);
        this.XMO = this.DE2RA * (L2[6] * 1.0);
        this.XNODEO = this.DE2RA * (L2[3] * 1.0);
        this.OMEGAO = this.DE2RA * (L2[5] * 1.0);
        this.XINCL = this.DE2RA * (L2[2] * 1.0);
        this.EO = ("0." + L2[4]) * 1.0;
        tmp = L2[7] * 1.0;
        this.XNO = tmp * this.TWOPI / 1440.0;
        this.XNDT2O = (L1[4] * 1.0) * this.TWOPI / (1440.0 * 1440.0);
        this.XNDD6O = this.tleExp2Num(L1[5]) * this.TWOPI / (1440.0 * 1440.0 * 1440.0);
        this.BSTAR = this.tleExp2Num(L1[6]);
        _year = L1[3].substr(0, 2) * 1.0;
        _days = L1[3].substr(2) * 1.0;
        var TLEDate = new Date(Date.UTC(2000 + _year, 0, 1, 0, 0, 0, 0));
        this.EpochTLE = (_days - 1.0) + TLEDate.getTime() / this.TIMCON;
        this.IFLAG = 1;
        this.CanPropagate = true;
        this.propagate();
    }
    
    propagate() 
    {
        if (!this.CanPropagate) return;
        var Now = new Date();
        this.propagateToDate(Now);
    }
    
    propagatebyDelayMs(delay_ms) 
    {
        if (!this.CanPropagate) return;
        var Now = new Date();
        this.EpochNow = Now.getTime() / this.TIMCON;
        if (delay_ms)
        {
            this.EpochNow -= delay_ms * this.MSS / this.TIMCON;
        }
        this._propagate(this.EpochNow);
    }

    propagateToDate(date) 
    {
        let Epoch = date.getTime() / this.TIMCON;
        this._propagate(Epoch);
    }

    _propagate(Epoch) 
    {
        var TSINCE = (Epoch - this.EpochTLE) * 1440.0;
        var XMDF;
        var OMGADF;
        var XNODDF;
        var OMEGA;
        var XMP;
        var XNODE;
        var TSQ;
        var TEMPA;
        var TEMPE;
        var TEMPL;
        var DELOMG;
        var DELM;
        var TCUBE;
        var TFOUR;
        var A;
        var E;
        var XL;
        var XLT;
        var BETA;
        var XN;
        var AXN;
        var AYN;
        var XLL;
        var AYNL;
        var CAPU;
        var _jump;
        var I;
        var SINEPW;
        var COSEPW;
        var TEMP4;
        var TEMP5;
        var TEMP6;
        var EPW;
        var ECOSE;
        var ESINE;
        var ELSQ;
        var PL;
        var R;
        var RDOT;
        var RFDOT;
        var BETAL;
        var COSU;
        var SINU;
        var U;
        var SIN2U;
        var COS2U;
        var RK;
        var UK;
        var XNODEK;
        var XINCK;
        var RDOTK;
        var SINUK;
        var COSUK;
        var SINIK;
        var COSIK;
        var SINNOK;
        var COSNOK;
        var XMX;
        var XMY;
        var UX;
        var UY;
        var UZ;
        var VX;
        var VY;
        var VZ;
        var RFDOTK;
        var modulo;
        if (this.IFLAG != 0) {
            this.A1 		= Math.pow((this.XKE/this.XNO), this.TOTHRD);
            this.COSIO 		= Math.cos(this.XINCL);
            this.THETA2 	= this.COSIO * this.COSIO;
            this.X3THM1		= 3.0 * this.THETA2 - 1;
            this.EOSQ 		= this.EO * this.EO;
            this.BETAO2 	= 1.0 - this.EOSQ;
            this.BETAO 		= Math.sqrt(this.BETAO2);
            this.DEL1 		= 1.5 * this.CK2 * this.X3THM1 / (this.A1 * this.A1 * this.BETAO * this.BETAO2);
            this.AO 		= this.A1 * (1.0 - this.DEL1 * (0.5 * this.TOTHRD + this.DEL1 * (1.0 + 134.0 / 81.0 * this.DEL1)));
            this.DELO 		= 1.5 * this.CK2 * this.X3THM1 / (this.AO * this.AO * this.BETAO * this.BETAO2);
            this.XNODP 		= this.XNO / (1.0 + this.DELO);
            this.AODP		= this.AO / (1.0 - this.DELO);
            this.ISIMP		= 0;
            if ((this.AODP * (1.0 - this.EO) / this.AE) < (220.0 / this.XKMPER + this.AE)) this.ISIMP = 1;
            this.S4		= this.S;
            this.QOMS24		= this.QOMS2T;
            this.PERIGE		= (this.AODP * (1.0 - this.EO) - this.AE) * this.XKMPER;
            if (this.PERIGE < 156.0) {
                    S4 = this.PERIGE - 78.0;
                    if (this.PERIGE <= 98.0) S4 = 20.0;
                    QOMS24 = Math.pow(((120.0 - S4) * AE / XKMPER), 4);
                    S4 = S4 / XKMPER + AE;
            }
            this.PINVSQ = 1.0 / (this.AODP * this.AODP * this.BETAO2 * this.BETAO2);
            this.TSI 		= 1.0 / (this.AODP - this.S4);
            this.ETA 		= this.AODP * this.EO * this.TSI;
            this.ETASQ 		= this.ETA * this.ETA;
            this.EETA		= this.EO * this.ETA;
            this.PSISQ		= Math.abs(1.0 - this.ETASQ);
            this.COEF		= this.QOMS24 * Math.pow(this.TSI, 4);
            this.COEF1		= this.COEF / Math.pow(this.PSISQ, 3.5);
            this.C2		= this.COEF1 * this.XNODP * (this.AODP * (1.0 + 1.5 * this.ETASQ + this.EETA * (4.0 + this.ETASQ)) + 0.75 * this.CK2 * this.TSI / this.PSISQ * this.X3THM1 * (8.0 + 3.0 * this.ETASQ * (8.0 + this.ETASQ)));
            this.C1		= this.BSTAR * this.C2;
            this.SINIO		= Math.sin(this.XINCL);
            this.A3OVK2		= -this.XJ3 / this.CK2 * Math.pow(this.AE, 3);
            this.C3		= this.COEF * this.TSI * this.A3OVK2 * this.XNODP * this.AE * this.SINIO / this.EO;
            this.X1MTH2		= 1.0 - this.THETA2;
            this.C4		= 2.0 * this.XNODP * this.COEF1 * this.AODP * this.BETAO2 * (this.ETA * (2.0 + 0.5 * this.ETASQ) + this.EO * (0.5 + 2.0 * this.ETASQ) - 2.0 * this.CK2 * this.TSI / (this.AODP * this.PSISQ) * (-3.0 * this.X3THM1 * (1.0 - 2.0 * this.EETA + this.ETASQ * (1.5 - 0.5 * this.EETA)) + 0.75 * this.X1MTH2 * (2.0 * this.ETASQ - this.EETA * (1.0 + this.ETASQ)) * Math.cos(2.0 * this.OMEGAO)));
            this.C5		= 2.0 * this.COEF1 * this.AODP * this.BETAO2 * (1.0 + 2.75 * (this.ETASQ + this.EETA) + this.EETA * this.ETASQ);
            this.THETA4		= this.THETA2 * this.THETA2;
            this.TEMP1		= 3.0 * this.CK2 * this.PINVSQ * this.XNODP;
            this.TEMP2		= this.TEMP1 * this.CK2 * this.PINVSQ;
            this.TEMP3		= 1.25 * this.CK4 * this.PINVSQ * this.PINVSQ * this.XNODP;
            this.XMDOT		= this.XNODP + 0.5 * this.TEMP1 * this.BETAO * this.X3THM1 + 0.0625 * this.TEMP2 * this.BETAO * (13.0 - 78.0 * this.THETA2 + 137.0 * this.THETA4);
            this.X1M5TH		= 1.0 - 5.0 * this.THETA2;
            this.OMGDOT		= -0.5 * this.TEMP1 * this.X1M5TH + 0.0625 * this.TEMP2 * (7.0 - 114.0 * this.THETA2 + 395.0 * this.THETA4) + this.TEMP3 * (3.0 - 36.0 * this.THETA2 + 49.0 * this.THETA4);
            this.XHDOT1		= -this.TEMP1 * this.COSIO;
            this.XNODOT		= this.XHDOT1 + (0.5 * this.TEMP2 * (4.0 - 19.0 * this.THETA2) + 2.0 * this.TEMP3 * (3.0 - 7.0 * this.THETA2)) * this.COSIO;
            this.OMGCOF		= this.BSTAR * this.C3 * Math.cos(this.OMEGAO);
            this.XMCOF		= -this.TOTHRD * this.COEF * this.BSTAR * this.AE / this.EETA;
            this.XNODCF		= 3.5 * this.BETAO2 * this.XHDOT1 * this.C1;
            this.T2COF		= 1.5 * this.C1;
            this.XLCOF		= 0.125 * this.A3OVK2 * this.SINIO * (3.0 + 5.0 * this.COSIO) / (1.0 + this.COSIO);
            this.AYCOF		= 0.25 * this.A3OVK2 * this.SINIO;
            this.DELMO		= Math.pow(1.0 + this.ETA * Math.cos(this.XMO), 3);
            this.SINMO		= Math.sin(this.XMO);
            this.X7THM1		= 7.0 * this.THETA2 - 1.0;
            if (this.ISIMP != 1) {
                this.C1SQ = this.C1 * this.C1;
                this.D2 = 4.0 * this.AODP * this.TSI * this.C1SQ;
                this.TEMP = this.D2 * this.TSI * this.C1 / 3.0;
                this.D3 = (17.0 * this.AODP + this.S4) * this.TEMP;
                this.D4 = 0.5 * this.TEMP * this.AODP * this.TSI * (221.0 * this.AODP + 31.0 * this.S4) * this.C1;
                this.T3COF = this.D2 + 2.0 * this.C1SQ;
                this.T4COF = 0.25 * (3.0 * this.D3 + this.C1 * (12.0 * this.D2 + 10.0 * this.C1SQ));
                this.T5COF = 0.2 * (3.0 * this.D4 + 12.0 * this.C1 * this.D3 + 6.0 * this.D2 * this.D2 + 15.0 * this.C1SQ * (2.0 * this.D2 + this.C1SQ));
            }
            this.IFLAG = 0;
        }
        XMDF = this.XMO + this.XMDOT * TSINCE;
        OMGADF = this.OMEGAO + this.OMGDOT * TSINCE;
        XNODDF = this.XNODEO + this.XNODOT * TSINCE;
        OMEGA = OMGADF;
        XMP = XMDF;
        TSQ = TSINCE * TSINCE;
        XNODE = XNODDF + this.XNODCF * TSQ;
        TEMPA = 1.0 - this.C1 * TSINCE;
        TEMPE = this.BSTAR * this.C4 * TSINCE;
        TEMPL = this.T2COF * TSQ;
        if (this.ISIMP != 1) {
            DELOMG = this.OMGCOF * TSINCE;
            DELM = this.XMCOF * (Math.pow((1.0 + this.ETA * Math.sin(XMDF)), 3) - this.DELMO);
            this.TEMP = DELOMG + DELM;
            XMP = XMDF + this.TEMP;
            OMEGA = OMGADF - this.TEMP;
            TCUBE = TSQ * TSINCE;
            TFOUR = TSINCE * TCUBE;
            TEMPA = TEMPA - this.D2 * TSQ - this.D3 * TCUBE - this.D4 * TFOUR;
            TEMPE = TEMPE + this.BSTAR * this.C5 * (Math.sin(XMP) - this.SINMO);
            TEMPL = TEMPL + this.T3COF * TCUBE + TFOUR * (this.T4COF + TSINCE * this.T5COF);
        }
        A = this.AODP * Math.pow(TEMPA, 2);
        E 		= this.EO - TEMPE;
        XL 		= XMP + OMEGA + XNODE + this.XNODP * TEMPL;
        BETA	= Math.sqrt(1.0 - E * E);
        XN		= this.XKE / Math.pow(A, 1.5);
        AXN		= E * Math.cos(OMEGA);
        this.TEMP	= 1.0 / (A * BETA * BETA);
        XLL		= this.TEMP * this.XLCOF * AXN;
        AYNL	= this.TEMP * this.AYCOF;
        XLT		= XL + XLL;
        AYN		= E * Math.sin(OMEGA) + AYNL;
        CAPU	= this.FMOD2P(XLT - XNODE);
        this.TEMP2	= CAPU;
        for (I = 1; I <= 10; I++) {
            SINEPW = Math.sin(this.TEMP2);
            COSEPW = Math.cos(this.TEMP2);
            this.TEMP3 = AXN * SINEPW;
            TEMP4 = AYN * COSEPW;
            TEMP5 = AXN * COSEPW;
            TEMP6 = AYN * SINEPW;
            EPW = (CAPU - TEMP4 + this.TEMP3 - this.TEMP2) / (1.0 - TEMP5 - TEMP6) + this.TEMP2;
            if (Math.abs(EPW - this.TEMP2) <= this.E6A) break;
            this.TEMP2 = EPW;
        }
        ECOSE	= TEMP5 + TEMP6;
        ESINE	= this.TEMP3 - TEMP4;
        ELSQ	= AXN * AXN + AYN * AYN;
        this.TEMP	= 1.0 - ELSQ;
        PL		= A * this.TEMP;
        R		= A * (1.0 - ECOSE);
        this.TEMP1	= 1.0 / R;
        RDOT 	= this.XKE * Math.sqrt(A) * ESINE * this.TEMP1;
        RFDOT	= this.XKE * Math.sqrt(PL) * this.TEMP1;
        this.TEMP2	= A * this.TEMP1;
        BETAL	= Math.sqrt(this.TEMP);
        this.TEMP3	= 1.0 / (1.0 + BETAL);
        COSU	= this.TEMP2 * (COSEPW - AXN + AYN * ESINE * this.TEMP3);
        SINU	= this.TEMP2 * (SINEPW - AYN - AXN * ESINE * this.TEMP3);
        U		= this.AcTan(SINU, COSU);							// IACOPO ATTENZIONE !!!! era ATAN
        SIN2U	= 2.0 * SINU * COSU;
        COS2U	= 2.0 * COSU * COSU - 1.0;
        this.TEMP	= 1.0 / PL;
        this.TEMP1	= this.CK2 * this.TEMP;
        this.TEMP2	= this.TEMP1 * this.TEMP;
        RK 		= R * (1.0 - 1.5 * this.TEMP2 * BETAL * this.X3THM1) + 0.5 * this.TEMP1 * this.X1MTH2 * COS2U;
        UK		= U - 0.25 * this.TEMP2 * this.X7THM1 * SIN2U;
        XNODEK	= XNODE + 1.5 * this.TEMP2 * this.COSIO * SIN2U;
        XINCK	= this.XINCL + 1.5 * this.TEMP2 * this.COSIO * this.SINIO * COS2U;
        RDOTK	= RDOT - XN * this.TEMP1 * this.X1MTH2 * SIN2U;
        RFDOTK	= RFDOT + XN * this.TEMP1 * (this.X1MTH2 * COS2U + 1.5 * this.X3THM1);
        SINUK	= Math.sin(UK);
        COSUK	= Math.cos(UK);
        SINIK	= Math.sin(XINCK);
        COSIK	= Math.cos(XINCK);
        SINNOK	= Math.sin(XNODEK);
        COSNOK	= Math.cos(XNODEK);
        XMX		= -SINNOK*COSIK;
        XMY		= COSNOK*COSIK;
        UX 		= XMX * SINUK + COSNOK * COSUK;
        UY		= XMY * SINUK + SINNOK * COSUK;
        UZ		= SINIK * SINUK;
        VX		= XMX * COSUK - COSNOK * SINUK;
        VY		= XMY * COSUK - SINNOK * SINUK;
        VZ		= SINIK * COSUK;
        this.X	= RK * UX * this.XKMPER;
        this.Y	= RK * UY * this.XKMPER;
        this.Z	= RK * UZ * this.XKMPER;
        this.XDOT	= (RDOTK * UX + RFDOTK * VX) * this.XKMPER * 60;
        this.YDOT	= (RDOTK * UY + RFDOTK * VY) * this.XKMPER * 60;
        this.ZDOT	= (RDOTK * UZ + RFDOTK * VZ) * this.XKMPER * 60;
        this.Speed = Math.sqrt(this.XDOT * this.XDOT + this.YDOT * this.YDOT + this.ZDOT * this.ZDOT);
        modulo = Math.sqrt(this.X * this.X + this.Y * this.Y + this.Z * this.Z);
        var _f = 3.35281066474748E-3;
        var g_theta = Math.atan2(this.Y, this.X); //AcTan(Y,X); // radians
        var g_lon = this.FMOD2P(g_theta - this.ThetaG_JD(this.GetCurrentJulianDate(Epoch)));
        var _r = Math.sqrt(this.X * this.X + this.Y * this.Y);
        var _e2 = _f * (2 - _f);
        var g_lat = Math.atan2(this.Z, _r); // radians
        var _c;
        while (true) {
            _c = 1 / Math.sqrt(1 - _e2 * Math.pow(Math.sin(g_lat), 2));
            g_lat = Math.atan2(this.Z + this.XKMPER * _c * _e2 * Math.sin(g_lat), _r);
            break;
            if (Math.abs(g_lat - g_lat) < 1E-10) break;
        }
        var g_alt = _r / Math.cos(g_lat) - this.XKMPER * _c; // kilometers
        if (g_lat > this.PIO2) g_lat -= this.TWOPI;			
        if (g_lon > Math.PI) g_lon -= this.TWOPI;
        else
        if (g_lon < -Math.PI) g_lon += this.TWOPI;
        this.Latitude = g_lat * 180 / Math.PI;
        this.Longitude = g_lon * 180 / Math.PI;		
        this.Altitude = g_alt;
        var pp;
        var mm;
        var dd;
        pp = Math.abs(this.Latitude);
        mm = Math.floor(pp);
        dd = Math.floor((pp - mm) * 10) + "";
        this.LatitudeLabel = Math.abs(mm) + "," + dd + " " + ((this.Latitude >= 0) ? "N" : "S");
        pp = Math.abs(this.Longitude);
        mm = Math.floor(pp);
        dd = Math.floor((pp - mm)*10) + "";
        this.LongitudeLabel = Math.abs(mm) + "," + dd + " " + ((this.Longitude >= 0) ? "E" : "W");
        this.AltitudeLabel = Math.round(this.Altitude * this.kUnits) + ((this.kUnits == 1.0) ? " km" : " mi");
        mm = Math.floor(this.Speed * this.kUnits / 1000);
        dd = Math.floor(this.Speed * this.kUnits - mm * 1000) + "";
        this.SpeedLabel = mm + dd + ((this.kUnits == 1.0) ? " km/h" : " mph");
        this.TimeLabel = this.EpochToDate(Epoch);                    
  }
    
  trim_vector         (L) {
        var Lo = [];
        L.forEach(Li => {
            if (Li != "") Lo.push(Li);
        });
        return Lo;
  }
    
  tleExp2Num          (ele) {
        var _status = 0;
        var mantissa = "";
        var exponent = "";
        var negative = false;
        for (let i = 0; i < ele.length; i++) {
            var ch = ele.charAt(i);
            switch (_status) {
                case 0:
                    if (ch == "-") negative = true;
                    else
                    if (ch == "+") negative = false;
                    else
                    mantissa = mantissa + ch;
                    _status = 1;
                    break;
                case 1:
                    if ((ch == "-") || (ch == "+")) {
                            exponent = ch;
                            _status = 2;
                    } else {
                            mantissa = mantissa + ch;
                    }
                    break;
                case 2:
                    exponent = exponent + ch;
                    break;
            }
        }
        return ("0." + mantissa + "e" + exponent) * ((negative) ? -1.0 : 1.0);
  }
    
    FMOD2P              (n) {
        var v = Math.floor(n / this.TWOPI);
        return (n - v * this.TWOPI);
    }
    
    AcTan               (sinx, cosx) {
        if (cosx == 0.0) {
            if (sinx > 0.0)
                return (this.PIO2);
            else
                return (this.X3PIO2);
        } else {
            if (cosx > 0.0) {
                if (sinx > 0.0)
                    return (Math.atan(sinx / cosx));
                else
                    return (this.TWOPI + Math.atan(sinx / cosx));
            } else
                return (Math.PI + Math.atan(sinx / cosx));
        }
    }
    
    ThetaG_JD           (jd) {
        var UT = this.Frac(jd+0.5);
        jd = jd - UT;
        var TU = (jd - 2451545.0) / 36525;
        var GMST = 24110.54841 + TU * (8640184.812866 + TU * (0.093104 - TU * 6.2E-6));
        GMST = this.Modulus(GMST + this.SECDAY * this.OMEGAE * UT, this.SECDAY);
        return (this.TWOPI * GMST / this.SECDAY);
    }
    
    GetCurrentJulianDate    (Epoch) {
        var date = new Date();
        date.setTime(Epoch * this.TIMCON);
        var dy = date.getUTCFullYear() * 1.0;
        var dm = date.getUTCMonth() * 1.0 + 1;
        var dd = date.getUTCDate() * 1.0;
        var dh = date.getUTCHours() * 1.0;
        var dmn = date.getUTCMinutes() * 1.0;
        var ds = date.getUTCSeconds() * 1.0; 
        var jy;
        var jm;
        var ja;
        if (dm > 2) {
            jy = dy;
            jm = dm + 1;
        } else {
            jy = dy - 1;
            jm = dm + 13;
        }
        var intgr = Math.floor(Math.floor(365.25*jy) + Math.floor(30.6001*jm) + dd + 1720995 );
        var gregcal = 15 + 31 * (10 + 12 * 1582);
        if ((dd + 31 * (dm + 12 * dy)) >= gregcal) {
            ja = Math.floor(0.01 * jy);
            intgr += 2 - ja + Math.floor(0.25 * ja);
        }
        var dayfrac = dh / 24.0 - 0.5;
        if (dayfrac < 0.0) {
            dayfrac += 1.0;
            --intgr;
        }
        var frac = dayfrac + (dmn + ds / 60.0) / 60.0 / 24.0;
        var jd0 = (intgr + frac) * 100000;
        var jd = Math.floor(jd0);
        if ((jd0 - jd) > 0.5) ++jd;
        return (jd / 100000);
    }
    
    Frac                (arg) {
          return (arg - Math.floor(arg));
    }
    
    Modulus             (arg1, arg2) {
        var ret_val = arg1;
        var i = Math.floor(arg1 / arg2);
        ret_val -= Math.floor(i * arg2);
        if (ret_val < 0.0) ret_val += arg2;
        return ret_val;
    }
    
    EpochToDate         (epoch) {
                var nn = new Date();
                nn.setTime(epoch * this.TIMCON);
                var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return this.twodig(nn.getUTCDate()) + " " + months[nn.getUTCMonth()] + " " + nn.getUTCFullYear() + ", " + this.twodig(nn.getUTCHours()) + ":" + this.twodig(nn.getUTCMinutes()) + ":" + this.twodig(nn.getUTCSeconds());
    }

    twodig              (n) {
                var ss = "";
                if (n < 10) ss = ss + "0";
                ss = ss + n;
                return ss;
    }
    
    setMetric           () {
        this.kUnits = 1.0;
    }
    
    setImperial         () {
        this.kUnits = 0.621371192;
    }
}
