/**
 * DockingModeController
 * ─────────────────────────────────────────────────────────────────────────────
 * Orbital proximity docking interaction controller.
 * Manages the APPROACH → ALIGNMENT → LOCK → DOCKED FSM under InputPriorityStack
 * scheduler authority.
 *
 * Design contract:
 *   - Does NOT contain physics logic. Delegates everything to NavigationSystem.
 *   - Does NOT touch PointerLock. Managed by InputStateSystem (kernel authority).
 *   - Does NOT replace UniverseNavigationSystem. Injects constraint overlay only.
 *   - All state transitions are event-driven via runtimeSignals (EventBus).
 *   - Zero heap allocation per frame (pre-allocated _relState scratch object).
 *
 * Lifecycle:
 *   new DockingModeController({ kernel, inputPriorityStack, navigationSystem,
 *                                targetTrackingSystem })
 *   controller.update(dt)   ← called from kernel loop every frame
 *
 * Scheduler integration:
 *   stack.push("DOCKING")   ← enterDocking()
 *   stack.pop()             ← exitDocking() / abort()
 *
 * EventBus inbound:
 *   PG:DOCKING:INITIATE  { target: Object3D }
 *   PG:DOCKING:ABORT
 *
 * EventBus outbound:
 *   PG:DOCKING:APPROACH_READY
 *   PG:DOCKING:ALIGNMENT_LOCK
 *   PG:DOCKING:CAPTURE
 *   PG:DOCKING:COMPLETE
 *   PG:DOCKING:ABORT
 *
 * CSS execution layer (body classes):
 *   pg-docking-mode        ← active for all docking states
 *   pg-docking-approach    ← APPROACH phase
 *   pg-docking-alignment   ← ALIGNMENT phase
 *   pg-docking-lock        ← LOCK phase
 *   pg-docking-complete    ← DOCKED phase (brief)
 */

// ── FSM State IDs ─────────────────────────────────────────────────────────────
const DOCKING_STATE = Object.freeze({
    IDLE:      'IDLE',
    APPROACH:  'APPROACH',
    ALIGNMENT: 'ALIGNMENT',
    LOCK:      'LOCK',
    DOCKED:    'DOCKED',
    ABORT:     'ABORT',
});

// ── CSS class map ─────────────────────────────────────────────────────────────
const CSS_PHASE_CLASS = Object.freeze({
    [DOCKING_STATE.APPROACH]:  'pg-docking-approach',
    [DOCKING_STATE.ALIGNMENT]: 'pg-docking-alignment',
    [DOCKING_STATE.LOCK]:      'pg-docking-lock',
    [DOCKING_STATE.DOCKED]:    'pg-docking-complete',
});

// ── EventBus outbound map ─────────────────────────────────────────────────────
const FSM_EMISSION = Object.freeze({
    [DOCKING_STATE.APPROACH]:  'PG:DOCKING:APPROACH_READY',
    [DOCKING_STATE.ALIGNMENT]: 'PG:DOCKING:ALIGNMENT_LOCK',
    [DOCKING_STATE.LOCK]:      'PG:DOCKING:CAPTURE',
    [DOCKING_STATE.DOCKED]:    'PG:DOCKING:COMPLETE',
});

// ── Distance thresholds (metres) ──────────────────────────────────────────────
const ACTIVATION_DISTANCE        =  120;   // IDLE → APPROACH
const ALIGNMENT_DISTANCE         =   25;   // APPROACH → ALIGNMENT
const CAPTURE_DISTANCE           =    2;   // ALIGNMENT → LOCK

// ── Velocity thresholds (m/s) ─────────────────────────────────────────────────
const SAFETY_VELOCITY_THRESHOLD  =    3.0; // ANY → ABORT (hard kill-switch)

// ── Angular constraint (degrees) ─────────────────────────────────────────────
const MAX_ALIGNMENT_ANGLE_DEG    =    5;   // ALIGNMENT → LOCK gate
const MAX_LOCK_ANGLE_DEG         =    1;   // LOCK maintenance gate
const DEG_TO_RAD                 = Math.PI / 180;

const CONSTRAINT_TABLE = Object.freeze({
    [DOCKING_STATE.APPROACH]:  { maxLinearSpeed: 12,  maxAngularSpeed: 1.2,  lateralDamping: 0.35, forwardAssist: 0.15, autoAlign: false, captureRadius: Infinity, alignmentTolerance: Infinity },
    [DOCKING_STATE.ALIGNMENT]: { maxLinearSpeed: 4,   maxAngularSpeed: 0.45, lateralDamping: 0.65, forwardAssist: 0.25, autoAlign: true,  captureRadius: 25,       alignmentTolerance: 2.5 * DEG_TO_RAD },
    [DOCKING_STATE.LOCK]:      { maxLinearSpeed: 0.8, maxAngularSpeed: 0.08, lateralDamping: 0.92, forwardAssist: 0.6,  autoAlign: true,  captureRadius: 2,        alignmentTolerance: 1.0 * DEG_TO_RAD },
    [DOCKING_STATE.DOCKED]:    { maxLinearSpeed: 0,   maxAngularSpeed: 0,    lateralDamping: 1.0,  forwardAssist: 1.0,  autoAlign: true,  captureRadius: 0.1,      alignmentTolerance: 0.1 * DEG_TO_RAD },
});

// ── Scratch object — pre-allocated, zero GC per frame ────────────────────────
const _relState = {
    distance:         0,
    velocity:         0,
    angularErrorDeg:  0,
    captureConfirmed: false,
    targetPosition:   null,
    targetForward:    null,
};

// ─────────────────────────────────────────────────────────────────────────────

export class DockingModeController {

    /**
     * @param {Object}                     opts
     * @param {*}                          opts.kernel              UniverseKernel instance
     * @param {InputPriorityStack}         opts.inputPriorityStack
     * @param {UniverseNavigationSystem}   opts.navigationSystem
     * @param {TargetTrackingSystem}       opts.targetTrackingSystem
     */
    constructor({ kernel, inputPriorityStack, navigationSystem, targetTrackingSystem }) {
        this._stack      = inputPriorityStack;
        this._nav        = navigationSystem;
        this._tracker    = targetTrackingSystem;
        this._signals    = kernel?.runtimeSignals ?? null;

        this._state        = DOCKING_STATE.IDLE;
        this._activeTarget = null;   // Object3D — set on INITIATE
        this._currentConstraints = null; // Interpolated policy surface
        this._removers     = [];     // EventBus unsubscribe handles

        this._registerListeners();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    _registerListeners() {
        if (!this._signals) return;

        this._removers.push(
            this._signals.on('PG:DOCKING:INITIATE', ({ target } = {}) => {
                this._activeTarget = target ?? null;
                this.enterDocking();
            })
        );

        this._removers.push(
            this._signals.on('PG:DOCKING:ABORT', () => this.abort())
        );
    }

    destroy() {
        this._removers.forEach(r => r?.());
        this._removers.length = 0;
        this.clearDocking();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Called externally (or via event) to begin a docking sequence. */
    enterDocking() {
        if (this._state !== DOCKING_STATE.IDLE) return;
        if (this._stack.current() === 'DOCKING') return;

        this._stack.push('DOCKING');
        this._transition(DOCKING_STATE.APPROACH);
    }

    /** Hard abort — any state. Clears constraints and releases scheduler authority. */
    abort() {
        if (this._state === DOCKING_STATE.IDLE) return;

        this._nav?.clearDockingConstraints();
        this._stack.pop();
        this._setCSSPhase(null);
        document.body.classList.remove('pg-docking-mode');
        this._state        = DOCKING_STATE.IDLE;
        this._activeTarget = null;
        this._currentConstraints = null;

        // Re-emit so HUD / audio systems react cleanly.
        this._signals?.emit('PG:DOCKING:ABORT');
    }

    /** Per-frame tick — must be called from the kernel loop. */
    update(_dt) {
        if (
            this._state === DOCKING_STATE.IDLE   ||
            this._state === DOCKING_STATE.DOCKED  ||
            this._state === DOCKING_STATE.ABORT
        ) return;

        // Read relative state from tracker (zero-alloc via scratch)
        if (!this._readRelativeState()) {
            // Target lost — abort gracefully
            this.abort();
            return;
        }

        // ── Safety abort (hard kill-switch) ───────────────────────────────────
        if (_relState.velocity > SAFETY_VELOCITY_THRESHOLD) {
            this.abort();
            return;
        }

        // ── FSM advancement ───────────────────────────────────────────────────
        switch (this._state) {
        case DOCKING_STATE.APPROACH:
            if (_relState.distance < ALIGNMENT_DISTANCE) {
                this._transition(DOCKING_STATE.ALIGNMENT);
            }
            break;

        case DOCKING_STATE.ALIGNMENT:
            if (
                _relState.distance        < CAPTURE_DISTANCE &&
                _relState.angularErrorDeg < MAX_ALIGNMENT_ANGLE_DEG
            ) {
                this._transition(DOCKING_STATE.LOCK);
            }
            break;

        case DOCKING_STATE.LOCK:
            if (_relState.captureConfirmed) {
                this._transition(DOCKING_STATE.DOCKED);
            }
            break;

        default:
            break;
        }

        // ── Smooth policy surface integration (Sim-class feel) ───────────────
        this._interpolateConstraints(_dt);
        // ── Push current constraints to NavigationSystem ────────────────
        this._applyConstraints();
    }

    // ── FSM internals ─────────────────────────────────────────────────────────

    _transition(next) {
        this._state = next;

        // Emit outbound signal
        const sig = FSM_EMISSION[next];
        if (sig) this._signals?.emit(sig);

        // Update CSS execution layer
        this._setCSSPhase(next);

        // If docked — clean exit
        if (next === DOCKING_STATE.DOCKED) {
            this._exitDocking();
        }
    }

    _exitDocking() {
        this._nav?.clearDockingConstraints();
        this._stack.pop();
        // Keep pg-docking-complete briefly; caller / HUD removes it on its own event.
        this._state        = DOCKING_STATE.IDLE;
        this._activeTarget = null;
        this._currentConstraints = null;
    }

    /** Convenience alias used internally when no abort needed. */
    clearDocking() {
        if (this._state !== DOCKING_STATE.IDLE) {
            this._nav?.clearDockingConstraints();
            this._stack.pop();
        }
        this._setCSSPhase(null);
        document.body.classList.remove('pg-docking-mode');
        this._state        = DOCKING_STATE.IDLE;
        this._activeTarget = null;
        this._currentConstraints = null;
    }

    // ── Constraint delegation ─────────────────────────────────────────────────

    _interpolateConstraints(dt) {
        const target = CONSTRAINT_TABLE[this._state];
        if (!target) return;

        if (!this._currentConstraints) {
            this._currentConstraints = { ...target };
            return;
        }

        // 3.0 gives a nice 200-400ms half-life transition feeling
        const blend = 1.0 - Math.exp(-3.0 * dt);

        this._currentConstraints.maxLinearSpeed += (target.maxLinearSpeed - this._currentConstraints.maxLinearSpeed) * blend;
        this._currentConstraints.maxAngularSpeed += (target.maxAngularSpeed - this._currentConstraints.maxAngularSpeed) * blend;
        this._currentConstraints.lateralDamping += (target.lateralDamping - this._currentConstraints.lateralDamping) * blend;
        this._currentConstraints.forwardAssist += (target.forwardAssist - this._currentConstraints.forwardAssist) * blend;

        // Snapping logical/threshold fields instantly
        this._currentConstraints.autoAlign = target.autoAlign;
        this._currentConstraints.captureRadius = target.captureRadius;
        this._currentConstraints.alignmentTolerance = target.alignmentTolerance;
    }

    _applyConstraints() {
        if (!this._currentConstraints || !this._nav) return;

        this._nav.setDockingConstraints({
            ...this._currentConstraints,
            targetPosition:     _relState.targetPosition,
            targetForward:      _relState.targetForward,
        });
    }

    // ── Relative state read (zero-alloc) ──────────────────────────────────────

    /**
     * Reads relative position/velocity/alignment from TargetTrackingSystem
     * into the pre-allocated _relState scratch object.
     * Returns false if target data is unavailable.
     */
    _readRelativeState() {
        if (!this._tracker || !this._activeTarget) return false;

        // Ask tracker for current data on the active target
        const rel = this._tracker.getRelativeState?.(this._activeTarget);
        if (!rel) return false;

        _relState.distance         = rel.distance         ?? Infinity;
        _relState.velocity         = rel.relativeVelocity ?? 0;
        _relState.captureConfirmed = rel.captureConfirmed ?? false;
        _relState.targetPosition   = rel.position         ?? null;
        _relState.targetForward    = rel.forward          ?? null;

        // Angular error: dot product between player forward and docking port forward
        if (rel.forward && rel.playerForward) {
            const dot      = rel.playerForward.dot(rel.forward);
            const clamped  = Math.min(1.0, Math.max(-1.0, dot));
            _relState.angularErrorDeg = Math.acos(clamped) / DEG_TO_RAD;
        } else {
            _relState.angularErrorDeg = 0;
        }

        return true;
    }

    // ── CSS execution layer ───────────────────────────────────────────────────

    /**
     * Mutates body classes to reflect current docking phase.
     * Logic authority stays in JS; visual execution delegates to CSS.
     * @param {string|null} phase  DOCKING_STATE key or null to clear all
     */
    _setCSSPhase(phase) {
        const body = document.body;
        // Remove all phase classes
        Object.values(CSS_PHASE_CLASS).forEach(cls => body.classList.remove(cls));

        if (phase === null) return;

        body.classList.add('pg-docking-mode');
        const cls = CSS_PHASE_CLASS[phase];
        if (cls) body.classList.add(cls);
    }

    // ── Diagnostic ───────────────────────────────────────────────────────────

    getState() {
        return this._state;
    }

    isActive() {
        return this._state !== DOCKING_STATE.IDLE;
    }
}

export { DOCKING_STATE, CONSTRAINT_TABLE };
