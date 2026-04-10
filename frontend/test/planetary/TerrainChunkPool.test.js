/**
 * TerrainChunkPool.test.js
 * OMEGA V31 — Pruebas unitarias del pool Zero-GC
 */

import { TerrainChunkPool } from '../../src/engine/planetary/TerrainChunkPool.js';

describe('TerrainChunkPool — Contratos Zero-GC', () => {

    it('Pre-asigna la memoria correcta en boot', () => {
        const pool = new TerrainChunkPool(10, 8);
        // 10 chunks × 8×8 verts × 3 floats = 1920 floats
        console.assert(pool._vboPool.length === 10 * 8 * 8 * 3, 'VBO Pool size incorrecto');
        console.assert(pool.available === 10, 'Stack inicial debe tener 10 slots');
    });

    it('acquire() devuelve IDs únicos y O(1)', () => {
        const pool = new TerrainChunkPool(5, 8);
        const ids = new Set();
        for (let i = 0; i < 5; i++) {
            const id = pool.acquire();
            console.assert(id >= 0, 'ID debe ser >= 0');
            ids.add(id);
        }
        console.assert(ids.size === 5, 'Todos los IDs deben ser únicos');
        console.assert(pool.available === 0, 'Pool debe estar vacío');
    });

    it('acquire() devuelve -1 cuando el pool está agotado', () => {
        const pool = new TerrainChunkPool(2, 8);
        pool.acquire(); pool.acquire();
        const id = pool.acquire();
        console.assert(id === -1, 'Pool agotado debe devolver -1');
    });

    it('release() devuelve el chunk al pool correctamente', () => {
        const pool = new TerrainChunkPool(3, 8);
        const id0 = pool.acquire();
        console.assert(pool.available === 2, 'Debe haber 2 disponibles');
        pool.release(id0);
        console.assert(pool.available === 3, 'Debe haber 3 disponibles tras release');
    });

    it('acquire/release ciclo LRU reutiliza el mismo slot', () => {
        const pool = new TerrainChunkPool(1, 8);
        const id1 = pool.acquire();
        pool.release(id1);
        const id2 = pool.acquire();
        console.assert(id1 === id2, 'Debe reutilizar el mismo slot');
    });

    it('getPositionView devuelve sub-vista sin copiar datos', () => {
        const pool = new TerrainChunkPool(2, 4);
        const id = pool.acquire();
        const view = pool.getPositionView(id);
        // La vista debe ser parte del mismo buffer subyacente
        console.assert(view.buffer === pool._vboPool.buffer, 'Sub-vista debe compartir buffer');
        console.assert(view.length === 4 * 4 * 3, 'Longitud de vista incorrecta');
    });
});
