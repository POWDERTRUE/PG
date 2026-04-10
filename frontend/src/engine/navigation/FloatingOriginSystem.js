// frontend/src/engine/navigation/FloatingOriginSystem.js
/**
 * OMEGA V31 — FloatingOriginSystem
 *
 * Solución al Float32 Precision Jitter en mundos a escala galáctica.
 *
 * PROBLEMA: WebGL opera con float32 (7 dígitos significativos).
 * A 10.000 unidades del origen, los vértices tienen una resolución de ~0.1 unidades.
 * Resultado visual: terreno temblando (jitter), Z-fighting en sombras.
 *
 * SOLUCIÓN: Mantener la cámara siempre cerca de (0,0,0).
 * Cuando supere el umbral, trasladamos TODA la geometría del mundo en dirección
 * opuesta al desplazamiento de la cámara, devolviendo a la cámara al origen.
 * Para el observador humano el salto es absolutamente invisible.
 *
 * OMEGA DIRECTIVE: Zero GC en el update loop.
 * Phase: 'post-navigation' — después del movimiento, antes del render.
 */
import { Registry } from '../core/ServiceRegistry.js';
import * as THREE   from 'three';

// Umbral de 5000 unidades (comparamos lengthSq para evitar sqrt por frame)
// A 5000u, float32 retiene ~sub-milimétrica resolución para objetos de ~1m
const THRESHOLD    = 5000.0;
const THRESHOLD_SQ = THRESHOLD * THRESHOLD;

export class FloatingOriginSystem {
    constructor() {
        // Posición absoluta de la nave en el universo lógico (Float64 acumulado)
        // THREE.Vector3 usa Float64 en JS — solo la GPU ve float32
        this.absoluteUniversePosition = new THREE.Vector3();

        // Buffers Zero-GC
        this._shiftOffset = new THREE.Vector3();
        this._negOffset   = new THREE.Vector3();

        this.camera     = null;
        this.sceneGraph = null;
        this.eventBus   = null;

        // FIX RUBBERBANDING: desactivado por defecto.
        // Solo se activa en modo de vuelo/descenso planetario.
        // En el menú de perfil y el mapa galáctico, la cámara puede estar
        // legítimamente lejos del origen sin necesidad de un shift.
        this.isActive = false;

        this._shiftCount = 0;
    }

    init() {
        this.camera     = Registry.get('camera');
        this.sceneGraph = Registry.get('SceneGraph');
        this.eventBus   = Registry.get('events');

        Registry.get('scheduler').register(this, 'post-navigation');

        // Solo activar el sistema cuando la nave entra en modo de vuelo
        // dentro de la SOI de un planeta. Fuera de ese contexto, la cámara
        // puede estar a cualquier distancia del origen (menú, mapa galáctico).
        this.eventBus?.on?.('LANDING:TELEMETRY', () => {
            if (!this.isActive) {
                this.isActive = true;
                console.log('🌌 [FloatingOriginSystem] Shift activado — modo vuelo planetario.');
            }
        });

        // Desactivar cuando la nave salga de la SOI
        this.eventBus?.on?.('PLANET_SOI_EXIT', () => {
            this.isActive = false;
        });

        console.log('🌌 [FloatingOriginSystem] Infinite Precision Protocol Online.');
    }

    update() {
        // FIX: solo correr cuando estamos en modo de vuelo planetario
        if (!this.isActive) return;
        if (this.camera.position.lengthSq() > THRESHOLD_SQ) {
            this._executeOriginShift();
        }
    }

    _executeOriginShift() {
        // 1. Capturar la magnitud del desplazamiento acumulado (Zero-GC copy)
        this._shiftOffset.copy(this.camera.position);

        // 2. Teletransportar la cámara al centro del universo visual
        //    (para la GPU, la cámara SIEMPRE está cerca de 0,0,0)
        this.camera.position.set(0, 0, 0);
        this.camera.updateMatrixWorld();

        // 3. Desplazar las capas del SceneGraph con costo de update optimizado
        //    backgroundLayer: HDRI / nebulosas estáticas — posición se mueve pero
        //                     no necesita cascade (no hay hijos con física)
        //    universeLayer:   planetas, estrellas, naves — cascade OBLIGATORIO
        //    overlayLayer:    UI 3D ligera — se auto-actualiza en el render loop
        this._negOffset.copy(this._shiftOffset).negate();

        if (this.sceneGraph.backgroundLayer) {
            this.sceneGraph.backgroundLayer.position.add(this._negOffset);
        }
        if (this.sceneGraph.universeLayer) {
            this.sceneGraph.universeLayer.position.add(this._negOffset);
            this.sceneGraph.universeLayer.updateMatrixWorld(true); // cascade obligatorio
        }
        if (this.sceneGraph.overlayLayer) {
            this.sceneGraph.overlayLayer.position.add(this._negOffset);
        }

        // 4. Actualizar el contador de posición lógica Float64
        //    absoluteUniversePosition acumula la posición real de la nave
        this.absoluteUniversePosition.add(this._shiftOffset);

        // 5. Notificar al motor (EventBus → LandingPhysicsSystem, QuadTreeLOD, etc.)
        //    CRÍTICO: LandingPhysicsSystem necesita restar el offset a su posición
        //    interna para no interpretar el salto como un movimiento brusco de 5000u
        this.eventBus.emit('ORIGIN_SHIFTED', this._shiftOffset);

        this._shiftCount++;
        if (this._shiftCount % 10 === 1) {
            // Log ocasional (no por frame para no saturar la consola)
            console.log(
                `%c[FloatingOrigin] Shift #${this._shiftCount} | ` +
                `Offset: (${this._shiftOffset.x.toFixed(0)}, ` +
                `${this._shiftOffset.y.toFixed(0)}, ` +
                `${this._shiftOffset.z.toFixed(0)}) | ` +
                `Universo absoluto: (${this.absoluteUniversePosition.x.toFixed(0)}, ` +
                `${this.absoluteUniversePosition.y.toFixed(0)}, ` +
                `${this.absoluteUniversePosition.z.toFixed(0)})`,
                'color:#ff9900;font-weight:bold'
            );
        }
    }

    /**
     * Desplaza una capa completa del SceneGraph en el offset negativo.
     * Usa `position.add()` (in-place, Zero-GC) y actualiza la matriz mundial.
     */
    _shiftLayer(layer) {
        if (!layer) return;
        layer.position.add(this._negOffset);
        layer.updateMatrixWorld(true); // Force cascade update para todos los hijos
    }

    /**
     * Devuelve la posición REAL del jugador en el mapa galáctico (Float64).
     * Combina el acumulador lógico con la posición visual actual de la cámara.
     */
    getAbsolutePosition(target = new THREE.Vector3()) {
        return target.addVectors(this.absoluteUniversePosition, this.camera.position);
    }

    /**
     * Convierte una posición de universo absoluta (Float64) a
     * coordenadas locales visuales (Float32 seguras).
     */
    toVisualSpace(absolutePos, target = new THREE.Vector3()) {
        return target.subVectors(absolutePos, this.absoluteUniversePosition);
    }
}
