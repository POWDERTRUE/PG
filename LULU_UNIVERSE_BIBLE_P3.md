# 📜 BIBLIA DEL UNIVERSO — POWDER GALAXY
## Parte 3: Nebulosas, Cúmulos, Dark Matter y Shaders Volumétricos
> Motor OMEGA V30 · 2026-03-23  
> Esta parte cubre las estructuras más complejas visualmente del universo.

---

## ☄️ 1. NEBULOSAS — Física y Tipos

### ¿Qué son las nebulosas?
```
Una nebulosa = nube de gas y polvo interestelar.

Tamaños:
  Más pequeñas:  0.1 años luz (nebulosa planetaria)
  Más grandes:  300 años luz (complejo molecular como Orion)
  
Composición:
  70%  Hidrógeno (H)
  28%  Helio (He)
  2%   Metales pesados (O, C, N, Fe, Si...)
```

### 1.1 Nebulosas de Emisión (HII Regions)
```
Causa: Gas ionizado por estrellas O y B muy calientes
Color: ROJO (Hα, 656nm) + verde escaso (OIII, 501nm)
Forma: difusa, irregular, nube brillante
Tamaño: 10–300 años luz

Ejemplos: Nebulosa de Orion (M42), Nebulosa de la Carena
```

**Cómo se forma:**
```
Estrella O/B emite fotones UV energéticos
→ ioniza H → H⁺ + e⁻
→ e⁻ recapturado → fotón en Hα (rojo 656nm)
```

**Implementación engine:**
```js
// NebulaSystem.js — EMISSION
color:   new THREE.Color(0xff2244)  // Hα rojo
opacity: 0.18 (AdditiveBlending)
size:    220–350u (por partícula)
count:   18 nebulosas en brazos espirales
shader:  CanvasTexture con gradiente radial suave
```

### 1.2 Nebulosas de Reflexión
```
Causa: Polvo interestelar refleja luz de estrellas cercanas
Color: AZUL (la misma razón que el cielo — dispersión Rayleigh)
Forma: halo brillante alrededor de una estrella
Tamaño: 1–20 años luz

Ejemplo: Nebulosa de las Pléyades
```

**Implementación engine:**
```js
// NebulaSystem.js — REFLECTION
color:   new THREE.Color(0x2255ff)
opacity: 0.14
size:    180–280u
count:   12 nebulosas (brazos espirales, cerca de estrellas A/B)
```

### 1.3 Nebulosas Planetarias
```
Causa: Estrella moribunda tipo G/K expulsa su envoltura exterior
Color: TEAL/CYAN (OIII 501nm) + rojo exterior (NII 658nm)
Forma: ANULAR — cáscara esférica o elipsoidal
Tamaño: 0.1–5 años luz (pequeñas y definidas)
Vida:   10,000–50,000 años (luego se dispersan)

Ejemplo: Nebulosa del Anillo (M57), Nebulosa del Ojo de Gato
```

**Implementación engine:**
```js
// NebulaSystem.js — PLANETARY
color:   new THREE.Color(0x00ffcc)
opacity: 0.24
size:    80–140u
count:   8 (disco exterior galáctico, ángulos aleatorios)
forma:   anular — mayor alpha en borde exterior
```

### 1.4 Nebulosas de Supernova (Remanentes)
```
Causa: Explosión de estrella masiva (>8 M☉)
Color: Filamentos rojos/azules, estructura caótica
Forma: lobular, filamentosa
Temperatura: 10,000,000 K (rayos X)
Velocidad expansión: 1,000–10,000 km/s

Ejemplo: Nebulosa del Cangrejo (SN 1054)
```

> **Nota engine:** No implementado aún. Candidato para Parte 5.

---

## ✨ 2. CÚMULOS ESTELARES

### 2.1 Cúmulos Globulares
```
Tipo:          Antiguo (12–13 billones de años)
Distribución:  HALO galáctico (NUNCA en el disco)
Forma:         Perfectamente esférico con gradiente de densidad
Stars:         100,000 – 1,000,000 estrellas
Radio:         20–200 años luz

Temperatura:   Estrellas solo K y M (viejas — azules ya murieron)
Color dominante: Naranja-rojo caliente
```

**Perfil de densidad — King Profile:**
```
ρ(r) = ρ₀ / (1 + (r/r_c)²)^(3/2)

ρ₀ = densidad central
r_c = radio core del cúmulo

→ Muy denso en el centro, gradiente suave hacia el exterior
→ No tiene un borde definido (cola extensa)
```

**Implementación engine:**
```js
// StarClusterSystem.js — GLOBULAR
count:        25 cúmulos en el halo
starsEach:    280 (engine-compressed)
radius:       150–300u
colors:       0xff8844 (naranja), 0xffaa33 (amarillo)
distribution: King profile: r = rc * sqrt(1/(u^(-2/3)-1))
phase:        halo — r > 3000u del centro
```

### 2.2 Cúmulos Abiertos
```
Tipo:          Joven (millones de años, máximo ~billion)
Distribución:  BRAZOS ESPIRALES (donde nacen estrellas)
Forma:         Amorfa, poco gravitacionalmente ligado
Stars:         10 – 10,000 estrellas
Radio:         5–50 años luz

Color:         Azul-blanco (estrellas O/B/A — recién formadas)
```

**Implementación engine:**
```js
// StarClusterSystem.js — OPEN
count:        45 cúmulos en los brazos
starsEach:    120
radius:       60–180u
colors:       0x88ccff (azul claro), 0xaaddff (blanco-azul)
distribution: Gaussiana simple (sin King profile — poco densos)
phase:        disco — en ángulo de brazo espiral
```

---

## 🌑 3. MATERIA OSCURA

### ¿Qué es?
```
La materia oscura es:
  - No detectada directamente
  - No emite luz (invisible)
  - Interactúa SOLO gravitacionalmente
  - 27% del universo (materia normal solo 5%)
  - Su existencia se infiere por:
    → Curvas de rotación galácticas (estrelas orbitan más rápido de lo esperado)
    → Lentes gravitacionales
    → Formación de estructuras a gran escala
```

### Distribución en una galaxia típica
```
La materia oscura forma un HALO que envuelve la galaxia:

Radio del halo DM:  5–10× el radio galáctico visible
Perfil:             NFW (Navarro-Frenk-White)

ρ(r) = ρ_s / [(r/r_s)(1 + r/r_s)²]

ρ_s = densidad característica
r_s = radio escala (~20 kpc)
```

### Efecto visual en el engine
Aunque invisible, la materia oscura influye en:
1. **Las curvas de rotación galáctica** — estrellas externas orbitan tan rápido como las internas
2. **Lensing gravitacional** — distorsión de imágenes de galaxias detrás

```js
// Engine: dark matter no se renderiza
// Pero modifica la velocidad orbital de estrelas del halo:
// v_circular(r) = sqrt(G * (M_visible + M_dark) / r)
// En el engine actual: simplificado con speed param en registerOrbit()
```

---

## 🎨 4. SHADERS VOLUMÉTRICOS — Cómo simular volumen en WebGL

### El problema
Las nebulosas reales son VOLÚMENES de gas en 3D.  
En WebGL, todo es superficies. Para simular volumen:

### Método 1: Ray Marching (AAA quality, costoso)
```glsl
// From fragmentShader:
vec3 ray = normalize(vDir);
float density = 0.0;
for (int i = 0; i < 128; i++) {
    vec3 p = cameraPos + ray * float(i) * stepSize;
    density += sampleVolume(p);
}
gl_FragColor = vec4(nebulaColor, density);
```

> ✅ Resulta en nebulosas realmente volumétricas  
> ❌ 128 marchas = muy costoso en tiempo real

### Método 2: Particle Billboards (usado en el engine)
```js
// PointsMaterial con CanvasTexture de gradiente radial
// AdditiveBlending → múltiples capas se acumulan
// Resultado: aspecto volumétrico a bajo coste

// Técnica clave: MUCHAS partículas pequeñas < POCAS grandes
// Large particles at close range look like polygons
// Small particles at distance look like gas
```

### Método 3: Layered quads (compromiso AAA)
```js
// 3–5 quads con textura de ruido (PlaneGeometry)
// Cada quad en pose diferente alrededor del centro
// Resultado: volumen 3D aparente sin ray marching

// Usado extensamente en: Star Wars Squadrons, Elite Dangerous
```

### Engine actual: Método 2 con optimización
```js
// NebulaSystem.js usa:
//   AdditiveBlending = capas se suman (sin darkening)
//   sizeAttenuation: true = más grande de cerca, más pequeño de lejos
//   depthWrite: false = no bloquea objetos detrás
//   transparent: true = blending correcto
```

---

## 💡 5. ILUMINACIÓN GALÁCTICA REAL

### Fuentes de luz en una galaxia
```
1. Estrellas individuales (millones de fuentes puntuales)
2. Nebulosas de emisión (difusas, autoluminosas)
3. Núcleo galáctico (muy brillante globalmente)
4. Fondo cósmico de microondas (2.7K — invisible en óptico)
```

### Regla de iluminación para el engine
```
En el engine, NO hay múltiples fuentes de light globales.
Cada objeto tiene:
  1. emissiveMaterial propio (para objetos autopiluminados)
  2. La escena tiene AmbientLight = 0.015 (noche galáctica)
  3. El sol del sistema solar = luz local (PointLight local)
```

### Inversión del cuadrado de la luz
```
I = P / (4π r²)

Consecuencia en LOD visual del engine:
  distancia 2× → brillo 4× menor → usar tamaño mayor del punto
  distancia 10× → brillo 100× menor → casi invisible

→ Esta es la razón del LOD system: puntos más grandes a distancia
  para compensar que el brillo percibido cae
```

---

## 🎥 6. CÁMARA AAA — SISTEMA COMPLETO

### Pipeline correcto de la cámara

```
FRAME N:

[01] input           → InputStateSystem drena dx/dy del mouse
[02] interaction     → RaycastSelectionSystem hits
[03] navigation      → FreeFlightState.update() — acumula yaw/pitch DIRECT
                        FloatingOriginSystem — desplaza origin si r > 5000
[04] post-navigation → CameraStabilizationSystem:
                        1. Quaternion renormalization
                        2. Jitter detection (FloatingOrigin pop)
                        3. Exponential smoothing α = 1 - e^(-dt/τ)
                        4. updateMatrixWorld() — una sola vez
[05] render          → RenderPipeline → EffectComposer → screen
```

### Los 4 pilares de la cámara AAA espacial

#### 1. Floating Origin
```
Umbral: 5000u (float32 error < 0.0005u)
Mueve: scene.children[] – offset
No mueve: DeepSpaceHDRI (tiene su propio sync)
Frecuencia: cada vez que rig.position.length() > 5000
```

#### 2. Camera Rig (separación física/render)
```
Physics rig: posición real en el espacio (acumula velocidad)
Render camera: sigue el rig con τ = 8ms suavizado
→ El rig puede tener ruido de 1 frame
→ La cámara render siempre está suavizada
```

#### 3. Quaternion Smoothing per State
```
FREE_FLIGHT: τ = 8ms  — casi inmediato (precision gaming)
ORBIT:       τ = 20ms — ligeramente más fluido
WARP:        τ = 45ms — cinematic lag (la cámara "pesa" en warp)
```

#### 4. Frame Scheduler Order
```
navigation (yaw/pitch update)
navigation (floating origin)
post-navigation (stabilization + renormalization)
render (compositor)
```

### Fórmula del suavizado exponencial
```js
// α = 1 - e^(-dt/τ)
// τ = time constant (seconds)

// 1 frame (60fps, dt=0.016s):
// τ=0.008s → α = 1 - e^(-0.016/0.008) ≈ 0.865  (86% del camino en 1 frame)
// τ=0.045s → α = 1 - e^(-0.016/0.045) ≈ 0.30   (30% del camino en 1 frame)

// Propiedades de este suavizado:
// ✅ Framerate-independent (dt en la fórmula)
// ✅ Nunca pasa del target (sin oscilación)
// ✅ Converge exponencialmente (no hay overshoot)
```

---

## 🧠 DATOS PARA LULU — Actualización Part 3

```js
LULU.universe.part3 = {
    nebulaeTypes: {
        emission:   { color: '#ff2244', cause: 'Hα ionized H by O/B stars', alpha: 0.18 },
        reflection: { color: '#2255ff', cause: 'dust scatters starlight (Rayleigh)', alpha: 0.14 },
        planetary:  { color: '#00ffcc', cause: 'dying G/K star ejects envelope', alpha: 0.24 },
        supernova:  { color: '#ff6633', cause: 'M>8☉ core collapse', alpha: 0.30 },
    },

    clusterProfiles: {
        globular: 'King: ρ(r) = ρ₀ / (1+(r/rc)²)^1.5 — halo only',
        open:     'Gaussian: σ = 0.3 * radius — spiral arms only',
    },

    darkMatter: {
        profile:    'NFW: ρ(r) = ρs / [(r/rs)(1+r/rs)²]',
        fraction:   0.27,  // of universe
        visible:    false,
        effect:     'Orbital velocity: v = sqrt(G*(M_vis+M_DM)/r)',
    },

    volumetricShaders: {
        recommended:  'Layered particle billboards (Método 2)',
        highQuality:  'Ray marching (128 steps — desktop only)',
        engine:       'PointsMaterial + AdditiveBlending + CanvasTexture',
    },

    cameraSystemFull: {
        pipeline:   ['input','navigation','floatingOrigin','stabilization','render'],
        tauValues:  { freeFlight: 0.008, orbit: 0.020, warp: 0.045 },
        alphaFormula: 'α = 1 - exp(-dt/τ)',
        quaternionRenorm: 'every frame if |q|² - 1 > 0.0001',
    },
};
```
