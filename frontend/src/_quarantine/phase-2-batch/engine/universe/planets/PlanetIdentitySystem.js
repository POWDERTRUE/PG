// registry/events imported via injection

/**
 * PlanetIdentitySystem.js - V26 OMEGA
 * 
 * Generates unique metadata (Names, Resources, Hazards) for planets.
 */
export class PlanetIdentitySystem {
    constructor() {
        this.prefixes = ['Neo', 'Nova', 'Xen', 'Ark', 'Zio', 'Prax', 'Kael'];
        this.suffixes = ['Prime', 'IV', 'VII', 'B', 'System', 'Major', 'Minor'];
        this.resources = ['Neon Gas', 'Powder Crystal', 'Liquid Meth', 'Dark Matter'];
    }

    identify(planetId, seed) {
        // Deterministic generation based on planet seed
        const name = this.generateName(seed);
        const resourceCount = 1 + (seed % 3);
        const selectedResources = [];
        
        for (let i = 0; i < resourceCount; i++) {
            selectedResources.push(this.resources[(seed + i) % this.resources.length]);
        }

        const hazards = ['NONE', 'LOW', 'MEDIUM', 'EXTREME'];
        const hazard = hazards[seed % hazards.length];

        const identity = {
            id: planetId,
            name: name,
            resources: selectedResources,
            hazard: hazard,
            discoveredAt: Date.now()
        };

        console.log(`[PlanetIdentity] Identity Created: ${name} (${hazard})`);
        return identity;
    }

    generateName(seed) {
        const p = this.prefixes[seed % this.prefixes.length];
        const s = this.suffixes[(seed + 7) % this.suffixes.length];
        return `${p}-${seed % 1000} ${s}`;
    }
}

