/**
 * @file GalaxyStreamingSystem.js
 * @description Sector-based streaming for stars, planets, asteroids, and stations.
 */
export class GalaxyStreamingSystem {
    constructor() {
        this.currentSector = null;
        this.activeSectors = new Map();
        this.loadRadius = 2; // Sectors around player
        
        // Multi-tier streaming levels (AU)
        this.levels = {
            GALAXY: 1000000, 
            STAR: 100,       
            SOLAR: 1,         
            LOCAL: 0.0001    
        };
    }

    init() {
        console.log('[GalaxyStreamingSystem] V2 Architecture Online. Sector loading initialized.');
    }

    /**
     * Phase: Simulation
     * Decide which sectors to load/unload based on camera position
     */
    simulation(delta, time) {
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        const spatial = this.Registry.get('SpatialIndexSystem');
        
        if (!camera || !spatial) return;

        const pos = camera.position;
        const s = spatial.getSector(pos.x, pos.y, pos.z);

        if (!this.currentSector || this.currentSector.id !== s.id) {
            this.handleSectorChange(s, spatial);
        }
    }

    handleSectorChange(newSector, spatial) {
        console.log(`[GalaxyStreaming] Sector Transition: ${newSector.id}`);
        this.currentSector = newSector;
        
        // Unload distant sectors
        this.activeSectors.forEach((data, id) => {
            if (!this.isNear(id, newSector.id)) {
                this.unloadSector(id);
            }
        });

        // Load nearby sectors
        this._loadNearbySectors(newSector, spatial);
        
        this.events.emit('streaming:sector_ready', { id: newSector.id });
    }

    _loadNearbySectors(centerSector, spatial) {
        // Implementation for loading stars, planets, etc. in range
        // This triggers GalaxyGenerator or PlanetLODSystem per sector
    }

    isNear(id1, id2) {
        const [x1, y1, z1] = id1.split(',').map(Number);
        const [x2, y2, z2] = id2.split(',').map(Number);
        return Math.abs(x1 - x2) <= this.loadRadius &&
               Math.abs(y1 - y2) <= this.loadRadius &&
               Math.abs(z1 - z2) <= this.loadRadius;
    }

    unloadSector(id) {
        console.log(`[GalaxyStreaming] Purging Sector: ${id}`);
        this.activeSectors.delete(id);
        this.events.emit('streaming:sector_purged', { id });
    }

    onRebase(offset) {
        // Floating Origin sync
    }
}

