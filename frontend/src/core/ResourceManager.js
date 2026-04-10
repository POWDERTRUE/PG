import * as THREE from 'three';

/**
 * ResourceManager V31 — VRAM Ref-Counting Asset Manager
 *
 * Solves: In long sessions, textures / geometries / materials accumulate in GPU
 * memory with no release path, causing VRAM exhaustion and soft-hangs.
 *
 * Architecture:
 *   - Every asset has a ref-count. `acquire(key)` increments, `release(key)` decrements.
 *   - When refCount reaches 0, the asset's `.dispose()` is called → GPU memory freed.
 *   - `load(url, type)` async-loads and caches. Repeated calls return the cached asset.
 *   - LRU eviction: if cache exceeds `maxCacheSize`, the least-recently-used zero-ref
 *     asset is evicted first.
 *
 * Usage:
 *   const tex = await ResourceManager.load('planet_ice.jpg', 'texture');
 *   // ... use tex in your material ...
 *   ResourceManager.release('planet_ice.jpg'); // frees VRAM when no longer needed
 */
export class ResourceManager {
    /**
     * @param {object} [opts]
     * @param {number} [opts.maxCacheSize=128] Max assets in cache before LRU eviction kicks in
     */
    constructor(opts = {}) {
        this._maxCacheSize = opts.maxCacheSize ?? 128;

        /** @type {Map<string, { asset: any, refCount: number, lastUsed: number, type: string }>} */
        this._cache = new Map();

        /** @type {Map<string, Promise<any>>} In-flight load promises (deduplicated) */
        this._pending = new Map();

        this._loaders = {
            texture:  new THREE.TextureLoader(),
        };

        // Legacy compat: keep .geometries/.materials/.textures maps pointing into cache
        this.geometries = { get: (k) => this._cache.get(k)?.asset };
        this.materials  = { get: (k) => this._cache.get(k)?.asset };
        this.textures   = { get: (k) => this._cache.get(k)?.asset };

        console.log('%c[ResourceManager] V31 VRAM Ref-Counting online.', 'color:#a78bfa;font-weight:bold');
    }

    // ── Async Asset Loading ──────────────────────────────────────────────────

    /**
     * Load an asset by URL. Returns cached version if available.
     * Deduplicates in-flight requests.
     * @param {string} url
     * @param {'texture'|'geometry'|'material'} type
     * @returns {Promise<any>}
     */
    async load(url, type = 'texture') {
        if (this._cache.has(url)) {
            const entry = this._cache.get(url);
            entry.refCount++;
            entry.lastUsed = Date.now();
            return entry.asset;
        }

        // Deduplicate concurrent requests for the same URL
        if (this._pending.has(url)) {
            const asset = await this._pending.get(url);
            this.acquire(url); // increment refCount once load resolves
            return asset;
        }

        const promise = this._loadAsset(url, type);
        this._pending.set(url, promise);

        try {
            const asset = await promise;
            this._pending.delete(url);
            this._register(url, asset, type);
            this._evictLRU();
            return asset;
        } catch (err) {
            this._pending.delete(url);
            console.error(`[ResourceManager] Failed to load ${type} at: ${url}`, err);
            throw err;
        }
    }

    _loadAsset(url, type) {
        switch (type) {
            case 'texture':
                return this._loaders.texture.loadAsync(url);
            default:
                return Promise.reject(new Error(`[ResourceManager] Unknown type: ${type}`));
        }
    }

    // ── Synchronous Asset Registration (geometries, materials) ──────────────

    /**
     * Register a manually-created asset (geometry, material).
     * @param {string} key
     * @param {any}    asset   — must have a `.dispose()` method
     * @param {string} [type]
     */
    register(key, asset, type = 'geometry') {
        if (this._cache.has(key)) {
            this.release(key); // release old one
        }
        this._register(key, asset, type);
    }

    _register(key, asset, type) {
        this._cache.set(key, { asset, refCount: 1, lastUsed: Date.now(), type });
    }

    // ── Legacy Sync API (backward compatible) ───────────────────────────────

    getGeometry(key, factory) {
        if (!this._cache.has(key)) this._register(key, factory(), 'geometry');
        const e = this._cache.get(key);
        e.refCount++;
        e.lastUsed = Date.now();
        return e.asset;
    }

    getMaterial(key, factory) {
        if (!this._cache.has(key)) this._register(key, factory(), 'material');
        const e = this._cache.get(key);
        e.refCount++;
        e.lastUsed = Date.now();
        return e.asset;
    }

    getTexture(key, factory) {
        if (!this._cache.has(key)) this._register(key, factory(), 'texture');
        const e = this._cache.get(key);
        e.refCount++;
        e.lastUsed = Date.now();
        return e.asset;
    }

    // ── Ref Counting ─────────────────────────────────────────────────────────

    /**
     * Increment ref count for an already-loaded asset.
     * @param {string} key
     */
    acquire(key) {
        const entry = this._cache.get(key);
        if (entry) { entry.refCount++; entry.lastUsed = Date.now(); }
    }

    /**
     * Decrement ref count. When count reaches 0, the asset is `.dispose()`d
     * and freed from GPU memory automatically.
     * @param {string} key
     */
    release(key) {
        const entry = this._cache.get(key);
        if (!entry) return;

        entry.refCount = Math.max(0, entry.refCount - 1);

        if (entry.refCount === 0) {
            this._disposeEntry(key, entry);
        }
    }

    // ── LRU Eviction ─────────────────────────────────────────────────────────

    _evictLRU() {
        if (this._cache.size <= this._maxCacheSize) return;

        // Collect zero-ref entries, sort by lastUsed ascending
        const evictable = [...this._cache.entries()]
            .filter(([, e]) => e.refCount === 0)
            .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

        // Evict oldest zero-ref until within limit
        while (this._cache.size > this._maxCacheSize && evictable.length > 0) {
            const [key, entry] = evictable.shift();
            this._disposeEntry(key, entry);
        }

        if (this._cache.size > this._maxCacheSize) {
            console.warn('[ResourceManager] Cache over limit but all assets have active refs. Consider releasing unused assets.');
        }
    }

    _disposeEntry(key, entry) {
        try {
            if (entry.asset && typeof entry.asset.dispose === 'function') {
                entry.asset.dispose();
            }
        } catch (err) {
            console.error(`[ResourceManager] Error disposing ${key}:`, err);
        }
        this._cache.delete(key);
    }

    // ── Material / Geometry Factories (legacy compat) ────────────────────────

    createLiquidSilicon(color) {
        return new THREE.MeshPhysicalMaterial({
            color: color || 0x00f0ff,
            metalness: 0.9,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 20,
            envMapIntensity: 2,
            clearcoat: 1,
            emissive: color || 0x00f0ff,
            emissiveIntensity: 0.5
        });
    }

    createAtmosphere(color) {
        return new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
    }

    // ── Stats (for EngineDebugPanel) ─────────────────────────────────────────

    /**
     * Returns a stats snapshot for live display in the debug panel.
     * @returns {{ total: number, byType: Object, zeroRef: number }}
     */
    getStats() {
        const byType = {};
        let zeroRef  = 0;

        for (const [, e] of this._cache) {
            byType[e.type] = (byType[e.type] || 0) + 1;
            if (e.refCount === 0) zeroRef++;
        }

        return { total: this._cache.size, byType, zeroRef, maxSize: this._maxCacheSize };
    }

    // ── Full dispose (engine shutdown) ───────────────────────────────────────

    dispose() {
        for (const [key, entry] of this._cache) {
            this._disposeEntry(key, entry);
        }
        this._cache.clear();
        this._pending.clear();
        console.log('[ResourceManager] All GPU assets disposed.');
    }
}

export const resourceManager = new ResourceManager();
