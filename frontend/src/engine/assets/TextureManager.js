import { Registry } from '../core/ServiceRegistry.js';

/**
 * TextureManager.js - V13 INDUSTRIAL
 * High-performance texture loading and VRAM caching.
 */
export class TextureManager {
    constructor() {
        this.textures = new Map();
        this.loader = new (typeof window !== 'undefined' ? THREE.TextureLoader : null)();
    }

    init() {
        console.log('[TextureManager] Asset caching pipeline active.');
    }

    /**
     * Load or retrieve a cached texture
     */
    async load(url) {
        if (this.textures.has(url)) return this.textures.get(url);
        
        return new Promise((resolve, reject) => {
            this.loader.load(url, 
                (tex) => {
                    this.textures.set(url, tex);
                    resolve(tex);
                },
                undefined,
                (err) => reject(err)
            );
        });
    }

    get(id) {
        return this.textures.get(id);
    }

    update(delta, time) {}
}

export const textureManager = new TextureManager();

