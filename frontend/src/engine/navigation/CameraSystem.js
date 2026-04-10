// frontend/src/engine/navigation/CameraSystem.js
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * CameraSystem — OMEGA V-FINAL
 *
 * Owns the THREE.PerspectiveCamera (rendering endpoint only).
 * Its sole job each frame is to copy the authoritative CameraRig state
 * into the camera — no navigation logic lives here.
 *
 * Lifecycle:
 *   constructor()      — creates the Three.js camera, does NOT set position (Rig does)
 *   sync()             — call once per frame AFTER all navigation is resolved
 *   validate()         — NaN guard delegated to CameraRig
 *   handleResize()     — updates projection matrix on viewport change
 */
export class CameraSystem {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(
            65,
            window.innerWidth / window.innerHeight,
            0.1,
            15000
        );
        this.camera.name = 'MainCamera';

        // Register the raw camera for systems that MUST read from it (e.g. raycasting)
        Registry.register('camera', this.camera);

        // rig is resolved lazily in sync() so it's available after boot
        this._rig = null;
    }

    /**
     * Syncs the rendering camera from CameraRig state.
     * Call this at the END of the navigation phase (or start of render phase).
     */
    sync() {
        if (!this._rig) {
            this._rig = Registry.get('cameraRig');
            if (!this._rig) return;
        }

        this._rig.validate();

        this.camera.position.copy(this._rig.position);
        this.camera.quaternion.copy(this._rig.quaternion);

        // Sync FOV if navigation changed it
        if (this._rig.fov !== this.camera.fov) {
            this.camera.fov = this._rig.fov;
            this.camera.updateProjectionMatrix();
        }
    }

    /**
     * NaN guard — delegates to CameraRig for the source-of-truth check.
     */
    validate() {
        this._rig = this._rig || Registry.get('cameraRig');
        this._rig?.validate();

        const p = this.camera.position;
        if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) {
            this.camera.position.set(0, 150, 400);
            this.camera.quaternion.identity();
            this.camera.updateProjectionMatrix();
        }
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}
