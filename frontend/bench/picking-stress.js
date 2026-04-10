/**
 * picking-stress.js
 * OMEGA V31 — Harness de estrés térmico para SelectionService
 */

import SelectionService from '../../src/engine/interaction/SelectionService.js';
import { Registry } from '../../src/engine/core/ServiceRegistry.js';

export async function runStressTest(renderer, scene, camera, iterations = 10000) {
    console.log(`[OMEGA STRESS] Iniciando ráfaga de ${iterations} selecciones (GPU/CPU)`);

    // Inyectamos un EventBus para recolectar métricas interceptadas
    const stats = {
        hitsGPU: 0,
        hitsCPU: 0,
        misses: 0,
        gpuTimes: [], // para calcular median y p95
        cpuTimes: [],
        fallbacks: 0,
        errors: 0
    };

    const mockBus = {
        emit: (topic, payload) => {
            if (topic === 'picking:readPixelsMs') stats.gpuTimes.push(payload.ms);
            if (topic === 'picking:cpuMs') stats.cpuTimes.push(payload.ms);
            if (topic === 'picking:fallbackCount') stats.fallbacks++;
            if (topic === 'picking:hit') {
                if (payload.method === 'gpu') stats.hitsGPU++;
                if (payload.method === 'cpu') stats.hitsCPU++;
            }
            if (topic === 'picking:miss') stats.misses++;
            if (topic.includes('Error')) stats.errors++;
        }
    };

    Registry.setMock('events', mockBus);

    // Inicializar Servicio
    const service = new SelectionService({ renderer, scene, camera });

    // Ráfaga asincrónica
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        // En un entorno de nodo o DOM sintético
        const w = renderer?.domElement?.width || 1920;
        const h = renderer?.domElement?.height || 1080;
        
        const x = Math.floor(Math.random() * w);
        const y = Math.floor(Math.random() * h);
        
        await service.queryAtScreen(x, y);
    }
    const totalTime = performance.now() - start;

    // Calcular percentiles
    const calcP = (arr, p) => {
        if (!arr.length) return 0;
        const sorted = [...arr].sort((a,b) => a - b);
        const pos = (sorted.length - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) {
            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        } else {
            return sorted[base];
        }
    };

    const gpuMedian = calcP(stats.gpuTimes, 0.5);
    const gpuP95 = calcP(stats.gpuTimes, 0.95);
    
    console.log('--- REPORTE DE TELEMETRÍA (SELECTION SERVICE) ---');
    console.log(`Total tiempo = ${totalTime.toFixed(2)}ms (Avg: ${(totalTime / iterations).toFixed(3)}ms/llamada)`);
    console.log(`Hits GPU: ${stats.hitsGPU} | Hits CPU: ${stats.hitsCPU} | Misses: ${stats.misses}`);
    console.log(`Latencia GPU [Median]: ${gpuMedian.toFixed(2)}ms | [P95]: ${gpuP95.toFixed(2)}ms`);
    console.log(`Fallbacks: ${stats.fallbacks} (${((stats.fallbacks / iterations) * 100).toFixed(2)}%)`);
    console.log('--------------------------------------------------');

    return stats;
}
