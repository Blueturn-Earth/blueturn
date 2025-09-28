const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
document.body.appendChild(canvas);
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL non supporté.');
}

// Shaders GLSL : un shader d'affichage + un shader de simulation simple
const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
        gl_Position = a_position;
        v_texCoord = a_texCoord;
    }
`;

// Shader pour la simulation (sinusoïdale simple pour voir quelque chose bouger)
const simulationFragmentSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform float u_time;
    void main() {
        float c = 0.5 + 0.5 * sin(20.0 * v_texCoord.x + u_time);
        gl_FragColor = vec4(c, 0.2, 1.0-c, 1.0);
    }
`;

// Shader pour affichage (recopie texture)
const displayFragmentSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
`;

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

// Programmes
const simProgram = createProgram(gl, vertexShaderSource, simulationFragmentSource);
const dispProgram = createProgram(gl, vertexShaderSource, displayFragmentSource);

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

const ping = createFBOTexture();
const pong = createFBOTexture();
const framebuffer = gl.createFramebuffer();

// =====================
// Tentative WebCL
// =====================
let useWebCL = false;
try {
    const webcl = window.WebCL;
    if (webcl) {
        const platforms = webcl.getPlatformIDs();
        const devices = webcl.getDeviceIDs(platforms[0], webcl.DEVICE_TYPE_GPU);
        const contextCL = webcl.createContext({ devices: devices, sharedGroup: gl });
        const queue = contextCL.createCommandQueue(devices[0]);

        const kernelSource = `
            __kernel void reaction_diffusion(__write_only image2d_t output) {
                int2 gid = (int2)(get_global_id(0), get_global_id(1));
                float4 color = (float4)(0.5f, 0.5f, 0.5f, 1.0f);
                color.r = 0.5f + 0.5f * sin((float)(gid.x + gid.y) * 0.1f);
                write_imagef(output, gid, color);
            }
        `;
        const programCL = contextCL.createProgramWithSource(kernelSource);
        programCL.build([devices[0]]);
        const kernel = programCL.createKernel('reaction_diffusion');

        const clTexture = contextCL.createFromGLTexture(webcl.MEM_WRITE_ONLY, ping, 0);
        kernel.setArg(0, clTexture);

        function computeNextIteration() {
            queue.enqueueAcquireGLObjects([clTexture]);
            queue.enqueueNDRangeKernel(kernel, 2, null, [512, 512]);
            queue.enqueueReleaseGLObjects([clTexture]);
            queue.finish();
            setTimeout(computeNextIteration, 0);
        }
        computeNextIteration();
        useWebCL = true;
    }
    else {
        console.warn('WebCL non supporté, fallback WebGL-only utilisé.');
    }
} catch (e) {
    console.warn('WebCL failed, fallback WebGL-only utilisé: ' + e);
}

let time = 0;
function render() {
    time += 0.02;

    if (!useWebCL) {
        // --- Simulation pass (rend dans ping) ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ping, 0);
        gl.viewport(0,0,512,512);
        gl.useProgram(simProgram);
        setupAttributes(simProgram);
        const timeLoc = gl.getUniformLocation(simProgram, 'u_time');
        gl.uniform1f(timeLoc, time);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // --- Display pass (affiche ping) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.useProgram(dispProgram);
    setupAttributes(dispProgram);
    const texLoc = gl.getUniformLocation(dispProgram, 'u_texture');
    gl.uniform1i(texLoc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ping);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}
render();
