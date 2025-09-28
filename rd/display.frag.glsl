#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_frame;
uniform vec4 u_mouse;
out vec4 fragColor;

const float lensRadiusFactor = 1.0/5.0;

void main() {
    vec2 fragCoord = v_texCoord.xy * u_resolution.xy;
    vec2 uv = v_texCoord;
    vec2 data = texture(u_texture, uv).rg;
    vec3 image = vec3(data, 0.0);
    
    if (u_mouse.z > 0.0)
    {
        float radius = distance(fragCoord.xy, u_mouse.xy);
        float lensRadius = lensRadiusFactor * u_resolution.y;
        float circleMask = 
            step(lensRadius - 1.0, radius) * 
            (1.0 - step(lensRadius + 1.0, radius));
        image = mix(image, vec3(0.5), circleMask);
    }

    fragColor.rgb = image;
    fragColor.a = 1.0f;
}
