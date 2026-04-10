import * as THREE from 'three';

/**
 * TerrainSystem.js - V22 OMEGA
 * 
 * Manages procedural terrain generation using noise functions.
 */
export class TerrainSystem {
    constructor() {
        this.seed = Math.random();
    }

    generateHeight(x, z) {
        // Simple noise imitation
        return Math.sin(x * 0.05 + this.seed) * Math.cos(z * 0.05 + this.seed) * 10;
    }

    applyToMesh(mesh) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i);
            const pz = pos.getZ(i);
            const h = this.generateHeight(px, pz);
            pos.setY(i, h);
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }
}


