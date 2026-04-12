import * as THREE from 'three';
import { gsap } from 'gsap';

export class NotificationDroneSystem {
    constructor(sceneGraph, navigationSystem) {
        this.sceneGraph = sceneGraph;
        this.navigationSystem = navigationSystem;
        this.drones = [];
        this.cameraArrivalTimer = null;
        this.notificationFocusTimer = null;
        this._satPos = new THREE.Vector3();

        this.onSatelliteClicked = this.onSatelliteClicked.bind(this);
        this.onCameraArrived = this.onCameraArrived.bind(this);
        this.onDroneHoldComplete = this.onDroneHoldComplete.bind(this);
        this.onNotificationDismissed = this.onNotificationDismissed.bind(this);

        window.addEventListener('SATELLITE_CLICKED', this.onSatelliteClicked);
        window.addEventListener('CAMERA_ARRIVED_AT_SATELLITE', this.onCameraArrived);
        window.addEventListener('DRONE_HOLD_COMPLETE', this.onDroneHoldComplete);
        window.addEventListener('NOTIFICATION_DISMISSED', this.onNotificationDismissed);
    }

    onSatelliteClicked(event) {
        const { satellite, massObject } = event.detail;
        if (!satellite || !massObject) return;

        this.pendingDelivery = { satellite, massObject };
        clearTimeout(this.cameraArrivalTimer);
        this.cameraArrivalTimer = window.setTimeout(() => {
            this.onCameraArrived({ detail: { target: satellite, fallback: true } });
        }, 2000);
        this.navigationSystem.flyToTarget(satellite, 25, 'CAMERA_ARRIVED_AT_SATELLITE');
    }

    onCameraArrived(event) {
        clearTimeout(this.cameraArrivalTimer);
        this.cameraArrivalTimer = null;
        if (!this.pendingDelivery) return;
        const { satellite, massObject } = this.pendingDelivery;
        this.pendingDelivery = null;

        const droneGeo = new THREE.OctahedronGeometry(0.8, 0);
        const droneMat = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00aa88,
            emissiveIntensity: 2,
            transparent: true,
            opacity: 0
        });

        const drone = new THREE.Mesh(droneGeo, droneMat);
        const startPos = new THREE.Vector3();
        massObject.getWorldPosition(startPos);
        drone.position.copy(startPos);
        drone.name = `NotificationDrone_${satellite.userData?.appId || satellite.name || this.drones.length}`;

        drone.userData = {
            isDrone: true,
            isNotifier: true,
            spatialType: 'DRONE',
            state: 'flight',
            satellite,
            massObject,
            angle: Math.random() * Math.PI * 2,
            orbitRadius: 8,
            orbitSpeed: 1.5,
            message: this._buildMessage(satellite, massObject)
        };

        this.sceneGraph.layers.ui.add(drone);
        this.drones.push(drone);

        const targetPos = new THREE.Vector3();
        satellite.getWorldPosition(targetPos);
        targetPos.y += 5;

        gsap.to(drone.material, { opacity: 1, duration: 0.5 });
        gsap.to(drone.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 2.0,
            ease: 'power2.inOut',
            onComplete: () => {
                drone.userData.state = 'orbiting';
            }
        });
    }

    onDroneHoldComplete(event) {
        const { drone } = event.detail;
        if (!drone || drone.userData.state !== 'orbiting') return;

        drone.userData.state = 'focused';

        gsap.to(drone.material, { emissiveIntensity: 5, duration: 0.5 });
        gsap.to(drone.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.5, ease: 'back.out' });

        clearTimeout(this.notificationFocusTimer);
        this.notificationFocusTimer = window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('SHOW_LARGE_NOTIFICATION', { detail: { target: drone } }));
        }, 1800);
        this.navigationSystem.flyToTarget(drone, 10, 'SHOW_LARGE_NOTIFICATION');
    }

    onNotificationDismissed(event) {
        const { drone } = event.detail;
        if (!drone) return;

        clearTimeout(this.notificationFocusTimer);
        this.notificationFocusTimer = null;
        drone.userData.state = 'orbiting';
        gsap.to(drone.material, { emissiveIntensity: 2, duration: 0.5 });
        gsap.to(drone.scale, { x: 1, y: 1, z: 1, duration: 0.5 });

        if (drone.userData?.satellite) {
            this.navigationSystem.flyToTarget(drone.userData.satellite, 25, null);
        }
    }

    update(deltaTime) {
        if (this.drones.length === 0) return;

        const cameraPos = this.navigationSystem.camera.position;

        for (let i = this.drones.length - 1; i >= 0; i--) {
            const drone = this.drones[i];
            if (!drone || !drone.userData) {
                this.drones.splice(i, 1);
                continue;
            }
            if (drone.userData.state === 'orbiting') {
                drone.userData.angle += drone.userData.orbitSpeed * deltaTime;

                drone.userData.satellite.getWorldPosition(this._satPos);

                drone.position.x = this._satPos.x + Math.cos(drone.userData.angle) * drone.userData.orbitRadius;
                drone.position.z = this._satPos.z + Math.sin(drone.userData.angle) * drone.userData.orbitRadius;
                drone.position.y = this._satPos.y + Math.sin(drone.userData.angle * 2) * 2;

                drone.rotation.y += 2 * deltaTime;
                drone.rotation.x += 1 * deltaTime;

                const distance = cameraPos.distanceTo(drone.position);
                if (distance > 60) {
                    drone.material.emissiveIntensity = 0.5;
                } else {
                    drone.material.emissiveIntensity = 2.0;
                }
            }

            if (drone.userData.state === 'focused') {
                // mantener en foco de cámara
            }

        }
    }

    _buildMessage(satellite, massObject) {
        const parentName =
            massObject?.userData?.appName ||
            massObject?.userData?.label ||
            massObject?.name ||
            'la masa observada';
        const satelliteName =
            satellite?.userData?.label ||
            satellite?.userData?.appName ||
            satellite?.name ||
            'el satelite';

        return `TRANSMISION ESTABLE: ${satelliteName} reporta nuevos datos orbitales para ${parentName}.`;
    }

    dispose() {
        window.removeEventListener('SATELLITE_CLICKED', this.onSatelliteClicked);
        window.removeEventListener('CAMERA_ARRIVED_AT_SATELLITE', this.onCameraArrived);
        window.removeEventListener('DRONE_HOLD_COMPLETE', this.onDroneHoldComplete);
        window.removeEventListener('NOTIFICATION_DISMISSED', this.onNotificationDismissed);
        clearTimeout(this.cameraArrivalTimer);
        clearTimeout(this.notificationFocusTimer);

        for (const drone of this.drones) {
            drone.parent?.remove(drone);
            drone.geometry?.dispose?.();
            drone.material?.dispose?.();
        }
        this.drones = [];
    }
}
