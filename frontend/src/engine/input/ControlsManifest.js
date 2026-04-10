export const CONTROL_CATEGORY = Object.freeze({
    SYSTEM: 'system',
    FLIGHT: 'flight',
    COCKPIT: 'cockpit',
    INTERACTION: 'interaction',
    DEBUG: 'debug',
});

export const CONTROL_MODE = Object.freeze({
    ANY: 'ANY',
    DEV_MODE: 'DEV_MODE',
    FREE_FLIGHT: 'FREE_FLIGHT',
    FOCUS: 'FOCUS',
    ORBIT: 'ORBIT',
    WARP: 'WARP',
    ORBITAL_DESCENT: 'ORBITAL_DESCENT',
    COCKPIT: 'COCKPIT',
    FIRST_PERSON_WALK: 'FIRST_PERSON_WALK',
});

export const CONTROL_CONTEXT = Object.freeze({
    ANY: 'ANY',
    NONE: 'NONE',
    WORLD_FOCUS: 'WORLD_FOCUS',
    MAP_MODE: 'MAP_MODE',
    HUD_MODE: 'HUD_MODE',
    UI_CURSOR: 'UI_CURSOR',
});

const freezeList = (value = []) => Object.freeze([...(value || [])]);

const defineBindings = (bindings = [], base = {}) => Object.freeze(
    bindings.map((binding = {}) => Object.freeze({
        ...binding,
        keys: freezeList(binding.keys),
        trigger: binding.trigger || 'hold',
        validModes: freezeList(binding.validModes ?? base.validModes ?? [CONTROL_MODE.ANY]),
        validContexts: freezeList(binding.validContexts ?? base.validContexts ?? [CONTROL_CONTEXT.ANY]),
    }))
);

const defineControl = (id, control = {}) => Object.freeze({
    id,
    category: control.category || CONTROL_CATEGORY.SYSTEM,
    label: control.label || id,
    keys: freezeList(control.keys),
    bindings: defineBindings(control.bindings, control),
    action: control.action || id,
    signal: control.signal || null,
    validModes: freezeList(control.validModes ?? [CONTROL_MODE.ANY]),
    validContexts: freezeList(control.validContexts ?? [CONTROL_CONTEXT.ANY]),
    description: control.description || '',
    source: Array.isArray(control.source) ? Object.freeze([...control.source]) : control.source,
    deprecatedAliases: freezeList(control.deprecatedAliases),
    requiresPointerLock: !!control.requiresPointerLock,
    requiresFocusTarget: !!control.requiresFocusTarget,
    requiresProximity: !!control.requiresProximity,
    holdMs: Number.isFinite(control.holdMs) ? control.holdMs : 0,
    devOnly: !!control.devOnly,
});

export const ControlsManifest = Object.freeze({
    SYSTEM_PAUSE: defineControl('SYSTEM_PAUSE', {
        category: CONTROL_CATEGORY.SYSTEM,
        label: 'Pausa tactica',
        keys: ['Esc'],
        bindings: [
            { keys: ['Escape'], trigger: 'keydown' },
        ],
        action: 'TOGGLE_OMEGA_VISTA',
        signal: 'PG:UI:REQUEST_GAME_MENU_TOGGLE',
        validModes: [CONTROL_MODE.ANY],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Abre o cierra la pausa tactica Omega Vista.',
        source: 'GameMenuSystem.js',
        deprecatedAliases: ['COCKPIT_EXIT'],
    }),
    HUD_TOGGLE: defineControl('HUD_TOGGLE', {
        category: CONTROL_CATEGORY.SYSTEM,
        label: 'Contexto operativo',
        keys: ['Tab'],
        bindings: [
            { keys: ['Tab'], trigger: 'keydown' },
        ],
        action: 'TOGGLE_OPERATIONAL_CONTEXT',
        signal: 'PG:INPUT:REQUEST_CONTEXT_TOGGLE',
        validModes: [
            CONTROL_MODE.FREE_FLIGHT,
            CONTROL_MODE.FOCUS,
            CONTROL_MODE.ORBIT,
            CONTROL_MODE.COCKPIT,
        ],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Alterna entre HELM y OPS, liberando el cursor y activando auto-freno.',
        source: 'InputStateSystem.js',
        deprecatedAliases: ['Ctrl'],
    }),
    LULU_COMM: defineControl('LULU_COMM', {
        category: CONTROL_CATEGORY.SYSTEM,
        label: 'Canal LULU',
        keys: ['1'],
        bindings: [
            { keys: ['Digit1'], trigger: 'keydown' },
            { keys: ['Numpad1'], trigger: 'keydown' },
        ],
        action: 'TOGGLE_LULU_CHAT',
        signal: 'PG:UI:REQUEST_LULU_TOGGLE',
        validModes: [CONTROL_MODE.ANY],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Abre o cierra el canal de comunicacion con LULU.',
        source: 'InputStateSystem.js',
    }),
    FLIGHT_YAW_PITCH: defineControl('FLIGHT_YAW_PITCH', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Rotacion de vuelo',
        keys: ['Mouse movement'],
        bindings: [
            {
                keys: ['MouseMovement'],
                trigger: 'pointermove',
                validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT],
            },
        ],
        action: 'ROTATE_CAMERA',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        requiresPointerLock: true,
        description: 'Rotacion 6DoF de la camara o de la nave.',
        source: ['FreeFlightState.js', 'CockpitState.js'],
    }),
    FLIGHT_THRUST: defineControl('FLIGHT_THRUST', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Empuje longitudinal',
        keys: ['W / S'],
        bindings: [
            { keys: ['KeyW'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['KeyS'], value: -1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['ArrowUp'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['ArrowDown'], value: -1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
        ],
        action: 'LONGITUDINAL_THRUST',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Avance y retroceso sobre el eje local Z.',
        source: ['FreeFlightState.js', 'CockpitState.js', 'FocusState.js'],
    }),
    FLIGHT_STRAFE: defineControl('FLIGHT_STRAFE', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Strafe lateral',
        keys: ['A / D'],
        bindings: [
            { keys: ['KeyD'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['KeyA'], value: -1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['ArrowRight'], value: 1, validModes: [CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
            { keys: ['ArrowLeft'], value: -1, validModes: [CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT] },
        ],
        action: 'LATERAL_STRAFE',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT, CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Desplazamiento lateral en el eje local X.',
        source: ['FreeFlightState.js', 'CockpitState.js', 'FocusState.js'],
    }),
    FLIGHT_ELEVATION_DRONE: defineControl('FLIGHT_ELEVATION_DRONE', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Elevacion dron',
        keys: ['Q / E'],
        bindings: [
            { keys: ['KeyQ'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
            { keys: ['KeyE'], value: -1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
        ],
        action: 'VERTICAL_ELEVATION',
        validModes: [CONTROL_MODE.FREE_FLIGHT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Ascenso y descenso vertical puro en vuelo libre.',
        source: 'FreeFlightState.js',
    }),
    FLIGHT_BOOST: defineControl('FLIGHT_BOOST', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Boost',
        keys: ['Shift'],
        bindings: [
            { keys: ['ShiftLeft'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT] },
            { keys: ['ShiftRight'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
        ],
        action: 'SPEED_BOOST',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Multiplicador de velocidad base de navegacion.',
        source: ['FreeFlightState.js', 'CockpitState.js'],
    }),
    FLIGHT_HYPERWARP: defineControl('FLIGHT_HYPERWARP', {
        category: CONTROL_CATEGORY.FLIGHT,
        label: 'Hiperwarp',
        keys: ['Shift + Alt'],
        bindings: [
            { keys: ['ShiftLeft', 'AltLeft'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
            { keys: ['ShiftLeft', 'AltRight'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
            { keys: ['ShiftRight', 'AltLeft'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
            { keys: ['ShiftRight', 'AltRight'], value: 1, validModes: [CONTROL_MODE.FREE_FLIGHT] },
        ],
        action: 'TRIGGER_HYPERWARP',
        validModes: [CONTROL_MODE.FREE_FLIGHT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Salto de velocidad extrema a traves de la galaxia.',
        source: 'FreeFlightState.js',
    }),
    COCKPIT_TOGGLE: defineControl('COCKPIT_TOGGLE', {
        category: CONTROL_CATEGORY.COCKPIT,
        label: 'Modo cockpit',
        keys: ['C'],
        bindings: [
            { keys: ['KeyC'], trigger: 'keydown' },
        ],
        action: 'TOGGLE_COCKPIT_MODE',
        signal: 'PG:NAV:REQUEST_COCKPIT_TOGGLE',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.COCKPIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Entra o sale del modo inmersivo de cabina.',
        source: 'CockpitState.js',
    }),
    COCKPIT_ROLL: defineControl('COCKPIT_ROLL', {
        category: CONTROL_CATEGORY.COCKPIT,
        label: 'Roll',
        keys: ['Q / E'],
        bindings: [
            { keys: ['KeyQ'], value: -1, validModes: [CONTROL_MODE.COCKPIT] },
            { keys: ['KeyE'], value: 1, validModes: [CONTROL_MODE.COCKPIT] },
        ],
        action: 'AIRCRAFT_ROLL',
        validModes: [CONTROL_MODE.COCKPIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Alabeo de la nave sobre su eje Z.',
        source: 'CockpitState.js',
    }),
    COCKPIT_ELEVATION: defineControl('COCKPIT_ELEVATION', {
        category: CONTROL_CATEGORY.COCKPIT,
        label: 'Altitud cockpit',
        keys: ['Space / ShiftRight'],
        bindings: [
            { keys: ['Space'], value: 1, validModes: [CONTROL_MODE.COCKPIT] },
            { keys: ['ShiftRight'], value: -1, validModes: [CONTROL_MODE.COCKPIT] },
        ],
        action: 'AIRCRAFT_ELEVATION',
        validModes: [CONTROL_MODE.COCKPIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Control de altitud tipo VTOL en cabina.',
        source: 'CockpitState.js',
    }),
    SELECT_MASS: defineControl('SELECT_MASS', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Fijar masa',
        keys: ['Right click (tap)'],
        bindings: [
            { keys: ['Mouse2'], trigger: 'pointerup', validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.FOCUS] },
        ],
        action: 'RAYCAST_SELECT',
        signal: 'PG:NAV:REQUEST_RAYCAST_SELECT',
        validModes: [CONTROL_MODE.FREE_FLIGHT, CONTROL_MODE.FOCUS],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Tap derecho sobre una masa para fijarla como objetivo espacial.',
        source: ['InputStateSystem.js', 'RaycastSelectionSystem.js'],
    }),
    DESELECT_MASS: defineControl('DESELECT_MASS', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Deseleccionar masa',
        keys: ['Right click (tap empty)'],
        bindings: [
            { keys: ['Mouse2'], trigger: 'pointerup', validModes: [CONTROL_MODE.ANY] },
        ],
        action: 'CLEAR_SELECTION',
        signal: 'PG:NAV:REQUEST_CLEAR_SELECTION',
        validModes: [CONTROL_MODE.ANY],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Tap derecho en vacio para limpiar la seleccion o el foco actual.',
        source: ['InputStateSystem.js', 'RaycastSelectionSystem.js'],
    }),
    PRECISION_TRAVEL: defineControl('PRECISION_TRAVEL', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Salto preciso',
        keys: ['Right click (hold)'],
        bindings: [
            { keys: ['Mouse2'], trigger: 'pointerup', validModes: [CONTROL_MODE.FREE_FLIGHT] },
        ],
        action: 'PRECISION_TRAVEL',
        signal: 'PG:NAV:REQUEST_PRECISION_TRAVEL',
        validModes: [CONTROL_MODE.FREE_FLIGHT],
        validContexts: [CONTROL_CONTEXT.ANY],
        holdMs: 220,
        description: 'Mantener click derecho, apuntar y soltar para viajar con precision al punto elegido.',
        source: ['InputStateSystem.js', 'UniverseNavigationSystem.js', 'WarpState.js'],
    }),
    MAP_CONTEXT: defineControl('MAP_CONTEXT', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Mapa contextual',
        keys: ['M'],
        bindings: [
            { keys: ['KeyM'], trigger: 'keydown' },
        ],
        action: 'TOGGLE_MAP_CONTEXT',
        signal: 'PG:NAV:REQUEST_MAP_CONTEXT_TOGGLE',
        validModes: [CONTROL_MODE.FOCUS],
        validContexts: [CONTROL_CONTEXT.WORLD_FOCUS, CONTROL_CONTEXT.MAP_MODE],
        requiresFocusTarget: true,
        description: 'Abre o cierra el mapa local del sistema o planeta enfocado.',
        source: 'UniverseNavigationSystem.js',
    }),
    ORBITAL_DESCENT: defineControl('ORBITAL_DESCENT', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Descenso orbital',
        keys: ['L'],
        bindings: [
            { keys: ['KeyL'], trigger: 'keydown' },
        ],
        action: 'TRIGGER_LANDING',
        signal: 'PG:NAV:REQUEST_ORBITAL_DESCENT',
        validModes: [CONTROL_MODE.FOCUS],
        validContexts: [CONTROL_CONTEXT.WORLD_FOCUS],
        requiresFocusTarget: true,
        requiresProximity: true,
        description: 'Inicia la cinematica de descenso dentro del umbral de proximidad.',
        source: 'LandingSystem.js',
    }),
    ORBIT_ZOOM: defineControl('ORBIT_ZOOM', {
        category: CONTROL_CATEGORY.INTERACTION,
        label: 'Zoom orbital',
        keys: ['Mouse wheel'],
        bindings: [
            { keys: ['MouseWheel'], trigger: 'wheel' },
        ],
        action: 'ADJUST_ORBIT_DISTANCE',
        validModes: [CONTROL_MODE.FOCUS, CONTROL_MODE.ORBIT],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Acerca o aleja la camara del objetivo orbitado.',
        source: 'FocusState.js',
    }),
    DEBUG_SCREENSHOT: defineControl('DEBUG_SCREENSHOT', {
        category: CONTROL_CATEGORY.DEBUG,
        label: 'Captura debug',
        keys: ['K'],
        bindings: [
            { keys: ['KeyK'], trigger: 'keydown', validModes: [CONTROL_MODE.DEV_MODE] },
        ],
        action: 'CAPTURE_RENDER',
        signal: 'PG:DEV:REQUEST_CAPTURE_RENDER',
        validModes: [CONTROL_MODE.DEV_MODE],
        validContexts: [CONTROL_CONTEXT.ANY],
        description: 'Toma una captura del canvas sin UI.',
        source: 'InputConstants.js',
        devOnly: true,
    }),
});

export const CONTROL_SECTION_ORDER = Object.freeze([
    CONTROL_CATEGORY.SYSTEM,
    CONTROL_CATEGORY.FLIGHT,
    CONTROL_CATEGORY.COCKPIT,
    CONTROL_CATEGORY.INTERACTION,
    CONTROL_CATEGORY.DEBUG,
]);

export const CONTROL_ORDER = Object.freeze([
    'SYSTEM_PAUSE',
    'HUD_TOGGLE',
    'LULU_COMM',
    'FLIGHT_YAW_PITCH',
    'FLIGHT_THRUST',
    'FLIGHT_STRAFE',
    'FLIGHT_ELEVATION_DRONE',
    'FLIGHT_BOOST',
    'FLIGHT_HYPERWARP',
    'COCKPIT_TOGGLE',
    'COCKPIT_ROLL',
    'COCKPIT_ELEVATION',
    'SELECT_MASS',
    'DESELECT_MASS',
    'PRECISION_TRAVEL',
    'MAP_CONTEXT',
    'ORBITAL_DESCENT',
    'ORBIT_ZOOM',
    'DEBUG_SCREENSHOT',
]);

const KEY_LABELS = Object.freeze({
    Escape: 'Esc',
    Tab: 'Tab',
    Digit1: '1',
    Numpad1: 'Numpad 1',
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    KeyQ: 'Q',
    KeyE: 'E',
    KeyC: 'C',
    KeyL: 'L',
    KeyM: 'M',
    KeyK: 'K',
    Space: 'Space',
    ShiftLeft: 'ShiftL',
    ShiftRight: 'ShiftR',
    AltLeft: 'AltL',
    AltRight: 'AltR',
    ArrowUp: 'Arrow Up',
    ArrowDown: 'Arrow Down',
    ArrowLeft: 'Arrow Left',
    ArrowRight: 'Arrow Right',
    Mouse0: 'Left click',
    Mouse1: 'Middle click',
    Mouse2: 'Right click',
    MouseMovement: 'Mouse movement',
    MouseWheel: 'Mouse wheel',
});

export function getControlById(controlId) {
    return ControlsManifest[controlId] ?? null;
}

export function getControlEntries({ includeDebug = false } = {}) {
    return CONTROL_ORDER
        .map((controlId) => ControlsManifest[controlId])
        .filter((control) => includeDebug || !control.devOnly);
}

export function getControlsByCategory(category, options = {}) {
    return getControlEntries(options).filter((control) => control.category === category);
}

export function isControlAllowedInMode(control, mode = CONTROL_MODE.ANY) {
    if (!control) return false;
    return control.validModes.includes(CONTROL_MODE.ANY) || control.validModes.includes(mode);
}

export function isControlAllowedInContext(control, context = CONTROL_CONTEXT.NONE) {
    if (!control) return false;
    return control.validContexts.includes(CONTROL_CONTEXT.ANY) || control.validContexts.includes(context);
}

export function isBindingAllowed(binding, { cameraMode = CONTROL_MODE.ANY, contextMode = CONTROL_CONTEXT.NONE } = {}) {
    if (!binding) return false;
    const modeAllowed = binding.validModes.includes(CONTROL_MODE.ANY) || binding.validModes.includes(cameraMode);
    const contextAllowed = binding.validContexts.includes(CONTROL_CONTEXT.ANY) || binding.validContexts.includes(contextMode);
    return modeAllowed && contextAllowed;
}

export function getActiveControlValue(control, keySet, { cameraMode = CONTROL_MODE.ANY, contextMode = CONTROL_CONTEXT.NONE } = {}) {
    if (!control || !keySet) {
        return { active: false, value: 0, bindings: [] };
    }

    let active = false;
    let value = 0;
    const bindings = [];

    for (const binding of control.bindings) {
        if (binding.trigger !== 'hold') continue;
        if (!isBindingAllowed(binding, { cameraMode, contextMode })) continue;
        const matched = binding.keys.every((key) => keySet.has(key));
        if (!matched) continue;

        active = true;
        value += Number.isFinite(binding.value) ? binding.value : 1;
        bindings.push(binding);
    }

    return { active, value, bindings };
}

export function findMatchingDiscreteBinding(control, code, keySet, options = {}) {
    if (!control || !code || !keySet) return null;

    const {
        trigger = 'keydown',
        cameraMode = CONTROL_MODE.ANY,
        contextMode = CONTROL_CONTEXT.NONE,
    } = options;

    for (const binding of control.bindings) {
        if (binding.trigger !== trigger) continue;
        if (!binding.keys.includes(code)) continue;
        if (!isBindingAllowed(binding, { cameraMode, contextMode })) continue;
        const comboSatisfied = binding.keys.every((key) => keySet.has(key));
        if (comboSatisfied) {
            return binding;
        }
    }

    return null;
}

export function formatBindingToken(token) {
    return KEY_LABELS[token] || token;
}

export function formatControlKeys(control) {
    if (!control) return '';
    return control.keys.map(formatBindingToken).join(' / ');
}

export function formatControlModes(control) {
    if (!control) return '';
    if (control.validModes.includes(CONTROL_MODE.ANY)) {
        return 'Any';
    }
    return control.validModes.join(', ');
}
