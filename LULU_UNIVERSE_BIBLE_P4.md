# 📜 BIBLIA DEL UNIVERSO — POWDER GALAXY
## Parte 4: UI del Universo, HUD, Apps de Planeta y Sistema de Ventanas
> Motor OMEGA V30 · 2026-03-23  
> Esta parte cubre toda interacción visual entre el usuario y el universo.

---

## 🖥️ 1. HUD COSMOLÓGICO — Diseño y Reglas

### Filosofía del HUD en un simulador espacial
```
El HUD no debe:
  → Tapar el universo
  → Tener información innecesaria
  → Usar colores que compiten con el espacio

El HUD debe:
  → Ser completamente transparente (no opaque panels)
  → Aparecer solo cuando es necesario (fade in/out)
  → Usar el mismo idioma visual del universo (cyan/teal sobre negro)
  → Respetar el principio de "menos es más"
```

### Capas del HUD (z-index stack)
```
z-index  10  hud-layer     → telemetría, coordenadas
z-index  20  window-layer  → apps de planeta (ventanas flotantes)
z-index  30  kernel-bar    → LULU command bar
z-index  99  overlays      → modales, login, alerts
```

### Elementos del HUD actual
| Elemento | Layer | Condición de visibilidad |
|---|---|---|
| Coordenadas cámara | hud-layer | Siempre |
| Estado cámara (FREE/ORBIT) | hud-layer | Siempre |
| Target hover name | hud-layer | Solo en hover |
| FPS (F3) | global fixed | Toggle |
| LULU command bar | kernel-bar | Siempre |
| Ventanas de apps | window-layer | Solo en warp |

---

## 🪐 2. SISTEMA DE APPS DE PLANETA — Arquitectura

### El flujo completo
```
Usuario entra en warp a un planeta
           ↓
       WarpState.js ejecuta el viaje
           ↓
  [evento] WARP_FLIGHT_COMPLETE
           ↓
    UniverseKernel escucha el evento
           ↓
    Determina a qué planeta se warpó
           ↓
    WindowManager.open(appId)
           ↓
    Ventana flotante aparece en el espacio
```

### Mapa planeta → aplicación
| Planeta | Clase Visual | App | Función |
|---------|-------------|-----|---------|
| Terminal | volcanic | `Terminal` | CLI del sistema |
| Explorer | desert | `Explorer` | Sistema de archivos |
| Gallery | ocean | `Gallery` | Galería multimedia |
| Database | ice | `Database` | Base de datos visual |
| Hologram | gas_giant | `Hologram` | Visualizador 3D |
| Settings | jungle | `Settings` | Configuración del OS |

### Código del evento WARP_FLIGHT_COMPLETE
```js
// En WarpState.js — al completar el viaje
eventBus.emit('WARP_FLIGHT_COMPLETE', {
    targetName:  target.userData.name,
    targetClass: target.userData.planetClass,
    position:    target.position.clone(),
});

// En UniverseKernel.js — escuchando el evento
eventBus.on('WARP_FLIGHT_COMPLETE', ({ targetName }) => {
    const appId = planetAppMap[targetName] ?? 'Explorer';
    this.windowManager?.open(appId);
    console.log(`[Kernel] App opened: ${appId} for planet ${targetName}`);
});
```

---

## 🖱️ 3. SISTEMA DE INTERACCIÓN — Raycast y Selección

### Por qué el espacio causa problemas de hitbox
```
Un planeta a distancia 500u puede tener solo 3 píxeles de tamaño.
Es imposible hacer clic en él con un hitbox del tamaño del planeta.

Solución: HITBOXES INVISIBLES SOBREDIMENSIONADOS
```

### Arquitectura de hitboxes
```
PlanetMesh (radio real: 12u)
    ├── SphereGeometry radio=180u (invisible, transparent)
    │   userData.hitbox = true
    │   userData.planetRef = planetMesh
    └── AtmosphereMesh (Fresnel glow)

Sol (radio: 40u)
    └── Hitbox invisible radio=200u

Estrella del campo galáctico:
    └── Punto de 2px en pantalla = RaycastSelectionSystem detecta por esfera 10u
```

### Eventos de interacción
```js
// RaycastSelectionSystem emite:
eventBus.emit('HOVER_START', { target, distance });
eventBus.emit('HOVER_END', { target });
eventBus.emit('SELECT',     { target, button: 0 }); // click izquierdo
eventBus.emit('CONTEXT',    { target, button: 2 }); // click derecho → warp
```

---

## 📟 4. LULU — El Sistema de Inteligencia del Universo

### Rol de LULU
```
LULU = Lenguaje Universal de Lenguaje Universal
      (intencionalmente recursivo)

LULU es:
  → El asistente AI del motor
  → Una interfaz CLI dentro del universo
  → El sistema de consulta de la Universe Bible
  → Un motor de comandos que interactúa con el kernel
```

### Comandos disponibles
| Comando | Descripción |
|---------|-------------|
| `LULU.status` | Estado del engine |
| `LULU.camera` | Posición/estado actual de cámara |
| `LULU.galaxy` | Estadísticas de la galaxia |
| `LULU.universe.physics` | Leyes físicas del universo |
| `LULU.warp(target)` | Warp a un destino |
| `LULU.stellarType(T)` | Tipo espectral dado temperatura |

### LULU Knowledge Base (window.LULU_UNIVERSE)
El módulo `LULU_KNOWLEDGE.js` expone en `window.LULU_UNIVERSE`:
```js
window.LULU_UNIVERSE.physics       // leyes gravitacionales
window.LULU_UNIVERSE.galaxy        // estructura galáctica
window.LULU_UNIVERSE.stellarTypes  // clasificación espectral
window.LULU_UNIVERSE.camera        // reglas de cámara
window.LULU_UNIVERSE.diagnostics   // guías de debug
```

---

## 🪟 5. WINDOW MANAGER — Ventanas del Universo

### Diseño de ventanas
```
Las ventanas de planeta son SIEMPRE:
  → Glassmorphism (fondo translúcido con blur)
  → No rectangulares (border-radius generoso)
  → Flotantes en el espacio (no en pantalla fija)
  → Con profundidad de campo (el background se desenfoca levemente al abrir)
```

### CSS variables del sistema de ventanas
```css
--window-bg:      rgba(0, 5, 20, 0.85);
--window-border:  rgba(0, 255, 200, 0.2);
--window-blur:    blur(24px);
--window-shadow:  0 8px 60px rgba(0, 200, 255, 0.15);
--window-radius:  18px;
--text-primary:   #e8f4ff;
--text-accent:    #00ffcc;
--text-dim:       #667788;
```

### Animación de apertura
```js
// GSAP timeline para ventana
const tl = gsap.timeline();
tl.fromTo(win, 
    { opacity: 0, scale: 0.8, y: 40 },
    { opacity: 1, scale: 1.0, y: 0, duration: 0.45, ease: 'back.out(1.4)' }
);
```

---

## 🌐 6. MODO STELLAR (STARLYI) — Vista del Sistema Solar

### Descripción
```
El modo STELARYI es una cámara de órbita libre alrededor del sistema solar.
No hay gravedad real — solo órbita de cámara.

Activa cuando:
  → Usuario hace clic en el sol
  → FSM transiciona a STELARYI state

Se desactiva con:
  → ESC → vuelve a FREE_FLIGHT
```

### Configuración visual
```
FOV:           90° (vista más amplia que free flight)
Orbit radius:  500–5000u del sol
Orbit speed:   Drag del mouse = rotación
Look target:   Siempre el sol en el centro
```

---

## 🎬 7. TRANSICIONES CINEMÁTICAS

### Warp Flight
```
1. Entrada warp:   FOV → 140°, partículas de warp en shader
2. Vuelo:          Tunnel de velocidad, estrellas elongadas
3. Llegada:        FOV → 60°, planeta aparece grande
4. Complete:       WARP_FLIGHT_COMPLETE evento
```

### Implementación actual en WarpState.js
```js
// Entrada
gsap.to(cameraRig, { fov: 140, duration: 0.8, ease: 'power2.in' });

// Llegada
gsap.to(cameraRig, { fov: defaultFov, duration: 1.2, ease: 'power2.out' });
```

---

## 🧠 DATOS PARA LULU — Parte 4

```js
LULU.universe.part4 = {
    hudLayers: {
        hud:    10, windows: 20, kernelBar: 30, overlays: 99
    },
    planetApps: {
        Terminal: 'volcanic', Explorer: 'desert', Gallery: 'ocean',
        Database: 'ice', Hologram: 'gas_giant', Settings: 'jungle',
    },
    hitboxMultipliers: {
        planet: 15.0,  // hitbox = 15x actual radius
        sun:    5.0,
        star:   10.0,  // engine units for invisible sphere
    },
    warpEvents: ['WARP_FLIGHT_COMPLETE', 'WARP_START', 'WARP_ABORT'],
    windowAnimation: { duration: 0.45, ease: 'back.out(1.4)' },
    cameraStates: ['FREE_FLIGHT','ORBIT','FOCUS','WARP','STELARYI','COCKPIT','SOLAR_SYSTEM'],
    cameraAliases: { WARPING: 'WARP', WORLD_FOCUS: 'FOCUS' },
};
```

---

## 8. VISOR INTERNO MK-II - Regla de 5 A�os de Refinamiento

```
El HUD de Powder Galaxy ya no debe sentirse como overlays sueltos.
Debe sentirse como el interior de un casco premium:
  -> informacion en bordes
  -> matematicas cuando aportan decision
  -> transmisiones integradas al visor
  -> centro visual protegido para leer el universo 3D
```

### Nueva jerarquia de superposicion
```
hud-layer      -> casco, tracking, bandas de contexto
window-layer   -> ventanas activas y bandeja de minimizados
kernel-bar     -> dock principal del sistema
alerts         -> absorbidas por el casco; no paneles flotantes externos
```

### Reglas duras del nuevo visor
- Una notificacion de dron no abre un cartel flotante; se integra al casco como transmision contextual.
- Una ventana minimizada no se transforma en burbuja `ABRIR`; se repliega a una bandeja limpia y recuperable.
- El visor puede mostrar formulas, pero solo una capa matematica principal a la vez.
- El dock debe comunicar estado de cada modulo: activo, minimizado o cerrado.
- El usuario debe poder seguir pilotando mientras la informacion secundaria respira en los bordes.

## 9. PANEL MATEMATICO DEL CASCO

### Formulas recomendadas por tipo de objetivo
```js
PLANET_OR_STAR: 'v_e = sqrt(2GM / r)'
SATELLITE:      'omega = sqrt(GM / r^3)'
DRONE:          'tau = d / c'
SOLAR_MODE:     'T = 2pi * sqrt(r^3 / GM)'
```

### Variables de lectura canonica
```js
bodyProfile = {
  classification,
  analog,
  trackingSignature,
  hazard,
  temperatureK,
  gravityG,
  massEarths?,
  massSolar?,
  orbitalPeriodDays?
}
```

### Regla de visualizacion
- Si no hay objetivo real, el panel matematico debe desaparecer o bajar a reposo.
- Si hay objetivo, la tarjeta matematica debe priorizar gravedad, temperatura, velocidad de escape, densidad y periodo de referencia.
- Si el dato es una aproximacion derivada del analog profile, el copy del visor debe tratarlo como proxy, no como simulacion exacta.
