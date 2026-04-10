// frontend/src/engine/physics/CelestialPhysicsSystem.js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { PHYSICS_CONSTANTS } from '../config/UniverseSpec.js';

/**
 * CelestialPhysicsSystem â€” V30 Orbital Engine
 * Manages rotation for hierarchical Object3D nodes.
 */
export class CelestialPhysicsSystem {
    static dependencies = ["events", "EntityManager"];

    constructor(kernel) {
        this.kernel = kernel || window.engine;
        this.registry = window.Registry || (this.kernel ? this.kernel.registry : null);
        
        this.orbitalNodes = [];
        this.isMapModeActive = false;
        this.mapModeSnapshot = null;
        this.constants = PHYSICS_CONSTANTS;
        
        this._initRK4Buffers();
        this.registryDeps();
    }

    registryDeps() {
        if (!this.registry) return;
        CelestialPhysicsSystem.dependencies.forEach(dep => {
            this[dep] = this.registry.get(dep);
        });
        this.constants = this.registry.tryGet?.('constants') || PHYSICS_CONSTANTS;
        console.log("[DI] CelestialPhysicsSystem dependencies resolved:", CelestialPhysicsSystem.dependencies);
    }

    _getGravityConstant() {
        return this.constants?.G ?? PHYSICS_CONSTANTS.G;
    }

    /**
     * registerOrbit â€” Converts a static procedural orbit into a dynamic Newtonian simulation.
     * @param {THREE.Object3D} node 
     * @param {number} speed 
     */
    registerOrbit(node, speed) {
        // En OMEGA V-FINAL, localizamos la masa real dentro del pivot (el planeta o luna)
        let body = node.children.find(c => c.userData?.isMass);
        if (!body) body = node; // Fallbacks para estrellas o sistemas vacÃ­os

        const isCentralStar = body.userData?.nodeType === 'star';
        const mass = isCentralStar ? 333000 : (Math.random() * 100 + 10);
        
        const localPos = body.position.clone();
        const r = localPos.length();
        let velocity = new THREE.Vector3(0, 0, 0);
        let centralMass = 0;
        const G = this._getGravityConstant();
        
        if (r > 0.1) {
            // Deduce a virtual central mass so the resulting Keplerian orbit 
            // perfectly matches the original procedural 'speed' parameter for stable defaults.
            // Formula: GM = v^2 * r
            const vMag = speed * r;
            centralMass = (vMag * vMag * r) / G;
            
            // Initial tangential velocity vector
            velocity.set(0, 0, -vMag);
            
            // Zero out legacy rotation to prevent hybrid-physics jitter
            node.rotation.y = 0; 
        }

        this.orbitalNodes.push({ 
            node,           // Pivot node (retains X/Z inclination)
            body,           // Actual physical mesh
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
     * registerOrbitAroundSupraconsciousness
     * -------------------------------------
     * Registra un nodo cuyo centro gravitacional REAL es la Masa de Supraconciencia
     * (posicionada en el origen absoluto del universo, inamovible).
     * No inventa una masa virtual — usa la UNICA masa central del cosmos.
     * Solo debe usarse para nodos galacticos de nivel 1 (sistemas solares).
     *
     * @param {THREE.Object3D} node - El pivot/root que va a orbitar el centro
     * @param {number} [supramass=1000000] - Masa gravitacional de la Supraconciencia
     */
    registerOrbitAroundSupraconsciousness(node, supramass = 1_000_000) {
        const body = node;
        const r = node.position.length();
        let velocity = new THREE.Vector3(0, 0, 0);
        const G = this._getGravityConstant();

        if (r > 0.1) {
            const vMag = Math.sqrt(G * supramass / r);
            // Tangente orbital en el plano XZ (disco galactico)
            const dir = new THREE.Vector3(-node.position.z, 0, node.position.x).normalize();
            velocity.copy(dir).multiplyScalar(vMag);
        }

        this.orbitalNodes.push({
            node,
            body,
            mass: 0,
            centralMass: supramass,    // <- UNICA masa central del universo
            velocity,
            _paused: false,
            _savedSpeed: r > 0 ? velocity.length() / r : 0,
            _originalPosition: body.position.clone(),
            _originalNodePosition: node.position.clone(),
            _isGalacticOrbit: true,
        });

        console.log(
            `%c[SupraFisica] ${node.name} vinculado a Supraconciencia | r=${r.toFixed(1)}u | v=${velocity.length().toFixed(4)} u/s`,
            `color:#bb88ff;font-weight:bold;font-size:12px`
        );
    }

    /**
     * update — Synchronized Frame Pulse (Orbital Mechanics)
     * Ejecuta el Engine Loop determinista empleando RK4 (Runge-Kutta 4th Order).
     * Semi-Implicit Euler obsoleto desde V31 — ver integrateRK4().
     * @param {number} deltaTime - Fixed timestep
     */
    update(deltaTime) {
        if (this.isMapModeActive) return; // Pausar simulaciÃ³n en Modo Mapa
        
        const G = this._getGravityConstant();
        
        for (let i = 0; i < this.orbitalNodes.length; i++) {
            const data = this.orbitalNodes[i];
            if (data._paused) continue;

            if (data.centralMass > 0) {
                // V31 â€” Runge-Kutta 4th Order integrator (stable orbits, zero drift)
                this.integrateRK4(data, deltaTime, G);
            } else if (data.node !== data.body) {
                // Central stars / anchors â€” slow self-rotation only
                data.body.rotation.y += 0.05 * deltaTime;
            }
        }
    }

    /**
     * CÃ“DIGO NIVEL INGENIERÃA: FPS Gravity Gun
     * Detiene el determinismo orbital del planeta, lo atrae hacia la cÃ¡mara vÃ­a GSAP,
     * y tras X segundos lo devuelve a la posiciÃ³n orbital nativa.
     */
    applyGravityPull(node, cameraRig, duration = 3) {
        const orbitalData = this.orbitalNodes.find(item => item.node === node);
        if (!orbitalData || orbitalData._paused) return; // Ya estÃ¡ siendo atraÃ­do

        // El node es el pivot orbital. La fÃ­sica real ocurre en su hijo (orbitalData.body)
        orbitalData._paused = true;
        
        // Registrar posiciÃ³n para volver despuÃ©s del secuestro gravitacional
        if (!orbitalData._originalNodePosition) {
            orbitalData._originalNodePosition = node.position.clone();
        }

        // Calcular posiciÃ³n de atracciÃ³n (frente a la cÃ¡mara en world space)
        const worldCameraPos = cameraRig.position.clone();
        const worldCameraFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRig.quaternion);
        const gripWorldPos = worldCameraPos.addScaledVector(worldCameraFwd, 25);
        
        // Convertir a local space del pivot
        const localTarget = gripWorldPos.clone();
        if (node.parent) {
            node.parent.worldToLocal(localTarget);
        }

        // gsap de AtracciÃ³n -> Pausa de 3s -> Retorno a Newton
        gsap.killTweensOf(node.position);
        gsap.to(node.position, {
            x: localTarget.x,
            y: localTarget.y,
            z: localTarget.z,
            duration: 1.0,
            ease: "power2.out",
            onComplete: () => {
                // Esperar los 3s y devolver a la Ã³rbita
                gsap.to(node.position, {
                    x: orbitalData._originalNodePosition.x,
                    y: orbitalData._originalNodePosition.y,
                    z: orbitalData._originalNodePosition.z,
                    duration: 1.5,
                    delay: duration,
                    ease: "power2.inOut",
                    onComplete: () => {
                        // Reactivar cÃ¡lculo fÃ­sico Newtoniano sin des-sincronizaciÃ³n
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
     * CÃ“DIGO NIVEL INGENIERÃA: Map Mode
     * Recolecta todas las masas, pausa las Ã³rbitas y las reacomoda en un
     * enjambre/galerÃ­a interactivo frente al jugador.
     */
    arrangeInMapMode(cameraRig, focusTarget) {
        this.isMapModeActive = true;
        this.mapModeSnapshot = [];
        
        const scene = this._getScene(cameraRig);
        if (!scene) return;
        
        const bodies = [];
        scene.traverse((obj) => {
            if (obj === focusTarget) return; 
            
            // Recoger planetas, lunas o cualquier masa espacial
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

        // La cÃ¡mara estarÃ¡ mirando hacia atrÃ¡s en 1.8 segundos, proyectamos ese vector forward final
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
            
            // CÃ¡lculos para una GalerÃ­a en Curva
            const indexFactor = bodiesCount > 1 ? (i / (bodiesCount - 1)) : 0.5;
            const angle = (indexFactor * Math.PI * 0.8) - (Math.PI * 0.4); // -72 a +72 grados
            const curveDepth = Math.cos(angle) * 60; 
            
            const worldTarget = rigPos.clone()
                .addScaledVector(baseForward, 120 + curveDepth)
                .addScaledVector(baseRight, Math.sin(angle) * 220)
                .addScaledVector(baseUp, ((i % 3) - 1) * 35); // Tres niveles verticales
                
            // Convertir a Local Space del body padre
            const localTarget = worldTarget.clone();
            if (body.parent) {
                body.parent.worldToLocal(localTarget);
            }
            
            // Crear dummy para calcular LookAt
            const dummy = new THREE.Object3D();
            if (body.parent) body.parent.add(dummy);
            dummy.position.copy(localTarget);
            dummy.lookAt(rigPos); 
            
            // TransiciÃ³n suave
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  V31 â€” RK4 INTEGRATOR  (Runge-Kutta 4th Order)
    //  Zero GC: all Vector3 buffers pre-allocated in constructor.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /**
     * Pre-allocate 12 THREE.Vector3 scratch buffers.
     * Called once in constructor â€” never again.
     */
    _initRK4Buffers() {
        this._rk4 = {
            k1_pos: new THREE.Vector3(),
            k1_vel: new THREE.Vector3(),
            k2_pos: new THREE.Vector3(),
            k2_vel: new THREE.Vector3(),
            k3_pos: new THREE.Vector3(),
            k3_vel: new THREE.Vector3(),
            k4_pos: new THREE.Vector3(),
            k4_vel: new THREE.Vector3(),
            tmpPos: new THREE.Vector3(),
            tmpVel: new THREE.Vector3(),
            acc:    new THREE.Vector3(),
            rVec:   new THREE.Vector3(),
        };
        console.log('%c[CelestialPhysics] RK4 buffers pre-allocated â€” zero-GC orbital mode active', 'color:#ffaa00;font-weight:bold');
    }

    /**
     * Compute gravitational acceleration into `outAcc` (pre-allocated buffer).
     * ZERO allocations â€” writes directly into the output Vector3.
     *
     * @param {THREE.Vector3} position
     * @param {number}        centralMass
     * @param {number}        G
     * @param {THREE.Vector3} outAcc  â€” written in place
     */
    _gravitationalAcceleration(position, centralMass, G, outAcc) {
        const rVec = this._rk4.rVec.copy(position);
        const rSq = rVec.lengthSq();
        if (rSq < 0.01 || centralMass <= 0) {
            outAcc.set(0, 0, 0);
            return;
        }
        const aMag = (G * centralMass) / rSq;
        const r    = Math.sqrt(rSq);
        // outAcc = -normalize(position) * aMag
        outAcc.copy(rVec).multiplyScalar(-aMag / r);
    }

    /**
     * Runge-Kutta 4th Order orbital integrator.
     * Replaces Semi-Implicit Euler â€” provides long-term orbital stability.
     * All intermediate vectors come from this._rk4 â€” ZERO per-frame allocations.
     *
     * @param {object} data       â€” OrbitalNode {body, centralMass, velocity, _savedSpeed}
     * @param {number} deltaTime  â€” Fixed physics timestep (seconds)
     * @param {number} [G=0.1]   â€” Engine gravitational constant
     */
    integrateRK4(data, deltaTime, G = this.constants?.G ?? PHYSICS_CONSTANTS.G) {
        const { k1_pos, k1_vel, k2_pos, k2_vel, k3_pos, k3_vel, k4_pos, k4_vel,
                tmpPos, tmpVel, acc } = this._rk4;

        const pos = data.body.position; // THREE.Vector3 â€” mutated in-place
        const vel = data.velocity;      // THREE.Vector3 â€” mutated in-place
        const h   = deltaTime;
        const M   = data.centralMass;

        // â”€â”€ K1: gradient at current state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        k1_pos.copy(vel);
        this._gravitationalAcceleration(pos, M, G, acc);
        k1_vel.copy(acc);

        // â”€â”€ K2: gradient at pos + h/2 * k1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        tmpPos.copy(pos).addScaledVector(k1_pos, h * 0.5);
        tmpVel.copy(vel).addScaledVector(k1_vel, h * 0.5);
        k2_pos.copy(tmpVel);
        this._gravitationalAcceleration(tmpPos, M, G, acc);
        k2_vel.copy(acc);

        // â”€â”€ K3: gradient at pos + h/2 * k2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        tmpPos.copy(pos).addScaledVector(k2_pos, h * 0.5);
        tmpVel.copy(vel).addScaledVector(k2_vel, h * 0.5);
        k3_pos.copy(tmpVel);
        this._gravitationalAcceleration(tmpPos, M, G, acc);
        k3_vel.copy(acc);

        // â”€â”€ K4: gradient at pos + h * k3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        tmpPos.copy(pos).addScaledVector(k3_pos, h);
        tmpVel.copy(vel).addScaledVector(k3_vel, h);
        k4_pos.copy(tmpVel);
        this._gravitationalAcceleration(tmpPos, M, G, acc);
        k4_vel.copy(acc);

        // â”€â”€ Combine: pos += h/6 * (k1 + 2k2 + 2k3 + k4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const s = h / 6.0;
        pos.addScaledVector(k1_pos, s)
           .addScaledVector(k2_pos, s * 2)
           .addScaledVector(k3_pos, s * 2)
           .addScaledVector(k4_pos, s);

        vel.addScaledVector(k1_vel, s)
           .addScaledVector(k2_vel, s * 2)
           .addScaledVector(k3_vel, s * 2)
           .addScaledVector(k4_vel, s);

        // Self-rotation (omitida para órbitas galácticas — solo traslación interesante)
        if (!data._isGalacticOrbit) {
            data.body.rotation.y += (data._savedSpeed * 2.5) * deltaTime;
        }
    }
}
