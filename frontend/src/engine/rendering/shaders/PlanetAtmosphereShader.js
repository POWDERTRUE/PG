import * as THREE from 'three';

/**
 * PlanetAtmosphereShader.js - V33 OMEGA FUSION + NINTENDO EDGE
 * 
 * Implements the "Visual Bridge" and "Geometry Edge Shader" for 
 * premium minimalist aesthetics (Nintendo-style).
 */
export const PlanetAtmosphereShader = {
    uniforms: {
        uColor: { value: new THREE.Color(0x00f2ff) },
        uOutlineColor: { value: new THREE.Color(0xffffff) },
        uCoefficient: { value: 0.1 },
        uPower: { value: 4.0 },
        uSunPosition: { value: new THREE.Vector3(1, 1, 1) },
        uDistance: { value: 0.0 },
        uTransitionPoint: { value: 50000.0 }
    },
    vertexShader: `
        uniform float uDistance;
        uniform float uTransitionPoint;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldNormal;

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            
            float scale = uDistance > uTransitionPoint ? (uDistance / uTransitionPoint) * 0.15 : 1.0;
            
            vec4 mvPosition = modelViewMatrix * vec4(position * scale, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uOutlineColor;
        uniform float uCoefficient;
        uniform float uPower;
        uniform vec3 uSunPosition;
        uniform float uDistance;
        uniform float uTransitionPoint;
        
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldNormal;

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            
            // --- V33 NINTENDO EDGE (Geometry Edge Shader) ---
            // Fresnel rim for the crisp minimalist outline
            float fresnel = dot(vNormal, viewDir);
            float outline = smoothstep(0.4, 0.5, 1.0 - fresnel);
            
            // Standard Atmospheric Scattering
            float atmosphereIntensity = pow(uCoefficient - fresnel, uPower);
            
            // Lighting
            float sunDot = dot(vNormal, normalize(uSunPosition));
            float lighting = max(sunDot, 0.2);
            
            // Distance-based logic
            float transitionMix = smoothstep(uTransitionPoint * 2.0, uTransitionPoint, uDistance);
            
            vec3 atmosColor = uColor * lighting;
            vec3 finalColor = mix(atmosColor, uOutlineColor, outline * 0.5);
            
            // Point Phase (Star effect)
            if (uDistance > uTransitionPoint) {
                finalColor += vec3(0.8, 0.9, 1.0) * (transitionMix * 0.5);
            }
            
            gl_FragColor = vec4(finalColor, max(atmosphereIntensity * transitionMix, outline * 0.3));
        }
    `
};


