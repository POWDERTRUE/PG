import * as THREE from 'three';
import { PlanetAtmosphereShader } from '../../../rendering/shaders/PlanetAtmosphereShader.js';
import { CloudSystem } from '../CloudSystem.js';

/**
 * PlanetDetailRenderer.js - L4 OMEGA
 * High-fidelity planet with atmospheric scattering and clouds.
 */
export class PlanetDetailRenderer {
    constructor() {
        this.cloudSystem = new CloudSystem();
    }

    create(radius, config) {
        const group = new THREE.Group();

        // 1. Surface
        const surfaceGeo = new THREE.SphereGeometry(radius, 64, 64);
        const surfaceMat = new THREE.MeshStandardMaterial({
            color: config.color || 0x00f2ff,
            roughness: config.roughness || 0.7,
            metalness: 0.1
        });
        const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
        group.add(surface);

        // 2. Clouds
        if (config.hasClouds) {
            const clouds = this.cloudSystem.create(radius, 0xffffff);
            group.add(clouds);
        }

        // 3. Atmosphere Scattering
        const atmosphereGeo = new THREE.SphereGeometry(radius * 1.05, 64, 64);
        const atmosphereMat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(PlanetAtmosphereShader.uniforms),
            vertexShader: PlanetAtmosphereShader.vertexShader,
            fragmentShader: PlanetAtmosphereShader.fragmentShader,
            side: THREE.BackSide,
            transparent: true
        });
        
        if (atmosphereMat.uniforms.uColor) {
            atmosphereMat.uniforms.uColor.value.set(config.color || 0x00f2ff);
        }
        
        const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
        group.add(atmosphere);

        return group;
    }
}


