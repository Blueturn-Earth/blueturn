export default class BaseEpicAPI 
{
    _throwUnimplementedError()
    {
        throw new Error("unimplemented method");
    }

    isUsingCache()
    {
        this._throwUnimplementedError()
    }

    getEpicCallURL(call)
    {
        _throwUnimplementedError()
    }

    getEpicCallURLSecretQuery(nocache = false)
    {
        this._throwUnimplementedError()
    }

    getEpicAvailableDaysCall()
    {
        this._throwUnimplementedError()
    }

    // Date format: e.g., "2025-04-26"

    getEpicDayCall(date = _todayDatesStr)
    {
        this._throwUnimplementedError()
    };

    getEpicImageURL(date, imageName)
    {
        this._throwUnimplementedError()
    }

    getAvailableDateFromIndex(allDays, i)
    {
        this._throwUnimplementedError()
    }
}
