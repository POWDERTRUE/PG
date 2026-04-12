import * as THREE from 'three';

/**
 * CloudSystem.js - V23 OMEGA
 * 
 * Procedural rotating cloud layers for planetary depth.
 */
export class CloudSystem {
    constructor() {
        this.activeClouds = new Map(); // planetId -> mesh
    }

    create(radius, color = 0xffffff) {
        const geo = new THREE.SphereGeometry(radius * 1.015, 64, 64);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        // Use a simple procedural noise pattern for the alpha map if possible
        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    }

    update(delta, time) {
        this.activeClouds.forEach(cloud => {
            cloud.rotation.y += delta * 0.05; // Slow rotation
        });
    }
}


