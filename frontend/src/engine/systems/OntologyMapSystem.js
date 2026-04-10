import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { LinearCongruentialGenerator } from '../math/LCG.js';

/**
 * OntologyMapSystem (OMEGA V31)
 *
 * Implementa el Mapa Galáctico Macro usando Arquitectura Dual-Scene.
 * LEY 8 (Zero-GC): Búferes geométricos de instanciamiento extremo.
 *
 * Suspensión Visual (Culling Agresivo): Cuando el mapa es activo, el renderer descarta 
 * la scene micro por completo. Las posiciones newtonianas continúan fluyendo en CPU, 
 * pero sin coste de rasterización matricial de subnodos.
 */
export class OntologyMapSystem {
    constructor() {
        this.phase = 'render'; // Ticked last, just before the renderer call
        this.isActive = false;

        // Grafo Aislado
        this.macroScene = new THREE.Scene();
        this.macroScene.fog = new THREE.FogExp2('#000008', 0.00015);
        
        this.macroCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.macroCamera.position.set(0, 1500, 2500);
        this.macroCamera.lookAt(0, 0, 0);

        this.starCloudContainer = new THREE.Group();
        this.macroScene.add(this.starCloudContainer);

        this._orbitAngleX = 0;
        this._orbitAngleY = 0;
        this.focusDistance = 2500;

        this._buildGalacticCloud();
        this._initSignalListeners();
    }

    _buildGalacticCloud() {
        const starCount = 50000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this._generateSpiralMath(2415, positions, colors, sizes, starCount); // Semilla por defecto Alpha-2415

        // Shader Material para evitar texturas (pura matemática circular)
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
                    gl_PointSize = size * (800.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    // Falloff radial brillante
                    float alpha = (1.0 - (dist * 2.0));
                    gl_FragColor = vec4(vColor, alpha * 0.8);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.starCloud = new THREE.Points(geometry, material);
        this.starCloudContainer.add(this.starCloud);
    }

    _generateSpiralMath(seed, positions, colors, sizes, starCount) {
        const lcg = new LinearCongruentialGenerator(seed);
        
        // Logarithmic Spiral Parameters
        const arms = Math.floor(lcg.nextRange(2, 6)); 
        const a = 20.0; // Core offset
        const b = lcg.nextRange(0.12, 0.20); // Tightness
        const spread = lcg.nextRange(0.3, 0.8); // Arm width variance

        const colorCore = new THREE.Color().setHSL(lcg.nextFloat(), 0.8, 0.6);
        const colorEdge = new THREE.Color().setHSL(lcg.nextFloat(), 0.9, 0.5);

        for (let i = 0; i < starCount; i++) {
            // 20% Stars in the Bulge (Core), 80% in Arms
            const isCore = lcg.nextFloat() < 0.20; 
            let r, theta, y;

            if (isCore) {
                r = Math.pow(lcg.nextFloat(), 2) * 800; // Dense center
                theta = lcg.nextFloat() * Math.PI * 2;
                const bulgeHeight = 600 * Math.exp(-r / 200);
                y = (lcg.nextFloat() - 0.5) * bulgeHeight;
            } else {
                // Distribute uniformly along the arm length
                r = a * Math.exp(b * lcg.nextRange(10, 45)); 
                
                // Inverse log to find natural angle
                const naturalTheta = Math.log(r / a) / b;
                
                // Which arm does this star belong to?
                const armOffset = Math.floor(lcg.nextFloat() * arms) * ((Math.PI * 2) / arms);
                
                // Add noise (spread) heavily concentrated at trailing edges (density waves)
                const noise = (lcg.nextFloat() - 0.5) * spread * (r / 500); 
                theta = naturalTheta + armOffset + noise;
                
                // Flat disk profile for arms
                const diskHeight = 150 + (r * 0.05); 
                y = (lcg.nextFloat() - 0.5) * diskHeight;
            }

            positions[i * 3 + 0] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);

            // Perfil de color
            let c = new THREE.Color();
            if (r < 800) {
                c.lerpColors(colorCore, new THREE.Color(0xffffee), r / 800);
            } else {
                c.lerpColors(new THREE.Color(0x44aaff), colorEdge, (r - 800) / 4000);
            }

            colors[i * 3 + 0] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            if (sizes) {
                sizes[i] = lcg.nextRange(1.0, 3.5);
            }
        }
    }

    reforgeGalaxy(lcgSeed) {
        if (!this.starCloud) return;

        console.log('%c[OntologyMap] Reforging Galaxy Macro-state (Zero-GC)...', 'color:#00ffcc');

        const positions = this.starCloud.geometry.attributes.position.array;
        const colors = this.starCloud.geometry.attributes.color.array;
        const starCount = positions.length / 3;

        this._generateSpiralMath(lcgSeed, positions, colors, null, starCount);

        this.starCloud.geometry.attributes.position.needsUpdate = true;
        this.starCloud.geometry.attributes.color.needsUpdate = true;
        this.starCloud.geometry.computeBoundingSphere();
    }

    _initSignalListeners() {
        const signals = Registry.tryGet('RuntimeSignals');
        if (signals) {
            signals.on('PG:OS:TOGGLE_ONTOLOGY_MAP', (payload) => {
                if (payload.active === undefined) {
                    this.toggleMap();
                } else {
                    this.setMapState(payload.active);
                }
            });
        }
    }

    toggleMap() {
        this.setMapState(!this.isActive);
    }

    setMapState(active) {
        if (this.isActive === active) return;
        this.isActive = active;

        const audio = Registry.tryGet('AudioEngine');
        const signals = Registry.tryGet('RuntimeSignals');
        const input = Registry.tryGet('InputStateSystem');

        if (this.isActive) {
            console.log('%c[OntologyMap] MACRO Scene Activated.', 'color:#ff00ea; font-weight:bold');
            
            // Audio: Boom de expansión subgrave
            audio?._playAlgorithmicTone?.(60, 'sawtooth', 2.0, audio.channels.ui);
            
            // Pide al pipeline que empiece a rendear MACRO
            signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'MACRO' });

            // Inyectamos este contexto como activo para robar el gestureDrag
            input?.currentContext && (this._previousContext = input.currentContext);
            input && (input.currentContext = 'MACRO_MAP');
            
        } else {
            console.log('%c[OntologyMap] Returning to MICRO.', 'color:#00ffcc; font-weight:bold');
            
            // Audio: Colapso elástico
            audio?._playAlgorithmicTone?.(300, 'sine', 0.4, audio.channels.ui);
            
            // Devuelve al render MICRO
            signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'MICRO' });

            if (input && this._previousContext) {
                input.currentContext = this._previousContext;
            }
        }
    }

    /** 
     * El scheduler llama a update en la phase 'render'
     */
    update(_delta) {
        if (!this.isActive) return;

        // Slow cinematic rotation and shader time tick
        this.starCloudContainer.rotation.y += _delta * 0.05;
        this.starCloud.material.uniforms.time.value += _delta;

        // Gesture Drag - Reutilizando el input gestual unificado
        const input = Registry.tryGet('InputStateSystem');
        if (input && input.isGestureDragActive()) {
            const dx = input.getGestureDragDX();
            const dy = input.getGestureDragDY();

            this._orbitAngleY -= dx * 0.005;
            this._orbitAngleX -= dy * 0.005;
            this._orbitAngleX = MathUtils.clamp(this._orbitAngleX, -Math.PI/2 + 0.1, Math.PI/2 - 0.1);
        }

        // Apply orbital math to macro camera using dynamic focusDistance
        const radius = this.focusDistance;
        this.macroCamera.position.x = radius * Math.cos(this._orbitAngleX) * Math.sin(this._orbitAngleY);
        this.macroCamera.position.y = radius * Math.sin(this._orbitAngleX);
        this.macroCamera.position.z = radius * Math.cos(this._orbitAngleX) * Math.cos(this._orbitAngleY);
        this.macroCamera.lookAt(0, 0, 0);
    }
}
