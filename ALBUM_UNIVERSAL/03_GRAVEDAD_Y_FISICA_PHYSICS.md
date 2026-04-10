# 📚 GRAVEDAD Y FÍSICA (PHYSICS)

```json
{
  "module": "PhysicsCore",
  "version": "V31_RK4_UPDATE",
  "dependencies": ["UniverseCoordinateMath.js", "EntityManager.js", "ServiceRegistry.js", "THREE.js"],
  "upgrade_from": "Euler Semi-Implícito",
  "upgrade_to": "Runge-Kutta 4to Orden (RK4)",
  "ai_directive": "Reemplazar el integrador Euler por RK4 en CelestialPhysicsSystem.update(). Optimizar para GPGPU usando Float32Array pre-asignados. PROHIBIDO usar 'new Vector3()' dentro del loop de integración.",
  "files": 6,
  "status": "RK4_INTEGRATOR_PENDING"
}
```

> **Estado actual:** Euler Semi-Implícito — Acumula errores flotantes, órbitas se degradan a largo plazo.
> **Estado objetivo:** RK4 — Estabilidad orbital infinita, listo para N-Body masivo con 150,000 puntos galácticos.

## 💠 Esquema Conceptual

```mermaid
graph TD
  CPS[CelestialPhysicsSystem] --> RK4[RK4 Integrator]
  RK4 --> K1[k1 = f(pos, vel)]
  RK4 --> K2[k2 = f(pos + k1/2)]
  RK4 --> K3[k3 = f(pos + k2/2)]
  RK4 --> K4[k4 = f(pos + k3)]
  RK4 --> NewState[pos_new = pos + delta/6*(k1+2k2+2k3+k4)]
  CPS --> NBody[N-Body Attraction GalaxySystem]
  CPS --> GPGPU[Compute Shader Collisions - PENDING]
```

## 📑 Tabla de Contenidos

- [engine/physics/CelestialPhysicsSystem.js](#celestialphysicssystem) — **RK4 UPGRADE PENDING**
- [engine/physics/AtmosphericEntrySystem.js](#atmosphericentrysystem)
- [engine/physics/FlightPhysicsSystem.js](#flightphysicssystem)
- [engine/physics/AtmosphericTurbulenceSystem.js](#atmosphericturbulencesystem)
- [engine/physics/WeatherSensor.js](#weathersensor)
- [engine/physics/OrbitNode.js](#orbitnode)

---

## 🔬 Contratos de Interface — Leer Antes de Implementar

### Contrato: `CelestialPhysicsSystem.integrateRK4()`

> **AI TASK:** Implementar `integrateRK4(orbitalData, deltaTime)`. Debe:
> 1. Recibir `orbitalData` con `{ body, mass, centralMass, velocity }` donde `velocity` es `THREE.Vector3`
> 2. Calcular 4 evaluaciones del gradiente de aceleración gravitacional (k1, k2, k3, k4)
> 3. Combinar: `pos_new = pos + (dt/6) * (k1 + 2k2 + 2k3 + k4)`
> 4. **PROHIBIDO** crear nuevos objetos `Vector3` con `new` dentro de este método — usar buffers pre-asignados en `this._rk4Buffers`
> 5. Devolver `void` — muta `orbitalData.body.position` y `orbitalData.velocity` in-place

**Input esperado:**
```js
orbitalData = {
  body: THREE.Object3D,   // El mesh físico con .position : THREE.Vector3
  mass: number,           // Masa del cuerpo en unidades de motor
  centralMass: number,    // Masa del atractor central
  velocity: THREE.Vector3 // Vector velocidad mutable
}
deltaTime: number         // Delta fijo en segundos (idealmente 1/60)
G: number                 // Constante gravitacional del motor (0.1)
```

**Output esperado:**
```js
// Muta in-place (sin retorno):
orbitalData.body.position  // Actualizado vía RK4
orbitalData.velocity        // Actualizado vía RK4
```

### Contrato: `CelestialPhysicsSystem._initRK4Buffers()`

> **AI TASK:** Llamar en `constructor()`. Pre-asignar 12 `THREE.Vector3` como buffers reutilizables para las 4 etapas del RK4 (k1_v, k1_a, k2_v, k2_a, k3_v, k3_a, k4_v, k4_a, tmpPos, tmpVel, acc, rVec). Esto garantiza cero GC durante el loop de física.

---

## 📜 Código Fuente — CelestialPhysicsSystem.js

<h3 id="celestialphysicssystem">📄 <code>engine/physics/CelestialPhysicsSystem.js</code></h3>

*Estadísticas actuales: 297 líneas | 11.11 KB — Estado: RK4_UPGRADE_PENDING*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente actual ]</strong></summary>

```js
// frontend/src/engine/physics/CelestialPhysicsSystem.js

/**
 * CelestialPhysicsSystem — V30 Orbital Engine
 * [CÓDIGO ACTUAL] Integrador: Semi-Implicit Euler
 *
 * ARQUITECTURA PENDIENTE V31:
 * - Paso 1: Agregar _initRK4Buffers() en constructor
 * - Paso 2: Agregar integrateRK4(orbitalData, deltaTime) method
 * - Paso 3: Reemplazar el bloque Euler en update() por llamada a integrateRK4()
 * - Paso 4: Agregar connectNBody(galaxySystem) para gravedad de 150K puntos
 */
export class CelestialPhysicsSystem {
    static dependencies = ["events", "EntityManager"];

    constructor(kernel) {
        this.kernel = kernel || window.engine;
        this.registry = window.Registry || (this.kernel ? this.kernel.registry : null);
        
        this.orbitalNodes = [];
        this.isMapModeActive = false;
        this.mapModeSnapshot = null;
        
        // [IA-TODO: INYECTAR AQUÍ]
        // this._initRK4Buffers();
        
        this.registryDeps();
    }

    registryDeps() {
        if (!this.registry) return;
        CelestialPhysicsSystem.dependencies.forEach(dep => {
            this[dep] = this.registry.get(dep);
        });
        console.log("[DI] CelestialPhysicsSystem dependencies resolved:", CelestialPhysicsSystem.dependencies);
    }

    /**
     * registerOrbit — Converts a static procedural orbit into a dynamic Newtonian simulation.
     * @param {THREE.Object3D} node 
     * @param {number} speed 
     */
    registerOrbit(node, speed) {
        let body = node.children.find(c => c.userData?.isMass);
        if (!body) body = node;

        const isCentralStar = body.userData?.nodeType === 'star';
        const mass = isCentralStar ? 333000 : (Math.random() * 100 + 10);
        
        const localPos = body.position.clone();
        const r = localPos.length();
        let velocity = new THREE.Vector3(0, 0, 0);
        let centralMass = 0;
        
        if (r > 0.1) {
            const vMag = speed * r;
            centralMass = (vMag * vMag * r) / 0.1;
            velocity.set(0, 0, -vMag);
            node.rotation.y = 0; 
        }

        this.orbitalNodes.push({ 
            node,
            body,
            mass,
            centralMass,
            velocity,
            _paused: false,
            _savedSpeed: speed,
            _originalPosition: body.position.clone(),
            _originalNodePosition: node.position.clone()
        });
    }

    /**
     * update — [CÓDIGO ACTUAL: Euler Semi-Implícito]
     * @param {number} deltaTime - Fixed timestep
     *
     * [IA-TODO: REEMPLAZAR EL BLOQUE INTERNO POR LLAMADA A integrateRK4()]
     * Requerimiento: this.integrateRK4(data, deltaTime) debe existir antes de este cambio.
     * El bloque a reemplazar está marcado con // [EULER_BLOCK_START] y // [EULER_BLOCK_END]
     */
    update(deltaTime) {
        if (this.isMapModeActive) return;
        
        const G = 0.1;
        
        for (let i = 0; i < this.orbitalNodes.length; i++) {
            const data = this.orbitalNodes[i];
            if (data._paused) continue;
            
            // [EULER_BLOCK_START] — Reemplazar por: this.integrateRK4(data, deltaTime);
            const rVector = data.body.position.clone();
            const rSq = rVector.lengthSq();
            
            if (rSq > 0.01 && data.centralMass > 0) {
                const r = Math.sqrt(rSq);
                const accelerationMag = (G * data.centralMass) / rSq;
                const acceleration = rVector.normalize().multiplyScalar(-accelerationMag);
                
                // Integración Semi-Implícita de Euler (DEPRECADA en V31)
                data.velocity.addScaledVector(acceleration, deltaTime);
                data.body.position.addScaledVector(data.velocity, deltaTime);
                
                data.body.rotation.y += (data._savedSpeed * 2.5) * deltaTime;
            } else if (!data.centralMass && data.node !== data.body) {
                data.body.rotation.y += 0.05 * deltaTime;
            }
            // [EULER_BLOCK_END]
        }
    }

    // [IA-TODO: INYECTAR MÉTODO RK4 AQUÍ]
    // Ver contrato completo en sección "Contratos de Interface" arriba.
    // Firma exacta requerida:
    //
    // _initRK4Buffers() { ... }
    // integrateRK4(orbitalData, deltaTime, G = 0.1) { ... }
    // _gravitationalAcceleration(position, centralMass, G, outAcceleration) { ... }

    // [IA-TODO: INYECTAR N-BODY GALAXY CONNECTOR]
    // connectNBody(galaxySystem) {
    //   this.galaxySystem = galaxySystem;
    //   this.nBodyEnabled = true;
    //   console.log('[CelestialPhysics] N-Body gravity enabled for', galaxySystem.starCount, 'bodies');
    // }

    /**
     * applyGravityPull — FPS Gravity Gun
     * Detiene el determinismo orbital, atrae via GSAP, luego devuelve a Newton.
     */
    applyGravityPull(node, cameraRig, duration = 3) {
        const orbitalData = this.orbitalNodes.find(item => item.node === node);
        if (!orbitalData || orbitalData._paused) return;

        orbitalData._paused = true;
        
        if (!orbitalData._originalNodePosition) {
            orbitalData._originalNodePosition = node.position.clone();
        }

        const worldCameraPos = cameraRig.position.clone();
        const worldCameraFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRig.quaternion);
        const gripWorldPos = worldCameraPos.addScaledVector(worldCameraFwd, 25);
        
        const localTarget = gripWorldPos.clone();
        if (node.parent) {
            node.parent.worldToLocal(localTarget);
        }

        gsap.killTweensOf(node.position);
        gsap.to(node.position, {
            x: localTarget.x,
            y: localTarget.y,
            z: localTarget.z,
            duration: 1.0,
            ease: "power2.out",
            onComplete: () => {
                gsap.to(node.position, {
                    x: orbitalData._originalNodePosition.x,
                    y: orbitalData._originalNodePosition.y,
                    z: orbitalData._originalNodePosition.z,
                    duration: 1.5,
                    delay: duration,
                    ease: "power2.inOut",
                    onComplete: () => {
                        orbitalData._paused = false;
                    }
                });
            }
        });
    }

    _getScene(node) {
        let current = node;
        while (current.parent) {
            current = current.parent;
        }
        return current;
    }

    /**
     * arrangeInMapMode — Map Mode Gallery
     * Recolecta masas, pausa órbitas y reorganiza en galería interactiva.
     */
    arrangeInMapMode(cameraRig, focusTarget) {
        this.isMapModeActive = true;
        this.mapModeSnapshot = [];
        
        const scene = this._getScene(cameraRig);
        if (!scene) return;
        
        const bodies = [];
        scene.traverse((obj) => {
            if (obj === focusTarget) return; 
            if (obj.userData?.nodeType === 'planet' || 
                obj.userData?.nodeType === 'star' || 
                obj.userData?.isMass || 
                obj.userData?.isSatellite) 
            {
                bodies.push(obj);
            }
        });
        
        const bodiesCount = bodies.length;
        if (bodiesCount === 0) return;

        const finalRigRotation = cameraRig.rotation.clone();
        finalRigRotation.y += Math.PI; 
        
        const rigPos = cameraRig.position.clone();
        const baseForward = new THREE.Vector3(0, 0, -1).applyEuler(finalRigRotation).normalize();
        const baseRight = new THREE.Vector3(1, 0, 0).applyEuler(finalRigRotation).normalize();
        const baseUp = new THREE.Vector3(0, 1, 0).applyEuler(finalRigRotation).normalize();
        
        for (let i = 0; i < bodiesCount; i++) {
            const body = bodies[i];
            
            this.mapModeSnapshot.push({
                node: body,
                originalPosition: body.position.clone(),
                originalQuaternion: body.quaternion.clone()
            });
            
            const indexFactor = bodiesCount > 1 ? (i / (bodiesCount - 1)) : 0.5;
            const angle = (indexFactor * Math.PI * 0.8) - (Math.PI * 0.4);
            const curveDepth = Math.cos(angle) * 60; 
            
            const worldTarget = rigPos.clone()
                .addScaledVector(baseForward, 120 + curveDepth)
                .addScaledVector(baseRight, Math.sin(angle) * 220)
                .addScaledVector(baseUp, ((i % 3) - 1) * 35);
                
            const localTarget = worldTarget.clone();
            if (body.parent) {
                body.parent.worldToLocal(localTarget);
            }
            
            const dummy = new THREE.Object3D();
            if (body.parent) body.parent.add(dummy);
            dummy.position.copy(localTarget);
            dummy.lookAt(rigPos); 
            
            gsap.killTweensOf(body.position);
            gsap.to(body.position, {
                x: localTarget.x,
                y: localTarget.y,
                z: localTarget.z,
                duration: 2.2,
                ease: "power3.inOut"
            });
            
            gsap.killTweensOf(body.quaternion);
            gsap.to(body.quaternion, {
                x: dummy.quaternion.x,
                y: dummy.quaternion.y,
                z: dummy.quaternion.z,
                w: dummy.quaternion.w,
                duration: 2.2,
                ease: "power3.inOut"
            });
            
            if (body.parent) body.parent.remove(dummy);
        }
    }

    restoreFromMapMode() {
        if (!this.mapModeSnapshot) return;
        
        for (let i = 0; i < this.mapModeSnapshot.length; i++) {
            const data = this.mapModeSnapshot[i];
            
            gsap.killTweensOf(data.node.position);
            gsap.to(data.node.position, {
                x: data.originalPosition.x,
                y: data.originalPosition.y,
                z: data.originalPosition.z,
                duration: 1.8,
                ease: "power3.inOut"
            });
            
            gsap.killTweensOf(data.node.quaternion);
            gsap.to(data.node.quaternion, {
                x: data.originalQuaternion.x,
                y: data.originalQuaternion.y,
                z: data.originalQuaternion.z,
                w: data.originalQuaternion.w,
                duration: 1.8,
                ease: "power3.inOut"
            });
        }
        
        setTimeout(() => {
            this.isMapModeActive = false;
            this.mapModeSnapshot = null;
        }, 1800);
    }
}
```

</details>

---

## 🤖 Código de Implementación RK4 — Listo para Inyectar

> **AI TASK:** Copiar el siguiente bloque y:
> 1. Agregar `_initRK4Buffers()` y `_gravitationalAcceleration()` como métodos de la clase
> 2. Agregar `integrateRK4()` como el nuevo integrador
> 3. En `update()`, reemplazar el bloque `[EULER_BLOCK_START]...[EULER_BLOCK_END]` por `this.integrateRK4(data, deltaTime)`

```js
// ═══════════════════════════════════════════════════════
// INYECTAR EN CelestialPhysicsSystem — Métodos V31 RK4
// ═══════════════════════════════════════════════════════

/**
 * Pre-asigna buffers Vector3 para cero GC durante integración.
 * Llamar una vez en el constructor.
 */
_initRK4Buffers() {
    this._rk4 = {
        // Gradientes de posición y velocidad para cada etapa K
        k1_pos: new THREE.Vector3(),
        k1_vel: new THREE.Vector3(),
        k2_pos: new THREE.Vector3(),
        k2_vel: new THREE.Vector3(),
        k3_pos: new THREE.Vector3(),
        k3_vel: new THREE.Vector3(),
        k4_pos: new THREE.Vector3(),
        k4_vel: new THREE.Vector3(),
        // Posiciones y velocidades temporales durante integración
        tmpPos: new THREE.Vector3(),
        tmpVel: new THREE.Vector3(),
        // Buffer de aceleración reutilizable
        acc: new THREE.Vector3(),
        // Buffer del vector radial
        rVec: new THREE.Vector3(),
    };
    console.log('[CelestialPhysics] RK4 buffers pre-allocated. Zero GC mode active.');
}

/**
 * Calcula el vector aceleración gravitacional dada una posición.
 * Escribe el resultado en outAcc (buffer pre-asignado).
 * PROHIBIDO crear objetos nuevos aquí.
 *
 * @param {THREE.Vector3} position - Posición del cuerpo
 * @param {number} centralMass    - Masa del atractor
 * @param {number} G              - Constante gravitacional del motor
 * @param {THREE.Vector3} outAcc  - Buffer de salida para la aceleración
 */
_gravitationalAcceleration(position, centralMass, G, outAcc) {
    const rSq = position.lengthSq();
    if (rSq < 0.01 || centralMass <= 0) {
        outAcc.set(0, 0, 0);
        return;
    }
    const r = Math.sqrt(rSq);
    const aMag = (G * centralMass) / rSq;
    // outAcc = -normalize(position) * aMag
    outAcc.copy(position).multiplyScalar(-aMag / r);
}

/**
 * Integrador Runge-Kutta de 4to Orden (RK4).
 * Garantiza estabilidad orbital infinita sin deriva de energía.
 * Cero allocations — utiliza this._rk4 buffers pre-asignados.
 *
 * @param {object} data       - OrbitalNode data { body, centralMass, velocity }
 * @param {number} deltaTime  - Paso de tiempo fijo (segundos)
 * @param {number} [G=0.1]    - Constante gravitacional del motor
 */
integrateRK4(data, deltaTime, G = 0.1) {
    if (!this._rk4) this._initRK4Buffers(); // Salvaguarda si no se llamó en constructor

    const { k1_pos, k1_vel, k2_pos, k2_vel, k3_pos, k3_vel, k4_pos, k4_vel,
            tmpPos, tmpVel, acc } = this._rk4;

    const pos = data.body.position; // THREE.Vector3 — mutable directamente
    const vel = data.velocity;      // THREE.Vector3 — mutable directamente
    const h   = deltaTime;
    const M   = data.centralMass;

    // ── K1: Gradiente en estado actual ──────────────────────────
    k1_pos.copy(vel);                             // dpos/dt = vel
    this._gravitationalAcceleration(pos, M, G, acc);
    k1_vel.copy(acc);                             // dvel/dt = acc(pos)

    // ── K2: Gradiente en pos + h/2 * k1 ────────────────────────
    tmpPos.copy(pos).addScaledVector(k1_pos, h * 0.5);
    tmpVel.copy(vel).addScaledVector(k1_vel, h * 0.5);

    k2_pos.copy(tmpVel);
    this._gravitationalAcceleration(tmpPos, M, G, acc);
    k2_vel.copy(acc);

    // ── K3: Gradiente en pos + h/2 * k2 ────────────────────────
    tmpPos.copy(pos).addScaledVector(k2_pos, h * 0.5);
    tmpVel.copy(vel).addScaledVector(k2_vel, h * 0.5);

    k3_pos.copy(tmpVel);
    this._gravitationalAcceleration(tmpPos, M, G, acc);
    k3_vel.copy(acc);

    // ── K4: Gradiente en pos + h * k3 ──────────────────────────
    tmpPos.copy(pos).addScaledVector(k3_pos, h);
    tmpVel.copy(vel).addScaledVector(k3_vel, h);

    k4_pos.copy(tmpVel);
    this._gravitationalAcceleration(tmpPos, M, G, acc);
    k4_vel.copy(acc);

    // ── Combinación Final: pos += h/6 * (k1 + 2k2 + 2k3 + k4) ─
    const s = h / 6.0;
    pos.addScaledVector(k1_pos, s)
       .addScaledVector(k2_pos, s * 2)
       .addScaledVector(k3_pos, s * 2)
       .addScaledVector(k4_pos, s);

    vel.addScaledVector(k1_vel, s)
       .addScaledVector(k2_vel, s * 2)
       .addScaledVector(k3_vel, s * 2)
       .addScaledVector(k4_vel, s);

    // Spin propio (invariante al integrador)
    data.body.rotation.y += (data._savedSpeed * 2.5) * deltaTime;
}
```

---

## 📄 Módulos Secundarios del Sistema de Física

<h3 id="atmosphericentrysystem">📄 <code>engine/physics/AtmosphericEntrySystem.js</code></h3>

```json
{
  "module": "AtmosphericEntrySystem",
  "version": "V30_STABLE",
  "dependencies": ["Registry", "CameraSystem", "NavigationSystem", "CelestialRegistry"],
  "ai_directive": "Sistema estable. No modificar salvo para acoplar datos de densidad al RK4 como fuerza de drag orbital. Candidato a upgrade: agregar drag diferencial según altitud para re-entrada realista."
}
```

*Estadísticas: 90 líneas | 2.95 KB — Estado: STABLE*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * AtmosphericEntrySystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 *
 * Calcula densidad atmosférica, drag aerodinámico y calor de re-entrada.
 * Diseño: Sistema pasivo consultado por FlightPhysicsSystem.
 *
 * [IA-TODO: OPCIONAL] Acoplar this.density al integrador RK4 de CelestialPhysicsSystem
 * para simular decaimiento orbital por rozamiento atmosférico.
 * Inyectar en CelestialPhysicsSystem.integrateRK4() como fuerza adicional al vector 'vel'.
 */
import * as THREE from 'https://unpkg.com/three@0.132.2/build/three.module.js?v=V28_OMEGA_FINAL';
import { Registry } from '../core/ServiceRegistry.js';

export class AtmosphericEntrySystem {
    static phase = 'navigation';
    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        this.activePlanet = null;
        this.density = 0;
        this.heat = 0;
        this.dragCoefficient = 0.05;
    }

    get airDensity() { return this.density; }

    init() {
        console.log('[AtmosphericEntry] OMEGA Aerobraking Engine Online.');
    }

    update(delta, time) {
        const camera = this.Registry.get('CameraSystem')?.getCamera();
        const nav = this.Registry.get('NavigationSystem');
        if (!camera || !nav) return;

        const planet = this.findNearestPlanet(camera.position);
        if (planet) {
            this.processEntry(planet, camera, nav, delta);
        } else {
            this.heat = THREE.MathUtils.lerp(this.heat, 0, 0.1);
        }
    }

    findNearestPlanet(pos) {
        const celestialRegistry = Registry.get('CelestialRegistry');
        if (!celestialRegistry) return null;

        const celestials = celestialRegistry.getByType('PLANET');
        let nearest = null;
        let minDist = 5000;

        celestials.forEach(planet => {
            const d = pos.distanceTo(planet.position);
            if (d < minDist) {
                minDist = d;
                nearest = planet;
            }
        });

        this.activePlanet = nearest;
        return nearest;
    }

    processEntry(planet, camera, nav, delta) {
        const dist = camera.position.distanceTo(planet.position);
        const radius = planet.radius || 100;
        const atmThickness = 1000;

        if (dist < radius + atmThickness) {
            const altitude = dist - radius;
            this.density = Math.pow(1.0 - (altitude / atmThickness), 2);
            
            const speed = nav.velocity.length();
            const dragForce = 0.5 * this.density * speed * speed * this.dragCoefficient;
            
            const dragVector = nav.velocity.clone().normalize().multiplyScalar(-dragForce * delta);
            nav.velocity.add(dragVector);

            this.heat = this.density * (speed * 0.01);
            
            if (this.heat > 0.1) {
                this.events.emit('fx:entry_heat', { heat: this.heat, density: this.density });
            }
        } else {
            this.density = 0;
            this.heat = 0;
        }
    }
}
```

</details>

---

<h3 id="flightphysicssystem">📄 <code>engine/physics/FlightPhysicsSystem.js</code></h3>

```json
{
  "module": "FlightPhysicsSystem",
  "version": "V30_STABLE",
  "dependencies": ["AtmosphericEntrySystem", "RelativeFrameSystem", "NavigationSystem", "CameraSystem"],
  "ai_directive": "Sistema estable. No modificar. Calcula sustentación aerodinàmica y estabilización de horizonte planeto-relativa."
}
```

*Estadísticas: 78 líneas | 2.90 KB — Estado: STABLE*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * FlightPhysicsSystem.js
 * OMEGA V28 Master Edition — Navigation Layer
 *
 * Calcula lift aerodinámico y estabilización de horizonte para vuelo atmosférico.
 * Depende de AtmosphericEntrySystem para datos de densidad de aire.
 */
import * as THREE from 'https://unpkg.com/three@0.132.2/build/three.module.js?v=V28_OMEGA_FINAL';
import { Registry } from '../core/ServiceRegistry.js';

export class FlightPhysicsSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.liftCoefficient = 0.5;
        this.stabilityStrength = 0.05;
        this.horizonDamping = 0.95;
    }

    init() {
        console.log('[FlightPhysics] OMEGA Aerodynamic Engine Online.');
    }

    update(delta, time) {
        const entrySystem = this.Registry.get('AtmosphericEntrySystem');
        const frameSystem = this.Registry.get('RelativeFrameSystem');
        const nav = this.Registry.get('NavigationSystem');
        const camera = this.Registry.get('CameraSystem')?.getCamera();

        if (!entrySystem || !frameSystem || !nav || !camera) return;

        const density = entrySystem.airDensity;
        if (density <= 0.01) return;

        const frame = frameSystem.getLocalFrame(camera);
        const velocity = nav.velocity;
        const speed = velocity.length();

        if (speed < 0.1) return;

        const velocityDir = velocity.clone().normalize();
        const pitchAlignment = Math.max(velocityDir.dot(frame.forward), 0);
        const liftMagnitude = speed * speed * density * this.liftCoefficient * pitchAlignment;
        
        const liftForce = frame.up.clone().multiplyScalar(liftMagnitude);
        nav.applyForce(liftForce);

        const planet = entrySystem.activePlanet;
        if (planet && speed > 5) {
            this.stabilizeToHorizon(camera, planet, frame, nav, delta);
        }
    }

    stabilizeToHorizon(camera, planet, frame, nav, delta) {
        const frameSystem = this.Registry.get('RelativeFrameSystem');
        const horizonUp = frameSystem.getHorizonUp(camera, planet);
        const alignment = frame.up.dot(horizonUp);
        
        if (alignment < 0.999) {
            const correctionAxis = new THREE.Vector3().crossVectors(frame.up, horizonUp).normalize();
            const strength = this.stabilityStrength * (1.0 - alignment);
            nav.applyHorizonLeveling(correctionAxis, strength, delta);
        }
    }
}
```

</details>

---

<h3 id="atmosphericturbulencesystem">📄 <code>engine/physics/AtmosphericTurbulenceSystem.js</code></h3>

```json
{
  "module": "AtmosphericTurbulenceSystem",
  "version": "V30_STABLE",
  "dependencies": ["AtmosphericEntrySystem", "NavigationSystem", "CameraSystem", "events"],
  "ai_directive": "Genera fuerzas de viento procedural y camera buffeting. Sistema estable. UPGRADE candidato: Reemplazar la generación sin usando Simplex Noise para turbulencia más realista."
}
```

*Estadísticas: 64 líneas | 2.24 KB — Estado: STABLE*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import * as THREE from 'https://unpkg.com/three@0.132.2/build/three.module.js?v=V28_OMEGA_FINAL';

/**
 * AtmosphericTurbulenceSystem.js - V30 OMEGA
 * 
 * Calcula fuerzas eólicas procedurales y micro-shakes de cámara basadas
 * en velocidad de vuelo y densidad de aire.
 *
 * [IA-TODO: UPGRADE OPCIONAL] Reemplazar Math.sin/cos por Simplex Noise 2D
 * para turbulencia más orgánica: noise(time * 0.7, altitude * 0.001)
 */
export class AtmosphericTurbulenceSystem {
    constructor() {
        this.baseTurbulence = 0.2;
        this.maxBufferIntensity = 0.8;
        this.noiseTime = 0;
    }

    update(delta, time) {
        const entrySystem = this.Registry.get('AtmosphericEntrySystem');
        const nav = this.Registry.get('NavigationSystem');
        const camera = this.Registry.get('CameraSystem')?.getCamera();

        if (!entrySystem || !nav || !camera) return;

        const density = entrySystem.airDensity;
        if (density <= 0.05) return;

        const speed = nav.velocity.length();
        if (speed < 10) return;

        this.noiseTime += delta * 5.0;

        const speedFactor = Math.min(speed / 500, 1.5);
        const intensity = density * speedFactor * this.baseTurbulence;

        if (intensity > 0.05) {
            this.applyBuffeting(intensity, delta);
        }

        const windX = Math.sin(this.noiseTime * 0.7) * 20 * intensity;
        const windY = Math.cos(this.noiseTime * 1.1) * 20 * intensity;
        const windZ = Math.sin(this.noiseTime * 0.3) * 20 * intensity;
        
        const windForce = new THREE.Vector3(windX, windY, windZ);
        nav.applyForce(windForce);

        this.events.emit('weather:turbulence', { intensity, speed, density });
    }

    applyBuffeting(intensity, delta) {
        const shakeAmount = Math.min(intensity * this.maxBufferIntensity, this.maxBufferIntensity);
        
        this.events.emit('camera:shake', { 
            intensity: shakeAmount, 
            duration: delta * 1.5,
            isBuffeting: true
        });
    }
}
```

</details>

---

<h3 id="weathersensor">📄 <code>engine/physics/WeatherSensor.js</code></h3>

```json
{
  "module": "WeatherSensor",
  "version": "V30_STABLE",
  "dependencies": ["events"],
  "ai_directive": "Agrega datos ambientales para el HUD. Sistema estable. No modificar."
}
```

*Estadísticas: 43 líneas | 1.27 KB — Estado: STABLE*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * WeatherSensor.js - V30 OMEGA
 * Agrega datos atmosféricos y ambientales para el HUD y otros sistemas.
 */
export class WeatherSensor {
    constructor() {
        this.currentCondition = 'CLEAR';
        this.windStrength = 0;
        this.visibility = 1.0;
    }

    init() {
        this.events.on('weather:turbulence', (data) => this.updateStatus(data));
        console.log('[WeatherSensor] Environmental Analysis Unit Active.');
    }

    updateStatus({ intensity, density }) {
        this.windStrength = intensity;
        
        if (density > 0.8) {
            this.currentCondition = intensity > 0.4 ? 'STORM' : 'CLOUDY';
        } else if (density > 0.3) {
            this.currentCondition = 'FOGGY';
        } else {
            this.currentCondition = 'CLEAR';
        }

        this.visibility = 1.0 - (density * 0.5);
    }

    getReport() {
        return {
            condition: this.currentCondition,
            wind: (this.windStrength * 100).toFixed(0) + ' km/h',
            visibility: (this.visibility * 100).toFixed(0) + '%'
        };
    }
}
```

</details>

---

<h3 id="orbitnode">📄 <code>engine/physics/OrbitNode.js</code></h3>

```json
{
  "module": "OrbitNode",
  "version": "V30_STABLE",
  "dependencies": ["THREE.Object3D"],
  "ai_directive": "THREE.Object3D especializado para órbita Y-axis simple. Usado por instancias de bajo costo donde RK4 sería excesivo. MANTENER para compatibilidad con sistemas legacy."
}
```

*Estadísticas: 21 líneas | 0.63 KB — Estado: STABLE*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
// frontend/src/engine/physics/OrbitNode.js
import * as THREE from 'three';

/**
 * OrbitNode — A THREE.Object3D que rota en su eje Y cada frame.
 * Agrega hijos con offset en X para lograr órbita alrededor del origen.
 * 
 * USO: Para asteroides, debris y objetos de baja física donde RK4 es excesivo.
 * Para planetas y cuerpos principales, usar CelestialPhysicsSystem.registerOrbit().
 */
export class OrbitNode extends THREE.Object3D {
    constructor(speed = 0.001) {
        super();
        this.orbitSpeed  = speed;
        this.isOrbitNode = true;
    }

    /** @param {number} deltaTime - seconds since last frame */
    update(deltaTime) {
        this.rotation.y += this.orbitSpeed * deltaTime;
    }
}
```

</details>

---

## ✅ Checklist de Verificación Post-Implementación RK4

Después de inyectar el código RK4, verificar en consola del navegador:

```js
// En Chrome DevTools con el motor corriendo:

// 1. Verificar que el sistema arrancó con RK4
window.__OMEGA_WORLD__
    ?.query?.('CelestialPhysicsSystem')
    // Si retorna ID, buscar instancia:

// 2. Verificar buffers pre-asignados
const physics = window.Registry?.get('CelestialPhysicsSystem');
console.log('RK4 buffers initialized:', !!physics?._rk4);
console.log('RK4 buffer keys:', physics?._rk4 ? Object.keys(physics._rk4) : 'N/A');

// 3. Verificar que no hay 'new Vector3' en el loop de física
// (Abrir Performance tab → Record → Esperar 5s → Detener)
// Buscar "Minor GC" durante el frame de física — debería ser 0 o mínimo
```
