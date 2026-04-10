/**
 * WarpSystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { Registry } from '../core/ServiceRegistry.js';


export class WarpSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.active = false;
        this.warpStars = null;
    }

    init() {
        console.log('[WarpSystem] OMEGA Warp Drive Online.');
        this.events.on('fx:warp_start', () => this.startEffect());
        this.events.on('fx:warp_stop', () => this.stopEffect());
    }

    startEffect() {
        this.active = true;
        
        const cameraSystem = this.Registry.get('CameraSystem');
        const cam = cameraSystem?.getCamera();
        
        if (cam && window.gsap) {
            gsap.to(cam, { 
                fov: 90, 
                duration: 1.5, 
                ease: 'power2.inOut', 
                onUpdate: () => cam.updateProjectionMatrix() 
            });
        }
        
        this.events.emit('fx:warp_streaks', { thickness: 0.1, color: 0xffffff });
    }

    stopEffect() {
        this.active = false;
        
        const cameraSystem = this.Registry.get('CameraSystem');
        const cam = cameraSystem?.getCamera();
        
        if (cam && window.gsap) {
            gsap.to(cam, { 
                fov: 75, 
                duration: 2, 
                onUpdate: () => cam.updateProjectionMatrix() 
            });
        }
    }

    update(delta, time) {
        if (!this.active) return;
        // Animating warp particles
    }
}

