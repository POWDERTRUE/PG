import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { LinearCongruentialGenerator } from '../math/LCG.js';

export class CosmosWarpSystem {
    constructor() {
        this.phase = 'render';

        this.WARP_STATES = {
            IDLE: 0,
            SPOOLING: 1, // Lerping towards the target galaxy point
            DROPOUT: 2   // Full Black. System flip happens here.
        };

        this._state = this.WARP_STATES.IDLE;
        
        this._spoolDuration = 1.2; // Quick cosmos dive
        this._dropoutDuration = 0.8; // Time staying black

        this._elapsedTime = 0.0;
        this._targetId = null;
        this._targetPos = new THREE.Vector3();
        this._startPos = new THREE.Vector3();

        this._initSignalListeners();
    }

    _initSignalListeners() {
        const signals = Registry.tryGet('RuntimeSignals');
        if (signals) {
            signals.on('PG:OS:COSMOS_WARP_TARGET', (payload) => {
                if (payload.targetId !== undefined && payload.targetPosition) {
                    this._initiateCosmosWarp(payload.targetId, payload.targetPosition);
                }
            });
        }
    }

    _initiateCosmosWarp(galaxyIndex, targetVecParam) {
        if (this._state !== this.WARP_STATES.IDLE) return;
        
        const cosmosSystem = Registry.tryGet('CosmosMapSystem');
        if (!cosmosSystem || !cosmosSystem.isActive) return;

        this._targetId = galaxyIndex;
        this._targetPos.copy(targetVecParam);
        this._startPos.copy(cosmosSystem.cosmosCamera.position);

        this._state = this.WARP_STATES.SPOOLING;
        this._elapsedTime = 0.0;

        console.log(`%c[CosmosWarp] Initiating Deep Cosmic Dive to Galaxy Seed: ${galaxyIndex}`, 'color:#a78bfa; font-weight:bold');

        this._playCosmosSpool();
    }

    _playCosmosSpool() {
        const audio = Registry.tryGet('AudioEngine');
        if (audio) {
            // Un grave muy profundo subiendo exponencialmente para generar vacío
            audio._playAlgorithmicTone?.(35, 'sine', 1.5, audio.channels.ui);
            setTimeout(() => {
                // Al chocar, un boom silenciador opresivo (Deep Impact)
                audio._playAlgorithmicTone?.(20, 'square', 2.0, audio.channels.ui);
            }, this._spoolDuration * 1000);
        }
    }

    _executeMultiverseFlip() {
        console.log(`%c[CosmosWarp] Multiverse Flip (DROPOUT). Rewriting MACRO Buffer Zero-GC...`, 'color:#ffffff; background:#000000; font-weight:bold');
        
        const cosmosSystem = Registry.tryGet('CosmosMapSystem');
        const mapSystem = Registry.tryGet('OntologyMapSystem');
        const signals = Registry.tryGet('RuntimeSignals');

        // Cerrar COSMOS
        if (cosmosSystem) cosmosSystem.setMapState(false);

        // Despertar MACRO
        if (mapSystem) {
            mapSystem.reforgeGalaxy(this._targetId);
            mapSystem.setMapState(true);
        }

        // Obligar al Engine a forzar MACRO
        signals?.emit?.('PG:RENDER:SWITCH_SCENE', { scene: 'MACRO' });
    }

    update(dt) {
        if (this._state === this.WARP_STATES.IDLE) return;

        this._elapsedTime += dt;
        const post = Registry.tryGet('PostProcessPass');
        const cosmosSystem = Registry.tryGet('CosmosMapSystem');

        if (this._state === this.WARP_STATES.SPOOLING) {
            const progress = Math.min(this._elapsedTime / this._spoolDuration, 1.0);
            
            // Acceleration curve: x^3 for sudden snap at the end
            const easeProgress = Math.pow(progress, 3);
            
            if (cosmosSystem) {
                cosmosSystem.cosmosCamera.position.lerpVectors(this._startPos, this._targetPos, easeProgress);
                // Also skew FOV to simulate relativistic stretch?
            }

            // Aumentar la aberración y empezar a robar el color (dropout) justo al final
            if (post?.forceCosmosDropout) {
                // Fade to black kicks in very fast during the last 20% of the spool
                let blackFade = 0.0;
                if (progress > 0.8) {
                    blackFade = (progress - 0.8) / 0.2;
                }
                post.forceCosmosDropout(blackFade);
            }

            if (progress >= 1.0) {
                this._state = this.WARP_STATES.DROPOUT;
                this._elapsedTime = 0.0;
                
                // Boom Negro
                if (post?.forceCosmosDropout) post.forceCosmosDropout(1.0);
                
                // Ejecutar Mutación Zero-GC del Buffer MACRO
                this._executeMultiverseFlip();
            }

        } else if (this._state === this.WARP_STATES.DROPOUT) {
            const progress = Math.min(this._elapsedTime / this._dropoutDuration, 1.0);
            
            if (post?.forceCosmosDropout) {
                // Fade-in smoothly from black
                const remainingBlack = 1.0 - Math.pow(progress, 2);
                post.forceCosmosDropout(remainingBlack);
            }

            if (progress >= 1.0) {
                if (post?.forceCosmosDropout) post.forceCosmosDropout(0.0);
                this._state = this.WARP_STATES.IDLE;
            }
        }
    }
}
