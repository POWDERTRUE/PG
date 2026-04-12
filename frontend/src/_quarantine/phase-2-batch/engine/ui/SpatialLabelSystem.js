import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Registry } from '../core/ServiceRegistry.js';

// registry/events imported via injection

/**
 * SpatialLabelSystem.js - V28 OMEGA
 * 
 * Manages holographic labels for discovered planets.
 */
export class SpatialLabelSystem {
    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.labels = new Map(); // planetId -> CSS2DObject
    }

    init() {
        this.events.on('planet:discovered', (data) => this.createLabel(data));
        
        // Auto-label when a discovered planet enters the LOD system range
        this.events.on('planet:registered', ({ id, mesh }) => {
            const log = this.Registry.get('DiscoveryLogSystem');
            if (log && log.discovered.has(id)) {
                this.createLabel(log.discovered.get(id));
            }
        });

        console.log('[SpatialLabelSystem] Online.');
    }

    createLabel(data) {
        if (this.labels.has(data.id)) return;

        const container = document.createElement('div');
        container.className = 'spatial-label-container';
        container.innerHTML = `
            <div class="spatial-label-glass">
                <div class="label-header">
                    <span class="status-dot"></span>
                    <span class="planet-name">${data.name}</span>
                </div>
                <div class="label-body">
                    <div class="stat"><span>BIOME:</span> ${data.hazard}</div>
                    <div class="resources">
                        ${data.resources.map(r => `<span class="res-tag">${r}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;

        // Style injected here for speed, though index.css is preferred
        Object.assign(container.style, {
            color: 'white',
            fontFamily: 'Outfit, sans-serif',
            pointerEvents: 'none'
        });

        const label = new CSS2DObject(container);
        
        // Find the planet mesh to attach
        const planetLOD = this.Registry.get('PlanetLODSystem');
        const planetData = planetLOD.activePlanets.get(data.id);
        
        if (planetData) {
            planetData.mesh.add(label);
            label.position.set(0, 150, 0); // Above planet
            this.labels.set(data.id, label);
        }
    }

    update(delta, time) {
        // Logic to face camera or fade based on distance
    }
}


