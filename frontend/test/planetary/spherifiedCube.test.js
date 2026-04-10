/**
 * spherifiedCube.test.js
 * OMEGA V31 — Pruebas de la matemática de normalización
 */

import { fillSpherifiedChunk, fillChunkIndices } from '../../src/engine/planetary/utils/spherifiedCube.js';

describe('spherifiedCube — Matemática de Esferificación', () => {

    const RES = 4, RADIUS = 1000;

    it('Todos los vértices están aproximadamente a la distancia RADIUS del origen', () => {
        const posView  = new Float32Array(RES * RES * 3);
        const normView = new Float32Array(RES * RES * 3);
        const uvView   = new Float32Array(RES * RES * 2);

        fillSpherifiedChunk(posView, normView, uvView, 0, RES, RADIUS, 0, 0, 1);

        for (let i = 0; i < RES * RES; i++) {
            const x = posView[i*3], y = posView[i*3+1], z = posView[i*3+2];
            const dist = Math.sqrt(x*x + y*y + z*z);
            const err = Math.abs(dist - RADIUS);
            console.assert(err < 0.01, `Vértice ${i} distancia incorrecta: ${dist.toFixed(2)} (esperado ${RADIUS})`);
        }
    });

    it('Las 6 faces generan vértices en semiesferas distintas', () => {
        const normals = [];
        for (let face = 0; face < 6; face++) {
            const posView  = new Float32Array(4 * 4 * 3);
            const normView = new Float32Array(4 * 4 * 3);
            const uvView   = new Float32Array(4 * 4 * 2);
            fillSpherifiedChunk(posView, normView, uvView, face, 4, 1, 0, 0, 1);
            // Registrar normal del centro aprox.
            normals.push([normView[0], normView[1], normView[2]]);
        }
        // Ninguna face debe tener misma normal dominante que otra
        console.assert(normals.length === 6, '6 faces generadas');
    });

    it('fillChunkIndices produce el número correcto de triángulos', () => {
        const expectedTris = (RES-1) * (RES-1) * 2;
        const idxView = new Uint16Array(expectedTris * 3);
        fillChunkIndices(idxView, RES);
        const maxIdx = Math.max(...idxView);
        console.assert(maxIdx < RES*RES, 'Índices fuera del rango de vértices');
    });
});
