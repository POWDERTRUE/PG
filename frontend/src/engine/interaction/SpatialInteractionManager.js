/**
 * SpatialInteractionManager.js
 * OMEGA V28+ Architecture - Interaction Layer
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class SpatialInteractionManager {
    static phase = 'input';

    constructor(services) {
        this.services = services;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.intersected = null;
        this.activeFocus = null;
    }

    async init() {
        const events = Registry.get('events');
        
        window.addEventListener('mousemove', (e) => this._onMouseMove(e));
        window.addEventListener('mousedown', (e) => this._onMouseDown(e));
        
        console.log("[SpatialInteractionManager] Operational.");
    }

    _onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    _onMouseDown(event) {
        if (this.intersected) {
            const events = Registry.get('events');
            events.emit('spatial:select', this.intersected);
            
            // Logic for focusing or launching app
            const appId = this.intersected.userData?.appId;
            if (appId) {
                events.emit('app:launch', { id: appId, target: this.intersected });
            }
        }
    }

    update() {
        const camera = Registry.get('camera');
        const scene = Registry.get('scene');
        if (!camera || !scene) return;

        this.raycaster.setFromCamera(this.mouse, camera);

        // Optimization: Only check the celestial layer
        const celestialLayer = Registry.get('registry')?.get('SceneGraph')?.getCelestialLayer();
        const targets = celestialLayer ? celestialLayer.children : scene.children;
        
        const intersects = this.raycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (this.intersected !== object) {
                if (this.intersected) this._onOut(this.intersected);
                this.intersected = object;
                this._onHover(this.intersected);
            }
        } else {
            if (this.intersected) this._onOut(this.intersected);
            this.intersected = null;
        }
    }

    _onHover(obj) {
        Registry.get('events')?.emit('spatial:hover', obj);
        // Optional: Visual feedback
        if (obj.material && obj.material.emissive) {
            obj.userData.oldEmissive = obj.material.emissive.getHex();
            obj.material.emissive.set(0x00f2ff);
        }
    }

    _onOut(obj) {
        Registry.get('events')?.emit('spatial:out', obj);
        if (obj.material && obj.material.emissive && obj.userData.oldEmissive !== undefined) {
            obj.material.emissive.setHex(obj.userData.oldEmissive);
        }
    }
}

