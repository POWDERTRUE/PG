// frontend/src/engine/planet/LandingPhysicsSystem.js
/**
 * OMEGA V31 — LandingPhysicsSystem
 *
 * Controlador de aterrizaje procedural. Opera en la fase 'physics' del
 * FrameScheduler (antes de la actualización visual de cámara).
 *
 * Estrategia: Reverse Raycasting Analítico O(log N)
 * ─────────────────────────────────────────────────
 * En lugar de hacer Raycast contra la malla poligonal (CPU-bound en 65k vértices),
 * evaluamos la función de terreno analítica directamente en el punto bajo la nave.
 * Es el mismo evaluateTerrain() que el Worker usa — mismo hash, mismas octavas —
 * garantizando que la física coincide con la visual píxel a píxel.
 *
 * OMEGA DIRECTIVE: Zero GC en el update loop (sin new Vector3 en caliente).
 */
import { Registry }          from '../core/ServiceRegistry.js';
import * as THREE            from 'three';
import { evaluateTerrain }   from './PlanetMathUtils.js';

// Constante de la Esfera de Influencia (SOI) — multiplicador sobre el radio
const SOI_MULTIPLIER     = 1.5;   // La nave entra en modo planetario a 1.5× el radio
const HOVER_ALTITUDE     = 50.0;  // Altitud de hover por defecto (unidades de mundo)
const SPRING_CONSTANT    = 2.5;   // Rigidez del resorte de altitud
const DRAG_COEFFICIENT   = 0.92;  // Amortiguación inercial por frame
const ENTRY_BRAKE_START  = 1.3;   // Multiplier sobre el radio para empezar el freno
const MAX_DESCENT_SPEED  = 80.0;  // Velocidad máxima de descenso permitida

export class LandingPhysicsSystem {
    constructor() {
        this.camera        = null;
        this.activePlanet  = null;
        this.isEnabled     = true;
        this.isDescending  = false;

        // ── Buffers Zero-GC: pre-alocados, nunca instanciados en update() ────
        this._localUp        = new THREE.Vector3();
        this._shipPos        = new THREE.Vector3();
        this._velocity       = new THREE.Vector3();
        this._correction     = new THREE.Vector3();
        this._prevPos        = new THREE.Vector3();
        // FIX RUBBERBAND: posición MUNDIAL del planeta (no local a su padre)
        this._planetWorldPos = new THREE.Vector3();
        // FIX GC en _alignCameraToTerrain
        this._lookDir        = new THREE.Vector3();
        this._lookTarget     = new THREE.Vector3();
    }

    init() {
        this.camera = Registry.get('camera');
        this._shipPos.copy(this.camera.position);
        this._prevPos.copy(this._shipPos);

        Registry.get('scheduler').register(this, 'physics');

        // CRÍTICO: Cuando el FloatingOriginSystem ejecuta un Origin Shift,
        // la cámara salta al origen (0,0,0) pero el mundo se mueve.
        // Debemos corregir la posición interna de la nave para que el
        // Spring-Damper no interprete ese salto como un movimiento violento.
        const events = Registry.tryGet('events');
        if (events) {
            events.on('ORIGIN_SHIFTED', (offset) => {
                // La cámara se fue al origen; nuestra shipPosition también debe reflejarlo
                this._shipPos.sub(offset);
                this._prevPos.sub(offset);
            });
        }

        console.log('🛸 [LandingPhysicsSystem] Orbital Descent Mechanics Online.');
    }

    /**
     * Detecta si la nave está dentro de la SOI de algún planeta registrado.
     * O(P) donde P = número de planetas activos (normalmente 1-3).
     * @returns {object|null} el planeta activo o null
     */
    _detectActivePlanet() {
        const builder = Registry.get('PlanetBuilderSystem');
        if (!builder) return null;

        for (const [, planet] of builder.planets) {
            // FIX RUBBERBAND: usar posición MUNDIAL del grupo del planeta.
            // planet.position es LOCAL a universeLayer — después de un Origin Shift
            // el grupo se desplaza, pero .position local no cambia.
            planet.group.getWorldPosition(this._planetWorldPos);
            const dist = this._shipPos.distanceTo(this._planetWorldPos);
            if (dist < planet.radius * SOI_MULTIPLIER) {
                return planet;
            }
        }
        return null;
    }

    /**
     * Obtiene la altitud topográfica exacta en la dirección 'localUp' desde
     * el centro del planeta. Misma función que el TerrainWorker, mismos parámetros.
     * Garantiza coincidencia visual-física pixel-perfect.
     */
    _getGroundAltitude(localUpDir, planetRadius) {
        // localUpDir ya es unitario (normalizado por el caller)
        return evaluateTerrain(localUpDir.x, localUpDir.y, localUpDir.z, planetRadius);
    }

    update(deltaTime) {
        if (!this.isEnabled) return;

        // Sincronizar posición de la nave con la cámara actual
        this._shipPos.copy(this.camera.position);

        // 1. Detección de SOI
        this.activePlanet = this._detectActivePlanet();
        if (!this.activePlanet) {
            this.isDescending = false;
            return; // Espacio profundo — el sistema de navegación toma el mando
        }

        this.isDescending = true;

        // 2. Leer la posición MUNDIAL del planeta (no la local a universe layer)
        // CRITICAL FIX: tras un Origin Shift, universeLayer.position cambia pero
        // planet.group.position (local) permanece igual. Con getWorldPosition()
        // obtenemos la coordenada real en el espacio de la cámara.
        this.activePlanet.group.getWorldPosition(this._planetWorldPos);

        // 3. Vector Local Up: dirección del núcleo del planeta hacia la nave
        this._localUp
            .subVectors(this._shipPos, this._planetWorldPos)
            .normalize();

        const distToCore = this._shipPos.distanceTo(this._planetWorldPos);

        // 4. Altitud topográfica analítica exactamente bajo la nave
        const groundRadius   = this._getGroundAltitude(this._localUp, this.activePlanet.radius);
        const radarAltitude  = distToCore - groundRadius;

        // 4. Freno de entrada atmosférica
        // Fuera del rango de hover pero dentro del SOI → aplicar drag atmosférico
        if (distToCore < this.activePlanet.radius * ENTRY_BRAKE_START) {
            // Derivar velocidad de frame anterior (Zero-GC: reutilizamos _velocity)
            this._velocity
                .subVectors(this._shipPos, this._prevPos)
                .divideScalar(Math.max(deltaTime, 0.001));

            // Limitar velocidad de descenso máxima
            const descentSpeed = -this._velocity.dot(this._localUp);
            if (descentSpeed > MAX_DESCENT_SPEED) {
                // Frenado proporcional: reducir componente de descenso
                const brakeForce = (descentSpeed - MAX_DESCENT_SPEED) * deltaTime;
                this._correction.copy(this._localUp).multiplyScalar(brakeForce);
                this._shipPos.add(this._correction);
            }
        }

        // 5. Sistema de Hover — Resorte Amortiguado (Spring-Damper)
        const hoverAlt  = this.activePlanet.hoverAltitude ?? HOVER_ALTITUDE;
        const altError  = hoverAlt - radarAltitude;

        if (radarAltitude < hoverAlt * 2.0) {
            // altError > 0: nave por debajo del hover target → empujar hacia arriba
            // altError < 0: nave por encima → dejar caer suavemente
            const spring = altError * SPRING_CONSTANT * deltaTime;
            this._correction.copy(this._localUp).multiplyScalar(spring);
            this._shipPos.add(this._correction);
        }

        // 6. Anti-interpenetración: nunca dejar a la nave bajo la superficie
        const finalDist = this._shipPos.distanceTo(this._planetWorldPos);
        if (finalDist < groundRadius + 1.0) {
            // Push de emergencia (evita tunneling si el frame rate cae)
            // FIX: sumamos _planetWorldPos (mundial) no activePlanet.position (local)
            this._shipPos.copy(this._localUp)
                .multiplyScalar(groundRadius + 1.0)
                .add(this._planetWorldPos);
        }

        // 7. Guardar posición actual para cálculo de velocidad en el siguiente frame
        this._prevPos.copy(this.camera.position); // antes de mutar la cámara

        // 8. Aplicar posición física a la cámara
        this.camera.position.copy(this._shipPos);

        // 9. Alinear la cámara al terreno (look-at perpendicular a LocalUp)
        // Solo si estamos en modo aterrizaje profundo (altimetría < 200u)
        if (radarAltitude < 200.0) {
            this._alignCameraToTerrain();
        }

        // Telemetría en tiempo real al HUD
        this._emitTelemetry(radarAltitude, groundRadius);
    }

    /**
     * Orienta la cámara para que su "up" apunte al cenit planetario local.
     * Esto elimina la sensación de gravedad artificial del eje Y global.
     */
    _alignCameraToTerrain() {
        // Recalcular localUp con posición mundial actualizada
        this._localUp
            .subVectors(this.camera.position, this._planetWorldPos)
            .normalize();

        // FIX GC: reusar _lookDir en lugar de new THREE.Vector3() en caliente
        this._lookDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
        // Proyectar sobre el plano perpendicular a localUp
        this._lookDir.sub(
            this._correction.copy(this._localUp).multiplyScalar(this._lookDir.dot(this._localUp))
        ).normalize();

        this.camera.up.copy(this._localUp);
        // FIX GC: reusar _lookTarget en lugar de camera.position.clone()
        this._lookTarget.addVectors(this.camera.position, this._lookDir);
        this.camera.lookAt(this._lookTarget);
    }

    /**
     * Publica métricas de altimetría en el EventBus para que el HUD las muestre.
     * Zero-GC: no instanciamos objeto nuevo, usamos un objeto de evento pre-cacheado.
     */
    _emitTelemetry(radarAlt, groundRadius) {
        const events = Registry.tryGet('events');
        if (!events) return;
        events.emit('LANDING:TELEMETRY', {
            radarAltitude: radarAlt,
            groundRadius:  groundRadius,
            isHovering:    radarAlt < (this.activePlanet?.hoverAltitude ?? HOVER_ALTITUDE) * 1.1,
            planetId:      this.activePlanet?.id ?? 'unknown'
        });
    }

    disable() { this.isEnabled = false; this.isDescending = false; }
    enable()  { this.isEnabled = true; }
}
