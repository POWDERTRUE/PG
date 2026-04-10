import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/**
 * PostProcessPass V2 — Cinematic Space Grade
 *
 * Pipeline:
 *   RenderPass → UnrealBloom (selective) → ACES Tonemapping
 *   → Cinematic (Grain + ChrAb + Vignette + WarpFX) → OutputPass
 *
 * WarpFX uniforms are driven live by WarpCinematicSystem:
 *   uWarpAberration [0..1]  — radial RGB split during TRANSIT
 *   uWarpSpoolPulse [0..1]  — vignette pulse during SPOOLING
 *   uWarpFlash      [0..1]  — additive white flash during DROPOUT
 */
export class PostProcessPass {
    constructor(renderer, scene, camera) {
        this.priority = 200;
        this.enabled  = true;
        this.pixelRatioCap = 1.5;

        // ACES Filmic — standard for cinematic HDR rendering
        renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.62;   // Escena más oscura y limpia
        renderer.outputColorSpace    = THREE.SRGBColorSpace;

        this.composer  = new EffectComposer(renderer);
        const px       = Math.min(renderer.getPixelRatio(), this.pixelRatioCap);
        this.composer.setPixelRatio(px);

        // 1. Render pass
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // 2. Bloom — stars, corona, hot objects (LULU's Signature)
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth * px, window.innerHeight * px),
            0.32, // strength  — reducido para menos halos
            0.20, // radius
            0.75  // threshold — más alto = solo objetos muy brillantes florecen
        );
        this.composer.addPass(this.bloomPass);

        // 3. Cinematic effects — film grain, chromatic aberration, vignette + Warp FX
        // WarpCinematicSystem writes to uWarpAberration / uWarpSpoolPulse / uWarpFlash
        // via the warpUniforms getter below. Zero new ShaderPass — zero GC overhead.
        this._time = 0;
        this.cinematicPass = new ShaderPass({
            uniforms: {
                tDiffuse:         { value: null  },
                uTime:            { value: 0     },
                uGrainAmt:        { value: 0.008 },  // Film grain reducido
                uChrAmt:          { value: 0.0005},  // Aberración cromática mínima
                uVignette:        { value: 0.0   },
                uVignSoft:        { value: 2.2   },
                uContrast:        { value: 0.94  },
                uSaturation:      { value: 0.82  },  // Menos saturación — look más scientific
                // ── Warp FX — driven by WarpCinematicSystem.update() ─────────────
                uWarpAberration:  { value: 0.0   },  // [0..1] TRANSIT radial RGB split
                uWarpSpoolPulse:  { value: 0.0   },  // [0..1] SPOOLING vignette pulse
                uWarpFlash:       { value: 0.0   },  // [0..1] DROPOUT additive flash
                uCosmosDropout:   { value: 0.0   },  // [0..1] Subtractive absolute black
            },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D tDiffuse;
                uniform float uTime;
                uniform float uGrainAmt;
                uniform float uChrAmt;
                uniform float uVignette;
                uniform float uVignSoft;
                uniform float uContrast;
                uniform float uSaturation;
                uniform float uWarpAberration;
                uniform float uWarpSpoolPulse;
                uniform float uWarpFlash;
                uniform float uCosmosDropout;

                varying vec2 vUv;

                // High-quality blueish film grain
                float grain(vec2 uv, float t) {
                    float x = dot(uv, vec2(127.1, 311.7)) + t * 123.456;
                    return fract(sin(x) * 43758.5453);
                }

                void main() {
                    vec2 center = vUv - 0.5;
                    float dist  = length(center);

                    // ── Chromatic aberration ─────────────────────────────────────
                    // Combines baseline lens CA with warp relativistic split.
                    // uWarpAberration is radial: stronger at screen edges (dist²),
                    // plus a smaller linear term for mid-field clarity.
                    float aberration = uChrAmt
                        + uWarpAberration * (0.055 * dist * dist + 0.012 * dist);
                    vec2 offset = center * aberration;

                    float r = texture2D(tDiffuse, vUv + offset).r;
                    float g = texture2D(tDiffuse, vUv).g;
                    float b = texture2D(tDiffuse, vUv - offset).b;
                    vec3 col = vec3(r, g, b);

                    // ── SPOOLING vignette pulse ──────────────────────────────────
                    // Closes over the center like a failing power conduit.
                    // uWarpSpoolPulse oscillates [0..1] from WarpCinematicSystem
                    // (Math.abs(Math.sin(elapsed * freq))). Layered on static vig.
                    float warpVigRadius = 0.78 - uWarpSpoolPulse * 0.46;
                    float warpVig = smoothstep(warpVigRadius + 0.18, warpVigRadius - 0.1, dist);
                    col *= mix(1.0, warpVig, uWarpSpoolPulse);

                    // ── Static vignette ──────────────────────────────────────────
                    if (uVignette > 0.001) {
                        float vig = 1.0 - pow(dist / uVignette, uVignSoft);
                        col *= clamp(vig, 0.0, 1.0);
                    }

                    // ── Contrast ────────────────────────────────────────────────
                    col = (col - 0.5) * uContrast + 0.5;
                    col = clamp(col, 0.0, 1.0);

                    // ── Saturation ───────────────────────────────────────────────
                    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
                    col = mix(vec3(luma), col, uSaturation);

                    // ── Film grain ───────────────────────────────────────────────
                    float g1 = grain(vUv, uTime);
                    float g2 = grain(vUv * 2.7, uTime + 0.5);
                    float grainVal = (g1 + g2) * 0.5 - 0.5;
                    col += grainVal * uGrainAmt;

                    // ── DROPOUT flash — additive white burn ──────────────────────
                    // uWarpFlash spikes to 1.0 on arrival, then damps to 0.
                    // Added AFTER grain so the flash lane stays pristine white.
                    col += vec3(uWarpFlash);

                    // ── COSMOS DROPOUT — subtractive black hole fade ─────────────
                    col *= (1.0 - uCosmosDropout);

                    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
                }
            `,
        });
        this.composer.addPass(this.cinematicPass);

        // 4. Output pass (handles sRGB conversion properly)
        try {
            this.outputPass = new OutputPass();
            this.composer.addPass(this.outputPass);
        } catch (_) {
            // OutputPass may not be available in older three.js builds
        }

        // 5. SMAA Anti-aliasing pass (Military Grade AA)
        this.smaaPass = new SMAAPass(window.innerWidth * px, window.innerHeight * px);
        this.composer.addPass(this.smaaPass);

        this.composer.setSize(window.innerWidth, window.innerHeight);

        window.addEventListener('resize', () => {
            const resizePx = Math.min(renderer.getPixelRatio(), this.pixelRatioCap);
            this.composer.setPixelRatio(resizePx);
            this.composer.setSize(window.innerWidth, window.innerHeight);
            if (this.bloomPass) {
                this.bloomPass.resolution.set(
                    window.innerWidth  * resizePx,
                    window.innerHeight * resizePx
                );
            }
            if (this.smaaPass) {
                this.smaaPass.setSize(window.innerWidth * resizePx, window.innerHeight * resizePx);
            }
        });

        console.log('[PostProcessPass V2] Cinematic pipeline: Bloom + Grain + SMAA + WarpFX online.');
    }

    setRenderSource(overrideScene, overrideCamera) {
        if (this.renderPass) {
            this.renderPass.scene = overrideScene;
            this.renderPass.camera = overrideCamera;
        }
    }

    /**
     * Direct write handle for WarpCinematicSystem.
     * Returns the warp uniform nodes — no intermediate objects, Zero-GC.
     * @returns {{ aberration: {value:number}, spoolPulse: {value:number}, flash: {value:number} } | null}
     */
    get warpUniforms() {
        const u = this.cinematicPass?.uniforms;
        if (!u) return null;
        return {
            aberration:  u.uWarpAberration,
            spoolPulse:  u.uWarpSpoolPulse,
            flash:       u.uWarpFlash,
        };
    }

    execute(renderer, scene, camera, deltaTime) {

        if (this.renderPass) {
            this.renderPass.scene  = scene;
            this.renderPass.camera = camera;
        }

        // Update time-based uniforms
        if (this.cinematicPass?.uniforms) {
            this._time += deltaTime ?? 0.016;
            this.cinematicPass.uniforms.uTime.value = this._time * 60.0; // frame-rate independent
        }

        try {
            this.composer.render(deltaTime);
        } catch (err) {
            console.warn('[PostProcessPass V2] Composer failed, fallback:', err);
            renderer.render(scene, camera);
        }
    }

    setBloomIntensity(value) {
        if (this.bloomPass) this.bloomPass.strength = value;
    }

    setBloomThreshold(value) {
        if (this.bloomPass) this.bloomPass.threshold = value;
    }

    setGrainAmount(value) {
        if (this.cinematicPass?.uniforms) this.cinematicPass.uniforms.uGrainAmt.value = value;
    }

    setVignette(radius, softness) {
        if (this.cinematicPass?.uniforms) {
            this.cinematicPass.uniforms.uVignette.value = radius;
            this.cinematicPass.uniforms.uVignSoft.value = softness;
        }
    }

    forceMacroWarpSpooling(intensity) {
        if (this.cinematicPass?.uniforms) {
            this.cinematicPass.uniforms.uWarpAberration.value = Math.max(0, intensity - 0.2); // Sube más hacia el final
            this.cinematicPass.uniforms.uWarpSpoolPulse.value = intensity * 0.8;
            this.cinematicPass.uniforms.uVignette.value = 0.5 - (intensity * 0.3); // Estrecha el borde ocular
        }
    }

    forceMacroDropoutFlash(intensity) {
        if (this.cinematicPass?.uniforms) {
            this.cinematicPass.uniforms.uWarpFlash.value = intensity;
        }
    }

    forceCosmosDropout(intensity) {
        if (this.cinematicPass?.uniforms) {
            this.cinematicPass.uniforms.uCosmosDropout.value = clampIntensity(intensity, 0.0, 1.0);
        }
    }
}

function clampIntensity(val, min, max) { return Math.max(min, Math.min(max, val)); }
