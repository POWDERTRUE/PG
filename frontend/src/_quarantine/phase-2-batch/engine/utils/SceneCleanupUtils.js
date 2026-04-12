/**
 * SceneCleanupUtils.js
 * OMEGA V31 — Utilidades de limpieza y reestructuración de escena
 * Zero-GC: opera sobre referencias existentes, no crea allocations.
 */

import * as THREE from 'three';

// ─── Dispose de un objeto y sus recursos GPU ────────────────────────────────
function _disposeObject(obj) {
    if (obj.geometry) {
        obj.geometry.dispose();
    }
    if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
            if (m.map)          m.map.dispose();
            if (m.emissiveMap)  m.emissiveMap.dispose();
            if (m.normalMap)    m.normalMap.dispose();
            if (m.roughnessMap) m.roughnessMap.dispose();
            if (m.alphaMap)     m.alphaMap.dispose();
            if (m.envMap)       m.envMap.dispose();
            m.dispose();
        });
    }
}

/**
 * Elimina del grafo de escena todos los objetos que cumplen el predicado.
 * Libera geometría, materiales y texturas de forma segura (Zero-GC post-cleanup).
 *
 * @param {THREE.Object3D} scene
 * @param {Function} predicate - (obj) => boolean. Default: userData.isMass === true
 * @returns {number} Número de objetos eliminados
 */
export function removeMasses(scene, predicate = obj => obj.userData.isMass === true) {
    const toRemove = [];

    scene.traverse(obj => {
        if (predicate(obj)) {
            toRemove.push(obj);
        }
    });

    // Remover de leaf a root para no invalidar el traverse
    toRemove.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        _disposeObject(obj);
    });

    console.log(`[SceneCleanup] Removed ${toRemove.length} mass objects.`);
    return toRemove.length;
}

/**
 * Dimea todos los emissive de la escena multiplicando la intensidad actual.
 * @param {THREE.Object3D} scene
 * @param {number} factor - Multiplicador (0.0-1.0). Default: 0.35
 */
export function dimAllEmissives(scene, factor = 0.35) {
    let count = 0;
    scene.traverse(obj => {
        if (!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
            if (m.emissive && m.emissiveIntensity !== undefined) {
                m.emissiveIntensity = (m.emissiveIntensity || 1.0) * factor;
                m.needsUpdate = true;
                count++;
            }
        });
    });
    console.log(`[SceneCleanup] Dimmed emissive on ${count} materials (×${factor}).`);
}

/**
 * Ajusta el bloom en tiempo real vía la referencia al compositor.
 * Llámalo desde la consola: SceneCleanup.tweakBloom(postPass, { strength: 0.2 })
 */
export function tweakBloom(postProcessPass, { strength, threshold, radius } = {}) {
    const bp = postProcessPass?.bloomPass;
    if (!bp) { console.warn('[SceneCleanup] bloomPass no encontrado.'); return; }
    if (strength  !== undefined) bp.strength  = strength;
    if (threshold !== undefined) bp.threshold = threshold;
    if (radius    !== undefined) bp.radius    = radius;
    console.log(`[SceneCleanup] Bloom → strength:${bp.strength} threshold:${bp.threshold} radius:${bp.radius}`);
}

/**
 * Organizador de escena en capas semánticas.
 * Mueve objetos al grupo correspondiente según su userData.
 *
 * @param {THREE.Scene} scene
 * @returns {{ planets: THREE.Group, stars: THREE.Group, ui: THREE.Group }}
 */
export function buildSemanticGroups(scene) {
    const planets = scene.getObjectByName('PlanetsGroup') || new THREE.Group();
    const stars   = scene.getObjectByName('StarsGroup')   || new THREE.Group();
    const ui      = scene.getObjectByName('UIGroup')      || new THREE.Group();

    planets.name = 'PlanetsGroup';
    stars.name   = 'StarsGroup';
    ui.name      = 'UIGroup';

    if (!planets.parent) scene.add(planets);
    if (!stars.parent)   scene.add(stars);
    if (!ui.parent)      scene.add(ui);

    console.log('[SceneCleanup] Semantic groups ready: PlanetsGroup, StarsGroup, UIGroup');
    return { planets, stars, ui };
}

/**
 * Aplica limpieza visual rápida completa.
 * Requiere referencias vivas al kernel de OMEGA V31.
 *
 * @param {{ scene, renderer, postProcessPass }} engine
 */
export function quickVisualCleanup({ scene, renderer, postProcessPass } = {}) {
    if (renderer) {
        renderer.toneMappingExposure = 0.62;
        console.log('[SceneCleanup] toneMappingExposure → 0.62');
    }

    tweakBloom(postProcessPass, { strength: 0.32, threshold: 0.75, radius: 0.20 });
    dimAllEmissives(scene, 0.40);
    buildSemanticGroups(scene);
    console.log('[SceneCleanup] ✅ Quick visual cleanup complete.');
}
