/**
 * SpatialTelemetrySystem.js
 * OMEGA V28 Master Edition — Sensory & HUD
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class SpatialTelemetrySystem {
    static phase = 'sensory';
    constructor(services) {
        this.services = services;
        this._lastPos = null;
        this._currentSpeed = 0;
        this._lastProximityUpdate = 0;
    }

    init() {
        this.registry = Registry.get('registry');
        console.log('[SpatialTelemetry] OMEGA Data Stream Online.');
        this.events = Registry.get('events');
        
        this.events.on('frame:end', (data) => this.update(data.delta, data.time));
    }

    update(delta, time) {
        if (!this.registry) return;
        const cameraSystem = this.Registry.get('CameraSystem');
        if (!cameraSystem) return;

        const camera = cameraSystem.getCamera();
        const pos = camera.position;

        const telemetryData = {
            position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
            speed: 0,
            nearestBody: null,
            load: '0.1%'
        };

        if (this._lastPos) {
            const dist = pos.distanceTo(this._lastPos);
            this._currentSpeed = dist / delta;
            telemetryData.speed = (this._currentSpeed / 100).toFixed(2);
        }
        this._lastPos = pos.clone();

        if (time - this._lastProximityUpdate > 0.5) {
            this._lastProximityUpdate = time;
            const celRegistry = this.Registry.get('CelestialRegistry');
            if (celRegistry && celRegistry.bodies) {
                let nearest = null;
                let minDist = Infinity;
                
                const tempPos = new THREE.Vector3();
                celRegistry.bodies.forEach(body => {
                    body.getWorldPosition(tempPos);
                    const d = pos.distanceTo(tempPos);
                    if (d < minDist) {
                        minDist = d;
                        nearest = body;
                    }
                });

                if (nearest) {
                    telemetryData.nearestBody = {
                        name: nearest.name || 'ANOMALY',
                        distance: Math.round(minDist)
                    };
                }
            }
        }

        this.events.emit('telemetry:update', telemetryData);
    }
}

