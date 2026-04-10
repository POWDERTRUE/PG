/**
 * FrameScheduler.js — V31
 *
 * Deterministic 12-phase frame executor for the OMEGA engine.
 *
 * Phase execution order (strict — do NOT reorder without updating ENGINE_MAP.md):
 *
 *   input           → raw device state read
 *   physics         → celestial / rigid body integration
 *   pre-simulation  → pre-tick hooks (streaming prefetch, etc.)
 *   simulation      → galaxy, orbital mechanics, ECS systems
 *   navigation      → camera FSM, flight states
 *   post-navigation → camera stabilization, cameraRig sync
 *   interaction     → raycast, selection, hand tracking
 *   network         → WebSocket bridge, remote player sync
 *   streaming       → sector loading / unloading
 *   workspace       → window physics, spatial anchors
 *   render          → instanced mesh, post-process
 *   ui              → HUD, LULU panels, kernel bar
 *
 * V31 fixes:
 *   • Added 'network' and 'workspace' phases (were auto-appended OUT OF ORDER)
 *   • register() guards against duplicate system registration (silent bug)
 *   • getStats() for EngineDebugPanel live display
 */
export class FrameScheduler {
    constructor() {
        // STRICT ORDER — edit with care, document in ENGINE_MAP.md
        this.phaseOrder = [
            'input',
            'physics',
            'pre-simulation',
            'simulation',
            'navigation',
            'post-navigation',
            'interaction',
            'network',       // V31: was auto-appended to end (wrong order)
            'streaming',
            'workspace',     // V31: was auto-appended to end (wrong order)
            'render',
            'ui',
        ];

        this.phases = {};
        for (const phase of this.phaseOrder) {
            this.phases[phase] = [];
        }

        this.maxDelta = 0.1;

        // Stats for EngineDebugPanel
        this._frameCount  = 0;
        this._lastMs      = 0;
    }

    /**
     * Register a system into a phase.
     * Warns if the phase is unknown (should never happen with V31 phaseOrder).
     * Guards against duplicate registrations.
     * @param {object} system   — must have update(delta) method
     * @param {string} [phase]
     */
    register(system, phase = 'simulation') {
        if (!this.phases[phase]) {
            // Unknown phase: still register but warn once and keep ordering stable
            console.warn(`[FrameScheduler] Unknown phase "${phase}" — adding at end. Update phaseOrder.`);
            this.phaseOrder.push(phase);
            this.phases[phase] = [];
        }

        // Guard against accidental double-registration
        if (this.phases[phase].includes(system)) {
            if (typeof system.constructor?.name !== 'undefined') {
                console.warn(`[FrameScheduler] Duplicate registration: ${system.constructor.name} in "${phase}"`);
            }
            return;
        }

        this.phases[phase].push(system);
    }

    /**
     * Execute all phases in order.
     * @param {number} delta — seconds, capped at maxDelta
     */
    update(delta) {
        const t0 = performance.now();
        delta = Math.min(delta, this.maxDelta);

        for (const phase of this.phaseOrder) {
            const list = this.phases[phase];
            if (!list) continue;
            for (let i = 0; i < list.length; i++) {
                const system = list[i];
                if (system && typeof system.update === 'function') {
                    system.update(delta);
                }
            }
        }

        this._lastMs = performance.now() - t0;
        this._frameCount++;
    }

    /**
     * Returns a snapshot for the EngineDebugPanel.
     * @returns {{ frameCount: number, lastMs: number, systemCount: number, phases: Object }}
     */
    getStats() {
        const phases = {};
        let systemCount = 0;
        for (const phase of this.phaseOrder) {
            const n = this.phases[phase]?.length ?? 0;
            if (n > 0) phases[phase] = n;
            systemCount += n;
        }
        return {
            frameCount:  this._frameCount,
            lastMs:      this._lastMs.toFixed(2),
            systemCount,
            phases,
        };
    }
}

