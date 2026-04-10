/**
 * SelectionService.contract.test.js
 */

import { SelectionService } from '../../src/engine/interaction/SelectionService.js';
import { Registry } from '../../src/engine/core/ServiceRegistry.js';

describe('SelectionService Fallback Contract', () => {

    it('Prioriza GPUPickingAdapter si responde a tiempo', async () => {
        // Setup Mocks
        Registry.setMock('events', { emit: () => {} });
        Registry.setMock('telemetry', null);

        const svc = new SelectionService();
        svc.registerObject(42, { isGPU: true });

        // Mock GPU Hit
        svc.gpuAdapter.readIdAt = async () => {
            return { id: 42, distance: 100, hitPoint: {} };
        };

        // Ignoramos el CPU
        svc.bvhAdapter.raycastFromScreen = () => { return null; };

        const hit = await svc.queryAtScreen(500, 500);
        console.assert(hit && hit.id === 42, 'SelectionService falló en priorizar el hit de la promesa asincrónica rápida de GPU');
    });

    it('Ejecuta el fallback BVH CPU si GPU Picking supera el umbral de Timeout', async () => {
        const events = { emitted: [], emit(topic, payload) { this.emitted.push({ topic, payload }); } };
        Registry.setMock('events', events);
        
        const svc = new SelectionService({ config: { gpuTimeoutMs: 12 } });
        svc.registerObject(19, { isCPU: true });

        // Emulamos una latencia gigante en GPU
        svc.gpuAdapter.readIdAt = async () => {
            return new Promise(resolve => setTimeout(() => resolve({ id: 999 }), 50));
        };

        // CPU Responde bien
        svc.bvhAdapter.raycastFromScreen = () => {
            return { id: 19, distance: 30, hitPoint: {} };
        };

        const hit = await svc.queryAtScreen(500, 500);

        // Se verifica que devuelva la info del BVH (id 19) no del GPU (999) 
        // porque el GPU excedió los 12ms.
        console.assert(hit && hit.id === 19, 'SelectionService no regresó al Fallback de CPU tras el timeout GPU');

        const fallbackEmit = events.emitted.find(e => e.topic === 'picking:fallbackCount');
        console.assert(fallbackEmit, 'No se emitió aviso métrico del picking:fallbackCount al backend');
    });
});
