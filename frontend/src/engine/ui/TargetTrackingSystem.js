import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

const TACTICAL_READOUT_SIGNAL = 'PG:OS:TACTICAL_READOUT_REQUESTED';
const OPEN_CONTEXT_MENU_SIGNAL = 'PG:OS:OPEN_CONTEXT_MENU';
const CLEAR_TACTICAL_READOUT_SIGNAL = 'PG:OS:CLEAR_TACTICAL_READOUT';
const DISENGAGE_AUTO_BRAKE_SIGNAL = 'PG:NAV:DISENGAGE_AUTO_BRAKE';
const INPUT_CONTEXT_CHANGED_SIGNAL = 'PG:INPUT:CONTEXT_CHANGED';
const WARP_SPOOLING_SIGNAL = 'PG:NAV:WARP_SPOOLING';
const WARP_TRANSIT_SIGNAL = 'PG:NAV:WARP_TRANSIT';
const WARP_DROPOUT_SIGNAL = 'PG:NAV:WARP_DROPOUT';
const IMMERSIVE_CONTEXT = 'HELM';

const TRACKER_SIZE = 88;
const TRACKER_HALF = TRACKER_SIZE * 0.5;
const TRACKER_MARGIN = 20;
const TRACKER_EPSILON = 0.000001;

export class TargetTrackingSystem {
    constructor() {
        this.phase = 'ui';
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.celestialRegistry = Registry.tryGet('CelestialRegistry') ?? Registry.tryGet('celestialRegistry');
        this.camera = Registry.tryGet('camera');
        this.scene = Registry.tryGet('scene');

        this.trackerElement = null;
        this.labelNode = null;
        this.statusNode = null;

        this.trackedMass = null;
        this.trackedTargetId = null;
        this.trackedDeterministicKey = null;
        this.trackedLabel = 'OBJETIVO';
        this.isActive = false;
        this.isOffscreen = false;
        this.isBehindCamera = false;
        this.screenX = 0;
        this.screenY = 0;
        this.bearingAngle = 0;

        this.viewportWidth = window.innerWidth || 0;
        this.viewportHeight = window.innerHeight || 0;
        this.halfWidth = this.viewportWidth * 0.5;
        this.halfHeight = this.viewportHeight * 0.5;

        this._worldPos = new THREE.Vector3();
        this._screenPos = new THREE.Vector3();
        this._cameraPos = new THREE.Vector3();
        this._cameraForward = new THREE.Vector3();
        this._toTarget = new THREE.Vector3();
        this._cameraSpace = new THREE.Vector3();

        this._removeReadoutListener = null;
        this._removeContextMenuListener = null;
        this._removeClearListener = null;
        this._removeDisengageListener = null;
        this._removeContextChangedListener = null;
        this._removeWarpSpoolingListener = null;
        this._removeWarpTransitListener = null;
        this._removeWarpDropoutListener = null;

        this._handleResize = this._handleResize.bind(this);
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.celestialRegistry = this.celestialRegistry || Registry.tryGet('CelestialRegistry') || Registry.tryGet('celestialRegistry');
        this.camera = this.camera || Registry.tryGet('camera');
        this.scene = this.scene || Registry.tryGet('scene');

        this._buildDOM();
        this._handleResize();

        if (this.runtimeSignals?.on) {
            this._removeReadoutListener = this.runtimeSignals.on(
                TACTICAL_READOUT_SIGNAL,
                (detail) => this._lockTarget(detail)
            );
            this._removeContextMenuListener = this.runtimeSignals.on(
                OPEN_CONTEXT_MENU_SIGNAL,
                (detail) => this._lockTarget(detail)
            );
            this._removeClearListener = this.runtimeSignals.on(
                CLEAR_TACTICAL_READOUT_SIGNAL,
                () => this.releaseLock()
            );
            this._removeDisengageListener = this.runtimeSignals.on(
                DISENGAGE_AUTO_BRAKE_SIGNAL,
                () => this.releaseLock()
            );
            this._removeContextChangedListener = this.runtimeSignals.on(
                INPUT_CONTEXT_CHANGED_SIGNAL,
                (detail) => {
                    if ((detail?.newContext ?? detail?.currentContext) === IMMERSIVE_CONTEXT) {
                        this.releaseLock();
                    }
                }
            );
            this._removeWarpSpoolingListener = this.runtimeSignals.on(
                WARP_SPOOLING_SIGNAL,
                () => this.trackerElement?.classList.add('is-warp-spooling')
            );
            this._removeWarpTransitListener = this.runtimeSignals.on(
                WARP_TRANSIT_SIGNAL,
                () => this.trackerElement?.classList.remove('is-warp-spooling')
            );
            this._removeWarpDropoutListener = this.runtimeSignals.on(
                WARP_DROPOUT_SIGNAL,
                () => this.trackerElement?.classList.remove('is-warp-spooling')
            );
        }

        window.addEventListener('resize', this._handleResize, { passive: true });
    }

    dispose() {
        this._removeReadoutListener?.();
        this._removeReadoutListener = null;
        this._removeContextMenuListener?.();
        this._removeContextMenuListener = null;
        this._removeClearListener?.();
        this._removeClearListener = null;
        this._removeDisengageListener?.();
        this._removeDisengageListener = null;
        this._removeContextChangedListener?.();
        this._removeContextChangedListener = null;
        this._removeWarpSpoolingListener?.();
        this._removeWarpSpoolingListener = null;
        this._removeWarpTransitListener?.();
        this._removeWarpTransitListener = null;
        this._removeWarpDropoutListener?.();
        this._removeWarpDropoutListener = null;
        window.removeEventListener('resize', this._handleResize);
        this.trackerElement?.remove();
        this.trackerElement = null;
    }

    getDebugState() {
        return {
            active: this.isActive,
            visible: !!this.trackerElement && !this.trackerElement.classList.contains('hidden'),
            targetId: this.trackedTargetId,
            deterministicKey: this.trackedDeterministicKey,
            label: this.trackedLabel,
            offscreen: this.isOffscreen,
            behindCamera: this.isBehindCamera,
            screenX: Math.round(this.screenX),
            screenY: Math.round(this.screenY),
            bearingAngleDeg: Math.round((this.bearingAngle * 180) / Math.PI),
        };
    }

    getTrackedTargetDetails() {
        if (!this.isActive) {
            return null;
        }

        const object = this._resolveTrackedTarget();
        if (!object) {
            return null;
        }

        return {
            object,
            targetId: this.trackedTargetId ?? object.uuid ?? null,
            deterministicKey: this.trackedDeterministicKey ?? object.userData?.deterministicKey ?? null,
            label: this.trackedLabel,
            screenX: this.screenX,
            screenY: this.screenY,
            massData: object.userData ?? {},
            offscreen: this.isOffscreen,
            behindCamera: this.isBehindCamera,
        };
    }

    update() {
        if (!this.isActive) {
            return;
        }

        this.camera = this.camera || Registry.tryGet('camera');
        if (!this.camera || !this.trackerElement) {
            return;
        }

        const target = this._resolveTrackedTarget();
        if (!target) {
            this.releaseLock();
            return;
        }

        // ── SYNC SEAL ─────────────────────────────────────────────────────────
        // FrameScheduler order: navigation (cameraRig moves) → render → ui (this).
        // Three.js only syncs matrixWorld inside renderer.render(), which runs in
        // 'render' phase — BEFORE us. But in OPS pan / HELM drag, the cameraRig
        // may have moved AFTER the last render call (post-navigation writes).
        // Forcing updateMatrixWorld() here costs ~0 GC and seals the 1-frame lag
        // that makes the tracker bracket jitter or trail behind during fast pan.
        this.camera.updateMatrixWorld();

        // Also ensure the tracked object's world matrix is current in case it's
        // an orbiting body whose physics updated after the last render flush.
        target.updateWorldMatrix(true, false);

        target.getWorldPosition(this._worldPos);
        this.camera.getWorldPosition(this._cameraPos);
        this.camera.getWorldDirection(this._cameraForward);
        this._toTarget.copy(this._worldPos).sub(this._cameraPos);
        this._cameraSpace.copy(this._worldPos).applyMatrix4(this.camera.matrixWorldInverse);

        const distanceSq = this._toTarget.lengthSq();
        if (distanceSq <= TRACKER_EPSILON) {
            this._hideTracker(false);
            return;
        }

        const invDistance = 1 / Math.sqrt(distanceSq);
        const forwardDot =
            (this._toTarget.x * invDistance * this._cameraForward.x) +
            (this._toTarget.y * invDistance * this._cameraForward.y) +
            (this._toTarget.z * invDistance * this._cameraForward.z);

        this._screenPos.copy(this._worldPos).project(this.camera);

        if (
            !Number.isFinite(this._screenPos.x) ||
            !Number.isFinite(this._screenPos.y) ||
            !Number.isFinite(this._cameraSpace.x) ||
            !Number.isFinite(this._cameraSpace.y) ||
            !Number.isFinite(this._cameraSpace.z)
        ) {
            this._hideTracker(false);
            return;
        }

        const isBehindCamera = forwardDot <= 0.025 || this._cameraSpace.z >= 0;
        const isWithinFrustum =
            this._screenPos.x >= -1 &&
            this._screenPos.x <= 1 &&
            this._screenPos.y >= -1 &&
            this._screenPos.y <= 1;

        const rawX = (this._screenPos.x * this.halfWidth) + this.halfWidth;
        const rawY = (-this._screenPos.y * this.halfHeight) + this.halfHeight;

        let finalX = rawX;
        let finalY = rawY;
        let isOffscreen = false;
        let bearingAngle = 0;

        if (!isBehindCamera && isWithinFrustum) {
            finalX = Math.min(
                Math.max(rawX, TRACKER_MARGIN + TRACKER_HALF),
                Math.max(TRACKER_MARGIN + TRACKER_HALF, this.viewportWidth - TRACKER_MARGIN - TRACKER_HALF)
            );
            finalY = Math.min(
                Math.max(rawY, TRACKER_MARGIN + TRACKER_HALF),
                Math.max(TRACKER_MARGIN + TRACKER_HALF, this.viewportHeight - TRACKER_MARGIN - TRACKER_HALF)
            );
            isOffscreen = rawX !== finalX || rawY !== finalY;
        } else {
            const edgeWidth = Math.max(TRACKER_MARGIN + TRACKER_HALF, this.halfWidth - TRACKER_MARGIN - TRACKER_HALF);
            const edgeHeight = Math.max(TRACKER_MARGIN + TRACKER_HALF, this.halfHeight - TRACKER_MARGIN - TRACKER_HALF);
            let dirX = this._cameraSpace.x;
            let dirY = -this._cameraSpace.y;

            if (isBehindCamera) {
                dirX = -dirX;
                dirY = -dirY;
            }

            if (Math.abs(dirX) < TRACKER_EPSILON && Math.abs(dirY) < TRACKER_EPSILON) {
                dirY = -1;
            }

            const dirLength = Math.hypot(dirX, dirY);
            const normX = dirX / (dirLength || 1);
            const normY = dirY / (dirLength || 1);
            const scaleX = Math.abs(normX) > TRACKER_EPSILON ? edgeWidth / Math.abs(normX) : Number.POSITIVE_INFINITY;
            const scaleY = Math.abs(normY) > TRACKER_EPSILON ? edgeHeight / Math.abs(normY) : Number.POSITIVE_INFINITY;
            const edgeScale = Math.min(scaleX, scaleY);

            finalX = this.halfWidth + (normX * edgeScale);
            finalY = this.halfHeight + (normY * edgeScale);
            isOffscreen = true;
            bearingAngle = Math.atan2(normY, normX);
        }

        this.screenX = finalX;
        this.screenY = finalY;
        this.isBehindCamera = isBehindCamera;
        this.isOffscreen = isOffscreen;
        this.bearingAngle = isOffscreen ? bearingAngle : 0;

        this.trackerElement.classList.remove('hidden', 'is-behind');
        this.trackerElement.classList.add('active');
        this.trackerElement.classList.toggle('is-offscreen', this.isOffscreen);
        this.trackerElement.classList.toggle('is-behind', this.isBehindCamera);
        this.trackerElement.style.setProperty('--target-bearing-angle', `${this.bearingAngle}rad`);
        this.statusNode.textContent = this.isBehindCamera ? 'REAR ARC' : this.isOffscreen ? 'BEARING' : 'LOCK ON';
        this.labelNode.textContent = (this.trackedLabel || 'OBJETIVO').toUpperCase();
        this.trackerElement.style.opacity = '1';
        this.trackerElement.style.transform = `translate3d(${Math.round(finalX - TRACKER_HALF)}px, ${Math.round(finalY - TRACKER_HALF)}px, 0)`;
    }

    releaseLock() {
        this.isActive = false;
        this.trackedMass = null;
        this.trackedTargetId = null;
        this.trackedDeterministicKey = null;
        this.trackedLabel = 'OBJETIVO';
        this.isOffscreen = false;
        this.isBehindCamera = false;
        this.screenX = 0;
        this.screenY = 0;
        this.bearingAngle = 0;
        this.trackerElement?.classList.remove('is-warp-spooling');
        this._hideTracker(false);
    }

    _buildDOM() {
        const host = document.getElementById('hud-layer') || document.body;
        document.getElementById('omega-target-tracker')?.remove();

        this.trackerElement = document.createElement('div');
        this.trackerElement.id = 'omega-target-tracker';
        this.trackerElement.className = 'omega-target-tracker hidden';
        this.trackerElement.innerHTML = `
            <div class="target-tracker-frame">
                <span class="target-tracker-corner top-left"></span>
                <span class="target-tracker-corner top-right"></span>
                <span class="target-tracker-corner bottom-left"></span>
                <span class="target-tracker-corner bottom-right"></span>
                <span class="target-tracker-core"></span>
                <span class="target-tracker-bearing"></span>
            </div>
            <div class="target-tracker-meta">
                <span class="target-tracker-label">OBJETIVO</span>
                <span class="target-tracker-status">LOCK ON</span>
            </div>
        `;

        this.labelNode = this.trackerElement.querySelector('.target-tracker-label');
        this.statusNode = this.trackerElement.querySelector('.target-tracker-status');
        host.appendChild(this.trackerElement);
    }

    _lockTarget(detail = {}) {
        const target = this._resolveTarget(detail.targetId, detail.deterministicKey);
        if (!target) {
            return;
        }

        this.trackedMass = target;
        this.trackedTargetId = detail.targetId ?? target.uuid ?? null;
        this.trackedDeterministicKey = detail.deterministicKey ?? target.userData?.deterministicKey ?? null;
        this.trackedLabel =
            detail.massData?.appName ||
            detail.massData?.label ||
            detail.name ||
            target.userData?.appName ||
            target.userData?.label ||
            target.name ||
            'OBJETIVO';
        this.isActive = true;
        this.trackerElement?.classList.remove('hidden');
        this.trackerElement?.classList.add('active');
    }

    _resolveTrackedTarget() {
        if (this.trackedMass?.parent) {
            return this.trackedMass;
        }

        const resolved = this._resolveTarget(this.trackedTargetId, this.trackedDeterministicKey);
        if (resolved) {
            this.trackedMass = resolved;
            return resolved;
        }

        return null;
    }

    _resolveTarget(targetId, deterministicKey) {
        if (targetId) {
            const byId =
                this.celestialRegistry?.getById?.(targetId) ??
                this.scene?.getObjectByProperty?.('uuid', targetId) ??
                null;
            if (byId) {
                return byId;
            }
        }

        const key = typeof deterministicKey === 'string' ? deterministicKey.trim() : '';
        if (!key || !this.scene?.traverse) {
            return null;
        }

        let found = null;
        this.scene.traverse((object) => {
            if (found || !object?.userData) {
                return;
            }
            if (object.userData.deterministicKey === key) {
                found = object;
            }
        });
        return found;
    }

    _hideTracker(behindCamera) {
        this.isBehindCamera = !!behindCamera;
        this.isOffscreen = false;
        this.bearingAngle = 0;
        if (!this.trackerElement) {
            return;
        }
        this.trackerElement.classList.remove('is-behind');
        this.trackerElement.classList.remove('is-offscreen', 'active', 'is-warp-spooling');
        this.trackerElement.classList.add('hidden');
        this.trackerElement.style.setProperty('--target-bearing-angle', '0rad');
        this.trackerElement.style.opacity = '0';
    }

    _handleResize() {
        this.viewportWidth = window.innerWidth || 0;
        this.viewportHeight = window.innerHeight || 0;
        this.halfWidth = this.viewportWidth * 0.5;
        this.halfHeight = this.viewportHeight * 0.5;
    }
}

export default TargetTrackingSystem;
