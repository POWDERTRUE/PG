/**
 * picking-bench-pbo.js
 * OMEGA V31 — Arnés de Estrés y Telemetría P95 para PBO Async Readback
 * 
 * Uso:
 *   import { PBOTelemetryHarness } from './bench/picking-bench-pbo.js';
 *   const harness = new PBOTelemetryHarness(selectionService);
 *   harness.start(10000, 'sync');   // Baseline síncrono
 *   harness.start(10000, 'async');  // PBO asíncrono
 */

import { Registry } from '../src/engine/core/ServiceRegistry.js';

export class PBOTelemetryHarness {
    constructor(selectionService) {
        this.selectionService = selectionService;
        this.events = Registry.get('events') || { emit: () => {} };
        this.telemetry = Registry.get('telemetry');

        // Todos los arrays son pre-alojados con tamaño fijo para evitar GC en el hot path
        this._maxSamples = 10000;
        this.frameTimes = new Float64Array(this._maxSamples);
        this.latencies  = new Float64Array(this._maxSamples);
        this._frameIdx   = 0;
        this._latencyIdx = 0;

        this.droppedFrames = 0;
        this.isRunning = false;
        this.lastTime = 0;
        this._mode = 'async';

        this._bindLoop = this._tick.bind(this);
    }

    start(durationMs = 10000, mode = 'async') {
        console.log(`%c[OMEGA BENCH] Iniciando PBO Benchmark (${mode.toUpperCase()}) — ${durationMs}ms`, 'color: #00ffcc; font-weight: bold;');

        // Activar/desactivar path síncrono para comparativa A/B
        if (this.selectionService && this.selectionService.config) {
            this.selectionService.config.enablePBO = (mode === 'async');
        }
        this._mode = mode;

        // Resetear primitivos (sin new allocations)
        this._frameIdx = 0;
        this._latencyIdx = 0;
        this.droppedFrames = 0;
        this.isRunning = true;
        this.lastTime = performance.now();

        requestAnimationFrame(this._bindLoop);
        
        // Auto-stop
        setTimeout(() => this.stop(), durationMs);
    }

    async _tick(now) {
        if (!this.isRunning) return;

        // Frame Time
        const ft = now - this.lastTime;
        if (this._frameIdx < this._maxSamples) {
            this.frameTimes[this._frameIdx++] = ft;
        }
        if (ft > 16.7) this.droppedFrames++;
        this.lastTime = now;

        // Selección aleatoria sin asignar objetos nuevos
        const x = Math.random() * (window.innerWidth  || 1920);
        const y = Math.random() * (window.innerHeight || 1080);
        const reqStart = performance.now();

        this.selectionService.queryAtScreen(x, y).then(() => {
            const lat = performance.now() - reqStart;
            if (this._latencyIdx < this._maxSamples) {
                this.latencies[this._latencyIdx++] = lat;
            }
        });

        requestAnimationFrame(this._bindLoop);
    }

    stop() {
        this.isRunning = false;
        this._generateReport();
    }

    _percentile(typedArr, length, p) {
        // Ordenar una vista del array sin crear nuevo array en heap
        const view = typedArr.subarray(0, length);
        const sorted = view.slice().sort(); // slice retorna TypedArray del mismo tipo
        return sorted[Math.floor(length * p)];
    }

    _generateReport() {
        const fLen = this._frameIdx;
        const lLen = this._latencyIdx;

        const fMedian = this._percentile(this.frameTimes, fLen, 0.50);
        const fP90    = this._percentile(this.frameTimes, fLen, 0.90);
        const fP95    = this._percentile(this.frameTimes, fLen, 0.95);

        const lMedian = this._percentile(this.latencies, lLen, 0.50);
        const lP95    = this._percentile(this.latencies, lLen, 0.95);
        const lMax    = this._percentile(this.latencies, lLen, 0.99);

        const dropRate = fLen > 0 ? ((this.droppedFrames / fLen) * 100).toFixed(2) : '0.00';

        const report = {
            mode: this._mode.toUpperCase(),
            totalFrames: fLen,
            droppedFrames: this.droppedFrames,
            dropRatePct: dropRate + '%',
            frameTimeMs: {
                median: fMedian?.toFixed(2),
                p90: fP90?.toFixed(2),
                p95: fP95?.toFixed(2),
            },
            pickingLatencyMs: {
                median: lMedian?.toFixed(2),
                p95: lP95?.toFixed(2),
                p99_max: lMax?.toFixed(2),
            },
            verdict: fP95 < 16.7 ? '✅ P95 DENTRO DEL UMBRAL' : '❌ P95 EXCEDE 16.7ms — ACTIVAR TRIPLE BUFFER'
        };

        console.log(`%c[OMEGA BENCH] REPORTE ${this._mode.toUpperCase()} COMPLETO`, 'color: #00ffcc; font-weight: bold;');
        console.table(report);

        // Emitir telemetría al EvenBus y al servicio persistente
        this.events.emit('bench:pbo:report', report);
        if (this.telemetry && typeof this.telemetry.push === 'function') {
            this.telemetry.push('bench.pbo.report', { ...report, ts: Date.now() });
        }

        return report;
    }
}
