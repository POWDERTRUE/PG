import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


/**
 * DynamicStarLODSystem.js - V28 OMEGA
 * 
 * Implements Dynamic LOD for stars.
 * Far: GL Points (CosmicBackground) | Near: Instanced Spheres (Premium)
 */
export class DynamicStarLODSystem {
    /** @type {string} */
    static phase = 'render';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.nearThreshold = 5000;
        this.activeNearStars = new Set();
    }

    init() {
        console.log('[DynamicStarLOD] Premium Star LOD Engine Online.');
        
        const instanced = this.Registry.get('InstancedRenderSystem');
        if (instanced) {
            const geo = new THREE.SphereGeometry(0.5, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            instanced.createBatch('LOD_STARS', geo, mat, 1000);
        }
    }

    update(delta, time) {
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        const instanced = this.Registry.get('InstancedRenderSystem');
        const bg = this.Registry.get('CosmicBackgroundSystem');
        
        if (!camera || !instanced || !bg) return;
        
        const pos = camera.position;
        const distToCenter = pos.length();
        const mesh = instanced.getMesh('LOD_STARS');
        
        if (distToCenter < this.nearThreshold) {
            if (mesh) mesh.visible = true;
            if (bg.starfield) bg.starfield.material.opacity = 0.3;
        } else {
            if (mesh) mesh.visible = false;
            if (bg.starfield) bg.starfield.material.opacity = 1.0;
        }
    }
}


