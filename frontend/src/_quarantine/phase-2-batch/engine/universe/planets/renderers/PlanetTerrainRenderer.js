import * as THREE from 'three';

/**
 * PlanetTerrainRenderer.js - L5 OMEGA
 * Renders high-resolution procedural terrain using GPU displacement.
 * Optimized for the "Close Exploration" phase.
 */
export class PlanetTerrainRenderer {
    create(radius, config) {
        // High-density sphere segment or sphere
        const geo = new THREE.SphereGeometry(radius, 128, 128);
        
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(config.primaryColor || 0x00f2ff) },
                uTime: { value: 0 },
                uRadius: { value: radius },
                uDetail: { value: 1.0 }
            },
            vertexShader: `
                uniform float uRadius;
                uniform float uDetail;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                // Simple Hash Noise for Displacement
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + .1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }

                void main() {
                    vNormal = normal;
                    vPosition = position;
                    
                    // Procedural Displacement (V31 OMEGA)
                    float noise = hash(position * 0.05) * 5.0 * uDetail;
                    vec3 newPos = position + normal * noise;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying vec3 vNormal;
                varying vec3 vPosition;

                void main() {
                    float lighting = dot(vNormal, normalize(vec3(1.0, 1.0, 1.0))) * 0.5 + 0.5;
                    vec3 finalColor = uColor * lighting;
                    
                    // Add some height-based tint
                    finalColor += vNormal.y * 0.1; 
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        const terrain = new THREE.Mesh(geo, mat);
        return terrain;
    }
}


