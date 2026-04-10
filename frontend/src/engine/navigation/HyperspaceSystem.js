import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

export class HyperspaceSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.active = false;
        this.tunnel = null;
    }

    init() {
        console.log('[Hyperspace] OMEGA Interstellar Drive Online.');
        this.events.on('fx:hyperspace_enter', (data) => this.enterHyperspace(data));
        this.events.on('fx:hyperspace_exit', () => this.exitHyperspace());
    }

    enterHyperspace(data) {
        this.active = true;
        console.log('[HyperJump] ENTERING HYPERSPACE TUNNEL.');
        
        const geo = new THREE.CylinderGeometry(5, 5, 400, 16, 1, true);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,  wireframe: false, transparent: true, opacity: 0.15, roughness: 1.0, metalness: 0.0
        });
        this.tunnel = new THREE.Mesh(geo, mat);
        
        const innerGeo = new THREE.CapsuleGeometry(2, 380, 4, 8);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 });
        const innerCapsule = new THREE.Mesh(innerGeo, innerMat);
        innerCapsule.rotateX(Math.PI / 2);
        this.tunnel.add(innerCapsule);
        
        const scene = this.Registry?.tryGet('SceneGraph')?.getScene?.();
        if (scene) scene.add(this.tunnel);

        setTimeout(() => {
            if (this.events && this.events.emit) this.events.emit('streaming:swap_system');
            
            const cameraSystem = this.Registry?.tryGet('CameraSystem');
            const cam = cameraSystem?.getCamera?.();
            if (cam) {
                const floatingOrigin = Registry.tryGet('FloatingOriginSystem');
                if (floatingOrigin && floatingOrigin._rebase) floatingOrigin._rebase(cam, cam.position);
            }
        }, 3000);
    }

    exitHyperspace() {
        this.active = false;
        if (this.tunnel && this.tunnel.parent) {
            this.tunnel.parent.remove(this.tunnel);
        }
        console.log('[HyperJump] EXITING HYPERSPACE.');
    }

    update(delta, time) {
        if (!this.active || !this.tunnel) return;

        const cam = Registry.tryGet('CameraSystem')?.getCamera?.();
        if (cam) {
            this.tunnel.position.copy(cam.position);
            this.tunnel.quaternion.copy(cam.quaternion);
            this.tunnel.rotateX(Math.PI / 2);
            this.tunnel.material.opacity = 0.2 + Math.sin(time * 10) * 0.1;
        }
    }
}
