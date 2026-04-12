import * as THREE from 'three';
import { StarLODSystem } from './stars/StarLODSystem.js';
import { StarParticleSystem } from './stars/StarParticleSystem.js';
import { StarSpriteSystem } from './stars/StarSpriteSystem.js';
import { StarMeshSystem } from './stars/StarMeshSystem.js';

/**
 * GalaxyRenderer - Root Rendering Hub (OMEGA V28)
 */
export class GalaxyRenderer {
    /** @type {string} */
    static phase = 'render';

    constructor(services) {
        this.services = services;
        this.lodSystem = new StarLODSystem(services);
        this.particleSystem = new StarParticleSystem();
        this.spriteSystem = new StarSpriteSystem();
        this.meshSystem = new StarMeshSystem();
    }

    init() {
        this.lodSystem.registry = this.registry;
        
        const sceneGraph = this.Registry.get('SceneGraph');
        const generator = this.Registry.get('GalaxyGenerator');
        
        if (!sceneGraph || !generator) return;

        console.log('[GalaxyRenderer] Igniting 1,000,000 Stars (OMEGA V14)...');

        const galaxyData = generator.generateData(1000000);
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(galaxyData.positions, 3));
        geometry.setAttribute('aBrightness', new THREE.BufferAttribute(galaxyData.brightness, 1));
        geometry.setAttribute('color', new THREE.BufferAttribute(galaxyData.colors, 3));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uCameraOrigin: { value: new THREE.Vector3() },
                uTime: { value: 0 }
            },
            vertexShader: `
                uniform vec3 uCameraOrigin;
                uniform float uTime;
                attribute float aBrightness;
                attribute vec3 color;
                varying float vBrightness;
                varying vec3 vColor;

                void main() {
                    vBrightness = aBrightness;
                    vColor = color;
                    vec3 pos = position - uCameraOrigin;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    float size = 2.0 + aBrightness * 3.0;
                    gl_PointSize = clamp(size * (300.0 / -mvPosition.z), 1.0, 5.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vBrightness;
                varying vec3 vColor;
                uniform float uTime;

                void main() {
                    float dist = distance(gl_PointCoord, vec2(0.5));
                    if (dist > 0.5) discard;
                    float twinkle = sin(uTime * 2.0 + vBrightness * 100.0);
                    float intensity = 0.7 + 0.3 * twinkle;
                    gl_FragColor = vec4(vColor, vBrightness * intensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.starPoints = new THREE.Points(geometry, this.material);

        this.starPoints.name = 'Starfield';
        this.starPoints.renderOrder = -100;
        
        sceneGraph.getScene().add(this.starPoints);
    }

    update(delta, time) {
        if (!this.material) return;
        this.material.uniforms.uTime.value = time;

        const originSystem = this.Registry.tryGet('FloatingOriginSystem');
        if (originSystem) {
            this.material.uniforms.uCameraOrigin.value.copy(originSystem.sectorOrigin);
        }

        const camera = this.Registry.get('CameraSystem')?.getCamera();
        if (camera) {
            this.lodSystem.update(camera);
        }
    }
}
