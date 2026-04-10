# POWDER GALAXY ENGINE MAP
Universe Operating System Architecture — **OMEGA V30**

This document defines the full system map of the Powder Galaxy engine.
LULU uses this as the canonical architecture reference.

---

# ENGINE ARCHITECTURE

The engine is organized into layered systems with a deterministic FrameScheduler.

```
Kernel Layer → Core Systems → Simulation → Navigation → Rendering → UI → Network
```

**Service Locator:** All systems register with `ServiceRegistry` (singleton: `Registry`).
**Frame Loop:** `FrameScheduler` runs phases in strict order every frame.

---

# 1 KERNEL LAYER

`UniverseKernel` — OMEGA V30 (7-Phase Boot)

Boot sequence:
1. Setup DOM / Renderer / Camera
2. SceneGraph creation (with fallback grid)
3. RenderPipeline.start() — loop begins
4. Instantiate Physics + Navigation
5. AWAIT GalaxyGenerator.buildAsync()
6. Inject all systems into FrameScheduler
7. UI handoff (HUD → LULU → Windows)

Exposes: `window.engine`, `window.scene`, `window.Registry`

---

# 2 CORE SYSTEMS

| System | Registry Key | Purpose |
|--------|-------------|---------|
| `ServiceRegistry` | `Registry` (singleton) | Global service locator |
| `EntityManager` + `ECSWorld` | `EntityManager` | Sparse Set ECS |
| `FrameScheduler` | `scheduler` | Phase-ordered update loop |
| `EventBus` | `events` | Typed event bus |
| `RuntimeState` | `runtimeState` / `RuntimeState` | Game state (pause/play) |
| `RuntimeSignals` | `runtimeSignals` | Global signal bus |
| `CelestialRegistry` | `celestialRegistry` | Celestial body catalog |
| `AnimationEngine` | `AnimationEngine` | GSAP animation bridge |
| `BootGraphDebugger` | internal | Dependency boot graph |
| `BootSequenceDebugger` | internal | Per-system timing |

---

# 3 FRAME SCHEDULER PHASES (in order)

```
input          → InputStateSystem (mouse, keyboard, pointer lock)
interaction    → RaycastSelectionSystem
navigation     → UniverseNavigationSystem, LandingSystem, CameraRig
pre-simulation → Universe streamer prep
simulation     → ECS world, GalaxyGenerationSystem, FloatingOriginSystem
physics        → CelestialPhysicsSystem, OrbitalMechanicsSystem
streaming      → UniverseStreamingSystem (sector LOD)
render         → HandInteractionSystem, WebGL draw prep
post-navigation→ HUD telemetry, EngineDebugPanel, LULU update
ui             → LULUControlPanel, LULUResponsePanel
window         → WindowManager
network        → WebsocketBridgeSystem, RemotePlayerSystem
ai             → NotificationDroneSystem
post-render    → Post-processing passes
```

---

# 4 SIMULATION / PHYSICS SYSTEMS

| System | Phase | Purpose |
|--------|-------|---------|
| `CelestialPhysicsSystem` | physics | Body forces, gravity |
| `OrbitalMechanicsSystem` | simulation | Zero-garbage orbital math |
| `FloatingOriginSystem` | simulation | Infinite-world origin shift |
| `GalaxyGenerationSystem` | simulation | Procedural star instancing |
| `GalaxyGenerator` | universe | Full solar system build |
| `AtmosphericEntrySystem` | physics | Atmospheric drag on entry |
| `AtmosphericTurbulenceSystem` | physics | Turbulence forces |

---

# 5 NAVIGATION SYSTEMS

| System | Phase | Purpose |
|--------|-------|---------|
| `UniverseNavigationSystem` | navigation | Master camera FSM |
| `CameraRig` | navigation | Camera position/rotation holder |
| `AimRaySystem` | input | World-space aim ray |
| `PawnController` | simulation | Player pawn state |
| `PawnOrientationSystem` | simulation | Pawn facing |
| `ThirdPersonCameraSystem` | navigation | 3rd-person follow cam |
| `LandingSystem` | navigation | Planet approach + land |
| `CameraStabilizationSystem` | post-navigation | Anti-jitter smoothing |

---

# 6 RENDERING SYSTEMS

| System | Purpose |
|--------|---------|
| `RenderPipeline` | Main render: FrameGraph → PostProcess |
| `SceneGraph` | Layer-separated THREE.Scene |
| `FrameGraph` | Post-processing pass chain |
| `SpatialIndexSystem` (core/spatial/) | Hash-grid spatial queries |
| `SpatialIndexSystem` (rendering/) | V14 Octree (legacy, not active) |
| `GalaxyGenerationSystem` | Instanced starfield |
| `CosmicBackgroundSystem` | Nebula shader + deep starfield |
| `GalaxyGenerator` | Per-star solar systems |
| `SunCoronaSystem` | Animated solar corona |
| `AsteroidBeltRenderer` | GPU Instanced belt |
| `OrbitalRingSystem` | Planet orbit line rings |

---

# 7 UI / LULU SYSTEMS

| System | Purpose |
|--------|---------|
| `HUDManager` | Telemetry HUD overlay |
| `KernelBarSystem` | OS dock bar |
| `EngineDebugPanel` | Live GPU/scene stats |
| `LULUControlPanel` | LULU floating panel |
| `LULUCommandBar` | Command input bar |
| `LULUCommandProcessor` | Natural language dispatch |
| `LULUResponsePanel` | Output log panel |
| `LULUVoiceEngine` | TTS + STT (Web Speech API) |
| `LULUContextualHUD` | Hover chip HUD |
| `LULUSpatialObjectSpawnerSystem` | In-world object creation |
| `Orquestador` | LULU diagnostics brain |

---

# 8 WINDOW SYSTEMS

| System | Purpose |
|--------|---------|
| `WindowManager` | Spatial window lifecycle |
| `WindowBridgeSystem` | DOM ↔ 3D projection bridge |
| `WorkspaceManager` | Tiling / Mission Control |

---

# 9 NETWORK SYSTEMS

| System | Registry Key | Purpose |
|--------|-------------|---------|
| `UniverseSocketClient` | `socket` | WebSocket connection |
| `WebsocketBridgeSystem` | internal | Event relay |
| `RemotePlayerSystem` | internal | MMO player sync |

---

# REGISTRY PATTERN (V30)

All systems use the **module-level singleton**:
```js
import { Registry } from './core/ServiceRegistry.js';
// ...
const camera = Registry.get('camera');           // throws if missing
const nav    = Registry.tryGet('NavigationSystem'); // returns null if missing
```

**DO NOT** use `this.Registry` — it is never set on instances.
**DO NOT** call `Registry.get('registry')` — that returns the BootGraphDebugger, not the registry itself.

---

# ENGINE SAFETY RULES

- No circular dependencies in boot graph
- No blocking operations in render loop (use async only during boot)
- Systems must register with Registry at boot time
- UI must not block simulation
- FrameScheduler phase order is law — never bypass it
- `SpatialIndexSystem` instance in `core/spatial/` is canonical — use Registry

---

# DESIGN PRINCIPLE

Powder Galaxy is not just a game engine.

It is a **spatial operating system**.

Applications exist as planets.
Navigation is space travel.
The universe is the interface.


---

# ENGINE ARCHITECTURE

The engine is organized into layered systems.

Kernel Layer
Core Systems
Simulation Systems
Navigation Systems
Rendering Systems
Streaming Systems
Interaction Systems
UI Systems
Window Systems
Network Systems

Each system must register with the ServiceRegistry.

---

# 1 KERNEL LAYER

UniverseKernel

Responsibilities:

initialize engine
register systems
start render pipeline
mount UI

---

# 2 CORE SYSTEMS

SystemRegistry  
EntityManager  
ResourceManager  
EventBus  
UniverseStateManager  
PersistenceSystem  

Responsibilities:

system lifecycle
dependency management
event routing
resource management

---

# 3 SIMULATION SYSTEMS

UniverseSimulationLayer  
CelestialRegistry  
CelestialPhysicsSystem  
OrbitalMechanicsSystem  
GravitySystem  
AtmosphericEntrySystem  
AtmosphericTurbulenceSystem  
FlightPhysicsSystem  

Responsibilities:

celestial mechanics
orbital physics
atmospheric simulation
spaceflight physics

---

# 4 UNIVERSE GENERATION

GalaxyGenerator  
ConstellationSystem  
StarClusterSystem  
SolarSystemGenerator  
PlanetGenerator  
AsteroidBeltSystem  
CometSystem  

Responsibilities:

procedural universe creation
star generation
planet generation

---

# 5 NAVIGATION SYSTEMS

CameraSystem  
NavigationSystem  
RelativeFrameSystem  
FloatingOriginSystem  
WarpSystem  
HyperspaceSystem  
PhysicalFlightSystem  
UniverseNavigationSystem  

Responsibilities:

movement through universe
camera control
warp mechanics
sector traversal

---

# 6 STREAMING SYSTEMS

SpatialIndexSystem  
UniverseStreamingSystem  
SectorManager  
SectorFrameSystem  
LODManager  

Responsibilities:

sector loading
LOD management
spatial queries
universe streaming

---

# 7 RENDERING SYSTEMS

RenderPipeline  
SceneGraph  
InstancedRenderSystem  
CosmicBackgroundSystem  
StarfieldSystem  
PlanetRenderer  
AtmosphereRenderer  

Responsibilities:

render celestial bodies
handle GPU instancing
manage render passes

---

# 8 INTERACTION SYSTEMS

SpatialInputSystem  
InteractionStrategy  
SpatialGestureSystem  
WorldInteractionSystem  

Responsibilities:

handle player interaction
gesture translation
object selection

---

# 9 UI SYSTEMS

HUDManager  
DebugOverlay  
PerformancePanel  
SystemBar  
KernelButtonSystem  
LoginPanel  

Responsibilities:

display OS interface
display telemetry
handle UI commands

---

# 10 WINDOW SYSTEMS

WindowManager  
Window3DSystem  
WindowDOMSystem  
WindowBridgeSystem  
SpatialWindowPhysicsEngine  

Responsibilities:

manage spatial windows
connect DOM with 3D world
handle window physics

---

# 11 NETWORK SYSTEMS

UniverseSocketClient  

Responsibilities:

synchronize multiplayer
connect backend events
handle real-time updates

---

# ENGINE LOOP

RenderPipeline controls main loop.

Loop phases:

input
simulation
navigation
streaming
render
ui

Each system receives update(deltaTime).

---

# PERFORMANCE DESIGN

The engine must scale to galaxy level.

Key techniques:

GPU instancing
level of detail
sector streaming
spatial indexing
object pooling
render batching

---

# ENGINE SAFETY RULES

LULU must enforce:

no circular dependencies
no blocking operations in render loop
systems must register with registry
UI must not block simulation
navigation must not break render pipeline

---

# FAILURE RECOVERY

If the engine fails to boot:

LULU must:

inspect logs
trace failing system
verify registry entries
verify boot order
repair missing systems

---

# FUTURE SYSTEMS

Powder Galaxy may add:

AI civilizations
dynamic star evolution
cosmic weather
procedural nebulae
multiplayer universe

---

# DESIGN PRINCIPLE

Powder Galaxy is not just a game engine.

It is a spatial operating system.

Applications exist as planets.

Navigation is space travel.

The universe is the interface.