/**
 * CinematicCameraSystem.js
 * OMEGA V28+ Architecture - Navigation Layer
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { Registry } from '../core/ServiceRegistry.js';


export class CinematicCameraSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.camera = null;
        this.targetFocus = null;
        this.isCinematic = false;
    }

    async init() {
        this.camera = Registry.get('camera');
        const events = Registry.get('events');

        events.on('spatial:select', (obj) => this.focusOn(obj));
        events.on('navigation:reset', () => this.resetCamera());
        
        console.log("[CinematicCameraSystem] Online.");
    }

    focusOn(object) {
        if (!this.camera || !object) return;
        this.isCinematic = true;
        this.targetFocus = object;

        const targetPos = new THREE.Vector3();
        object.getWorldPosition(targetPos);

        // Calculate offset position for planet view
        const offset = new THREE.Vector3(0, 50, 200).applyQuaternion(this.camera.quaternion);
        const finalPos = targetPos.clone().add(offset);

        gsap.to(this.camera.position, {
            x: finalPos.x,
            y: finalPos.y,
            z: finalPos.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(targetPos);
            },
            onComplete: () => {
                this.isCinematic = false;
                console.log(`[CinematicCameraSystem] Focused on: ${object.name}`);
            }
        });
    }

    resetCamera() {
        this.isCinematic = true;
        this.targetFocus = null;

        gsap.to(this.camera.position, {
            x: 0,
            y: 500,
            z: 1000,
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(0, 0, 0);
            },
            onComplete: () => {
                this.isCinematic = false;
            }
        });
    }

    update() {
        if (!this.camera || !this.targetFocus || this.isCinematic) return;

        const targetPos = new THREE.Vector3();
        this.targetFocus.getWorldPosition(targetPos);
        this.camera.lookAt(targetPos);
        // Optional: Orbital drift logic here
    }
}

