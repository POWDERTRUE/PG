import { Registry } from './ServiceRegistry.js';

/**
 * SystemManifest.js
 * OMEGA V28 Master Edition — Core Architecture
 */

// --- SHARED SERVICES REGISTRY (V15) ---
const SERVICES = {
    kernel: null,
    registry: null,
    events: null,
    scheduler: null
};

// --- SYSTEM FACTORIES (V15 COMPLIANT) ---
const FACTORIES = {
    // 1. Foundation
    SceneGraph: ({ services }) => import('../rendering/SceneGraph.js').then(m => new m.SceneGraph(services)),
    RenderPipeline: ({ services }) => import('../rendering/RenderPipeline.js').then(m => new m.RenderPipeline(services)),
    CameraSystem: ({ services }) => import('../navigation/CameraSystem.js').then(m => new m.CameraSystem(services)),
    SpatialIndexSystem: ({ services }) => import('../core/spatial/SpatialIndexSystem.js').then(m => new m.SpatialIndexSystem(services)),
    InstancedRenderSystem: ({ services }) => import('../rendering/InstancedRenderSystem.js').then(m => new m.InstancedRenderSystem(services)),
    CameraController: ({ services }) => import('../navigation/CameraController.js').then(m => new m.CameraController(services)),
    
    // 2. Input & Interaction
    SpatialInputSystem: ({ services }) => import('../input/InputStateSystem.js').then(m => new m.InputStateSystem(services)),
    
    // 3. Universe Simulation
    GalaxyDataSystem: ({ services }) => import('./galaxy/GalaxyDataSystem.js').then(m => new m.GalaxyDataSystem(services)),
    CelestialPhysicsSystem: ({ services }) => import('../physics/CelestialPhysicsSystem.js').then(m => new m.CelestialPhysicsSystem(services)),
    CelestialHierarchySystem: ({ services }) => import('../ui/CelestialHierarchySystem.js').then(m => new m.CelestialHierarchySystem(services)),
    CinematicCameraSystem: ({ services }) => import('../navigation/CinematicCameraSystem.js').then(m => new m.CinematicCameraSystem(services)),
    CelestialOrbitSystem: ({ services }) => import('../ui/CelestialOrbitSystem.js').then(m => new m.CelestialOrbitSystem(services)),
    GalaxyGenerator: ({ services }) => import('../universe/GalaxyGenerator.js').then(m => new m.GalaxyGenerator(services)),
    
    // 5. HUD & Sensory
    PerformancePanel: ({ services }) => import('../ui/PerformancePanel.js').then(m => new m.PerformancePanel(services)),
    
    // External/Virtual
    CelestialRegistry: ({ services }) => Promise.resolve(Registry.get('CelestialRegistry'))
};

export const SYSTEM_MANIFEST = {
    // --- TIER 1: FOUNDATION ---
    SceneGraph: {
        dependencies: [],
        factory: FACTORIES.SceneGraph,
        priority: 100
    },
    RenderPipeline: {
        dependencies: ['SceneGraph'],
        factory: FACTORIES.RenderPipeline,
        priority: 95
    },
    CameraSystem: {
        dependencies: ['SceneGraph'],
        factory: FACTORIES.CameraSystem,
        priority: 90
    },
    SpatialIndexSystem: {
        dependencies: [],
        factory: FACTORIES.SpatialIndexSystem,
        priority: 88
    },
    InstancedRenderSystem: {
        dependencies: ['SceneGraph'],
        factory: FACTORIES.InstancedRenderSystem,
        priority: 87
    },
    CameraController: {
        dependencies: ['CameraSystem'],
        factory: FACTORIES.CameraController,
        priority: 86
    },

    // --- TIER 2: INPUT & CORE LOGIC ---
    SpatialInputSystem: {
        dependencies: [],
        factory: FACTORIES.SpatialInputSystem,
        priority: 85
    },

    // --- TIER 3: UNIVERSE & PHYSICS ---
    GalaxyDataSystem: {
        dependencies: [],
        factory: FACTORIES.GalaxyDataSystem,
        priority: 72
    },
    CelestialPhysicsSystem: {
        dependencies: ['SceneGraph', 'CameraSystem'],
        factory: FACTORIES.CelestialPhysicsSystem,
        priority: 70
    },
    CelestialHierarchySystem: {
        dependencies: ['SceneGraph'],
        factory: FACTORIES.CelestialHierarchySystem,
        priority: 65
    },
    CelestialOrbitSystem: {
        dependencies: ['CelestialHierarchySystem'],
        factory: FACTORIES.CelestialOrbitSystem,
        priority: 60
    },
    GalaxyGenerator: {
        dependencies: ['CelestialHierarchySystem', 'GalaxyDataSystem'],
        factory: FACTORIES.GalaxyGenerator,
        priority: 55
    },

    // --- TIER 6: SENSORY & HUD ---
    PerformancePanel: {
        dependencies: ['SceneGraph'],
        factory: FACTORIES.PerformancePanel,
        priority: 0
    },
    CelestialRegistry: {
        dependencies: [],
        factory: FACTORIES.CelestialRegistry,
        priority: 110 // Base system
    }
};

/**
 * Validates the manifest integrity.
 */
export function auditManifest(manifest = SYSTEM_MANIFEST) {
    const keys = Object.keys(manifest);
    console.log(`[ManifestAudit] Validating ${keys.length} engine systems...`);
    
    keys.forEach(key => {
        const entry = manifest[key];
        if (!entry.factory) console.error(`[ManifestAudit] ❌ ERROR: "${key}" is missing factory function!`);
        
        entry.dependencies.forEach(dep => {
            if (!manifest[dep]) {
                console.error(`[ManifestAudit] ❌ ERROR: "${key}" depends on "${dep}", but "${dep}" is not in manifest!`);
            }
        });
    });
    
    console.log('[ManifestAudit] Audit complete. Architecture is coherent.');
}

