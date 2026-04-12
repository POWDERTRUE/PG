/**
 * spherifiedCube.js
 * OMEGA V31 — Matemática de normalización del Cubo Esferificado
 * 
 * Convierte un plano NxN de una face del cubo a coordenadas esféricas
 * sin ninguna allocation en el hot path. Opera sobre sub-vistas del TerrainChunkPool.
 */

// Ejes locales para cada una de las 6 faces del cubo
// [rightAxis, upAxis, normalAxis]
const FACE_AXES = [
    [ 1,  0,  0,   0,  0, -1,   0,  1,  0], // +Y (Polo Norte)
    [ 1,  0,  0,   0,  0,  1,   0, -1,  0], // -Y (Polo Sur)
    [ 0,  0, -1,   0,  1,  0,   1,  0,  0], // +X (Ecuador Este)
    [ 0,  0,  1,   0,  1,  0,  -1,  0,  0], // -X (Ecuador Oeste)
    [ 1,  0,  0,   0,  1,  0,   0,  0,  1], // +Z (Ecuador Frente)
    [-1,  0,  0,   0,  1,  0,   0,  0, -1], // -Z (Ecuador Atrás)
];

/**
 * Llena una sub-vista de posiciones con vértices de cubo esferificado.
 * Zero allocations — opera directamente sobre Float32Array del pool.
 *
 * @param {Float32Array} posView  - Sub-vista del VBO pool (dim*dim*3 floats)
 * @param {Float32Array} normView - Sub-vista del NBO pool
 * @param {Float32Array} uvView   - Sub-vista del UBO pool
 * @param {number}       faceIdx  - Índice de face (0..5)
 * @param {number}       resolution - Dimensión NxN
 * @param {number}       radius   - Radio del planeta
 * @param {number}       ox       - Offset X normalizado del chunk en la face (0..1)
 * @param {number}       oy       - Offset Y normalizado del chunk en la face (0..1)
 * @param {number}       scale    - Escala del chunk en la face (0..1, e.g. 0.5 para LOD1)
 */
export function fillSpherifiedChunk(posView, normView, uvView, faceIdx, resolution, radius, ox, oy, scale) {
    const axes = FACE_AXES[faceIdx];
    const rx = axes[0], ry = axes[1], rz = axes[2]; // Right axis
    const ux = axes[3], uy = axes[4], uz = axes[5]; // Up axis
    const nx = axes[6], ny = axes[7], nz = axes[8]; // Normal axis

    const step = scale / (resolution - 1);
    let vi = 0; // Índice de vértice (primitivo escalar)
    let ui = 0;

    for (let row = 0; row < resolution; row++) {
        for (let col = 0; col < resolution; col++) {
            // Posición en el plano local [-1..1]
            const s = (ox + col * step) * 2 - 1;
            const t = (oy + row * step) * 2 - 1;

            // Punto en la superficie del cubo
            let px = nx + s * rx + t * ux;
            let py = ny + s * ry + t * uy;
            let pz = nz + s * rz + t * uz;

            // Normalizar (esferificación) — inline sin Vector3 para Zero-GC
            const len = Math.sqrt(px * px + py * py + pz * pz);
            const invLen = 1 / len;
            const norm_x = px * invLen;
            const norm_y = py * invLen;
            const norm_z = pz * invLen;

            // Escribir posición (en el pool directamente)
            posView[vi]     = norm_x * radius;
            posView[vi + 1] = norm_y * radius;
            posView[vi + 2] = norm_z * radius;

            // Escribir normal
            normView[vi]     = norm_x;
            normView[vi + 1] = norm_y;
            normView[vi + 2] = norm_z;

            // UV esférico
            uvView[ui]     = (col / (resolution - 1));
            uvView[ui + 1] = (row / (resolution - 1));

            vi += 3;
            ui += 2;
        }
    }
}

/**
 * Genera los índices de un grid NxN y los escribe en una sub-vista IBO del pool.
 * Solo necesita llamarse una vez por resolución (los índices son idénticos para todos los chunks).
 */
export function fillChunkIndices(idxView, resolution) {
    let i = 0;
    for (let row = 0; row < resolution - 1; row++) {
        for (let col = 0; col < resolution - 1; col++) {
            const a = row * resolution + col;
            const b = a + 1;
            const c = a + resolution;
            const d = c + 1;
            idxView[i++] = a; idxView[i++] = c; idxView[i++] = b;
            idxView[i++] = b; idxView[i++] = c; idxView[i++] = d;
        }
    }
}
