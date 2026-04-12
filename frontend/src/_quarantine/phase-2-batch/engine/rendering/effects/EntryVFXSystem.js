import * as THREE from 'three';
import gsap from 'gsap';
// registry/events imported via injection

/**
 * EntryVFXSystem.js - V25 OMEGA
 * 
 * Handles the visual "Plasma Glow" and camera shake during high-speed entry.
 */
export class EntryVFXSystem {
    constructor() {
        this.glow = null;
        this.isActive = false;
    }

    init() {
        this.events.on('fx:entry_heat', (data) => this.updateGlow(data));
        
        // Simple sprite for plasma
        const mat = new THREE.SpriteMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this.glow = new THREE.Sprite(mat);
        this.glow.scale.set(50, 50, 1);
        
        const scene = this.Registry.get('SceneGraph')?.getScene();
        if (scene) scene.add(this.glow);
    }

    updateGlow(data) {
        if (data.heat > 0.2) {
            this.glow.material.opacity = Math.min(data.heat, 0.6);
            this.glow.material.color.setHSL(0.05 + data.heat * 0.1, 1.0, 0.5);
            
            // Shake camera based on heat
            const cam = this.Registry.get('CameraSystem')?.getCamera();
            if (cam && !this.isActive) {
                this.isActive = true;
                gsap.to(cam.position, {
                    x: "+=" + (Math.random() - 0.5) * data.heat * 5,
                    y: "+=" + (Math.random() - 0.5) * data.heat * 5,
                    duration: 0.05,
                    repeat: -1,
                    yoyo: true,
                    onUpdate: () => {
                        if (this.glow.material.opacity < 0.1) gsap.killTweensOf(cam.position);
                    }
                });
            }
        } else {
            this.glow.material.opacity = 0;
            this.isActive = false;
        }
    }

    update(delta, time) {
        const cam = this.Registry.get('CameraSystem')?.getCamera();
        if (cam && this.glow) {
            // Position glow in front of camera
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
            this.glow.position.copy(cam.position).addScaledVector(forward, 20);
        }
    }
}


