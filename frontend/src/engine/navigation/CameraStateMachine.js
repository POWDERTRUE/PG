/**
 * CameraStateMachine.js — OMEGA V-FINAL
 *
 * Strict FSM for all camera modes. Four canonical states:
 *
 *   FREE_FLIGHT  — WASD + mouse-look, physics-based velocity
 *   ORBIT        — Orbit around a point/object with scroll zoom
 *   FOCUS        — Zoom-in tight on a target, then orbit or warp
 *   WARP         — GSAP cinematic travel between two positions
 *
 * ─── Transition contract ────────────────────────────────────────────────────
 *
 *   fsm.to(STATE_ID, data?)     → primary API — validates transition, saves history
 *   fsm.back()                  → ESC handler, pops history stack
 *   fsm.update(delta)           → called by FrameScheduler (phase: navigation)
 *
 * ─── State contract ─────────────────────────────────────────────────────────
 *
 *   State instances MUST implement:
 *     enter(data)     — activate state with transition data
 *     exit()          — clean up
 *     update(delta)   — called every navigation-phase tick
 *
 *   State instances SHOULD implement:
 *     getSnapshot()   — returns serializable state for history stack
 */

export const CAMERA_STATE = Object.freeze({
    FREE_FLIGHT      : 'FREE_FLIGHT',
    ORBIT            : 'ORBIT',
    FOCUS            : 'FOCUS',
    WARP             : 'WARP',
    ORBITAL_DESCENT  : 'ORBITAL_DESCENT',
    COCKPIT          : 'COCKPIT',
});

// Valid transitions: which states can flow to which
const VALID_TRANSITIONS = {
    FREE_FLIGHT     : ['ORBIT', 'FOCUS', 'WARP', 'COCKPIT'],
    ORBIT           : ['FREE_FLIGHT', 'FOCUS', 'WARP'],
    FOCUS           : ['FREE_FLIGHT', 'ORBIT', 'WARP', 'ORBITAL_DESCENT'],
    WARP            : ['FREE_FLIGHT', 'ORBIT', 'FOCUS', 'ORBITAL_DESCENT'],
    ORBITAL_DESCENT : ['FREE_FLIGHT', 'FOCUS', 'COCKPIT'],
    COCKPIT         : ['FREE_FLIGHT'],
};

export class CameraStateMachine {
    constructor(nav) {
        this.nav            = nav;
        this.states         = new Map();
        this.currentId      = null;
        this.currentState   = null;
        this.history        = [];   // stack of { id, snapshot }

        this._onKeyDown = null;
    }

    // ── Registration ─────────────────────────────────────────────────────────

    registerState(id, instance) {
        instance.fsm = this;
        instance.nav = this.nav;
        this.states.set(id, instance);
        return this;
    }

    // ── Primary transition API ────────────────────────────────────────────────

    /**
     * Transition to a new state.
     * @param {string}  id          — one of CAMERA_STATE values
     * @param {Object}  data        — optional payload passed to enter()
     * @param {boolean} skipHistory — don't push current state to history
     */
    to(id, data = {}, skipHistory = false) {
        // Silent no-op for same-state — only re-enter if explicitly forced
        if (this.currentId === id && !data.force) return;

        // Validate transition
        const allowed = VALID_TRANSITIONS[this.currentId];
        if (allowed && !allowed.includes(id)) {
            console.warn(
                `[CameraFSM] ⚠ Blocked invalid transition: ${this.currentId} → ${id}`
            );
        }

        // Exit current state
        if (this.currentState) {
            if (!skipHistory && this.currentId !== CAMERA_STATE.WARP) {
                this.history.push({
                    id:       this.currentId,
                    snapshot: this.currentState.getSnapshot?.() ?? {},
                });
                if (this.history.length > 8) this.history.shift(); // cap stack
            }
            this.currentState.exit?.();
        }

        const next = this.states.get(id);
        console.log(
            `%c[CameraFSM] ${this.currentId ?? 'BOOT'} → ${id}`,
            'color:#ffaa00;font-weight:bold'
        );

        this.currentId    = id;
        this.nav.state    = id;   // ← exposes active state to UniverseNavigationSystem.update()
        this.currentState = next ?? null;

        if (!next) {
            console.error(`[CameraFSM] ❌ State not registered: "${id}"`);
            return;
        }

        next.enter(data);
    }

    /** Revert to the previous state (ESC). */
    back() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        this.to(prev.id, { ...prev.snapshot, force: true }, true);
        return true;
    }

    /** FrameScheduler tick — delegates to current state's update(). */
    update(delta) {
        this.currentState?.update(delta);
    }

    // ─── Legacy compat  ──────────────────────────────────────────────────────
    changeState(id, data, force) {
        if (force) data = { ...(data ?? {}), force: true };
        this.to(id, data ?? {});
    }
    get currentStateId() { return this.currentId; }
}
