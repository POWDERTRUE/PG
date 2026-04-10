import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * CameraRig.js — OMEGA V-FINAL
 *
 * Single authoritative source of truth for camera position and orientation.
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 *
 *   SpatialInputSystem.state  (raw input deltas)
 *            ↓
 *   NavigationSystem / States  (intent: move, rotate, orbit)
 *            ↓
 *   CameraRig.position / quaternion  ← ONLY write point
 *            ↓
 *   THREE.PerspectiveCamera  (read-only rendering endpoint — synced in CameraSystem)
 *
 * ─── Rules ───────────────────────────────────────────────────────────────────
 *  • Navigation states write to CameraRig, NEVER to camera directly.
 *  • The rendering camera is a COPY — populated by CameraSystem.sync() each frame.
 *  • FloatingOriginSystem recenters the rig (not the camera) when needed.
 *  • Other systems that need camera position READ from CameraRig.position.
 *
 * ─── Registration ────────────────────────────────────────────────────────────
 *  Registry.register('cameraRig', cameraRig)
 *  The rig is accessible globally: Registry.get('cameraRig')
 */
export class CameraRig extends THREE.Object3D {
    constructor(scene) {
        super();
        this.name = 'CameraRig';
        scene?.add(this);

        // FOV is logical — CameraSystem reads this and syncs to THREE.Camera
        this.fov = 65;

        Registry.register('cameraRig', this);
        console.log('[CameraRig] Authoritative rig online.');
    }

    /**
     * Convenience method — look at a world-space target.
     * Sets the rig quaternion, does NOT touch the THREE.Camera.
     */
    lookAtTarget(target) {
        const m = new THREE.Matrix4().lookAt(this.position, target, this.up);
        this.quaternion.setFromRotationMatrix(m);
    }

    /**
     * NaN guard — called by CameraSystem.sync() before copying to camera.
     * Returns false if the rig state is corrupt.
     */
    validate() {
        const p = this.position;
        if (isNaN(p.x) || isNaN(p.y) || isNaN(p.z)) {
            console.error('[CameraRig] ⚠ NaN position detected — resetting to safe origin.');
            this.position.set(0, 150, 400);
            this.quaternion.identity();
            return false;
        }
        this.quaternion.normalize();
        return true;
    }
}
