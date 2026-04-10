/**
 * CelestialOrbitSystem.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class CelestialOrbitSystem {
    static phase = 'simulation';
    constructor(services) {
        this.services = services;
        this.paused = false;
        this.timeScale = 1.0;
    }

    init() {
        console.log('[CelestialOrbit] OMEGA Orbital Physics Active.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.celestialRegistry = Registry.get('CelestialRegistry');
    }

    update(delta, time) {
        if (this.paused) return;
        const effectiveDelta = delta * this.timeScale;
        
        const megaSun = this.celestialRegistry?.getMegaSun();
        if (megaSun) megaSun.rotation.y += effectiveDelta * 0.1;
    }

    pause() { this.paused = true; }
    resume() { this.paused = false; }
}



