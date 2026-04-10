// frontend/src/engine/UniverseKernel.js
import * as THREE from 'three';
import SceneGraph from './rendering/SceneGraph.js';
import RenderPipeline from './rendering/RenderPipeline.js';
import { FrameGraph }               from './rendering/FrameGraph.js';
import { SpatialOptimizationPass }  from './rendering/passes/SpatialOptimizationPass.js';
import { PostProcessPass }          from './rendering/passes/PostProcessPass.js';
import { DOMOcclusionPass }         from './rendering/passes/DOMOcclusionPass.js';
import { HolographicOverridePass }  from './rendering/passes/HolographicOverridePass.js';
import { DOMOcclusionSystem }       from './interaction/DOMOcclusionSystem.js';
import { CelestialPhysicsSystem }   from './physics/CelestialPhysicsSystem.js';
// 🚀 Planet + Orbital systems (v2.0.0)
import { OrbitalMechanicsSystem }    from './physics/OrbitalMechanicsSystem.js';
import { TerrainChunkPool }           from './planet/TerrainChunkPool.js';
import { PlanetBuilderSystem }        from './universe/PlanetBuilderSystem.js';
import { LandingPhysicsSystem }       from './planet/LandingPhysicsSystem.js';
import { PlanetShaderSystem }         from './rendering/PlanetShaderSystem.js';
import { GalaxyGenerator }            from './universe/GalaxyGenerator.js';
import { SectorAddress, SectorGridSpec } from './core/SectorAddress.js';
import { UniverseNavigationSystem } from './navigation/UniverseNavigationSystem.js';
import { CameraStabilizationSystem } from './navigation/CameraStabilizationSystem.js';
import { LandingSystem } from './navigation/LandingSystem.js';
import { FloatingOriginSystem } from './navigation/FloatingOriginSystem.js';
import { CameraRig }                from './navigation/CameraRig.js';
import { GalaxyGenerationSystem }   from './galaxy/GalaxyGenerationSystem.js';
import { InputStateSystem }      from './input/InputStateSystem.js';
import { PointerPresentationController } from './input/PointerPresentationController.js';
import { RaycastSelectionSystem } from './interaction/RaycastSelectionSystem.js';
import { InteractionEventSystem } from './interaction/InteractionEventSystem.js';
import { HUDInteractionSystem }   from './interaction/HUDInteractionSystem.js';
import { UniverseSocketClient }   from '../network/UniverseSocketClient.js';
import { WebsocketBridgeSystem }  from '../network/WebsocketBridgeSystem.js';
import { RemotePlayerSystem }     from '../network/RemotePlayerSystem.js';
import { HandInteractionSystem }    from './interaction/HandInteractionSystem.js';
import { NotificationDroneSystem }  from './systems/NotificationDroneSystem.js';
// V4 Arch Imports
import { WindowBridgeSystem }      from './windows/systems/WindowBridgeSystem.js';
import { HUDManager }               from '../hud/HUDManager.js';
import { WindowManager }            from '../windows/WindowManager.js';
import WorkspaceManager             from '../windows/WorkspaceManager.js';
import { KernelBarSystem }          from '../ui/KernelBarSystem.js';
import { InitialMenu }              from '../ui/InitialMenu.js';
import { GameMenuSystem }           from '../ui/GameMenuSystem.js';
import { GalaxyMapOverlaySystem }   from './ui/GalaxyMapOverlaySystem.js';
import { detectGPUCapabilities }    from '../core/GPUCapabilityDetector.js';
import { BootGraphDebugger }       from './devtools/BootGraphDebugger.js';
import { SystemHealthMonitor }     from './devtools/SystemHealthMonitor.js';
import { UniverseStreamer }       from './universe/UniverseStreamer.js';
import { UniverseStreamingSystem } from './universe/UniverseStreamingSystem.js';
import { GALAXY_SPEC, PHYSICS_CONSTANTS } from './config/UniverseSpec.js';

import { BootGraphVisualizer }    from './devtools/BootGraphVisualizer.js';
import { FrameScheduler }         from './core/FrameScheduler.js';
import PayloadManager            from './core/PayloadManager.js';
import PersistenceSystem        from './core/PersistenceSystem.js';
import { SpatialIndexSystem }     from './core/spatial/SpatialIndexSystem.js';
import { AimRaySystem }           from './navigation/AimRaySystem.js';
import { PawnController }         from './navigation/PawnController.js';
import { PawnOrientationSystem }  from './navigation/PawnOrientationSystem.js';
import { ThirdPersonCameraSystem} from './navigation/ThirdPersonCameraSystem.js';
import { EngineDebugPanel }       from './ui/EngineDebugPanel.js';
import { LULUControlPanel }       from './ui/LULUControlPanel.js';
import { LULUResponsePanel }      from './ui/lulu/LULUResponsePanel.js';
import { LULUCommandProcessor }   from './ui/lulu/LULUCommandProcessor.js';
import { LULUSpatialObjectSpawnerSystem } from './ui/lulu/LULUSpatialObjectSpawnerSystem.js';
import { LULUVoiceEngine }       from './ui/lulu/LULUVoiceEngine.js';
import { LULUContextualHUD }     from './ui/lulu/LULUContextualHUD.js';
import PayloadIndicatorSystem from './ui/PayloadIndicatorSystem.js';
import TacticalReadoutSystem from './ui/TacticalReadoutSystem.js';
import TacticalContextMenuSystem from './ui/TacticalContextMenuSystem.js';
import { LuluScannerSystem }     from './ui/LuluScannerSystem.js';
import { AudioEngine }           from './audio/AudioEngine.js';

import TargetTrackingSystem from './ui/TargetTrackingSystem.js';
import GalleryAppWindow from './ui/windows/GalleryAppWindow.js';
import { LULUMindMapWindow } from './ui/windows/LULUMindMapWindow.js';
import { ProjectParticlesSystem } from './systems/ProjectParticlesSystem.js';
import { StellarLODSystem } from './systems/StellarLODSystem.js';
import WarpCinematicSystem from './systems/WarpCinematicSystem.js';
import { OntologyMapSystem } from './systems/OntologyMapSystem.js';
import { CosmosMapSystem } from './systems/CosmosMapSystem.js';
import { MacroWarpSystem } from './systems/MacroWarpSystem.js';
import { CosmosWarpSystem } from './systems/CosmosWarpSystem.js';
import { Orquestador } from './core/Orquestador.js';

import { Registry } from './core/ServiceRegistry.js';
import { EventBus } from '../core/EventBus.js';
import RuntimeState from '../core/RuntimeState.js';
import RuntimeSignals from '../core/RuntimeSignals.js';
import { EntityManager } from './core/EntityManager.js';
import { CelestialRegistry } from '../core/CelestialRegistry.js';
import { AnimationEngine } from '../core/AnimationEngine.js';

/**
 * UniverseKernel — V30 OMEGA
 * * 7-phase deterministic boot sequence (async/await strict):
 * * Fase 1 — Setup DOM / Renderer / Camera
 * Fase 2 — SceneGraph segmentation + Fallback (anti black-screen)
 * Fase 3 — RenderPipeline.start()  ← loop begins, shows fallback grid
 * Fase 4 — Instantiate Physics + Navigation (NOT yet in loop)
 * Fase 5 — AWAIT GalaxyGenerator.buildAsync()  ← resolves Ghost Boot
 * Fase 6 — Inject Physics + Navigation into RenderPipeline
 * Fase 7 — UI handoff: HUD → KernelBar → Windows → Interaction
 * * window.engine = this  (exposed for DevTools live debugging)
 */
export class UniverseKernel {
    constructor() {
        this.state = 'INITIALIZING';
        this.renderer          = null;
        this.scene             = null;
        this.camera            = null;
        this.sceneGraph        = null;
        this.spatialIndex      = null;
        this.renderPipeline    = null;
        this.physicsSystem     = null;
        this.navigationSystem  = null;
        this.galaxyGenerator   = null;
        this.hudManager        = null;
        this.windowManager     = null;
        this.windowDOMSystem   = null;
        this.workspaceManager  = null;
        this.kernelBar         = null;
        this.interactionSystem = null;
        this.initialMenu       = null;
        this.luluPanel         = null;
        this.bootGraph         = new BootGraphDebugger({ debug: true });
        this.onToggleStelaryi  = null;
        
        // Expose Registry locally for Systems that require `this.kernel.registry`
        this.registry          = Registry;

        // Core Loop State
        this.clock = new THREE.Clock();
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.engineLoop = this.engineLoop.bind(this);
    }

    async boot() {
        console.log('%c🚀 [Kernel] Executing Boot Sequence OMEGA V30', 'color:#00ffcc;font-weight:bold;font-size:13px');

        // ── Service Locator Registration ─────────────────────────────────────
        Registry.clear();
        Registry.register('kernel', this);
        Registry.register('registry', this.bootGraph);
        Registry.register('events', new EventBus());
        Registry.register('EntityManager', new EntityManager());
        Registry.register('celestialRegistry', new CelestialRegistry()); // Corregido a camelCase para coincidir con OrbitalMechanicsSystem
        Registry.register('CelestialRegistry', Registry.get('celestialRegistry')); // Alias por compatibilidad
        this.bootGraph.register('CelestialRegistry', Registry.get('celestialRegistry'), [], 'CORE');
        Registry.register('AnimationEngine', new AnimationEngine());
        Registry.register('constants', PHYSICS_CONSTANTS);
        Registry.register('physicsConstants', PHYSICS_CONSTANTS);
        Registry.register('universeSpec', GALAXY_SPEC);
        Registry.register('SectorGridSpec', SectorGridSpec);
        Registry.register('sectorGridSpec', SectorGridSpec);
        Registry.register('SectorAddress', SectorAddress);
        this.runtimeState = new RuntimeState({ events: Registry.get('events') });
        this.runtimeState.installLegacyBridge();
        Registry.register('RuntimeState', this.runtimeState);
        Registry.register('runtimeState', this.runtimeState);
        this.runtimeSignals = new RuntimeSignals({ events: Registry.get('events') });
        Registry.register('RuntimeSignals', this.runtimeSignals);
        Registry.register('runtimeSignals', this.runtimeSignals);
        this.bootGraph.register('RuntimeSignals', this.runtimeSignals, [], 'CORE');
        
        this.payloadManager = new PayloadManager();
        this.payloadManager.init();
        Registry.register('PayloadManager', this.payloadManager);
        Registry.register('payloadManager', this.payloadManager);
        this.bootGraph.register('PayloadManager', this.payloadManager, ['RuntimeSignals'], 'CORE');
        this.persistenceSystem = new PersistenceSystem();
        this.persistenceSystem.init();
        Registry.register('PersistenceSystem', this.persistenceSystem);
        Registry.register('persistenceSystem', this.persistenceSystem);
        this.bootGraph.register('PersistenceSystem', this.persistenceSystem, ['RuntimeSignals'], 'CORE');
        // Legacy global handle for subsystems that access window.Registry
        window.Registry = Registry;
        // Headless test probe — canonical handle used by test-gesture-headless.js
        window.__PG_REGISTRY = Registry;

        this.scheduler = new FrameScheduler();
        Registry.register('scheduler', this.scheduler);
        
        this.bootVisualizer = new BootGraphVisualizer(Registry);
        Registry.register('bootGraph', this.bootVisualizer);

        // ── Fase 1: Setup DOM / Renderer / Camera ─────────────────────────────
        const canvas = document.getElementById('pg-renderer');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            antialias:             true, 
            powerPreference:       'high-performance',
            preserveDrawingBuffer: true,  // V31: required for DOMOcclusionSystem readPixels()
        });

        // Fallback guard contra pantalla negra por contexto invalido.
        const gl = this.renderer.getContext();
        if (!gl) {
            throw new Error('WebGL context not available: check GPU support / browser settings');
        }

        // ── Fase 1 (Cont): GPU & Camera ──────────────────────────────────────
        this.gpuCapabilities = detectGPUCapabilities(this.renderer);
        this.engineProfile = this.gpuCapabilities?.profile || 'low';
        
        this.profileSettings = {
            high: { fps: 60, stars: 100000, orbits: 60 },
            medium: { fps: 60, stars: 60000, orbits: 40 },
            low: { fps: 60, stars: 30000, orbits: 24 }
        };

        // FORCE NATIVE RESOLUTION - ZERO SCALING
        const finalPixelRatio = window.devicePixelRatio || 1;
        this.renderer.setPixelRatio(finalPixelRatio);
        this.renderer.setClearColor(0x000008, 1); // Deep space black — tiny blue tint
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 50000);
        this.camera.name = 'MainCamera';
        Registry.register('camera', this.camera);
        this.bootGraph.register('Camera', this.camera, [], 'CORE');

        // ── CameraRig — Vista galáctica cenital ───────────────────────────
        // Radio galáctico ~8000u. Y=11000 da vista completa del disco galáctico.
        // El TestWorld en (0,0,0) se ve como un punto seleccionable.
        // FloatingOriginSystem permanece inactivo hasta entrar en SOI planetaria.
        this.cameraRig = new CameraRig(null);
        this.cameraRig.fov = 55;
        this.cameraRig.position.set(200, 11000, 200);
        this.cameraRig.lookAt(new THREE.Vector3(0, 0, 0));
        this.bootGraph.register('CameraRig', this.cameraRig, ['Camera'], 'CORE');

        // Sync camera al rig
        this.camera.fov = this.cameraRig.fov;
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this.cameraRig.position);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        this.cameraRig.quaternion.copy(this.camera.quaternion);

        window.addEventListener('resize', () => {
            if (this.camera) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this._syncUIPerformance();
            }
        }, { passive: true });

        // ── Fase 2: SceneGraph OMEGA V30 ──────────────────────────────────────
        this.sceneGraph = new SceneGraph();
        this.scene = this.sceneGraph.scene;
        
        // Spawn fallback grid immediately to prevent black screen prior to galaxy rendering
        this._createFallbackScene();

        // Register early so dependent systems (e.g., AimRaySystem) can resolve it
        Registry.register('SceneGraph', this.sceneGraph);
        Registry.register('scene', this.scene); // alias for older subsystems
        this.bootGraph.register('SceneGraph', this.sceneGraph, [], 'SCENE');
        // CameraRig joins the scene now that the THREE.Scene exists
        this.scene.add(this.cameraRig);

        this.spatialIndex = new SpatialIndexSystem();
        this.bootGraph.register('SpatialIndex', this.spatialIndex, ['SceneGraph'], 'SPATIAL');

        this.universeStreamer = new UniverseStreamer(this.camera, this.sceneGraph, this.spatialIndex);
        this.bootGraph.register('UniverseStreamer', this.universeStreamer, ['SceneGraph', 'SpatialIndex'], 'SIMULATION');

        // ── Fase 3: RenderPipeline OMEGA V30 (Fixed Timestep) ─────────────────
        this.renderPipeline = new RenderPipeline(this);
        Registry.register('RenderPipeline', this.renderPipeline);
        this.bootGraph.register('RenderPipeline', this.renderPipeline, ['SceneGraph'], 'RENDER');

        // ── Configura FrameGraph con post-procesado ──────────────────────────
        this.frameGraph = new FrameGraph(this.renderer, this.scene, this.camera);
        this.frameGraph.addPass(new SpatialOptimizationPass(this.spatialIndex));

        // V31 — DOM Occlusion: hides floating windows behind 3D geometry
        this.domOcclusionSystem = new DOMOcclusionSystem(this.renderer, this.camera);
        Registry.register('DOMOcclusionSystem', this.domOcclusionSystem);
        this.frameGraph.addPass(new DOMOcclusionPass(this.domOcclusionSystem));
        this.bootGraph.register('DOMOcclusionSystem', this.domOcclusionSystem, ['FrameGraph', 'SceneGraph'], 'RENDER');

        const holographicPass = new HolographicOverridePass();
        this.frameGraph.addPass(holographicPass);
        Registry.register('HolographicOverridePass', holographicPass);
        this.bootGraph.register('HolographicOverridePass', holographicPass, ['FrameGraph'], 'RENDER');

        const postProcessPass = new PostProcessPass(this.renderer, this.scene, this.camera);
        this.frameGraph.addPass(postProcessPass);
        Registry.register('PostProcessPass', postProcessPass);
        Registry.register('FrameGraph', this.frameGraph);
        this.bootGraph.register('FrameGraph', this.frameGraph, ['RenderPipeline', 'SpatialIndex'], 'RENDER');
        
        this.renderPipeline.frameGraph = this.frameGraph;

        this.pointerPresentationController = new PointerPresentationController({
            domElement: canvas,
        });
        Registry.register('PointerPresentationController', this.pointerPresentationController);
        Registry.register('pointerPresentation', this.pointerPresentationController);
        this.bootGraph.register('PointerPresentationController', this.pointerPresentationController, [], 'INPUT');

        // InputStateSystem must be alive BEFORE the loop starts so frame-1 has input
        this.inputStateSystem = new InputStateSystem();
        this.bootGraph.register('InputStateSystem', this.inputStateSystem, ['PointerPresentationController'], 'INPUT');
        this.scheduler.register(this.inputStateSystem, 'input'); // ← FIRST in every frame

        // Kick off the internal boot graph sequence before motion begins
        await this.bootGraph.resolveBootSequence();

        // Start Core Kernel Deterministic Loop
        this.start();

        // ── Fase 4: Instantiate Systems (NOT yet injected into pipeline) ───────
        
        // ── Terrain Systems (v2.0.0 Planet Generation) ───────────────────────
        this.terrainChunkPool = new TerrainChunkPool();
        Registry.register('TerrainChunkPool', this.terrainChunkPool);
        this.bootGraph.register('TerrainChunkPool', this.terrainChunkPool, [], 'CORE');
        this.terrainChunkPool.init();

        this.planetBuilderSystem = new PlanetBuilderSystem();
        Registry.register('PlanetBuilderSystem', this.planetBuilderSystem);
        this.bootGraph.register('PlanetBuilderSystem', this.planetBuilderSystem, ['TerrainChunkPool', 'SceneGraph'], 'UNIVERSE');
        this.planetBuilderSystem.init();

        // ── Landing Physics (Raycasting Analítico Invertido) ─────────────────────
        this.landingPhysics = new LandingPhysicsSystem();
        Registry.register('LandingPhysicsSystem', this.landingPhysics);
        this.bootGraph.register('LandingPhysicsSystem', this.landingPhysics, ['PlanetBuilderSystem', 'Camera'], 'PHYSICS');
        this.landingPhysics.init();

        this.aimRaySystem = new AimRaySystem(this);
        Registry.register('aimRay', this.aimRaySystem);
        this.bootGraph.register('AimRaySystem', this.aimRaySystem, ['SceneGraph'], 'INPUT');
        this.scheduler.register(this.aimRaySystem, 'input');

        this.pawnController = new PawnController(this);
        Registry.register('pawnController', this.pawnController);
        this.bootGraph.register('PawnController', this.pawnController, [], 'SIMULATION');

        this.pawnOrientationSystem = new PawnOrientationSystem(this);
        this.bootGraph.register('PawnOrientationSystem', this.pawnOrientationSystem, ['AimRaySystem', 'PawnController'], 'SIMULATION');
        this.scheduler.register(this.pawnOrientationSystem, 'simulation');

        this.tpsCameraSystem = new ThirdPersonCameraSystem(this);
        this.bootGraph.register('ThirdPersonCameraSystem', this.tpsCameraSystem, ['AimRaySystem', 'PawnController'], 'NAVIGATION');
        this.scheduler.register(this.tpsCameraSystem, 'navigation');

        this.physicsSystem    = new CelestialPhysicsSystem(this);
        this.bootGraph.register('CelestialPhysicsSystem', this.physicsSystem, ['RenderPipeline'], 'PHYSICS');
        this.scheduler.register(this.physicsSystem, "physics");

        // 🪐 OrbitalMechanicsSystem — Brazo Ejecutor de Bajo Latencia (LEY 1 / Subsistema Zero-GC)
        const orbitalPhysics = new OrbitalMechanicsSystem(this);
        Registry.register('orbitalMechanics', orbitalPhysics);
        this.bootGraph.register('OrbitalMechanicsSystem', orbitalPhysics, ['CelestialRegistry'], 'SIMULATION');
        orbitalPhysics.init(); // ← REQUERIDO: activa isActive=true. Sin init(), el sistema nunca corre.
        this.scheduler.register(orbitalPhysics, 'simulation');

        // hand hud
        this.handInteractionSystem = new HandInteractionSystem(this.camera, this.scene);
        Registry.register('HandInteractionSystem', this.handInteractionSystem);
        this.bootGraph.register('HandInteractionSystem', this.handInteractionSystem, ['Camera'], 'RENDER');
        this.scheduler.register(this.handInteractionSystem, 'render');
        if (window.Registry) {
            window.Registry.register('handSystem', this.handInteractionSystem);
        }

        this.navigationSystem = new UniverseNavigationSystem(
            this.camera,
            this.scene,
            this.renderer.domElement
        );
        Registry.register('navigationSystem', this.navigationSystem);
        Registry.register('UniverseNavigationSystem', this.navigationSystem);
        Registry.register('NavigationSystem', this.navigationSystem);
        this.bootGraph.register('UniverseNavigationSystem', this.navigationSystem, ['CelestialPhysicsSystem'], 'NAVIGATION');
        this.scheduler.register(this.navigationSystem, "navigation");

        this.landingSystem = new LandingSystem(this);
        this.landingSystem.init();
        this.bootGraph.register('LandingSystem', this.landingSystem, ['UniverseNavigationSystem'], 'NAVIGATION');
        this.scheduler.register(this.landingSystem, 'navigation');

        // ── Fase 5: AWAIT Galaxy Generation ───────────────────────────────────
        // ROOT CAUSE of Ghost Boot: if this is not awaited, the pipeline renders
        // an empty scene and the physics system has zero registered orbits.
        
        // ── GalaxyGenerationSystem (procedural starfield + instanced rendering) ──
        this.galaxyGenSystem = new GalaxyGenerationSystem();
        this.stellarLODSystem = new StellarLODSystem(this);
        this.stellarLODSystem.init();
        Registry.register('StellarLODSystem', this.stellarLODSystem);
        this.bootGraph.register('StellarLODSystem', this.stellarLODSystem, ['GalaxyGenerationSystem', 'SceneGraph'], 'RENDER');
        this.renderPipeline.addSystem(this.stellarLODSystem);

        this.galaxyGenSystem.init(Registry.get('EntityManager').world);
        this.scheduler.register(this.galaxyGenSystem, GalaxyGenerationSystem.phase);
        this.bootGraph.register('GalaxyGenerationSystem', this.galaxyGenSystem, ['SceneGraph'], 'SIMULATION');

        this.galaxyGenerator = new GalaxyGenerator(this.sceneGraph, this.physicsSystem);
        this.bootGraph.register('GalaxyGenerator', this.galaxyGenerator, ['SceneGraph', 'CelestialPhysicsSystem'], 'UNIVERSE');

        const starCountByProfile = {
            high: 70000,
            medium: 42000,
            low: 22000
        };
        this.galaxyGenerator.setOptions({
            starCount: starCountByProfile[this.engineProfile] || 25000,
            maxOrbitCount: this.engineProfile === 'low' ? 24 : 40
        });
        
        let galaxyBuilt = false;
        try {
            await this.galaxyGenerator.buildAsync(); // ← the critical await
            galaxyBuilt = true;
            // Register GalaxyGenerator animated subsystems (SunCorona + AsteroidBelt)
            if (typeof this.galaxyGenerator.update === 'function') {
                this.scheduler.register(this.galaxyGenerator, 'simulation');
            }
            console.log('%c[Kernel] Galaxy build complete.', 'color:#00ffcc');
        } catch (err) {
            console.error(
                '%c[Kernel] GalaxyGenerator FAILED — engine in fallback mode:', 
                'color:#ff4444;font-weight:bold', err
            );
        }

        // ── Fase 6: All systems already in scheduler — no addSystem needed ──────
        // physicsSystem → 'physics' phase (registered line 223)
        // navigationSystem → 'navigation' phase (registered line 241)
        // Adding them again via renderPipeline.addSystem() would double-tick them.

        // ── FloatingOriginSystem (Anti-Jitter, post-navigation) ──────────────────
        this.floatingOrigin = new FloatingOriginSystem();
        Registry.register('FloatingOriginSystem', this.floatingOrigin);
        this.bootGraph.register('FloatingOriginSystem', this.floatingOrigin, ['Camera', 'SceneGraph'], 'NAVIGATION');
        this.floatingOrigin.init();

        // PlanetShaderSystem compile and register
        this.planetShaderSystem = new PlanetShaderSystem();
        Registry.register('PlanetShaderSystem', this.planetShaderSystem);
        this.bootGraph.register('PlanetShaderSystem', this.planetShaderSystem, [], 'RENDER');
        this.planetShaderSystem.init();

        // ── TestWorld: creado en Fase 6 (ANTES de Registry.freeze() en _mountUI) ───────────
        // DIRECTIVA ARQUITECTÓNICA: _mountUI solo observa, nunca construye geometría.
        Registry.tryGet('PlanetBuilderSystem')?.createPlanet('TestWorld', 1000, new THREE.Vector3(0, 0, 0));

        // ── Fase 7: UI Handoff ────────────────────────────────────────────────
        await this._mountUI();
        await this.bootGraph.resolveBootSequence();

        // Expose for DevTools strict debugging:
        window.engine = this;
        window.scene  = this.scene;

        this.state = 'READY';
        console.log('%c✅ [Kernel] Boot Complete. Physics and UI online.', 'color:#00ffcc;font-weight:bold;font-size:14px');
        
        // System Health Monitor Injection for DevTools
        window.healthMonitor = new SystemHealthMonitor();
        window.healthMonitor.report();

        // =========================================================================
        // ARCHITECTURAL DIRECTIVE: INMUTABILIDAD DEL KERNEL
        // Lock the registry now that all systems (including async UI) have booted.
        // =========================================================================
        Registry.freeze();
    }

    // ── Fallback scene visible at t=0 ─────────────────────────────────────────

    _createFallbackScene() {
        const grid = new THREE.GridHelper(500, 100, 0x00ffff, 0x003333);
        const axes = new THREE.AxesHelper(50);
        grid.name          = 'fallback_grid';
        axes.name          = 'fallback_axes';
        grid.userData      = { isFallback: true };
        axes.userData      = { isFallback: true };
        this.sceneGraph.layers.background.add(grid, axes);
    }

    _syncUIPerformance() {
        if (!this.profileSettings || !this.renderPipeline) {
            return;
        }

        const settings = this.profileSettings[this.engineProfile] || this.profileSettings.low;

        if (this.renderer) {
            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        if (this.renderPipeline?.setTargetFPS) {
            this.renderPipeline.setTargetFPS(settings.fps);
        }

        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }

        if (this.frameGraph && this.frameGraph.getPass) {
            const pp = this.frameGraph.getPass(PostProcessPass);
            if (pp && pp.composer) {
                pp.composer.setPixelRatio(this.renderer.getPixelRatio());
                pp.composer.setSize(window.innerWidth, window.innerHeight);
            }
        }

        if (this.hudManager) {
            // Allow HUD to adapt to screen density without redraw overhead.
            this.hudManager.updateMetrics?.(this.renderer.info.render.frame, this.renderer.info.render.calls);
        }
    }

    // ── UI initialization (called AFTER galaxy exists in scene) ───────────────

    async _mountUI() {
        // 0. Audio Engine — Oyente Fantasma. Instancia y pre-aloca el grafo de ruteo.
        //    AudioContext arranca suspendido hasta el primer gesto del usuario.
        this.audioEngine = new AudioEngine();
        Registry.register('AudioEngine', this.audioEngine);
        Registry.register('audioEngine', this.audioEngine);
        this.bootGraph.register('AudioEngine', this.audioEngine, ['RuntimeSignals'], 'AUDIO');

        // 1. HUD telemetry panel → #hud-layer
        this.hudManager = new HUDManager('hud-layer');
        Registry.register('HUDManager', this.hudManager);
        this.bootGraph.register('HUDManager', this.hudManager, ['RenderPipeline'], 'UI');

        // 2. OS dock → #kernel-bar
        this.kernelBar = new KernelBarSystem();
        this.kernelBar.initialize();
        this.bootGraph.register('KernelBarSystem', this.kernelBar, ['HUDManager'], 'UI');

        // 3. Window system → #window-layer
        this.windowManager = new WindowManager(
            document.getElementById('window-layer'),
            this.scene
        );
        Registry.register('WindowManager', this.windowManager);
        this.windowManager.initialize();
        this.bootGraph.register('WindowManager', this.windowManager, ['KernelBarSystem'], 'UI');

        // 3.1 Window bridge + DOM integration
        this.windowBridgeSystem = new WindowBridgeSystem(this.windowManager);
        this.windowBridgeSystem.initialize?.();
        // V31: activate Z-buffer DOM Occlusion Culling now that the renderer exists
        this.windowBridgeSystem.initDepthSampler?.(this.renderer);
        Registry.register('WindowBridgeSystem', this.windowBridgeSystem);
        this.bootGraph.register('WindowBridgeSystem', this.windowBridgeSystem, ['WindowManager'], 'UI');

        this.windowDOMSystem = this.windowManager.getWindowDOMSystem?.() || this.windowManager.domSystem;
        Registry.register('WindowDOMSystem', this.windowDOMSystem);   // ← cockpit HUD needs this
        this.bootGraph.register('WindowDOMSystem', this.windowDOMSystem, ['WindowManager'], 'UI');

        //    Placed AFTER galaxy build so planets exist in scene for raycasting
        this.raycastSelectionSystem = new RaycastSelectionSystem(this.camera, this.sceneGraph, this.navigationSystem);
        this.interactionEventSystem = new InteractionEventSystem();
        this.hudInteractionSystem = new HUDInteractionSystem(this.camera);

        // FASE 5: Instanciar WebSocket Client y el Bridge
        this.socketClient = new UniverseSocketClient();
        Registry.register('socket', this.socketClient);
        this.websocketBridgeSystem = new WebsocketBridgeSystem(this.navigationSystem);

        // InputStateSystem already registered at boot time (before start()) — skip re-registration
        this.bootGraph.register('RaycastSelectionSystem', this.raycastSelectionSystem, ['SceneGraph', 'UniverseNavigationSystem', 'InputStateSystem'], 'INTERACTION');
        this.bootGraph.register('InteractionEventSystem', this.interactionEventSystem, ['RaycastSelectionSystem'], 'INTERACTION');
        this.bootGraph.register('HUDInteractionSystem', this.hudInteractionSystem, ['Camera'], 'UI');
        this.bootGraph.register('WebsocketBridgeSystem', this.websocketBridgeSystem, ['RaycastSelectionSystem'], 'NETWORK');

        this.interactionEventSystem.setWindowDOMSystem(this.windowDOMSystem);
        this.hudInteractionSystem.setWindowDOMSystem(this.windowDOMSystem);
        
        this.raycastSelectionSystem.enable();
        this.interactionEventSystem.enable();

        this.projectParticlesSystem = new ProjectParticlesSystem(this);
        this.projectParticlesSystem.init();
        Registry.register('ProjectParticlesSystem', this.projectParticlesSystem);
        this.renderPipeline.addSystem(this.projectParticlesSystem);

        this.warpCinematicSystem = new WarpCinematicSystem();
        this.warpCinematicSystem.init();
        Registry.register('WarpCinematicSystem', this.warpCinematicSystem);
        Registry.register('warpCinematicSystem', this.warpCinematicSystem);
        this.renderPipeline.addSystem(this.warpCinematicSystem);
        
        // Remote Players System (MMO)
        this.remotePlayerSystem = new RemotePlayerSystem(this.sceneGraph);
        this.bootGraph.register('RemotePlayerSystem', this.remotePlayerSystem, ['WebsocketBridgeSystem'], 'NETWORK');

        // FrameScheduler interaction/ui/network registration (input already registered at boot)
        this.scheduler.register(this.raycastSelectionSystem,'interaction');
        this.scheduler.register(this.hudInteractionSystem,  'ui');
        this.scheduler.register(this.websocketBridgeSystem, 'network');
        this.scheduler.register(this.remotePlayerSystem,    'simulation');

        // Sector streaming — loads star clouds beyond main galaxy field (r > 4000)
        this.sectorStreamingSystem = new UniverseStreamingSystem();
        this.sectorStreamingSystem.init();
        this.scheduler.register(this.sectorStreamingSystem, 'streaming');
        Registry.register('SectorStreamingSystem', this.sectorStreamingSystem);
        
        // Galactic Ontology Map (Dual-Scene Macro Renderer)
        this.ontologyMapSystem = new OntologyMapSystem();
        Registry.register('OntologyMapSystem', this.ontologyMapSystem);
        this.bootGraph.register('OntologyMapSystem', this.ontologyMapSystem, ['RenderPipeline'], 'RENDER');
        this.scheduler.register(this.ontologyMapSystem, 'render');

        this.macroWarpSystem = new MacroWarpSystem();
        Registry.register('MacroWarpSystem', this.macroWarpSystem);
        this.bootGraph.register('MacroWarpSystem', this.macroWarpSystem, ['RenderPipeline', 'OntologyMapSystem'], 'RENDER');
        this.scheduler.register(this.macroWarpSystem, 'render');

        this.cosmosMapSystem = new CosmosMapSystem();
        Registry.register('CosmosMapSystem', this.cosmosMapSystem);
        this.bootGraph.register('CosmosMapSystem', this.cosmosMapSystem, ['RenderPipeline'], 'RENDER');
        this.scheduler.register(this.cosmosMapSystem, 'render');

        this.cosmosWarpSystem = new CosmosWarpSystem();
        Registry.register('CosmosWarpSystem', this.cosmosWarpSystem);
        this.bootGraph.register('CosmosWarpSystem', this.cosmosWarpSystem, ['RenderPipeline', 'CosmosMapSystem'], 'RENDER');
        this.scheduler.register(this.cosmosWarpSystem, 'render');
        
        // Expose legacy reference for telemetry updates (e.g. getActiveTarget)
        this.interactionSystem = this.raycastSelectionSystem;

        // 4.5 Skeletal HUD Hand Interaction System
        this.handSystem = this.handInteractionSystem;

        // 4.6 Camera Stabilization — anti-jitter, quaternion renormalization, sub-frame smoothing
        this.cameraStabilization = new CameraStabilizationSystem();
        this.cameraStabilization.init();
        this.scheduler.register(this.cameraStabilization, 'post-navigation');
        Registry.register('CameraStabilizationSystem', this.cameraStabilization);

        this.notificationDroneSystem = new NotificationDroneSystem(this.sceneGraph, this.navigationSystem);
        this.bootGraph.register('NotificationDroneSystem', this.notificationDroneSystem, ['UniverseNavigationSystem', 'RaycastSelectionSystem'], 'AI');
        this.renderPipeline.addSystem(this.notificationDroneSystem);

        // Debug panel de engine en vivo
        this.debugPanel = new EngineDebugPanel(this.renderer, this.spatialIndex, this.sectorStreamingSystem ?? this.universeStreamer);
        this.bootGraph.register('EngineDebugPanel', this.debugPanel, ['RenderPipeline', 'SpatialIndex', 'UniverseStreamer'], 'UI');

        // Asegurarse de iterar el streamer cada frame si existe el método update
        this.renderPipeline.addSystem({
            renderPhase: 'pre-simulation',
            update: (deltaTime) => {
                if (!this.sectorStreamingSystem && this.universeStreamer && typeof this.universeStreamer.update === 'function') {
                    this.universeStreamer.update(deltaTime);
                }
            }
        });

        // Asegurar llamada al update del panel en cada frame
        this.renderPipeline.addSystem({
            renderPhase: 'post-navigation',
            update: (deltaTime) => {
                if (this.debugPanel && typeof this.debugPanel.update === 'function') {
                    this.debugPanel.update(deltaTime);
                }
            }
        });

        const renderer = this.renderer;
        const hud = this.hudManager;
        const kernel = this;
        this.renderPipeline.addSystem({
            renderPhase: 'post-navigation',
            update() {
                if (!hud.isInitialized) return;
                const celestialStats = Registry.get('CelestialRegistry')?.stats?.() || {};
                hud.updateMetrics(
                    renderer.info.render.frame,
                    renderer.info.render.calls,
                    Registry._services?.size ?? 0,
                    {
                        kernelState: kernel.state,
                        stars: kernel.galaxyGenSystem?.points?.geometry?.getAttribute?.('position')?.count ?? 0,
                        activeSectors:
                            kernel.sectorStreamingSystem?.activeSectors?.size ??
                            kernel.sectorStreamingSystem?.loadedSectorCount ??
                            0,
                        totalBodies: celestialStats.totalBodies ?? 0,
                        hudMode: kernel.inputStateSystem?.hudMode ?? false,
                        pointerLocked: kernel.inputStateSystem?.pointer?.locked ?? false
                    }
                );
                hud.updateSpatial(
                    kernel.camera,
                    kernel.navigationSystem,
                    kernel.interactionSystem
                );
            }
        });

        this.onToggleStelaryi = () => {
            const candidateTarget =
                kernel.navigationSystem?.focusTarget ||
                kernel.interactionSystem?.getActiveTarget?.() ||
                null;
            kernel.navigationSystem?.toggleStelaryi?.(candidateTarget);
        };
        window.addEventListener('PG:TOGGLE_STELARYI', this.onToggleStelaryi);

        this.onToggleSolarSystem = () => {
            const candidateTarget =
                kernel.navigationSystem?.focusTarget ||
                kernel.interactionSystem?.getActiveTarget?.() ||
                null;
            kernel.navigationSystem?.toggleSolarSystem?.(candidateTarget);
        };
        window.addEventListener('PG:TOGGLE_SOLAR_SYSTEM', this.onToggleSolarSystem);
        this.initialMenu = new InitialMenu(this);
        this.bootGraph.register('InitialMenu', this.initialMenu, ['HUDManager', 'WindowManager'], 'UI');
        this.initialMenu.render();

        this.gameMenuSystem = new GameMenuSystem(this);
        Registry.register('GameMenuSystem', this.gameMenuSystem);

        this.galaxyMapOverlaySystem = new GalaxyMapOverlaySystem();
        Registry.register('GalaxyMapOverlaySystem', this.galaxyMapOverlaySystem);
        this.bootGraph.register('GalaxyMapOverlaySystem', this.galaxyMapOverlaySystem, ['GameMenuSystem'], 'UI');
        this.galaxyMapOverlaySystem.init();

        this.luluPanel = new LULUControlPanel(this);
        this.luluPanel.init();
        this.scheduler.register(this.luluPanel, 'ui');

        this.luluResponse = new LULUResponsePanel();
        this.luluResponse.init();
        this.scheduler.register(this.luluResponse, 'ui');
        Registry.register('LULUResponsePanel', this.luluResponse);
        Registry.register('luluResponse', this.luluResponse);
        
        this.luluProcessor = new LULUCommandProcessor(this, this.luluResponse);
        this.luluResponse.processor = this.luluProcessor;

        this.galleryAppWindow = new GalleryAppWindow(this);
        this.galleryAppWindow.init();
        Registry.register('GalleryAppWindow', this.galleryAppWindow);

        this.payloadIndicatorSystem = new PayloadIndicatorSystem();
        this.payloadIndicatorSystem.init();
        Registry.register('PayloadIndicatorSystem', this.payloadIndicatorSystem);
        Registry.register('payloadIndicatorSystem', this.payloadIndicatorSystem);

        this.tacticalReadoutSystem = new TacticalReadoutSystem();
        this.tacticalReadoutSystem.init();
        Registry.register('TacticalReadoutSystem', this.tacticalReadoutSystem);
        Registry.register('tacticalReadoutSystem', this.tacticalReadoutSystem);
        this.scheduler.register(this.tacticalReadoutSystem, 'ui');

        this.tacticalContextMenuSystem = new TacticalContextMenuSystem();
        this.tacticalContextMenuSystem.init();
        Registry.register('TacticalContextMenuSystem', this.tacticalContextMenuSystem);
        Registry.register('tacticalContextMenuSystem', this.tacticalContextMenuSystem);

        this.luluScannerSystem = new LuluScannerSystem();
        this.luluScannerSystem.init();
        Registry.register('LuluScannerSystem', this.luluScannerSystem);
        Registry.register('luluScannerSystem', this.luluScannerSystem);

        this.targetTrackingSystem = new TargetTrackingSystem();
        this.targetTrackingSystem.init();
        Registry.register('TargetTrackingSystem', this.targetTrackingSystem);
        Registry.register('targetTrackingSystem', this.targetTrackingSystem);
        this.scheduler.register(this.targetTrackingSystem, 'ui');

        this.luluMindMapWindow = new LULUMindMapWindow(this);
        this.luluMindMapWindow.init();
        Registry.register('LULUMindMapWindow', this.luluMindMapWindow);
        this.scheduler.register(this.luluMindMapWindow, 'ui');
        
        this.luluPanel.setResponsePanel(this.luluResponse);
        
        this.renderPipeline.addSystem({
            renderPhase: 'post-navigation',
            update: (delta) => {
                if (this.luluPanel && typeof this.luluPanel.update === 'function') {
                    this.luluPanel.update(delta);
                }
            }
        });

        const spawner = new LULUSpatialObjectSpawnerSystem(this);
        Registry.register('luluSpawner', spawner);
        spawner.init();
        
        this.renderPipeline.addSystem({
            renderPhase: 'post-navigation',
            update: (deltaTime) => spawner.update(deltaTime)
        });

        // ── LULU Voice Engine ─────────────────────────────────────────────
        this.luluVoice = new LULUVoiceEngine(this.luluProcessor, this.luluResponse);
        Registry.register('LULUVoice', this.luluVoice);
        window._luluVoice = this.luluVoice;
        // Wire voice into the response panel so it speaks typed lines
        this.luluResponse.voiceEngine = this.luluVoice;

        // ── LULU Contextual HUD (hover chip + descent narration) ──────────
        this.luluContextualHUD = new LULUContextualHUD(this, this.luluResponse);
        this.luluContextualHUD.init();
        Registry.register('LULUContextualHUD', this.luluContextualHUD);

        // 7. Workspace OS Manager (Tiling Layout Integration)
        this.workspaceManager = new WorkspaceManager(this.windowManager);
        Registry.register('WorkspaceManager', this.workspaceManager);
        
        // 8. MASTER ORQUESTADOR (The "Brain" for LULU & DevTools)
        const orquestador = new Orquestador(this);
        Registry.register('Orquestador', orquestador);
        orquestador.init();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                document.body.classList.toggle('pg-dev-mode');
                this.workspaceManager?.toggleMissionControl?.();
            }
        });


        console.log('%c[Kernel] UI Systems activated.', 'color:#00ffcc;font-weight:bold');
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        this.clock.start();
        this.engineLoop();
        console.log("🚀 [OMEGA ENGINE] Kernel Master Loop Started.");
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.clock.stop();
        console.log("🛑 [OMEGA ENGINE] Kernel Master Loop Suspended.");
    }

    engineLoop() {
        if (!this.isRunning) return;
        this.animationFrameId = requestAnimationFrame(this.engineLoop);
        
        // Fixed timestep delta capping
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        if (this.isPaused) {
            if (this.renderPipeline && typeof this.renderPipeline.render === 'function') {
                this.renderPipeline.render(0);
            }
            return;
        }

        // 1. UPDATE ECOSYSTEM
        if (this.scheduler) {
            this.scheduler.update(deltaTime);
        }

        // 2. RENDER PIPELINE
        if (this.renderPipeline && typeof this.renderPipeline.render === 'function') {
            this.renderPipeline.render(deltaTime);
        }
    }
}
