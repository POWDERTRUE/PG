// frontend/src/engine/physics/OrbitNode.js
import * as THREE from 'three';

/**
 * OrbitNode — A THREE.Object3D that rotates on its Y-axis each frame.
 * Add child meshes offset on X to achieve orbital motion around the origin.
 */
export class OrbitNode extends THREE.Object3D {
    constructor(speed = 0.001) {
        super();
        this.orbitSpeed  = speed;
        this.isOrbitNode = true; // type-guard for CelestialPhysicsSystem
    }

    /** @param {number} deltaTime - seconds since last frame */
    update(deltaTime) {
        // Frame-independent orbital mechanics
        this.rotation.y += this.orbitSpeed * deltaTime;
    }
}
