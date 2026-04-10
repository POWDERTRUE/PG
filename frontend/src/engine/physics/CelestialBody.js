/**
 * CelestialBody.js — Base Class for All Physical Masses
 * ======================================================
 * Motor OMEGA V31 | Powder Galaxy
 *
 * LEY 15 — UNIVERSE_LAWS.md:
 *   Todo objeto con masa física real DEBE heredar de esta clase.
 *   Sin excepciones. Sin deuda técnica.
 *
 * REGLA 8 — Zero-GC Enforcement:
 *   El scratch pool (_v1, _v2, _v3, _q1) vive a nivel de módulo.
 *   Una sola asignación para TODAS las subclases combinadas.
 *   Las subclases NO pueden declarar buffers duplicados para los mismos propósitos.
 *
 * Uso correcto en subclasses:
 *   import { CelestialBody, _v1, _v2, _v3, _q1 } from './CelestialBody.js';
 *   // Usar dentro de update() sin new THREE.Vector3()
 *
 * @module CelestialBody
 * @version V31.0.0
 */

import * as THREE from 'three';

// ══════════════════════════════════════════════════════════════════════════════
// SCRATCH POOL — MÓDULO LEVEL (REGLA 8)
// Alojados UNA sola vez por módulo. Cero GC posterior.
// Compartidos por CelestialBody y TODAS sus subclases.
// ══════════════════════════════════════════════════════════════════════════════

/** @type {THREE.Vector3} Scratch Vector3 #1 — uso temporal en update() */
export const _v1 = new THREE.Vector3();

/** @type {THREE.Vector3} Scratch Vector3 #2 — uso temporal en update() */
export const _v2 = new THREE.Vector3();

/** @type {THREE.Vector3} Scratch Vector3 #3 — uso temporal en update() */
export const _v3 = new THREE.Vector3();

/** @type {THREE.Quaternion} Scratch Quaternion — uso temporal en update() */
export const _q1 = new THREE.Quaternion();


// ══════════════════════════════════════════════════════════════════════════════
// CELESTIALBODY — BASE CLASS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Clase base abstracta para toda masa con propiedades físicas en el motor.
 *
 * Subclasificar para: planetas, estrellas, lunas, satélites, asteroides.
 * NO subclasificar para: efectos visuales, UI, partículas, hitboxes.
 *
 * @abstract
 */
export class CelestialBody {
    /**
     * @param {object} opts - Opciones de configuración de la masa
     * @param {number}  opts.mass       - Masa en unidades-engine (1u = 1e10 kg)
     * @param {number}  opts.radius     - Radio en unidades-engine (1u = 1000 km)
     * @param {string}  opts.nodeType   - Tipo canónico: 'planet'|'star'|'moon'|'satellite'|'asteroid'
     * @param {string}  opts.name       - Nombre único del objeto en la escena
     * @param {object}  [opts.bodyProfile] - Perfil astronómico (LEY 12)
     */
    constructor({ mass, radius, nodeType, name, bodyProfile = null } = {}) {
        if (new.target === CelestialBody) {
            throw new TypeError('[CelestialBody] Clase abstracta — no instanciar directamente.');
        }

        // ── Propiedades físicas canónicas ────────────────────────────────────
        this._mass      = mass     ?? 0;
        this._radius    = radius   ?? 1;
        this._nodeType  = nodeType ?? 'unknown';
        this._name      = name     ?? 'Unnamed_CelestialBody';

        // ── Perfil astronómico (LEY 12) ──────────────────────────────────────
        this._bodyProfile = bodyProfile ?? CelestialBody._defaultProfile(nodeType);

        // ── Mesh raíz del objeto 3D (asignado por subclase o after init) ─────
        /** @type {THREE.Object3D|null} */
        this.mesh = null;

        // ── Estado de ciclo de vida ──────────────────────────────────────────
        this._initialized = false;
        this._disposed    = false;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // GETTERS — Interfaz pública inmutable
    // ══════════════════════════════════════════════════════════════════════════

    /** Masa gravitacional en unidades-engine. @type {number} */
    get mass()       { return this._mass; }

    /** Radio del cuerpo en unidades-engine. @type {number} */
    get radius()     { return this._radius; }

    /**
     * Tipo canónico del nodo.
     * @type {'planet'|'star'|'moon'|'satellite'|'asteroid'|'supraconsciousness'|string}
     */
    get nodeType()   { return this._nodeType; }

    /** Nombre único en el grafo de escena. @type {string} */
    get name()       { return this._name; }

    /**
     * Perfil astronómico para el visor HUD (LEY 12).
     * Incluye: classification, analog, trackingSignature, hazard.
     * @type {object}
     */
    get bodyProfile() { return this._bodyProfile; }


    // ══════════════════════════════════════════════════════════════════════════
    // USERDATA — Contrato canónico para el grafo de escena (LEY 5, LEY 12)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Genera el objeto `userData` canónico para asignar al mesh THREE.js.
     * Estandariza los campos que el HUD, el raycast y la física esperan.
     *
     * @param {object} [overrides] - Campos adicionales específicos de la subclase
     * @returns {object}
     */
    buildUserData(overrides = {}) {
        return {
            isMass:                 true,
            nodeType:               this._nodeType,
            bodyProfile:            this._bodyProfile,
            celestialBodyInstance:  this,   // referencia inversa para el HUD
            ...overrides,
        };
    }


    // ══════════════════════════════════════════════════════════════════════════
    // LIFECYCLE HOOKS — Override en subclases
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Inicializa el cuerpo: construye geometrías, materiales y lo añade a la escena.
     * Llamado por el kernel durante la fase de boot, NO en el constructor.
     *
     * @param {THREE.Scene} scene  - Escena THREE.js
     * @param {object}      kernel - Referencia al UniverseKernel
     */
    init(scene, kernel) {
        this._initialized = true;
    }

    /**
     * Actualiza el estado del cuerpo por frame.
     * REGLA 8: Cero allocations — usa únicamente los buffers _v1/_v2/_v3/_q1 del módulo.
     *
     * @param {number} dt - Delta time en segundos
     */
    update(dt) {
        // Override en subclase. No llamar super.update() a menos que se añada lógica base.
    }

    /**
     * Libera todos los recursos de GPU y referencias de escena.
     * Obligatorio al descargar un sector (LEY 6) o al destruir la instancia.
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        if (this.mesh) {
            // Liberar geometrías y materiales recursivamente
            this.mesh.traverse((child) => {
                if (child.geometry)   child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
            this.mesh = null;
        }
    }


    // ══════════════════════════════════════════════════════════════════════════
    // STATIC UTILITIES
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Retorna el perfil astronómico por defecto para un nodeType dado.
     * Evita que los cuerpos queden sin firma de tracking (LEY 12, REGLA 14).
     *
     * @param {string} nodeType
     * @returns {object}
     */
    static _defaultProfile(nodeType) {
        const profiles = {
            planet:             { classification: 'Terrestrial Body',   analog: 'Unknown',       trackingSignature: 'PLANET',   hazard: 'LOW'    },
            star:               { classification: 'Main Sequence Star',  analog: 'Sol Class G',   trackingSignature: 'STAR',     hazard: 'HIGH'   },
            moon:               { classification: 'Natural Satellite',   analog: 'Luna Class',    trackingSignature: 'MOON',     hazard: 'LOW'    },
            satellite:          { classification: 'Artificial Satellite', analog: 'MetaMorph Mk1', trackingSignature: 'SAT',      hazard: 'NONE'   },
            asteroid:           { classification: 'Minor Body',          analog: 'C-Type',        trackingSignature: 'ASTEROID', hazard: 'MEDIUM' },
            supraconsciousness: { classification: 'Singularity',         analog: 'Sagittarius A*', trackingSignature: 'CORE',    hazard: 'OMEGA'  },
        };
        return profiles[nodeType] ?? { classification: 'Unknown Body', analog: '—', trackingSignature: 'UNK', hazard: 'UNKNOWN' };
    }

    /**
     * Type guard: verifica que un Object3D proviene de un CelestialBody.
     * Uso: CelestialBody.isCelestialBody(mesh) → true si .userData.celestialBodyInstance existe.
     *
     * @param {THREE.Object3D} obj
     * @returns {boolean}
     */
    static isCelestialBody(obj) {
        return !!(obj?.userData?.celestialBodyInstance instanceof CelestialBody);
    }

    /**
     * Recupera la instancia CelestialBody desde un Object3D, si existe.
     *
     * @param {THREE.Object3D} obj
     * @returns {CelestialBody|null}
     */
    static fromMesh(obj) {
        return obj?.userData?.celestialBodyInstance ?? null;
    }
}
