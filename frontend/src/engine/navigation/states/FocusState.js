/**
 * FocusState.js — OMEGA V-FINAL
 *
 * Camera zooms in and locks focus on a target Object3D.
 * From FOCUS the user can:
 *   - Orbit (drag mouse)
 *   - Scroll zoom
 *   - ESC → back to FREE_FLIGHT
 *
 * Differences from OrbitState:
 *   - FOCUS is entered after a WARP cinematic completes (target-specific)
 *   - Shows a subtle focus ring effect (dispatches FOCUS_ENTER event for UI)
 *   - Zoom range is tighter (closer min distance)
 *   - Receives target handoff from WarpState after cinematic travel
 */
import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';

export class FocusState {
    constructor() {
        this.fsm = null;
        this.nav = null;

        this.targetObject = null;
        this.target       = new THREE.Vector3();

        this.distance    = 60;
        this.minDist     = 5;
        this.maxDist     = 2000;
        this.yaw         = 0;
        this.pitch        = 0;
        this.sensitivity  = 0.003;
        this.zoomSpeed    = 0.10;

        this._input = null;
        this._qYaw = new THREE.Quaternion();
        this._qPitch = new THREE.Quaternion();
        this._yawAxis = new THREE.Vector3(0, 1, 0);
        this._pitchAxis = new THREE.Vector3(1, 0, 0);
        this._offset = new THREE.Vector3();
        this._desiredPos = new THREE.Vector3();
    }

    enter(data = {}) {
        this._input = null;

        this.targetObject = data.targetObject ?? null;
        if (this.targetObject) {
            this.targetObject.getWorldPosition(this.target);
        } else if (data.target instanceof THREE.Vector3) {
            this.target.copy(data.target);
        } else {
            this.target.copy(this.nav.cameraRig.position);
        }

        const dist = data.orbitDistance ?? data.distance ?? 60;
        this.distance = Math.max(this.minDist, Math.min(this.maxDist, dist));
        this.nav.focusTarget = this.targetObject ?? this.nav.focusTarget;

        // Seed angles from current rig quaternion for smooth entry
        const e = new THREE.Euler().setFromQuaternion(
            this.nav.cameraRig.quaternion, 'YXZ'
        );
        this.yaw   = e.y;
        this.pitch = e.x;

        console.log(`[FocusState] Locked onto: ${this.targetObject?.userData?.appName ?? 'point'}`);

        const appId = this.targetObject?.userData?.appId ?? null;
        const pawnController = Registry.tryGet('pawnController') ?? window.Registry?.tryGet?.('pawnController') ?? window.Registry?.get?.('pawnController') ?? null;
        if (this.targetObject && pawnController) {
            pawnController.setPawn(this.targetObject, {
                mode: 'focus-lock',
                source: 'mass-selection',
            });
        }

        const aimRay = Registry.tryGet('aimRay') ?? window.Registry?.tryGet?.('aimRay') ?? window.Registry?.get?.('aimRay') ?? null;
        aimRay?.showReticle?.(!!this.targetObject);

        if (this.targetObject) {
            this.targetObject.userData = {
                ...(this.targetObject.userData || {}),
                avatarSandboxReady: true,
                luluManipulable: true,
                selectionContract: 'LULU_FOCUS',
            };

            window.dispatchEvent(new CustomEvent('PG:MASS_FOCUS_ACQUIRED', {
                detail: {
                    object: this.targetObject,
                    source: 'focus-state',
                }
            }));
        }

        window.dispatchEvent(new CustomEvent('CAMERA_FOCUS_ENTER', {
            detail: { target: this.target, appId }
        }));

        this.nav?.upsertPointerIntent?.('nav-focus', {
            kind: 'ui',
            cursor: 'crosshair',
            priority: 170,
            reticleMode: 'hidden',
        });
    }

    exit() {
        this.nav?.clearPointerIntent?.('nav-focus');
        window.dispatchEvent(new CustomEvent('CAMERA_FOCUS_EXIT'));
        this.targetObject = null;
    }

    getSnapshot() {
        return {
            targetObject:  this.targetObject,
            orbitDistance: this.distance,
        };
    }

    update(delta) {
        if (!this._input) this._input = Registry.tryGet('InputStateSystem');
        if (this.nav?.isMapContextActive?.()) return;

        const input = this._input;
        const cameraMode = this.nav?.getCameraMode?.() ?? 'FOCUS';
        const contextMode = this.nav?.getContextMode?.() ?? 'NONE';

        // Track target if it's a moving Object3D
        if (this.targetObject) {
            this.targetObject.getWorldPosition(this.target);
        }

        // ── Mouse-drag orbit around focus ─────────────────────────────────
        const isUiCapture = input?.isUiCapturingPointer?.() ?? false;
        const isHeld =
            !isUiCapture && (
                input?.isButton?.(2) ||
                input?.state?.mouseButtons?.has?.(2)
            );
        const lookDX = input?.getLookDX?.() ?? 0;
        const lookDY = input?.getLookDY?.() ?? 0;
        if (input && (isHeld || input?.pointer?.locked) && !input?.hudMode) {
            this.yaw   -= lookDX * this.sensitivity;
            this.pitch -= lookDY * this.sensitivity;
        }

        const orbitSpeed = delta * 1.45;
        if (!input?.hudMode) {
            const orbitStrafe = input?.getControlAxis?.('FLIGHT_STRAFE', { cameraMode, contextMode }) ?? 0;
            const orbitThrust = input?.getControlAxis?.('FLIGHT_THRUST', { cameraMode, contextMode }) ?? 0;
            this.yaw += orbitStrafe * orbitSpeed;
            this.pitch -= orbitThrust * orbitSpeed * 0.85;
        }

        const PITCH_LIMIT = Math.PI / 2 - 0.01;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

        // ── Scroll zoom ───────────────────────────────────────────────────
        if (input && Math.abs(input.scroll.dy) > 0) {
            const factor = input.scroll.dy > 0 ? 1 + this.zoomSpeed : 1 - this.zoomSpeed;
            this.distance = Math.max(this.minDist, Math.min(this.maxDist, this.distance * factor));
        }

        // ── Compute rig pose ──────────────────────────────────────────────
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
    }
}
