/**
 * server.js
 * V8 Master Orchestrator (Clustered) — V31 Fix
 *
 * ARCHITECTURE:
 *   PRIMARY  → WebSocket Server (port 5556) — single instance, no port conflict
 *   WORKERS  → HTTP API Server  (port 5555) — one per CPU core, load-balanced by OS
 *
 * WHY: WebSocket.Server bound to a port can only be owned by ONE process.
 *      Previously every worker tried to bind 5556 — only 1 won, others died silently
 *      and triggered endless cluster.fork() restarts.
 *
 * INTER-PROCESS: Workers send { type:'WS_BROADCAST' } to primary via process.send().
 *                Primary relays to all OTHER workers via WS_CLUSTER_BROADCAST.
 *                WebSocket broadcasts to own clients then tells primary to relay.
 */
const cluster = require('cluster');
const os      = require('os');
const startApiServer       = require('./apiServer');
const startWebSocketServer = require('./websocketServer');

const availableCPUs = os.cpus().length;
const requestedWorkers = Number.parseInt(process.env.PG_HTTP_WORKERS ?? '', 10);
const defaultWorkers = process.platform === 'win32'
    ? Math.min(availableCPUs, 4)
    : availableCPUs;
const numCPUs = Number.isFinite(requestedWorkers) && requestedWorkers > 0
    ? Math.min(availableCPUs, requestedWorkers)
    : defaultWorkers;

// ─── PRIMARY PROCESS ──────────────────────────────────────────────────────────
if (cluster.isPrimary) {
    console.log('[V8-PRIMARY] Powder Galaxy Cluster initializing...');
    console.log(`[V8-PRIMARY] ${availableCPUs} CPU cores detected. Forging ${numCPUs} HTTP workers...`);

    // ── WS lives ONLY in primary — zero port conflict ──
    let wsInstance = null;
    startWebSocketServer()
        .then(wss => {
            wsInstance = wss;
            console.log('[V8-PRIMARY] WebSocket Server online (port 5556).');
        })
        .catch(err => {
            console.error('[V8-PRIMARY] WebSocket failed to start:', err.message);
        });

    // ── Fork one HTTP worker per CPU ──
    for (let i = 0; i < numCPUs; i++) cluster.fork();

    cluster.on('exit', (worker, code) => {
        console.error(`[V8-PRIMARY] Worker ${worker.process.pid} died (code ${code}). Respawning...`);
        cluster.fork();
    });

    // ── Relay WS broadcasts between workers ──
    cluster.on('message', (worker, message) => {
        if (!message || message.type !== 'WS_BROADCAST') return;
        for (const id in cluster.workers) {
            const target = cluster.workers[id];
            if (!target || Number(id) === worker.id) continue;
            target.send({ type: 'WS_CLUSTER_BROADCAST', payload: message.payload });
        }
    });

    const shutdownCluster = () => {
        console.log('\n[V8-PRIMARY] Shutting down cluster...');
        if (wsInstance) {
            wsInstance.clients?.forEach(c => c.terminate());
            wsInstance.close();
        }
        for (const id in cluster.workers) cluster.workers[id].process.kill('SIGTERM');
        console.log('[V8-PRIMARY] Cluster suspended. Bye.');
        process.exit(0);
    };
    process.on('SIGTERM', shutdownCluster);
    process.on('SIGINT',  shutdownCluster);

// ─── WORKER PROCESS (HTTP only) ───────────────────────────────────────────────
} else {
    console.log(`[V8-WORKER-${process.pid}] Booting HTTP instance...`);

    let apiInstance = null;

    async function bootstrap() {
        try {
            apiInstance = await startApiServer();
            console.log(`[V8-WORKER-${process.pid}] HTTP API online.`);
        } catch (error) {
            console.error(`[V8-WORKER-${process.pid}] HTTP boot failure:`, error.message);
            process.exit(1);
        }
    }

    const shutdownWorker = async (code = 0) => {
        console.log(`[V8-WORKER-${process.pid}] Shutting down...`);
        if (apiInstance?.close) {
            await new Promise(resolve => apiInstance.close(() => resolve()));
            console.log(`- HTTP drained on worker ${process.pid}`);
        }
        process.exit(code);
    };

    process.on('uncaughtException',   err    => { console.error(`[V8-WORKER-${process.pid}] Uncaught:`, err);    shutdownWorker(1); });
    process.on('unhandledRejection',  reason => { console.error(`[V8-WORKER-${process.pid}] Rejection:`, reason); shutdownWorker(1); });
    process.on('SIGTERM', () => shutdownWorker(0));

    bootstrap();
}
