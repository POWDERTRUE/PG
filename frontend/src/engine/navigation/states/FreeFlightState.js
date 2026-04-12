import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';

/**
 * FreeFlightState — DRONE GOD EDITION v2.1
 *
 * ─── Mouse Mode ──────────────────────────────────────────────────────────────
 *
 *   UNIVERSE MODE (default, pointer lock active):
 *     Mouse movement → rotates camera. WASD/QE = movement.
 *
 *   HUD MODE (Ctrl held — managed globally by InputStateSystem):
 *     Pointer lock released → visible cursor, full UI interaction.
 *     Camera movement FROZEN until Ctrl is released.
 *
 * ─── Rotation — fully local quaternion ───────────────────────────────────────
 *   Yaw   = rotate around camera-local Y → post-multiply  (no world-space mixing)
 *   Pitch = rotate around camera-local X → post-multiply
 *   Full 360° · zero gimbal lock · zero inversions
 *
 * ─── Key Map ─────────────────────────────────────────────────────────────────
 *   W/S/Arrows    = forward/back
 *   A/D/Arrows    = left/right strafe
 *   Q / Space     = ascend
 *   E             = descend
 *   Shift         = 5× boost
 *   Shift + Alt   = 20× hyperwarp
 *   Ctrl (held)   → HUD mode (handled by InputStateSystem globally)
 */
export class FreeFlightState {
    constructor() {
        this.fsm = null;
        this.nav = null;
        this.inputSystem = null;

        // ── Physics ──────────────────────────────────────────────────────────
        this.velocity       = new THREE.Vector3();
        this.acceleration   = 1200;
        this.drag           = 7.0;
        this.autoBrakeDrag  = 16.0;
        this.fastMultiplier = 5.0;
        this.warpMultiplier = 20.0;

        // ── Rotation — pure local quaternion ─────────────────────────────────
        this.lookSensitivity = 0.0018;
        this.maxLookDelta    = 110;
        this._orientation    = new THREE.Quaternion();
        this._alignTarget    = new THREE.Quaternion();
        this.alignSnapAngle  = THREE.MathUtils.degToRad(3);
        this.alignFastAngle  = THREE.MathUtils.degToRad(12);

        // Reusable temporaries (no per-frame GC pressure)
        this._qDelta  = new THREE.Quaternion();
        this._axis    = new THREE.Vector3();
        this._dir     = new THREE.Vector3();
        this._shakeEuler = new THREE.Euler();

        // ── Banking (cosmetic only) ──────────────────────────────────────────
        this._bank        = 0;
        this.bankStrength = 0.025;
        this._qBank       = new THREE.Quaternion();
        this._bankAxis    = new THREE.Vector3(0, 0, 1);

        // ── Tactical pan (OPS context) — Zero-GC pre-alloc ──────────────────────
        // Screen-parallel translation vectors; reused every frame, never reallocated.
        this._panRight          = new THREE.Vector3();
        this._panUp             = new THREE.Vector3();
        // World-units per CSS-pixel of drag delta (POINTER_TYPE_SENSITIVITY pre-applied by HAL).
        this.basePanSensitivity = 0.3;

        // ── FOV spring ──────────────────────────────────────────────────────
        this._baseFov = 60;
        this._fov     = 60;
        this._fovVel  = 0;

        // ── Shake ────────────────────────────────────────────────────────────
        this._shakeAmp  = 0;
        this._shakeSeed = 0;

        // ── Entry guard ───────────────────────────────────────────────────────
        this._ready      = false;
        this._entryTimer = 0.2;
    }

    enter(_data) {
        console.log('%c[DRONE GOD] ✦ Drone feed from the universe — ONLINE', 'color:#00ffcc;font-weight:bold');
        this.inputSystem  = null;
        this.velocity.set(0, 0, 0);
        this._shakeAmp    = 0;
        this._entryTimer  = 0.2;
        this._ready       = false;

        // Seed orientation from current rig so re-entry is seamless
        this._orientation.copy(this.nav.cameraRig.quaternion).normalize();

        const cam = this.nav?.camera;
        if (cam) { this._baseFov = this._fov = cam.fov || 60; }

        this.nav?.upsertPointerIntent?.('nav-free-flight', {
            kind: 'flight',
            cursor: 'default',
            wantsPointerLock: true,
            priority: 100,
            reticleMode: 'dim',
        });
    }

    exit() {
        this.velocity.set(0, 0, 0);
        this.nav?.clearPointerIntent?.('nav-free-flight');
    }

    getSnapshot() {
        return {
            mode:       'FREE_FLIGHT',
            position:   this.nav.cameraRig.position.clone(),
            quaternion: this.nav.cameraRig.quaternion.clone(),
        };
    }

    addShake(intensity = 0.5) {
        this._shakeAmp = Math.min(this._shakeAmp + intensity, 1.5);
    }

    // ── Click canvas → request pointer lock (only when NOT in HUD mode) ──────
    update(delta) {
        const dt = Math.min(delta, 0.05);

        if (!this._ready) {
            this._entryTimer -= dt;
            if (this._entryTimer > 0) return;
            this._ready = true;
        }

        // ── Resolve input ──────────────────────────────────────────────────
        if (!this.inputSystem) {
            this.inputSystem = Registry.tryGet('InputStateSystem')
                            || Registry.tryGet('SpatialInputSystem')
                            || null;
        }
        const inp = this.inputSystem;

        const operationalContext = inp?.getInputContext?.() ?? (inp?.hudMode ? 'OPS' : 'HELM');
        const tacticalContext = operationalContext === 'OPS';
        if (tacticalContext) {
            const brakeDrag = this.nav?.isAutoBrakeActive?.() ? this.autoBrakeDrag : this.drag;
            this.velocity.multiplyScalar(Math.exp(-brakeDrag * dt));
            if (this.velocity.lengthSq() < 0.0004) {
                this.velocity.set(0, 0, 0);
            }

            this._bank += (0 - this._bank) * Math.min(9 * dt, 1);
            this._qBank.setFromAxisAngle(this._bankAxis, this._bank);
            this.nav.cameraRig.quaternion.copy(this._orientation).multiply(this._qBank);
            this.nav.cameraRig.position.addScaledVector(this.velocity, dt);

            // ── Tactical pan: translate camera in the screen-parallel plane ─────────
            // Zero-GC: reuses pre-allocated _panRight / _panUp vectors.
            // POINTER_TYPE_SENSITIVITY is already baked into gestureDrag.dx/dy by HAL.
            if (inp?.gestureDrag?.active) {
                const dx = inp.getGestureDragDX?.() ?? 0;
                const dy = inp.getGestureDragDY?.() ?? 0;
                if (dx !== 0 || dy !== 0) {
                    // Extract camera-local right and up axes from rig quaternion.
                    this._panRight.set(1, 0, 0).applyQuaternion(this.nav.cameraRig.quaternion);
                    this._panUp.set(0, 1, 0).applyQuaternion(this.nav.cameraRig.quaternion);
                    // Negate X: drag-right → scene drifts right relative to camera (map-grab feel).
                    // dy > 0 = pointer moves down (CSS); panUp is world +Y → camera shifts up.
                    this.nav.cameraRig.position.addScaledVector(this._panRight, -dx * this.basePanSensitivity);
                    this.nav.cameraRig.position.addScaledVector(this._panUp,    dy * this.basePanSensitivity);
                }
            }

            const cam = this.nav?.camera;
            if (cam) {
                const relax = 1 - Math.exp(-8 * dt);
                this._fov += (this._baseFov - this._fov) * relax;
                if (Math.abs(cam.fov - this._fov) > 0.01) {
                    cam.fov = this._fov;
                    cam.updateProjectionMatrix();
                }
            }
            return;
        }

        const locked = inp?.pointer?.locked
            ?? inp?.state?.pointerLocked
            ?? !!document.pointerLockElement;

        const mouseHeld = (inp?.isButton?.(2))
            ?? (inp?.state?.mouseButtons?.has?.(2))
            ?? false;

        // Gesture-drag channel: finger drag or free mouse drag without pointer lock.
        // POINTER_TYPE_SENSITIVITY is already baked into gestureDrag.dx/dy by InputStateSystem.
        const gestureDragging = !locked && !mouseHeld && (inp?.gestureDrag?.active ?? false);

        // ── DRONE ROTATION — fully local quaternion, zero latency ─────────
        if (locked || mouseHeld || gestureDragging) {
            const settings = Registry.tryGet('RuntimeState')?.getGameplaySettings?.() ?? window.__PG_SETTINGS?.gameplay ?? {};
            const lookMultiplier = Number.isFinite(settings.lookSensitivity) ? settings.lookSensitivity : 1;
            const invertY = settings.invertY ? -1 : 1;

            // Prefer pointer-lock / button-held delta; fall back to gesture drag delta.
            let rawDX, rawDY;
            if (locked || mouseHeld) {
                rawDX = inp?.getLookDX?.() ?? inp?.mouse?.dx ?? inp?.state?.mouseDX ?? this.nav?.mouseDX ?? 0;
                rawDY = inp?.getLookDY?.() ?? inp?.mouse?.dy ?? inp?.state?.mouseDY ?? this.nav?.mouseDY ?? 0;
            } else {
                rawDX = inp?.getGestureDragDX?.() ?? 0;
                rawDY = inp?.getGestureDragDY?.() ?? 0;
            }

            const dx = THREE.MathUtils.clamp(rawDX, -this.maxLookDelta, this.maxLookDelta);
            const dy = THREE.MathUtils.clamp(rawDY, -this.maxLookDelta, this.maxLookDelta) * invertY;
            const sensitivity = this.lookSensitivity * lookMultiplier;

            if (dx !== 0) {
                this._axis.set(0, 1, 0);
                this._qDelta.setFromAxisAngle(this._axis, -dx * sensitivity);
                this._orientation.multiply(this._qDelta);
            }
            if (dy !== 0) {
                this._axis.set(1, 0, 0);
                this._qDelta.setFromAxisAngle(this._axis, -dy * sensitivity);
                this._orientation.multiply(this._qDelta);
            }

            this._orientation.normalize();
        }

        if (this.nav?.isBowAlignmentActive?.()) {
            this._alignTarget.copy(this.nav.cameraRig.quaternion).normalize();
            const dot = THREE.MathUtils.clamp(Math.abs(this._orientation.dot(this._alignTarget)), -1, 1);
            const angle = 2 * Math.acos(dot);

            if (angle <= this.alignSnapAngle) {
                this._orientation.copy(this._alignTarget);
            } else {
                const alignBlend = angle > this.alignFastAngle
                    ? 1 - Math.exp(-12 * dt)
                    : 1 - Math.exp(-7 * dt);
                this._orientation.slerp(this._alignTarget, alignBlend).normalize();
            }

            this._bank += (0 - this._bank) * Math.min(11 * dt, 1);
        }

        // ── Movement ───────────────────────────────────────────────────────
        // Ctrl is now ONLY HUD mode — NOT used for movement or warp
        const dir = this._dir.set(0, 0, 0);
        const thrustAxis = inp?.getControlAxis?.('FLIGHT_THRUST') ?? 0;
        const strafeAxis = inp?.getControlAxis?.('FLIGHT_STRAFE') ?? 0;
        const elevationAxis = inp?.getControlAxis?.('FLIGHT_ELEVATION_DRONE') ?? 0;
        if (thrustAxis !== 0) dir.z -= thrustAxis;
        if (strafeAxis !== 0) dir.x += strafeAxis;
        if (elevationAxis !== 0) dir.y += elevationAxis;

        const moving = dir.lengthSq() > 0;
        if (moving) dir.normalize();

        // Shift+Alt = hyperwarp · Shift alone = fast boost
        const warp = inp?.isControlActive?.('FLIGHT_HYPERWARP') ?? false;
        const fast = inp?.isControlActive?.('FLIGHT_BOOST') ?? false;
        const mult = warp ? this.warpMultiplier : fast ? this.fastMultiplier : 1.0;

        // ── Banking: cosmetic lean on strafe ────────────────────────────────
        const bankTarget = -dir.x * this.bankStrength * Math.min(mult * 0.3, 1.0);
        this._bank += (bankTarget - this._bank) * Math.min(5.5 * dt, 1);

        this._qBank.setFromAxisAngle(this._bankAxis, this._bank);
        this.nav.cameraRig.quaternion.copy(this._orientation).multiply(this._qBank);

        // ── Velocity — exponential drag ────────────────────────────────────
        dir.applyQuaternion(this._orientation);
        this.velocity.addScaledVector(dir, this.acceleration * mult * dt);
        this.velocity.multiplyScalar(Math.exp(-this.drag * dt));
        this.nav.cameraRig.position.addScaledVector(this.velocity, dt);

        // ── FOV breathing — critically-damped spring ───────────────────────
        const speed   = this.velocity.length();
        const vMax    = (this.acceleration / this.drag) * this.warpMultiplier;
        const speedT  = Math.min(speed / vMax, 1);
        const fovGoal = this._baseFov + speedT * 25;

        const wn = 8.0;
        this._fovVel += (fovGoal - this._fov) * wn * wn * dt;
        this._fovVel *= Math.exp(-2 * wn * dt);
        this._fov    += this._fovVel * dt;

        const cam = this.nav?.camera;
        if (cam && Math.abs(cam.fov - this._fov) > 0.01) {
            cam.fov = this._fov;
            cam.updateProjectionMatrix();
        }

        // ── Screen shake ────────────────────────────────────────────────────
        if (this._shakeAmp > 0.005) {
            this._shakeSeed += dt * 33;
            const sAmp = this._shakeAmp * 0.004;
            this._shakeEuler.set(
                Math.sin(this._shakeSeed * 7.13) * sAmp,
                Math.cos(this._shakeSeed * 11.7) * sAmp,
                0
            );
            this._qDelta.setFromEuler(this._shakeEuler);
            this.nav.cameraRig.quaternion.multiply(this._qDelta);
            this._shakeAmp *= Math.exp(-8 * dt);
        }
    }
}
