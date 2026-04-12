import * as THREE from 'three';
import gsap from 'gsap';
// registry/events imported via injection

/**
 * PlanetDiscoveryVFX.js - V28 OMEGA
 * 
 * Creates a holographic pulse effect when a planet is discovered.
 */
export class PlanetDiscoveryVFX {
    constructor() {
        this.group = new THREE.Group();
    }

    init() {
        const scene = this.Registry.get('SceneGraph')?.getScene();
        if (scene) scene.add(this.group);

        this.events.on('planet:discovered', (data) => this.pulse(data));
        console.log('[PlanetDiscoveryVFX] Signal Processor Online.');
    }

    pulse(data) {
        // Find planet position
        const planetLOD = this.Registry.get('PlanetLODSystem');
        const planetData = planetLOD.activePlanets.get(data.id);
        if (!planetData) return;

        const pos = planetData.mesh.position;
        const radius = 120;

        // Create Expanding Ring
        const ringGeo = new THREE.RingGeometry(radius * 0.8, radius, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(this.Registry.get('CameraSystem').getCamera().position);
        this.group.add(ring);

        // Animate
        gsap.to(ring.scale, {
            x: 2.5, y: 2.5, z: 2.5,
            duration: 1.5,
            ease: "expo.out"
        });
        
        gsap.to(ringMat, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.in",
            onComplete: () => {
                this.group.remove(ring);
                ringGeo.dispose();
                ringMat.dispose();
            }
        });

        // Trigger Camera Shake for "Impact"
        this.events.emit('camera:shake', { intensity: 0.5, duration: 0.8 });
    }
}


