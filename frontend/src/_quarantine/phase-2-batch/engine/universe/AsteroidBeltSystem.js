/**
 * AsteroidBeltSystem.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class AsteroidBeltSystem {
    static phase = 'simulation';

    constructor(services) {
        this.services = services;
        this.belts = new Map();
    }

    init() {
        this.registry = Registry.get('registry');
        console.log('[AsteroidBeltSystem] OMEGA Debris Field Architect Online.');
    }

    /**
     * Create a procedural belt around an object.
     * @param {THREE.Object3D} parent 
     * @param {number} count 
     * @param {number} innerRadius 
     * @param {number} outerRadius 
     */
    createBelt(parent, count = 1000, innerRadius = 300, outerRadius = 500) {
        const instancedSystem = this.Registry.get('InstancedRenderSystem');
        if (!instancedSystem) return;

        const beltId = `Belt_${parent.id || Math.random()}`;
        
        // Simple procedural asteroid geometry
        const geometry = new THREE.IcosahedronGeometry(1.5, 0);
        const material = new THREE.MeshPhongMaterial({ color: 0x888888 });

        const batch = instancedSystem.createBatch(beltId, geometry, material, count);

        // Populate instances
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
            const height = (Math.random() - 0.5) * 50;
            
            const position = new THREE.Vector3(
                Math.cos(angle) * dist,
                height,
                Math.sin(angle) * dist
            );

            const rotation = new THREE.Euler(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            const scale = 0.5 + Math.random() * 2;

            instancedSystem.setInstance(beltId, i, position, rotation, scale);
        }

        instancedSystem.postUpdate();
        
        if (parent.add) {
            parent.add(instancedSystem.getMesh(beltId));
        }

        this.belts.set(beltId, { parent, count });
    }
}

