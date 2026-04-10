export const InputPriorities = Object.freeze({
    FLIGHT: 10,
    TARGETING: 20,
    HUD: 30,
    DOCKING: 40,
    TERMINAL: 50,
    CINEMATIC: 100
});

/**
 * InputPriorityStack - OMEGA V-DIAMOND
 * Serves as a hierarchical state scheduler to handle multiple interaction
 * requests. Only the state with the highest priority is allowed to capture
 * input commands like PointerLock and Context Menus.
 */
export class InputPriorityStack {
    constructor() {
        this.stack = new Map();
        this.currentProvider = null;
        this.events = window.Registry?.get('events') || null;
    }

    pushState(providerId, priority, payload = {}) {
        this.stack.set(providerId, { priority, payload });
        this._reevaluate();
    }

    popState(providerId) {
        if (this.stack.has(providerId)) {
            this.stack.delete(providerId);
            this._reevaluate();
        }
    }

    getActiveState() {
        return this.currentProvider;
    }

    _reevaluate() {
        let highest = null;
        let pMax = -1;

        for (const [providerId, state] of this.stack.entries()) {
            if (state.priority > pMax) {
                pMax = state.priority;
                highest = { id: providerId, ...state };
            }
        }

        if (highest?.id !== this.currentProvider?.id) {
            const prev = this.currentProvider;
            this.currentProvider = highest;
            this.events?.emit('INPUT_PRIORITY_CHANGED', {
                previous: prev,
                current: this.currentProvider
            });
        }
    }
}
