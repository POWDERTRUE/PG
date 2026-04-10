/**
 * ShipController.js — Powder Galaxy v2.0.0
 *
 * Stateless physics math helper for 6-DoF spaceship flight.
 * Consumed by ShipRigSystem.update() each frame.
 *
 * ALL methods operate in-place on the Vector3/Euler refs passed in.
 * No state stored here — this is pure math.
 *
 * Physics model:
 *   velocity +=  thrust × delta                         (acceleration)
 *   velocity *=  (1 − linearDrag × delta)               (exponential decay — correct)
 *   velocity.clampLength(0, maxSpeed)                   (hard cap)
 *
 *   angularVelocity += torque × delta
 *   angularVelocity *= (1 − angularDrag × delta)
 */
import * as THREE from 'three';

export class ShipController {
    /**
     * @param {object} cfg
     * @param {number} cfg.thrustForce   — linear thrust magnitude  (default 180)
     * @param {number} cfg.maxSpeed      — m/s hard cap              (default 600)
     * @param {number} cfg.linearDrag    — [0–1] higher = snappier   (default 2.8)
     * @param {number} cfg.rollSpeed     — rad/s per unit input       (default 1.2)
     * @param {number} cfg.angularDrag   — [0–1] higher = snappier   (default 4.0)
     * @param {number} cfg.pitchSpeed    — rad/s per pixel            (default 0.0015)
     * @param {number} cfg.yawSpeed      — rad/s per pixel            (default 0.0015)
     * @param {number} cfg.boostMultiplier — Shift multiplier         (default 4.0)
     */
    constructor(cfg = {}) {
        this.thrustForce     = cfg.thrustForce     ?? 180;
        this.maxSpeed        = cfg.maxSpeed        ?? 600;
        this.linearDrag      = cfg.linearDrag      ?? 2.8;
        this.rollSpeed       = cfg.rollSpeed       ?? 1.2;
        this.angularDrag     = cfg.angularDrag     ?? 4.0;
        this.pitchSpeed      = cfg.pitchSpeed      ?? 0.0015;
        this.yawSpeed        = cfg.yawSpeed        ?? 0.0015;
        this.boostMultiplier = cfg.boostMultiplier ?? 4.0;

        // Scratch vectors — allocated once, reused each frame
        this._localThrust = new THREE.Vector3();
        this._worldThrust = new THREE.Vector3();
    }

    // ─── Linear physics ──────────────────────────────────────────────────────

    /**
     * Build a local-space thrust vector from axis inputs, transform to world
     * space using the rig's quaternion, then accumulate into velocity.
     *
     * @param {THREE.Vector3}    velocity   — modified in place
     * @param {object}           axes       — { forward, right, up } each −1/0/+1
     * @param {THREE.Quaternion} rigQuat    — ship world orientation
     * @param {number}           boost      — multiplier (1 or boostMultiplier)
     * @param {number}           delta
     */
    applyThrust(velocity, axes, rigQuat, boost, delta) {
        const force = this.thrustForce * boost;

        this._localThrust.set(
            (axes.right   ?? 0) * force,
            (axes.up      ?? 0) * force,
            -(axes.forward ?? 0) * force   // −Z = forward in Three.js
        );

        this._worldThrust.copy(this._localThrust).applyQuaternion(rigQuat);
        velocity.addScaledVector(this._worldThrust, delta);
    }

    /**
     * Exponential drag — the correct model.
     * velocity *= (1 − linearDrag × delta)
     *
     * @param {THREE.Vector3} velocity
     * @param {number}        delta
     */
    applyDrag(velocity, delta) {
        const factor = 1 - this.linearDrag * delta;
        velocity.multiplyScalar(Math.max(0, factor));
    }

    /**
     * Hard velocity cap — prevents runaway acceleration.
     * @param {THREE.Vector3} velocity
     */
    clampSpeed(velocity) {
        velocity.clampLength(0, this.maxSpeed);
    }

    // ─── Angular physics ─────────────────────────────────────────────────────

    /**
     * Accumulate angular torque from input axes (pitch, yaw, roll).
     * @param {THREE.Vector3} angularVelocity  — (pitch, yaw, roll) rad/s, modified in place
     * @param {object}        axes             — { dPitch, dYaw, dRoll } pointer-lock deltas / axis
     * @param {number}        delta
     */
    applyAngularThrust(angularVelocity, axes, delta) {
        // Only ROLL uses angular momentum accumulation (keyboard Q/E feel)
        // Mouse yaw+pitch are handled via applyMouseLook() — direct quaternion
        angularVelocity.z += (axes.dRoll ?? 0) * delta;   // roll
    }

    /**
     * Angular drag — exponential decay.
     * angularVelocity *= (1 − angularDrag × delta)
     * @param {THREE.Vector3} angularVelocity
     * @param {number}        delta
     */
    applyAngularDrag(angularVelocity, delta) {
        const factor = 1 - this.angularDrag * delta;
        angularVelocity.multiplyScalar(Math.max(0, factor));
    }

    /**
     * Apply accumulated angular velocity to the rig's quaternion using
     * proper axis-angle composition (no Gimbal Lock).
     *
     * @param {THREE.Quaternion} quat
     * @param {THREE.Vector3}    angularVelocity — (pitch, yaw, roll) rad/s
     * @param {number}           delta
     */
    /**
     * Apply MOUSE look directly to the rig quaternion — FPS style, no inertia.
     * Call this BEFORE applyRotation so roll momentum doesn't fight orientation.
     *
     * @param {THREE.Quaternion} quat
     * @param {number} dYaw   — radians to yaw this frame (from mouse dx)
     * @param {number} dPitch — radians to pitch this frame (from mouse dy)
     */
    applyMouseLook(quat, dYaw, dPitch) {
        if (Math.abs(dYaw) < 1e-7 && Math.abs(dPitch) < 1e-7) return;

        // Yaw around WORLD up (Y) — pre-multiply so heading stays stable
        if (Math.abs(dYaw) > 1e-7) {
            const q = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), dYaw
            );
            quat.premultiply(q);
        }

        // Pitch around LOCAL right (X) — post-multiply so it follows the hull
        if (Math.abs(dPitch) > 1e-7) {
            const q = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0), dPitch
            );
            quat.multiply(q);
        }

        quat.normalize();
    }

    applyRotation(quat, angularVelocity, delta) {
        const pz = angularVelocity.z * delta;  // roll only
        if (Math.abs(pz) < 1e-8) return;

        const dRoll = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1), pz
        );
        quat.multiply(dRoll);
        quat.normalize();
    }

    // ─── Telemetry helpers ───────────────────────────────────────────────────

    /**
     * Extract roll angle (degrees) from a quaternion.
     * @param {THREE.Quaternion} q
     * @returns {number} roll in degrees −180..+180
     */
    static rollDeg(q) {
        const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        return THREE.MathUtils.radToDeg(euler.z);
    }

    /**
     * Extract pitch angle (degrees).
     * @param {THREE.Quaternion} q
     * @returns {number} degrees
     */
    static pitchDeg(q) {
        const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        return THREE.MathUtils.radToDeg(euler.x);
    }

    /**
     * Extract heading (yaw) 0–360°.
     * @param {THREE.Quaternion} q
     * @returns {number} degrees 0–360
     */
    static headingDeg(q) {
        const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        let deg = THREE.MathUtils.radToDeg(-euler.y) % 360;
        if (deg < 0) deg += 360;
        return deg;
    }
}
