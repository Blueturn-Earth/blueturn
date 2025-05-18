let canvas = document.getElementById('glcanvas');

export const Modifiers = {
  LeftBtn:      1 << 0, // 00000001
  MiddleBtn:    1 << 1, // 00000010
  RightButton:  1 << 2, // 00000100
  NotUsed_:     1 << 3, // 00001000
  Shift:        1 << 4, // 00010000
  Ctrl:         1 << 5, // 00100000
  Alt:          1 << 6, // 01000000
  Meta:         1 << 7  // 10000000
};

function getModifierMask(e) {
    let mask = 0;
    if (e.shiftKey) mask |= Modifiers.Shift;
    if (e.ctrlKey)  mask |= Modifiers.Ctrl;
    if (e.altKey)   mask |= Modifiers.Alt;
    if (e.metaKey)  mask |= Modifiers.Meta;
    return mask;
}
export let gModifiersMask = 0;

function getCanvasCoords(x, y) {
    const rect = canvas.getBoundingClientRect();
    const pos = {
        x: (x - rect.left) * canvas.width / rect.width,
        y: (y - rect.top) * canvas.height / rect.height
    };
    //console.log("x=" + x + ", y=" + y + ", pos=" + JSON.stringify(pos) + ", rect=" + JSON.stringify(rect) + ", canvas: " + canvas.width + "x" + canvas.height);
    return pos;
}

class Screen
{
    #events = new Map();
    #startPos = undefined;
    #lastMovePos = undefined;

    get startPos() {
        return this.#startPos;
    }

    constructor()
    {
        // Supported events
        this.#events.set("move", []);
        this.#events.set("drag", []);
        this.#events.set("down", []);
        this.#events.set("long-press", []);
        this.#events.set("up", []);
        this.#events.set("click", []);
        this.#events.set("double-click", []);
        this.#events.set("out", []);

        let self = this;
        window.addEventListener("load", function(e) {
            // Mouse events
            canvas.addEventListener("mousemove", e => {
                self.#handleMove(e.clientX, e.clientY, e);
            });

            canvas.addEventListener("mouseup", e => {
                self.#handleEnd();
            });

            canvas.addEventListener("mousedown", e => {
                self.#handleStart(e.clientX, e.clientY, e);
            });

            // Touch events
            canvas.addEventListener("touchstart", e => {
                if (e.touches.length > 0) {
                    const t = e.touches[0];
                    self.#handleStart(t.clientX, t.clientY);
                }
                e.preventDefault();
            }, { passive: false });

            canvas.addEventListener("touchmove", e => {
                if (e.touches.length > 0) {
                    const t = e.touches[0];
                    self.#handleMove(t.clientX, t.clientY);
                }
                e.preventDefault();
            }, { passive: false });

            canvas.addEventListener("touchend", e => {
                self.#handleEnd();
                e.preventDefault();
            }, { passive: false });

            document.addEventListener("mouseout", function(e) {
                self.#handleOut(e);
            });
        });
    }

    #CLICK_THRESHOLD = canvas.width / 50;
    #DOUBLECLICK_THRESHOLD = canvas.width / 30;
    #LONG_PRESS_TIME_MS = 500;
    #DOUBLE_CLICK_TIME_MS = 200;

    addEventListener(eventStr, cb)
    {
        let cbArray = this.#events.get(eventStr);
        if (!cbArray)
        {
            console.error("Unsupported event " + eventStr);
        }
        else
        {
            cbArray.push(cb);
        }
    }

    callEvent(eventStr, e)
    {
        let cbArray = this.#events.get(eventStr);
        if (!cbArray)
        {
            console.error("Unsupported event " + eventStr);
        }
        else
        {
            e.eventStr = eventStr;
            cbArray.forEach((cb) => cb(e));
        }
    }

    // Private section

    #handleMove(x, y, e = undefined) {
        if (e)
        {
            gModifiersMask |= getModifierMask(e);
        }

        if (!e)
            e = {};

        e.movePos = getCanvasCoords(x, y);
        this.#lastMovePos = e.movePos;
        if (!(gModifiersMask & Modifiers.LeftBtn)) {
            e.startPos = undefined;
        }
        else
        {
            e.startPos = this.#startPos;
        }

        this.callEvent("move", e);

        if (e.startPos)
        {
            if (Math.abs(e.movePos.x - e.startPos.x) > this.#CLICK_THRESHOLD || 
                Math.abs(e.movePos.y - e.startPos.y) > this.#CLICK_THRESHOLD)
            {
                if (this.longPressTimeout)
                {
                    clearTimeout(this.longPressTimeout);
                    this.longPressTimeout = undefined;
                }
            }
            e.dragPos = e.movePos;
            this.callEvent("drag", e);
        }
    }

    #handleStart(x, y, e = undefined) {
        if (!e)
            e = {};
        e.startPos = getCanvasCoords(x, y);
        this.#startPos = this.#lastMovePos = e.startPos;

        gModifiersMask = gModifiersMask | Modifiers.LeftBtn;
        e.modifierMask = gModifiersMask;

        if(e)
        {
            gModifiersMask |= getModifierMask(e);
        }

        this.callEvent("down", e);

        this.clickCancelled = false;

        if (!this.longPressTimeout)
        {
            this.longPressTimeout = setTimeout(() => {
                this.longPressTimeout = undefined;
                this.clickCancelled = true;
                this.callEvent("long-press", e);
            }, this.#LONG_PRESS_TIME_MS);
        }
    }

    #handleEnd() {
        gModifiersMask = gModifiersMask & ~Modifiers.LeftBtn;

        if (this.longPressTimeout)
        {
            clearTimeout(this.longPressTimeout);
            this.longPressTimeout = undefined;
        }

        const eUp = {
            endPos: this.#lastMovePos
        };

        this.callEvent("up", eUp);

        if (!this.clickCancelled &&
            Math.abs(this.#lastMovePos.x - this.#startPos.x) < this.#DOUBLECLICK_THRESHOLD &&
            Math.abs(this.#lastMovePos.y - this.#startPos.y) < this.#DOUBLECLICK_THRESHOLD)
        {
            const clickTimeMs = (new Date()).getTime();
            const eClick = {
                clickPos: this.#lastMovePos
            };
            this.callEvent("click", eClick);
            if (this.doubleClickTimeout)
            {
                this.callEvent("double-click", eClick);
                clearTimeout(this.doubleClickTimeout);
                this.doubleClickTimeout = undefined;
            }
            else
            {
                this.doubleClickTimeout = setTimeout(() => {
                    this.doubleClickTimeout = undefined;
                }, this.#DOUBLE_CLICK_TIME_MS);
            }
        }

    }

    #handleOut(e) 
    {
        e = e ? e : window.event;
        var from = e.relatedTarget || e.toElement;
        if (!from || from.nodeName == "HTML") {
            const eOut = {
                lastPos: this.#lastMovePos
            }
            this.callEvent("out", eOut);
        }
    }
}

export let gScreen = new Screen();

// Test
function logEvent(e)
{
    console.log(e.eventStr + ": " + JSON.stringify(e));
}

// gScreen.addEventListener("down", logEvent);
// //gScreen.addEventListener("move", logEvent);
// gScreen.addEventListener("up", logEvent);
// gScreen.addEventListener("out", logEvent);
// //gScreen.addEventListener("drag", logEvent);
// gScreen.addEventListener("click", logEvent);
// gScreen.addEventListener("long-press", logEvent);
// gScreen.addEventListener("double-click", logEvent);
//

function resize()
{
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth * dpr;
  const height = window.innerHeight * dpr;

  if (width != canvas.width ||
      height != canvas.height)
  {
    canvas.width = width;
    canvas.height = height;
  }
};

resize();

window.addEventListener('resize', resize);

