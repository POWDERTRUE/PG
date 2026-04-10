import { events } from './EventBus.js';

/**
 * ReactiveUniverseStateGraph.js
 * V10 Global Reactive Store
 * Tracks the "Ground Truth" of all spatial entities.
 */
export class ReactiveUniverseStateGraph {
    constructor() {
        this.state = {
            entities: new Map(),
            windows: new Map(),
            session: {
                focusedId: null,
                activeGalaxy: 'Centennial',
                isGodView: true
            }
        };
        
        this.listeners = new Set();
    }

    /**
     * Update an entity state fragment
     */
    updateEntity(id, fragment) {
        const current = this.state.entities.get(id) || {};
        const next = { ...current, ...fragment, lastUpdate: Date.now() };
        this.state.entities.set(id, next);
        this.notify();
    }

    updateWindow(id, fragment) {
        const current = this.state.windows.get(id) || {};
        const next = { ...current, ...fragment, lastUpdate: Date.now() };
        this.state.windows.set(id, next);
        this.notify();
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify() {
        this.listeners.forEach(cb => cb(this.state));
        events.emit('state:updated', this.state);
    }

    getState() {
        return this.state;
    }
}

export const stateGraph = new ReactiveUniverseStateGraph();

