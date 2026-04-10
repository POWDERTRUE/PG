# 🌌 ÁLBUM UNIVERSAL: POWDER GALAXY (BLUEPRINT MAESTRO)

```json
{
  "module": "AlbumUniversal",
  "version": "V31_INDUSTRIAL_GRADE",
  "generated": "2026-03-30",
  "engine_target": "OMEGA V31",
  "ai_directive": "Este índice es el punto de entrada canónico para toda IA que trabaje en Powder Galaxy. Leer este archivo PRIMERO. Seguir dependencias en orden topológico: Core → Physics → Galaxy → Navigation → Pipeline → Input → Interaction → DOM → Root.",
  "upgrade_status": {
    "01_NUCLEO": "ECS_DOD_UPGRADE_PENDING",
    "03_PHYSICS": "RK4_INTEGRATOR_PENDING",
    "11_ROOT_LULU": "SPATIAL_TREE_BVH_PENDING",
    "07_INTERACTION": "OCCLUSION_CULLING_PENDING",
    "10_DOM": "ZBUFFER_DEPTH_UI_PENDING"
  }
}
```

> **Generado el:** 2026-03-30 — **Motor:** OMEGA V31 Industrial Grade
> **Directiva:** Este documento expone el árbol arquitectónico completo. Diseñado para lectura rápida por IA y desarrolladores. Cada módulo incluye metadata JSON, contratos de interface, y marcadores `[IA-TODO]` para implementación guiada.

---

## 🤖 PROTOCOLO DE LECTURA PARA IA

Antes de tocar **cualquier** archivo de código, la IA debe:
1. Leer `00_INDICE_MAESTRO.md` (este archivo) para contexto global
2. Leer el `.md` del módulo específico que se va a modificar
3. Verificar las dependencias listadas en el bloque JSON de ese módulo
4. Seguir los bloques `[IA-TODO]` como directivas de inyección exactas
5. **PROHIBIDO** crear objetos con `new` dentro de loops calientes (GC pressure)
6. **PROHIBIDO** romper la API legacy — todos los cambios deben ser retrocompatibles

---

## 🗂️ Índice Jerárquico de Módulos

### [💠 NÚCLEO Y ARQUITECTURA (CORE)](./01_NUCLEO_Y_ARQUITECTURA_CORE.md)
*El cimiento absoluto de OMEGA. Define el Entity Component System (ECS), el Registro de Servicios y el FrameScheduler.*
**Estado:** `ECS_DOD_UPGRADE_PENDING` — Migrar ComponentStore a Float32Array + SharedArrayBuffer
**26 archivos**

### [💠 GENERACIÓN CÓSMICA (GALAXY)](./02_GENERACION_COSMICA_GALAXY.md)
*Módulo de instanciación matemática de masas estelares y galaxias procedimentales atadas a espirales logarítmicas.*
**Estado:** `N_BODY_GRAVITY_PENDING` — Acoplar GalaxyGenerationSystem a CelestialPhysicsSystem RK4
**1 archivo**

### [💠 GRAVEDAD Y FÍSICA (PHYSICS)](./03_GRAVEDAD_Y_FISICA_PHYSICS.md)
*Simula órbitas N-Body. Integrador actual: Euler Semi-Implícito. Objetivo: RK4 + GPGPU colisiones.*
**Estado:** `RK4_INTEGRATOR_PENDING` — Sustituir Euler por Runge-Kutta de 4to orden
**6 archivos**

### [💠 NAVEGACIÓN ESTELAR (NAVIGATION)](./04_NAVEGACION_ESTELAR_NAVIGATION.md)
*Máquina de Estados de Cámara (FSM) que controla God View, Warp Cinematográfico y First Person.*
**Estado:** `STABLE` — Listo para acoplamiento WebXR
**22 archivos**

### [💠 SISTEMA DE RENDERIZADO VISUAL (PIPELINE)](./05_SISTEMA_DE_RENDER_PIPELINE.md)
*FrameGraphs de post-procesado (Bloom), Frustum Culling espacial, y Occlusion Culling DOM.*
**Estado:** `OCCLUSION_CULLING_PENDING` — Implementar DOM depth occlusion via Z-Buffer
**25 archivos**

### [💠 SENSORES Y HARDWARE (INPUT)](./06_SENSORES_INPUT.md)
*Capa HW. Escucha Mouse/Teclado/Gamepad y exporta Deltas puras al EventBus.*
**Estado:** `STABLE` — Gamepad API pendiente de integración
**1 archivo**

### [💠 LÓGICA DE INTERACCIÓN GLOBAL](./07_LOGICA_INTERACCION.md)
*Raytracing de interacciones, Occlusion Culling UI, colisiones HUD y gravedad gun.*
**Estado:** `OCCLUSION_CULLING_PENDING` — Profundidad UI realista via Z-Buffer WebGL
**9 archivos**

### [💠 INTERFACES DOM Y RUTAS (UI)](./10_INTERFACES_DOM.md)
*Menús 2D inmersivos en el DOM y lógica HTML superpuesta a WebGL.*
**Estado:** `DEPTH_OCCLUSION_PENDING` — Ventanas Glass Silicon con oclusión por malla 3D
**11 archivos**

### [💠 ARCHIVOS SECUNDARIOS Y CONTROLADORES RAÍZ](./11_CONTROLADORES_RAIZ.md)
*Ficheros top-level, LULU AI, WindowManager, SolarSystem, y BVH Spatial Spawner.*
**Estado:** `BVH_SPATIAL_TREE_PENDING` — LULUSpatialObjectSpawnerSystem con Octree/BVH
**100+ archivos**

---

## 🌳 Árbol Estructural Completo

```text
POWDER_GALAXY/
├── 01_NUCLEO_Y_ARQUITECTURA_CORE/
│   ├── engine/core/EntityManager.js          [ECS SparseSet — DOD UPGRADE PENDING]
│   ├── engine/core/BootGraphVisualizer.js
│   ├── engine/core/SystemManifest.js
│   ├── engine/core/spatial/SpatialIndexSystem.js
│   ├── engine/core/DependencyResolver.js
│   ├── engine/core/Orquestador.js
│   ├── engine/core/math/Vector3.js
│   ├── engine/core/BootSequenceDebugger.js
│   ├── engine/core/OMEGAEngineDevTools.js
│   ├── engine/core/LODManager.js
│   ├── engine/core/ServiceRegistry.js
│   ├── engine/core/PersistenceSystem.js
│   ├── engine/core/math/Pool.js
│   ├── engine/core/spatial/FloatingOriginSystem.js
│   ├── engine/core/BootSequence.js
│   ├── engine/core/DiscoveryLogSystem.js
│   ├── engine/core/HierarchySystem.js
│   ├── engine/core/MeshSyncSystem.js
│   ├── engine/core/RelativeFrameSystem.js
│   ├── engine/core/SectorCoordinateSystem.js
│   ├── engine/core/UniverseStateManager.js
│   ├── engine/core/UniverseIntelligence.js
│   ├── engine/core/FrameScheduler.js
│   ├── engine/core/galaxy/GalaxyDataSystem.js
│   ├── engine/core/math/Euler.js
│   ├── engine/core/UniverseCoordinateMath.js
├── 02_GENERACION_COSMICA_GALAXY/
│   ├── engine/galaxy/GalaxyGenerationSystem.js  [N-Body gravity PENDING]
├── 03_GRAVEDAD_Y_FISICA_PHYSICS/
│   ├── engine/physics/CelestialPhysicsSystem.js [RK4 UPGRADE PENDING]
│   ├── engine/physics/AtmosphericEntrySystem.js
│   ├── engine/physics/FlightPhysicsSystem.js
│   ├── engine/physics/AtmosphericTurbulenceSystem.js
│   ├── engine/physics/WeatherSensor.js
│   ├── engine/physics/OrbitNode.js
├── 04_NAVEGACION_ESTELAR_NAVIGATION/
│   ├── engine/navigation/UniverseNavigationSystem.js
│   ├── engine/navigation/states/FreeFlightState.js
│   ├── engine/navigation/states/WorldFocusState.js
│   ├── engine/navigation/FloatingOriginSystem.js
│   ├── engine/navigation/AimRaySystem.js
│   ├── engine/navigation/HyperspaceSystem.js
│   ├── engine/navigation/CinematicCameraSystem.js
│   ├── engine/navigation/states/WarpState.js
│   ├── engine/navigation/TravelStateMachine.js
│   ├── engine/navigation/NavigationSystem.js
│   ├── engine/navigation/CameraStateMachine.js
│   ├── engine/navigation/LandingSystem.js
│   ├── engine/navigation/WarpSystem.js
│   ├── engine/navigation/CameraController.js
│   ├── engine/navigation/ThirdPersonCameraSystem.js
│   ├── engine/navigation/PawnOrientationSystem.js
│   ├── engine/navigation/XRNavigationBridge.js
│   ├── engine/navigation/SectorFrameSystem.js
│   ├── engine/navigation/PhysicalFlightSystem.js
│   ├── engine/navigation/CameraSystem.js
│   ├── engine/navigation/PawnController.js
│   ├── engine/navigation/StubSystems.js
├── 05_SISTEMA_DE_RENDER_PIPELINE/
│   ├── engine/rendering/CosmicBackgroundSystem.js
│   ├── engine/rendering/GlassSiliconeMaterial.js
│   ├── engine/rendering/SpatialIndexSystem.js   [Octree existente]
│   ├── engine/rendering/GalaxyRenderer.js
│   ├── engine/rendering/stars/StarfieldSystem.js
│   ├── engine/rendering/effects/WindStreakVFX.js
│   ├── engine/rendering/InstancedRenderSystem.js
│   ├── engine/rendering/shaders/PlanetAtmosphereShader.js
│   ├── engine/rendering/LODSystem.js
│   ├── engine/rendering/effects/EntryVFXSystem.js
│   ├── engine/rendering/effects/PlanetDiscoveryVFX.js
│   ├── engine/rendering/stars/StarLODSystem.js
│   ├── engine/rendering/XRSystem.js              [WebXR ready]
│   ├── engine/rendering/SceneGraph.js
│   ├── engine/rendering/passes/PostProcessPass.js
│   ├── engine/rendering/DynamicStarLODSystem.js
│   ├── engine/rendering/VisibilitySystem.js
│   ├── engine/rendering/RenderPipeline.js
│   ├── engine/rendering/passes/SpatialOptimizationPass.js
│   ├── engine/rendering/stars/StarDistribution.js
│   ├── engine/rendering/stars/StarParticleSystem.js
│   ├── engine/rendering/stars/StarSpriteSystem.js
│   ├── engine/rendering/stars/StarMeshSystem.js
│   ├── engine/rendering/FrameGraph.js
│   ├── engine/rendering/passes/CoreRenderPass.js
├── 06_SENSORES_INPUT/
│   ├── engine/input/SpatialInputSystem.js
├── 07_LOGICA_INTERACCION/
│   ├── engine/interaction/HUDInteractionSystem.js [OCCLUSION_CULLING_PENDING]
│   ├── engine/interaction/HandInteractionSystem.js
│   ├── engine/interaction/PlayerGauntletsSystem.js
│   ├── engine/interaction/RaycastSelectionSystem.js
│   ├── engine/interaction/SpatialInteractionManager.js
│   ├── engine/interaction/SpatialGestureSystem.js
│   ├── engine/interaction/InteractionEventSystem.js
│   ├── engine/interaction/ScanningSystem.js
│   ├── engine/interaction/InteractionStrategy.js
├── 10_INTERFACES_DOM/
│   ├── ui/InitialMenu.js
│   ├── ui/FocusRingUI.js
│   ├── ui/URLLauncher.js
│   ├── ui/GameMenuSystem.js
│   ├── ui/StatusWidgets.js
│   ├── ui/Dashboard.js
│   ├── ui/KernelBarSystem.js
│   ├── ui/LoginPanel.js
│   ├── ui/HUDController.js
│   ├── ui/KernelRouter.js
│   ├── ui/KernelButtonSystem.js
├── 11_CONTROLADORES_RAIZ/
│   ├── engine/ui/lulu/LULUSpatialObjectSpawnerSystem.js [BVH_PENDING]
│   ├── engine/UniverseKernel.js
│   ├── engine/windows/WindowManager.js
│   ├── hud/HUDManager.js
│   ├── engine/universe/GalaxyGenerator.js
│   ├── styles/glass.css
│   ├── styles/layout.css
│   ├── styles/windows.css
│   └── [... 92+ archivos adicionales]
```

---

## 🚀 Roadmap de Upgrades V31

| Módulo | Upgrade | Beneficio | Prioridad |
|--------|---------|-----------|-----------|
| ECS Core | TypedArrays + SharedArrayBuffer | Zero GC, Multithreading real | 🔴 CRÍTICO |
| Physics | Integrador RK4 | Órbitas estables infinitamente | 🔴 CRÍTICO |
| LULU Spawner | BVH Spatial Tree | Colisiones físicas reales | 🟡 ALTA |
| HUD Interaction | DOM Occlusion Culling | Profundidad UI realista | 🟡 ALTA |
| Galaxy | N-Body gravitación | Formaciones dinámicas 150K pts | 🟢 MEDIA |
| XR System | WebXR Full Integration | Realidad Virtual completa | 🟢 MEDIA |
