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

struct EPICImageInfo
{
    sampler2D texture;
    bool hasTexture; 
    float centroid_lat;
    float centroid_lon;
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

mat3 getLatLonNorthRotationMatrix(float latitudeDeg, float longitudeDeg) 
{
    float lat = radians(latitudeDeg);
    float lon = radians(longitudeDeg);

    vec3 z = vec3(
        - cos(lat) * cos(lon),
        - sin(lat),
        cos(lat) * sin(lon)
    );

    vec3 tmpY = vec3(0.0, 1.0, 0.0);

    vec3 x = normalize(cross(tmpY, z));
    vec3 y = normalize(cross(z, x));

    return transpose(mat3(x, y, z)); // columns: X (east), Y (north), Z (outward)
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

    /*
    // Shading
    vec3 Night = 
        texture(texEarthLights, earthMap_uv).rgb;

    LightDir *= transpose(GroundMatrix);
    float Diffuse     = dot(GroundNormal, LightDir);
    vec3 Color = mix(Night, GroundMap, smoothstep(-0.2, 0.2, Diffuse));// * Light
    vec3 GroundReflection = reflect(vec3(0.0, 0.0, 1.0), GroundNormal);
    float Specular    = max(0.0, dot(-GroundReflection, LightDir));
    float Scatter     = 4.0*pow((sqrt(R1 - dot(uv, uv)) - Normal.z) / sqrt(R1-R0), 1.35);
    float Extinct     = pow(1.0 - Diffuse, 4.0);
    float Sea         = smoothstep(1.0, 0.0, 100.0*length(GroundMap - RGB(2,5,20)));

    vec3 Light = mix(vec3(1.0), RGB(255, 150, 40), Extinct);

    vec3 Color = GroundMap;
    Color += 0.8*Sea*RGB(19,35,60);
    Color *= Light*Diffuse;
    Color += 2.0*Light*Diffuse*(0.3)*mix(0.03, 0.4, Sea)*pow(Specular, (0.8)*mix(9.0, 200.0, Sea));
    Color += pow(max(0.0, dot(Normal, -LightDir)), 2.0)*Night;
    Color *= mix(vec3(1.0), RGB(255-58,255-72,255-90), 1.0*Scatter);
    Color += 4.0*Diffuse*(1.0 + Sea)*Scatter*RGB(58,72,90);
    Color += Sun*RGB(255,250,230);
    return Color;
    */
    return GroundMap;
}

vec3 RenderEpicImage(vec3 GroundNormal, EPICImageInfo epicImage)
{
    // Epic image rotation from ground
    mat3 EpicMatrix0 = transpose(
            getLatLonNorthRotationMatrix(epicImage.centroid_lat, epicImage.centroid_lon));

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

    mat3 GroundMatrix = getLatLonNorthRotationMatrix(centroidLat, centroidLon);

    vec4 pivot_circle_color = vec4(0.0, 0.0, 0.0, 0.0);
    float pivot_circle_radius = 200.0;
    float pivot_circle_descent = 200.0;

    if (epicZoom)
    {
        vec2 press_fragCoord = vec2(pivotScreenCoord.x, iResolution.y - pivotScreenCoord.y);
        vec2 press_uv = fragCoordToUV(press_fragCoord);

        vec2 pivot_earth_uv = press_uv / pivot_epicImage.earth_radius;
        vec3 pivot_Normal     = vec3(pivot_earth_uv, sqrt(1.0 - dot(pivot_earth_uv, pivot_earth_uv)));
        mat3 pivot_GroundMatrix = getLatLonNorthRotationMatrix(
            pivot_epicImage.centroid_lat, 
            pivot_epicImage.centroid_lon);
        pivot_Normal *= pivot_GroundMatrix;
        pivot_Normal *= transpose(GroundMatrix);
        if (pivot_Normal.z >= 0.0)
        {
            vec2 pivot_uv = pivot_Normal.xy * pivot_epicImage.earth_radius;

            uv -= press_uv;
            uv /= epicZoomFactor;
            uv += pivot_uv;

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

    // Normal from UV:
    float earth_radius = curr_epicImage.earth_radius;
    vec3 Normal     = vec3(uv, sqrt(earth_radius * earth_radius - dot(uv, uv)));
    Normal /= earth_radius;

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

    col = mix(col, pivot_circle_color.rgb, pivot_circle_color.a);

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
