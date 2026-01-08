function isNegInf(segs, i) {
    return i === 0 && segs[0] == null;
}

function isPosInf(segs, i) {
    return i === segs.length - 1 && segs[i] == null;
}

export function getIndexOfValueInArray(value, array, pred = (val) => val) {
    var low = 0,
        high = array.length;

    while (low < high) {
        var mid = low + high >>> 1;
        const midVal = pred(array[mid]);
        if (midVal < value) 
            low = mid + 1;
        else 
            high = mid;
    }
    return low;
}

function getIndexOfValueInSegmentsArray(value, array, valueFunc = v => v) {
    let low = 0;
    let high = array.length;

    while (low < high) {
        const mid = (low + high) >> 1;
        const elem = array[mid];

        // null only allowed at boundaries
        if (elem == null) {
            // null at start → -∞
            if (mid === 0) {
                low = mid + 1;
            }
            // null at end → +∞
            else {
                high = mid;
            }
        } else {
            const elemKey = valueFunc(elem);

            if (elemKey < value) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
    }

    return low;
}

function canonicalize(segs, isEqualFunc = (a,b) => (a==b)) {
    // Full infinite coverage
    if (
        segs.length >= 2 &&
        segs[0] == null &&
        segs[segs.length - 1] == null
    ) {
        return [null, null];
    }

    const out = [];

    for (let i = 0; i < segs.length; ++i) {
        // Remove interior nulls (should not happen, but defensive)
        if (segs[i] == null) {
            if (i === 0 || i === segs.length - 1) {
                out.push(null);
            }
        } 
        else {
            // Remove duplicates
            if (i < segs.length - 1 &&
                isEqualFunc(segs[i+1], segs[i])) {
                i++;
            }
            else {
                out.push(segs[i]);
            }
        }
    }

    // Enforce even length
    if (out.length & 1) out.pop();

    return out;
}

export function intersectSegment(segs, a, b, isEqualFunc = (a,b) => (a==b)) {
    // Semantic infinities handled here
    const ia = (a == null) ? 0 : getIndexOfValueInSegmentsArray(a, segs);
    const ib = (b == null) ? segs.length : getIndexOfValueInSegmentsArray(b, segs);

    const out = [];

    // Start
    if (ia & 1) {
        out.push(a);
    }

    // Middle
    out.push(...segs.slice(ia, ib));

    // End
    if (ib & 1) {
        out.push(b);
    }

    return canonicalize(out, isEqualFunc);
}

export function mergeSegment(segs, a, b) {
    // Empty coverage → result is exactly the inserted segment
    if (segs.length === 0) {
        return [a, b];
    }

    const ia = (a == null) ? 0 : getIndexOfValueInSegmentsArray(a, segs);
    const ib = (b == null) ? segs.length : getIndexOfValueInSegmentsArray(b, segs);

    const left = segs.slice(0, ia - (ia & 1));

    const start =
        (ia & 1) ? segs[ia - 1] :
        (ia === 0 && segs[0] == null) ? null :
        a;

    const end =
        (ib & 1) ? segs[ib] :
        (ib === segs.length && segs[segs.length - 1] == null) ? null :
        b;

    const right = segs.slice(ib + (ib & 1));

    return [...left, start, end, ...right];
}

export function negativeCoverage(segs) {
    const n = segs.length;

    // Empty coverage → full infinite coverage
    if (n === 0) {
        return [null, null];
    }

    // Full infinite coverage → empty coverage
    if (n === 2 && segs[0] == null && segs[1] == null) {
        return [];
    }

    const out = [];

    // If coverage does NOT start at -∞, complement DOES
    if (segs[0] != null) {
        out.push(null);
    }

    // Flip interior boundaries
    out.push(...segs);

    // If coverage does NOT end at +∞, complement DOES
    if (segs[n - 1] != null) {
        out.push(null);
    }

    // Enforce even length
    if (out.length & 1) {
        out.pop();
    }

    return out;
}
