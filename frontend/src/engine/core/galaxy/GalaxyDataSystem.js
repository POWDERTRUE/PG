/**
 * GalaxyDataSystem.js
 * OMEGA V28 Master Edition — Universe Simulation
 */
export class GalaxyDataSystem {
    static phase = 'simulation';

    constructor(services) {
        this.services = services;
        this.bodies = new Map(); // Global ID -> Data
        this.sectors = new Map();
    }

    init() {
        console.log('[GalaxyDataSystem] OMEGA Galactic Registry Online.');
    }

    registerStar(id, sectorId, position, seed) {
        if (!this.sectors.has(sectorId)) {
            this.sectors.set(sectorId, []);
        }
        const star = { id, sectorId, position, seed };
        this.sectors.get(sectorId).push(star);
        this.bodies.set(id, star);
    }

    getStarsInSector(sectorId) {
        return this.sectors.get(sectorId) || [];
    }

    getStarById(id) {
        return this.bodies.get(id);
    }
}
