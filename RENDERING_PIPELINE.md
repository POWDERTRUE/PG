# RENDERING PIPELINE — Powder Galaxy Engine
> Motor de renderizado OMEGA V30  
> Stack: Three.js r183 · PostProcessing v6 · WebGL 2.0  
> Actualizado: 2026-03-23

---

## 🖥️ Stack de Renderizado

```
WebGL 2.0 Context
└── THREE.WebGLRenderer
    ├── Scene
    │   ├── SceneGraph.layers
    │   │   ├── background  (galaxy stars — Points)
    │   │   ├── systems     (solar system — Meshes)
    │   │   └── ui          (spatial UI — Sprites)
    │   └── Direct scene children (streaming sectors)
    ├── EffectComposer (postprocessing@6)
    │   ├── RenderPass
    │   ├── BloomEffect (selective, threshold 0.8)
    │   ├── ToneMappingEffect (ACES Filmic)
    │   └── FXAAEffect
    └── Camera (PerspectiveCamera fov:55–100)
```

---

## 📦 Dependencias Instaladas

| Paquete | Versión | Uso |
|---------|---------|-----|
| `three` | 0.183.2 | Motor 3D core |
| `gsap` | 3.14.2 | Animaciones cinematográficas |
| `postprocessing` | 6.39.0 | Bloom, tone mapping, FXAA |
| `lil-gui` | 0.21.0 | Debug panel en tiempo real |
| `stats.js` | 0.17.0 | Monitor FPS / memoria |

---

## ⚡ FrameScheduler — Fases de Actualización

El engine ejecuta 14 fases en orden por frame:

```
Frame N
│
├─ [01] input           InputStateSystem
├─ [02] interaction     RaycastSelectionSystem, HUDInteractionSystem  
├─ [03] navigation      UniverseNavigationSystem, CameraFSM
├─ [04] pre-simulation  (reservado: validación de colisiones pendientes)
├─ [05] simulation      CelestialPhysicsSystem (Semi-Implicit Euler)
├─ [06] physics         FloatingOriginSystem (evita Z-fighting a distancias grandes)
├─ [07] streaming       UniverseStreamingSystem (carga/descarga de sectores)
├─ [08] render          RenderPipeline → EffectComposer → screen
├─ [09] post-navigation (historial de cámara, snap targets)
├─ [10] ui              HUDManager, WindowManager.tick()
├─ [11] window          WindowDOMSystem sync
├─ [12] network         WebsocketBridgeSystem, RemotePlayerSystem
├─ [13] ai              (reservado: NPC/procedural content)
└─ [14] post-render     SystemHealthMonitor, telemetría
```

---

## 🎨 Draw Calls Presupuesto

| Sistema | Draw Calls | Tipo |
|---------|------------|------|
| GalaxyField Main | 1 | `Points` 120k stars |
| GlobularClusters | 1 | `Points` 7k stars |
| OpenClusters | 1 | `Points` 5.4k stars |
| EmissionNebulae | 1 | `Points` AdditiveBlending |
| ReflectionNebulae | 1 | `Points` AdditiveBlending |
| PlanetaryNebulae | 1 | `Points` AdditiveBlending |
| Streaming Sectors | ≤25 | `Points` 2.4k cada uno |
| Sun | 1 | `Mesh` SphereGeometry |
| Planets (6) | 6 | `Mesh` PlanetShaderSystem |
| Atmospheres (6) | 6 | `Mesh` ShaderMaterial+Additive |
| Planet Rings (1) | 1 | `Mesh` RingGeometry |
| Moons (≤18) | 18 | `Mesh` SphereGeometry |
| **TOTAL** | **~64** | **Target: <100** |

---

## 🌟 Efectos Post-Proceso

### Bloom (estrella + planetas)
```js
BloomEffect({
  luminanceThreshold: 0.8,   // solo objetos muy brillantes
  luminanceSmoothing: 0.2,
  intensity: 1.4,
  radius: 0.7
})
```
> Hace que el sol, el núcleo galáctico y las atmósferas de planetas brillen.

### Tone Mapping (ACES Filmic)
```js
ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
```
> Mapeo de colores cinematográfico, mismo que se usa en cine realista.

### FXAA (Anti-aliasing)
```js
FXAAEffect()
```
> Anti-aliasing de bajo costo, suaviza bordes de planetas y UI.

---

## 🎯 Targets de Rendimiento

| Métrica | Target | Crítico |
|---------|--------|---------|
| FPS | 60fps constante | < 30fps = problema |
| Draw Calls | < 100 | > 200 = problema |
| Stars visible | 160k | > 500k = WebGL límite |
| Geometry MB | < 50 MB | > 200 MB = problema |
| VRAM | < 512 MB | > 2 GB = problema |

---

## 🔧 Debug en tiempo real

### Stats.js (FPS overlay)
```js
import Stats from 'stats.js';
const stats = new Stats();
document.body.appendChild(stats.dom);
// En render loop:
stats.begin(); renderer.render(scene, camera); stats.end();
```

### Lil-GUI (panel de parámetros)
```js
import GUI from 'lil-gui';
const gui = new GUI();
gui.add(galaxy.material, 'size', 0.5, 8).name('Star Size');
gui.add(bloomEffect, 'intensity', 0, 5).name('Bloom');
```

### Consola de telemetría
```js
window.PG_DEBUG = {
  printStats: () => console.table({
    sectors: engine.sectorStreamingSystem?.loadedSectorCount,
    orbits: engine.physicsSystem?.orbitalNodes.length,
    state: engine.navigationSystem?.state,
    drawCalls: engine.renderer?.info.render.calls,
    triangles: engine.renderer?.info.render.triangles,
  })
};
// Uso: PG_DEBUG.printStats()
```
