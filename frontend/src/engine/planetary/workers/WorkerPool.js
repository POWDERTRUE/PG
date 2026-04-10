/**
 * WorkerPool.js
 * OMEGA V31 — Scheduler de Web Workers con backpressure
 */

export class WorkerPool {
    /**
     * @param {string} workerUrl - URL del terrain.worker.js
     * @param {number} size - Número de workers (default: hardwareConcurrency/2)
     */
    constructor(workerUrl, size) {
        this._size = size || Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2));
        this._workers = [];
        this._idle = [];   // Stack de workers disponibles
        this._queue = [];  // Cola de tareas pendientes

        for (let i = 0; i < this._size; i++) {
            const w = new Worker(workerUrl, { type: 'module' });
            w._id = i;
            w.onmessage = (e) => this._onResult(w, e);
            w.onerror   = (e) => console.error(`[WorkerPool] Worker ${i} error:`, e);
            this._workers.push(w);
            this._idle.push(w);
        }

        console.log(`[WorkerPool] ${this._size} workers inicializados.`);
    }

    /**
     * Encola una tarea de generación de chunk.
     * @param {object} task - { chunkId, positions (ArrayBuffer), ...params }
     * @param {function} onComplete - callback(chunkId, positionsBuffer)
     */
    enqueue(task, onComplete) {
        if (this._idle.length > 0) {
            const worker = this._idle.pop();
            this._dispatch(worker, task, onComplete);
        } else {
            // Backpressure: log y encolar
            if (this._queue.length > 100) {
                console.warn('[WorkerPool] Cola saturada (>100). Descartando tarea de lod menor.');
                return;
            }
            this._queue.push({ task, onComplete });
        }
    }

    _dispatch(worker, task, onComplete) {
        worker._onComplete = onComplete;
        // Transferir el ArrayBuffer del pool al Worker (zero-copy)
        worker.postMessage(task, [task.positions]);
    }

    _onResult(worker, e) {
        const { chunkId, positions } = e.data;
        
        // Notificar al consumidor con el buffer devuelto
        if (worker._onComplete) {
            worker._onComplete(chunkId, positions);
            worker._onComplete = null;
        }

        // Procesar cola si hay tareas pendientes
        if (this._queue.length > 0) {
            const { task, onComplete } = this._queue.shift();
            this._dispatch(worker, task, onComplete);
        } else {
            this._idle.push(worker);
        }
    }

    get queueDepth() { return this._queue.length; }
    get idleCount()  { return this._idle.length; }

    dispose() {
        for (const w of this._workers) w.terminate();
        this._workers.length = 0;
        this._idle.length = 0;
        this._queue.length = 0;
    }
}
