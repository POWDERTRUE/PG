import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { LinearCongruentialGenerator } from '../math/LCG.js';

export class MacroWarpSystem {
    constructor() {
        this.phase = 'render';

        this.isWarping = false;
        this.isFlashingOut = false; // Segunda fase del Dropout

        this.warpSeed = 0;
        this.warpTargetPos = new THREE.Vector3();
        this.startPos = new THREE.Vector3();
        
        this.flashIntensity = 0;
        this.flashDecay = 1.0;

        this._initSignalListeners();
    }

    _initSignalListeners() {
        const tryBind = () => {
            const signals = Registry.tryGet('RuntimeSignals');
            if (!signals) return false;

            signals.on('PG:OS:MACRO_WARP_TARGET', (payload) => this.initiateMacroWarp(payload));
            signals.on('PG:OS:MACRO_DOUBLE_TAP',  (payload) => this.initiateMacroWarp({ targetId: payload.index, point: payload.point }));

            return true;
        };

        if (!tryBind()) {
            const t = setInterval(() => { if (tryBind()) clearInterval(t); }, 100);
        }
    }

    initiateMacroWarp(payload) {
        if (this.isWarping) return;
        
        const mapSystem = Registry.tryGet('OntologyMapSystem');
        if (!mapSystem || !mapSystem.isActive) return;

        this.isWarping = true;
        this.isFlashingOut = false;
        this.flashIntensity = 0;
        
        // Destino y estado inicial del picado (The Dive)
        this.warpSeed = payload.targetId ?? 0;
        if (payload.point) {
            this.warpTargetPos.copy(payload.point);
        }
        
        const camera = mapSystem.macroCamera;
        this.startPos.copy(camera.position);

        console.log('%c[MacroWarp] Spooling Macro-Jump to seed: ' + this.warpSeed, 'color:#ff00ea; font-weight:bold;');

        // Audio Ruge
        const audio = Registry.tryGet('AudioEngine');
        audio?._playWarpSpool?.();
    }

    _executeProceduralRebirth() {
        console.log('%c[MacroWarp] Executing Procedural Rebirth... (Zero-GC)', 'font-weight:bold; color:#00ffcc;');
        
        // 1. Ceguera Total (Flash) y Cambio de Escena
        const postProcess = this._getPostProcessPass();
        if (postProcess) {
            postProcess.forceMacroWarpSpooling(0);
            this.flashIntensity = 1.5; // Sobre-exposición intencional
            postProcess.forceMacroDropoutFlash(this.flashIntensity);
        }

        const signals = Registry.tryGet('RuntimeSignals');
        signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'MICRO' });

        const mapSystem = Registry.tryGet('OntologyMapSystem');
        if (mapSystem) mapSystem.setMapState(false); // Cleanup interno del context

        // 2. Object Pooling: Regeneración LCG
        const celestialRegistry = Registry.tryGet('CelestialRegistry') || Registry.tryGet('celestialRegistry');
        if (celestialRegistry) {
            const lcg = new LinearCongruentialGenerator(this.warpSeed);
            const nodes = celestialRegistry.getAllNodes ? celestialRegistry.getAllNodes() : [];
            
            // Decimos estocásticamente que el sistema tendrá entre 1 (Solo el sol) y 5 planetas
            const proceduralPlanetCount = Math.floor(lcg.nextRange(1, 6));

            nodes.forEach((node, index) => {
                if (index >= proceduralPlanetCount) {
                    node.visible = false;
                    if (node.userData) node.userData.isActive = false;
                    return;
                }
                
                node.visible = true;
                if (node.userData) node.userData.isActive = true;

                if (index === 0) {
                    // El Sol central se queda en 0,0,0
                    node.position.set(0, 0, 0);
                    const solScale = lcg.nextRange(50, 150);
                    node.scale.set(solScale, solScale, solScale);
                    if (node.userData) {
                        node.userData.deterministicKey = `SYS-${this.warpSeed}-SUN`;
                        node.userData.appName = `Procedural Sun ${this.warpSeed}`;
                    }
                } else {
                    // Planetas orbitando
                    const radius = lcg.nextRange(300, 1500 + index * 500);
                    const angle = lcg.nextFloat() * Math.PI * 2;
                    node.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                    
                    const pScale = lcg.nextRange(10, 45);
                    node.scale.set(pScale, pScale, pScale);
                    
                    if (node.userData) {
                        node.userData.deterministicKey = `SYS-${this.warpSeed}-P${index}`;
                        node.userData.appName = `PROCEDURAL_MASS_${index}`;
                    }
                }

                // Forzamos actualización de la matriz
                node.updateMatrixWorld(true);
            });
        }

        // 3. Reposicionar la nave
        const navSystem = Registry.tryGet('UniverseNavigationSystem');
        if (navSystem) {
            const camera = navSystem.camera;
            if (camera) {
                camera.position.set(0, 0, 1200);
                camera.lookAt(0, 0, 0);
                navSystem.focusDistance = 1200;
            }
        }

        // 4. Cambiamos estado de Warp a disipación de Flash
        this.isWarping = false;
        this.isFlashingOut = true;
        this.flashDecay = 1.0;
        
        const audio = Registry.tryGet('AudioEngine');
        audio?._playWarpDropout?.();
    }

    _getPostProcessPass() {
        const pipeline = Registry.tryGet('RenderPipeline') || window.Registry?.tryGet('RenderPipeline');
        if (!pipeline) return null;
        return pipeline.kernel?.frameGraph?.getPass?.('PostProcessPass') || pipeline.kernel?.frameGraph?.passes?.find(p => p.forceMacroDropoutFlash);
    }

    update(deltaTime) {
        if (!this.isWarping && !this.isFlashingOut) return;

        const postProcess = this._getPostProcessPass();

        if (this.isFlashingOut) {
            // Decaimiento exponencial del destello cegador
            this.flashDecay = Math.max(0, this.flashDecay - (deltaTime * 0.8));
            this.flashIntensity = Math.pow(this.flashDecay, 3) * 1.5;

            if (postProcess && postProcess.forceMacroDropoutFlash) {
                postProcess.forceMacroDropoutFlash(this.flashIntensity);
            }

            if (this.flashDecay <= 0.01) {
                this.isFlashingOut = false;
                if (postProcess && postProcess.forceMacroDropoutFlash) postProcess.forceMacroDropoutFlash(0);
                if (postProcess && postProcess.setVignette) postProcess.setVignette(0, 2.2); // Restaura Vignette
            }
            return;
        }

        if (this.isWarping) {
            const mapSystem = Registry.tryGet('OntologyMapSystem');
            if (!mapSystem) return;

            const camera = mapSystem.macroCamera;
            
            // Un lerp feroz hacia el punto target
            camera.position.lerp(this.warpTargetPos, deltaTime * 8.0);
            const distSq = camera.position.distanceToSquared(this.warpTargetPos);
            
            // Intensidad del spool [0..1]
            const totalDistSq = this.startPos.distanceToSquared(this.warpTargetPos);
            const intensity = 1.0 - (distSq / Math.max(1, totalDistSq));
            
            if (postProcess && postProcess.forceMacroWarpSpooling) {
                postProcess.forceMacroWarpSpooling(intensity);
            }

            // Umbral de ceguera térmica (cruce MACRO -> MICRO)
            if (distSq < 1500) {
                this._executeProceduralRebirth();
            }
        }
    }
}
