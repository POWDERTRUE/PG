/**
 * SpatialGestureSystem.js
 * OMEGA V28 Master Edition — Input & Interaction
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class SpatialGestureSystem {
    static phase = 'input';
    constructor(services) {
        this.services = services;
        this.touchStart = { x: 0, y: 0, time: 0 };
        this.isDown = false;
        this.threshold = 100;
        this._lastSpaceTime = 0;
    }

    init() {
        console.log('[SpatialGesture] OMEGA Gesture Recognition Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('mousedown', (e) => this.onStart(e.clientX, e.clientY));
        window.addEventListener('touchstart', (e) => this.onStart(e.touches[0].clientX, e.touches[0].clientY));

        window.addEventListener('mouseup', (e) => this.onEnd(e.clientX, e.clientY));
        window.addEventListener('touchend', (e) => this.onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
        
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                const now = Date.now();
                if (now - this._lastSpaceTime < 300) {
                    this.executeMacroZoom();
                }
                this._lastSpaceTime = now;
            }
        });
    }

    onStart(x, y) {
        const interaction = this.Registry.get('InteractionStrategy');
        if (interaction && interaction.isOverUI) return;

        this.touchStart = { x, y, time: Date.now() };
        this.isDown = true;
    }

    onEnd(x, y) {
        if (!this.isDown) return;
        this.isDown = false;

        const deltaX = x - this.touchStart.x;
        const deltaY = y - this.touchStart.y;
        const deltaTime = Date.now() - this.touchStart.time;

        if (deltaTime < 500) {
            if (Math.abs(deltaX) > this.threshold && Math.abs(deltaY) < this.threshold / 2) {
                if (deltaX > 0) this.triggerGesture('swipe_right');
                else this.triggerGesture('swipe_left');
            } else if (Math.abs(deltaY) > this.threshold && Math.abs(deltaX) < this.threshold / 2) {
                if (deltaY > 0) this.triggerGesture('swipe_down');
                else this.triggerGesture('swipe_up');
            }
        }
    }

    triggerGesture(type) {
        console.log(`[SpatialGestureSystem] Detected: ${type}`);
        this.events.emit('spatial:gesture', { type });

        switch (type) {
            case 'swipe_left': this.events.emit('window:cycle', { direction: 'next' }); break;
            case 'swipe_right': this.events.emit('window:cycle', { direction: 'prev' }); break;
            case 'swipe_down': this.executeMacroZoom(); break;
        }
    }

    executeMacroZoom() {
        const navSystem = this.Registry.get('NavigationSystem');
        if (navSystem) {
            navSystem.flyTo(new THREE.Vector3(0, 500, 4000), 2.5);
        }
    }
}

