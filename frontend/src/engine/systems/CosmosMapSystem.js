import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { LinearCongruentialGenerator } from '../math/LCG.js';

/**
 * CosmosMapSystem (OMEGA V31)
 *
 * Tercera Escala Arquitectónica (COSMOS). 
 * Representa la Red Cósmica intergaláctica mediante un ShaderMaterial
 * donde el corrimiento al rojo (Redshift) colorea paramétricamente
 * las "galaxias" distantes (puntos).
 */
export class CosmosMapSystem {
    constructor() {
        this.phase = 'render'; // Ticked just before the renderer
        this.isActive = false;

        this.cosmosScene = new THREE.Scene();
        this.cosmosScene.fog = new THREE.FogExp2('#000002', 0.00005);
        
        this.cosmosCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 50, 200000);
        this.cosmosCamera.position.set(0, 1500, 10000);
        this.cosmosCamera.lookAt(0, 0, 0);

        this.cosmicWebContainer = new THREE.Group();
        this.cosmosScene.add(this.cosmicWebContainer);

        this._orbitAngleX = 0;
        this._orbitAngleY = 0;

        this._buildCosmicWeb();
        this._initSignalListeners();
    }

    _buildCosmicWeb() {
        const galaxyCount = 10000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(galaxyCount * 3);
        const colors = new Float32Array(galaxyCount * 3);
        const sizes = new Float32Array(galaxyCount);

        const lcg = new LinearCongruentialGenerator(9999);
        const maxDist = 50000;

        for (let i = 0; i < galaxyCount; i++) {
            // Distribución tridimensional de supercúmulos (Red Cósmica con ruido esférico)
            const r = Math.pow(lcg.nextFloat(), 1.5) * maxDist;
            const theta = lcg.nextFloat() * Math.PI * 2;
            const phi = Math.acos(2.0 * lcg.nextFloat() - 1.0);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.cos(phi);
            const z = r * Math.sin(phi) * Math.sin(theta);

            positions[i * 3 + 0] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // REDSHIFT: A mayor distancia, más rojo.
            const redshift = r / maxDist;
            const hue = MathUtils.lerp(0.65, 0.0, redshift); // Blue to Red
            const color = new THREE.Color().setHSL(hue, 0.9, 0.6);

            colors[i * 3 + 0] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Variación de tamaño aparente por distancia y masa intrínseca
            sizes[i] = lcg.nextRange(10.0, 50.0);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // Scaling inverso con límite para preservar visibilidad lejana
                    gl_PointSize = size * max((5000.0 / -mvPosition.z), 0.5);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    // Suave difuminación tipo elíptica/espiral distante
                    float alpha = pow(1.0 - (dist * 2.0), 1.5);
                    gl_FragColor = vec4(vColor, alpha * 0.9);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.cosmicWeb = new THREE.Points(geometry, material);
        this.cosmicWebContainer.add(this.cosmicWeb);
    }

    _initSignalListeners() {
        // ... Listen to signals if needed
    }

    setMapState(active) {
        if (this.isActive === active) return;
        this.isActive = active;

        const input = Registry.tryGet('InputStateSystem');
        const signals = Registry.tryGet('RuntimeSignals');

        if (this.isActive) {
            console.log('%c[CosmosMap] COSMOS Scene Activated.', 'color:#a78bfa; font-weight:bold');
            input?.currentContext && (this._previousContext = input.currentContext);
            input && (input.currentContext = 'COSMOS_MAP');
            signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'COSMOS' });
        } else {
            console.log('%c[CosmosMap] Exiting COSMOS.', 'color:#4c1d95; font-weight:bold');
            if (input && this._previousContext) {
                input.currentContext = this._previousContext;
            }
            signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'MACRO' });
        }
    }

    update(_delta) {
        if (!this.isActive) return;

        this.cosmicWebContainer.rotation.y += _delta * 0.005;
        this.cosmicWeb.material.uniforms.time.value += _delta;

        const input = Registry.tryGet('InputStateSystem');
        if (input && input.isGestureDragActive()) {
            const dx = input.getGestureDragDX();
            const dy = input.getGestureDragDY();

            this._orbitAngleY -= dx * 0.005;
            this._orbitAngleX -= dy * 0.005;
            this._orbitAngleX = MathUtils.clamp(this._orbitAngleX, -Math.PI/2 + 0.1, Math.PI/2 - 0.1);
        }

        const radius = 10000;
        this.cosmosCamera.position.x = radius * Math.cos(this._orbitAngleX) * Math.sin(this._orbitAngleY);
        this.cosmosCamera.position.y = radius * Math.sin(this._orbitAngleX);
        this.cosmosCamera.position.z = radius * Math.cos(this._orbitAngleX) * Math.cos(this._orbitAngleY);
        this.cosmosCamera.lookAt(0, 0, 0);
    }

    dispose() {
        this.isActive = false;

        if (this.cosmicWeb) {
            this.cosmicWebContainer?.remove(this.cosmicWeb);
            this.cosmicWeb.geometry?.dispose?.();
            this.cosmicWeb.material?.dispose?.();
            this.cosmicWeb = null;
        }

        if (this.cosmicWebContainer) {
            this.cosmosScene?.remove(this.cosmicWebContainer);
            this.cosmicWebContainer.clear?.();
            this.cosmicWebContainer = null;
        }

        this.cosmosScene?.clear?.();
        this.cosmosScene = null;
        this.cosmosCamera = null;
    }
}
