import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '../config/UniverseSpec.js';

export class OrbitalMechanicsSystem {
    constructor(kernel) {
        // 1. Core References
        this.kernel = kernel;
        this.registry = kernel.registry;
        
        // 2. Dependency Placeholders (Strictly populated in init)
        this.celestialRegistry = null;
        this.constants = null;
        
        // 3. Pre-allocated Math & Memory Objects (Zero GC spikes - LAW 4)
        this._rVector = new THREE.Vector3();
        this._forceVector = new THREE.Vector3();
        this._acceleration = new THREE.Vector3();
        
        // 4. Internal State
        this.isActive = false;
    }

    /**
     * Executes once during Kernel Phase 2 (Boot).
     * ONLY fetch dependencies here. Do NOT execute loop logic.
     */
    init() {
        this.celestialRegistry = this.registry.get('celestialRegistry');
        
        // Obtenemos las constantes de PHYSICS_CONSTANTS.md
        // Si no existe un servicio de constantes, usamos los valores axioma por defecto
        this.constants = this.registry.tryGet('constants') || PHYSICS_CONSTANTS;
        
        if (!this.celestialRegistry) {
            throw new Error(`[${this.constructor.name}] Critical Dependency Missing in Registry: celestialRegistry.`);
        }

        this.isActive = true;
        console.log(`[${this.constructor.name}] Online and Registered. N-Body Euler Integration active.`);
    }

    /**
     * Executes every frame based on FrameScheduler phase.
     * @param {number} deltaTime - Time elapsed since last frame.
     */
    update(deltaTime) {
        if (!this.isActive) return;

        // Time Dilation Protection (PHYSICS_CONSTANTS.md - LAW 1.3)
        const dt = Math.min(deltaTime, this.constants.MAX_DT);
        const G = this.constants.G;
        const cullDistanceSq = this.constants.CULL_DISTANCE * this.constants.CULL_DISTANCE;
        
        const entities = this.celestialRegistry.getDynamicBodies();
        const anchors = this.celestialRegistry.getStaticAnchors(); // ej. Estrellas masivas

        // Semi-Implicit Euler Integration (N-Body)
        for (let i = 0; i < entities.length; i++) {
            const body = entities[i];

            // Resetear aceleración para este frame
            this._acceleration.set(0, 0, 0);

            // Calcular atracción hacia las anclas estáticas (Estrellas)
            for (let j = 0; j < anchors.length; j++) {
                const anchor = anchors[j];
                
                // r_vector = anchor.position - body.position
                this._rVector.subVectors(anchor.position, body.position);
                const distanceSq = this._rVector.lengthSq();

                // Hitbox Culling: Ignorar si están demasiado cerca para evitar div/0 o infinitos
                if (distanceSq < cullDistanceSq) continue;

                // F = G * (M1 / r^2) -> Aceleración del cuerpo
                const forceScalar = (G * anchor.mass) / distanceSq;
                
                // normalize(r) * F
                this._forceVector.copy(this._rVector).normalize().multiplyScalar(forceScalar);
                this._acceleration.add(this._forceVector);
            }

            // Aplicar Semi-Implicit Euler (Actualizar Velocidad y luego Posición)
            // v_{n+1} = v_n + a_n * dt
            body.velocity.addScaledVector(this._acceleration, dt);
            
            // p_{n+1} = p_n + v_{n+1} * dt
            body.position.addScaledVector(body.velocity, dt);

            // Marcar la matriz para actualización si es un InstancedMesh o Mesh normal
            if (body.mesh) {
                body.mesh.position.copy(body.position);
                body.mesh.updateMatrix();
            }
        }
    }

    /**
     * Absolute destruction. Required for memory safety when unloading systems.
     */
    dispose() {
        this.isActive = false;
        // Limpiar referencias a entidades para permitir Garbage Collection general
        this.celestialRegistry = null;
        console.log(`[${this.constructor.name}] Terminated and memory released.`);
    }
}
