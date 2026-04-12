/**
 * SelectionService.js
 * OMEGA V31 — Orchestrator for Hardware-Accelerated Picking
 */

import { Registry } from '../core/ServiceRegistry.js';
import { RaycastAdapterBVH } from './adapters/RaycastAdapterBVH.js';
import { GPUPickingAdapter } from './adapters/GPUPickingAdapter.js';
import { GPUPickingAdapterPBO } from './adapters/GPUPickingAdapterPBO.js';

const DEFAULTS = {
    gpuTimeoutMs: 12,
    enablePBO: true, // Feature flag para desactivar si surge necesidad
    maxRetries: 1
};

export class SelectionService {
    constructor({ renderer, camera, scene, config = {} } = {}) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;
        this.config = Object.assign({}, DEFAULTS, config);

        this.events = Registry.get('events') || { emit: () => {} };
        this.telemetry = Registry.get('telemetry'); // Opcional recolector persistente

        // WebGL2 Feature Detection 
        const gl = this.renderer ? this.renderer.getContext() : null;
        const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

        if (this.config.enablePBO && isWebGL2) {
            console.log('[SelectionService] WebGL2 detectado. Inicializando Arquitectura PBO Async.');
            this.gpuAdapter = new GPUPickingAdapterPBO({ renderer, scene, camera });
        } else {
            console.warn('[SelectionService] Fallback a WebGL1 o PBO desactivado.');
            this.gpuAdapter = new GPUPickingAdapter({ renderer, scene, camera });
        }

        this.bvhAdapter = new RaycastAdapterBVH({ scene, camera });

        // Zero-GC cache layer
        this._idToObject = new Map();
        this._resultCache = { id: null, distance: 0, hitPoint: null };
    }

    registerObject(id, objectRef) {
        this._idToObject.set(id, objectRef);
    }

    unregisterObject(id) {
        this._idToObject.delete(id);
    }

    /**
     * Motor de bucle a inyectar en el Mainloop del Juego.
     */
    tick() {
        if (this.gpuAdapter && typeof this.gpuAdapter.pollPending === 'function') {
            this.gpuAdapter.pollPending();
        }
    }

    async queryAtScreen(x, y) {
        try {
            const start = performance.now();
            const gpuPromise = this.gpuAdapter.readIdAt(x, y);
            
            // Carreras contra el Thread Asíncrono WebGL
            const race = await Promise.race([
                gpuPromise,
                new Promise(resolve => setTimeout(() => resolve(null), this.config.gpuTimeoutMs))
            ]);
            
            const gpuTime = performance.now() - start;

            this.events.emit('picking:readPixelsMs', { ms: gpuTime });
            if (this.telemetry && typeof this.telemetry.push === 'function') {
                this.telemetry.push('picking.readPixelsMs', { ms: gpuTime, ts: Date.now() });
            }

            if (race && race.id != null) {
                const obj = this._idToObject.get(race.id);
                if (obj) {
                    this._resultCache.id = race.id;
                    this._resultCache.distance = race.distance || 0;
                    this._resultCache.hitPoint = race.hitPoint || null;
                    
                    this.events.emit('picking:hit', { method: 'gpu', id: race.id, latency: gpuTime });
                    return this._resultCache;
                }
            }
        } catch (err) {
            this.events.emit('picking:gpuError', { error: String(err) });
        }

        // --- FALLBACK (CPU RAYCAST) ---
        try {
            const t0 = performance.now();
            const cpuHit = this.bvhAdapter.raycastFromScreen(x, y);
            const cpuTime = performance.now() - t0;
            
            this.events.emit('picking:cpuMs', { ms: cpuTime });
            this.events.emit('picking:fallbackCount', { x, y });

            if (cpuHit && cpuHit.id != null) {
                const obj = this._idToObject.get(cpuHit.id);
                if (obj) {
                    this._resultCache.id = cpuHit.id;
                    this._resultCache.distance = cpuHit.distance;
                    this._resultCache.hitPoint = cpuHit.hitPoint;
                    
                    this.events.emit('picking:hit', { method: 'cpu', id: cpuHit.id, latency: cpuTime });
                    return this._resultCache;
                }
            }
        } catch (err) {
            this.events.emit('picking:cpuError', { error: String(err) });
        }

        this.events.emit('picking:miss', { x, y });
        return null;
    }

    selectById(id) {
        const obj = this._idToObject.get(id);
        if (!obj) return false;
        
        this.events.emit('SelectionService:selectById', { id, target: obj, ts: Date.now() });
        return true;
    }
}

export default SelectionService;
