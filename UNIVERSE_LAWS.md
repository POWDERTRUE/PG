# UNIVERSE LAWS — Powder Galaxy Engine
> Reglas físicas universales del Motor OMEGA V31  
> Actualizado: 2026-04-07 | Motor OMEGA V31  
> Este documento es fuente de verdad. Todo sistema del engine debe respetar estas leyes.

---

## ⚖️ LEY 0 — Ley de Identidad del Motor

```
Powder Galaxy es un Sistema Operativo de Universo.
No es un juego. No es una demo. Es una plataforma viviente.
```

Cada objeto en la escena es una **masa** con propiedades físicas reales.  
El engine no simula — **computa la realidad**.

---

## 🌌 LEY 1 — Gravedad Universal

**Fuente:** `CelestialPhysicsSystem.js`, `OrbitalMechanicsSystem.js`

```
F = G · m₁ · m₂ / r²
```

| Constante | Valor Engine | Real |
|---|---|---|
| G (Gravitacional) | `0.1` | `6.674 × 10⁻¹¹ N·m²/kg²` |
| Unidad de masa | 1u = 1e10 kg | — |
| Unidad de distancia | 1u = 1000 km | — |
| MAX_DT (timestep cap) | `0.1 s` | — |

**Integración Principal:** Runge-Kutta 4 (RK4) — cero drift orbital a largo plazo
> Actualizado V31. Reemplazó Semi-Implicit Euler por mayor estabilidad energética.

```js
// RK4 — cuatro evaluaciones del gradiente gravitacional por frame:
// k1 = f(pos,           vel)
// k2 = f(pos + h/2·k1, vel + h/2·k1_vel)
// k3 = f(pos + h/2·k2, vel + h/2·k2_vel)
// k4 = f(pos + h·k3,   vel + h·k3_vel)
// pos += h/6 · (k1 + 2k2 + 2k3 + k4)
// vel += h/6 · (k1_vel + 2k2_vel + 2k3_vel + k4_vel)
// ZERO GC: todos los buffers Vector3 pre-alocados en constructor (_initRK4Buffers)
```

**Consecuencias:**
- Planetas en órbita elíptica estable (si no hay perturbaciones externas)
- Estrellas centrales rotan sobre su eje (spin)
- Lunas orbitan planetas con velocidad kepleriana

### 🔧 Subsistema LEY 1 — Arquitectura de Física Dual

**Fuente:** `CelestialPhysicsSystem.js` + `OrbitalMechanicsSystem.js`

La física orbital del motor opera en dos capas complementarias y no intercambiables:

**`CelestialPhysicsSystem` — Precisión Matemática (Cerebro)**
- Responsable de la resolución de integrales de movimiento para cuerpos con influencia gravitatoria compleja.
- Integrador: **RK4 4th Order** — estabilidad energética a largo plazo, cero drift orbital.
- Gestiona: cuerpos del sistema solar visible (`orbitalNodes[]`), registros directos con historia de velocidad.
- Fase scheduler: `physics` — primera en ejecutarse en el frame.

**`OrbitalMechanicsSystem` — Brazo Ejecutor de Bajo Latencia (Sistema Circulatorio)**
- Subsistema de alto rendimiento diseñado para trayectorias predecibles sin asignación de memoria dinámica.
- Integrador: **Semi-Implicit Euler** sobre cuerpos ECS ligeros (`CelestialRegistry`).
- Función principal: gestionar el renderizado de órbitas estables y proyectadas mediante buffers pre-asignados, evitando micro-stutters durante el Garbage Collector del runtime.
- Fase scheduler: `simulation` — posterior a `physics`, lee resultados del frame anterior.

| Dimensión | `CelestialPhysicsSystem` | `OrbitalMechanicsSystem` |
|---|---|---|
| Rol | Precisión (RK4) | Rendimiento (Zero-GC) |
| Fuente de datos | `orbitalNodes[]` | `celestialRegistry.getDynamicBodies()` |
| Fase scheduler | `physics` | `simulation` |
| GC por frame | ≈ 0 (12 buffers RK4 pre-alocados) | ≈ 0 (3 Vector3 reutilizados) |
| Cuerpos objetivo | Sistema solar visible | Cuerpos ECS del CelestialRegistry |

**Regla de exclusividad:** Ambos sistemas coexisten bajo la LEY 1 como dos modos de ejecución de un único sistema físico. Nunca registrar el mismo cuerpo en ambos simultáneamente — viola la unicidad del estado orbital.

---

## 🌀 LEY 2 — Espiral Logarítmica Galáctica

**Fuente:** `GalaxyGenerationSystem.js`, `StarClusterSystem.js`, `UniverseSpec.js`

La posición de cada estrella en un brazo espiral sigue:

```
r = a · e^(b · θ)
```

| Parámetro | Valor | Significado |
|---|---|---|
| `a` (armA / SCALE) | `350` | Escala base del brazo |
| `b` (armB / WIND) | `0.28` | Tightness del brazo (0 = anillo, ∞ = recto) |
| `ARMS` | `5` | Número de brazos espirales |
| `ARM_THICKNESS` | `120u` | Dispersión radial de cada brazo |
| `diskRadius` (R_MAX) | `5000u` | Radio máximo del disco galáctico |
| `haloRadius` | `11000u` | Radio del halo estelar externo |
| `totalDiameter` | `22000u` | Diámetro total del universo simulado |

**Capas estructurales:**

| Capa | Estrellas | Distribución | Clave |
|---|---|---|---|
| Core | 12k | Gaussiana, radio=280u, altura=40u | `coreStars` |
| Bulge | 18k | Esférica oblata, radio=1200u, altura=600u | `bulgeStars` |
| Bar | 9k | Barra galáctica central, longitud=1800u, ángulo=25° | `barStars` |
| Spiral Arms | 63k | r = a·e^(b·θ) + jitter(ARM_THICKNESS) | `armStars` |
| Inter-arm Disk | 6k | Radial ponderada, excluye zona de brazos | `interArmStars` |
| Halo | 12k | Esférica uniforme, r=3000→11000u | `haloStars` |
| **TOTAL** | **120k** | Campo galáctico principal | `totalMainStars` |

---

## 🔭 LEY 3 — Niveles de Detalle (LOD)

**Fuente:** `GalaxyGenerationSystem.update()`, `StarClusterSystem.updateLOD()`

El universo se adapta a la resolución perceptual del observador:

| Distancia al Centro | LOD | Lo que ve el observador |
|---|---|---|
| > 5000u | `FAR` | Disco galáctico completo, partículas pequeñas |
| 1500–5000u | `MID` | Brazos visibles, cúmulos, nebulosas |
| 500–1500u | `NEAR` | Cúmulos individuales, nebulosas vívidas |
| < 100u | `SYSTEM` | Sistema solar local, galaxia invisible |

**Regla:** Nunca renderizar lo que no necesita renderse.

---

## ✦ LEY 4 — Ley de la Masa Primordial y Coordenada Cero

**Fuente:** `SupraconsciousnessMass.js`, `CelestialPhysicsSystem.js`

```
La SupraconsciousnessMass no es una entidad física estándar.
Es el ORIGEN DEL GRAFO DE ESCENA — la Coordenada Cero del universo.
Inmóvil. Eterna. Masa ∞ para efectos de cálculo relativo.
Todo sistema, estrella y cuerpo celeste existe en relación a ella.
```

| Propiedad | Valor | Garantía |
|---|---|---|
| Posición | `(0, 0, 0)` | Permanente. Ningún proceso puede moverla. |
| Masa gravitacional | `1 000 000` (Sagitario A*) | Constante de cosmos — no parametrizable. |
| ID en Registry | `SupraconsciousnessMass` | Registrada en boot, nunca reemplazada. |
| nodeType | `supraconsciousness` | Excluida de queries ordinarias de masa. |
| Rol en escena | `FixedUpdate` de referencia del sistema de coordenadas | Base matemática de todo cálculo orbital. |
| Rasgo visual | Singularidad violeta-negra + disco de acreción + 3 anillos gravitacionales | — |

**Protocolo de registro orbital (obligatorio):**

Todo objeto que entre en el radio de influencia del núcleo galáctico **debe** invocar:

```js
// Único punto de entrada canónico para órbitas galácticas (CelestialPhysicsSystem):
physicsSystem.registerOrbitAroundSupraconsciousness(node, supramass = 1_000_000);
// → Calcula v = sqrt(G · M / r) tangencial al disco galáctico (plano XZ)
// → Marca el nodo con _isGalacticOrbit = true
// → Nunca inventar una masa virtual local — viola la unicidad del Punto Cero
```

**Inmunidad al Garbage Collector del Cosmos:**
- La `SupraconsciousnessMass` no puede ser desplazada, escalada, eliminada ni reemplazada por ningún proceso de limpieza dinámica del engine.
- A diferencia de los nodos de la LEY 5, esta masa no participa en ciclos de dispose ni en pools de reutilización.
- Cualquier sistema que intente removerla del grafo de escena debe ser considerado un bug crítico de arquitectura.

**Reglas de aislamiento:**
- Ningún sistema puede inventar un centro gravitacional alternativo — solo existe **uno**.
- No puede ser objetivo de `SOLAR_SYSTEM`, reordenamiento, ni snapshot de usuario.
- Su hitbox (`Hitbox_SupraconsciousnessMass`) está excluida de todas las listas de selección de masas ordinarias.
- La `PointLight` interna (`SupraconsciousnessLight`, intens=3.5, r=8000u) es la única fuente de luz central del universo — no duplicar.

---

## 🌍 LEY 5 — Jerarquía de Masas

```
Universe
 └── SupraconsciousnessMass (LEY 4) — Punto (0,0,0), inamovible
      │
      └── Galaxy (GalaxyGenerationSystem)
           ├── GalacticCore
           ├── Bar (barra central, ángulo=25°)
           ├── SpiralArms[5]
           ├── Halo
           ├── StarClusterSystem
           │    ├── GlobularClusters[25]  → 280 stars each
           │    └── OpenClusters[45]      → 120 stars each
           └── NebulaSystem
                ├── EmissionNebulae[18]   → HII (red)
                ├── ReflectionNebulae[12] → dust (blue)
                └── PlanetaryNebulae[8]   → dying stars (teal)

SolarSystem (GalaxyGenerator) ← orbita SupraconsciousnessMass
 └── MegaSun (star, pivot, G-mass anchor)
      ├── Planet[0] Terminal   — class: volcanic  (1 luna)
      ├── Planet[1] Explorer   — class: desert    (2 lunas)
      ├── Planet[2] Gallery    — class: ocean     (2 lunas)
      ├── Planet[3] Database   — class: ice       (3 lunas)
      ├── Planet[4] Hologram   — class: gas_giant + rings (5 lunas)
      └── Planet[5] Settings   — class: jungle    (2 lunas)
```

**Regla:** Todo objeto con `userData.isMass = true` participa en la física.

---

## ⚡ LEY 6 — Sector Streaming

**Fuente:** `UniverseStreamingSystem.js`

El universo se divide en sectores de `2000 × 600 × 2000` unidades.

```
Sector Key = (ix, iy, iz)  donde:
  ix = round(camera.x / 2000)
  iy = round(camera.y / 600)
  iz = round(camera.z / 2000)
```

**Reglas de carga:**
- Radio de carga: ±2 sectores en XZ, ±1 en Y
- Solo activo más allá de `diskRadius` (5000u) del centro
- Universo infinito hasta r = 22000u (≈ 22 veces el campo galáctico)
- Stars por sector: 2400 (seeded LCG determinista por índice)

---

## 🎮 LEY 7 — Cámara y Navegación (CameraFSM)

**Fuente:** `UniverseNavigationSystem.js`, `CameraStateMachine.js`, `states/`

El observador opera con dos capas de estados de cámara:

**Capa FSM** — `CameraStateMachine.js` (`CAMERA_STATE`) — 6 estados con transiciones validadas:

| Estado | Trigger | Comportamiento |
|---|---|---|
| `FREE_FLIGHT` | Inicio / ESC | WASD + mouse-look, física de velocidad |
| `ORBIT` | Selección contextual | Órbita técnica alrededor del target |
| `FOCUS` | Fin de `WARP` | Bloqueo orbital fino sobre el target |
| `WARP` | Click contextual / comando | Vuelo cinemático GSAP al target |
| `ORBITAL_DESCENT` | Comando de aterrizaje | Descenso superficial con terrain patch |
| `COCKPIT` | Tecla `C` | First-person con física de nave (ShipRig) |

**Capa Extendida** — `UniverseNavigationSystem.js` (`CAMERA_STATES`) — gestionados directamente sin transiciones FSM validadas:

| Estado | Trigger | Comportamiento |
|---|---|---|
| `MOUSE_UI` | Cualquier apertura de UI | Cursor liberado, vuelo suspendido |
| `STELARYI` | Botón HUD | Alineación orbital del sistema |
| `SOLAR_SYSTEM` | Comando / botón | Modo reorganización del sistema solar |
| `FIRST_PERSON_WALK` | Trigger de landing | Caminata en superficie de planeta |
| `MAP_MODE` | Modo galería | Layout 3D de masas tipo museo |

**Aliases activos:**
`WARPING → WARP`, `WORLD_FOCUS → FOCUS`.

**Controles FREE_FLIGHT:**
```
W/S         → adelante/atrás
A/D         → strafe izquierda/derecha
Q/E         → subir/bajar
Shift       → velocidad ×5
Click+Drag  → yaw + pitch
ESC         → liberar puntero / volver al estado anterior
```

**🛠️ Enmienda a REGLA 6 — Clasificación de Controladores de Inspección:**

Se establece una distinción formal entre **Navegación de Usuario** y **Herramientas de Diagnóstico**:

| Tipo | Ejemplos | Régimen |
|---|---|---|
| Navegación de Usuario | `CameraFSM`, todos los estados de LEY 7 | Producción — siempre activo |
| Herramienta de Diagnóstico | `godControls` (TrackballControls) | Dev-only — `enabled = false` por defecto |

**`godControls` — Nota Técnica de Excepción:**
- Clasificado exclusivamente como **Dev-Tool**. No forma parte del bundle de producción.
- Su uso queda restringido a: inspección de colisiones, debugging de cámara y validación de posicionamiento de masas.
- Estado por defecto: `enabled = false` — nunca activo durante gameplay normal.
- Eliminación en producción: dynamic import bajo `import.meta.env.DEV !== false` garantiza tree-shaking completo.
- Su existencia no invalida la prohibición de OrbitControls para la experiencia final del usuario.

---

## 🔴 REGLAS CRÍTICAS

1. **No doble-tick** — Un sistema que llama `update()` en FrameScheduler NO debe tener su propio `requestAnimationFrame`
2. **No mutación de matrices en render** — Toda posición se actualiza en la fase `simulation`, no en `render`
3. **No TextGeometry en producción** — Usa HTML + CSS para texto de UI
4. **No modificar la SupraconsciousnessMass** — Su posición (0,0,0) y masa (1 000 000) son constantes del cosmos. Ningún sistema puede desplazarla, escalarla o reemplazarla como centro gravitacional.
5. **No MeshStandardMaterial sin PlanetShaderSystem** — Todo planeta tiene atmósfera y textura procedural
6. **No OrbitControls como sistema de navegación** — Solo CameraFSM. `godControls` es una **Dev-Tool** clasificada, no un sistema de usuario. Ver Enmienda a REGLA 6 en LEY 7.
7. **No comentarios JSDoc desactualizados** — El JSDoc de un método debe reflejar el integrador/algoritmo real que ejecuta. Un comentario `Semi-Implicit Euler` sobre código RK4 es un bug de documentación de severidad ALTA.
8. **No micro-stutters por GC en física** — Instanciación dinámica prohibida en fases `physics` y `simulation`. Ver **§ REGLA 8 — Especificación Completa** abajo.

---

## 🔴 REGLA 8 — Especificación Completa: Zero-GC Enforcement

### Problema Técnico

Cuando el GC del navegador se activa para limpiar objetos matemáticos temporales, la CPU se detiene durante 1–16 ms. A 60 FPS, bastan 10 `new Vector3()` por frame para generar 600 objetos/segundo — patrón de memoria en "sierra". El resultado: micro-stutters que arruinan la fluidez orbital.

### Contrato Formal

```json
{
  "kernel_version": "2.0.0",
  "rules": {
    "RULE_8": {
      "id": "ZERO_GC_ENFORCEMENT",
      "forbidden_tokens": ["new Vector3", "new Quaternion", "new Matrix4", "new Euler", "new Box3", "new Spherical"],
      "scope": ["physics", "simulation"],
      "enforcement": "Strict_Error",
      "allowed_contexts": ["constructor", "_init", "_build", "registerOrbit", "arrangeInMapMode"],
      "scanner": "tools/zero-gc-lint.js",
      "ci_exit_code": 1
    }
  }
}
```

### Código Prohibido ❌

```js
// VIOLACIÓN REGLA 8 — new dentro de update()
update(dt) {
    const deltaPos = new THREE.Vector3(0, 1, 0).multiplyScalar(dt); // ← GC pressure
    const dir = new THREE.Vector3().subVectors(a, b).normalize();   // ← GC pressure
    this.position.add(deltaPos);
}
```

### Patrón Obligatorio ✅ (Scratch Variable)

```js
// Constructor — asignación única, cero GC posterior
constructor() {
    this._scratchPos = new THREE.Vector3(); // ← asignado UNA vez
    this._scratchDir = new THREE.Vector3(); // ← asignado UNA vez
}

// update() — reutilización, CERO allocations
update(dt) {
    this._scratchPos.set(0, 1, 0).multiplyScalar(dt); // ← reutiliza buffer
    this._scratchDir.subVectors(a, b).normalize();     // ← reutiliza buffer
    this.position.add(this._scratchPos);
}
```

### Validador Técnico (Bloqueo Real)

```bash
# Auditoría normal (output en consola)
npm run lint:gc

# Modo strict — exit code 1 si hay violaciones (bloquea CI/pre-commit)
npm run lint:gc:strict

# Genera zero-gc-report.json para revisión del equipo
npm run lint:gc:report
```

**Fuente:** `tools/zero-gc-lint.js` — escanea automáticamente `frontend/src/engine/physics/` y archivos adicionales de fase `simulation`.

### Estado Actual del Motor

| Sistema | Fase | Estado REGLA 8 |
|---|---|---|
| `CelestialPhysicsSystem.update()` | `physics` | ✅ Zero-GC — 12 buffers RK4 pre-alocados en `_initRK4Buffers()` |
| `OrbitalMechanicsSystem.update()` | `simulation` | ✅ Zero-GC — `_rVector`, `_forceVector`, `_acceleration` en constructor |
| `UniverseNavigationSystem._layoutSolarSystem()` | `navigation` | ✅ Corregido V31 — `_layoutWorldTarget` pre-alocado |

---


## 📊 Telemetría en tiempo real

Disponible en `window.engine`:
```js
window.engine.physicsSystem.orbitalNodes.length  // # cuerpos orbitales (CelestialPhysicsSystem)
window.engine.sectorStreamingSystem.loadedSectorCount  // # sectores activos
window.engine.navigationSystem.state            // estado FSM actual
window.engine.sceneGraph.scene.children.length  // # objetos en escena
```

---

## LEY 8 - Modo Solar Curado

**Fuente:** `UniverseNavigationSystem.js`, `GalaxyGenerator.js`

El modo `SOLAR_SYSTEM` solo puede reorganizar masas que pertenezcan al mismo
`SolarSystem_Core` que la masa ancla.

**Reglas:**
- Quedan excluidos todos los `Hitbox_*`.
- Quedan excluidas las estrellas nombradas, clusters, nebulosas y cualquier masa de fondo galactico.
- Quedan excluidas las masas de la LEY 4 (`SupraconsciousnessMass`).
- La seleccion inicial del modo solar debe ser la masa ancla actualmente enfocada por el observador.
- Si la camara esta en `WARP`, la entrada a `SOLAR_SYSTEM` debe bloquearse hasta terminar el enfoque.

**Conjunto valido minimo del sistema local:**
- `MegaSun`
- `Planet_*`
- `Moon_*`
- `MetamorphSatellite_*`

---

## LEY 9 - Satelites Interactivos y Drones

**Fuente:** `GalaxyGenerator.js`, `InteractionEventSystem.js`, `NotificationDroneSystem.js`

Todo satelite interactivo debe declararse de forma explicita:

```js
userData.isSatellite = true;
userData.spatialType = 'SATELLITE';
userData.parentMass = <masa_padre>;
```

Todo dron de notificacion debe declararse de forma explicita:

```js
userData.isDrone = true;
userData.spatialType = 'DRONE';
```

**Reglas:**
- Un satelite nunca puede quedar huerfano de `parentMass`.
- Un dron flotante nunca puede depender de inferencia ambigua (`isNotifier` solo no basta).
- La cadena `SATELLITE -> DRONE -> HOLOGRAMA` debe seguir viva aunque falle una transicion cinematica de camara.

---

## LEY 10 - Fallbacks Cinematicos

**Fuente:** `NotificationDroneSystem.js`

Las secuencias cinematicas son deseables, pero no pueden bloquear una accion critica.

**Reglas:**
- Si una llegada de camara no confirma en el tiempo esperado, el sistema debe usar un fallback temporal determinista.
- Un fallback puede completar la entrega visual, pero no debe duplicar paneles ni spawns.
- Toda notificacion holografica debe ser idempotente: si el panel ya existe, se ignora el segundo disparo.

---

## REGLAS CRITICAS NUEVAS

8. **No contaminar `SOLAR_SYSTEM`** - El modo solar no puede recorrer `scene` completa; debe operar solo sobre el sistema raiz de la masa enfocada.
9. **No hitboxes como masas visibles** - Ningun `Hitbox_*` puede entrar a listas de seleccion, reordenamiento o snapshots de usuario.
10. **No satelites sin tipo** - Si un objeto abre la ruta de notificaciones, debe identificarse como `SATELLITE`.
11. **No drones invisibles al input** - Todo dron debe exponer `isDrone` o `spatialType = 'DRONE'` para raycast, HUD e interaccion.

---

## LEY 11 - Visor Astronauta LULU

**Fuente:** `HUDManager.js`, `glass.css`, `InputStateSystem.js`

El HUD principal deja de comportarse como un panel de debug flotante y pasa a
simular el visor interno de un casco astronautico.

**Reglas:**
- El centro del campo visual debe seguir libre; la informacion permanente vive en bordes y bandas del casco.
- El visor debe leer estados reales del motor: modo de camara, estado del puntero, sectores activos, masa trazada y telemetria de rumbo.
- Cuando `CTRL` activa `hudMode`, el visor debe anunciar "raton libre" y cambiar sus mensajes de ayuda a interaccion directa.
- Las lecturas de objetivo deben vivir en una tarjeta fija y estable; no deben perseguir al cursor ni tapar la masa seleccionada.

---

## LEY 12 - Perfiles Astronomicos de Masa

**Fuente:** `UniverseSpec.js`, `GalaxyGenerator.js`

Toda masa importante del sistema local debe portar un perfil astronomico
legible por el visor y por futuros sistemas de telemetria.

**Reglas:**
- Estrellas, planetas, lunas, satelites y drones deben exponer `bodyProfile` o resolver uno por su clase canonica.
- `bodyProfile` debe incluir, como minimo, `classification`, `analog`, `trackingSignature` y `hazard`.
- El sistema local debe empujar gradualmente sus cantidades de lunas y analogos fisicos hacia referencias reales sin romper el rendimiento.
- Las masas nuevas deben poder heredarse desde `ASTRONOMY_BODY_PROFILES` antes de inventar metadata aislada en cada sistema.

---

## REGLAS CRITICAS NUEVAS II

12. **No HUD sin contexto real** - Ningun panel del visor puede mostrar etiquetas cinematicas vacias si el kernel ya expone datos vivos mas utiles.
13. **No raton libre ciego** - Si `hudMode` esta activo, el usuario debe ver claramente que el cursor esta libre y que accion produce el click actual.
14. **No masa importante sin firma** - Toda masa visible para tracking debe resolver una firma, un analogo o una clase valida para el casco.

---

## LEY 13 - No Burbujas de Apertura

**Fuente:** `WindowDOMSystem.js`, `glass.css`

Las ventanas minimizadas del universo no pueden degradarse a globos flotantes,
pildoras `ABRIR` o artefactos de esquina que rompan la ilusion del casco.

**Reglas:**
- Minimizar una ventana debe enviarla a una bandeja o dock recuperable.
- Una ventana minimizada no puede perseguir masas 3D ni vivir pegada al borde izquierdo como fallback visual.
- Todo sistema legado de burbujas debe quedar desactivado o invisibilizado.

---

## LEY 14 - Notificaciones Solo Dentro del Casco

**Fuente:** `NotificationDroneSystem.js`, `HUDManager.js`, `WindowDOMSystem.js`

Las transmisiones de drones y satelites son parte del visor, no paneles externos.

**Reglas:**
- `SHOW_LARGE_NOTIFICATION` debe resolverse en una transmision del casco, no en un modal flotante independiente.
- El visor debe permitir cierre explicito y emitir `NOTIFICATION_DISMISSED` al confirmar.
- Las transmisiones no pueden tapar el centro del viewport ni romper el control de vuelo.

---

## REGLAS CRITICAS NUEVAS III

15. **No hover con efectos laterales destructivos** - Mirar una masa no puede abrir o minimizar ventanas por si solo.
16. **No overlay compitiendo con el universo** - El centro y la franja baja media deben permanecer legibles durante juego normal.
17. **No matematicas decorativas** - Si el visor muestra una formula, debe corresponder al tipo de objetivo o al modo de navegacion vigente.

---

## LEY 15 — Contrato de Masa: CelestialBody

**Fuente:** `CelestialBody.js`, `MaterialRegistry.js`

```
Todo objeto en escena con masa física real DEBE heredar de CelestialBody.
El Kernel no admite excepciones. La deuda técnica se paga en el mismo PR.
Si tiene isMass:true, tiene CelestialBody como base. Sin excepción alguna.
```

| Propiedad Obligatoria | Tipo | Garantía |
|---|---|---|
| `mass` | `number` | Masa gravitacional en u-engine. Nunca undefined. |
| `radius` | `number` | Radio físico en u-engine. Nunca undefined. |
| `nodeType` | `string` | Tipo canónico del registro de masas. |
| `bodyProfile` | `object` | Firma de tracking para el visor HUD (LEY 12). |
| `buildUserData()` | `method` | Genera el `userData` canónico Three.js. |
| `dispose()` | `method` | Libera geometría, material y referencia de escena. |

**Scratch Pool de Módulo — Propiedad exclusiva de `CelestialBody.js`:**

```js
// Nivel de módulo — alojados UNA vez para la clase base Y todas sus subclases
export const _v1 = new THREE.Vector3();   // scratch Vector3 #1
export const _v2 = new THREE.Vector3();   // scratch Vector3 #2
export const _v3 = new THREE.Vector3();   // scratch Vector3 #3
export const _q1 = new THREE.Quaternion(); // scratch Quaternion

// Importar en subclase para uso en update() — CERO new THREE.Vector3():
import { CelestialBody, _v1, _v2, _v3, _q1 } from './CelestialBody.js';
```

**Protocolo de migración escalonada:**

```
1. Implementar CelestialBody.js (base class + scratch pool)
2. Migrar el nodo más periférico (Planet_Terminal — class: volcanic)
3. Ejecutar zero-gc-lint.js + monitorizar FPS (≥ 58 FPS en 60Hz target)
4. Si test verde → migrar uno a uno: Explorer → Gallery → Database → Hologram → Settings
5. Lunas, satélites y MegaSun al final del ciclo de migración
```

**MaterialRegistry — Punto de entrada único para shaders compartidos:**

```js
// ✅ CORRECTO — una compilación por tipo+color, VRAM mínima:
const mat = MaterialRegistry.get('glass-silicone', 0x00f2ff);
const mat = MaterialRegistry.get('moon-surface', { color: 0x443322, roughness: 0.95 });

// ❌ INCORRECTO — viola REGLA 19, crea compilación duplicada en VRAM:
const mat = new GlassSiliconeMaterial(0x00f2ff);
```

**Reglas:**
- Un asteroide, planeta, luna, satélite o estrella custom que NO herede `CelestialBody` es deuda técnica activa y debe migrarse en el mismo PR que lo introduce.
- El scratch pool de módulo (`_v1`, `_v2`, `_v3`, `_q1`) es propiedad exclusiva de `CelestialBody.js`. Las subclases que necesiten vectores adicionales deben declararlos con nombres distintos (`_v4`, `_v5`) para evitar conflictos de aliasing en callbacks síncronos.
- `MaterialRegistry.get()` es el único constructor de materiales compartidos. Cualquier `new GlassSiliconeMaterial()` directa en código de producción viola esta ley.
- La referencia inversa `userData.celestialBodyInstance` permite al HUD, al raycast y a los sistemas de física recuperar la instancia sin traversal de escena.

---

## REGLAS CRÍTICAS NUEVAS IV

18. **No masa sin CelestialBody** — Toda entidad con `isMass: true` debe ser una instancia de `CelestialBody`. El linter verificará `userData.celestialBodyInstance` en el reporte de auditoría.
19. **No shader duplicado** — `MaterialRegistry.get()` es el único constructor de materiales compartidos. `new GlassSiliconeMaterial()` directa en runtime (fuera de `MaterialRegistry`) viola esta regla y penaliza la VRAM.
