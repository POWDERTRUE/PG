import { Registry } from '../core/ServiceRegistry.js';

/**
 * @file TravelStateMachine.js
 * @description State Machine for engine-wide navigation modes.
 */

export class TravelStateMachine {
    /** @enum {string} */
    static STATES = {
        DOCKED: 'docked',           // Attached to a station or planet
        FLIGHT: 'flight',           // Normal 6DOF Newtonian flight
        WARP: 'warp',               // High-speed interplanetary travel
        HYPERJUMP: 'hyperjump',     // Instantaneous interstellar transition
        LANDING: 'landing'          // Automated docking/landing sequence
    };

    constructor(services) {
        this.services = services;
        this.events = Registry.get('events');
        this._state = TravelStateMachine.STATES.DOCKED;
        this._transitions = new Map();
        
        this._initTransitions();
    }

    _initTransitions() {
        // Define valid state transitions
        this._addTransition(TravelStateMachine.STATES.DOCKED, TravelStateMachine.STATES.FLIGHT);
        this._addTransition(TravelStateMachine.STATES.FLIGHT, TravelStateMachine.STATES.DOCKED);
        this._addTransition(TravelStateMachine.STATES.FLIGHT, TravelStateMachine.STATES.WARP);
        this._addTransition(TravelStateMachine.STATES.WARP,   TravelStateMachine.STATES.FLIGHT);
        this._addTransition(TravelStateMachine.STATES.FLIGHT, TravelStateMachine.STATES.HYPERJUMP);
        this._addTransition(TravelStateMachine.STATES.HYPERJUMP, TravelStateMachine.STATES.FLIGHT);
        this._addTransition(TravelStateMachine.STATES.FLIGHT, TravelStateMachine.STATES.LANDING);
        this._addTransition(TravelStateMachine.STATES.LANDING, TravelStateMachine.STATES.DOCKED);
    }

    _addTransition(from, to) {
        if (!this._transitions.has(from)) this._transitions.set(from, new Set());
        this._transitions.get(from).add(to);
    }

    /** @returns {string} */
    get state() { return this._state; }

    /**
     * Attempts to transition to a new state.
     * @param {string} newState 
     * @param {any} params 
     */
    transitionTo(newState, params = {}) {
        if (this._state === newState) return true;

        const possible = this._transitions.get(this._state);
        if (!possible || !possible.has(newState)) {
            console.error(`[TravelSM] Invalid transition: ${this._state} -> ${newState}`);
            return false;
        }

        const oldState = this._state;

        // --- HOOKS: Emit exit and enter events for system decoupling ---
        this.events.emit('nav:exit_state', { state: oldState });

        this._state = newState;

        console.log(`%c[TravelSM] STATE CHANGE: ${oldState.toUpperCase()} -> ${newState.toUpperCase()}`, 'color: #00aaff; font-weight: bold;');
        
        this.events.emit('nav:enter_state', {
            state: newState,
            oldState,
            params
        });

        return true;
    }

    is(state) {
        return this._state === state;
    }
}

