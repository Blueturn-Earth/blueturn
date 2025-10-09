#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_frame;
uniform vec4 u_mouse;
out vec4 fragColor;

vec2 Diffusion = vec2(0.08, 0.03);
float F = 0.035;
float k = 0.059;
float dt = 2.;
const float lensRadiusFactor = 1.0/5.0;

vec2 laplacian4(vec2 position, sampler2D image, vec2 resolution) 
{
    vec3 e = vec3(1. / resolution.xy, 0.);
	return vec2(0., 0.) 
	+ texture( image,  position - e.xz ).xy
	+ texture( image,  position + e.xz ).xy
	+ texture( image,  position - e.zy ).xy
	+ texture( image,  position + e.zy ).xy
	- texture( image,  position + e.zz ).xy * 4.;
}

vec2 laplacian9(vec2 position, sampler2D image, vec2 resolution) 
{
    vec3 e = vec3(vec2(1., -1.) / resolution.yy, 0.);
	return vec2(0., 0.) 
	+ texture( image,  position - e.xz ).xy
	+ texture( image,  position + e.xz ).xy
	+ texture( image,  position - e.zy ).xy
	+ texture( image,  position + e.zy ).xy
	+ texture( image,  position + e.xx ).xy * .5
	+ texture( image,  position + e.xy ).xy * .5
	+ texture( image,  position + e.yx ).xy * .5
	+ texture( image,  position + e.yy ).xy * .5
	- texture( image,  position + e.zz ).xy * 6.;
}

vec2 laplacian(vec2 position, sampler2D image, vec2 resolution) 
{
    return laplacian9(position, image, resolution);
}

vec2 ReactionDiffusionGS(vec2 position, sampler2D image, vec2 resolution)
{
    vec2 data = texture(image, position).rg;
    float u = data.x;
    float v = data.y;
    vec2 Duv = laplacian9(position, image, resolution)*Diffusion;
    float du = Duv.x - u*v*v +  F      * (1. - u);
    float dv = Duv.y + u*v*v - (F + k) * v;
    return clamp(vec2(u + du*dt, v + dv*dt), 0., 1.);
}

vec2 ReactionDiffusion(vec2 position, sampler2D image, vec2 resolution) 
{
    return ReactionDiffusionGS(position, image, resolution);
}

void main() {    
    fragColor.ba = vec2(0.0, 1.0);
    if (u_frame == 0)
    {
        fragColor.rg = sin(300.0 * v_texCoord);
        return;
    }
        
    vec2 fragCoord = v_texCoord.xy * u_resolution.xy;

    float Fk_factor = 0.1;

    F = v_texCoord.y * Fk_factor;
    k = v_texCoord.x * Fk_factor;
    if (u_mouse.z > 0.0)
    {
        float lensRadius = lensRadiusFactor * u_resolution.y;
        float lensStep = 1.0 - step(lensRadius, distance(u_mouse.xy, fragCoord.xy));
        vec2 mousePos = u_mouse.xy / u_resolution.xy;
        float uniform_F = mousePos.y * Fk_factor;
        float uniform_k = mousePos.x * Fk_factor;
        F = mix(F, uniform_F, lensStep);
        k = mix(k, uniform_k, lensStep);
    }
    fragColor.rg = ReactionDiffusion(v_texCoord, u_texture, u_resolution.xy);
}