# 🛰️ POWDER GALAXY — OMEGA V31 RECON REPORT
> Sonda de reconocimiento completa. Generada el 2026-04-10.  
> **211 archivos JS · 1,474 KB de código de motor · 26+ documentos de arquitectura**

---

## 🗺️ PLANO GENERAL DEL UNIVERSO

```
Powder_Galaxy/
├── frontend/src/engine/          ← NÚCLEO DEL MOTOR (1,474 KB, 211 archivos)
│   ├── UniverseKernel.js         ← 45.5 KB | Orquestador central (Boot 7 fases)
│   ├── core/                     ← ServiceRegistry, FrameScheduler, EventBus
│   ├── navigation/               ← CameraSystem, FloatingOrigin, FSM
│   ├── rendering/                ← Pipeline WebGL, Shaders, PostProcess
│   ├── planet/                   ← QuadTree, TerrainPool, Workers
│   ├── universe/                 ← GalaxyGen, Streaming, PlanetBuilder
│   ├── interaction/              ← Raycast, Scanning, SpatialManager
│   ├── systems/                  ← Cosmos, Warp, MacroWarp, Particles
│   ├── ui/                       ← LULU, Windows, HUD, Telemetry
│   └── physics/                  ← OrbitalMechanics, Landing
├── UNIVERSE_LAWS.md              ← 26 KB | LEY SUPREMA (19 leyes formalizadas)
├── SYSTEM_GRAPH.md               ← 13.8 KB | Grafo de dependencias
├── PHYSICS_CONSTANTS.md          ← 5.3 KB | Constantes del motor
├── RENDERING_PIPELINE.md         ← 4.8 KB | Especificación GPU
├── RULE_1_ARCHITECTURE.md        ← 7.6 KB | Ley #1 del motor
├── progress.md                   ← 75 KB | Diario de desarrollo
└── tools/                        ← zero-gc-lint, kernel-config, quarantine
```

---

## ⚙️ SISTEMA 1: KERNEL DE ARRANQUE (`UniverseKernel.js`)

**Tamaño:** 45.5 KB | **Estado:** ✅ ESTABLE  
**Función:** Orquestador de las 7 fases de boot. Registra todos los sistemas en el ServiceRegistry y congela el kernel.

### Fases de Boot (BootGraph):
| Fase | Sistemas registrados |
|------|---------------------|
| CORE | Camera, CameraRig, EventBus, RuntimeState, RuntimeSignals |
| RENDERING | Renderer, SceneGraph, RenderPipeline, CosmicBackground |
| SIMULATION | UniverseStreamer, GalaxyGenerator, PlanetBuilder |
| PHYSICS | OrbitalMechanics, LandingPhysics, FloatingOrigin |
| NAVIGATION | CameraSystem, InputStateSystem, RaycastSelection |
| UI | LULU, WindowManager, HUD, TargetTracking |
| POST | Registry.freeze() |

### ⚠️ Debilidades detectadas:
- `UniverseKernel.js` tiene **45.5 KB** — demasiado grande para un orquestador. Candidato a split en fases separadas.
- `createPlanet('TestWorld')` está hardcodeado. Debería venir de `UniverseSpec.js`.
- Cámara spawna en `Y=11000` hardcodeado — debería ser configurable por perfil de usuario.

---

## ⚙️ SISTEMA 2: SERVICE REGISTRY (`core/ServiceRegistry.js`)

**Estado:** ✅ ESTABLE — Kernel inmutable post-freeze  
**Patrón:** Singleton congelado después de `Registry.freeze()` en fase POST.

### Reglas:
- `Registry.register(key, value)` — antes del freeze
- `Registry.get(key)` — siempre disponible (lanza si no existe)
- `Registry.tryGet(key)` — null-safe, para sistemas opcionales
- `Registry.freeze()` — inmutabiliza el kernel

### ⚠️ Debilidades:
- Múltiples sistemas registran **claves duplicadas** (PascalCase y camelCase):
  ```js
  Registry.register('PlanetShaderSystem', ...)
  Registry.register('planetShaderSystem', ...)  // redundante
  ```
  Esto duplica 18+ entradas. Debería normalizarse con una convención única.

---

## ⚙️ SISTEMA 3: FRAME SCHEDULER (`core/FrameScheduler.js`)

**Estado:** ✅ ESTABLE  
**Fases en orden canónico:**
```
input → interaction → navigation → pre-simulation → simulation 
→ physics → streaming → render → post-navigation → ui → window → network → ai → post-render
```

### ✅ Correcto:
- `physics` ejecuta antes de `post-navigation` (FloatingOriginSystem)
- `input` es siempre primero

### ⚠️ Debilidades:
- No hay sistema de **prioridad dentro de cada fase** — el orden depende del orden de `register()`
- No hay **profiling por sistema** — solo tiempo total por frame

---

## ⚙️ SISTEMA 4: RENDERIZADO ATMOSFÉRICO (`PlanetShaderSystem.js`)

**Tamaño:** 13.8 KB | **Estado:** 🔧 EN CALIBRACIÓN  
**Algoritmo:** Raymarching de Dispersión Rayleigh/Mie (8 pasos + 4 luz)

### Arquitectura del shader:
```glsl
// Vertex: cube-face → world space → vWorldPosition
// Fragment: raySphereIntersect → marchas → phase → tonemapping → output

color = 1.0 - exp(-22.0 * color)        // tone map [0,+inf) → [0,1)
alpha = clamp(length(color) * 0.9, 0, 1) // densidad óptica
gl_FragColor = vec4(color, alpha)         // NUNCA > 1.0
```

### Culling Switch dinámico (en `PlanetBuilderSystem.js`):
```js
distSq < atmoRadiusSq → BackSide  // dentro: cielo envuelve al jugador
distSq ≥ atmoRadiusSq → FrontSide // fuera: Z-buffer descarta interior → FPS
// needsUpdate=true SOLO en el frame de transición
```

### ⚠️ Debilidades:
- `PlanetShaderSystem.js` también tiene `PlanetAtmosphereShader.js` duplicado en `/shaders/` — código de atmósfera existe en dos lugares
- La variable `ug` (Mie asymmetry) no está expuesta como uniform — hardcodeada en GLSL como `0.7`
- `uSunPosition` es hardcoded en `(1,0,0)` normalizado — no conectado al `CelestialRegistry`

---

## ⚙️ SISTEMA 5: QUADTREE SPHERE + TERRAIN POOL

### `QuadTreeSphere.js`
**Estado:** ✅ ESTABLE (Zero-GC compliant post-fix)  
- 6 caras del cubo, cada una con un `QuadTreeNode` raíz
- Split/merge adaptivo por distancia cámara-nodo
- Buffers pre-alocados: no `new THREE.Vector3()` en loops

### `TerrainChunkPool.js`  
**Estado:** ✅ ESTABLE post-fix  
- 1000 `PlaneGeometry(1,1,64,64)` pre-alocados
- **Layer 1** asignado → RaycastSelectionSystem (Layer 0) los ignora
- Transferencia Zero-Copy al `TerrainWorker` via `postMessage + Transferable`

### `TerrainWorker.js`
**Estado:** ✅ ESTABLE post-fix  
- `mapCubeToSphere` con clamp `[-1, 1]` (evita `sqrt(-x)` → NaN)
- `isFinite` guard en elevación
- `skirtDepth = radius * 0.003` (no 300u fijos)

### ⚠️ Debilidades:
- Pool de **1000 chunks** con `PlaneGeometry(1,1,64,64)` = ~52 MB de VRAM pre-alocados. En hardware de gama media puede causar OOM.
- `this.segments = 64` hardcodeado. Para LOD extremo (chunks muy lejanos) se desperdician ~4000 vértices por chunk.

---

## ⚙️ SISTEMA 6: FLOATING ORIGIN (`FloatingOriginSystem.js`)

**Estado:** ✅ ESTABLE  
**Umbral:** 5000u desde el origen  
**Activación:** Solo cuando `isActive = true` (gateado por evento `LANDING:TELEMETRY`)

### Mecanismo:
```js
// Solo en modo planetario activo
if (!this.isActive) return;
camera.getWorldPosition(worldPos);
if (worldPos.lengthSq() > THRESHOLD_SQ) {
    // Shift: mover universeLayer en sentido opuesto
    universeLayer.position.sub(worldPos);
    camera.position.set(0, 0, 0);
}
```

### ⚠️ Debilidades:
- No conectado al `UniverseStreamer` — cuando ocurre un shift, el streamer no recalcula sectores
- `isActive` se activa pero nunca se desactiva explícitamente al salir del modo landing

---

## ⚙️ SISTEMA 7: LANDING PHYSICS (`LandingPhysicsSystem.js`)

**Estado:** ✅ ESTABLE post-fix  
- Usa `getWorldPosition()` para todos los cálculos de distancia (post-rubberbanding fix)
- Anti-tunneling via raycasting inverso
- Camera alignment al terreno: Zero-GC con buffers estáticos

### ⚠️ Debilidades:
- La detección de colisión es analítica (`evaluateTerrain()`) pero no usa el mismo noise seed que el `TerrainWorker` en algunos paths → posible micro-discrepancia de 0.1u

---

## ⚙️ SISTEMA 8: GALACTIC RENDERER

### Componentes:
| Archivo | Función |
|---------|---------|
| `GalaxyGenerator.js` (24 KB) | Genera 100K+ puntos de estrellas, brazos espirales |
| `GalaxyRenderer.js` (3.7 KB) | Renderiza la nube de estrellas galáctica |
| `CosmicBackgroundSystem.js` (10.3 KB) | Estrellas de fondo, nebulosa GLSL, twinkle |
| `StarfieldSystem.js` (3.6 KB) | Sistema alternativo de starfield |
| `DynamicStarLODSystem.js` (1.7 KB) | LOD para estrellas individuales |

### ⚠️ **DUPLICACIÓN CRÍTICA**:
Hay **4 sistemas de estrellas** distintos:
1. `CosmicBackgroundSystem` — estrellas bokeh con twinkle (activo)
2. `StarfieldSystem` — sistema alternativo (¿activo?)
3. `GalaxyRenderer` — nube galáctica (activo)
4. `DynamicStarLODSystem` — LOD individual (¿activo?)

Además, `/rendering/stars/` tiene:
- `StarDistribution.js`, `StarLODSystem.js`, `StarMeshSystem.js`, `StarParticleSystem.js`, `StarSpriteSystem.js`

**→ Al menos 3-4 sistemas de estrellas están en estado zombie (importados pero no conectados al FrameScheduler).**

---

## ⚙️ SISTEMA 9: SPATIAL INDEX (TRIPLICADO 🚨)

```
frontend/src/engine/rendering/SpatialIndexSystem.js    ← 4.0 KB
frontend/src/engine/simulation/SpatialIndexSystem.js   ← 0.9 KB
frontend/src/engine/spatial/SpatialIndexSystem.js      ← 1.8 KB
frontend/src/engine/streaming/SpatialIndexSystem.js    ← 2.8 KB
```

**→ `SpatialIndexSystem` existe en 4 directorios distintos con implementaciones diferentes. Esto es deuda técnica crítica P1.**

---

## ⚙️ SISTEMA 10: LULU — INTELIGENCIA ORBITAL

### Stack LULU:
| Archivo | Función | Tamaño |
|---------|---------|--------|
| `LULUCommandProcessor.js` | Enrutador de comandos (17 handlers) | 25.7 KB |
| `LULUWisdom.js` | Base de conocimiento (44 entradas científicas) | 28.6 KB |
| `LULUCanon.js` | Telemetría del universo, rutas de docs | 11.1 KB |
| `LULUSpatialObjectSpawnerSystem.js` | Spawn de objetos 3D | **46.9 KB** |
| `LULUMindMapWindow.js` | Visualizador de topología | 39.6 KB |
| `LULUCommandRegistry.js` | Paleta de comandos registrados | 7.9 KB |
| `LULUResponsePanel.js` | UI de respuestas | 14.0 KB |
| `LULUVoiceEngine.js` | TTS (Helena ES) | 4.6 KB |
| `LULUContextualHUD.js` | HUD contextual | 4.3 KB |
| `LULUManualSystem.js` | Manual interactivo | 6.5 KB |

### Cobertura de sabiduría actual (44 entradas):
- **Física:** 13 nodos (Newton, Cuántica, Relatividad, Termodinámica...)
- **Biología:** 8 nodos (Darwin, Mendel, ADN, Dogma Central...)
- **Matemáticas:** 7 nodos (ZF, Axioma de Elección, Continuum...)
- **Psicología/Neurociencia:** 7 nodos (Consciencia, IIT, Orch-OR...)
- **Lógica:** 2 nodos
- **Economía/Sociología:** 2 nodos
- **Ética/Filosofía:** 1 nodo

### ⚠️ Gaps en sabiduría (no cubiertos):
- **Programación gráfica (GLSL, WebGL, Three.js)** — LULU no conoce su propio motor
- **Arquitectura del motor OMEGA V31** — no puede responder preguntas sobre sus sistemas
- **Historia de la IA y LLMs** — sin nodos
- **Astrofísica práctica** (tipos estelares, vida de estrellas, fusión nuclear)
- **Mecánica orbital real** (Kepler, Hohmann transfers)

---

## ⚙️ SISTEMA 11: PIPELINE DE RENDERS

```
RenderPipeline.js (6.2 KB)
└── CoreRenderPass.js          ← Render base Three.js
└── PostProcessPass.js (12 KB) ← Bloom, FXAA, tonemap
└── DOMOcclusionPass.js        ← Detección DOM sobre escena
└── HolographicOverridePass.js ← Materiales holográficos
└── SpatialOptimizationPass.js ← Frustum + oclusión
```

### ⚠️ Debilidades:
- `PostProcessPass.js` (12 KB) maneja Bloom, FXAA y tonemap en un solo archivo
- El tonemapping del PostProcess puede entrar en conflicto con el tonemapping interno del shader de atmósfera

---

## 🚨 INVENTARIO DE DUPLICACIONES (P0/P1)

| Elemento duplicado | Archivos | Severidad |
|---|---|---|
| `SpatialIndexSystem` | 4 versiones en 4 directorios | **P0 🔴** |
| Sistemas de estrellas | CosmicBackground + StarfieldSystem + 5 en `/stars/` | **P1 🟠** |
| Shader atmósfera | PlanetShaderSystem + PlanetAtmosphereShader.js | **P1 🟠** |
| `CelestialOrbitSystem` | `/ui/CelestialOrbitSystem.js` + `/universe/CelestialOrbitSystem.js` | **P1 🟠** |
| Registro doble-clave | 18+ pares PascalCase/camelCase en Registry | **P2 🟡** |
| `createPlanet` scope | UniverseKernel + PlanetBuilderSystem | **P2 🟡** |

---

## 🔴 CÓDIGO ZOMBIE / DESCONECTADO

Los siguientes archivos existen pero **no están registrados en el FrameScheduler** ni importados en el boot:

```
rendering/stars/StarDistribution.js       ← zombie
rendering/stars/StarMeshSystem.js         ← zombie
rendering/stars/StarParticleSystem.js     ← zombie
rendering/stars/StarSpriteSystem.js       ← zombie
rendering/InstancedRenderSystem.js        ← zombie
simulation/GalaxySimulation.js            ← zombie
spatial/SpatialHashGrid.js                ← posible zombie
universe/planets/BiomeSystem.js           ← zombie (biomes via shader)
universe/planets/CloudSystem.js           ← zombie
universe/planets/PlanetBlueprintSystem.js ← zombie
universe/planets/TerrainSystem.js         ← zombie
```

---

## 📊 MÉTRICAS DEL MOTOR

| Métrica | Valor |
|---------|-------|
| Archivos JS del motor | 211 |
| Tamaño total | 1,474 KB |
| Archivo más grande | `LULUSpatialObjectSpawnerSystem.js` (46.9 KB) |
| Segundo más grande | `UniverseKernel.js` (45.5 KB) |
| Entradas de sabiduría LULU | 44 |
| Documentos de arquitectura | 6 (UNIVERSE_LAWS, SYSTEM_GRAPH, PHYSICS_CONSTANTS, etc.) |
| Fases de boot | 7 |
| Sistemas del FrameScheduler | ~31 activos |

---

## 🛠️ ROADMAP DE PURGA RECOMENDADO

### Fase 1 — Purga Inmediata (1-2h)
- [ ] Eliminar 3 de los 4 `SpatialIndexSystem` duplicados, consolidar en uno canónico
- [ ] Eliminar los 4 archivos zombie de `/rendering/stars/`
- [ ] Eliminar `BiomeSystem.js`, `CloudSystem.js`, `PlanetBlueprintSystem.js`, `TerrainSystem.js` zombie

### Fase 2 — Consolidación (1 día)
- [ ] Unificar `PlanetShaderSystem.js` con `PlanetAtmosphereShader.js` en un solo archivo
- [ ] Unificar `CelestialOrbitSystem` (2 archivos → 1)
- [ ] Normalizar claves del Registry a camelCase único

### Fase 3 — Expansión de LULU (ongoing)
- [ ] Añadir sabiduría sobre el motor OMEGA V31
- [ ] Añadir astrofísica (tipos estelares, fusión, Hertzsprung-Russell)
- [ ] Añadir mecánica orbital real (Kepler, Hohmann)
- [ ] Añadir renderizado gráfico (Rayleigh, PBR, Raymarching)

---

## 🌌 LEYES FUNDAMENTALES DEL MOTOR (UNIVERSE_LAWS.md)

19 leyes activas formalizadas:
1. **Ley del Origen Supra** — El origen (0,0,0) pertenece a SupraconsciousnessMass
2. **Ley del Punto Flotante** — FloatingOriginSystem activo en vuelo planetario
3. **Ley Zero-GC** — Sin `new` en loops de render
4. **Ley del BootGraph** — 7 fases estrictas deterministas
5. **Ley del Registry Inmutable** — freeze() post-boot
6. **Ley del FrameScheduler** — PHASE_ORDER es ley, no sugerencia
7. **Ley de la Física Dual** — RK4 para órbitas, Zero-GC para colisiones
8. **Ley del Layer de Terreno** — Layer 1 exclusivo para chunks
9. **Ley del Worker** — TerrainWorker posee los buffers durante el cómputo
10. **Ley del Shader Estable** — gl_FragColor en [0,1] siempre
...y 9 más en UNIVERSE_LAWS.md

---

*Reporte generado por Antigravity — Sonda OMEGA V31 · 2026-04-10*
