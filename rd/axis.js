// --- Axis drawing ---
export function drawAxesAroundCanvas(axisCanvas, options = {
    xMax: 1,
    yMax: 1,
    xTickStep: 0.1,
    yTickStep: 0.1,
    xName: "X Axis",
    yName: "Y Axis"
}) 
{
    const ctx2d = axisCanvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const rect = axisCanvas.getBoundingClientRect();

    axisCanvas.width = rect.width * dpr;
    axisCanvas.height = rect.height * dpr;

    // Scale drawing coordinates so 1 unit = 1 CSS pixel
    ctx2d.scale(dpr, dpr);

    const w = axisCanvas.width;
    const h = axisCanvas.height;
    
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.strokeStyle = "rgba(0, 153, 255, 1)";
    ctx2d.fillStyle = "rgba(0, 153, 255, 1)";
    ctx2d.lineWidth = 1;
    ctx2d.font = "12px sans-serif";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "top";
    

    // X axis
    ctx2d.beginPath();
    ctx2d.moveTo(0, h);
    ctx2d.lineTo(w, h);
    ctx2d.stroke();

    // Y axis
    ctx2d.beginPath();
    ctx2d.moveTo(0, h);
    ctx2d.lineTo(0, 0);
    ctx2d.stroke();

    // X ticks and labels
    const xMin = 0;
    const xTicks = Math.floor(options.xMax / options.xTickStep);
    const xMax = options.xMax;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "bottom";
    for (let i = 0; i <= xTicks; i++) {
        const t = i / xTicks;
        const x = t * w;
        const value = xMin + t * (xMax - xMin);
        ctx2d.beginPath();
        ctx2d.moveTo(x, h);
        ctx2d.lineTo(x, h - 5);
        ctx2d.stroke();
        if (i == 0)
            continue; // don't write colliding 0
        else if (i == xTicks)
            ctx2d.textAlign = "right";
        else
            ctx2d.textAlign = "center";
        ctx2d.fillText(value.toFixed(2), x, h - 8);
    }

    // Y ticks and labels
    const yMin = 0;
    const yTicks = Math.floor(options.yMax / options.yTickStep);
    const yMax = options.yMax;
    ctx2d.textAlign = "left";
    ctx2d.textBaseline = "middle";
    for (let i = 0; i <= yTicks; i++) {
        const t = i / yTicks;
        const y = h - t * h;
        const value = yMin + t * (yMax - yMin);
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(5, y);
        ctx2d.stroke();
        if (i == 0)
            continue; // don't write colliding 0
        else if (i == yTicks)
            ctx2d.textBaseline = "top";
        else
            ctx2d.textBaseline = "middle";
        ctx2d.fillText(value.toFixed(2), 8, y);
    }

    // Axis labels
    ctx2d.textAlign = "right";
    ctx2d.textBaseline = "bottom";
    ctx2d.fillText(options.xName, w - 10, h - 30);

    ctx2d.textAlign = "left";
    ctx2d.textBaseline = "top";
    ctx2d.fillText(options.yName, 40, 10);
}
