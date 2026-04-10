import { Registry } from '../core/ServiceRegistry.js';

// registry/events imported via injection

/**
 * ScanningSystem.js
 * OMEGA V28 Master Edition — Sensory & HUD
 */
export class ScanningSystem {
    static phase = 'sensory';
    constructor(services) {
        this.services = services;
        this.scanProgress = 0;
        this.scanTarget = null;
        this.scanTime = 3000;
    }

    init() {
        console.log('[Scanning] OMEGA Quantum Sensors Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');

        this.events.on('input:scan:start', () => this.startScan());
        this.events.on('input:scan:stop', () => this.stopScan());
    }

    startScan() {
        const raycaster = this.Registry.get('InteractionSystem')?.getRaycaster();
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        if (!raycaster || !camera) return;

        // Perform raycast against PLANET layer
        const planetLOD = this.Registry.get('PlanetLODSystem');
        const intersections = raycaster.intersectObjects(Array.from(planetLOD.activePlanets.values()).map(d => d.mesh), true);

        if (intersections.length > 0) {
            this.scanTarget = intersections[0].object; // Placeholder: refine to get planet ID
            console.log('[ScanningSystem] Target Locked.');
        }
    }

    stopScan() {
        this.scanTarget = null;
        this.scanProgress = 0;
        this.events.emit('ui:scan:progress', { progress: 0 });
    }

    update(delta, time) {
        if (!this.scanTarget) return;

        this.scanProgress += delta * 1000;
        const percent = Math.min(this.scanProgress / this.scanTime, 1.0);
        
        this.events.emit('ui:scan:progress', { progress: percent });

        if (percent >= 1.0) {
            this.completeScan();
        }
    }

    completeScan() {
        const idSystem = this.Registry.get('PlanetIdentitySystem');
        
        // Extract useful data from the target
        const planetId = this.scanTarget.uuid; 
        const seed = Math.abs(this.hashCode(planetId));
        
        const identity = idSystem.identify(planetId, seed);
        
        this.events.emit('planet:discovered', identity);
        this.stopScan();
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash;
    }
}
