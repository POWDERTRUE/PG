/**
 * BootGraphDebugger.js — OMEGA V-FINAL
 *
 * Improvements over V28:
 *  1. Supports both init() AND initialize() on system instances.
 *  2. Per-phase gate: phases execute in strict priority order (CORE → SCENE → ... → NETWORK).
 *  3. resolveBootSequence() is idempotent — calling it multiple times only boots NEW systems.
 *  4. Circular dependency check uses a local `visiting` set per-call, not a global one.
 *  5. Missing dependency references are silently skipped (optional deps) with a warning.
 */
export class BootGraphDebugger {

    // Canonical phase execution order — systems in earlier phases must be fully online
    // before any system in a later phase can begin initializing.
    static PHASE_ORDER = [
        'CORE', 'SCENE', 'SPATIAL', 'PHYSICS', 'SIMULATION',
        'INPUT', 'INTERACTION', 'NAVIGATION', 'STREAMING', 'RENDER',
        'UNIVERSE', 'AI', 'UI', 'WINDOW', 'NETWORK'
    ];

    constructor({ debug = true } = {}) {
        this.systems   = new Map();  // name → descriptor
        this.bootOrder = [];
        this.resolved  = new Set();  // persists across calls — tracks fully booted systems
        this.debug     = debug;
    }

    /**
     * Register a system with its deps and phase.
     * Safe to call multiple times — duplicate registration emits a warning, not an error.
     */
    register(name, instance, dependencies = [], phase = 'SIMULATION') {
        if (this.systems.has(name)) {
            console.warn(`[BootGraph] ⚠ ${name} already registered — ignoring duplicate.`);
            return;
        }
        this.systems.set(name, { name, instance, dependencies, phase, booted: false });
    }

    /**
     * Resolves and boots all NEW (not yet booted) systems in phase + dependency order.
     * Idempotent: safe to call multiple times as the Kernel registers more systems.
     */
    async resolveBootSequence() {
        if (this.debug) {
            console.groupCollapsed('🚀 [OMEGA ENGINE] Boot Sequence');
        }

        // Build phase-bucketed work lists, only for unresolved systems
        const byPhase = new Map();
        for (const phase of BootGraphDebugger.PHASE_ORDER) {
            byPhase.set(phase, []);
        }
        // Catch-all for any custom phase not in the ordered list
        const unknownPhase = '__UNKNOWN__';
        byPhase.set(unknownPhase, []);

        for (const [name, sys] of this.systems) {
            if (this.resolved.has(name)) continue; // already booted in a previous call
            const bucket = byPhase.has(sys.phase) ? sys.phase : unknownPhase;
            byPhase.get(bucket).push(name);
        }

        // Boot phase by phase — within each phase, resolve dependency order
        for (const phase of [...BootGraphDebugger.PHASE_ORDER, unknownPhase]) {
            const names = byPhase.get(phase);
            if (!names || names.length === 0) continue;

            for (const name of names) {
                await this._bootSystem(name, new Set());
            }
        }

        if (this.debug) {
            console.groupEnd();
            console.info(
                `%c[BootGraph] ✅ ${this.resolved.size} systems online`,
                'color:#00ffaa;font-weight:bold'
            );
        }

        return this.bootOrder;
    }

    /**
     * Recursively boots a system after ensuring all its dependencies are ready.
     * @param {string} name
     * @param {Set} visiting — per-call set for circular dependency detection
     */
    async _bootSystem(name, visiting) {
        if (this.resolved.has(name)) return; // already up

        if (visiting.has(name)) {
            throw new Error(`[BootGraph] 🔴 CIRCULAR DEPENDENCY at: ${name}`);
        }

        const sys = this.systems.get(name);
        if (!sys) {
            // Dependency declared but not yet registered — warn and continue
            console.warn(`[BootGraph] ⚠ Dependency "${name}" not registered yet — skipping.`);
            return;
        }

        visiting.add(name);

        // Ensure all declared deps are booted first (recursive)
        for (const dep of sys.dependencies) {
            await this._bootSystem(dep, visiting);
        }

        // Initialize the system — support both API conventions
        const start = performance.now();
        try {
            if (typeof sys.instance.init === 'function') {
                await sys.instance.init();
            } else if (typeof sys.instance.initialize === 'function') {
                await sys.instance.initialize();
            }
            // Systems with neither are pure data holders — still mark as booted
        } catch (err) {
            console.error(`[BootGraph] ❌ Failed initializing [${name}]`, err);
            throw err;
        }

        const elapsed = (performance.now() - start).toFixed(2);
        sys.booted = true;
        this.resolved.add(name);
        visiting.delete(name); // allow other paths through this node
        this.bootOrder.push({ name, phase: sys.phase, time: elapsed });

        if (this.debug) {
            console.log(
                `%c✔ ${sys.phase} %c| ${name} %c(${elapsed}ms)`,
                'color:#ffaa00;font-weight:bold',
                'color:#00ffcc',
                'color:#555'
            );
        }
    }

    getBootOrder() { return this.bootOrder; }

    getGraph() {
        const graph = [];
        for (const [name, sys] of this.systems) {
            graph.push({ name, dependencies: sys.dependencies, phase: sys.phase, booted: sys.booted });
        }
        return graph;
    }
}
