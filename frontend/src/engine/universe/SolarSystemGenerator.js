/**
 * SolarSystemGenerator.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class SolarSystemGenerator {
    static phase = 'simulation';

    constructor(services) {
        this.services = services;
        this.activeSystems = new Map();
    }

    init() {
        this.registry = Registry.get('registry');
        console.log('[SolarSystemGenerator] OMEGA Stellar Architect Online.');
    }

    generate(starId, position, seed = 12345) {
        if (this.activeSystems.has(starId)) return;
        
        const celestialRegistry = this.Registry.get('CelestialRegistry');
        if (!celestialRegistry) return;

        // Use a deterministic random function
        const random = (s) => {
            const x = Math.sin(s++) * 10000;
            return x - Math.floor(x);
        };

        const group = celestialRegistry.createGroup(`System_${starId}`);
        if (group) group.position.copy(position);

        // Deterministic Sun
        const sun = celestialRegistry.createCelestial('SUN', { 
            name: `Sun_${starId}`, 
            radius: 40 + random(seed) * 20, 
            color: 0xffcc00, 
            parent: group 
        });

        const planetCount = 2 + Math.floor(random(seed + 1) * 6);
        for (let i = 0; i < planetCount; i++) {
            const planetSeed = seed + i * 100;
            const planet = celestialRegistry.createCelestial('PLANET', {
                name: `Planet_${starId}_${i}`,
                radius: 5 + random(planetSeed) * 15,
                distance: 200 + i * 150 + random(planetSeed + 1) * 50,
                color: Math.floor(random(planetSeed + 2) * 0xffffff),
                parent: sun
            });

            this.Registry.get('PlanetLODSystem')?.registerPlanet(planet.id || `P_${starId}_${i}`, planet);
            
            if (random(planetSeed + 3) > 0.7) {
                this.Registry.get('PlanetRingSystem')?.addRing(planet, 0xaaaaaa);
            }
        }

        this.activeSystems.set(starId, { group, sun });
    }
}

