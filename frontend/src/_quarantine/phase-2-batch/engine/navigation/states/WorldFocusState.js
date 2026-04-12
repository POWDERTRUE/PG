import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';

export class WorldFocusState {
    constructor() {
        this.fsm = null;
        this.nav = null;
        this.targetObject = null;
        
        this.distance = 100;
        this.minDistance = 10;
        this.maxDistance = 5000;

        this.yaw = 0;
        this.pitch = 0;
        
        this.pointerDown = false;
        this.lastX = 0;
        this.lastY = 0;

        this.events = Registry.get('events');
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.pointerPresentation = Registry.tryGet('PointerPresentationController') || Registry.tryGet('pointerPresentation');
    }

    enter(data) {
        console.log('[WorldFocusState] Orbiting target.');
        this.targetObject = data.targetObject;
        if (data.orbitDistance) this.distance = data.orbitDistance;

        // Calcular yaw y pitch actual respecto al vector "lookAt" para transición suave
        const euler = new THREE.Euler().setFromQuaternion(this.nav.cameraRig.quaternion, 'YXZ');
        this.yaw = euler.y;
        this.pitch = euler.x;

        window.addEventListener('pointerup', this.onPointerUp);
        // Passive false is needed to allow preventDefault on wheel (zoom) if desired, 
        // but UI scrolling can be affected. Using standard passive for now.
        window.addEventListener('wheel', this.onWheel, { passive: true });
        
        if (this.events) {
            this.events.on('INPUT_POINTER_DOWN', this.onPointerDown);
            this.events.on('INPUT_POINTER_MOVE', this.onPointerMove);
        }
    }

    exit() {
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('wheel', this.onWheel);
        
        if (this.events) {
            this.events.removeListener('INPUT_POINTER_DOWN', this.onPointerDown);
            this.events.removeListener('INPUT_POINTER_MOVE', this.onPointerMove);
        }
        
        this.pointerDown = false;
        this.targetObject = null;
    }

    getSnapshot() {
        return {
            mode: 'WORLD_FOCUS',
            targetObject: this.targetObject,
            orbitDistance: this.distance
        };
    }

    onPointerDown(data) {
        if (data.button === 2) {
            this.pointerDown = true;
            this.lastX = data.x;
            this.lastY = data.y;
            this._getPointerPresentationController()?.upsertIntent?.('nav-world-focus', {
                kind: 'drag',
                cursor: 'grabbing',
                priority: 500,
                reticleMode: 'hidden',
            });
        }
    }

    onPointerUp() {
        this.pointerDown = false;
        this._getPointerPresentationController()?.clearIntent?.('nav-world-focus');
    }

    onPointerMove(data) {
        if (!this.pointerDown) return;
        const deltaX = data.x - this.lastX;
        const deltaY = data.y - this.lastY;
        this.lastX = data.x;
        this.lastY = data.y;

        const sensitivity = 0.005;
        this.yaw -= deltaX * sensitivity;
        this.pitch -= deltaY * sensitivity;
        
        const limit = Math.PI / 2 - 0.1;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    }

    onWheel(e) {
        // Zoom
        const zoomSpeed = this.distance * 0.1;
        this.distance += Math.sign(e.deltaY) * zoomSpeed;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    }

    update(delta) {
        if (!this.targetObject) return;

        const targetPos = new THREE.Vector3();
        this.targetObject.getWorldPosition(targetPos);

        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
        const targetQ = qYaw.multiply(qPitch);

        // Rig orientation
        this.nav.cameraRig.quaternion.slerp(targetQ, Math.min(delta * 12, 1));

        // Vector de desplazamiento backwards
        const offset = new THREE.Vector3(0, 0, 1).applyQuaternion(this.nav.cameraRig.quaternion).multiplyScalar(this.distance);
        
        // Rig position
        const desiredPos = targetPos.clone().add(offset);
        this.nav.cameraRig.position.lerp(desiredPos, Math.min(delta * 10, 1));
    }

    _getPointerPresentationController() {
        this.pointerPresentation =
            this.pointerPresentation ||
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        return this.pointerPresentation;
    }
}
