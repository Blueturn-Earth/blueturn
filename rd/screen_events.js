// © 2025 Blueturn - Michael Boccara. 
// Licensed under CC BY-NC-SA 4.0.
// See https://creativecommons.org/licenses/by-nc-sa/4.0/

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

export class Screen
{
    #events = new Map();
    #startPos = undefined;
    #startTime = undefined;
    #lastMovePos = undefined;
    #lastMoveTime = undefined;
    #lastMove2Vector = undefined;
    #canvas;

    constructor(canvas)
    {
        this.#canvas = canvas;

        // Supported events
        this.#events.set("move", []);
        this.#events.set("drag", []);
        this.#events.set("drag-x", []);
        this.#events.set("drag-y", []);
        this.#events.set("down", []);
        this.#events.set("long-press", []);
        this.#events.set("up", []);
        this.#events.set("click", []);
        this.#events.set("double-click", []);
        this.#events.set("out", []);
        this.#events.set("mousewheel", []);
        this.#events.set("pinch", []);
        this.#events.set("key", []);
        this.#events.set("swype", []);
        this.#events.set("swype-left", []);
        this.#events.set("swype-right", []);
        this.#events.set("swype-up", []);
        this.#events.set("swype-down", []);

        let self = this;

        window.addEventListener("load", function(e) {
            // Mouse events
            self.#canvas.addEventListener("mousemove", e => {
                self.#handleMove(e.clientX, e.clientY, e);
            });

            self.#canvas.addEventListener("mouseup", e => {
                self.#handleEnd();
            });

            self.#canvas.addEventListener("mousedown", e => {
                self.#handleStart(e.clientX, e.clientY, e);
            });

            // Touch events
            self.#canvas.addEventListener("touchstart", e => {
                if (e.touches.length > 0) {
                    const t = e.touches[0];
                    self.#handleStart(t.clientX, t.clientY);
                }
                e.preventDefault();
            }, { passive: false });

            self.#canvas.addEventListener("touchmove", e => {
                switch(e.touches.length) {
                case 1:
                    const t = e.touches[0];
                    self.#handleMove(t.clientX, t.clientY);
                    break;
                case 2:
                    const t1 = e.touches[0];
                    const t2 = e.touches[0];
                    self.#handleMove2(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
                    break;
                }
                e.preventDefault();
            }, { passive: false });

            self.#canvas.addEventListener("touchend", e => {
                self.#handleEnd();
                e.preventDefault();
            }, { passive: false });

            document.addEventListener("mouseout", function(e) {
                self.#handleOut(e);
            });

            document.addEventListener("wheel", function(e) {
                self.#handleWheel(e);
            });

            // handle key press
            document.addEventListener("keyup", function(e) {
                self.#handleKey(e);
            });
        });

        // Test
        function logEvent(e)
        {
            console.log(e.eventStr + ": " + JSON.stringify(e));
        }

        this.addEventListener("down", logEvent);
        //this.addEventListener("move", logEvent);
        this.addEventListener("up", logEvent);
        this.addEventListener("out", logEvent);
        // //this.addEventListener("drag", logEvent);
        // //this.addEventListener("drag-x", logEvent);
        // //this.addEventListener("drag-y", logEvent);
        this.addEventListener("click", logEvent);
        this.addEventListener("long-press", logEvent);
        this.addEventListener("double-click", logEvent);
        // this.addEventListener("mousewheel", logEvent);
        // this.addEventListener("pinch", logEvent);
        this.addEventListener("key", logEvent);
        this.addEventListener("swype", logEvent);
        this.addEventListener("swype-left", logEvent);
        this.addEventListener("swype-right", logEvent);
        this.addEventListener("swype-up", logEvent);
        this.addEventListener("swype-down", logEvent);
        //
    }

    #MIN_DRAG_DISTANCE = 50;
    #MIN_DOUBLE_CLICK_DISTANCE = 80;
    #CLICK_TIMEOUT_MS = 200;
    #LONG_PRESS_TIME_MS = 500;
    #DOUBLE_CLICK_MAX_TIME_MS = 200;
    #MOVE_2_CROSS_THRESHOLD = 0.1;
    #PINCH_STEP_FACTOR = 50;
    #MIN_SWYPE_DISTANCE = 50;
    #SWYPE_TIMEOUT_MS = 300;

    getCanvasCoords(x, y) {
        const rect = this.#canvas.getBoundingClientRect();
        const pos = {
            x: (x - rect.left) * this.#canvas.width / rect.width,
            y: (y - rect.top) * this.#canvas.height / rect.height
        };
        //console.log("x=" + x + ", y=" + y + ", pos=" + JSON.stringify(pos) + ", rect=" + JSON.stringify(rect) + ", this.#canvas: " + this.#canvas.width + "x" + this.#canvas.height);
        return pos;
    }

    getCursorPos()
    {
        return this.#lastMovePos;
    }

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

    #handleMove(x, y, e = undefined) 
    {
        if (e)
        {
            gModifiersMask |= getModifierMask(e);
        }

        if (!e)
            e = {};

        e.movePos = this.getCanvasCoords(x, y);
        if (this.#lastMovePos)
        {
            e.deltaPos = {
                x: e.movePos.x - this.#lastMovePos.x,
                y: e.movePos.y - this.#lastMovePos.y
            };
            if (this.#lastMoveTime) {
                e.deltaTime = ((new Date()).getTime() - this.#lastMoveTime) / 1000.0;
                e.posSpeed = {
                    x: e.deltaPos.x / e.deltaTime,
                    y: e.deltaPos.y / e.deltaTime
                }

                if (gModifiersMask & Modifiers.LeftBtn)
                {
                    //console.log("deltaPos: " + JSON.stringify(e.deltaPos) + ", deltaTime: " + e.deltaTime + ", posSpeed: " + JSON.stringify(e.posSpeed));
                }
            }
        }
        this.#lastMovePos = e.movePos;
        this.#lastMoveTime = (new Date()).getTime();
        if (!(gModifiersMask & Modifiers.LeftBtn)) {
            e.startPos = undefined;
        }
        else
        {
            e.startPos = this.#startPos;
        }

        this.callEvent("move", e);

        if (gModifiersMask & Modifiers.LeftBtn) 
        {
            if (Math.abs(e.movePos.x - e.startPos.x) > this.#MIN_DRAG_DISTANCE || 
                Math.abs(e.movePos.y - e.startPos.y) > this.#MIN_DRAG_DISTANCE)
            {
                if (this.clickTimeout)
                {
                    clearTimeout(this.clickTimeout);
                    this.clickTimeout = undefined;
                }
                if (this.longPressTimeout)
                {
                    clearTimeout(this.longPressTimeout);
                    this.longPressTimeout = undefined;
                }
            }

            if (!this.clickTimeout) {
                e.dragPos = e.movePos;
                this.callEvent("drag", e);
                if (Math.abs(e.movePos.x - e.startPos.x) > this.#MIN_DRAG_DISTANCE)
                    this.callEvent("drag-x", e);
                if (Math.abs(e.movePos.y - e.startPos.y) > this.#MIN_DRAG_DISTANCE)
                    this.callEvent("drag-y", e);
            }
        }
    }

    #handleMove2(x1, y1, x2, y2) {
        const move2Vector = {
            x: x2 - x1,
            y: y2 - y1
        };
        if(!this.#lastMove2Vector)
        {
            this.#lastMove2Vector = move2Vector;
            return;
        }

        // cross-product
        const cross = this.#lastMove2Vector.x * move2Vector.y - this.#lastMove2Vector.y * move2Vector.x;
        // length of each vector
        const len1 = Math.sqrt(this.#lastMove2Vector.x * this.#lastMove2Vector.x + this.#lastMove2Vector.y * this.#lastMove2Vector.y);
        const len2 = Math.sqrt(move2Vector.x * move2Vector.x + move2Vector.y * move2Vector.y);

        if (Math.abs(cross) <= this.#MOVE_2_CROSS_THRESHOLD &&
            Math.abs(len2 - len1) > this.#canvas.width / this.#PINCH_STEP_FACTOR)
        {
            const ePinch = {
                pinchDelta: len2 - len1,
                pinchCenterPos: {
                    x: (x1 + x2) / 2,
                    y: (y1 + y2) / 2
                }
            };
            this.callEvent("pinch", ePinch);
        }
        this.#lastMove2Vector = {x: vectorX, y: vectorY};
    }

    #handleStart(x, y, e = undefined) {
        if (!e)
            e = {};
        e.startPos = this.getCanvasCoords(x, y);
        this.#startPos = this.#lastMovePos = e.startPos;
        this.#startTime = (new Date()).getTime();
        this.#lastMoveTime = undefined;
        gModifiersMask = gModifiersMask | Modifiers.LeftBtn;
        e.modifierMask = gModifiersMask;

        if(e)
        {
            gModifiersMask |= getModifierMask(e);
        }

        this.callEvent("down", e);

        this.clickCancelled = false;

        if (!this.clickTimeout)
        {
            this.clickTimeout = setTimeout(
                () => {
                    this.clickTimeout = undefined;
                }, 
                this.#CLICK_TIMEOUT_MS);
        }

        if (!this.longPressTimeout)
        {
            this.longPressTimeout = setTimeout(() => {
                this.longPressTimeout = undefined;
                this.clickCancelled = true;
                this.callEvent("long-press", e);
            }, this.#LONG_PRESS_TIME_MS);
        }
    }

    #trySwype() 
    {
        if (!this.#lastMoveTime || !this.#startTime)
        {
            return false;
        }
        const dragDuration = this.#lastMoveTime - this.#startTime;
        const dragDelta = {
            x: this.#lastMovePos.x - this.#startPos.x,
            y: this.#lastMovePos.y - this.#startPos.y
        };
        console.log("try swype delta: x=" + dragDelta.x + ", y=" + dragDelta.y + ", time=" + dragDuration);

        if (dragDuration < this.#SWYPE_TIMEOUT_MS &&
            (Math.abs(dragDelta.x) > this.#MIN_SWYPE_DISTANCE ||
             Math.abs(dragDelta.y) > this.#MIN_SWYPE_DISTANCE))
        {
            const swypeSpeedVector = {
                x: dragDelta.x / dragDuration,
                y: dragDelta.y / dragDuration
            };
            const swypeSpeed = Math.sqrt(
                swypeSpeedVector.x * swypeSpeedVector.x +
                swypeSpeedVector.y * swypeSpeedVector.y
            );

            const eSwype = {
                swypePos: this.#lastMovePos,
                swypeSpeed: swypeSpeed,
                swypeSpeedVector: swypeSpeedVector
            };
            this.callEvent("swype", eSwype);

            if (Math.abs(dragDelta.x) > Math.abs(dragDelta.y)) {
                if (dragDelta.x > 0)
                    this.callEvent("swype-right", eSwype);
                else
                    this.callEvent("swype-left", eSwype);
            }
            else
            {
                if (dragDelta.y < 0)
                    this.callEvent("swype-up", eSwype);
                else
                    this.callEvent("swype-down", eSwype);
            }

            return true;
        }

        return false;
    }

    #handleEnd() {
        gModifiersMask = gModifiersMask & ~Modifiers.LeftBtn;

        if (this.clickTimeout)
        {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = undefined;
        }

        if (this.longPressTimeout)
        {
            clearTimeout(this.longPressTimeout);
            this.longPressTimeout = undefined;
        }

        const eUp = {
            endPos: this.#lastMovePos
        };

        this.callEvent("up", eUp);

        if (this.#trySwype())
            return;

        if (!this.clickCancelled &&
            Math.abs(this.#lastMovePos.x - this.#startPos.x) < this.#MIN_DOUBLE_CLICK_DISTANCE &&
            Math.abs(this.#lastMovePos.y - this.#startPos.y) < this.#MIN_DOUBLE_CLICK_DISTANCE)
        {
            const eClick = {
                clickPos: this.#lastMovePos
            };
            if (this.doubleClickTimeout)
            {
                this.callEvent("double-click", eClick);
                clearTimeout(this.doubleClickTimeout);
                this.doubleClickTimeout = undefined;
            }
            else
            {
                this.callEvent("click", eClick);
                this.doubleClickTimeout = setTimeout(() => {
                    this.doubleClickTimeout = undefined;
                }, this.#DOUBLE_CLICK_MAX_TIME_MS);
            }
        }

    }

    #handleOut(e) 
    {
        gModifiersMask = gModifiersMask & ~Modifiers.LeftBtn;
        e = e ? e : window.event;
        var from = e.relatedTarget || e.toElement;
        if (!from || from.nodeName == "HTML") {
            const eOut = {
                lastPos: this.#lastMovePos
            }
            this.callEvent("out", eOut);
        }
    }

    #handleWheel(e)
    {
        const eWheel = {
            wheelPos: this.#lastMovePos,
            wheelDelta: e.wheelDelta,
            wheelDeltaMode: e.deltaMode
        };
        this.callEvent("mousewheel", eWheel);

    }

    #handleKey(e)
    {
        this.callEvent("key", {
            key: e.key,
            code: e.code,
            modifiers: getModifierMask(e)
        });
    }

    getCanvasWidth() {return this.#canvas.width;}
    getCanvasHeight() {return this.#canvas.height;}
}
