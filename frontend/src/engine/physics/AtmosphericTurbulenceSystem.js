import * as THREE from 'three';
// registry/events imported via injection

/**
 * AtmosphericTurbulenceSystem.js - V30 OMEGA
 * 
 * Calculates procedural wind forces and camera buffeting based on
 * ship speed and air density. Makes atmospheric flight feel visceral.
 */
export class AtmosphericTurbulenceSystem {
    constructor() {
        this.baseTurbulence = 0.2;
        this.maxBufferIntensity = 0.8;
        this.noiseTime = 0;
    }

    update(delta, time) {
        const entrySystem = this.Registry.get('AtmosphericEntrySystem');
        const nav = this.Registry.get('NavigationSystem');
        const camera = this.Registry.get('CameraSystem')?.getCamera();

        if (!entrySystem || !nav || !camera) return;

        const density = entrySystem.airDensity;
        if (density <= 0.05) return; // Only in significant atmosphere

        const speed = nav.velocity.length();
        if (speed < 10) return;

        this.noiseTime += delta * 5.0;

        // 1. Calculate Buffeting Intensity
        // Scales with Speed and Density
        const speedFactor = Math.min(speed / 500, 1.5);
        const intensity = density * speedFactor * this.baseTurbulence;

        if (intensity > 0.05) {
            this.applyBuffeting(intensity, delta);
        }

        // 2. Generate Wind Force (Procedural)
        const windX = Math.sin(this.noiseTime * 0.7) * 20 * intensity;
        const windY = Math.cos(this.noiseTime * 1.1) * 20 * intensity;
        const windZ = Math.sin(this.noiseTime * 0.3) * 20 * intensity;
        
        const windForce = new THREE.Vector3(windX, windY, windZ);
        nav.applyForce(windForce);

        // 3. Emit Weather Data
        this.events.emit('weather:turbulence', { intensity, speed, density });
    }

    applyBuffeting(intensity, delta) {
        // High-frequency micro-shakes
        const shakeAmount = Math.min(intensity * this.maxBufferIntensity, this.maxBufferIntensity);
        
        this.events.emit('camera:shake', { 
            intensity: shakeAmount, 
            duration: delta * 1.5,
            isBuffeting: true // Flag to distinguish from impacts
        });
    }
}


