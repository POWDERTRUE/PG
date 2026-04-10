import { Registry } from '../core/ServiceRegistry.js';

/**
 * ShaderManager.js - V13 INDUSTRIAL
 * Handles shader code loading, caching, and global uniform injection.
 */
export class ShaderManager {
    constructor() {
        this.shaders = new Map();
        this.fileLoader = new (typeof window !== 'undefined' ? THREE.FileLoader : null)();
    }

    init() {
        console.log('[ShaderManager] Ready to handle custom GLSL pipelines.');
    }

    /**
     * Load an external shader file
     */
    async loadShader(url) {
        if (this.shaders.has(url)) return this.shaders.get(url);

        return new Promise((resolve, reject) => {
            this.fileLoader.load(url,
                (data) => {
                    this.shaders.set(url, data);
                    resolve(data);
                },
                undefined,
                (err) => reject(err)
            );
        });
    }

    getShader(id) {
        return this.shaders.get(id);
    }

    update(delta, time) {
        // Reserved for global uniform pulsing (uTime, uResolution, etc.)
    }
}

export const shaderManager = new ShaderManager();

