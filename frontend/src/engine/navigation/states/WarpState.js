/**
 * WarpState.js — OMEGA V-FINAL
 *
 * Cinematic GSAP camera travel from current rig position to a target Object3D.
 * On complete, transitions to FOCUS state.
 *
 * Writes ONLY to CameraRig — never to THREE.Camera directly.
 */
import * as THREE from 'three';
import { CAMERA_STATE } from '../CameraStateMachine.js';
import { Registry } from '../../core/ServiceRegistry.js';

const PRECISION_ARRIVAL_SKEW = 0.76;

function precisionArrivalEase(t) {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    const skewed = Math.pow(clamped, PRECISION_ARRIVAL_SKEW);
    return THREE.MathUtils.smootherstep(skewed, 0, 1);
}

function cinematicWarpEase(t) {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);
    if (clamped < 0.5) {
        return 4 * clamped * clamped * clamped;
    }
    return 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export class WarpState {
    constructor() {
        this.fsm       = null;
        this.nav       = null;
        this.runtimeSignals = null;
        this._warpLifecycle = 'IDLE';
        this._spoolElapsed = 0;
        this._transitElapsed = 0;
        this._spoolStartedAt = 0;
        this._transitStartedAt = 0;
        this._duration = 0;
        this._spoolDuration = 0;
        this._finalDist = 0;
        this._onCompleteState = CAMERA_STATE.FOCUS;
        this._isPrecisionArrival = false;
        this._targetObject = null;

        this._startPos = new THREE.Vector3();
        this._endPos = new THREE.Vector3();
        this._targetWorldPos = new THREE.Vector3();
        this._targetNormal = new THREE.Vector3();
        this._direction = new THREE.Vector3();
        this._handoffTarget = new THREE.Vector3();
        this._startQuat = new THREE.Quaternion();
        this._endQuat = new THREE.Quaternion();
        this._bounds = new THREE.Box3();
        this._boundsSize = new THREE.Vector3();

        this._warpSignalPayload = {
            source: 'warp-state',
            targetId: null,
            deterministicKey: null,
            targetName: 'OBJETIVO DE WARP',
            baseFov: 65,
            precision: false,
            spoolDuration: 0,
            duration: 0,
        };
    }

    enter(data = {}) {
        console.log('[WarpState] Hyper-Warp engaged.');
        const {
            targetObject,
            targetPoint = null,
            targetNormal = null,
            onCompleteState = CAMERA_STATE.FOCUS,
            distanceOffset  = 60,
            duration        = 1.5,
            spoolDuration   = null,
        } = data;

        if (!targetObject && !(targetPoint instanceof THREE.Vector3)) {
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT);
            return;
        }

        const rig = this.nav.cameraRig;

        this._startPos.copy(rig.position);
        this._startQuat.copy(rig.quaternion);

        if (targetObject) {
            targetObject.getWorldPosition(this._targetWorldPos);
        } else {
            this._targetWorldPos.copy(targetPoint);
        }

        let finalDist = Math.max(distanceOffset, 0);
        let direction;
        const isPrecisionArrival = !targetObject
            && targetPoint instanceof THREE.Vector3
            && onCompleteState === CAMERA_STATE.FREE_FLIGHT;

        if (targetObject) {
            const bbox   = this._bounds.setFromObject(targetObject);
            const size   = bbox.getSize(this._boundsSize);
            const maxDim = Math.max(size.x, size.y, size.z, 1);
            finalDist = Math.max(maxDim * 2.5, distanceOffset);
            direction = this._direction
                .subVectors(this._startPos, this._targetWorldPos)
                .normalize();
        } else if (targetNormal instanceof THREE.Vector3 && targetNormal.lengthSq() > 0.0001) {
            direction = this._direction.copy(targetNormal).normalize();
        } else {
            direction = this._direction
                .subVectors(this._startPos, this._targetWorldPos)
                .normalize();
        }

        if (direction.lengthSq() < 0.0001) direction.set(0, 0.3, 1).normalize();

        this._endPos.copy(this._targetWorldPos).addScaledVector(direction, finalDist);
        this.nav._computeLookQuaternion(this._endQuat, this._endPos, this._targetWorldPos);

        const baseFov = rig.fov ?? 65;
        const warpSpoolDuration = Number.isFinite(spoolDuration)
            ? Math.max(spoolDuration, 0)
            : (isPrecisionArrival ? 0.32 : 0.46);

        this._targetObject = targetObject ?? null;
        this._duration = Math.max(duration, 0);
        this._spoolDuration = warpSpoolDuration;
        this._spoolElapsed = 0;
        this._transitElapsed = 0;
        this._spoolStartedAt = performance.now();
        this._transitStartedAt = 0;
        this._finalDist = finalDist;
        this._onCompleteState = onCompleteState;
        this._isPrecisionArrival = isPrecisionArrival;
        this._handoffTarget.copy(this._targetWorldPos);

        this._warpSignalPayload.targetId = targetObject?.uuid ?? null;
        this._warpSignalPayload.deterministicKey = targetObject?.userData?.deterministicKey ?? null;
        this._warpSignalPayload.targetName =
            targetObject?.name ||
            targetObject?.userData?.appName ||
            targetObject?.userData?.label ||
            (isPrecisionArrival ? 'VECTOR DE APROXIMACION' : 'OBJETIVO DE WARP');
        this._warpSignalPayload.baseFov = baseFov;
        this._warpSignalPayload.precision = isPrecisionArrival;
        this._warpSignalPayload.spoolDuration = warpSpoolDuration;
        this._warpSignalPayload.duration = this._duration;

        this._warpLifecycle = 'SPOOLING';
        this._getRuntimeSignals()?.emit?.('PG:NAV:WARP_SPOOLING', this._warpSignalPayload);
        this._getRuntimeSignals()?.emit?.('PG:UI:PRINT_LULU', {
            text: `[NAV] :: Anclando coordenadas de salto hacia ${this._warpSignalPayload.targetName}.`,
        });
        if (this._spoolDuration <= 0) {
            this._beginTransit(this._spoolStartedAt);
        }
    }

    exit() {
        if (this._warpLifecycle !== 'IDLE' && this._warpLifecycle !== 'DROPOUT') {
            this._getRuntimeSignals()?.emit?.('PG:NAV:WARP_DROPOUT', {
                source: 'warp-state',
                baseFov: this.nav?.cameraRig?.fov ?? this.nav?.defaultFov ?? 65,
                targetName: this.nav?.focusTarget?.name ?? 'OBJETIVO DE WARP',
            });
        }
        this._warpLifecycle = 'IDLE';
        this._spoolElapsed = 0;
        this._transitElapsed = 0;
        this._spoolStartedAt = 0;
        this._transitStartedAt = 0;
        this._targetObject = null;
    }

    update(_delta = 0) {
        if (this._warpLifecycle === 'IDLE' || !this.nav?.cameraRig) {
            return;
        }

        const now = performance.now();

        if (this._warpLifecycle === 'SPOOLING') {
            this._spoolElapsed = (now - this._spoolStartedAt) * 0.001;
            if (this._spoolElapsed >= this._spoolDuration) {
                const overflow = this._spoolElapsed - this._spoolDuration;
                this._beginTransit(now - (overflow * 1000));
                if (overflow > 0) {
                    this._tickTransit(now);
                }
            }
            return;
        }

        if (this._warpLifecycle === 'TRANSIT') {
            this._tickTransit(now);
        }
    }

    _getRuntimeSignals() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        return this.runtimeSignals;
    }

    _beginTransit(startedAt = performance.now()) {
        if (this._warpLifecycle !== 'SPOOLING') {
            return;
        }
        this._warpLifecycle = 'TRANSIT';
        this._transitElapsed = 0;
        this._transitStartedAt = startedAt;
        this._getRuntimeSignals()?.emit?.('PG:NAV:WARP_TRANSIT', this._warpSignalPayload);
    }

    _tickTransit(now = performance.now()) {
        const rig = this.nav.cameraRig;
        this._transitElapsed = (now - this._transitStartedAt) * 0.001;
        const rawT = this._duration <= 0
            ? 1
            : THREE.MathUtils.clamp(this._transitElapsed / this._duration, 0, 1);
        const easedT = this._isPrecisionArrival
            ? precisionArrivalEase(rawT)
            : cinematicWarpEase(rawT);

        rig.position.lerpVectors(this._startPos, this._endPos, easedT);
        rig.quaternion.slerpQuaternions(this._startQuat, this._endQuat, easedT);
        rig.quaternion.normalize();

        if (rawT >= 1) {
            this._completeTransit();
        }
    }

    _completeTransit() {
        if (this._warpLifecycle !== 'TRANSIT') {
            return;
        }

        const rig = this.nav.cameraRig;
        rig.position.copy(this._endPos);
        rig.quaternion.copy(this._endQuat).normalize();
        this._warpLifecycle = 'DROPOUT';
        this._getRuntimeSignals()?.emit?.('PG:NAV:WARP_DROPOUT', this._warpSignalPayload);

        if (this._targetObject?.userData?.appId) {
            window.dispatchEvent(new CustomEvent('WARP_FLIGHT_COMPLETE', {
                detail: {
                    ...this._targetObject.userData,
                    targetName: this._targetObject.name || this._targetObject.userData?.appName || null,
                    source: 'navigation',
                    openWindow: false,
                }
            }));
        }

        if (this._onCompleteState === CAMERA_STATE.FREE_FLIGHT) {
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT, { force: true }, true);
            return;
        }

        this.fsm.to(this._onCompleteState, {
            targetObject: this._targetObject,
            target: this._handoffTarget,
            orbitDistance: this._finalDist,
        });
    }
}
