import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * LODSystem.js - V15 INDUSTRIAL DETAIL
 * 
 * Orchestrates distance-based detail levels globally.
 */
export class LODSystem {
    constructor() {
        this.objects = new Map(); // mesh -> { levels, lastLevel }
        this.dependencies = ['CameraSystem'];
        this.distances = {
            HIGH: 500,    // < 500km
            MEDIUM: 2000,  // < 2000km
            LOW: 10000     // > 10000km
        };
    }

    init() {
        console.log('[LODSystem] Industrial LOD Orchestrator Ready.');
    }

    /**
     * Register an object for LOD management
     * levels: [{ distance, geometry, material }]
     */
    register(object, levels) {
        this.objects.set(object, {
            levels: levels.sort((a, b) => a.distance - b.distance),
            lastLevel: -1
        });
    }

    /**
     * Phase: Update
     * Manual update to support shader LOD and material swaps
     */
    update(delta, time) {
        const camera = Registry.get('CameraSystem')?.getCamera();
        if (!camera) return;

        const camPos = camera.position;

        this.objects.forEach((data, obj) => {
            const dist = camPos.distanceTo(obj.position);
            
            // Find appropriate level
            let activeLevel = 0;
            for (let i = data.levels.length - 1; i >= 0; i--) {
                if (dist >= data.levels[i].distance) {
                    activeLevel = i;
                    break;
                }
            }

            if (activeLevel !== data.lastLevel) {
                this.switchLevel(obj, data.levels[activeLevel]);
                data.lastLevel = activeLevel;
            }
        });
    }

    switchLevel(obj, level) {
        // Swap geometry and material if they exist (Manual LOD)
        if (level.geometry) obj.geometry = level.geometry;
        if (level.material) obj.material = level.material;
        
        // Custom events for logic LOD (e.g., stopping physics for distant moons)
        if (obj.userData) obj.userData.lodLevel = level.distance;
    }
}

export const lodSystem = new LODSystem();


