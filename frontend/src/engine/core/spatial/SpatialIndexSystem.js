/**
 * SpatialIndexSystem.js
 * OMEGA V28 Master Edition — Foundation Layer
 */
import * as THREE from 'three';

export class SpatialIndexSystem {
    static phase = 'foundation';

    constructor(services) {
        this.services = services;
        /** @private Cell size (km) */
        this._gridSize = 10000;
        /** @private Map<number, GridCell> - Key: Numeric Hash */
        this._cells = new Map();
        /** @private Map<number, number> - EntityId -> CellHash */
        this._entityLocations = new Map();
        
        // Cache & Pre-allocation
        this._tempBox = new THREE.Box3();
        this._lastFrustumHash = 0;
        this._cachedResults = [];
        this._lastUpdateTick = 0;
    }

    /**
     * Compact 64-bit style hash for 3D coordinates.
     * Maps x,y,z into a single numeric key for Map performance.
     */
    _hashCoords(x, y, z) {
        // We use a simple bit-shift for a 20-bit range per axis (approx +/- 500k units)
        // For infinite galaxy, we can use a more robust Cantor-like pairing if needed.
        return (x + 0x80000) | ((y + 0x80000) << 20) | ((z + 0x80000) << 40);
    }

    init() {
        console.log('[SpatialIndex] OMEGA Unified Sparse-Octree Online.');
    }

    /**
     * Updates an entity's position in the spatial grid and its internal octree-cell.
     * @param {number} entityId 
     * @param {THREE.Vector3} absPos 
     */
    updateEntity(entityId, absPos) {
        const gx = Math.floor(absPos.x / this._gridSize);
        const gy = Math.floor(absPos.y / this._gridSize);
        const gz = Math.floor(absPos.z / this._gridSize);
        const cellHash = this._hashCoords(gx, gy, gz);

        const oldHash = this._entityLocations.get(entityId);
        if (oldHash === cellHash) return;

        // Cleanup old
        if (oldHash !== undefined) {
            const cell = this._cells.get(oldHash);
            if (cell) cell.entities.delete(entityId);
        }

        // Add to new
        let cell = this._cells.get(cellHash);
        if (!cell) {
            const min = new THREE.Vector3(gx * this._gridSize, gy * this._gridSize, gz * this._gridSize);
            const max = new THREE.Vector3((gx + 1) * this._gridSize, (gy + 1) * this._gridSize, (gz + 1) * this._gridSize);
            
            cell = {
                entities: new Set(),
                bounds: new THREE.Box3(min, max)
            };
            this._cells.set(cellHash, cell);
        }
        
        cell.entities.add(entityId);
        this._entityLocations.set(entityId, cellHash);
        this._resultsDirty = true;
    }

    /**
     * Removes an entity from the spatial grid.
     * @param {number} entityId 
     */
    removeEntity(entityId) {
        const oldHash = this._entityLocations.get(entityId);
        if (oldHash !== undefined) {
            const cell = this._cells.get(oldHash);
            if (cell) cell.entities.delete(entityId);
            this._entityLocations.delete(entityId);
            this._resultsDirty = true;
        }
    }

    /**
     * Queries entities within a frustum (Rendering pass).
     * @param {THREE.Frustum} frustum 
     * @returns {number[]}
     */
    queryFrustum(frustum) {
        // Optimization: Invalidate cache only if entities moved or frustum plane hash changed
        const frustumHash = frustum.planes[0].constant ^ frustum.planes[1].constant; 
        if (!this._resultsDirty && frustumHash === this._lastFrustumHash) {
            return this._cachedResults;
        }

        this._cachedResults = [];
        for (const cell of this._cells.values()) {
            if (frustum.intersectsBox(cell.bounds)) {
                for (const id of cell.entities) {
                    this._cachedResults.push(id);
                }
            }
        }

        this._lastFrustumHash = frustumHash;
        this._resultsDirty = false;
        return this._cachedResults;
    }

    /**
     * Queries entities within a range (Streaming/Simulation pass).
     * @param {THREE.Vector3} center 
     * @param {number} range 
     * @returns {number[]}
     */
    queryRange(center, range) {
        const results = [];
        const cellRange = Math.ceil(range / this._gridSize);
        const gx = Math.floor(center.x / this._gridSize);
        const gy = Math.floor(center.y / this._gridSize);
        const gz = Math.floor(center.z / this._gridSize);

        for (let x = -cellRange; x <= cellRange; x++) {
            for (let y = -cellRange; y <= cellRange; y++) {
                for (let z = -cellRange; z <= cellRange; z++) {
                    const hash = this._hashCoords(gx + x, gy + y, gz + z);
                    const cell = this._cells.get(hash);
                    if (cell) {
                        for (const id of cell.entities) {
                            results.push(id);
                        }
                    }
                }
            }
        }
        return results;
    }

    /**
     * Maintenance: Flush empty cells.
     */
    update(delta, time) {
        // Run maintenance intermittently
        if (Math.floor(time) % 10 === 0 && this._lastFlush !== Math.floor(time)) {
            this._lastFlush = Math.floor(time);
            for (const [key, cell] of this._cells.entries()) {
                if (cell.entities.size === 0) this._cells.delete(key);
            }
        }
    }
}

