// InputConstants.js — legacy compatibility layer derived from ControlsManifest.
// New systems should read ControlsManifest directly.

import { getControlById } from './ControlsManifest.js';

const collectBindingKeys = (controlId, predicate = () => true) => {
    const control = getControlById(controlId);
    if (!control?.bindings?.length) {
        return Object.freeze([]);
    }

    const keys = new Set();
    for (const binding of control.bindings) {
        if (!predicate(binding)) continue;
        for (const key of binding.keys) {
            keys.add(key);
        }
    }
    return Object.freeze([...keys]);
};

export const INPUT_CONSTANTS = Object.freeze({
    BINDINGS: Object.freeze({
        // Locomotion / navigation
        MOVE_FORWARD: collectBindingKeys('FLIGHT_THRUST', (binding) => (binding.value ?? 0) > 0),
        MOVE_BACK:    collectBindingKeys('FLIGHT_THRUST', (binding) => (binding.value ?? 0) < 0),
        MOVE_LEFT:    collectBindingKeys('FLIGHT_STRAFE', (binding) => (binding.value ?? 0) < 0),
        MOVE_RIGHT:   collectBindingKeys('FLIGHT_STRAFE', (binding) => (binding.value ?? 0) > 0),
        ASCEND:       collectBindingKeys('FLIGHT_ELEVATION_DRONE', (binding) => (binding.value ?? 0) > 0),
        DESCEND:      collectBindingKeys('FLIGHT_ELEVATION_DRONE', (binding) => (binding.value ?? 0) < 0),
        BOOST:        collectBindingKeys('FLIGHT_BOOST'),

        // Ship / camera
        ROLL_LEFT:  collectBindingKeys('COCKPIT_ROLL', (binding) => (binding.value ?? 0) < 0),
        ROLL_RIGHT: collectBindingKeys('COCKPIT_ROLL', (binding) => (binding.value ?? 0) > 0),

        // Interactions
        PRIMARY_ACTION:   collectBindingKeys('SELECT_MASS'),
        SECONDARY_ACTION: Object.freeze(['Mouse1', ...collectBindingKeys('DESELECT_MASS')]),
        ALT_ACTION:       Object.freeze(['KeyF']),
        INTERACT:         Object.freeze(['KeyF', 'Enter']),

        // UI / system
        SYS_MENU:    collectBindingKeys('SYSTEM_PAUSE'),
        TOGGLE_HUD:  collectBindingKeys('HUD_TOGGLE'),
        TOGGLE_LULU: collectBindingKeys('LULU_COMM'),
        TOGGLE_MAP:  collectBindingKeys('MAP_CONTEXT'),
        PAUSE:       collectBindingKeys('SYSTEM_PAUSE'),
        SCREENSHOT:  collectBindingKeys('DEBUG_SCREENSHOT'),
    }),

    THRESHOLDS: Object.freeze({
        HOLD_MS:          420,
        DOUBLE_TAP_MS:    280,
        SCROLL_DEADZONE:  1,
    }),

    POINTER_LOCK: Object.freeze({
        ENABLED: true,
        EXIT_WITH_CTRL: false,
    }),
});

export const MOUSE_BUTTONS = Object.freeze({
    LEFT: 'Mouse0',
    MIDDLE: 'Mouse1',
    RIGHT: 'Mouse2',
});
