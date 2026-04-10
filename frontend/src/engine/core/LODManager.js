import { Registry } from './ServiceRegistry.js';

/**
 * LODManager.js - OMEGA V28
 * Centralized distance-based detail management.
 */
export class LODManager {
    /** @type {string} */
    static phase = 'streaming';

    constructor(services) {
        this.services = services;
        this._registry = new Map(); // id -> LODData
    }

    init() {
        console.log('[LODManager] Detail Orchestrator Online.');
    }

    /**
     * Register an entity for LOD management.
     * @param {number} entityId 
     * @param {Object} config { levels: [{dist, data}], onSwitch: callback }
     */
    register(entityId, config) {
        this._registry.set(entityId, {
            levels: config.levels.sort((a, b) => a.dist - b.dist),
            currentLevel: -1,
            onSwitch: config.onSwitch
        });
    }

    update(delta, time) {
        const camera = Registry.get('CameraSystem')?.getCamera();
        const spatial = Registry.get('SpatialIndexSystem');
        const entityManager = Registry.get('EntityManager');
        
        if (!camera || !spatial || !entityManager) return;

        const camPos = camera.position;
        
        // V14 Hierarchical Optimization: Use a larger radius for LOD evaluation
        // stars are checked at great distances, local objects closely.
        const activeIds = spatial.queryRange(camPos, 1000000); // 1,000,000 km radius
        
        for (const id of activeIds) {
            const data = this._registry.get(id);
            if (!data) continue;

            const transform = entityManager.getWorld().getComponent(id, 'TransformComponent');
            if (!transform) continue;

            const dist = camPos.distanceTo(transform.position);
            
            // Find appropriate LOD level
            let targetLevel = 0;
            for (let i = data.levels.length - 1; i >= 0; i--) {
                if (dist >= data.levels[i].dist) {
                    targetLevel = i;
                    break;
                }
            }

            if (targetLevel !== data.currentLevel) {
                const oldLevel = data.currentLevel;
                data.currentLevel = targetLevel;
                
                // Trigger callback with context
                data.onSwitch({
                    level: data.levels[targetLevel].data,
                    distance: dist,
                    previousLevel: oldLevel
                });
            }
        }
    }
}

