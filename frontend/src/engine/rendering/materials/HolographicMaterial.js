import * as THREE from 'three';

export const HolographicShader = {
    uniforms: {
        "uColor": { value: new THREE.Color('#00ffcc') },
        "uOpacity": { value: 0.3 },
        "uFresnelPower": { value: 2.5 },
        "uTime": { value: 0.0 }, // Añadido para animar los scanlines
        "uModeMultiplier": { value: 0.0 } // 0.0 = normal, 1.0 = holográfico táctico
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uFresnelPower;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), uFresnelPower);
            
            // Efecto de escaneo (Scanline) animado y mapeado al fragmento
            float scanline = sin(gl_FragCoord.y * 3.0 - uTime * 15.0) * 0.1 + 0.9;
            
            gl_FragColor = vec4(uColor, (fresnel + 0.1) * uOpacity * scanline);
        }
    `
};

/**
 * Creador de Factory para usarlo como override en un entorno Zero-GC
 */
export function createHolographicMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(HolographicShader.uniforms),
        vertexShader: HolographicShader.vertexShader,
        fragmentShader: HolographicShader.fragmentShader,
        transparent: true,
        depthWrite: false, // Fundamental en UIs holográficas
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
}

export function disposeHolographicMaterial(material) {
    material?.dispose?.();
}
