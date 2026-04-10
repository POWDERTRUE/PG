import { Registry } from '../core/ServiceRegistry.js';

/**
 * MaterialRegistry.js - V13 INDUSTRIAL
 * Unified material pooling to avoid redundant GPU allocations.
 */
export class MaterialRegistry {
    constructor() {
        this.materials = new Map();
    }

    init() {
        console.log('[MaterialRegistry] Material pooling system active.');
    }

    /**
     * Get or create a shared material
     */
    getMaterial(id, type, params) {
        const key = `${id}_${type}_${JSON.stringify(params)}`;
        if (this.materials.has(key)) return this.materials.get(key);
        
        const mat = new THREE[type](params);
        this.materials.set(key, mat);
        return mat;
    }

    update(delta, time) {
        // Pulse global uniforms (uTime) across all pooling materials
        this.materials.forEach(mat => {
            if (mat.uniforms && mat.uniforms.uTime) {
                mat.uniforms.uTime.value = time;
            }
        });
    }
}

export const materialRegistry = new MaterialRegistry();

