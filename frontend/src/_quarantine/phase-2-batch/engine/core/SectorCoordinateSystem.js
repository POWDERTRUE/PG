/**
 * ==========================================================
 * Powder Galaxy Engine - SectorCoordinateSystem V28 (OMEGA)
 * ==========================================================
 * @file SectorCoordinateSystem.js
 * @description Fixed-Point Astronomical Math. 
 * Bridges 10^12 km galaxy space to local engine coordinates.
 */
export class SectorCoordinateSystem {
    /** @type {string} */
    static phase = 'simulation';

    constructor(services) {
        this.services = services;
        /** @private One sector = 1 Light Day (~26 billion km) */
        this._sectorSize = 2.592e10; 
    }

    /**
     * Converts an absolute galaxy coordinate to (Sector, Offset).
     * @param {number} absVal 
     * @returns {{sector: number, offset: number}}
     */
    getSectorCoords(absVal) {
        const sector = Math.floor(absVal / this._sectorSize);
        const offset = absVal % this._sectorSize;
        return { sector, offset };
    }

    /**
     * Reconstructs an absolute coordinate from sector data.
     */
    getAbsolute(sector, offset) {
        return (sector * this._sectorSize) + offset;
    }
    
    /**
     * Calculates high-precision distance between two sector-based positions.
     */
    getDistance(posA, posB) {
        // Implementation using double-precision-aware logic
        const dx = (posB.sectorX - posA.sectorX) * this._sectorSize + (posB.offsetX - posA.offsetX);
        const dy = (posB.sectorY - posA.sectorY) * this._sectorSize + (posB.offsetY - posA.offsetY);
        const dz = (posB.sectorZ - posA.sectorZ) * this._sectorSize + (posB.offsetZ - posA.offsetZ);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

