#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform sampler2D texEarthGround;
uniform sampler2D texEarthLights;

in vec2 vertUV;
out vec4 fragColor;

#define AA 2   // make this 2 or 3 for antialiasing

#define Pi 3.14159265359
#define d2r(a) ((a)*180.0/Pi)
#define RGB(r,g,b) pow(vec3(float(r), float(g), float(b))/255.0, vec3(2.22))

#define R0 1.0000	// Nomralized Earth radius (6360 km)
#define R1 1.0094	// Atmosphere radius (6420 km) 

uniform vec2 pivotScreenCoord;
uniform bool showPivotCircle;

struct EPICImageInfo
{
    sampler2D texture;
    bool hasTexture; 
    float centroid_lat;
    float centroid_lon;
    mat3 centroid_matrix;
    float earth_radius;
    vec3 lightDir;
    float time_sec;
    float mix01;
};
uniform EPICImageInfo epicImage[2];
uniform EPICImageInfo curr_epicImage;
uniform bool epicZoom;
uniform float epicZoomFactor;
uniform EPICImageInfo pivot_epicImage;

vec2 fragCoordToUV(vec2 fragCoord)
{
   return (2.0 * fragCoord-iResolution.xy) / min(iResolution.x, iResolution.y)
    // top-down
    * vec2(1., -1.);
}

vec3 RenderSun(in vec2 uv)
{
    // Sun:
    vec3 LightDir = vec3(0.0, 0.0, 1.0);
    //vec3 LightDir = epicImage.lightDir;
    vec2 SunC = -5.0*LightDir.xy/LightDir.z - uv;
    float Halo = max(0.0, dot(LightDir, normalize(vec3(uv.x, uv.y, -5.0))));
    float Sun = 0.05*pow(Halo, 1000.0)*smoothstep(0.85, 1.3, length(SunC+uv));

    Sun += 1.5*pow(Halo, 10000.0);
    return Sun*RGB(255,250,230);
}

vec3 RenderBlueMarble(in vec3 GroundNormal)
{
    vec2 earthMap_uv = vec2(
        1.0-atan(GroundNormal.z, GroundNormal.x) / (2.0*Pi),
        1.0-(atan(length(GroundNormal.xz), GroundNormal.y)) / Pi);
    vec3 GroundMap = pow(
        texture(texEarthGround, earthMap_uv).rgb, 
        vec3(0.45));

    return GroundMap;
}

vec3 RenderEpicImage(vec3 GroundNormal, EPICImageInfo epicImage)
{
    // Epic image rotation from ground
    mat3 EpicMatrix0 = transpose(epicImage.centroid_matrix);

    // EPIC image Textures:
    vec3 EpicNormal0 = GroundNormal * EpicMatrix0;
    vec2 epic_uv0 = EpicNormal0.xy * epicImage.earth_radius * .5 - .5; // override with rotated uv
    return texture(epicImage.texture, epic_uv0).rgb;
}

vec3 Render(in vec2 fragCoord)
{
    vec2 uv = fragCoordToUV(fragCoord);

    // Common ground rotation from lat, lon
    float centroidLat = curr_epicImage.centroid_lat;
    float centroidLon = curr_epicImage.centroid_lon;

    mat3 GroundMatrix = curr_epicImage.centroid_matrix;

    vec4 pivot_circle_color = vec4(0.0, 0.0, 0.0, 0.0);
    float pivot_circle_radius = 200.0;
    float pivot_circle_descent = 200.0;

    if (epicZoom)
    {
        vec2 press_fragCoord = vec2(pivotScreenCoord.x, iResolution.y - pivotScreenCoord.y);
        vec2 press_uv = fragCoordToUV(press_fragCoord);

        vec2 pivot_uv = press_uv;

        pivot_uv /= pivot_epicImage.earth_radius;
        vec3 pivot_Normal     = vec3(pivot_uv, sqrt(1.0 - dot(pivot_uv, pivot_uv)));
        mat3 pivot_GroundMatrix = pivot_epicImage.centroid_matrix;
        pivot_Normal *= pivot_GroundMatrix;
        pivot_Normal *= transpose(GroundMatrix);
        if (pivot_Normal.z >= 0.0)
        {
            // overwrite pivot_uv with the rotated pivot_Normal
            pivot_uv = pivot_Normal.xy * pivot_epicImage.earth_radius;

            uv -= press_uv;
            uv /= epicZoomFactor;
            uv += pivot_uv;

            if (showPivotCircle)
            {
                float pixelToUVFactor = 1.0 / min(iResolution.x, iResolution.y);
                pivot_circle_radius *= 1.0 / (epicZoomFactor - 1.0); 
                pivot_circle_descent *= 1.0 / (epicZoomFactor - 1.0); 
                pivot_circle_color.a = 
                    smoothstep(
                        pivot_circle_radius * pixelToUVFactor, 
                        (pivot_circle_radius + pivot_circle_descent) * pixelToUVFactor,
                        length(uv - pivot_uv)) * 0.9;
            }
        }
    }

    // Normal from UV:
    float earth_radius = curr_epicImage.earth_radius;
    vec2 pixel_uv = uv / earth_radius;
    vec3 Normal     = vec3(pixel_uv, sqrt(1.0 - dot(pixel_uv, pixel_uv)));

    // Sphere hit:
    if(Normal.z < 0.0)
    {
        return RenderSun(uv);
    }
    	
    vec3 GroundNormal = Normal * GroundMatrix;

    vec3 col;
    if (!epicImage[0].hasTexture ||
        !epicImage[1].hasTexture)
    {
        col = RenderBlueMarble(GroundNormal);
    }
    else
    {
        vec3 GroundEpic0 = RenderEpicImage(GroundNormal, epicImage[0]);
        vec3 GroundEpic1 = RenderEpicImage(GroundNormal, epicImage[1]);
        col = mix(GroundEpic0, GroundEpic1, vec3(curr_epicImage.mix01));
    }

    if (showPivotCircle)
    {
        col = mix(col, pivot_circle_color.rgb, pivot_circle_color.a);
    }

    return col;
}

void main() 
{
    vec3 tot = vec3(0.0);
    vec2 fragCoord = vertUV * iResolution.xy;

    vec2 o = vec2(0.0);
#if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // pixel coordinates
        o = vec2(float(m),float(n)) / float(AA) - 0.5;
#endif
        vec3 col = Render(fragCoord + o);
        tot += col;
#if AA>1
    }
    tot /= float(AA*AA);
#endif
    
    fragColor = vec4(tot, 1.0 );
}
