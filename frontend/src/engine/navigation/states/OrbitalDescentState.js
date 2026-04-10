/**
 * OrbitalDescentState.js — Powder Galaxy v2.0.0
 *
 * Cinematic orbital descent: the camera spirals inward from orbit altitude
 * down to a low planetary flyover (~5 units above the surface patch).
 *
 * Lifecycle:
 *   enter({ targetObject, surfacePatch? })
 *     → GSAP-drives cameraRig from current position toward low-altitude point
 *     → on complete, emits window event LANDING_COMPLETE, then transitions to FOCUS
 *
 *   exit()  — kills tweens
 *   update() — nothing needed (GSAP drives the motion)
 *
 * Writes ONLY to nav.cameraRig — never to THREE.Camera directly.
 */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { CAMERA_STATE } from '../CameraStateMachine.js';

const _worldPos   = new THREE.Vector3();
const _up         = new THREE.Vector3(0, 1, 0);
const _lookMatrix = new THREE.Matrix4();

export class OrbitalDescentState {
    constructor() {
        this.fsm          = null;
        this.nav          = null;
        this._tween       = null;
        this._fovTween    = null;
        this._targetObj   = null;
    }

    enter(data = {}) {
        const { targetObject } = data;
        if (!targetObject) {
            console.warn('[OrbitalDescentState] No targetObject provided — aborting descent.');
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT);
            return;
        }

        this._targetObj = targetObject;
        const rig = this.nav.cameraRig;

        // ── Compute planet radius (bounding sphere) ──────────────────────────
        if (!targetObject.geometry?.boundingSphere) {
            targetObject.geometry?.computeBoundingSphere?.();
        }
        const sphereR = targetObject.geometry?.boundingSphere?.radius ?? 1;
        const worldScale  = Math.max(
            targetObject.scale.x, targetObject.scale.y, targetObject.scale.z
        );
        const planetRadius = sphereR * worldScale;

        // ── Compute start and end camera positions ───────────────────────────
        targetObject.getWorldPosition(_worldPos);
        const startPos  = rig.position.clone();
        const startQuat = rig.quaternion.clone();

        // Low-flyover destination: directly above the planet (Y offset),
        // slightly in front (Z offset) for a cinematic angle
        const descentHeight = planetRadius * 1.06;   // ~6% above surface
        const endPos = new THREE.Vector3(
            _worldPos.x,
            _worldPos.y + descentHeight,
            _worldPos.z + planetRadius * 0.4
        );

        // Camera should look at the planet center during descent
        const endQuat = new THREE.Quaternion();
        this.nav._computeLookQuaternion(endQuat, endPos, _worldPos);

        const duration = 4.5;

        console.log(`[OrbitalDescentState] Beginning descent to ${targetObject.name ?? 'planet'} — radius ${planetRadius.toFixed(1)}`);

        // ── Narrow FOV for cinematic atmosphere feel ─────────────────────────
        const startFov = rig.fov ?? 65;
        if (this._fovTween) this._fovTween.kill();
        this._fovTween = gsap.to(rig, {
            fov:      42,
            duration: duration * 0.7,
            ease:     'power2.inOut'
        });

        // ── Main position + rotation tween ───────────────────────────────────
        const progress = { t: 0 };
        if (this._tween) this._tween.kill();

        // V31: pre-alloc descent event detail — mutate instead of new CustomEvent every frame
        const _descentDetail  = { altitude: 0, planetRadius };
        const _descentEvent   = new CustomEvent('DESCENT_ALTITUDE', { detail: _descentDetail });

        this._tween = gsap.to(progress, {
            t:        1,
            duration,
            ease:     'power2.inOut',
            onUpdate: () => {
                // Smooth cubic arc: lerp position while always looking at planet
                rig.position.lerpVectors(startPos, endPos, progress.t);
                rig.quaternion.slerpQuaternions(startQuat, endQuat, progress.t);

                // Emit altitude for HUD (zero-GC: reuse pre-allocated event)
                const alt = rig.position.distanceTo(_worldPos) - planetRadius;
                _descentDetail.altitude = Math.max(0, alt);
                window.dispatchEvent(_descentEvent);
            },
            onComplete: () => {
                console.log('[OrbitalDescentState] Descent complete — landing reached.');

                // Restore FOV
                rig.fov = startFov;

                window.dispatchEvent(new CustomEvent('LANDING_COMPLETE', {
                    detail: { planet: targetObject }
                }));

                // Return to FOCUS on the planet
                this.fsm.to(CAMERA_STATE.FOCUS, {
                    targetObject,
                    orbitDistance: planetRadius * 1.1
                });
            }
        });
    }

    exit() {
        this._tween?.kill();
        this._fovTween?.kill();
        this._tween     = null;
        this._fovTween  = null;
        this._targetObj = null;

        // Restore FOV on early exit
        if (this.nav?.cameraRig) {
            this.nav.cameraRig.fov = 65;
        }
    }

    update(_delta) {
        // GSAP-driven — no manual update needed
    }

    getSnapshot() {
        return {
            targetObject: this._targetObj
        };
    }
}
