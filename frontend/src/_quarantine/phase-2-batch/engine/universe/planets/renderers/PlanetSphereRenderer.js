import * as THREE from 'three';
import { PlanetAtmosphereShader } from '../../../rendering/shaders/PlanetAtmosphereShader.js';

/**
 * PlanetSphereRenderer.js - L3 OMEGA FUSION
 * Renders a mid-range atmospheric sphere that can scale down to a point.
 */
export class PlanetSphereRenderer {
    create(radius, config) {
        const geo = new THREE.SphereGeometry(radius, 32, 32);
        
        // Use the unified OMEGA FUSION shader
        const mat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(PlanetAtmosphereShader.uniforms),
            vertexShader: PlanetAtmosphereShader.vertexShader,
            fragmentShader: PlanetAtmosphereShader.fragmentShader,
            transparent: true
        });

        // Initialize uniforms from config
        mat.uniforms.uColor.value.set(config.primaryColor || 0x00aaff);
        mat.uniforms.uRadius.value = radius;

        const mesh = new THREE.Mesh(geo, mat);
        return mesh;
    }
}


