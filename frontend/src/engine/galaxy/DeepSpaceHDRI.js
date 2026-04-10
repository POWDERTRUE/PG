import * as THREE from 'three';

/**
 * DeepSpaceHDRI V2 — Cinematic Deep Space Background
 *
 * Procedural sphere (radius 45000u) with a multi-layer ShaderMaterial:
 *   1. Milky Way band — turbulent diagonal bright smear with dust lanes
 *   2. Galactic core — warm orange-yellow + volumetric density
 *   3. Multi-scale starfield — 4 density layers with temperature colors
 *   4. Star twinkle — animated using time uniform (subtle scintillation)
 *   5. Nebula wisps — 4 colored cloud layers (emission + reflection)
 *   6. Dark dust lanes crossing the Milky Way
 *   7. Faint galactic halo glow
 */
export class DeepSpaceHDRI {
    constructor() {
        this._sphere = null;
        this._time   = 0;
    }

    build(scene) {
        const geo = new THREE.SphereGeometry(45000, 96, 96);

        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: /* glsl */`
                varying vec3 vDir;
                void main() {
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3 vDir;
                uniform float uTime;

                // ── Hash / Noise ─────────────────────────────────────────────
                float hash(vec3 p) {
                    p  = fract(p * vec3(443.897, 441.423, 437.195));
                    p += dot(p, p.yxz + 19.19);
                    return fract((p.x + p.y) * p.z);
                }
                float hash21(vec2 p) {
                    p = fract(p * vec2(5.3983, 5.4427));
                    p += dot(p, p.yx + 47.43);
                    return fract(p.x * p.y);
                }
                float noise3(vec3 p) {
                    vec3 i = floor(p); vec3 f = fract(p);
                    vec3 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash(i),               hash(i+vec3(1,0,0)), u.x),
                            mix(hash(i+vec3(0,1,0)),   hash(i+vec3(1,1,0)), u.x), u.y),
                        mix(mix(hash(i+vec3(0,0,1)),   hash(i+vec3(1,0,1)), u.x),
                            mix(hash(i+vec3(0,1,1)),   hash(i+vec3(1,1,1)), u.x), u.y), u.z);
                }
                float fbm(vec3 p, int oct) {
                    float v = 0.0, a = 0.5;
                    for (int i = 0; i < 5; i++) {
                        if (i >= oct) break;
                        v += a * noise3(p); p *= 2.03; a *= 0.49;
                    }
                    return v;
                }

                // Temperature-based star color (Kelvin approx)
                vec3 starTemperatureColor(float t) {
                    // t = 0..1 where 0=cool M-type (orange/red), 1=hot O-type (blue-violet)
                    if (t < 0.15) return vec3(1.0, 0.5, 0.25);   // M — orange-red
                    if (t < 0.35) return vec3(1.0, 0.75, 0.45);  // K — orange
                    if (t < 0.55) return vec3(1.0, 0.97, 0.8);   // G/F — yellow-white
                    if (t < 0.75) return vec3(0.9, 0.92, 1.0);   // A — white-blue
                    if (t < 0.88) return vec3(0.7, 0.8, 1.0);    // B — blue-white
                    return vec3(0.55, 0.65, 1.0);                  // O — deep blue
                }

                void main() {
                    vec3 dir = normalize(vDir);

                    // ── Base deep space — nearly black with subtle blue ──────
                    vec3 col = vec3(0.0, 0.0, 0.008);

                    // ── Milky Way band ─────────────────────────────────────
                    float tilt = 0.48;
                    vec3 tiltedDir = vec3(
                        dir.x,
                        dir.y * cos(tilt) - dir.z * sin(tilt),
                        dir.y * sin(tilt) + dir.z * cos(tilt)
                    );
                    float bandDist = abs(tiltedDir.y);
                    float band     = exp(-bandDist * bandDist * 14.0);

                    // Turbulent band density using FBM
                    float bandNoise1 = fbm(dir * 3.8 + vec3(0.0, 0.0, uTime * 0.0005), 4);
                    float bandNoise2 = fbm(dir * 7.2 - vec3(1.3, 0.5, uTime * 0.0003), 3);
                    float bandDensity = 0.5 + 0.7 * bandNoise1 + 0.2 * bandNoise2;
                    band *= clamp(bandDensity, 0.0, 1.8);

                    // Band color: warm core to cool blue arms
                    vec3 bandCore  = vec3(1.0, 0.72, 0.38);
                    vec3 bandArm   = vec3(0.28, 0.36, 0.62);
                    vec3 bandColor = mix(bandArm, bandCore, exp(-bandDist * 5.5));
                    col += bandColor * band * 0.28;

                    // ── Dust lanes inside the band (absorption) ──────────
                    float dustLane1 = fbm(dir * 6.0 + vec3(0.7, 0.0, 0.3), 4);
                    float dustLane2 = fbm(dir * 8.5 - vec3(1.2, 0.6, 0.0), 3);
                    float dust  = max(0.0, (dustLane1 - 0.56) * 2.2) * band;
                    float dust2 = max(0.0, (dustLane2 - 0.58) * 1.8) * band;
                    col -= vec3(0.0, 0.002, 0.004) * dust * 0.9;
                    col -= vec3(0.003, 0.002, 0.0) * dust2 * 0.7;
                    col  = max(col, vec3(0.0));

                    // ── Galactic core bright spot ──────────────────────────
                    vec3 coreDir = normalize(vec3(0.3, 0.0, 1.0));
                    float coreDist = acos(clamp(dot(dir, coreDir), -1.0, 1.0));
                    float coreGlow = exp(-coreDist * coreDist * 8.0);
                    float coreGlow2 = exp(-coreDist * coreDist * 18.0);
                    col += vec3(1.0, 0.75, 0.45) * coreGlow  * 0.18;
                    col += vec3(1.0, 0.90, 0.70) * coreGlow2 * 0.28;

                    // ── Galactic halo (faint spherical glow) ─────────────
                    float haloGlow = exp(-coreDist * coreDist * 0.4);
                    col += vec3(0.25, 0.18, 0.12) * haloGlow * 0.04;

                    // ── Interstellar medium (faint teal-blue) ─────────────
                    float ism1 = fbm(dir * 1.9, 3) * 0.5;
                    float ism2 = fbm(dir * 0.9 + vec3(2.1, 1.4, 0.8), 2) * 0.3;
                    col += vec3(0.018, 0.042, 0.075) * ism1 * 0.92;
                    col += vec3(0.010, 0.025, 0.050) * ism2 * 0.92;

                    // ── Nebula wisps — 4 distinct clouds ──────────────────
                    // Emission nebula (red)
                    float neb1 = max(0.0, fbm(dir * 5.2 + vec3( 2.3,  1.1,  0.7), 4) - 0.50);
                    col += vec3(0.95, 0.12, 0.22) * neb1 * 0.08;
                    // Reflection nebula (blue)
                    float neb2 = max(0.0, fbm(dir * 4.8 + vec3(-1.3,  2.7,  1.4), 3) - 0.52);
                    col += vec3(0.12, 0.32, 0.90) * neb2 * 0.06;
                    // Planetary nebula (teal-green)
                    float neb3 = max(0.0, fbm(dir * 6.0 + vec3( 0.5, -1.8,  2.1), 3) - 0.55);
                    col += vec3(0.10, 0.85, 0.65) * neb3 * 0.05;
                    // Supernova remnant (orange-pink)
                    float neb4 = max(0.0, fbm(dir * 3.5 + vec3(-2.1,  0.3, -1.5), 3) - 0.53);
                    col += vec3(0.90, 0.55, 0.20) * neb4 * 0.05;

                    // ── Layer 1: Sparse bright named stars (large) ─────────
                    vec3 sd1 = dir * 95.0;
                    float sh1 = hash(floor(sd1));
                    if (sh1 > 0.96) {
                        float brightness = pow((sh1 - 0.96) / 0.04, 2.5) * 3.5;
                        // Twinkle animation
                        float twinkle = 0.7 + 0.3 * sin(uTime * (3.0 + sh1 * 8.0) + sh1 * 100.0);
                        float tempH   = hash(floor(sd1 * 0.41));
                        vec3 sc = starTemperatureColor(tempH);
                        col += sc * brightness * twinkle;
                    }

                    // ── Layer 2: Medium density stars ─────────────────────
                    vec3 sd2 = dir * 220.0;
                    float sh2 = hash(floor(sd2));
                    if (sh2 > 0.925) {
                        float brightness = pow((sh2 - 0.925) / 0.075, 2.0) * 1.8;
                        float twinkle = 0.8 + 0.2 * sin(uTime * (2.0 + sh2 * 6.0) + sh2 * 75.0);
                        float tempH   = hash(floor(sd2 * 0.37));
                        vec3 sc = starTemperatureColor(tempH);
                        col += sc * brightness * twinkle;
                    }

                    // ── Layer 3: Dense micro-star field ───────────────────
                    vec3 sd3 = dir * 500.0;
                    float sh3 = hash(floor(sd3));
                    if (sh3 > 0.940) {
                        float brightness = pow((sh3 - 0.940) / 0.060, 1.8) * 0.9;
                        float tempH   = hash(floor(sd3 * 0.29));
                        vec3 sc = starTemperatureColor(tempH);
                        col += sc * brightness;
                    }

                    // ── Layer 4: Ultra-fine background stars ──────────────
                    vec3 sd4 = dir * 1200.0;
                    float sh4 = hash(floor(sd4));
                    if (sh4 > 0.952) {
                        float brightness = pow((sh4 - 0.952) / 0.048, 2.0) * 0.4;
                        col += vec3(0.88, 0.92, 1.0) * brightness;
                    }

                    // ── Extra density in band region ──────────────────────
                    if (band > 0.05) {
                        vec3 sd5 = dir * 380.0;
                        float sh5 = hash(floor(sd5));
                        if (sh5 > 0.928) {
                            float brightness = pow((sh5 - 0.928) / 0.072, 1.5) * band * 0.6;
                            float tempH   = hash(floor(sd5 * 0.35));
                            vec3 sc = starTemperatureColor(tempH);
                            col += sc * brightness;
                        }
                    }

                    // ── Gamma clamp ────────────────────────────────────────
                    col = max(col, vec3(0.0));

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        this._sphere = new THREE.Mesh(geo, mat);
        this._sphere.name = 'DeepSpaceHDRI_V2';
        this._sphere.frustumCulled = false;
        this._sphere.renderOrder = -1000;
        scene.add(this._sphere);

        console.log('🌌 [DeepSpaceHDRI V2] Cinematic deep space background online — twinkle, dust lanes, nebulae active.');
        return this._sphere;
    }

    update(delta) {
        if (this._sphere?.material?.uniforms?.uTime) {
            this._time += delta;
            this._sphere.material.uniforms.uTime.value = this._time;
        }
    }

    syncToCamera(cameraPosition) {
        if (this._sphere) {
            this._sphere.position.copy(cameraPosition);
        }
    }
}
