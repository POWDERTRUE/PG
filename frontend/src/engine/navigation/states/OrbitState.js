/**
 * OrbitState.js — OMEGA V-FINAL
 *
 * Camera orbits around a world-space target point or Object3D.
 * Reads control deltas from InputStateSystem each frame.
 *
 * Controls:
 *   Drag (LMB/RMB) → rotate orbit
 *   Scroll          → zoom in/out
 *   ESC             → back to previous state via FSM history
 */
import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';

export class OrbitState {
    constructor() {
        this.fsm = null;
        this.nav = null;

        this.target     = new THREE.Vector3();   // world-space orbit center
        this.distance   = 200;
        this.minDist    = 8;
        this.maxDist    = 8000;
        this.yaw        = 0;
        this.pitch      = 0;
        this.sensitivity = 0.003;
        this.zoomSpeed   = 0.12;

        this._input = null;
        this._pointerCursor = 'grab';
        this._qYaw = new THREE.Quaternion();
        this._qPitch = new THREE.Quaternion();
        this._yawAxis = new THREE.Vector3(0, 1, 0);
        this._pitchAxis = new THREE.Vector3(1, 0, 0);
        this._offset = new THREE.Vector3();
        this._desiredPos = new THREE.Vector3();
    }

    enter(data = {}) {
        console.log('[OrbitState] Orbiting.');
        this._input = null; // reset lazy ref

        // Accept target as Object3D or Vector3
        if (data.targetObject) {
            data.targetObject.getWorldPosition(this.target);
            this.distance = data.orbitDistance ?? this.distance;
        } else if (data.target instanceof THREE.Vector3) {
            this.target.copy(data.target);
            this.distance = data.orbitDistance ?? this.distance;
        } else {
            // Orbit around whatever the rig is looking at right now
            const fwd = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(this.nav.cameraRig.quaternion);
            this.target.copy(this.nav.cameraRig.position)
                .addScaledVector(fwd, this.distance);
        }

        // Seed angles from current rig orientation for seamless entry
        const e = new THREE.Euler().setFromQuaternion(
            this.nav.cameraRig.quaternion, 'YXZ'
        );
        this.yaw   = e.y;
        this.pitch = e.x;

        this._pointerCursor = 'grab';
        this.nav?.upsertPointerIntent?.('nav-orbit', {
            kind: 'ui',
            cursor: this._pointerCursor,
            priority: 160,
            reticleMode: 'hidden',
        });
    }

    exit() {
        this.nav?.clearPointerIntent?.('nav-orbit');
    }

    getSnapshot() {
        return {
            target:        this.target.clone(),
            orbitDistance: this.distance,
        };
    }

    update(delta) {
        // Lazy resolve once it's available
        if (!this._input) this._input = Registry.tryGet('InputStateSystem');

        const input = this._input;

        // ── Mouse-drag / gesture-drag rotation ───────────────────────────────
        const isUiCapture = input?.isUiCapturingPointer?.() ?? false;
        const isHeld  =
            !isUiCapture && (
                input?.isButton?.(2) ||
                input?.state?.mouseButtons?.has?.(2)
            );
        const isLocked = input?.pointer?.locked;
        // Gesture-drag channel: touch / free mouse drag (POINTER_TYPE_SENSITIVITY pre-applied).
        const gestureDragging = !isUiCapture && !isHeld && !isLocked && (input?.gestureDrag?.active ?? false);

        if (input && (isHeld || isLocked || gestureDragging) && !input?.hudMode) {
            let dxSrc, dySrc;
            if (isHeld || isLocked) {
                dxSrc = input?.getLookDX?.() ?? input.mouse.dx;
                dySrc = input?.getLookDY?.() ?? input.mouse.dy;
            } else {
                dxSrc = input?.getGestureDragDX?.() ?? 0;
                dySrc = input?.getGestureDragDY?.() ?? 0;
            }
            this.yaw   -= dxSrc * this.sensitivity;
            this.pitch -= dySrc * this.sensitivity;
        }

        const orbitSpeed = delta * 1.35;
        if (!input?.hudMode) {
            if (input?.isKey?.('KeyA') || input?.isKey?.('ArrowLeft')) this.yaw -= orbitSpeed;
            if (input?.isKey?.('KeyD') || input?.isKey?.('ArrowRight')) this.yaw += orbitSpeed;
            if (input?.isKey?.('KeyW') || input?.isKey?.('ArrowUp')) this.pitch -= orbitSpeed * 0.85;
            if (input?.isKey?.('KeyS') || input?.isKey?.('ArrowDown')) this.pitch += orbitSpeed * 0.85;
        }

        const PITCH_LIMIT = Math.PI / 2 - 0.01;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

        // ── Scroll zoom ───────────────────────────────────────────────────
        if (input && Math.abs(input.scroll.dy) > 0) {
            const factor = input.scroll.dy > 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
            this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance * factor));
        }

        // ── Compute rig position ──────────────────────────────────────────
        this._qYaw.setFromAxisAngle(this._yawAxis, this.yaw);
        this._qPitch.setFromAxisAngle(this._pitchAxis, this.pitch);
        this._qYaw.multiply(this._qPitch);

        this._offset.set(0, 0, 1)
            .applyQuaternion(this._qYaw)
            .multiplyScalar(this.distance);

        this._desiredPos.copy(this.target).add(this._offset);
        this.nav.cameraRig.position.lerp(this._desiredPos, Math.min(delta * 10, 1));
        this.nav._computeLookQuaternion(this.nav.targetQuaternion, this.nav.cameraRig.position, this.target);
        this.nav.cameraRig.quaternion.slerp(this.nav.targetQuaternion, Math.min(delta * 12, 1));

        // Update cursor to reflect active drag state (mouse button OR gesture drag)
        const nextCursor = (isHeld || gestureDragging) ? 'grabbing' : 'grab';
        if (nextCursor !== this._pointerCursor) {
            this._pointerCursor = nextCursor;
            this.nav?.upsertPointerIntent?.('nav-orbit', {
                kind: nextCursor === 'grabbing' ? 'drag' : 'ui',
                cursor: nextCursor,
                priority: nextCursor === 'grabbing' ? 500 : 160,
                reticleMode: 'hidden',
            });
        }
    }
}
