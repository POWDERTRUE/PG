/**
 * CelestialHierarchySystem.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class CelestialHierarchySystem {
    static phase = 'simulation';
    constructor(services) {
        this.services = services;
        this.universeGroup = new THREE.Group();
        this.universeGroup.name = 'Universe_Root';
    }

    init() {
        console.log('[CelestialHierarchy] OMEGA Root Hierarchy Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.celestialRegistry = Registry.get('CelestialRegistry');
        
        const sceneGraph = this.Registry.get('SceneGraph');
        if (sceneGraph) {
            sceneGraph.addToLayer('universe', this.universeGroup);
        }
    }

    update(delta, time) {
        this.universeGroup.rotation.y += delta * 0.05;
    }
}

