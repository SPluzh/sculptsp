uniform vec3 uClayColor;
uniform float uWetness;
uniform float uBumpStrength;
uniform float uNoiseScale;
uniform float uSSSIntensity;
uniform vec3 uSSSColor;
uniform mat3 uN;

// Dave Hoskins hash31: fast, sin-less, robust across GPUs
float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

// 3D Value Noise
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    // Cubic interpolation (smoothstep)
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(
            mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), u.x),
            u.y
        ),
        mix(
            mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), u.x),
            u.y
        ),
        u.z
    );
}

// Fast clay height: combines low-frequency pressed finger marks with high-frequency scratch details
float clayHeight(vec3 p) {
    vec3 warp = vec3(
        noise3(p * 0.3),
        noise3(p * 0.3 + vec3(1.7, 3.4, 5.1)),
        noise3(p * 0.3 + vec3(2.6, 1.2, 4.8))
    );
    float low = noise3((p + warp * 0.5) * 0.5);
    float high = noise3(p * 4.0);
    return low * 0.85 + high * 0.15;
}

vec3 computeWetClay(vec3 viewVertex, vec3 viewNormal, vec3 vertexColor, float masking, vec3 objPos) {
    // 1. Scale noise coordinates
    vec3 sp = objPos * uNoiseScale;
    
    // 2. Bump mapping with low instruction footprint (only 4 noise samples)
    float eps = 0.02;
    float nCenter = clayHeight(sp);
    float nX = clayHeight(sp + vec3(eps, 0.0, 0.0));
    float nY = clayHeight(sp + vec3(0.0, eps, 0.0));
    float nZ = clayHeight(sp + vec3(0.0, 0.0, eps));
    
    vec3 bump = vec3(nX - nCenter, nY - nCenter, nZ - nCenter) / eps;
    vec3 normal = getNormal(); // from ShaderBase.strings.fragColorFunction
    
    // Transform object-space bump vector to view space using normal matrix uN
    vec3 bumpedNormal = normalize(normal - (uN * bump) * uBumpStrength * 0.15);
    
    // 3. Curvature color variation: darker in crevices, lighter on ridges
    float curvature = clamp(dot(normalize(viewNormal), normalize(-viewVertex)) * 0.5 + 0.5, 0.0, 1.0);
    
    vec3 baseClayColor = uClayColor.x >= 0.0 ? uClayColor : vertexColor;
    vec3 linClayColor = sRGBToLinear(baseClayColor);
    
    // Wet clay tones are darker and richer, dry tones are lighter
    vec3 wetClayColor = linClayColor * vec3(0.55, 0.5, 0.48);
    vec3 dryClayColor = linClayColor * vec3(1.15, 1.1, 1.05);
    vec3 baseColor = mix(wetClayColor, dryClayColor, curvature);
    
    // 4. Wrap lighting (Subsurface Scattering approximation)
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8)); // light source in view space
    float wrap = 0.35;
    float NdotL = clamp((dot(bumpedNormal, lightDir) + wrap) / (1.0 + wrap), 0.0, 1.0);
    vec3 diffuse = baseColor * NdotL;
    
    // Reddish translucent SSS glow in back-lit regions
    float sssFactor = pow(clamp(dot(bumpedNormal, lightDir) * -0.5 + 0.5, 0.0, 1.0), 2.0);
    vec3 sss = uSSSColor * uSSSIntensity * sssFactor * baseColor;
    
    // 5. Specular reflections for wet gloss
    vec3 halfDir = normalize(normalize(-viewVertex) + lightDir);
    float NoH = max(dot(bumpedNormal, halfDir), 0.0);
    
    // Dynamic specular roughness (hand-worked clay is glossy in smoothed zones)
    float wetNoise = noise3(sp * 1.5 + vec3(10.0));
    float roughness = mix(0.7, 0.08, uWetness * (0.4 + 0.6 * wetNoise));
    float shininess = 2.0 / (roughness * roughness) - 2.0;
    float specFactor = pow(NoH, shininess) * (1.0 - roughness);
    
    vec3 specColor = vec3(0.9, 0.95, 1.0) * specFactor * uWetness;
    
    // 6. Ambient Occlusion (AO) from crevices
    float ao = mix(1.0, 0.5, clamp((0.5 - nCenter) * 2.0, 0.0, 1.0));
    
    // 7. Assemble final shading
    vec3 finalColor = (diffuse + sss) * ao + specColor;
    finalColor += baseColor * 0.15 * ao; // Ambient light contribution
    
    return finalColor;
}
