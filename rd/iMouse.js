import { Screen } from './screen_events.js'

let iMouse = {x:undefined, y:undefined, z:undefined, w:undefined};
let isMouseDown = false;

export function iMouseInit(canvas)
{
    const screen = new Screen(canvas);

    screen.addEventListener('move', (e) => {
        iMouse.x = e.movePos.x;
        iMouse.y = screen.getCanvasHeight() - e.movePos.y;
        if (isMouseDown) {
            iMouse.z = iMouse.x;
            iMouse.w = iMouse.y;
        }
        else {
            iMouse.z = 0;
            iMouse.w = 0;
        }
    });

    screen.addEventListener('down', (e) => {
        isMouseDown = true;
        iMouse.z = e.startPos.x;
        iMouse.w = e.startPos.y;
    });

    screen.addEventListener('up', () => {
        isMouseDown = false;
        iMouse.z = 0;
        iMouse.w = 0;
    });

/*
    screen.addEventListener('out', () => {
        isMouseDown = false;
        iMouse.x = 0;
        iMouse.y = 0;
        iMouse.z = 0;
        iMouse.w = 0;
    });
*/
    return iMouse;
}

