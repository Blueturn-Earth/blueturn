let iMouse = {x:undefined, y:undefined, z:undefined, w:undefined};
let isMouseDown = false;

export function iMouseInit(canvas)
{
    canvas.addEventListener('mousemove', (e) => {
        iMouse.x = e.clientX;
        iMouse.y = window.innerHeight - e.clientY; // Invert Y for WebGL coordinates
        if (isMouseDown) {
            iMouse.z = iMouse.x;
            iMouse.w = iMouse.y;
        }
        else {
            iMouse.z = 0;
            iMouse.w = 0;
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        iMouse.z = e.clientX;
        iMouse.w = window.innerHeight - e.clientY; // Invert Y for WebGL coordinates
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
        iMouse.z = 0;
        iMouse.w = 0;
    });

    return iMouse;
}

