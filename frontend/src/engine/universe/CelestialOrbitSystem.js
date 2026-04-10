/**
 * CelestialOrbitSystem.js
 * OMEGA V28+ Architecture - Physics Layer
 */
import * as THREE from 'three';

export class CelestialOrbitSystem {
    static phase = 'physics';

    constructor(services) {
        this.services = services;
        this.orbitals = [];
    }

    async init() {
        console.log("[CelestialOrbitSystem] Physical Laws Active.");
    }

    /**
     * Registers an object to follow an orbital path.
     * @param {THREE.Object3D} object 
     * @param {number} radius 
     * @param {number} speed 
     * @param {number} startAngle 
     */
    registerOrbit(object, radius, speed = 0.01, startAngle = 0) {
        this.orbitals.push({
            object,
            radius,
            speed,
            angle: startAngle
        });
    }

    update(delta, time) {
        for (const orbital of this.orbitals) {
            orbital.angle += orbital.speed * delta;
            
            const x = Math.cos(orbital.angle) * orbital.radius;
            const z = Math.sin(orbital.angle) * orbital.radius;
            
            orbital.object.position.set(x, orbital.object.position.y, z);
        }
    }
}

