/**
 * FrameScheduler.js — OMEGA V-FINAL
 *
 * Enforces the canonical engine update pipeline in strict order:
 *
 *   input → interaction → navigation → simulation → physics
 *   → streaming → render → ui → window → network
 *
 * Systems registered to unknown phases are auto-assigned to 'simulation'.
 */
export class FrameScheduler {

    // Canonical execution order. Order here IS law.
    static PHASE_ORDER = [
        'input',           // InputStateSystem — drain deltas first
        'interaction',     // Raycasting, hover detection
        'navigation',      // Camera FSM, orbit tracking
        'pre-simulation',  // Pre-physics prep (universe streamer)
        'simulation',      // ECS, galaxy generation
        'physics',         // Orbital mechanics, gravity
        'streaming',       // LOD, sector loading
        'render',          // Hand system, WebGL draw prep
        'post-navigation', // HUD telemetry, debug panel, LULU
        'ui',              // DOM UI systems
        'window',          // Window manager
        'network',         // WebSocket, remote players
        'ai',              // Drone systems, intelligence
        'post-render',     // Post-process passes
    ];

    constructor() {
        this.buckets = new Map();
        for (const phase of FrameScheduler.PHASE_ORDER) {
            this.buckets.set(phase, []);
        }
    }

    /**
     * Register a system into a named phase bucket.
     * @param {Object} system   — must expose update(delta)
     * @param {string} phase    — must match one of PHASE_ORDER
     */
    register(system, phase) {
        const p = phase?.toLowerCase() ?? 'simulation';
        if (!this.buckets.has(p)) {
            console.warn(`[FrameScheduler] Unknown phase "${phase}" — rerouting to "simulation".`);
            this.buckets.get('simulation').push(system);
        } else {
            this.buckets.get(p).push(system);
        }
        console.log(`[FrameScheduler] ✔ ${system.constructor?.name ?? 'anonymous'} → ${p}`);
    }

    /**
     * Main loop tick — executes every phase bucket in order.
     * @param {number} delta  — seconds since last frame
     */
    update(delta) {
        for (const phase of FrameScheduler.PHASE_ORDER) {
            const systems = this.buckets.get(phase);
            if (!systems) continue;
            for (const sys of systems) {
                try {
                    if (typeof sys.update === 'function') {
                        sys.update(delta);
                    }
                } catch (err) {
                    console.error(`[FrameScheduler] ❌ Error in phase "${phase}" (${sys.constructor?.name}):`, err);
                }
            }
        }
    }
}

// ── Protocolo Anti-Zombi (HMR Vite) ──────────────────────────────────────────
// Modificar el FrameScheduler en caliente desincronizaría el orden de fases
// del motor. Se exige full-page reload para garantizar el bucle determinista.
if (import.meta.hot) {
    import.meta.hot.decline();
}

