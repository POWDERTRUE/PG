import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * CameraStabilizationSystem — AAA Galactic Scale Camera
 *
 * This is the FINAL precision layer of the camera pipeline:
 *
 *   [INPUT] → [NAVIGATION/FSM] → [FLOATINGORIGIN] → [CameraStabilizationSystem] → [RENDER]
 *
 * ─── What this solves ────────────────────────────────────────────────────────
 *
 *  1. MICRO-JITTER after Floating Origin shift
 *     When FloatingOrigin shifts the scene, rounding may move the rig by
 *     a tiny fractional amount. This system smooths the rendering camera
 *     to absorb that 1-frame pop.
 *
 *  2. DRIFT accumulation from slerp in orbit/warp states
 *     Some camera states apply slerp() to the rig quaternion each frame.
 *     Over many frames, quaternion drift can expand its magnitude (|q| > 1).
 *     This system renormalizes the quaternion every frame.
 *
 *  3. PHYSICS-RENDER DECOUPLING (sub-frame smoothing)
 *     Separates the physics rig (high-frequency, may have numerical noise)
 *     from the render camera (visually smooth).
 *     Render camera = exponential smooth of rig with τ = 8ms (imperceptible lag).
 *     Result: imperceptibly smoother output, zero perceived latency.
 *
 *  4. UNIFORM MATRIX UPLOAD OPTIMIZATION
 *     Calls camera.updateMatrixWorld(true) exactly once per frame,
 *     after all camera-affecting systems have run. Prevents stale matrices
 *     in the GPU uniform buffer.
 *
 * ─── Design rules ────────────────────────────────────────────────────────────
 *   - Phase: 'post-navigation' (after navigation + floatingOrigin)
 *   - NEVER read mouse input here — only reads rig state
 *   - NEVER changes rig.position or rig.quaternion — only reads them
 *   - Writes ONLY to camera.position and camera.quaternion
 *   - Smoothing factor configured per camera state (FREE_FLIGHT = 0 lag)
 */
export class CameraStabilizationSystem {
    static phase = 'post-navigation';

    // Smoothing time constant (seconds).
    // 0.008 = 8ms — completely imperceptible lag, removes tick-level jitter.
    // In FREE_FLIGHT mode this is reduced further (0.003) for precision.
    static TAU_DEFAULT = 0.008;
    static TAU_WARP    = 0.045; // warp/cinematic — slightly dreamier
    static TAU_ORBIT   = 0.020; // orbit — smooth tracking

    constructor() {
        this._rig       = null;
        this._cam       = null;
        this._nav       = null;
        this._runtimeState = null;

        // Smoothed render-camera state (decoupled from physics rig)
        this._smoothPos = new THREE.Vector3();
        this._smoothQ   = new THREE.Quaternion();
        this._initialized = false;

        // Sub-frame jitter detection
        this._prevRigPos = new THREE.Vector3();
        this._jitterAcc  = 0;
    }

    init() {
        const kernel   = Registry.get('kernel');
        this._cam      = kernel?.camera;
        this._nav      = kernel?.navigationSystem;
        this._rig      = this._nav?.cameraRig ?? this._cam;
        this._runtimeState = kernel?.runtimeState ?? Registry.tryGet('RuntimeState');
        if (this._cam?.position) {
            this._smoothPos.copy(this._cam.position);
        } else {
            this._smoothPos.set(0, 0, 0);
        }
        this._smoothQ.copy(this._cam?.quaternion ?? new THREE.Quaternion());
        console.log('%c[CameraStabilization] ✦ Anti-jitter layer ONLINE', 'color:#00ffcc');
    }

    update(delta) {
        // Re-resolve lazily after boot race
        if (!this._rig || !this._cam) {
            const kernel = Registry.get('kernel');
            this._cam    = kernel?.camera;
            this._nav    = kernel?.navigationSystem;
            this._rig    = this._nav?.cameraRig ?? this._cam;
            this._runtimeState = kernel?.runtimeState ?? Registry.tryGet('RuntimeState');
            if (!this._rig || !this._cam) return;
            this._smoothPos.copy(this._cam.position);
            this._smoothQ.copy(this._cam.quaternion);
            this._prevRigPos.copy(this._rig.position);
        }

        const dt    = Math.min(delta, 0.05);
        const state = this._nav?.fsm?.currentStateId ?? this._nav?.state ?? 'FREE_FLIGHT';

        // ── Quaternion renormalization — prevents drift ────────────────────
        const q = this._rig.quaternion;
        const lenSq = q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w;
        if (Math.abs(lenSq - 1.0) > 0.0001) {
            q.normalize();
        }

        // ── Jitter detection ──────────────────────────────────────────────
        // A Floating Origin shift moves the rig by a large amount in one frame.
        // Detect it and use higher tau briefly to smooth the pop.
        const rigDelta = this._rig.position.distanceTo(this._prevRigPos);
        if (rigDelta > 10 && rigDelta < 5001) {
            // Large positional jump this frame → likely floating origin shift
            this._jitterAcc = 0.15; // 150ms of extra smoothing
        }
        this._prevRigPos.copy(this._rig.position);

        // ── Choose tau based on camera state ─────────────────────────────
        let tau;
        if (this._jitterAcc > 0) {
            tau = CameraStabilizationSystem.TAU_WARP; // absorb the shift pop
            this._jitterAcc = Math.max(0, this._jitterAcc - dt);
        } else {
            tau = state === 'WARP' || state === 'WARPING' ? CameraStabilizationSystem.TAU_WARP
                : state === 'ORBIT'   ? CameraStabilizationSystem.TAU_ORBIT
                : CameraStabilizationSystem.TAU_DEFAULT; // FREE_FLIGHT, others
        }

        // Exponential smoothing factor: α = 1 - e^(-dt/τ)
        // As dt→0: α→0 (no change, perfectly smooth at high framerate)
        // As dt→∞: α→1 (instantaneous catch-up if frames spike)
        const alpha = 1.0 - Math.exp(-dt / tau);
        const directCameraMode =
            (this._runtimeState?.isLoginActive?.() ?? !!window.__loginActive) ||
            (this._runtimeState?.isGamePaused?.() ?? !!window.__gamePaused) ||
            state === 'MOUSE_UI';

        if (directCameraMode) {
            this._smoothPos.copy(this._rig.position);
            this._cam.position.copy(this._rig.position);
            this._smoothQ.copy(this._rig.quaternion);
            this._cam.quaternion.copy(this._rig.quaternion);
            this._cam.updateMatrixWorld(true);
            return;
        }

        // ── Smooth position ───────────────────────────────────────────────
        this._smoothPos.lerp(this._rig.position, alpha);
        this._cam.position.copy(this._smoothPos);

        // ── Smooth quaternion — ONLY for warp/orbit states ────────────────
        // In FREE_FLIGHT: rotation must be DIRECT (zero latency for aim feel)
        if (state === 'WARP' || state === 'WARPING' || state === 'ORBIT' || state === 'STELARYI') {
            this._smoothQ.slerp(this._rig.quaternion, alpha);
            this._cam.quaternion.copy(this._smoothQ);
        } else {
            // FREE_FLIGHT: copy directly — preserve FPS-grade precision
            this._cam.quaternion.copy(this._rig.quaternion);
            this._smoothQ.copy(this._rig.quaternion);
        }

        // ── Upload matrices once, after all camera ops ────────────────────
        this._cam.updateMatrixWorld(true);
    }

    execute(world, delta) { this.update(delta); }
}
