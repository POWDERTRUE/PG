import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { PostProcessPass } from '../rendering/passes/PostProcessPass.js';

const WARP_SPOOLING_SIGNAL = 'PG:NAV:WARP_SPOOLING';
const WARP_TRANSIT_SIGNAL = 'PG:NAV:WARP_TRANSIT';
const WARP_DROPOUT_SIGNAL = 'PG:NAV:WARP_DROPOUT';

const WARP_IDLE = 'IDLE';
const WARP_SPOOLING = 'SPOOLING';
const WARP_TRANSIT = 'TRANSIT';
const WARP_DROPOUT = 'DROPOUT';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TUNNEL_DEPTH = 1800;
const SEGMENT_COUNT = 960;

export class WarpCinematicSystem {
    constructor() {
        this.phase = 'render';
        this.renderPhase = 'render';

        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.cameraRig = Registry.tryGet('cameraRig');

        this.warpState = WARP_IDLE;
        this.baseFov = this.cameraRig?.fov ?? 65;
        this.currentFov = this.baseFov;
        this.targetFov = this.baseFov;

        this.travel = 0;
        this.travelSpeed = 0;
        this.targetTravelSpeed = 0;
        this.stretch = 0;
        this.targetStretch = 0;
        this.opacity = 0;
        this.targetOpacity = 0;
        this.glow = 0.8;
        this.targetGlow = 0.8;

        this.warpLines = null;
        this.warpMaterial = null;
        this._removeSpoolingListener = null;
        this._removeTransitListener = null;
        this._removeDropoutListener = null;

        // Post-process warp FX uniforms — resolved lazily on first use
        this._warpPostUniforms = null;  // { aberration, spoolPulse, flash }
        this._spoolElapsed = 0;         // for oscillation
        this._flashValue = 0;           // drives flash damping independently
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.cameraRig = this.cameraRig || Registry.tryGet('cameraRig');
        this._initWarpTunnel();
        this._resolvePostUniforms();

        if (this.runtimeSignals?.on) {
            this._removeSpoolingListener = this.runtimeSignals.on(
                WARP_SPOOLING_SIGNAL,
                (detail) => this._beginSpooling(detail)
            );
            this._removeTransitListener = this.runtimeSignals.on(
                WARP_TRANSIT_SIGNAL,
                (detail) => this._beginTransit(detail)
            );
            this._removeDropoutListener = this.runtimeSignals.on(
                WARP_DROPOUT_SIGNAL,
                (detail) => this._beginDropout(detail)
            );
        }
    }

    dispose() {
        this._removeSpoolingListener?.();
        this._removeSpoolingListener = null;
        this._removeTransitListener?.();
        this._removeTransitListener = null;
        this._removeDropoutListener?.();
        this._removeDropoutListener = null;
        this.warpLines?.removeFromParent();
        this.warpMaterial?.dispose?.();
        this.warpLines?.geometry?.dispose?.();
        this.warpLines = null;
        this.warpMaterial = null;
    }

    getDebugState() {
        return {
            state: this.warpState,
            visible: !!this.warpLines?.visible,
            stretch: Number(this.stretch.toFixed(3)),
            opacity: Number(this.opacity.toFixed(3)),
            travelSpeed: Number(this.travelSpeed.toFixed(2)),
            fov: Number((this.cameraRig?.fov ?? this.currentFov).toFixed(2)),
        };
    }

    update(deltaTime = 0) {
        if (this.warpState === WARP_IDLE || !this.cameraRig || !this.warpMaterial) {
            return;
        }

        const delta = Math.min(Math.max(deltaTime, 0), 0.05);
        const fovLerp     = 1 - Math.exp(-7.5  * delta);
        const opticalLerp = 1 - Math.exp(-6.5  * delta);
        const speedLerp   = 1 - Math.exp(-5.25 * delta);
        const postLerp    = 1 - Math.exp(-9.0  * delta);   // faster for post FX
        const flashDamp   = 1 - Math.exp(-14.0 * delta);   // very fast flash decay

        this.currentFov += (this.targetFov - this.currentFov) * fovLerp;
        this.cameraRig.fov = this.currentFov;
        this.stretch  += (this.targetStretch  - this.stretch)  * opticalLerp;
        this.opacity  += (this.targetOpacity  - this.opacity)  * opticalLerp;
        this.glow     += (this.targetGlow     - this.glow)     * opticalLerp;
        this.travelSpeed += (this.targetTravelSpeed - this.travelSpeed) * speedLerp;
        this.travel += this.travelSpeed * delta;

        this.warpMaterial.uniforms.uTravel.value   = this.travel;
        this.warpMaterial.uniforms.uStretch.value  = this.stretch;
        this.warpMaterial.uniforms.uOpacity.value  = this.opacity;
        this.warpMaterial.uniforms.uGlow.value     = this.glow;

        // ── Post-process Warp FX ──────────────────────────────────────────────
        const pu = this._warpPostUniforms || this._resolvePostUniforms();
        if (pu) {
            if (this.warpState === WARP_SPOOLING) {
                // Sinusoidal vignette pulse: engine energy draining into the drive
                this._spoolElapsed += delta;
                pu.spoolPulse.value += (Math.abs(Math.sin(this._spoolElapsed * 6.5)) - pu.spoolPulse.value) * postLerp;
                pu.aberration.value += (0.0 - pu.aberration.value) * postLerp;
                pu.flash.value      += (0.0 - pu.flash.value)      * flashDamp;

            } else if (this.warpState === WARP_TRANSIT) {
                // Full relativistic RGB split; spool pulse fades to 0
                pu.aberration.value += (1.0 - pu.aberration.value) * postLerp;
                pu.spoolPulse.value += (0.0 - pu.spoolPulse.value) * postLerp;
                pu.flash.value      += (0.0 - pu.flash.value)      * flashDamp;

            } else if (this.warpState === WARP_DROPOUT) {
                // _flashValue was spiked to 1.0 in _beginDropout(); decay each frame
                this._flashValue    += (0.0 - this._flashValue)    * flashDamp;
                pu.flash.value       = this._flashValue;
                pu.aberration.value += (0.0 - pu.aberration.value) * postLerp;
                pu.spoolPulse.value += (0.0 - pu.spoolPulse.value) * postLerp;
            }
        }

        if (this.warpState === WARP_DROPOUT) {
            const settledFov     = Math.abs(this.currentFov - this.baseFov) <= 0.18;
            const settledStretch = this.stretch  <= 0.03;
            const settledOpacity = this.opacity  <= 0.03;

            if (settledFov && settledStretch && settledOpacity) {
                this.cameraRig.fov    = this.baseFov;
                this.currentFov       = this.baseFov;
                this.targetFov        = this.baseFov;
                this.stretch          = 0;
                this.targetStretch    = 0;
                this.opacity          = 0;
                this.targetOpacity    = 0;
                this.glow             = 0.8;
                this.targetGlow       = 0.8;
                this.travelSpeed      = 0;
                this.targetTravelSpeed = 0;
                this.warpLines.visible = false;
                this.warpState        = WARP_IDLE;

                // Reset all post FX to baseline
                if (pu) {
                    pu.aberration.value = 0.0;
                    pu.spoolPulse.value = 0.0;
                    pu.flash.value      = 0.0;
                }
                this._spoolElapsed = 0;
                this._flashValue   = 0;
            }
        }
    }

    _initWarpTunnel() {
        if (!this.cameraRig || this.warpLines) {
            return;
        }

        const positions = new Float32Array(SEGMENT_COUNT * 2 * 3);
        const along = new Float32Array(SEGMENT_COUNT * 2);
        const speed = new Float32Array(SEGMENT_COUNT * 2);

        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const radialT = ((i * 17) % SEGMENT_COUNT) / SEGMENT_COUNT;
            const radius = 48 + (radialT * 228);
            const theta = i * GOLDEN_ANGLE;
            const depthT = ((i * 53) % SEGMENT_COUNT) / SEGMENT_COUNT;
            const z = (depthT - 0.5) * TUNNEL_DEPTH;
            const segmentSpeed = 0.74 + ((((i * 13) % 97) / 96) * 1.18);

            const x = Math.cos(theta) * radius;
            const y = Math.sin(theta) * radius;
            const vertexIndex = i * 2;
            const baseIndex = vertexIndex * 3;

            positions[baseIndex + 0] = x;
            positions[baseIndex + 1] = y;
            positions[baseIndex + 2] = z;
            positions[baseIndex + 3] = x;
            positions[baseIndex + 4] = y;
            positions[baseIndex + 5] = z;

            along[vertexIndex] = 0;
            along[vertexIndex + 1] = 1;

            speed[vertexIndex] = segmentSpeed;
            speed[vertexIndex + 1] = segmentSpeed;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
        geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));

        this.warpMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTravel: { value: 0 },
                uStretch: { value: 0 },
                uOpacity: { value: 0 },
                uGlow: { value: 0.8 },
                uColor: { value: new THREE.Color(0x9fffe7) },
            },
            vertexShader: `
                uniform float uTravel;
                uniform float uStretch;
                attribute float aAlong;
                attribute float aSpeed;
                varying float vAlpha;

                void main() {
                    float cycleDepth = ${TUNNEL_DEPTH.toFixed(1)};
                    float wrappedZ = mod(position.z - (uTravel * aSpeed) + (cycleDepth * 0.5), cycleDepth) - (cycleDepth * 0.5);
                    vec3 pos = position;
                    pos.z = wrappedZ - (aAlong * mix(0.0, 580.0, uStretch));
                    pos.xy *= mix(1.0, 0.82, uStretch);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = mix(0.12, 1.0, uStretch) * mix(0.45, 1.0, aAlong);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uOpacity;
                uniform float uGlow;
                varying float vAlpha;

                void main() {
                    gl_FragColor = vec4(uColor * uGlow, vAlpha * uOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            toneMapped: false,
        });

        this.warpLines = new THREE.LineSegments(geometry, this.warpMaterial);
        this.warpLines.name = 'WarpTunnelLines';
        this.warpLines.visible = false;
        this.warpLines.frustumCulled = false;
        this.warpLines.renderOrder = 9900;
        this.cameraRig.add(this.warpLines);
    }

    _beginSpooling(detail = {}) {
        if (!this.cameraRig || !this.warpLines) {
            return;
        }

        this.baseFov = Number.isFinite(detail.baseFov) ? detail.baseFov : (this.cameraRig.fov || this.baseFov || 65);
        this.currentFov = this.cameraRig.fov || this.baseFov;
        this.targetFov = Math.max(this.baseFov - 8, 32);
        this.travel = 0;
        this.travelSpeed = 0;
        this.targetTravelSpeed = 120;
        this.stretch = 0;
        this.targetStretch = 0.18;
        this.opacity = 0;
        this.targetOpacity = 0.42;
        this.glow = 0.9;
        this.targetGlow = 1.1;
        this.warpState = WARP_SPOOLING;
        this.warpLines.visible = true;
        this.warpMaterial.uniforms.uTravel.value = 0;

        // Reset post FX state machine
        this._spoolElapsed = 0;
        this._flashValue = 0;
    }

    _beginTransit(detail = {}) {
        if (!this.cameraRig || !this.warpLines) {
            return;
        }

        if (Number.isFinite(detail.baseFov)) {
            this.baseFov = detail.baseFov;
        }
        this.targetFov = Math.min(Math.max(this.baseFov + 54, 100), 122);
        this.targetStretch = 1;
        this.targetOpacity = 1;
        this.targetGlow = 1.45;
        this.targetTravelSpeed = detail.precision ? 1180 : 1380;
        this.warpState = WARP_TRANSIT;
        this.warpLines.visible = true;
    }

    _beginDropout(detail = {}) {
        if (!this.cameraRig || !this.warpLines) {
            return;
        }

        if (Number.isFinite(detail.baseFov)) {
            this.baseFov = detail.baseFov;
        }
        this.targetFov = this.baseFov;
        this.targetStretch = 0;
        this.targetOpacity = 0;
        this.targetGlow = 0.8;
        this.targetTravelSpeed = 90;
        this.warpState = WARP_DROPOUT;
        this.warpLines.visible = true;

        // Spike the flash — update() will decay it via flashDamp lerp
        this._flashValue = 1.0;
    }

    /**
     * Lazily resolves PostProcessPass warp uniform handles.
     * Called once; after that _warpPostUniforms is reused every frame. Zero-GC.
     */
    _resolvePostUniforms() {
        if (this._warpPostUniforms) return this._warpPostUniforms;
        const fg = Registry.tryGet('FrameGraph');
        if (!fg) return null;
        const pp = fg.getPass?.(PostProcessPass);
        if (!pp?.warpUniforms) return null;
        this._warpPostUniforms = pp.warpUniforms;
        return this._warpPostUniforms;
    }
}

export default WarpCinematicSystem;
