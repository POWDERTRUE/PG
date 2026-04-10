import * as THREE from 'three';
import { Registry } from '../engine/core/ServiceRegistry.js';

export class WebsocketBridgeSystem {
    constructor(navigationSystem) {
        this.events = Registry.get('events');
        this.socket = Registry.get('socket');
        this.navigationSystem = navigationSystem;
        this.timeSinceLastSync = 0;
        this._lastSyncPosition = new THREE.Vector3();
        this._lastSyncTime = Date.now();
        this._outgoingVelocity = new THREE.Vector3();
        
        // Single source listening for planetary interactions to dispatch to V8
        this.sendPlanet = this.sendPlanet.bind(this);
        if (this.events) {
            this.events.on('PLANET_SELECTED', this.sendPlanet);
        }
    }

    dispose() {
        if (this.events) {
            this.events.removeListener?.('PLANET_SELECTED', this.sendPlanet);
        }
    }

    sendPlanet({ object }) {
        if (!object || !object.userData) return;
        
        // El UniversoOS usa "appId" predominantemente
        const targetId = object.userData.appId || object.userData.id;
        
        if (this.socket && targetId) {
            this.socket.send({
                type: 'PLANET_CLICKED',
                payload: { planetId: targetId }
            });
            console.log(`[WebsocketBridge] Sent PLANET_CLICKED payload for: ${targetId}`);
        }
    }

    update(delta) {
        if (!this.navigationSystem || !this.navigationSystem.cameraRig || !this.socket) return;
        
        this.timeSinceLastSync += delta;
        if (this.timeSinceLastSync >= 1 / 30) {
            this.timeSinceLastSync = 0;

            const now = Date.now();
            const currentPosition = this.navigationSystem.cameraRig.position;
            const deltaMs = Math.max(now - this._lastSyncTime, 1);

            this._outgoingVelocity.copy(currentPosition)
                .sub(this._lastSyncPosition)
                .divideScalar(deltaMs * 0.001);

            this.socket.send({
                type: 'NETWORK_TRANSFORM_UPDATE',
                payload: {
                    position: currentPosition.toArray(),
                    quaternion: this.navigationSystem.cameraRig.quaternion.toArray(),
                    velocity: this._outgoingVelocity.toArray(),
                    timestamp: now
                }
            });

            this._lastSyncPosition.copy(currentPosition);
            this._lastSyncTime = now;
        }
    }
}
