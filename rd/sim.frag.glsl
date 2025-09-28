#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform float u_time;
out vec4 fragColor;

void main() {
    float c = 0.5 + 0.5 * sin(20.0 * v_texCoord.x + u_time);
    fragColor = vec4(c, 0.2, 1.0-c, 1.0);
}
