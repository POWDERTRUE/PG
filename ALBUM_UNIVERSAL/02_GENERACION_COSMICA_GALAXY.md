# 📚 GENERACIÓN CÓSMICA (GALAXY)

```json
{
  "module": "GalaxyGenerationSystem",
  "version": "V31_NBODY_UPDATE",
  "dependencies": ["EntityManager.js", "ServiceRegistry.js", "THREE.InstancedMesh", "CelestialPhysicsSystem"],
  "upgrade_from": "Rotación estática del InstancedMesh completo",
  "upgrade_to": "N-Body gravitacional con 150,000 puntos + RK4 acoplado",
  "ai_directive": "Acoplar GalaxyGenerationSystem a CelestialPhysicsSystem para que las 150,000 estrellas se atraigan gravitacionalmente entre sí en lugar de rotar como un cuerpo rígido. Usar Barnes-Hut tree (theta=0.5) para reducir O(n²) a O(n log n).",
  "files": 1,
  "status": "N_BODY_GRAVITY_PENDING"
}
```

> **Estado actual:** 150,000 estrellas en InstancedMesh. Rotación monolítica como cuerpo rígido. Bello, pero estático.
> **Estado objetivo:** 150,000 partículas con atracción gravitacional mutua, formando brazos espirales dinámicos que evolucionan en tiempo real.

## 💠 Esquema Conceptual

```mermaid
graph TD
  GGS[GalaxyGenerationSystem] --> IM[THREE.InstancedMesh 150k stars]
  GGS --> BH[Barnes-Hut Tree - PENDING]
  BH --> Theta[theta cutoff = 0.5]
  BH --> NBody[N-Body O(n log n) instead of O(n²)]
  GGS --> CPS[CelestialPhysicsSystem.connectNBody()]
  CPS --> RK4[RK4 Integrator x 150k bodies]
```

## 📑 Tabla de Contenidos

- [engine/galaxy/GalaxyGenerationSystem.js](#galaxygenerationsystem) — **N-Body PENDING**

---

## 🔬 Contratos de Interface

### Contrato: `GalaxyGenerationSystem.connectNBody(physicsSystem)`

> **AI TASK:** Implementar `connectNBody(physicsSystem)`. Llamar desde UniverseKernel después de que ambos sistemas estén inicializados. Debe:
> 1. Pre-asignar `Float32Array` para posiciones (3 * starCount floats) y velocidades (3 * starCount floats)
> 2. Extraer posiciones actuales del InstancedMesh matrix en los Float32Array
> 3. Exponer `this.positionBuffer` y `this.velocityBuffer` para que CelestialPhysicsSystem los lea

**Input esperado:**
```js
physicsSystem: CelestialPhysicsSystem  // Sistema de física ya inicializado
```

**Buffers compartidos a crear:**
```js
this.positionBuffer = new Float32Array(starCount * 3);  // [x0,y0,z0, x1,y1,z1, ...]
this.velocityBuffer = new Float32Array(starCount * 3);  // velocidades iniciales tangenciales
this.massBuffer     = new Float32Array(starCount);      // masas estelares
```

---

## 📜 Código Fuente — GalaxyGenerationSystem.js

<h3 id="galaxygenerationsystem">📄 <code>engine/galaxy/GalaxyGenerationSystem.js</code></h3>

*Estadísticas: 110 líneas | 4.09 KB — Estado: N_BODY_GRAVITY_PENDING*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente actual ]</strong></summary>

```js
import * as THREE from 'three';
import { System } from '../core/EntityManager.js';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * GalaxyGenerationSystem — V31 Cosmic Forge
 *
 * [CÓDIGO ACTUAL] Genera 150,000 estrellas en InstancedMesh con espiral logarítmica.
 * Rotación monolítica. Performance óptima.
 *
 * [IA-TODO: INYECTAR N-BODY CONNECTOR]
 * Después de generateSpiralGalaxy(), agregar:
 *   1. Extraer posiciones del InstancedMesh a Float32Array (positionBuffer)
 *   2. Calcular velocidades tangenciales iniciales en velocityBuffer
 *   3. Exponer connectNBody(physicsSystem) para acoplamiento con CelestialPhysicsSystem
 *   4. En execute(), si nBodyEnabled, leer positionBuffer actualizado por CelestialPhysics
 *      y actualizar las matrices del InstancedMesh desde el buffer
 *
 * Requerimiento crítico: PROHIBIDO iterar sobre 150k objetos JS individuales.
 * Usar SIEMPRE Float32Array + InstancedMesh.setMatrixAt() en batch.
 */
export class GalaxyGenerationSystem extends System {
    static phase = 'simulation';

    init(world) {
        this.world = world;
        const kernel = Registry.get('kernel');
        this.scene = kernel?.sceneGraph?.scene;
        
        if (!this.scene) {
            console.error("[GalaxyGenerationSystem] SceneGraph offline. Cannot weave galaxy.");
            return;
        }

        this.starCount = 150000;
        this.generateSpiralGalaxy(this.starCount);

        // [IA-TODO: ACTIVAR DESPUÉS DE IMPLEMENTAR connectNBody()]
        // const physics = Registry.get('CelestialPhysicsSystem');
        // if (physics) this.connectNBody(physics);
    }

    generateSpiralGalaxy(starCount) {
        console.log(`🌌 [GalaxyGenerationSystem] Weaving ${starCount} stars using Instanced Rendering...`);

        const geometry = new THREE.SphereGeometry(3, 4, 4); 
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, starCount);
        
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        const arms = 5;
        const rotationFactor = 4;
        const randomOffset = 50;

        for (let i = 0; i < starCount; i++) {
            const distance = Math.pow(Math.random(), 3) * 6000;
            const armAngle = ((i % arms) / arms) * Math.PI * 2;
            const spiralAngle = armAngle + distance * 0.005 * rotationFactor;
            
            let x = Math.cos(spiralAngle) * distance;
            let z = Math.sin(spiralAngle) * distance;
            let y = (Math.random() - 0.5) * (7000 / (distance + 50));

            x += (Math.random() - 0.5) * randomOffset;
            y += (Math.random() - 0.5) * randomOffset;
            z += (Math.random() - 0.5) * randomOffset;

            dummy.position.set(x, y, z);
            
            const scale = Math.random() * 0.7 + 0.3;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();

            this.instancedMesh.setMatrixAt(i, dummy.matrix);
            
            const temp = Math.random();
            if (distance < 600) {
                color.setHex(0xffffff);
            } else if (temp > 0.8) {
                color.setHex(0x99bbff);
            } else if (temp < 0.2) {
                color.setHex(0xffaa88);
            } else {
                color.setHex(0xffeedd);
            }
            this.instancedMesh.setColorAt(i, color);
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;
        this.instancedMesh.frustumCulled = true;
        this.instancedMesh.matrixAutoUpdate = false;

        this.scene.add(this.instancedMesh);
        console.log(`✅ [GalaxyGenerationSystem] Procedural Galaxy mounted. Stars: ${starCount}`);
    }

    execute(world, delta, time) {
        if (this.instancedMesh) {
            if (this.nBodyEnabled && this.positionBuffer) {
                // [IA-TODO: Leer positionBuffer actualizado por physics y aplicar al InstancedMesh]
                // this._applyBufferToInstancedMesh();
            } else {
                // Rotación monolítica estática (comportamiento V30 actual)
                this.instancedMesh.rotation.y += 0.002 * delta;
                this.instancedMesh.updateMatrix();
            }
        }
    }

    // [IA-TODO: INYECTAR MÉTODO connectNBody AQUÍ]
    // connectNBody(physicsSystem) { ... }

    // [IA-TODO: INYECTAR MÉTODO _extractPositionsToBuffer AQUÍ]
    // _extractPositionsToBuffer() { ... }

    // [IA-TODO: INYECTAR MÉTODO _applyBufferToInstancedMesh AQUÍ]
    // _applyBufferToInstancedMesh() { ... }
}
```

</details>

---

## 🤖 Código N-Body Connector — Listo para Inyectar

> **AI TASK:** Copiar los siguientes métodos como parte de la clase `GalaxyGenerationSystem`.

```js
// ═══════════════════════════════════════════════════════
// INYECTAR EN GalaxyGenerationSystem — N-Body V31
// ═══════════════════════════════════════════════════════

/**
 * Acopla el sistema de galaxia al integrador de física RK4.
 * Extrae posiciones actuales del InstancedMesh a Float32Array.
 * Calcula velocidades tangenciales iniciales para órbita estable.
 *
 * @param {CelestialPhysicsSystem} physicsSystem
 */
connectNBody(physicsSystem) {
    console.log(`[GalaxyGeneration] Coupling ${this.starCount} stars to N-Body RK4 solver...`);
    
    this.physicsSystem = physicsSystem;
    this.nBodyEnabled  = true;

    // Pre-asignar buffers binarios (zero GC durante simulación)
    this.positionBuffer = new Float32Array(this.starCount * 3);
    this.velocityBuffer = new Float32Array(this.starCount * 3);
    this.massBuffer     = new Float32Array(this.starCount);

    // Extraer posiciones actuales del InstancedMesh
    this._extractPositionsToBuffer();

    // Calcular velocidades tangenciales iniciales para orbitar el centro galáctico
    const G_GALAXY = 0.00001; // Constante gravitacional reducida para escala galáctica
    const GALACTIC_MASS = 1e10;
    
    for (let i = 0; i < this.starCount; i++) {
        const ix = i * 3;
        const px = this.positionBuffer[ix];
        const py = this.positionBuffer[ix + 1];
        const pz = this.positionBuffer[ix + 2];
        const r  = Math.sqrt(px * px + pz * pz); // Radio en el plano XZ
        
        if (r > 1.0) {
            // Velocidad circular kepleriana: v = sqrt(G*M/r)
            const vMag  = Math.sqrt(G_GALAXY * GALACTIC_MASS / r);
            // Tangencial al radio: perpendicular en XZ, normalizado
            this.velocityBuffer[ix]     = -pz / r * vMag;  // vx
            this.velocityBuffer[ix + 1] = 0;               // vy (plano galáctico)
            this.velocityBuffer[ix + 2] =  px / r * vMag;  // vz
        }
        
        // Masa estelar procedural (enanas < gigantes)
        this.massBuffer[i] = 0.1 + Math.random() * 2.0;
    }

    // Registrar en el sistema de física para integración RK4
    physicsSystem.registerGalaxyBuffer({
        positionBuffer: this.positionBuffer,
        velocityBuffer: this.velocityBuffer,
        massBuffer:     this.massBuffer,
        count:          this.starCount
    });

    console.log(`✅ [GalaxyGeneration] N-Body coupling complete. ${this.starCount} bodies registered.`);
}

/**
 * Extrae posiciones del InstancedMesh (matrices 4x4) al buffer Float32Array.
 * Opera en batch sin GC — solo lectura de BufferAttribute existente.
 */
_extractPositionsToBuffer() {
    const matrix = new THREE.Matrix4();  // Solo uno — reutilizar en el loop
    const pos    = new THREE.Vector3(); // Solo uno — reutilizar en el loop

    for (let i = 0; i < this.starCount; i++) {
        this.instancedMesh.getMatrixAt(i, matrix);
        pos.setFromMatrixPosition(matrix);

        const ix = i * 3;
        this.positionBuffer[ix]     = pos.x;
        this.positionBuffer[ix + 1] = pos.y;
        this.positionBuffer[ix + 2] = pos.z;
    }
}

/**
 * Aplica el positionBuffer (actualizado por el physics solver) al InstancedMesh.
 * Llamar desde execute() cuando nBodyEnabled === true.
 * PROHIBIDO crear nuevos objetos dentro — usa los buffers pre-asignados.
 */
_applyBufferToInstancedMesh() {
    const dummy = this._applyDummy ?? (this._applyDummy = new THREE.Object3D());
    
    for (let i = 0; i < this.starCount; i++) {
        const ix = i * 3;
        dummy.position.set(
            this.positionBuffer[ix],
            this.positionBuffer[ix + 1],
            this.positionBuffer[ix + 2]
        );
        dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    
    this.instancedMesh.instanceMatrix.needsUpdate = true;
}
```

---

## ✅ Checklist de Verificación Post-Implementación N-Body

```js
// En Chrome DevTools:
const galaxy = window.Registry?.get('GalaxyGenerationSystem');

console.log('N-Body enabled:', galaxy?.nBodyEnabled);
console.log('Position buffer size:', galaxy?.positionBuffer?.length, 'floats');
console.log('Expected size:', galaxy?.starCount * 3, 'floats');
console.log('Buffers match:', galaxy?.positionBuffer?.length === galaxy?.starCount * 3);
```
