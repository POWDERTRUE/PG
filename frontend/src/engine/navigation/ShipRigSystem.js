/**
 * ShipRigSystem.js — Powder Galaxy v2.0.0
 *
 * Registered engine system that owns the ShipRig Object3D hierarchy
 * and runs the 6-DoF physics loop via ShipController each frame.
 *
 * Architecture:
 *   ShipRig (Object3D)        ← physics writes position/quaternion here
 *     └ CameraMount           ← cameraRig is parented here while in COCKPIT
 *
 * Usage:
 *   // CockpitState.enter():
 *   shipRigSys.activate(startPosition, startQuaternion);
 *   shipRigSys.mountCamera(nav.cameraRig);
 *
 *   // CockpitState.update(delta):
 *   shipRigSys.applyInputs(axes, delta, boostMultiplier);
 *
 *   // CockpitState.exit():
 *   shipRigSys.unmountCamera(nav.cameraRig, scene);
 *   shipRigSys.deactivate();
 *
 * Telemetry (read by UniverseNavigationSystem._tickCockpitHUD):
 *   shipRigSys.speed          → m/s scalar
 *   shipRigSys.velocity       → THREE.Vector3
 *   shipRigSys.angularVelocity → THREE.Vector3
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { ShipController } from './ShipController.js';

export class ShipRigSystem {
    static phase = 'navigation';

    constructor() {
        this.active          = false;
        this.velocity        = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();

        /** The authoritative physics Object3D — camera mounts here */
        this.rig = new THREE.Object3D();
        this.rig.name = 'ShipRig';

        /** Camera attachment point — slight downward offset for cockpit feel */
        this._cameraMount = new THREE.Object3D();
        this._cameraMount.name = 'CameraMount';
        this._cameraMount.position.set(0, 0.8, 0);   // cockpit eye height offset
        this.rig.add(this._cameraMount);

        this._controller   = new ShipController();
        this._scene        = null;
        this._prevCamParent = null;

        // ── Telemetry (live, read each frame by HUD ticker) ───────────────────
        this.speed    = 0;
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    async init() {
        this._scene = Registry.get('scene') ?? window.engine?.scene;
        Registry.register('shipRigSystem', this);
        console.log('[ShipRigSystem] Online — ShipRig ready.');
    }

    // ─── Frame tick ───────────────────────────────────────────────────────────

    update(_delta) {
        // No-op when cockpit not active (zero CPU cost)
        // Physics are applied via applyInputs() called by CockpitState.update()
    }

    // ─── Cockpit activation ───────────────────────────────────────────────────

    /**
     * Activate the ShipRig at a given world position/orientation.
     * Adds the rig to the scene.
     *
     * @param {THREE.Vector3}    position
     * @param {THREE.Quaternion} quaternion
     */
    activate(position, quaternion) {
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.speed = 0;

        this.rig.position.copy(position);
        this.rig.quaternion.copy(quaternion);

        const scene = this._scene ?? Registry.get('scene') ?? window.engine?.scene;
        if (scene && !this.rig.parent) {
            scene.add(this.rig);
        }

        this.active = true;
        console.log('[ShipRigSystem] Activated at', position.toArray().map(v => v.toFixed(1)));
    }

    /** Deactivate: remove rig from scene, reset state. */
    deactivate() {
        this.rig.parent?.remove(this.rig);
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.speed  = 0;
        this.active = false;
        console.log('[ShipRigSystem] Deactivated.');
    }

    /**
     * Parent the cameraRig under the ShipRig's CameraMount so it rides
     * the ship without moving the camera directly.
     *
     * @param {THREE.Object3D} cameraRig
     */
    mountCamera(cameraRig) {
        this._prevCamParent = cameraRig.parent;

        // getWorldPosition/Quaternion before re-parenting so we can preserve look
        this._cameraMount.attach(cameraRig);

        // Reset local offset inside the mount (mount already has the eye-height)
        cameraRig.position.set(0, 0, 0);
        cameraRig.quaternion.identity();

        console.log('[ShipRigSystem] Camera mounted on CameraMount.');
    }

    /**
     * Remove the cameraRig from the mount and return it to either the scene
     * or its previous parent.
     *
     * @param {THREE.Object3D} cameraRig
     * @param {THREE.Object3D} fallbackScene
     */
    unmountCamera(cameraRig, fallbackScene) {
        const target = this._prevCamParent ?? fallbackScene;
        if (target) {
            target.attach(cameraRig);
        }
        this._prevCamParent = null;
        console.log('[ShipRigSystem] Camera unmounted.');
    }

    // ─── Physics tick (called by CockpitState.update each frame) ─────────────

    /**
     * Apply one frame of physics from the cockpit input axes.
     *
     * @param {{ forward, right, up, dPitch, dYaw, dRoll, boost }} axes
     * @param {number} delta
     */
    applyInputs(axes, delta) {
        if (!this.active) return;

        const ctrl = this._controller;

        // 1. MOUSE LOOK — direct quaternion rotation, NO angular momentum
        //    This is the FPS-style approach: mouse position = view direction.
        //    Applying through angularVelocity would create unwanted inertia.
        ctrl.applyMouseLook(
            this.rig.quaternion,
            axes.dYaw   ?? 0,   // already in radians (sensitivity applied upstream)
            axes.dPitch ?? 0
        );

        // 2. Thrust → velocity
        ctrl.applyThrust(
            this.velocity,
            { forward: axes.forward, right: axes.right, up: axes.up },
            this.rig.quaternion,
            axes.boost ?? 1,
            delta
        );

        // 3. Drag (exponential decay)
        ctrl.applyDrag(this.velocity, delta);

        // 4. Hard speed cap
        ctrl.clampSpeed(this.velocity);

        // 5. Roll angular momentum (Q/E — keyboard, inertial feel)
        //    Pitch+yaw angular velocity are cleared — mouse handles those directly.
        this.angularVelocity.x = 0;
        this.angularVelocity.y = 0;
        ctrl.applyAngularThrust(
            this.angularVelocity,
            { dRoll: axes.dRoll },   // only roll axis fed here
            delta
        );

        // 6. Angular drag (applies to roll only now)
        ctrl.applyAngularDrag(this.angularVelocity, delta);

        // 7. Apply roll angular velocity to rig quaternion
        ctrl.applyRotation(this.rig.quaternion, this.angularVelocity, delta);

        // 8. Advance position
        this.rig.position.addScaledVector(this.velocity, delta);

        // 9. Update telemetry
        this.speed = this.velocity.length();
    }
}
