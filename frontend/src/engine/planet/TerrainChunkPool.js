// frontend/src/engine/planet/TerrainChunkPool.js
import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';

/**
 * TerrainChunkPool — OMEGA V31 Memory Manager
 * Zero-GC pre-allocation strategy for planetary surface QuadTrees.
 * Adheres strictly to OMEGA Rule #5: Avoid Runtime GC via FreeList and Mesh pooling.
 */
export class TerrainChunkPool {
    constructor() {
        this.poolSize = 600; // Parametrizable según VRAM limits
        this.freeList = [];
        this.activeChunks = new Map(); // chunkId -> chunk reference
        this.worker = new Worker(new URL('./workers/TerrainWorker.js', import.meta.url), { type: 'module' });
        
        // Configuración geométrica de cada parche por defecto 
        this.segments = 64; 
    }

    init() {
        // Fallback default material if a planet doesn't provide one
        this.fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });

        // PRE-ALOCAMIENTO DE CHUNKS
        // Capa 1 = TERRAIN_LAYER (exclusivo del QuadTree).
        // El RaycastSelectionSystem opera en layer 0 (defecto).
        // Three.js Raycaster solo testea objetos cuya capa intersecta con la de la cámara.
        // => Los chunks del pool NUNCA se raycastean, eliminando NaN de buffers vacios.
        const TERRAIN_LAYER = 1;

        for (let i = 0; i < this.poolSize; i++) {
            const geom = new THREE.PlaneGeometry(1, 1, this.segments, this.segments);
            const mesh = new THREE.Mesh(geom, this.fallbackMaterial);
            mesh.matrixAutoUpdate = false;
            mesh.visible = false;
            mesh.layers.set(TERRAIN_LAYER); // Invisible al Raycaster de la escena
            mesh.frustumCulled = true;      // El culling normal aplica cuando visible=true

            this.freeList.push({
                id: i,
                mesh: mesh,
                locked: false
            });
        }
        
        this.setupWorkerListeners();
        console.log(`[TerrainChunkPool] Pre-allocated ${this.poolSize} chunks. Zero-GC pool online.`);
    }

    setupWorkerListeners() {
        this.worker.onmessage = (e) => {
            const { chunkId, positions, normals } = e.data;
            
            const chunk = this.activeChunks.get(chunkId);
            if (!chunk) {
                // Si el chunk fue retornado antes de que el worker terminara (rápido paneo de cámara)
                // devolvemos los arrays al worker inmediatamente
                this.worker.postMessage({ recycledArray: positions }, [positions.buffer]);
                if (normals) this.worker.postMessage({ recycledArray: normals }, [normals.buffer]);
                return;
            }

            // OMEGA DIRECTIVE: Zero-GC Pointer Swap (No 'new BufferAttribute()')
            const attributes = chunk.mesh.geometry.attributes;
            attributes.position.array = positions;
            if (normals) {
                attributes.normal.array = normals;
                attributes.normal.needsUpdate = true;
            }

            // Flag memory uploaded to WebGL
            attributes.position.needsUpdate = true;
            
            // Activar visibilidad ahora que el grid ya tomó forma esférica (prevenir pop-in planar)
            chunk.mesh.visible = true;
        };

        this.worker.onerror = (err) => {
            console.error('[TerrainWorker Error]', err);
        };
    }

    /**
     * Reclama un chunk dormido. 
     * Encola el trabajo asíncrono para deformarlo.
     */
    requestChunk(params, sceneTarget, surfaceMaterial) {
        if (this.freeList.length === 0) {
            console.warn('[TerrainChunkPool] Pool exhausto! Increase poolSize o culling más agresivo.');
            return null;
        }

        // O(1) Adquisición
        const chunk = this.freeList.pop();
        chunk.locked = true;
        
        // Agregar al SceneGraph si no estaba
        if (chunk.mesh.parent !== sceneTarget) {
            sceneTarget.add(chunk.mesh);
        }

        // Asignación de material Zero-GC (solo intercambiamos referencia de puntero)
        if (surfaceMaterial) {
            chunk.mesh.material = surfaceMaterial;
        } else {
            chunk.mesh.material = this.fallbackMaterial;
        }

        this.activeChunks.set(chunk.id, chunk);

        // EXTRAER EL BUFFER DESDE THREE Y TRANSFERIRLO AL WORKER
        // Extrayendo con precaución asegurando no clonar
        const positions = chunk.mesh.geometry.attributes.position.array;
        const normals = chunk.mesh.geometry.attributes.normal.array;

        chunk.mesh.visible = false; // Mantener invisible hasta que el Worker responda contorsionado

        // Transferir la propiedad absoluta del ArrayBuffer al Worker.
        // El Hilo Principal SE QUEDA SIN REFERENCIA temporalmente (esto es crucial para evitar copies).
        this.worker.postMessage({
            chunkId: chunk.id,
            positions: positions,
            normals: normals,
            ...params
        }, [positions.buffer, normals.buffer]);

        return chunk;
    }

    /**
     * OMEGA DIRECTIVE #5: Dispose Pattern
     * Regresa la malla al Pool. Si su buffer físico estaba prestado al Worker
     * en ese preciso segundo de cámara, la ref seguirá pero el 'activeChunks'
     * soltará la ID causando que, al volver, recicle arrays pasivamente.
     */
    releaseChunk(chunk) {
        if (!chunk || !chunk.locked) return;
        
        // Ocultar inmediatamente y no computar bounding boxes
        chunk.mesh.visible = false;
        
        this.activeChunks.delete(chunk.id);
        
        // Libera lógicamente para uso contínuo
        chunk.locked = false;
        this.freeList.push(chunk);
    }

    dispose() {
        this.worker?.terminate?.();
        this.worker = null;
        const allChunks = [
            ...this.freeList,
            ...this.activeChunks.values(),
        ];
        for (const chunk of allChunks) {
            chunk.mesh?.parent?.remove(chunk.mesh);
            chunk.mesh?.geometry?.dispose?.();
            if (chunk.mesh?.material === this.fallbackMaterial) {
                chunk.mesh.material = null;
            }
        }
        this.fallbackMaterial?.dispose?.();
        this.freeList = [];
        this.activeChunks.clear();
        this.fallbackMaterial = null;
    }
}
