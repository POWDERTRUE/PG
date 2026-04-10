// frontend/src/engine/navigation/NavigationSystem.js
import * as THREE from 'three';
import { gsap } from 'gsap';

export class NavigationSystem {
    constructor(camera, scene) {
        this.camera    = camera;
        this.scene     = scene;
        this.isWarping = false;

        this.cameraRig = new THREE.Object3D();
        this.cameraRig.position.copy(camera.position);
        this.cameraRig.quaternion.copy(camera.quaternion);
        this.scene.add(this.cameraRig);
    }

    focusPlanet(target) {
        if (!target || !target.position || this.isWarping) return;
        this.isWarping = true;

        const targetPos  = target.position.clone();
        const offset     = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(50);
        const finalPos   = targetPos.clone().add(offset);

        // FOV warp — Bug 10
        gsap.to(this.camera, {
            fov:      100,
            duration: 0.8,
            ease:     'power2.in',
            onUpdate: () => this.camera.updateProjectionMatrix()
        });

        // Rig position
        gsap.to(this.cameraRig.position, {
            x: finalPos.x, y: finalPos.y, z: finalPos.z,
            duration:   2.5,
            ease:       'expo.inOut',
            onComplete: () => this.finalizeWarp(target.userData.appId)
        });

        // Rig quaternion SLERP
        const mtx = new THREE.Matrix4().lookAt(finalPos, targetPos, this.cameraRig.up);
        const tq  = new THREE.Quaternion().setFromRotationMatrix(mtx);
        if (this.cameraRig.quaternion.dot(tq) < 0) {
            tq.x *= -1; tq.y *= -1; tq.z *= -1; tq.w *= -1;
        }
        gsap.to(this.cameraRig.quaternion, {
            x: tq.x, y: tq.y, z: tq.z, w: tq.w,
            duration: 2.5,
            ease:     'expo.inOut'
        });
    }

    finalizeWarp(appId) {
        gsap.to(this.camera, {
            fov:        65,
            duration:   1.2,
            ease:       'elastic.out(1, 0.5)',
            onUpdate:   () => this.camera.updateProjectionMatrix(),
            onComplete: () => {
                this.isWarping = false;
                // Dispatch WARP_FLIGHT_COMPLETE after cinematic finishes
                window.dispatchEvent(new CustomEvent('WARP_FLIGHT_COMPLETE', {
                    detail: { appId }
                }));
            }
        });
    }

    update() {
        // NaN guard on rig
        const rp = this.cameraRig.position;
        if (isNaN(rp.x) || isNaN(rp.y) || isNaN(rp.z)) {
            this.cameraRig.position.set(0, 80, 400);
        }
        this.cameraRig.quaternion.normalize();
        this.camera.position.lerp(this.cameraRig.position,    0.08);
        this.camera.quaternion.slerp(this.cameraRig.quaternion, 0.08);
    }
}
