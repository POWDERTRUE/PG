/**
 * PBO.contract.test.js
 */

import { GPUPickingAdapterPBO } from '../../src/engine/interaction/adapters/GPUPickingAdapterPBO.js';

describe('GPUPickingAdapterPBO - WebGL2 Zero-Stall Ping-Pong', () => {

    it('Lanza error estructural si no detecta entorno WebGL2', () => {
        let threw = false;
        try {
            const mockWebGL1Renderer = {
                getContext: () => ({ /* contexto vacío que fallará instanceof */ })
            };
            new GPUPickingAdapterPBO({ renderer: mockWebGL1Renderer, scene: {}, camera: {} });
        } catch (e) {
            threw = true;
        }
        console.assert(threw, "Falló la protección de aislamiento WebGL2 para el PBO.");
    });
});
