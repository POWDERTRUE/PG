import { events } from '../../core/EventBus.js';

export const ENGINE_STATES = {
    BOOT: 'BOOT',
    LOGIN: 'LOGIN',
    SYSTEM: 'SYSTEM',
    INTERACTION: 'INTERACTION'
};

export class UniverseStateManager {
    constructor() {
        this.currentState = ENGINE_STATES.BOOT;
    }

    /**
     * Transition to a new state
     * @param {string} newState - Target state from ENGINE_STATES
     * @param {any} data - Optional transition data
     */
    transitionTo(newState, data = {}) {
        if (!ENGINE_STATES[newState]) {
            console.error(`[StateManager] Invalid state: ${newState}`);
            return;
        }

        const oldState = this.currentState;
        this.currentState = newState;
        
        console.log(`[StateManager] Transition: ${oldState} -> ${newState}`);
        
        events.emit('state:changed', {
            oldState,
            newState,
            data
        });

        // Trigger specific state events
        events.emit(`state:${newState.toLowerCase()}`, data);
    }

    getState() {
        return this.currentState;
    }
}

export const stateManager = new UniverseStateManager();

