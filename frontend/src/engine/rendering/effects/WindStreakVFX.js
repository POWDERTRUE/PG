import * as THREE from 'three';
// registry/events imported via injection

/**
 * WindStreakVFX.js - V30 OMEGA
 * 
 * Visualizes air flow around the ship during high-speed atmospheric flight.
 */
export class WindStreakVFX {
    constructor() {
        this.group = new THREE.Group();
        this.streaks = [];
        this.maxStreaks = 40;
    }

    init() {
        const scene = this.Registry.get('SceneGraph')?.getScene();
        if (scene) scene.add(this.group);

        this.events.on('weather:turbulence', (data) => this.handleTurbulence(data));
        console.log('[WindStreakVFX] Aero-Visuals Online.');
    }

    handleTurbulence({ intensity, speed }) {
        const targetCount = Math.floor(intensity * this.maxStreaks);
        
        // Spawn more if under target
        if (this.streaks.length < targetCount && Math.random() > 0.5) {
            this.createStreak(speed);
        }
    }

    createStreak(speed) {
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        if (!camera) return;

        // Spawn in front of ship
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 100,
            -200 - Math.random() * 300
        ).applyQuaternion(camera.quaternion);

        const pos = camera.position.clone().add(offset);
        
        // Streak Geometry (Long thin line)
        const length = 50 + Math.random() * 100;
        const color = new THREE.Color(0xffffff).lerp(new THREE.Color(0x00ffcc), Math.random() * 0.5);
        
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, length)
        ]);
        const mat = new THREE.LineBasicMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.15 + Math.random() * 0.3 
        });
        
        const streak = new THREE.Line(geo, mat);
        streak.position.copy(pos);
        streak.lookAt(camera.position); // Align with flight path (approximation)
        
        this.group.add(streak);
        this.streaks.push({
            mesh: streak,
            speed: speed * 1.5,
            life: 1.0,
            decay: 0.05 + Math.random() * 0.1
        });
    }

    update(delta) {
        for (let i = this.streaks.length - 1; i >= 0; i--) {
            const s = this.streaks[i];
            
            // Move streaks backwards relative to ship
            const velocity = new THREE.Vector3(0, 0, s.speed * delta);
            s.mesh.position.add(velocity.applyQuaternion(s.mesh.quaternion));
            
            s.life -= s.decay;
            s.mesh.material.opacity = s.life * 0.4;

            if (s.life <= 0) {
                this.group.remove(s.mesh);
                s.mesh.geometry.dispose();
                s.mesh.material.dispose();
                this.streaks.splice(i, 1);
            }
        }
    }
}


