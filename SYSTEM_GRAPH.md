# POWDER GALAXY — SYSTEM GRAPH V30
> Motor OMEGA V30 · Arquitectura completa · Actualizado 2026-03-23
> ✅ = implementado · 🔮 = planificado · ⚠ = parcial
> LULU debe usar este documento como fuente de verdad para diagnóstico y extensión del engine.

---

## FLUJO GLOBAL DEL ENGINE (FRAME DETERMINISTA)

```
User Input
    ↓
[ input ]          InputStateSystem
    ↓
[ interaction ]    RaycastSelectionSystem · InteractionEventSystem · HUDInteractionSystem
    ↓
[ navigation ]     UniverseNavigationSystem · ThirdPersonCameraSystem · FloatingOriginSystem
    ↓
[ pre-simulation ] UniverseStreamer
    ↓
[ simulation ]     GalaxyGenerationSystem · GalaxyGenerator · AimRaySystem
                   PawnOrientationSystem · RemotePlayerSystem · NotificationDroneSystem
    ↓
[ physics ]        CelestialPhysicsSystem
    ↓
[ streaming ]      SpatialIndexSystem · LODManager
    ↓
[ render ]         HandInteractionSystem · RenderPipeline.render()
    ↓
[ post-navigation] HUDManager · EngineDebugPanel · LULUControlPanel
    ↓
[ ui ]             LULUResponsePanel
    ↓
[ window ]         WindowManager
    ↓
[ network ]        WebsocketBridgeSystem · RemotePlayerSystem
    ↓
[ ai ]             NotificationDroneSystem
```

> ⚠ REGLA CRÍTICA: Navigation NUNCA corre antes de Input. Render NUNCA corre antes de Simulation.
> El orden aquí es ley. FrameScheduler.PHASE_ORDER es el contrato.

---

## 1. KERNEL ROOT

```
UniverseKernel                         ✅
│
├── ServiceRegistry                    ✅  singleton global (Registry.get/register)
├── EventBus                           ✅  bus desacoplado (events.emit/on)
├── FrameScheduler                     ✅  14 fases ordenadas — la ley del loop
├── BootGraphDebugger                  ✅  resolución de dependencias en boot
├── EntityManager (ECS)                ✅  world.createEntity / Component / System
├── ResourceManager                    🔮  gestión de assets con ref-counting
└── Clock                              ✅  capped delta ≤ 0.1s
```

**Responsabilidades:**
- Ciclo del engine (engineLoop → scheduler.update → renderPipeline.render)
- Registro y lifecycle de todos los sistemas
- Boot ordenado (12 fases)
- Mounting de UI

---

## 2. CORE SYSTEMS

```
ServiceRegistry                        ✅
    ↓
EventBus                               ✅
    ↓
EntityManager                          ✅
    ↓
UniverseStateManager                   🔮
    ↓
ResourceManager                        🔮
```

**Responsabilidades:**
- Inyección de dependencias (ServiceRegistry como Service Locator)
- Eventos globales desacoplados (EventBus)
- Estado del universo centralizado
- Gestión de assets y recursos

---

## 3. INPUT GRAPH

```
DOM events (window)
    ↓
InputStateSystem                       ✅  HAL unificado — ÚNICA fuente de verdad
├── keyboard.held  (Set<code>)
├── mouse.dx / dy
├── pointer.locked
├── scroll.dy
├── isKey(code)
├── getLookDX() / getLookDY()
└── getSpeedTier()  →  1.0 · 4.0(Shift)

InputController                        🔮  abstracción de gamepads / touch
InteractionStrategy                    🔮  estrategia por contexto (FPS/Orbit/UI)
```

**Captura:** mouse · keyboard · pointer lock · touch · scroll
**Resultado:** InputState estructurado por frame

> ⚠ DEPRECATED: SpatialInputSystem — no usar, shim legado

---

## 4. INTERACTION GRAPH

```
InteractionStrategy                    🔮
    ↓
RaycastSelectionSystem                 ✅  Raycaster (far=50000), mousemove, contextmenu
    ↓
InteractionEventSystem                 ✅  OBJECT_SELECTED → PLANET_SELECTED / WARP_FLIGHT_COMPLETE
    ↓
HUDInteractionSystem                   ✅  pasa hover/focus a HUDManager
    ↓
SpatialGestureSystem                   🔮  gestos multi-punto
    ↓
WorldInteractionSystem                 🔮  manipulación de objetos 3D
```

**Responsabilidades:**
- Raycasting sobre SceneGraph.layers.systems
- Selección de objetos (planetas, estrellas, drones, satélites)
- Triggers de apps via `WARP_FLIGHT_COMPLETE`
- Hover visual (crosshair activo en todos los estados excepto WARP)

---

## 5. NAVIGATION GRAPH

```
UniverseNavigationSystem               ✅
├── CameraStateMachine (FSM)           ✅
│   ├── FREE_FLIGHT                    ✅  WASD + mouse look (cenital boot: Y=11000)
│   ├── ORBIT                          ✅  órbita quaternion alrededor de focusTarget
│   ├── FOCUS                          ✅  acercamiento + UI de app
│   └── WARP                           ✅  vuelo cinemático GSAP + FOV stretch
│
├── CameraRig                          ✅  posición/quaternion autoritativo
│   └── THREE.Camera                   ✅  copia del rig cada frame
│
├── ThirdPersonCameraSystem            ✅  modo TPS para pawns
├── FloatingOriginSystem               ✅  recentra origen (escala infinita)
├── RelativeFrameSystem                🔮  transformación de frames de referencia
└── TrackballControls (godControls)    ⚠  solo activo en WORLD_FOCUS legacy

Transiciones válidas:
FREE_FLIGHT ↔ ORBIT ↔ FOCUS ↔ WARP
```

**Controles FREE_FLIGHT:**
```
WASD / Flechas  → traslación
Space / Q       → subir
Ctrl / E        → bajar
Shift           → turbo ×4
Click + drag    → mouse look
ESC             → fsm.back() → estado anterior
```

---

## 6. SIMULATION GRAPH

```
UniverseSimulationLayer                ⚠  wrapper parcial
    ↓
CelestialRegistry                      ✅  mapa de cuerpos celestes
    ↓
CelestialPhysicsSystem                 ✅  Semi-Implicit Euler · G=0.1 · Keplerian
    ↓
GravitySystem                          🔮  interacción N-cuerpos
    ↓
OrbitalMechanicsSystem                 🔮  elementos orbitales (a, e, i, Ω, ω, ν)
```

**CelestialPhysicsSystem (real):**
```
registerOrbit(node, speed)   ← llamado por GalaxyGenerator
update(delta):
    rVector = body.position
    a = -G·M / r²              (Newton universal)
    v += a · Δt                (Semi-Implicit Euler)
    p += v · Δt
```

**Responsabilidades:**
- Física orbital determinista
- Movimiento jerárquico (pivot → planeta → luna)
- Pausa en modo mapa

---

## 7. UNIVERSE GENERATION

```
GalaxyGenerator.buildAsync()           ✅
├── createStarfield()                  ✅  THREE.Points · 50k-70k stars · background layer
└── createHierarchicalSolarSystem()    ✅
    ├── MegaSun (r=40, emissive)       ✅
    ├── Planets (hasta 40)             ✅  con lunas y satélites de configuración
    └── MetamorphSun (binario)         ✅

GalaxyGenerationSystem                 ✅
├── _build(80000)                      ✅  BufferGeometry + Points · 1 draw call
│   ├── 5 brazos espirales logarítmicos
│   ├── distribución exponencial (núcleo denso → borde disperso)
│   └── ColorGrading: blanco→azul→amarillo→rojo
└── update(delta)                      ✅  rotación lenta (0.00005 rad/frame)

StarClusterSystem                      🔮  clústeres estelares secundarios
SolarSystemGenerator                   🔮  sistemas solares múltiples
PlanetGenerator                        🔮  generación procedural avanzada de planetas
AsteroidBeltSystem                     🔮  cinturones de asteroides
```

---

## 8. STREAMING GRAPH

```
SpatialIndexSystem                     ⚠  índice espacial inicializado
    ↓
UniverseStreamer                        ✅  streaming por movimiento de cámara
    ↓
LODManager                             ⚠  reservado
    ↓
SectorManager                          🔮  sectores de universo infinito
```

**Responsabilidades:**
- Cargar sectores bajo demanda
- Nivel de detalle (LOD) por distancia
- Streaming infinito sin teletransporte

---

## 9. RENDER GRAPH

```
SceneGraph                             ✅
├── layers.background  → starfield Points (no raycasting)
├── layers.systems     → planetas, sol, lunas, drones (raycasting activo)
└── layers.overlay     → efectos, UI 3D

RenderPipeline                         ✅
├── _guardScene()      → debug star si escena vacía
├── cameraSystem?.sync()
└── renderer.render(scene, camera)

THREE.WebGLRenderer                    ✅
├── clearColor: 0x000008 (azul espacial profundo)
├── pixelRatio: devicePixelRatio
├── size: window.innerWidth × window.innerHeight
└── far plane: 50000

InstancedRenderSystem                  ✅  GalaxyGenerationSystem (80k stars, 1 draw call)
PlanetRenderer                         ⚠  MeshStandardMaterial básico
AtmosphereRenderer                     🔮  shader de atmósfera volumétrica
```

---

## 10. UI GRAPH

```
HUDManager (#hud-layer)                ✅
├── Telemetría: FPS · draw calls · frame
├── spatial-reticle      → crosshair adaptativo
├── spatial-target-marker → brackets 3D proyectados
├── spatial-target-card   → info de masa (distancia, clase)
├── stelaryi-launcher     → Modo Estelaryi
└── solar-launcher        → Modo Sistema Solar

InitialMenu                            ✅
├── POWDERTRUE 🔐 (contraseña: milulu)
├── ARTISTAS · CLIENTES · PUBLICO · FONDO VIVO · SALIR
└── pointerup + guard _selecting (no double-fire)

EngineDebugPanel                       ✅  overlay bottom-left
KernelBarSystem (#kernel-bar)          ✅  dock OS con 6 apps
LULUControlPanel                       ✅
LULUResponsePanel                      ✅
SpatialTelemetrySystem                 🔮  telemetría espacial avanzada
```

---

## 11. WINDOW SYSTEM GRAPH

```
WindowManager                          ✅
    ↓
WindowDOMSystem                        ✅  crea/destruye ventanas DOM
    ↓
WindowBridgeSystem                     ✅  puente eventos window ↔ engine
    ↓
Window3DSystem                         🔮  ventanas ancladas en espacio 3D
    ↓
WorkspaceManager                       ✅  tiling layout / mission control (F3)

Apps (KernelBarSystem):
Terminal · Explorador · Galería · Base de datos · Holograma · Ajustes
```

**Trigger de apertura:** `WARP_FLIGHT_COMPLETE` → `WindowManager.open(appId)`

---

## 12. NETWORK GRAPH

```
UniverseSocketClient                   ✅  WebSocket → backend:4000
    ↓
WebsocketBridgeSystem                  ✅  sincroniza estado del universo
    ↓
RemotePlayerSystem                     ✅  renderiza jugadores remotos en SceneGraph
    ↓
Backend API (node backend/server.js)   ✅

Multiplayer futuro:                    🔮
├── UniverseStateSync
├── PlayerPositionBroadcast
└── SharedPhysicsConsensus
```

---

## GRAPH FINAL COMPLETO

```
UniverseKernel
│
├── [ 1 ] Core Systems
│         ServiceRegistry · EventBus · EntityManager · ResourceManager
│
├── [ 2 ] Input Systems
│         InputStateSystem → InputController → InteractionStrategy
│
├── [ 3 ] Interaction Systems
│         RaycastSelectionSystem → InteractionEventSystem → SpatialGestureSystem
│
├── [ 4 ] Navigation Systems
│         UniverseNavigationSystem (FSM) → CameraRig → FloatingOriginSystem
│
├── [ 5 ] Simulation Systems
│         CelestialPhysicsSystem → GalaxyGenerator → GalaxyGenerationSystem
│
├── [ 6 ] Streaming Systems
│         SpatialIndexSystem → UniverseStreamer → LODManager
│
├── [ 7 ] Rendering Systems
│         SceneGraph → RenderPipeline → THREE.WebGLRenderer
│
├── [ 8 ] UI Systems
│         HUDManager · InitialMenu · KernelBarSystem · LULU Suite
│
├── [ 9 ] Window Systems
│         WindowManager · WindowDOMSystem · WorkspaceManager
│
└── [10 ] Network Systems
          UniverseSocketClient · WebsocketBridgeSystem · RemotePlayerSystem
```

---

## SERVICE REGISTRY — SINGLETONS ACTIVOS

| Key | Sistema | Estado |
|---|---|---|
| `kernel` | UniverseKernel | ✅ |
| `registry` | BootGraphDebugger | ✅ |
| `events` | EventBus | ✅ |
| `EntityManager` | EntityManager | ✅ |
| `CelestialRegistry` | CelestialRegistry | ✅ |
| `AnimationEngine` | AnimationEngine | ✅ |
| `scheduler` | FrameScheduler | ✅ |
| `bootGraph` | BootGraphVisualizer | ✅ |
| `camera` | THREE.PerspectiveCamera | ✅ |
| `cameraRig` | CameraRig | ✅ |
| `InputStateSystem` | InputStateSystem | ✅ |
| `WindowManager` | WindowManager | ✅ |
| `socket` | UniverseSocketClient | ✅ |
| `HandInteractionSystem` | HandInteractionSystem | ✅ |
| `GameMenuSystem` | GameMenuSystem | ✅ |
| `luluSpawner` | LULUSpatialObjectSpawnerSystem | ✅ |
| `WorkspaceManager` | WorkspaceManager | ✅ |
| `Orquestador` | Orquestador | ✅ |

---

## DIAGNÓSTICO — LULU

| Síntoma | Sistema sospechoso | Comando de diagnóstico |
|---|---|---|
| Pantalla negra | SceneGraph vacío | `window.engine.physicsSystem.orbitalNodes.length` |
| WASD no funciona | InputStateSystem no registrado | `Registry.get('InputStateSystem')` |
| Planetas quietos | Double-tick en physics | `scheduler.buckets.get('physics').length` > 1 |
| Sin crosshair | RaycastSelectionSystem no habilitado | `engine.raycastSelectionSystem.isEnabled` |
| Ventanas no abren | InteractionEventSystem | `events.listeners('OBJECT_SELECTED').length` |
| FSM spam | Self-transition sin force | Ya silenciado — ignorar |

---

## PRINCIPIO DE DISEÑO

> El engine es un ecosistema vivo.
> Los sistemas son constelaciones.
> El kernel es el centro gravitacional.
> El universo es la interfaz.
> LULU es la inteligencia que lo habita.