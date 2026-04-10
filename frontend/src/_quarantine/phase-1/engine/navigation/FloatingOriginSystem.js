/**
 * ==========================================================
 * Powder Galaxy Engine - FloatingOriginSystem V33 (OMEGA)
 * ==========================================================
 * @file FloatingOriginSystem.js
 * @description Double-Precision Relativity Drive. 
 * Prevents Float32 jitter by re-centering the universe around the camera.
 */

import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class FloatingOriginSystem {
    /** @type {string} */
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.events = null;
        this.registry = null;
        
        /** @private */
        this._threshold = 5000; // km before rebasing
        /** @private */
        this._gridSize = 1000;  // Grid quantization (No Man's Sky style)
        
        // --- RELATIVITY DRIVE COORDINATES (Float64 Emulation) ---
        /** Absolute coordinates in the Galaxy (simulated high precision) */
        this.galaxyPosition = new THREE.Vector3(0, 0, 0); 
        /** The center of the current local 32-bit coordinate space */
        this.sectorOrigin = new THREE.Vector3(0, 0, 0);   
        
        /** @private Vector3 - Reusable for zero-allocation rebasing */
        this._shift = new THREE.Vector3();
        
        /** @type {THREE.Group|null} */
        this._worldGroup = null;
    }

    async init() {
        this.registry = Registry.get('registry') || (typeof window !== 'undefined' ? window.__OMEGA_REGISTRY__ : null);
        this.events = Registry.get('events') || (typeof window !== 'undefined' ? window.__OMEGA_EVENTS__ : null);

        console.log('[FloatingOrigin] Relativity Drive V33 Online.');
        const sceneGraph = this.Registry.get('SceneGraph');
        if (sceneGraph) {
            this._worldGroup = sceneGraph.getWorldGroup();
        }
    }

    /**
     * Execution phase: NAVIGATION
     */
    update(delta, time) {
        const cameraSystem = this.Registry.get('CameraSystem');
        const camera = cameraSystem?.getCamera();
        if (!camera) return;

        // 1. Sync Galaxy Position (High precision tracking)
        this.galaxyPosition.copy(this.sectorOrigin).add(camera.position);

        // 2. Threshold Check (Float32 Error Prevention)
        const distSq = camera.position.lengthSq();
        if (distSq > this._threshold * this._threshold) {
            this._rebase(camera, camera.position);
        }
    }

    /**
     * Re-centers the local 32-bit space to eliminate jitter.
     * @private
     */
    _rebase(camera, offset) {
        // QUANTIZATION: Move in stable grid chunks to prevent visual snapping
        this._shift.set(
            Math.floor(offset.x / this._gridSize) * this._gridSize,
            Math.floor(offset.y / this._gridSize) * this._gridSize,
            Math.floor(offset.z / this._gridSize) * this._gridSize
        );

        console.log(`%c[FloatingOrigin] REBASING UNIVERSE: Shift ${this._shift.x}, ${this._shift.y}, ${this._shift.z}`, 'color: #ffaa00; font-weight: bold;');

        // 1. Update Sector Anchor (Accumulate in Float64 space)
        this.sectorOrigin.add(this._shift);

        // 2. Shift World Group (Inverse movement)
        if (this._worldGroup) {
            this._worldGroup.position.sub(this._shift);
            this._worldGroup.updateMatrixWorld(true); // Immediate update
        }

        // 3. Shift Camera (Normalize to local zero)
        camera.position.sub(this._shift);

        // 4. Emit event for other systems
        this.events.emit('universe:rebase', {
            shift: this._shift,
            galaxyPosition: this.galaxyPosition,
            sectorOrigin: this.sectorOrigin
        });
    }

    /**
     * Returns a local 32-bit offset for a distant galaxy coordinate.
     * @param {THREE.Vector3} absPos 
     */
    getLocalOffset(absPos) {
        return new THREE.Vector3().subVectors(absPos, this.sectorOrigin);
    }
}


