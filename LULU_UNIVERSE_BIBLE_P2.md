# 📜 BIBLIA DEL UNIVERSO — POWDER GALAXY
## Parte 2: Sistemas Estelares, Planetas y Atmósferas
> Motor OMEGA V30 · 2026-03-23  
> Continúa de la Parte 1 (escalas, gravedad, cámara, galaxia).  
> Esta parte cubre todo lo que ocurre DENTRO de un sistema estelar.

---

## ⭐ 1. ESTRELLAS FÍSICAS — Temperatura y Color Real

### Por qué las estrellas tienen distintos colores
Las estrellas irradian como **cuerpos negros** (blackbody radiators).  
Su color depende SOLO de su temperatura superficial.

```
Objeto caliente → emite en azul (alta energía)
Objeto frío     → emite en rojo (baja energía)
```

### Conversión temperatura → RGB (Planck / Goldsborough 2008)
Esta es la fórmula que usa el engine en `PhysicalStarSystem.js`:

```js
function temperatureToRGB(T) {
    const t = T / 100;  // normalizado

    // Canal Rojo
    let r = t <= 66 ? 255
           : 329.7 * Math.pow(t - 60, -0.133);

    // Canal Verde
    let g = t <= 66 ? 99.47 * Math.log(t) - 161.12
           : 288.1 * Math.pow(t - 60, -0.0755);

    // Canal Azul
    let b = t >= 66 ? 255
           : t <= 19 ? 0
           : 138.5 * Math.log(t - 10) - 305.0;

    return clamp([r, g, b], 0, 255) / 255;
}
```

### Tabla de colores estelares exactos
| Tipo | Temperatura (K) | Color Hex | RGB Engine |
|------|----------------|-----------|-----------|
| O | 40,000 K | `#9bb0ff` | `(0.61, 0.69, 1.00)` |
| B | 20,000 K | `#aabfff` | `(0.67, 0.75, 1.00)` |
| A | 9,000 K  | `#cad7ff` | `(0.79, 0.84, 1.00)` |
| F | 7,000 K  | `#f8f7ff` | `(0.97, 0.97, 1.00)` |
| G | 5,800 K  | `#fff4e8` | `(1.00, 0.96, 0.91)` — **Sol** |
| K | 4,500 K  | `#ffd2a1` | `(1.00, 0.82, 0.63)` |
| M | 3,000 K  | `#ffcc8f` | `(1.00, 0.80, 0.56)` |

### Luminosidad vs. temperatura (escala engine)
```
O stars → luminosity factor = 1.0   (100,000× más brillante que M en realidad)
B stars → 0.82
A stars → 0.60
F stars → 0.45
G stars → 0.34
K stars → 0.28
M stars → 0.18  (la mayoría de estrellas reales — pero muy tenues)
```

### Distribución realista en una galaxia
```
M (3000K)  76.45%  — enanas rojas, casi invisibles individualmente
K (4500K)  12.10%  — enanas naranjas
G (5800K)   7.60%  — tipo solar — la minoría del total
F (7000K)   3.03%
A (9000K)   0.60%
B (20000K)  0.12%
O (40000K)  0.00003% — extremadamente raras, extremadamente brillantes
```

**Regla visual:** Una galaxia real parece DOMINADA por las estrellas azul-blanco de los brazos, aunque NUMERICAMENTE domine el rojo. Esto es porque las O/B son miles de veces más luminosas.

---

## ☀️ 2. NUESTRO SOL — Modelo de Referencia

```
Tipo espectral:     G2V
Temperatura:        5,778 K
Masa:               1.989 × 10³⁰ kg (1 M☉)
Radio:              695,700 km (1 R☉)
Luminosidad:        3.828 × 10²⁶ W (1 L☉)
Edad:               4.603 × 10⁹ años
Vida útil total:    ~10 × 10⁹ años (a mitad)
Rotación polar:     ~25.05 días
```

### En el engine
```
Radio engine:       40u
Color:              #ffdd88 (temperatura ≈ 5778K → ligeramente más cálido)
Emissive:           0.38 intensity
Hitbox:             200u (para interacción desde sistema solar)
Velocidad spin:     0.08 rad/s (engine-time)
```

---

## 🪐 3. PLANETAS — Físicas y Visuales

### Tipos planetarios y cómo se originan
```
Rocky/Terrestrial    → formados cerca de la estrella, rocas y metales
Ocean world          → mucha agua, capa de hielo o océano global
Desert               → poco agua, atmósfera densa o escasa
Gas giant            → masa suficiente para retener H/He primordial
Ice giant            → agua/NH3/CH4 en fase helada en capas
Volcanic             → tectónica activa, volcanes, interior caliente
Jungle               → temperatura y órbita perfectas, vegetación masiva
```

### Zonas habitables (Goldilocks Zone)
```
d_hz = √(L_star / L_sun) × d_earth

Para nuestro sol:   0.95 AU – 1.37 AU
Para una estrella K: 0.4 AU – 0.7 AU
Para una estrella M: 0.08 AU – 0.14 AU (¡muy cerca!)
```

### Estructura de capas de un planeta terrestre
```
┌──────────────────────────────────────────┐
│  ATMÓSFERA      (100–1000 km)            │
│  ─────────────────────────────────────── │
│  CORTEZA        (30–70 km)               │
│  MANTO          (2900 km)                │
│  NÚCLEO EXTERNO (2200 km) — líquido      │
│  NÚCLEO INTERNO (1220 km) — sólido Fe/Ni │
└──────────────────────────────────────────┘
```

---

## 💨 4. ATMÓSFERAS PLANETARIAS — Física Real

### Por qué los planetas tienen halos de luz
La atmósfera **dispersa la luz estelar** — el observador ve un halo (limb brightening).

```
Dos efectos principales:

1. RAYLEIGH SCATTERING — moléculas difunden luz azul preferentemente
   → Cielo azul en Tierra, halos azules en planetas con N2/O2
   
2. MIE SCATTERING — partículas grandes difunden todas las longitudes de onda
   → Halos anaranjados en Venus (partículas de ácido sulfúrico)
```

### Fresnel equation (limb glow) — usado en el engine
```glsl
float fresnel = pow(1.0 - dot(normal, viewDir), power);
// power = 3.5 para atmósferas finas
// power = 2.0 para atmósferas densas (Venus-like)
```

### Colores de atmósfera por tipo de planeta
| Tipo | Composición | Color atmósfera | Alpha |
|------|-------------|-----------------|-------|
| Ocean | N₂, O₂, H₂O | Azul `#4488ff` | 0.85 |
| Desert | CO₂, arena | Naranja `#ff8833` | 0.70 |
| Gas Giant | H₂, He | Amarillo `#ffcc88` | 0.60 |
| Ice | CO₂, N₂ | Azul-blanco `#aaddff` | 0.40 |
| Volcanic | SO₂, CO₂ | Rojo `#ff3300` | 0.90 |
| Jungle | N₂, O₂ | Verde `#44ff88` | 0.65 |

### Implementación actual en el engine
**`PlanetShaderSystem.js`** aplica a cada planeta:
1. `MeshStandardMaterial` con `CanvasTexture` procedural (256×256)
2. Overlay `ShaderMaterial` con Fresnel atmosphere (BackSide disabled, FrontSide additive)
3. Para gas giant: `RingGeometry` con gradiente de opacidad

---

## 🌙 5. LUNAS — Física y Visual

### Cómo se forman las lunas
```
Tipo 1: Captura — la gravedad del planeta captura un asteroide
Tipo 2: Acreción — se forman junto al planeta del mismo disco protoplanetario
Tipo 3: Impacto gigante — colisión con otro cuerpo eyecta material que se acumula
        → Origen de la Luna terrestre (colisión con "Theia")
```

### Propiedades físicas generales
```
Masa mínima para forma esférica: ~10^18 kg (radio ~200 km)
Por debajo de ese umbral: forma irregular (asteroide)

Luna Terrestre:
  Radio:     1,737 km
  Masa:      7.34 × 10^22 kg (1.2% de la Tierra)
  Órbita:    384,400 km promedio
  Período:   27.32 días
  Excentricidad: 0.0549
```

### Reglas del engine para lunas
```js
// Engine orbit params
moonOrbitRadius = planetRadius * (3 + randomFactor * 5)  // 3–8× el radio
moonRadius      = planetRadius * (0.1 + random * 0.4)    // 10–50% del planeta
moonSpeed       = 2.0–7.0  // rad/s engine-time
moonColor       = #888888 → #aaaaaa  (grises rocosos)
```

### Radio de Roche (límite de desintegración)
```
Un satélite a menos de este radio se desintegra por las fuerzas de marea:

d_Roche = 2.44 × R_planeta × (ρ_planeta / ρ_luna)^(1/3)

Por dentro de d_Roche → anillos (como Saturno)
Por fuera de d_Roche → luna estable
```

---

## 💫 6. ANILLOS PLANETARIOS

### Composición real
```
Saturno:  hielo de agua (90%), rocas, polvo
Urano:    polvo oscuro + hielo
Neptuno:  anillos muy tenues, polvo oscuro
```

### Estructura visual
```
┌──────────────────────────────────────────────────┐
│  Anillo D → más interno        opaco, irregular │
│  Anillo C → semitransparente   polvo oscuro      │
│  Anillo B → más denso y brillante                │
│  Div. Cassini → espacio vacío (resonancia 2:1)   │
│  Anillo A → exterior brillante                   │
│  Anillo F → muy estrecho, pastoreado por lunas   │
└──────────────────────────────────────────────────┘
```

### Engine implementation
```js
// PlanetShaderSystem.js
RingGeometry(r_inner: planet.radius * 1.6,
             r_outer: planet.radius * 2.8,
             segments: 64)
// Opacity gradient: inner=0.3 → outer=0.6 → far=0.2
// Tilt: π/2 + random(-0.2, 0.2) — slight inclination
// Color: #ccaa88 (ice + dust mix)
// Material: MeshBasicMaterial, DoubleSide, depthWrite: false
```

---

## 🌌 7. FONDO ESPACIAL (HDRI) — Lo que el observador debería ver

### El universo real desde el espacio
```
El espacio NO tiene niebla azul.
El espacio NO tiene estrellas enormes.
El espacio ES:
  → Negro absoluto entre objetos
  → Estrellas como puntos (sin difracción fuera de atmósfera)
  → La Vía Láctea visible como banda lechosa
  → Nebulosas tenues, casi invisibles a simple vista
  → Luz zodiacal tenue (polvo del sistema solar)
```

### La banda de la Vía Láctea
```
Ángulo de la banda respecto al ecuador celeste: ~63°
Ancho aparente: ~20° en zonas densas
Brillo máximo: región de Sagitario (hacia el centro galáctico)
Color: blanco-amarillo en el centro, azul en los brazos exteriores
```

### Implementación en DeepSpaceHDRI.js
El engine usa un shader GLSL con:
1. **Milky Way band** — FBM turbulence con tilt 0.45 rad
2. **Galactic core spot** — exponential angular falloff desde Sagitario
3. **ISM teal glow** — FBM noise faint interstellar medium
4. **Nebula wisps** — dos capas FBM: roja + azul
5. **Micro-star hash** — dos octavas de `hash(floor(dir * N))` para puntos de estrellas

```glsl
// Energía de estrella micro = función escalonada
float starBright = pow(max(0.0, starHash - 0.92), 3.0) * 8.0;
// Solo las estrellas más brillantes superan el umbral 0.92
```

---

## ⚡ 8. FLOATING ORIGIN — Corrección de Jitter Galáctico

**Este es el problema de cámara más importante en simuladores espaciales.**

### El problema
```
float32 representa números con 32 bits:
  1 bit   signo
  8 bits  exponente
  23 bits mantisa → 7 dígitos significativos

A x = 0:          step = 5.96e-8    (60 nanounidades)  → invisible
A x = 10,000:     step = 0.001       (1 miliunidad)    → invisible
A x = 100,000:    step = 0.008       (8 miliunidades)  → JITTER LEVE
A x = 1,000,000:  step = 0.125       (125 miliunidades) → JITTER VISIBLE
A x = 10,000,000: step = 1.0        (1 unidad completa) → SALTOS
```

### La solución: Floating Origin
```js
// TODO EL UNIVERSO SE MUEVE ALREDEDOR DEL JUGADOR
// EL JUGADOR SIEMPRE ESTÁ EN O CERCA DEL ORIGEN

function floatingOriginTick(playerRig, scene, threshold = 5000) {
    if (playerRig.position.lengthSq() < threshold * threshold) return;
    
    const offset = playerRig.position.clone();
    playerRig.position.set(0, 0, 0);
    
    scene.children.forEach(obj => {
        if (obj.isCamera) return;
        if (obj.name === 'DeepSpaceHDRI') return; // sigue la cámara de otra forma
        obj.position.sub(offset);
    });
}
```

### Por qué threshold = 5000 y no 100,000
```
A r = 5000:  float32 error = 5000 / 10^7 ≈ 0.0005 unidades
0.0005 unidades a 60fps → 0.03 unidades/s de drift máx

A r = 100,000: float32 error ≈ 0.01 unidades → VISIBLE
```

### Regla en el engine
```
FloatingOriginSystem.THRESHOLD = 5000;  // activo en fase 'navigation'
Se traslada: cameraRig + toda la scene
Se excluye:  DeepSpaceHDRI (sigue cámara de forma independiente)
```

---

## 🔢 DATOS PARA LULU — Actualización del Knowledge Base

```js
LULU.universe.stellarPhysics = {
    colorModel:     'Planck blackbody (Goldsborough 2008)',
    temperatureRange: [1000, 40000], // Kelvin
    solarTemperature: 5778,
    solarColor:     '#fff4e8',
    solarMass_kg:   1.989e30,
    solarRadius_km: 695700,
    
    planetTypes: [
        'rocky', 'ocean', 'desert', 'gas_giant',
        'ice_giant', 'volcanic', 'jungle'
    ],
    
    atmosphereModels: {
        fresnel_power_thin:  3.5,  // thin atmos (Mars-like)
        fresnel_power_dense: 2.0,  // dense (Venus-like)
    },
    
    floatingOrigin: {
        threshold:    5000,
        phase:        'navigation',
        float32ErrorAt5k: 0.0005, // units — invisible
    },
    
    ringFormation: 'Inside Roche limit: d = 2.44 * R * (ρ1/ρ2)^(1/3)',
    
    molecSpectralType: 'M', M_frequency: 0.7645,
};
```
