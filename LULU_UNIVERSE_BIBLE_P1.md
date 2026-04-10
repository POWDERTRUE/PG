# 📜 BIBLIA DEL UNIVERSO — POWDER GALAXY
## Parte 1: Fundamentos Absolutos del Universo (Nivel AAA)
> Autor: Motor OMEGA V30 · Fecha: 2026-03-23  
> Esta es la fuente de verdad para LULU y para todo sistema del engine.  
> Cada regla aquí debe ser respetada por cada sistema, shader y generador.

---

## 🌌 1. ESCALAS DEL UNIVERSO

### Jerarquía cósmica real

```
UNIVERSO OBSERVABLE
    ↓  93,000,000,000 años luz de diámetro
SUPERCÚMULOS DE GALAXIAS
    ↓  100–500 millones de años luz
CÚMULOS DE GALAXIAS
    ↓  2–30 millones de años luz entre galaxias
GALAXIAS INDIVIDUALES
    ↓  10,000–300,000 años luz de diámetro
BRAZO GALÁCTICO / ZONA LOCAL
    ↓  ~3,500 años luz de grosor
NUBE INTERESTELAR LOCAL
    ↓  ~300 años luz
SISTEMA ESTELAR MÚLTIPLE
    ↓  ~5 años luz entre estrellas
SISTEMA SOLAR
    ↓  ~120 UA de radio (límite heliosfera)
PLANETA + LUNAS
    ↓  Radios de 2,000–70,000 km
LUNA
    ↓  Radios de 10–2,500 km
ASTEROIDE
```

### Distancias de referencia clave
| Objeto | Distancia real | Escala Engine (u) |
|--------|---------------|-------------------|
| Tierra–Sol | 1 UA = 150M km | 150 u |
| Sol–Júpiter | 5.2 UA | 780 u |
| Límite sistema solar | ~120 UA | 18,000 u |
| Entre estrellas cercanas | ~4.2 años luz | ~630,000 u |
| Diámetro galaxia | ~100k años luz | R_MAX = 8,000 u (comprimido) |

> **Regla del engine:** Las distancias están COMPRIMIDAS para ser navigables.  
> La escala real sería inutilizable en tiempo real. El engine usa `R_MAX = 8000u` para la galaxia.

---

## ⚖️ 2. UNIDADES FÍSICAS DEL ENGINE

### Sistema de unidades
```
1 unidad (u) = variable por contexto (Floating Scale)

Escala planetaria:  1u = 10 km
Escala estelar:     1u = 1,000 km  
Escala galáctica:   1u = 100,000 año-luz / R_MAX
```

### Por qué NO usar unidades reales directamente
El mayor riesgo en un engine 3D es la **pérdida de precisión flotante** (jitter).

```
float32 tiene 7 dígitos significativos
Si camera.position.x = 1,500,000,000
entonces el error mínimo = ±128 unidades
→ TEMBLOR PERCEPTIBLE EN CÁMARA
```

**Solución: Floating Origin**
```js
// El jugador SIEMPRE está en (0,0,0)
// El universo se mueve alrededor del jugador
function floatingOriginTick(playerPos, scene) {
    if (playerPos.length() > THRESHOLD) {
        const offset = playerPos.clone();
        scene.children.forEach(obj => obj.position.sub(offset));
        playerPos.set(0, 0, 0);
    }
}
```

---

## 🌀 3. LEY DE GRAVEDAD UNIVERSAL

### Fórmula fundamental
```
F = G · m₁ · m₂ / r²

donde:
  G  = 6.674 × 10⁻¹¹ N·m²/kg²  (real)
  G  = 0.1                        (engine — simplificado)
  m₁ = masa del cuerpo orbital
  m₂ = masa del cuerpo central (estrella)
  r  = distancia entre centros
```

### Aceleración gravitacional
```
a = G · M / r²   [dirección hacia el centro]
```

### Implementación en el engine (Semi-Implicit Euler)
```js
// CelestialPhysicsSystem.js — CADA FRAME
const rVec = body.position.clone();
const r    = rVec.length();
const aMag = (G * centralMass) / (r * r);
const acc  = rVec.normalize().negate().multiplyScalar(aMag);

// SEMI-IMPLICIT EULER (preserva energía orbital a largo plazo)
velocity.addScaledVector(acc, dt);   // velocidad primero
position.addScaledVector(velocity, dt); // luego posición
```

> **¿Por qué Semi-Implicit y no Euler explícito?**  
> Euler explícito (`pos += vel*dt; vel += acc*dt`) pierde energía → órbitas espirales hacia afuera.  
> Semi-Implicit (`vel += acc*dt; pos += vel*dt`) conserva energía → órbitas estables indefinidamente.

---

## 🌠 4. LEYES DE KEPLER — ÓRBITAS REALES

### Primera Ley: Las órbitas son elipses
```
x²/a² + y²/b² = 1

a = semieje mayor (más largo)
b = semieje menor (más corto)
e = excentricidad = √(1 - b²/a²)

e = 0      → órbita circular perfecta
e = 0.017  → Tierra (casi circular)
e = 0.206  → Mercurio (más elíptica del sistema solar)
e = 0.967  → Cometa Halley (muy excéntrica)
```

### Segunda Ley: Un planeta barre áreas iguales en tiempos iguales
```
→ más rápido en perihelio (cerca del sol)
→ más lento en afelio (lejos del sol)
```

### Tercera Ley: Período orbital
```
T² = (4π²/GM) · a³

T = período en segundos
a = semieje mayor en metros
G = 6.674e-11
M = masa de la estrella central
```

### Velocidad circular (órbita circular aproximada)
```
v = √(G·M / r)
```

---

## ⭐ 5. CLASIFICACIÓN ESTELAR (Tipos Espectrales)

Las estrellas siguen la secuencia de Harvard:

| Tipo | Color Visual | Temperatura (K) | Ejemplo | GLSL Color |
|------|-------------|-----------------|---------|------------|
| O | Azul intenso | > 30,000 | Rigel | `#9bb0ff` |
| B | Azul-blanco | 10,000–30,000 | Vega | `#aabfff` |
| A | Blanco | 7,500–10,000 | Sírius A | `#cad7ff` |
| F | Blanco-amarillo | 6,000–7,500 | Canopus | `#f8f7ff` |
| G | Amarillo | 5,200–6,000 | **Sol** | `#fff4e8` |
| K | Naranja | 3,700–5,200 | Arturo | `#ffd2a1` |
| M | Rojo | 2,400–3,700 | Betelgeuse | `#ffcc8f` |

### Distribución en una galaxia típica
```
M (rojas)    → 76%  de todas las estrellas — dim, poca energía
K (naranja)  → 12%
G (amarillo) →  7%  — incluye nuestro Sol
F (blanco)   →  3%
A/B/O        →  2%  — muy brillantes, viven corto, mueren como supernovas
```

> **Regla visual crítica:** La mayoría de estrellas SON ROJAS/NARANJAS.  
> El brillo del azul compensa su rareza. La galaxia parece más blanca de lo que es.

---

## 🌌 6. ESTRUCTURA DE LA GALAXIA — MATEMÁTICA REAL

### Espiral logarítmica (forma de los brazos)
```
r = a · e^(b·θ)

donde:
  r = distancia al centro
  a = escala base (= SCALE en engine = 100u)
  b = tightness (= WIND en engine = 0.26)
  θ = ángulo en radianes
```

### Perfil de densidad radial (King profile)
```
ρ(r) = ρ₀ / (1 + (r/r_c)²)^(3/2)

ρ₀ = densidad central máxima
r_c = radio core
```

### Distribución gaussiana (scatter de brazos)
```js
// Box-Muller transform para distribuir estrellas en torno al brazo
function gaussian(sigma) {
    const u = Math.max(1e-9, Math.random());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()) * sigma;
}
```

### Estructura de capas (de dentro a afuera)
```
┌─────────────────────────────────────────────────────────────┐
│  r = 0       NÚCLEO GALÁCTICO  (hot white/yellow)          │
│  r = 0–280u  CORE              ρ = Gaussian max            │
│  r = 280–1200u BULGE           oblate sphere, warm yellow   │
│  r = 1200–8000u DISCO + BRAZOS logarithmic spiral          │
│  r = 8000–11000u HALO          sparse, old red stars        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔭 7. SEPARACIÓN ESPACIAL — REGLA ANTI-COLISIÓN

### La regla más importante del universo
```
EN EL ESPACIO REAL, CASI NADA COLISIONA.
La probabilidad de colisión entre dos estrellas es
aproximadamente 1 en 10^26 por año.
```

### Separaciones mínimas por nivel jerárquico
| Nivel | Separación mínima | En Engine |
|-------|-------------------|-----------|
| Luna ↔ Planeta | 0.5 × R_planeta | ≥ 15u |
| Planeta ↔ Planeta | 2× radio de Hill | ≥ 45u |
| Planeta ↔ Estrella | 10 × R_estrella | ≥ 400u |
| Estrella ↔ Estrella | 1 año luz | Comprimido: 2000u |
| Galaxia ↔ Galaxia | 2M años luz | Fuera de scope |

### Radio de Hill (zona de influencia gravitacional)
```
r_Hill = a · (m_planeta / 3·m_estrella)^(1/3)

Los cuerpos dentro del radio de Hill son "capturados" por el planeta.
Fuera de él, el sol los atrae de vuelta.
```

---

## 🎥 8. ARQUITECTURA DE CÁMARA AAA — REGLAS ABSOLUTAS

### La cámara es el sistema más crítico
> Todo lo demás puede ser aproximado.  
> La cámara NUNCA puede sentirse mal. Es el contacto entre el usuario y el universo.

### Regla 1: CERO latencia en mouse-look
```js
// ✅ CORRECTO — Acumulación directa
this.yaw   -= mouseDX * sensitivity;
this.pitch -= mouseDY * sensitivity;

// ❌ INCORRECTO — Latencia de lerp
this.yaw = lerp(this.yaw, targetYaw, 0.1);
```

### Regla 2: Quaterniones, nunca Euler para rotación final
```js
// ✅ CORRECTO — Gimbal-lock free
const qY = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
const qX = new THREE.Quaternion().setFromAxisAngle(RIGHT, pitch);
rig.quaternion.copy(qY).multiply(qX);  // DIRECT copy

// ❌ INCORRECTO — Gimbal lock a pitch=90°
rig.rotation.set(pitch, yaw, 0);
```

### Regla 3: Integración de velocidad independiente de framerate
```js
// ✅ CORRECTO — Exponential decay (framerate-independent)
velocity.multiplyScalar(Math.exp(-drag * dt));

// ❌ INCORRECTO — Frame-dependent
velocity.multiplyScalar(1 - drag * dt);  // cambia con fps
```

### Regla 4: Clamp de delta
```js
const dt = Math.min(delta, 0.05); // máximo 50ms por frame
// Previene saltos enormes al volver de tab-switch o lag
```

### Regla 5: FOV como velocímetro (critically-damped spring)
```js
// ζ=1 → sin oscilación, sin sobrepaso
const ωn = 8.0;
fovVel += (fovGoal - fov) * ωn * ωn * dt;
fovVel *= Math.exp(-2 * ωn * dt);
fov    += fovVel * dt;
```

### Regla 6: El banking (roll) no contamina el aim
```js
// ✅ El bank se aplica DESPUÉS del aim quaternion
const qBank = new Quaternion().setFromAxisAngle(FORWARD, bankAngle);
rig.quaternion.copy(aimQuat).multiply(qBank);
// El yaw/pitch del aim no se ve afectado
```

---

## 🌟 9. REGLAS VISUALES DEL COSMOS

### El espacio es oscuro — no como las películas
```
Fondo:    #000000  (negro absoluto — sin gradiente)
Sin luz ambiental global (excepción: halo tenue < 0.02 intensity)
Las estrellas como puntos — no blooms masivos a distancia
```

### Ley de cuadrado inverso de la luz
```
I = P / (4π · r²)

A doble distancia → ¼ de la intensidad
A triple distancia → ¹⁄₉ de la intensidad
```

### Tamaño angular (lo que el ojo ve)
```
θ = 2 · arctan(d / 2D)

d = diámetro del objeto
D = distancia al objeto
θ = ángulo visual en radianes

Si θ < 1 pixel → objeto invisible a esa distancia
```

### Bloom correcto para estrellas y planetas
```
Solo aplicar bloom a objetos con emissive > 0.7 (muy brillantes)
Threshold en engine: luminanceThreshold = 0.72
Intensidad: 1.6
Radio del bloom: 0.75
Tone mapping: ACES Filmic (mismo que cine profesional)
```

---

## 🌀 10. NEBULOSAS — REGLAS VISUALES

### Tipos y colores correctos
| Tipo | Causa | Color real | Opacity |
|------|-------|------------|---------|
| Emisión (HII) | Gas ionizado por estrellas O/B | Rojo `#ff3355` | Aditivo leve |
| Reflexión | Polvo refleja luz de estrellas | Azul `#3388ff` | Aditivo leve |
| Oscura | Nube de polvo frío sin iluminación | Negro (ausencia) | Opaco bajo |
| Planetaria | Envolvente de estrella moribunda | Teal `#00ffcc` | Anillo circular |
| Supernova | Explosión estelar | Naranja-rojo | Alta emissive |

### Distribución correcta
```
Nebulosas de emisión → EN los brazos espirales (donde nacen estrellas O/B)
Nebulosas de reflexión → Cerca de estrellas azules
Cúmulos globulares → EN EL HALO galáctico (fuera del disco)
Cúmulos abiertos → EN LOS BRAZOS (jóvenes, recién formados)
```
---

## 🧠 RESUMEN — REGLAS QUE LULU DEBE GUARDAR

```js
LULU.universe = {
  // Escalas
  galaxyDiameterLightyears: 100000,
  averageStarDistance_ly:   5.0,
  solarSystemRadius_AU:     120,
  
  // Física
  G_real:   6.674e-11,
  G_engine: 0.1,
  integrator: 'Semi-Implicit Euler',
  
  // Clasificación estelar
  stellarTypes: ['O','B','A','F','G','K','M'],
  stellarColors: {
    O: '#9bb0ff', B: '#aabfff', A: '#cad7ff',
    F: '#f8f7ff', G: '#fff4e8', K: '#ffd2a1', M: '#ffcc8f'
  },
  stellarDistribution: { M: 76, K: 12, G: 7, F: 3, OBA: 2 },
  
  // Estructura galáctica
  galaxyArms:  5,
  spiralScale: 100,   // SCALE = a en r = a·e^(b·θ)
  spiralWind:  0.26,  // WIND  = b
  
  // Cámara
  cameraRules: {
    mouseLook:    'DIRECT — zero lerp',
    rotation:     'Quaternion YXZ only',
    drag:         'Exponential: v *= exp(-drag*dt)',
    fov:          'Critically-damped spring ζ=1',
    shake:        'Event-triggered only, never continuous',
    floatingOrigin: true,
  },
  
  // Separación espacial
  minSeparation: {
    moonToPlanet:   '0.5× planet radius',
    planetToPlanet: '2× Hill radius',
    planetToStar:   '10× star radius',
    starToStar:     '5 light years minimum',
  },
  
  // Visual
  spaceBackground: '#000000',
  ambientLight:    0.015,
  bloomThreshold:  0.72,
  bloomIntensity:  1.6,
  toneMapping:     'ACES_FILMIC',
};
```
