/**
 * PlanetRingSystem.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class PlanetRingSystem {
    static phase = 'simulation';

    constructor(services) {
        this.services = services;
    }

    init() {
        this.registry = Registry.get('registry');
        console.log('[PlanetRing] OMEGA Ring Orchestrator Online.');
    }

    /**
     * Create a ring around a planet
     */
    addRing(planetGroup, color, innerRadius = 300, outerRadius = 500, count = 10000) {
        const instancedRender = this.Registry.get('InstancedRenderSystem');
        if (!instancedRender) return;

        const batchId = `RING_${planetGroup.name}`;
        const geo = new THREE.TorusGeometry(1, 0.05, 2, 8, Math.PI / 4); 
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.9,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });

        instancedRender.createBatch(batchId, geo, mat, count);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
            const pos = new THREE.Vector3(
                Math.cos(angle) * dist,
                (Math.random() - 0.5) * 0.5,
                Math.sin(angle) * dist
            );

            instancedRender.setInstance(batchId, i, pos, null, 0.2 + Math.random() * 0.5, color);
        }

        const batchMesh = instancedRender.getMesh(batchId);
        if (batchMesh) planetGroup.add(batchMesh);
    }
}

