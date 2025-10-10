import {iMouseInit} from './iMouse.js'

const canvas = document.getElementById("canvas");

const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL non supporté.');
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Erreur compilation shader', gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Erreur link program', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Quad plein écran
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1, 1,-1, -1,1,
    -1,1, 1,-1, 1,1
]), gl.STATIC_DRAW);

const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0, 1,0, 0,1,
    0,1, 1,0, 1,1
]), gl.STATIC_DRAW);

var simProgram;
var dispProgram;

// Localisation attributs
function setupAttributes(program) {
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
}

let frame = 0;
var pingpong;
var ping;
var pong;


// Création textures ping-pong
function createTexture(width, height, old_tex, old_w, old_h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (old_tex) {
        const w = Math.min(old_w, width);
        const h = Math.min(old_h, height);

        const srcFb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFb);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, old_tex, 0);

        const dstFb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dstFb);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

        gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(srcFb);
        gl.deleteFramebuffer(dstFb);
    }

    return tex;
}

var resolution;

function resize()
{
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    console.log(`resize ${width}x${height}`);
    canvas.width = width;
    canvas.height = height;
    let new_pingpong = [];

    new_pingpong.push(createTexture(width, height, 
        pingpong ? pingpong[0] : null,
        resolution ? resolution[0] : 0,
        resolution ? resolution[1] : 0));
    new_pingpong.push(createTexture(width, height, 
        pingpong ? pingpong[1] : null,
        resolution ? resolution[0] : 0,
        resolution ? resolution[1] : 0));

    pingpong = new_pingpong;
    ping = pingpong[0];
    pong = pingpong[1];

    resolution = [width, height];

    // Set to 0 to restart from initial grid state
    //frame = 0;
}

window.addEventListener('resize', resize);
window.addEventListener('load', resize);

const framebuffer = gl.createFramebuffer();

let renderPingPongIndex = 0;

let iMouse = iMouseInit(canvas);

let nIterations = 30;

function render() {
    if (pingpong) {
        for (let i = 0; i < nIterations; i++)
        {
            ping = pingpong[renderPingPongIndex];
            pong = pingpong[1 - renderPingPongIndex];

            // --- Simulation pass (render to ping) ---
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ping, 0);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(simProgram);
            setupAttributes(simProgram);
            gl.uniform1i(gl.getUniformLocation(simProgram, 'u_frame'), frame);
            gl.uniform2f(gl.getUniformLocation(simProgram, 'u_resolution'), canvas.width, canvas.height);
            gl.uniform4f(gl.getUniformLocation(simProgram, 'u_mouse'), iMouse.x, iMouse.y, iMouse.z, iMouse.w);
            // Read from pong
            gl.uniform1i(gl.getUniformLocation(simProgram, 'u_texture'), 0);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pong);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            frame++;
            renderPingPongIndex = 1 - renderPingPongIndex;
        }

        // --- Display pass (affiche ping) ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.useProgram(dispProgram);
        setupAttributes(dispProgram);
        gl.uniform1i(gl.getUniformLocation(dispProgram, 'u_frame'), frame);
        gl.uniform2f(gl.getUniformLocation(dispProgram, 'u_resolution'), canvas.width, canvas.height);
        gl.uniform4f(gl.getUniformLocation(dispProgram, 'u_mouse'), iMouse.x, iMouse.y, iMouse.z, iMouse.w);
        // Read from ping
        gl.uniform1i(gl.getUniformLocation(dispProgram, 'u_texture'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, ping);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    requestAnimationFrame(render);
}

async function loadShaderSource(url) {
    const res = await fetch(url);
    return res.text();
}

async function runGraphics() {
    const vertexShaderSource = await loadShaderSource('./vertex.glsl');
    const simulationFragmentSource = await loadShaderSource('./sim.frag.glsl');
    const displayFragmentSource = await loadShaderSource('./display.frag.glsl');

    simProgram = createProgram(gl, vertexShaderSource, simulationFragmentSource);
    dispProgram = createProgram(gl, vertexShaderSource, displayFragmentSource);

    render();
}

Promise.all([runGraphics()]);