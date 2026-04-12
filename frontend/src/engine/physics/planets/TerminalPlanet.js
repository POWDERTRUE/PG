/**
 * TerminalPlanet.js — CelestialBody: Canary Migration #1
 * ========================================================
 * Motor OMEGA V31 | Powder Galaxy
 *
 * LEY 15 — Primera masa del sistema solar migrada al contrato CelestialBody.
 * Planet_Terminal es el "canary" de la migración escalonada. Su clase 'volcanic'
 * lo hace el nodo más simple: sin nubes, sin city lights, sin rings.
 *
 * REGLA 8 — Zero-GC:
 *   update() está vacío — la física es gestionada por CelestialPhysicsSystem (RK4).
 *   Los vectores _v1/_v2/_v3/_q1 del módulo CelestialBody están disponibles si se
 *   necesitan en futuras extensiones de comportamiento volcánico.
 *
 * REGLA 18 — No masa sin CelestialBody:
 *   userData.celestialBodyInstance = this → LEY 15 satisfecha.
 *
 * REGLA 19 — No shader duplicado:
 *   Hitbox usa MaterialRegistry.get('hitbox-invisible').
 *   Material de superficie: PlanetShaderSystem.upgradePlanet() lo compila una
 *   sola vez y lo cachea en su _textureCache. El placeholder inicial es desechable
 *   y queda `dispose()`'d por upgradePlanet() de forma intencional.
 *
 * Bug documentado (uCameraPos atmosphérico — VIOLACIÓN 3):
 *   El shader de atmósfera calcula parallax desde (0,0,0) en lugar de la posición
 *   real de la cámara. Bug visual puro — diferido a PR "Shading & Rendering Fixes".
 *   No afecta física ni GC.
 *
 * @module TerminalPlanet
 * @version V31.1.0 — Canary Migration
 */

import * as THREE from 'three';
import { CelestialBody }     from '../CelestialBody.js';
import { MaterialRegistry }  from '../../rendering/MaterialRegistry.js';
import { ASTRONOMY_BODY_PROFILES } from '../../config/UniverseSpec.js';


// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — Extraídas de GALAXY_SPEC para este nodo específico
// Inmutables — no pasar como parámetros (fuente única de verdad: UniverseSpec.js)
// ══════════════════════════════════════════════════════════════════════════════

const TERMINAL_CONFIG = Object.freeze({
    appId:       'terminal',
    appName:     'Terminal',
    planetClass: 'volcanic',
    color:       0xff5522,
    orbitRadius: 150,
    orbitSpeed:  0.88,
    moonCount:   1,

    // Geometría — comparte resolución con el shared planetGeo de GalaxyGenerator
    geometryDetail: 5,
    geometryRadius: 10,

    // Hitbox — radio suficientemente grande para interacción desde vista cenital
    hitboxRadius: 180,
});


// ══════════════════════════════════════════════════════════════════════════════
// TERMINAL PLANET — CelestialBody Subclass
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Planet_Terminal — Clase Volcanic | Primera masa migrada a CelestialBody.
 *
 * Ciclo de vida:
 *   1. `new TerminalPlanet()` — datos lógicos solamente
 *   2. `terminalPlanet.buildMesh(shaderSystem)` — construye Three.js mesh
 *   3. GalaxyGenerator añade `terminalPlanet.mesh` al orbit pivot
 *   4. `update(dt)` — vacío (física delegada a CelestialPhysicsSystem RK4)
 *   5. `dispose()` — heredado de CelestialBody (geometría + materiales propios)
 */
export class TerminalPlanet extends CelestialBody {

    constructor() {
        super({
            mass:        0.34,      // massEarths (ASTRONOMY_BODY_PROFILES.volcanic)
            radius:      TERMINAL_CONFIG.geometryRadius,
            nodeType:    'planet',
            name:        `Planet_${TERMINAL_CONFIG.appName}`,
            bodyProfile: Object.freeze({
                ...ASTRONOMY_BODY_PROFILES.volcanic,
                analog:            'Mercurio / Io',
                orbitalPeriodDays: 88,
            }),
        });

        // Propiedades específicas de este planeta
        this.planetClass  = TERMINAL_CONFIG.planetClass;
        this.appId        = TERMINAL_CONFIG.appId;
        this.appName      = TERMINAL_CONFIG.appName;
        this.orbitRadius  = TERMINAL_CONFIG.orbitRadius;
        this.orbitSpeed   = TERMINAL_CONFIG.orbitSpeed;
        this.moonCount    = TERMINAL_CONFIG.moonCount;
        this.color        = TERMINAL_CONFIG.color;

        // Estado de construcción
        this._meshBuilt   = false;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // buildMesh() — Construye la representación Three.js del planeta
    // Llamado por GalaxyGenerator durante createHierarchicalSolarSystem()
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Construye el mesh Three.js del planeta, aplica el shader volcánico de
     * PlanetShaderSystem, y retorna el mesh para que GalaxyGenerator lo añada
     * al orbit pivot.
     *
     * NOTA DE ARQUITECTURA:
     *   upgradePlanet() llama a `mesh.material.dispose()` internamente para
     *   reemplazar el placeholder por el ShaderMaterial volcánico compilado.
     *   Por eso el placeholder inicial es un `new THREE.MeshStandardMaterial()`
     *   desechable — NO usar MaterialRegistry aquí o se corrompería el cache.
     *   El material final (volcánico) vive en PlanetShaderSystem._textureCache,
     *   que ya funciona como su propio registry de texturas canónicas.
     *
 * @param {import('../../rendering/PlanetShaderSystem.js').PlanetShaderSystem} shaderSystem
     * @returns {THREE.Mesh} this.mesh — La malla principal del planeta
     */
    buildMesh(shaderSystem) {
        if (this._meshBuilt) {
            console.warn('[TerminalPlanet] buildMesh() llamado más de una vez. Ignorado.');
            return this.mesh;
        }

        // ── 1. Geometría ─────────────────────────────────────────────────────
        const geo = new THREE.IcosahedronGeometry(
            TERMINAL_CONFIG.geometryRadius,
            TERMINAL_CONFIG.geometryDetail
        );

        // ── 2. Material placeholder (será reemplazado por upgradePlanet) ─────
        // INTENCIONAL: no usar MaterialRegistry aquí. upgradePlanet() llama
        // mesh.material.dispose() — corromperías el cache compartido.
        const placeholderMat = new THREE.MeshStandardMaterial({
            color:    this.color,
            roughness: 0.92,
            metalness: 0.15,
        });

        // ── 3. Mesh principal ─────────────────────────────────────────────────
        this.mesh              = new THREE.Mesh(geo, placeholderMat);
        this.mesh.name         = this._name;
        this.mesh.castShadow   = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.orbitRadius, 0, 0);

        // ── 4. userData canónico — LEY 15 (REGLA 18) ─────────────────────────
        // buildUserData() inyecta celestialBodyInstance:this
        this.mesh.userData = this.buildUserData({
            isApp:       true,
            isNode:      true,
            appId:       this.appId,
            appName:     this.appName,
            planetClass: this.planetClass,
            distance:    this.orbitRadius,
            orbitRadius: this.orbitRadius,
            moonCount:   this.moonCount,
            label:       this.appName,
        });

        // ── 5. Hitbox invisible — REGLA 19 (MaterialRegistry) ────────────────
        const hitboxGeo = new THREE.SphereGeometry(TERMINAL_CONFIG.hitboxRadius, 6, 6);
        const hitboxMat = MaterialRegistry.get('hitbox-invisible'); // ← registry compliant
        const hitbox    = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.name     = `Hitbox_${this.appName}`;
        hitbox.userData = { ...this.mesh.userData }; // propaga firma de tracking
        this.mesh.add(hitbox);

        // ── 6. Shader volcánico + atmósfera procedural ────────────────────────
        // upgradePlanet() reemplaza placeholderMat por el ShaderMaterial volcanic.
        // También añade: atmósfera (ShaderMaterial Rayleigh/Mie), sin nubes,
        // sin city lights, sin rings — los 3 sistemas más costosos están exentos.
        shaderSystem.upgradePlanet(this.mesh, this.planetClass, false);

        this._meshBuilt    = true;
        this._initialized  = true;

        console.log(
            `%c[TerminalPlanet] ✅ LEY 15 — Planet_Terminal construido como CelestialBody.`,
            'color:#ff7744;font-weight:bold;font-size:11px'
        );
        console.log(
            `%c   Clase: ${this.planetClass} | isMass:${this.mesh.userData.isMass} | celestialBodyInstance: ${!!this.mesh.userData.celestialBodyInstance}`,
            'color:#aaaaaa;font-size:10px'
        );

        return this.mesh;
    }


    // ══════════════════════════════════════════════════════════════════════════
    // update() — REGLA 8: Zero-GC, cero allocations
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Actualización por frame de Planet_Terminal.
     *
     * Volcánico no tiene:
     *   - Nubes animadas (solo ocean/jungle/desert/ice/gas_giant)
     *   - City lights (solo ocean/jungle/ice)
     *   - Ring system (solo gas_giant)
     *   - Emisión de partículas de ceniza (futuro sistema, aún no implementado)
     *
     * La física orbital es gestionada con RK4 por CelestialPhysicsSystem.
     * Este método queda vacío intencionalmente — cero trabajo CPU por frame.
     *
     * Zero-GC: si en el futuro se añade comportamiento, usar _v1/_v2/_v3/_q1
     * importados de CelestialBody.js, nunca `new THREE.Vector3()` aquí.
     *
     * @param {number} dt - Delta time en segundos
     */
    update(dt) {
        // Volcanic Phase 1: sin comportamiento propio — todo gestionado por sistemas externos.
        // _v1, _v2, _v3, _q1 disponibles del módulo CelestialBody para uso futuro.
    }


    // ══════════════════════════════════════════════════════════════════════════
    // dispose() — Libera recursos GPU
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Destruye los recursos propios del planeta.
     * ⚠️ No destruir el material volcánico (propiedad de PlanetShaderSystem._textureCache).
     * ⚠️ No destruir el hitboxMat (propiedad de MaterialRegistry — usar release()).
     * La geometría del cuerpo principal SÍ es propia y se destruye.
     */
    dispose() {
        if (this._disposed) return;

        // Liberar ref al hitbox-invisible en el registry
        MaterialRegistry.release('hitbox-invisible');

        // La geometría del mesh principal es propia — dispose() de CelestialBody
        // recorre el árbol pero NO hace dispose() del material volcánico post-shader
        // porque PlanetShaderSystem lo gestiona en su propio _textureCache.
        if (this.mesh) {
            // Solo geometry propia — no el material (gestionado por PlanetShaderSystem)
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
        }

        this._disposed = true;
        console.log('[TerminalPlanet] 🗑️ Disposed — recursos GPU liberados.');
    }
}
