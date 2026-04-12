/**
 * ConstellationSystem.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class ConstellationSystem {
    static phase = 'workspace';
    constructor(services) {
        this.services = services;
        this.group = new THREE.Group();
        this.group.name = 'ConstellationGroup';
        this.lines = new Map();
    }

    init() {
        console.log('[Constellation] OMEGA Visual Matrix Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');

        const sceneGraph = this.Registry.get('SceneGraph');
        if (sceneGraph) {
            sceneGraph.getScene().add(this.group);
        }
    }

    update() {
        const winManager = this.Registry.get('WindowManager');
        if (!winManager) return;
        
        const windows = winManager.windows;
        if (!windows) return;

        // Visual Links Logic...
    }

    updateLine(key, posA, posB) {
        let line = this.lines.get(key);
        if (!line) {
            const geometry = new THREE.BufferGeometry().setFromPoints([posA, posB]);
            const material = new THREE.LineBasicMaterial({ 
                color: 0x00f0ff, 
                transparent: true, 
                opacity: 0.2,
                blending: THREE.AdditiveBlending
            });
            line = new THREE.Line(geometry, material);
            this.group.add(line);
            this.lines.set(key, line);
        } else {
            line.geometry.setFromPoints([posA, posB]);
            line.geometry.attributes.position.needsUpdate = true;
        }
    }
}

