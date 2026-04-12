/**
 * RelativeFrameSystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 */
import * as THREE from 'three';

export class RelativeFrameSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
    }

    init() {
        console.log('[RelativeFrame] OMEGA Coordinate Engine Online.');
    }

    /**
     * Gets the normalized direction from A to B in relative space,
     * immune to global coordinate shifts.
     */
    getRelativeDirection(objectA, objectB) {
        if (!objectA || !objectB) return new THREE.Vector3(0, 1, 0);
        
        return new THREE.Vector3()
            .subVectors(objectB.position, objectA.position)
            .normalize();
    }

    /**
     * Resolves the local orthonormal frame for an object based on its quaternion.
     */
    getLocalFrame(object) {
        const q = object.quaternion;
        
        return {
            forward: new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize(),
            up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
            right: new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize()
        };
    }

    /**
     * Calculates the "Horizon Up" vector for an object relative to a gravity source.
     */
    getHorizonUp(object, planet) {
        const toPlanet = this.getRelativeDirection(object, planet);
        return toPlanet.clone().negate();
    }
}

