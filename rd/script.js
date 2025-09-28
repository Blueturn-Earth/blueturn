const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
document.body.appendChild(canvas);
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

// Création textures ping-pong
function createFBOTexture() {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}

let pingpong = [];
pingpong.push(createFBOTexture());
pingpong.push(createFBOTexture());
const framebuffer = gl.createFramebuffer();

let time = 0;
let frame = 0;
let resolution = {w:512, h:512};
let renderPingPongIndex = 0;
function render() {
    let ping = pingpong[renderPingPongIndex];
    let pong = pingpong[1 - renderPingPongIndex];

    // --- Simulation pass (render to ping) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ping, 0);
    gl.viewport(0,0,512,512);
    gl.useProgram(simProgram);
    setupAttributes(simProgram);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'u_time'), time);
    gl.uniform1i(gl.getUniformLocation(simProgram, 'u_frame'), frame);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'u_resolution'), resolution.w, resolution.h);
    // Read from pong
    gl.uniform1i(gl.getUniformLocation(simProgram, 'u_texture'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pong);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // --- Display pass (affiche ping) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.useProgram(dispProgram);
    setupAttributes(dispProgram);
    // Read from ping
    gl.uniform1i(gl.getUniformLocation(dispProgram, 'u_texture'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    time += 0.02;
    frame++;
    renderPingPongIndex = 1 - renderPingPongIndex;

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