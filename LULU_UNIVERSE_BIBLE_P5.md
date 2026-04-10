# 📜 BIBLIA DEL UNIVERSO — POWDER GALAXY
## Parte 5: Sector Streaming, LOD y Optimización de Rendimiento
> Motor OMEGA V30 · 2026-03-23  
> Esta parte cubre todo lo relacionado con mantener 60fps en un universo infinito.

---

## 🌀 1. EL PROBLEMA DEL UNIVERSO INFINITO

### Por qué no se puede renderizar todo
```
Un universo infinito contiene infinitas estrellas.
Renderizar todas = imposible.

La solución tiene DOS componentes:

1. LEVEL OF DETAIL (LOD) — qué tan detallado renderizas lo que VES
2. SECTOR STREAMING     — qué cargas/descargas según la posición
```

### El presupuesto de rendimiento
```
Target:          60 FPS constante
Frame budget:    16.67ms por frame

Desglose:
  JavaScript:    ≤ 4ms   (update, physics, streaming)
  GPU draw:      ≤ 8ms   (render, shaders, post-process)
  Driver/swap:   ≤ 2ms
  TOTAL:         14ms    (2.67ms margen)

Si JS > 4ms → use Workers o reduce tick rate
Si GPU > 8ms → reduce draw calls o star count
```

---

## 🔢 2. NIVEL DE DETALLE (LOD) — Algoritmo

### LOD visual para estrellas
```
La idea: puntos más grandes de lejos para compensar pérdida de brillo

distancia > 5000u → point.size = 1.2  (grandes para ver la galaxia)
distancia > 1500u → point.size = 1.8
distancia > 500u  → point.size = 2.8
distancia < 500u  → point.size = 4.5  (dentro del sistema solar)
```

### Ecuación de tamaño angular
```
Para que un objeto mantenga el mismo tamaño visual:
  size_pixel = world_size / distance * focal_length

Para compensar opacidad:
  apparent_brightness = (size_world / distance)²
  
Al doble de distancia:
  brillo cae 4×
  → necesitas 2× más tamaño de punto para compensar
```

### LOD en el engine — fórmula suave
```js
// Lerp suave entre tamaños (evita pop instantáneo)
const currentSize = this.mat.size;
const targetSize  = lookupLODSize(cameraDistance);
this.mat.size += (targetSize - currentSize) * 0.15;
// 0.15 = converge en ~20 frames → suave y sin pop
```

---

## 🗺️ 3. SECTOR STREAMING — Arquitectura Completa

### El grid 3D del universo
```
El universo se divide en celdas (sectores):

  ┌──────────────────────────────────────────────────┐
  │  Sector(0,0,0) │ Sector(1,0,0) │ Sector(2,0,0)  │
  │  Sector(0,0,1) │ Sector(1,0,1) │ Sector(2,0,1)  │
  │  Sector(0,0,2) │ Sector(1,0,2) │ Sector(2,0,2)  │
  └──────────────────────────────────────────────────┘

Tamaño de sector:  2000u × 600u × 2000u
Radio de carga:    ±2 sectores en XZ, ±1 en Y
Max cargados:      5×5×3 = 75 sectores teóricos
                   (en práctica ≈25 porque la galaxia no está por encima)
```

### Determinismo con LCG Seeded
```js
// Las estrellas del sector siempre son iguales, sin guardar datos
// Usamos Linear Congruential Generator (LCG) seedada por índice del sector

function lcg(seed) {
    let s = seed;
    return function() {
        s = (1664525 * s + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

// Índice único por sector:
const idx = sx * 10000 + sy * 100 + sz;
const rng = lcg(idx);

// Cada llamada a rng() da el mismo resultado dado el mismo seed
// → Las estrellas "existen" aunque no se hayan cargado aún
```

### Algoritmo de carga/descarga
```
CADA 90 frames (≈ 1.5s a 60fps):

  1. Calcular sector actual (sectorX, sectorY, sectorZ) de la cámara
  
  2. Para cada sector en radio ±2:
     - ¿Ya cargado? → skip
     - ¿Dentro del radio principal (r < 4000u)? → skip (lo maneja GalaxyGen)
     - ¿Fuera del universo (r > 22000u)? → skip
     - Si no → CARGAR el sector
  
  3. Para cada sector cargado:
     - ¿Fuera del radio? → DESCARGAR (dispose geometry + material)
```

### Lifecycle de un sector
```
INEXISTENTE
    ↓
  [camera approaches within 2 sectors]
    ↓
LOADING: createSectorGeometry(seed) → BufferGeometry
    → 2400 estrellas con posiciones LCG + densidad espiral
    ↓
LOADED: Points added to scene
    ↓
  [camera moves away > 2 sectors]
    ↓
UNLOADING: geo.dispose() + mat.dispose() + scene.remove()
    ↓
INEXISTENTE
```

---

## ⚡ 4. PRESUPUESTO DE DRAW CALLS

### Regla fundamental
```
Cada Draw Call = 1 llamada a la GPU (costosa)
Target: < 100 Draw Calls por frame

WebGL sobrecarga promedio: ~70μs por draw call
100 draw calls = 7ms solo en overhead
```

### Draw Calls actuales del engine
| Sistema | Draw Calls | Tipo | Stars |
|---------|------------|------|-------|
| GalaxyField Main | 1 | Points | 120,000 |
| DeepSpaceHDRI | 1 | Mesh+Shader | ∞ (GLSL) |
| GlobularClusters | 1 | Points | 7,000 |
| OpenClusters | 1 | Points | 5,400 |
| EmissionNebulae | 1 | Points | 3,200 |
| ReflectionNebulae | 1 | Points | 2,200 |
| PlanetaryNebulae | 1 | Points | 1,400 |
| StreamingSectors | ≤25 | Points | 2,400 cada uno |
| Sol (sun) | 1 | Mesh | — |
| Planetas (6) | 6 | Mesh | — |
| Atmósferas (6) | 6 | Mesh overlay | — |
| Anillos (1) | 1 | Mesh | — |
| Lunas (≤18) | 18 | Mesh | — |
| PostProcess | 3 | — | — |
| **TOTAL EST.** | **~70** | | |

> ✅ Bien dentro del budget de 100 Draw Calls

---

## 🧹 5. MEMORY MANAGEMENT — Dispose Pattern

### Por qué importa el dispose
```
WebGL mantiene VRAM independientemente del GC de JS.
Si no disposas geometry + material:
  → VRAM leak
  → Al cabo de 30min navegando → GPU out of memory → negro

REGLA: Cada objeto creado en WebGL DEBE ser dispossed cuando se elimina.
```

### Dispose correcto de un sector
```js
function unloadSector(sector) {
    // 1. Remover de la scene
    scene.remove(sector.points);

    // 2. Liberar GPU resources
    sector.points.geometry.dispose();
    sector.points.material.dispose();
    
    // 3. Limpiar referencias JS (ayuda al GC)
    sector.points.geometry = null;
    sector.points.material = null;
    sector.points = null;
}
```

### Dispose de texturas de planeta
```js
function disposePlanet(planet) {
    planet.geometry.dispose();
    planet.material.map?.dispose();
    planet.material.emissiveMap?.dispose();
    planet.material.dispose();
    scene.remove(planet);
}
```

---

## 🧵 6. WEB WORKERS — Para cálculos pesados

### Candidatos para Workers
```
Los Workers ejecutan en un hilo separado (sin bloquear la UI):

✅ Generación de geometría de sectores
✅ Cálculo de paths de warp
✅ AI de drones de notificación
✅ Carga de datos de assets
❌ Three.js (usa WebGL, debe estar en main thread)
❌ DOM manipulation
❌ Input handling
```

### Patrón de uso con transferable objects
```js
// Main thread → Worker
const positions = new Float32Array(2400 * 3);
worker.postMessage({ cmd: 'buildSector', seed: idx, out: positions }, [positions.buffer]);

// Worker → Main thread (retorna buffer completado)
self.onmessage = ({ data }) => {
    const { seed, out } = data;
    fillSectorPositions(seed, out); // LCG rng → fill buffer
    self.postMessage({ positions: out }, [out.buffer]);
};
```

---

## 📏 7. DENSIDAD ESPIRAL EN STREAMING

### El problema
Los sectores del streaming deben mantener coherencia con la galaxia.  
Las estrellas del streaming no deben estar uniformemente distribuidas:  
deben seguir los brazos espirales.

### Solución: Spiral arm density bias
```js
function spiralArmDensity(x, z) {
    // Para cada punto, calcular qué tan cerca está de un brazo espiral
    const r     = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);
    
    let minArmDist = Infinity;
    for (let arm = 0; arm < 5; arm++) {
        const armAngle = (arm / 5) * Math.PI * 2;
        // Ángulo del brazo a esta distancia (espiral logarítmica)
        const armTheta = Math.log(r / 100) / 0.26 + armAngle;
        // Distancia angular al brazo más cercano
        let dTheta = Math.abs(theta - (armTheta % (Math.PI * 2)));
        if (dTheta > Math.PI) dTheta = Math.PI * 2 - dTheta;
        minArmDist = Math.min(minArmDist, dTheta);
    }
    
    // Densidad = gaussian alrededor del brazo
    return Math.exp(-minArmDist * minArmDist * 6.0);
}
```

---

## 📊 8. MÉTRICAS EN TIEMPO REAL

### PG_DEBUG object (disponible en consola)
```js
window.PG_DEBUG = {
    printStats() {
        console.table({
            'FPS target':      60,
            'Draw Calls':      renderer?.info.render.calls,
            'Triangles':       renderer?.info.render.triangles,
            'Stars visible':   galaxyGen?.points?.geometry?.attributes?.position?.count,
            'Sectors loaded':  sectorStream?.loadedSectorCount,
            'Nav State':       navSystem?.currentState,
            'Cam position':    navSystem?.cameraRig?.position,
            'VRAM textures':   renderer?.info.memory.textures,
            'VRAM geometries': renderer?.info.memory.geometries,
        });
    },
    bloomIntensity(v) {
        renderPipeline?.setBloomIntensity(v);
    },
    teleport(x, y, z) {
        navSystem?.cameraRig?.position.set(x, y, z);
    },
};

// Uso: PG_DEBUG.printStats()
```

---

## 🧠 DATOS PARA LULU — Parte 5

```js
LULU.universe.part5 = {
    streaming: {
        sectorSize:   [2000, 600, 2000],
        loadRadius:   [2, 1, 2],   // XZ=2, Y=1
        starsPerSector: 2400,
        tickInterval: 90,          // frames entre actualizaciones
        algorithm:    'LCG seeded by sector index',
        innerzone:    4000,        // unidades sin streaming (manejado por GalaxyGen)
        maxRadius:    22000,
    },
    lod: {
        formula:    'mat.size += (target - current) * 0.15',
        tiers: [
            { dist: 5000, size: 1.2 },
            { dist: 1500, size: 1.8 },
            { dist:  500, size: 2.8 },
            { dist:    0, size: 4.5 },
        ],
    },
    budget: {
        drawCallTarget:  100,
        drawCallCurrent: 70,
        frameTarget_ms:  16.67,
        jsTarget_ms:     4,
        gpuTarget_ms:    8,
    },
    dispose: 'geo.dispose() + mat.dispose() + tex.dispose() — ALWAYS on unload',
    workers: ['sector generation', 'warp path calculation', 'AI drones'],
    debug:   'window.PG_DEBUG.printStats()',
};

// RESUMEN TOTAL DE LA BIBLIA — 5 PARTES COMPLETAS
LULU.universe._bibliaSummary = {
    part1: 'Escalas, unidades, gravedad, Kepler, Floating Origin',
    part2: 'Estrellas físicas, planetas, atmósferas, HDRI, Ring systems',
    part3: 'Nebulosas (4 tipos), cúmulos (King/Gaussian), Dark Matter, Shaders',
    part4: 'HUD, apps de planeta, raycast, LULU, ventanas, warp transitions',
    part5: 'Sector streaming, LOD, draw calls, VRAM, Workers, debug tools',
};
```
