import {
    Points,
    BufferGeometry,
    Float32BufferAttribute,
    PointsMaterial
} from 'three';
import { PostProcessPass } from './passes/PostProcessPass.js';

/**
 * RenderPipeline
 *
 * Canonical path:
 *   FrameScheduler -> FrameGraph -> PostProcessPass
 *
 * We keep post-processing local to the engine to avoid runtime CDN/CORS
 * failures during boot.
 */
class RenderPipeline {
    constructor(kernel) {
        this.kernel = kernel;
        this.scheduler = kernel.scheduler;
        this.systems = [];

        this._debugStar = null;
        this._stats = null;
        this._postLogged = false;
        
        this.currentSceneMode = 'MICRO';
        this._initSignalListeners();

        this._initStats();
        this._bindF3();
    }

    addSystem(system) {
        if (this.scheduler) {
            this.scheduler.register(system, system.renderPhase || 'simulation');
            return;
        }

        if (system && typeof system.update === 'function') {
            this.systems.push(system);
        }
    }

    _initSignalListeners() {
        const signals = this.kernel?.runtimeSignals || window.Registry?.tryGet('RuntimeSignals');
        if (signals) {
            signals.on('PG:RENDER:SWITCH_SCENE', (payload) => {
                if (payload.scene && (payload.scene === 'MICRO' || payload.scene === 'MACRO' || payload.scene === 'COSMOS')) {
                    this.currentSceneMode = payload.scene;
                }
            });
        }
    }

    async _initStats() {
        try {
            const StatsModule = await import('stats.js');
            const Stats = StatsModule.default ?? StatsModule;
            const stats = new Stats();

            stats.showPanel(0);
            stats.dom.style.cssText = `
                position: fixed; top: 0; left: 0; z-index: 99999;
                opacity: 0.75; display: none;
            `;

            document.body.appendChild(stats.dom);
            this._stats = stats;
            console.log('[RenderPipeline] Stats.js ready. Press Alt+F3 to toggle.');
        } catch (_) {
            // Stats overlay is optional in production boot.
        }
    }

    _bindF3() {
        window.addEventListener('keydown', (event) => {
            if (event.code !== 'F3' || !event.altKey) {
                return;
            }

            event.preventDefault();
            if (!this._stats) {
                return;
            }

            const dom = this._stats.dom;
            dom.style.display = dom.style.display === 'none' ? 'block' : 'none';
        });
    }

    _guardScene(scene) {
        const hasContent = scene.children.some((child) => child !== this._debugStar);
        if (!hasContent) {
            if (!this._debugStar) {
                const geometry = new BufferGeometry();
                geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
                const material = new PointsMaterial({
                    color: 0x00ffcc,
                    size: 8,
                    sizeAttenuation: true
                });

                this._debugStar = new Points(geometry, material);
                this._debugStar.name = '__DEBUG_STAR__';
                scene.add(this._debugStar);
            }
            return;
        }

        if (this._debugStar?.parent) {
            scene.remove(this._debugStar);
            this._debugStar.geometry.dispose();
            this._debugStar.material.dispose();
            this._debugStar = null;
        }
    }

    render(deltaTime) {
        const { renderer, sceneGraph, camera, frameGraph } = this.kernel;
        if (!renderer || !sceneGraph || !camera) {
            return;
        }

        this._stats?.begin();

        const postPass = frameGraph?.getPass?.(PostProcessPass);

        // 🌌 Triple-Scene Rendering (COSMOS / MACRO / MICRO)
        if (this.currentSceneMode === 'COSMOS') {
            const cosmosSystem = window.Registry?.tryGet('CosmosMapSystem') || this.kernel.cosmosMapSystem;
            if (cosmosSystem && cosmosSystem.isActive) {
                renderer.setClearColor('#000002', 1);
                renderer.clear();
                
                if (postPass && frameGraph?.execute) {
                    postPass.setRenderSource(cosmosSystem.cosmosScene, cosmosSystem.cosmosCamera);
                    frameGraph.execute(deltaTime);
                } else {
                    renderer.render(cosmosSystem.cosmosScene, cosmosSystem.cosmosCamera);
                }
                
                this._stats?.end();
                return;
            }
        }

        if (this.currentSceneMode === 'MACRO') {
            const mapSystem = window.Registry?.tryGet('OntologyMapSystem') || this.kernel.ontologyMapSystem;
            if (mapSystem && mapSystem.isActive) {
                renderer.setClearColor('#000008', 1);
                renderer.clear();
                
                if (postPass && frameGraph?.execute) {
                    postPass.setRenderSource(mapSystem.macroScene, mapSystem.macroCamera);
                    frameGraph.execute(deltaTime);
                } else {
                    renderer.render(mapSystem.macroScene, mapSystem.macroCamera);
                }

                this._stats?.end();
                return;
            }
        }

        const scene = sceneGraph.scene;
        this._guardScene(scene);

        this.kernel.cameraSystem?.sync?.();

        if (frameGraph?.execute) {
            if (!this._postLogged && postPass) {
                console.log('%c[RenderPipeline] PostProcessing online — FrameGraph + UnrealBloom', 'color:#00ffcc;font-weight:bold');
                this._postLogged = true;
            }
            if (postPass) {
                postPass.setRenderSource(scene, camera);
            }
            frameGraph.execute(deltaTime);
        } else {
            renderer.render(scene, camera);
        }

        this._stats?.end();
    }

    setBloomIntensity(value) {
        const postPass = this.kernel.frameGraph?.getPass?.(PostProcessPass);
        postPass?.setBloomIntensity?.(value);
    }

    setBloomThreshold(value) {
        const postPass = this.kernel.frameGraph?.getPass?.(PostProcessPass);
        postPass?.setBloomThreshold?.(value);
    }
}

export default RenderPipeline;
