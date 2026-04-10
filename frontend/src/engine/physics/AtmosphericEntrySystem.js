/**
 * AtmosphericEntrySystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class AtmosphericEntrySystem {
    static phase = 'navigation';
    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.activePlanet = null;
        this.density = 0;
        this.heat = 0;
        this.dragCoefficient = 0.05;
    }

    get airDensity() { return this.density; }

    init() {
        console.log('[AtmosphericEntry] OMEGA Aerobraking Engine Online.');
    }

    update(delta, time) {
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        const nav = this.Registry.get('NavigationSystem');
        if (!camera || !nav) return;

        // Find nearest planet with atmosphere
        const planet = this.findNearestPlanet(camera.position);
        if (planet) {
            this.processEntry(planet, camera, nav, delta);
        } else {
            this.heat = THREE.MathUtils.lerp(this.heat, 0, 0.1);
        }
    }

    findNearestPlanet(pos) {
        const celestialRegistry = Registry.get('CelestialRegistry');
        if (!celestialRegistry) return null;

        const celestials = celestialRegistry.getByType('PLANET');
        let nearest = null;
        let minDist = 5000; // Atmosphere detection range

        celestials.forEach(planet => {
            const d = pos.distanceTo(planet.position);
            if (d < minDist) {
                minDist = d;
                nearest = planet;
            }
        });

        this.activePlanet = nearest;
        return nearest;
    }

    processEntry(planet, camera, nav, delta) {
        const dist = camera.position.distanceTo(planet.position);
        const radius = planet.radius || 100;
        const atmThickness = 1000;

        if (dist < radius + atmThickness) {
            // Density increases exponentially as we descend
            const altitude = dist - radius;
            this.density = Math.pow(1.0 - (altitude / atmThickness), 2);
            
            // Drag: force = 0.5 * rho * v^2 * Cd
            const speed = nav.velocity.length();
            const dragForce = 0.5 * this.density * speed * speed * this.dragCoefficient;
            
            const dragVector = nav.velocity.clone().normalize().multiplyScalar(-dragForce * delta);
            nav.velocity.add(dragVector);

            // Heat: function of speed and density
            this.heat = this.density * (speed * 0.01);
            
            if (this.heat > 0.1) {
                this.events.emit('fx:entry_heat', { heat: this.heat, density: this.density });
            }
        } else {
            this.density = 0;
            this.heat = 0;
        }
    }
}

