/**
 * FlightPhysicsSystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class FlightPhysicsSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.liftCoefficient = 0.5;
        this.stabilityStrength = 0.05;
        this.horizonDamping = 0.95;
    }

    init() {
        console.log('[FlightPhysics] OMEGA Aerodynamic Engine Online.');
    }

    update(delta, time) {
        const entrySystem = this.Registry.get('AtmosphericEntrySystem');
        const frameSystem = this.Registry.get('RelativeFrameSystem');
        const nav = this.Registry.get('NavigationSystem');
        const camera = this.Registry.get('CameraSystem')?.getCamera();

        if (!entrySystem || !frameSystem || !nav || !camera) return;

        // 1. Get Density from Entry System
        const density = entrySystem.airDensity;
        if (density <= 0.01) return;

        // 2. Resolve Local Frame (Ship/Camera View)
        const frame = frameSystem.getLocalFrame(camera);
        const velocity = nav.velocity;
        const speed = velocity.length();

        if (speed < 0.1) return;

        // 3. Calculate Lift (Aerodynamic Lift)
        // Lift is perpendicular to velocity, generally "upwards" relative to wings
        const velocityDir = velocity.clone().normalize();
        const pitchAlignment = Math.max(velocityDir.dot(frame.forward), 0);
        const liftMagnitude = speed * speed * density * this.liftCoefficient * pitchAlignment;
        
        const liftForce = frame.up.clone().multiplyScalar(liftMagnitude);
        nav.applyForce(liftForce);

        // 4. Horizon Stability (Planet-Relative)
        const planet = entrySystem.activePlanet;
        if (planet && speed > 5) {
            this.stabilizeToHorizon(camera, planet, frame, nav, delta);
        }
    }

    stabilizeToHorizon(camera, planet, frame, nav, delta) {
        const frameSystem = this.Registry.get('RelativeFrameSystem');
        
        // Find "Up" relative to planet's surface (Relative Frame)
        const horizonUp = frameSystem.getHorizonUp(camera, planet);
        
        // Alignment: 1 = perfectly level
        const alignment = frame.up.dot(horizonUp);
        
        if (alignment < 0.999) {
            // Find rotation axis (cross product of local up and target up)
            const correctionAxis = new THREE.Vector3().crossVectors(frame.up, horizonUp).normalize();
            
            // Apply leveling through NavigationSystem (Decoupled)
            const strength = this.stabilityStrength * (1.0 - alignment);
            nav.applyHorizonLeveling(correctionAxis, strength, delta);
        }
    }
}

