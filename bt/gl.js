//import { vec3, mat3 } from 'https://esm.sh/gl-matrix';

import { 
  gEpicTime, 
  gUpdateEpicTime, 
  gEpicZoomPivotScreenCoord,
  gEpicImageData, 
  gPivotEpicImageData,
  gEpicImageData0, 
  gEpicImageData1, 
  gEpicZoom,
  gUpdateDateText
} 
from './app.js';
import { gEpicEndTimeSec, gEpicStartTimeSec } from './epic.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

let epicZoom = 1.0;
let epicMaxZoom = 2.0;

// Load shader from file
async function loadShaderSource(url) {
  const res = await fetch(url);
  return res.text();
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Error compiling shader: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
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
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }
  return program;
}

function createTextureFromImage(image, tex = undefined) {
  if (!tex)
  {
    tex = gl.createTexture();
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

function createTextureFromURL(url) {
  const tex = gl.createTexture();
  const image = new Image();
  image.src = url;
  image.onload = () => {
    createTextureFromImage(image, tex);
  };
  return tex;
}

function createTextureFromBlob(blob) {
  const tex = gl.createTexture();
  const image = new Image();
  image.src = URL.createObjectURL(blob);
  image.onload = () => {
    createTextureFromImage(image, tex);
    URL.revokeObjectURL(image.src);
  };
  return tex;
}



function setActiveTexture(program, uniformName, tex, unit)
{
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  let uniformLocation = gl.getUniformLocation(program, uniformName)
  gl.uniform1i(uniformLocation, unit);
}

let nextTextureUnit = 1;
let epicTexUnit = new Map();

function glLoadEpicTexture(program, epicImageData, epicStructUniformName)
{
  if (!epicImageData.image)
    return;
  const epicTextureUniformName = epicStructUniformName + '.texture';
  const epicHasTextureUniformName = epicStructUniformName + '.hasTexture';
  if (!epicImageData.texture)
  {
    if (!epicImageData.imageBlob)
    {
      setActiveTexture(program, epicTextureUniformName, null, 0);
      gl.uniform1i(gl.getUniformLocation(program, epicHasTextureUniformName), 0);
      return;
    }
    
    epicImageData.texture = createTextureFromBlob(epicImageData.imageBlob);
    epicImageData.imageBlob = null;
  }

  if (!epicTexUnit.get(epicTextureUniformName))
  {
    epicTexUnit.set(epicTextureUniformName, nextTextureUnit);
    nextTextureUnit++;
  }
  setActiveTexture(program, epicTextureUniformName, epicImageData.texture, epicTexUnit.get(epicTextureUniformName));
  gl.uniform1i(gl.getUniformLocation(program, epicHasTextureUniformName), 1);
}

function loadTextureFromURL(program, path, uniformName)
{
  const tex = createTextureFromURL(path);
  setActiveTexture(program, uniformName, tex, nextTextureUnit);
  nextTextureUnit++;
  return tex;
}

const vsSource = `#version 300 es
in vec2 a_position;
out vec2 vertUV;
void main() {
  vertUV = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0, 1);
}
`;

Promise.all([
  loadShaderSource('./bt/epic_earth.frag.glsl'),
]).then(([fsSource]) => {
  const program = createProgram(gl, vsSource, fsSource);
  gl.useProgram(program);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1, 1,   1, -1,   1, 1,
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Load textures
  loadTextureFromURL(program, './bt/images/world2.jpg', 'texEarthGround');
  loadTextureFromURL(program, './bt/images/light2.jpg', 'texEarthLights');

  // Set uniforms
  const resLoc = gl.getUniformLocation(program, 'iResolution');

  function glUpdateEPICImage(epicImageData, epicImageUniformName)
  {
    if (epicImageData)
    {
      gl.uniform1f(gl.getUniformLocation(program, epicImageUniformName + '.centroid_lat'), epicImageData.centroid_coordinates.lat);
      gl.uniform1f(gl.getUniformLocation(program, epicImageUniformName + '.centroid_lon'), epicImageData.centroid_coordinates.lon);
      gl.uniform1f(gl.getUniformLocation(program, epicImageUniformName + '.earth_radius'), epicImageData.earthRadius);
      if (epicImageData.lightDir)
      {
        gl.uniform3f(gl.getUniformLocation(program, epicImageUniformName + '.lightDir'), 
          epicImageData.lightDir.x,
          epicImageData.lightDir.y,
          epicImageData.lightDir.z);
      }
      glLoadEpicTexture(program, epicImageData, epicImageUniformName);
    }  
  }

  function glUpdateUniforms()
  {
    glUpdateEPICImage(gEpicImageData0, 'epicImage[0]');
    glUpdateEPICImage(gEpicImageData1, 'epicImage[1]');
    glUpdateEPICImage(gEpicImageData, 'curr_epicImage');
    if (gEpicZoom)
    {
      epicZoom += 0.03 * (epicMaxZoom - epicZoom); 
      glUpdateEPICImage(gPivotEpicImageData, 'pivot_epicImage');
    }
    else
    {
      epicZoom += 0.03 * (1.0 - epicZoom); 
    }
    gl.uniform1f(gl.getUniformLocation(program, 'curr_epicImage.mix01'), gEpicImageData.mix01 );
    gl.uniform1i(gl.getUniformLocation(program, 'epicZoom'), gEpicZoom);
    gl.uniform1f(gl.getUniformLocation(program, 'epicZoomFactor'), epicZoom);
    if (gEpicZoomPivotScreenCoord)
      gl.uniform2f(gl.getUniformLocation(program, 'pivotScreenCoord'), gEpicZoomPivotScreenCoord.x, gEpicZoomPivotScreenCoord.y);
  }

  function render(time) 
  {
    // Nothing to show without bound times
    if (gEpicStartTimeSec && gEpicEndTimeSec)
    {
      gUpdateEpicTime(time);
      glUpdateUniforms();
    
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(resLoc, canvas.width, canvas.height, 1.0);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gUpdateDateText(gEpicTime);
    }    
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
});
