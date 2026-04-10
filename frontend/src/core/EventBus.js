/**
 * EventBus.js
 * OMEGA V28 Master Edition — Core Foundation
 */
const SILENT_EXACT_EVENTS = new Set([
    'input:move',
    'frame:begin',
    'frame:end',
    'frame:start',
    'INPUT_POINTER_MOVE',
    'INTERACTION:HOVER_UPDATE',
    'network:remote_transform',
    'network:socket:message',
    'PG:NAV:ORIGIN_SHIFT',
    'PG:OS:SET_ACTIVE_PAYLOAD',
    'PG:OS:ACTIVE_PAYLOAD_CHANGED',
    'PG:OS:TOGGLE_PAYLOAD_LOCK',
    'PG:OS:PAYLOAD_LOCK_CHANGED',
    'PG:INPUT:CONTEXT_CHANGED',
    'PG:INPUT:GESTURE_DOWN',
    'PG:INPUT:GESTURE_UP',
    'PG:INPUT:GESTURE_TAP',
    'PG:INPUT:GESTURE_DOUBLE_TAP',
    'PG:INPUT:GESTURE_LONG_PRESS',
    'PG:INPUT:GESTURE_DRAG_START',
    'PG:INPUT:GESTURE_DRAG_MOVE',
    'PG:INPUT:GESTURE_DRAG_END',
    'PG:INPUT:GESTURE_SCALAR',
    'PG:INPUT:IMMERSIVE_ALIGN_BOW_START',
    'PG:INPUT:IMMERSIVE_ALIGN_BOW_END',
    'PG:INPUT:TACTICAL_LEFT_CLICK',
    'PG:INPUT:TACTICAL_RIGHT_CLICK',
    'PG:INPUT:TACTICAL_DRAG_START',
    'PG:INPUT:TACTICAL_DRAGGING',
    'PG:INPUT:TACTICAL_DRAG_END',
    'PG:NAV:ENGAGE_AUTO_BRAKE',
    'PG:NAV:DISENGAGE_AUTO_BRAKE',
    'PG:OS:TACTICAL_READOUT_REQUESTED',
    'PG:OS:CLEAR_TACTICAL_READOUT',
    'PG:OS:OPEN_CONTEXT_MENU',
    'PG:OS:CLOSE_CONTEXT_MENU',
    'PG:OS:TACTICAL_SCAN_REQUESTED',
    'PG:NAV:WARP_SPOOLING',
    'PG:NAV:WARP_TRANSIT',
    'PG:NAV:WARP_DROPOUT',
    'PG:UI:PRINT_LULU',
]);

const SILENT_EVENT_PREFIXES = [
    'network:telemetry:',
];

export class EventBus {
    constructor() {
        if (typeof window !== 'undefined' && window.__OMEGA_EVENTS__) {
            return window.__OMEGA_EVENTS__;
        }
        
        this.listeners = {};
        
        if (typeof window !== 'undefined') {
            window.__OMEGA_EVENTS__ = this;
        }
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Subscribe to an event once — auto-unsubscribes after first fire
     */
    once(event, callback) {
        const wrapper = (payload) => {
            callback(payload);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Backward-compatible alias used by legacy systems.
     */
    removeListener(event, callback) {
        this.off(event, callback);
    }

    /**
     * Dispatch an event to all subscribers
     */
    emit(event, payload) {
        if (!this.listeners[event]) return;
        const shouldLog = this._shouldLogEvent(event);

        if (!shouldLog) {
            this.listeners[event].forEach(cb => {
                try {
                    cb(payload);
                } catch (err) {
                    console.error(`[EventBus Error] in handler for "${event}":`, err);
                }
            });
            return;
        }

        console.log(`[EventBus] ${event}`, payload || '');

        this.listeners[event].forEach(cb => {
            try {
                cb(payload);
            } catch (err) {
                console.error(`[EventBus Error] in handler for "${event}":`, err);
            }
        });
    }

    /**
     * Clear all listeners (useful for kernel resets)
     */
    clear() {
        this.listeners = {};
    }

    _shouldLogEvent(event) {
        if (SILENT_EXACT_EVENTS.has(event)) {
            return false;
        }

        for (let i = 0; i < SILENT_EVENT_PREFIXES.length; i++) {
            if (event.startsWith(SILENT_EVENT_PREFIXES[i])) {
                return false;
            }
        }

        return true;
    }
}

const events = new EventBus();
export default events;
export { events }; 
