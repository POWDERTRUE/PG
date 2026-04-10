/**
 * CameraController.js
 * OMEGA V28 Master Edition — Interaction Layer
 * Features: Cinematic GSAP interpolation and target-based framing.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { Registry } from '../core/ServiceRegistry.js';


export class CameraController {
    constructor(services) {
        this.services = services;
        this.cameraSystem = null;
        this.isMoving = false;
    }

    init() {
        this.registry = Registry.get('registry');
        this.cameraSystem = this.Registry.get('CameraSystem');
        console.log('[CameraController] Cinematic Controller Online.');
    }

    /**
     * Cinematic framing move to a target object.
     */
    moveToTarget(target, duration = 2.0) {
        if (!target) return;
        
        const camera = this.cameraSystem.getCamera();
        const universeNav = this.Registry.get('UniverseNavigationSystem');
        const rig = universeNav?.cameraRig || camera;

        const targetPos = new THREE.Vector3();
        try {
            target.getWorldPosition(targetPos);
        } catch (e) {
            targetPos.set(0,0,0);
        }

        this.isMoving = true;
        const offset = new THREE.Vector3(0, 50, 150);
        const finalPos = targetPos.clone().add(offset);

        gsap.to(rig.position, {
            x: finalPos.x,
            y: finalPos.y,
            z: finalPos.z,
            duration: duration,
            ease: "power2.inOut",
            onUpdate: () => {
                rig.lookAt(targetPos);
            },
            onComplete: () => {
                this.isMoving = false;
            }
        });
    }
    
    update(delta, time) {
        // Idle bobbing or other cinematic effects could go here
    }
}
