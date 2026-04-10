/**
 * InputStateSystem.js - OMEGA V-DIAMOND
 *
 * Hardware Abstraction Layer (HAL) + persistent input state store.
 * Canonical control routing now flows through ControlsManifest.
 */
import { Registry } from '../core/ServiceRegistry.js';
import { INPUT_CONSTANTS } from './InputConstants.js';
import {
    CONTROL_CONTEXT,
    CONTROL_MODE,
    findMatchingDiscreteBinding,
    formatControlKeys,
    getActiveControlValue,
    getControlById,
    isControlAllowedInContext,
    isControlAllowedInMode,
} from './ControlsManifest.js';

const DISCRETE_COMMAND_CONTROL_IDS = Object.freeze([
    'SYSTEM_PAUSE',
    'HUD_TOGGLE',
    'LULU_COMM',
    'MAP_CONTEXT',
    'ORBITAL_DESCENT',
    'COCKPIT_TOGGLE',
    'DEBUG_SCREENSHOT',
]);

const LULU_INPUT_IDS = new Set(['lulu-input', 'lulu-unified-input']);

export const OperativeContexts = Object.freeze({
    HELM: 'HELM',
    OPS: 'OPS',
});

export const InputContexts = Object.freeze({
    HELM: OperativeContexts.HELM,
    OPS: OperativeContexts.OPS,
    IMMERSIVE_FLIGHT: OperativeContexts.HELM,
    TACTICAL_OS: OperativeContexts.OPS,
});

const GESTURE_SIGNALS = Object.freeze({
    DOWN: 'PG:INPUT:GESTURE_DOWN',
    UP: 'PG:INPUT:GESTURE_UP',
    TAP: 'PG:INPUT:GESTURE_TAP',
    DOUBLE_TAP: 'PG:INPUT:GESTURE_DOUBLE_TAP',
    LONG_PRESS: 'PG:INPUT:GESTURE_LONG_PRESS',
    DRAG_START: 'PG:INPUT:GESTURE_DRAG_START',
    DRAG_MOVE: 'PG:INPUT:GESTURE_DRAG_MOVE',
    DRAG_END: 'PG:INPUT:GESTURE_DRAG_END',
    SCALAR: 'PG:INPUT:GESTURE_SCALAR',
});

// Sensitivity multiplier per pointer hardware type.
// Mouse movement carries OS-filtered DPI readings; touch/pen are raw CSS pixel deltas.
const POINTER_TYPE_SENSITIVITY = Object.freeze({
    mouse: 1.0,
    touch: 0.4,
    pen:   0.4,
});

export class InputStateSystem {
    static phase = 'input';

    constructor() {
        this.events = null;
        this.runtimeState = null;
        this.runtimeSignals = null;
        this.pointerPresentation = null;

        this.mouse = {
            x: 0,
            y: 0,
            dx: 0,
            dy: 0,
            buttons: new Set(),
        };

        this.keyboard = {
            held: new Set(),
            justDown: new Set(),
            justUp: new Set(),
        };

        this.pointer = {
            locked: false,
            dx: 0,
            dy: 0,
        };
        this.sharedCursorNDC = Object.seal({
            x: 0,
            y: 0,
        });

        this.tacticalPointerGesture = {
            active: false,
            pointerId: null,
            pointerType: 'mouse',
            button: 0,
            startedOverUi: false,
            dragging: false,
            dragSignaled: false,
            longPressTriggered: false,
            startedAt: 0,
            releasedAt: 0,
            contextAtStart: InputContexts.IMMERSIVE_FLIGHT,
            downX: 0,
            downY: 0,
            lastX: 0,
            lastY: 0,
            dragDistanceSq: 0,
        };

        this.uiPointerCaptured = false;
        this.hudMode = false;
        this.currentContext = InputContexts.HELM;
        this.scroll = { dy: 0 };
        // Per-frame drag-gesture channel. FSM states read dx/dy as rotation inputs
        // when pointer lock is absent (touch / unlocked mouse drag).
        this.gestureDrag = Object.seal({ dx: 0, dy: 0, active: false });

        this._pendingMouseDX = 0;
        this._pendingMouseDY = 0;
        this._pendingScrollDY = 0;
        this._pendingGestureDragDX = 0;
        this._pendingGestureDragDY = 0;
        this._skipLockedPointerSamples = 0;
        this._maxPointerDeltaPerEvent = 140;
        this._maxPointerDeltaPerFrame = 220;
        this._actionTimers = new Map();
        this._tacticalDragThresholdPx = 4;
        this._tacticalDragThresholdSq = this._tacticalDragThresholdPx * this._tacticalDragThresholdPx;
        this._longPressTimeMs = 500;
        this._doubleTapWindowMs = 800;
        this._doubleTapToleranceSq = this._tacticalDragThresholdSq * 4;
        this._lastTapTime = 0;
        this._lastTapX = 0;
        this._lastTapY = 0;
        this._lastTapContext = InputContexts.HELM;
        this._pointerSurface = null;
        this._inputArbitrationDebug = {
            lastSignal: 'NONE',
            lastIntent: 'NONE',
            overUi: false,
            wasDragging: false,
            dragDistance: 0,
            taps: 0,
            doubleTaps: 0,
            longPresses: 0,
            dragStarts: 0,
            dragEnds: 0,
            scalarAdjusts: 0,
        };

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onLockChange = this._onLockChange.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._onPauseState = this._onPauseState.bind(this);
    }

    async init() {
        this.events = Registry.tryGet('events');
        this.runtimeState = Registry.tryGet('RuntimeState');
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.pointerPresentation =
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        this._pointerSurface = this._resolvePointerSurface();

        console.log('[InputStateSystem] HAL + State Store online. Manifest routing active.');

        window.addEventListener('pointerdown', this._onPointerDown, { capture: true });
        window.addEventListener('pointerup', this._onPointerUp, { capture: true });
        window.addEventListener('pointermove', this._onPointerMove, { capture: true, passive: true });
        window.addEventListener('wheel', this._onWheel, { passive: true });
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('pointerlockchange', this._onLockChange);
        window.addEventListener('contextmenu', this._onContextMenu);
        window.addEventListener('blur', () => {
            this._resetPointerMotion();
            this._cancelActiveGesture('window-blur');
        });

        if (this.runtimeSignals?.on) {
            this._removePauseListener = this.runtimeSignals.on('PG:GAME_PAUSE_STATE', this._onPauseState);
        } else {
            window.addEventListener('PG:GAME_PAUSE_STATE', this._onPauseState);
        }

        Registry.register('InputStateSystem', this);
    }

    update(_delta) {
        this.mouse.dx = this._clampPointerDelta(this._pendingMouseDX, this._maxPointerDeltaPerFrame);
        this.mouse.dy = this._clampPointerDelta(this._pendingMouseDY, this._maxPointerDeltaPerFrame);
        this._pendingMouseDX = 0;
        this._pendingMouseDY = 0;

        this.pointer.dx = this.pointer.locked ? this.mouse.dx : 0;
        this.pointer.dy = this.pointer.locked ? this.mouse.dy : 0;

        this.scroll.dy = this._pendingScrollDY;
        this._pendingScrollDY = 0;

        // Drain gesture drag channel — active reflects whether a drag gesture is
        // currently in progress (not just whether there was delta this frame).
        this.gestureDrag.dx = this._pendingGestureDragDX;
        this.gestureDrag.dy = this._pendingGestureDragDY;
        this.gestureDrag.active = this.tacticalPointerGesture.dragging;
        this._pendingGestureDragDX = 0;
        this._pendingGestureDragDY = 0;

        this._pollActiveGesture(performance.now());

        this.keyboard.justDown.clear();
        this.keyboard.justUp.clear();
    }

    isActionActive(actionName) {
        const bindings = INPUT_CONSTANTS.BINDINGS[actionName];
        if (!bindings) return false;

        for (let i = 0; i < bindings.length; i++) {
            const code = bindings[i];
            if (code.startsWith('Mouse')) {
                const buttonIndex = parseInt(code.replace('Mouse', ''), 10);
                if (this.mouse.buttons.has(buttonIndex)) return true;
                continue;
            }

            if (this.keyboard.held.has(code)) return true;
        }

        return false;
    }

    isKey(code) {
        return this.keyboard.held.has(code);
    }

    isButton(buttonIndex) {
        return this.mouse.buttons.has(buttonIndex);
    }

    isHudMode() {
        return this.hudMode;
    }

    getInputContext() {
        return this.currentContext;
    }

    isImmersiveFlightContext() {
        return this.currentContext === InputContexts.IMMERSIVE_FLIGHT;
    }

    isTacticalOSContext() {
        return this.currentContext === InputContexts.TACTICAL_OS;
    }

    getSharedCursorNDC() {
        return this.sharedCursorNDC;
    }

    getDebugState() {
        return {
            context: this.currentContext,
            hudMode: this.hudMode,
            pointerLocked: this.pointer.locked,
            leftDown: this.mouse.buttons.has(0),
            rightDown: this.mouse.buttons.has(2),
            dragThresholdPx: this._tacticalDragThresholdPx,
            longPressTimeMs: this._longPressTimeMs,
            doubleTapWindowMs: this._doubleTapWindowMs,
            tacticalGestureActive: this.tacticalPointerGesture.active,
            tacticalGesturePointerType: this.tacticalPointerGesture.pointerType,
            tacticalGestureDragging: this.tacticalPointerGesture.dragging,
            tacticalGestureLongPress: this.tacticalPointerGesture.longPressTriggered,
            tacticalGestureStartedOverUi: this.tacticalPointerGesture.startedOverUi,
            lastSignal: this._inputArbitrationDebug.lastSignal,
            lastIntent: this._inputArbitrationDebug.lastIntent,
            overUi: this._inputArbitrationDebug.overUi,
            wasDragging: this._inputArbitrationDebug.wasDragging,
            dragDistance: this._inputArbitrationDebug.dragDistance,
            taps: this._inputArbitrationDebug.taps,
            doubleTaps: this._inputArbitrationDebug.doubleTaps,
            longPresses: this._inputArbitrationDebug.longPresses,
            dragStarts: this._inputArbitrationDebug.dragStarts,
            dragEnds: this._inputArbitrationDebug.dragEnds,
            scalarAdjusts: this._inputArbitrationDebug.scalarAdjusts,
            gestureDragActive: this.gestureDrag.active,
            gestureDragDX: this.gestureDrag.dx,
            gestureDragDY: this.gestureDrag.dy,
        };
    }

    /** Accumulated gesture-drag delta X for this frame (POINTER_TYPE_SENSITIVITY applied). */
    getGestureDragDX() {
        return this.gestureDrag.dx;
    }

    /** Accumulated gesture-drag delta Y for this frame (POINTER_TYPE_SENSITIVITY applied). */
    getGestureDragDY() {
        return this.gestureDrag.dy;
    }

    /** True if a pointer-drag gesture is currently in progress. */
    isGestureDragActive() {
        return this.gestureDrag.active;
    }

    isControlActive(controlId, options = {}) {
        const control = getControlById(controlId);
        if (!control) return false;

        const cameraMode = options.cameraMode ?? this._getCurrentCameraMode();
        const contextMode = options.contextMode ?? this._getCurrentContextMode();
        return getActiveControlValue(control, this.keyboard.held, {
            cameraMode,
            contextMode,
        }).active;
    }

    getControlAxis(controlId, options = {}) {
        const control = getControlById(controlId);
        if (!control) return 0;

        const cameraMode = options.cameraMode ?? this._getCurrentCameraMode();
        const contextMode = options.contextMode ?? this._getCurrentContextMode();
        return getActiveControlValue(control, this.keyboard.held, {
            cameraMode,
            contextMode,
        }).value;
    }

    getRollAxis() {
        return this.getControlAxis('COCKPIT_ROLL');
    }

    getLookDX() {
        if (!this.isImmersiveFlightContext() || this.uiPointerCaptured) return 0;

        return this.pointer.locked
            ? this.pointer.dx
            : (this.isActionActive('PRIMARY_ACTION') || this.isActionActive('SECONDARY_ACTION') ? this.mouse.dx : 0);
    }

    getLookDY() {
        if (!this.isImmersiveFlightContext() || this.uiPointerCaptured) return 0;

        return this.pointer.locked
            ? this.pointer.dy
            : (this.isActionActive('PRIMARY_ACTION') || this.isActionActive('SECONDARY_ACTION') ? this.mouse.dy : 0);
    }

    isUiCapturingPointer() {
        return this.uiPointerCaptured;
    }

    isHudWorkspaceExclusive() {
        if (!this.hudMode) {
            return false;
        }

        const luluSpawner =
            Registry.tryGet('luluSpawner') ??
            window.LULU_SPAWNER ??
            null;

        if (typeof luluSpawner?.isWorkspaceInputExclusive === 'function') {
            return !!luluSpawner.isWorkspaceInputExclusive();
        }

        return !!(luluSpawner?.editingBody || document.getElementById('lulu-modeler-panel'));
    }

    _onPointerDown(event) {
        Registry.tryGet('audioEngine')?.resume?.();

        const isUiTarget = this._isUiTarget(event.target) || this._isPointOverUi(event.clientX, event.clientY);
        this._updateSharedCursorNDC(event.clientX, event.clientY);
        this.mouse.buttons.add(event.button);
        this.uiPointerCaptured = isUiTarget;

        if (this._isGesturePointer(event)) {
            if (!isUiTarget) {
                this.uiPointerCaptured = false;
            }
            if (!isUiTarget && this.isImmersiveFlightContext()) {
                this._requestPointerLockFromPrimaryPointer();
            }
            this._beginTacticalPointerGesture(event, isUiTarget);
        }
        this.events?.emit('INPUT_POINTER_DOWN', {
            button: event.button,
            x: event.clientX,
            y: event.clientY,
            target: event.target,
        });
    }

    _onPointerUp(event) {
        const wasTracked = this.mouse.buttons.has(event.button);
        const isUiTarget = this._isUiTarget(event.target) || this._isPointOverUi(event.clientX, event.clientY);
        if (!wasTracked && !isUiTarget && !this._isGesturePointer(event)) {
            return;
        }

        this._updateSharedCursorNDC(event.clientX, event.clientY);

        if (this._isGesturePointer(event)) {
            this._commitTacticalPointerGesture(event, isUiTarget);
        }

        this.mouse.buttons.delete(event.button);
        if (this.mouse.buttons.size === 0) {
            this.uiPointerCaptured = false;
        }
        this.events?.emit('INPUT_POINTER_UP', {
            button: event.button,
            x: event.clientX,
            y: event.clientY,
        });
    }

    _onPointerMove(event) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
        this._updateSharedCursorNDC(event.clientX, event.clientY);

        let movementX = Number.isFinite(event.movementX) ? event.movementX : 0;
        let movementY = Number.isFinite(event.movementY) ? event.movementY : 0;

        if (this.pointer.locked) {
            if (this._skipLockedPointerSamples > 0) {
                this._skipLockedPointerSamples -= 1;
                movementX = 0;
                movementY = 0;
            } else {
                movementX = this._clampPointerDelta(movementX, this._maxPointerDeltaPerEvent);
                movementY = this._clampPointerDelta(movementY, this._maxPointerDeltaPerEvent);
            }
        }

        this._pendingMouseDX += movementX;
        this._pendingMouseDY += movementY;

        if (this.tacticalPointerGesture.active) {
            this._updateTacticalPointerGesture(event, movementX, movementY);
        }
    }

    _onWheel(event) {
        if (this._isTypingTarget(event.target) || this._isUiTarget(event.target)) {
            return;
        }

        this._pendingScrollDY += event.deltaY;
        this.events?.emit('INPUT_WHEEL', { deltaY: event.deltaY });
        this._inputArbitrationDebug.scalarAdjusts += 1;
        this._emitGestureSignal(GESTURE_SIGNALS.SCALAR, {
            context: this.currentContext,
            ndc: this._cloneSharedCursorNDC(),
            x: event.clientX ?? this.mouse.x,
            y: event.clientY ?? this.mouse.y,
            value: Math.sign(event.deltaY || 0),
            deltaY: event.deltaY,
            pointerType: 'wheel',
            target: event.target ?? null,
        });
    }

    _onKeyDown(event) {
        if (!this.keyboard.held.has(event.code)) {
            this.keyboard.justDown.add(event.code);
        }
        this.keyboard.held.add(event.code);
        this.events?.emit('INPUT_KEY_DOWN', { code: event.code, key: event.key });

        const luluControl = getControlById('LULU_COMM');
        const pauseControl = getControlById('SYSTEM_PAUSE');
        const hudControl = getControlById('HUD_TOGGLE');
        const luluToggle = !!findMatchingDiscreteBinding(luluControl, event.code, this.keyboard.held, {
            trigger: 'keydown',
            cameraMode: CONTROL_MODE.ANY,
            contextMode: CONTROL_CONTEXT.ANY,
        }) || event.key === '1';
        const pauseToggle = !!findMatchingDiscreteBinding(pauseControl, event.code, this.keyboard.held, {
            trigger: 'keydown',
            cameraMode: CONTROL_MODE.ANY,
            contextMode: CONTROL_CONTEXT.ANY,
        });
        const hudToggle = !!findMatchingDiscreteBinding(hudControl, event.code, this.keyboard.held, {
            trigger: 'keydown',
            cameraMode: this._getCurrentCameraMode(),
            contextMode: this._getCurrentContextMode(),
        });

        if (luluToggle && LULU_INPUT_IDS.has(event.target?.id)) {
            event.preventDefault();
            if (!event.repeat) {
                this._emitDiscreteControlCommand(luluControl, event, {
                    cameraMode: CONTROL_MODE.ANY,
                    contextMode: CONTROL_CONTEXT.ANY,
                });
            }
            return;
        }

        if (this._isLoginActive() || (this._isTypingTarget(event.target) && !hudToggle)) {
            return;
        }

        if (this._isGamePaused() && !pauseToggle && !luluToggle) {
            return;
        }

        this._handleManifestKeydown(event);
    }

    _onKeyUp(event) {
        this.keyboard.held.delete(event.code);
        this.keyboard.justUp.add(event.code);
        this.events?.emit('INPUT_KEY_UP', { code: event.code, key: event.key });
        this._actionTimers.delete(event.code);
    }

    _onLockChange() {
        this.pointer.locked = !!document.pointerLockElement;
        if (this.pointer.locked) {
            this.sharedCursorNDC.x = 0;
            this.sharedCursorNDC.y = 0;
            if (!this.isImmersiveFlightContext()) {
                this.currentContext = InputContexts.HELM;
                this.hudMode = false;
                document.body.classList.remove('pg-hud-mode');
                this._clearPointerIntent('hud-mode');
                this.runtimeSignals?.emit?.('PG:NAV:DISENGAGE_AUTO_BRAKE', {
                    source: 'pointer-lock-change',
                    previousContext: InputContexts.OPS,
                    currentContext: this.currentContext,
                });
                this.runtimeSignals?.emit?.('PG:INPUT:CONTEXT_CHANGED', {
                    previousContext: InputContexts.OPS,
                    newContext: this.currentContext,
                    currentContext: this.currentContext,
                    source: 'pointer-lock-change',
                });
                this.runtimeSignals?.emit?.('PG:HUD_MODE', {
                    active: false,
                    source: 'pointer-lock-change',
                    currentContext: this.currentContext,
                });
            }
        } else {
            this._updateSharedCursorNDC(this.mouse.x, this.mouse.y);
        }
        this._resetPointerMotion();
        this._skipLockedPointerSamples = this.pointer.locked ? 2 : 0;
        this.events?.emit('INPUT_LOCK_CHANGE', { locked: this.pointer.locked });
    }

    _onContextMenu(event) {
        event.preventDefault();
    }

    _enterHudMode(options = {}) {
        return this._transitionToContext(InputContexts.TACTICAL_OS, options);
    }

    _exitHudMode(options = {}) {
        return this._transitionToContext(InputContexts.IMMERSIVE_FLIGHT, options);
    }

    _handleManifestKeydown(event) {
        const candidate = this._findDiscreteCommandCandidate(event.code);
        if (!candidate) {
            return false;
        }

        event.preventDefault();
        if (event.repeat && candidate.binding.allowRepeat !== true) {
            return true;
        }

        const validation = this._validateControlAttempt(candidate.control);
        if (!validation.ok) {
            this._emitInvalidActionAttempt(candidate.control, validation, event);
            return true;
        }

        this._executeDiscreteControl(candidate.control, event, validation);
        return true;
    }

    _findDiscreteCommandCandidate(code) {
        if (!code) return null;

        for (const controlId of DISCRETE_COMMAND_CONTROL_IDS) {
            const control = getControlById(controlId);
            if (!control) continue;

            for (const binding of control.bindings) {
                if (binding.trigger !== 'keydown') continue;
                if (!binding.keys.includes(code)) continue;
                return { control, binding };
            }
        }

        return null;
    }

    _validateControlAttempt(control) {
        const nav = Registry.tryGet('navigationSystem') ?? window.engine?.navigationSystem ?? null;
        const landingSystem = Registry.tryGet('LandingSystem') ?? window.engine?.landingSystem ?? null;
        const cameraMode = this._getCurrentCameraMode();
        const contextMode = this._getCurrentContextMode();

        if (!isControlAllowedInMode(control, cameraMode)) {
            return {
                ok: false,
                reason: 'invalid-mode',
                cameraMode,
                contextMode,
                message: `${control.label} no esta disponible en ${cameraMode}.`,
            };
        }

        if (!isControlAllowedInContext(control, contextMode)) {
            return {
                ok: false,
                reason: 'invalid-context',
                cameraMode,
                contextMode,
                message: `${control.label} no esta disponible en este contexto.`,
            };
        }

        if (control.requiresFocusTarget && !nav?.focusTarget) {
            return {
                ok: false,
                reason: 'missing-focus-target',
                cameraMode,
                contextMode,
                message: `Necesitas una masa enfocada para usar ${control.label}.`,
            };
        }

        if (control.requiresPointerLock && !this.pointer.locked) {
            return {
                ok: false,
                reason: 'pointer-lock-required',
                cameraMode,
                contextMode,
                message: `${control.label} requiere pointer lock activo.`,
            };
        }

        if (control.requiresProximity && !landingSystem?.canTriggerOrbitalDescent?.(nav?.focusTarget ?? null)) {
            return {
                ok: false,
                reason: 'proximity-required',
                cameraMode,
                contextMode,
                message: 'Acercate mas al planeta para iniciar el descenso orbital.',
            };
        }

        return {
            ok: true,
            cameraMode,
            contextMode,
        };
    }

    _executeDiscreteControl(control, event, validation) {
        switch (control?.id) {
        case 'HUD_TOGGLE':
            if (this.hudMode) this._exitHudMode();
            else this._enterHudMode();
            this._emitDiscreteControlCommand(control, event, {
                ...validation,
                active: this.hudMode,
            });
            return;
        default:
            this._emitDiscreteControlCommand(control, event, validation);
        }
    }

    _emitDiscreteControlCommand(control, event, validation = {}) {
        const payload = {
            controlId: control?.id ?? null,
            action: control?.action ?? null,
            signal: control?.signal ?? null,
            cameraMode: validation.cameraMode ?? this._getCurrentCameraMode(),
            contextMode: validation.contextMode ?? this._getCurrentContextMode(),
            source: 'input-state',
            code: event?.code ?? null,
            key: event?.key ?? null,
            active: validation.active,
            targetObject: validation.targetObject ?? null,
        };

        if (payload.signal) {
            this.runtimeSignals?.emit?.(payload.signal, payload);
        }
        this.runtimeSignals?.emit?.('PG:INPUT_COMMAND', payload);
        return payload;
    }

    _emitInvalidActionAttempt(control, validation, event) {
        const payload = {
            controlId: control?.id ?? null,
            action: control?.action ?? null,
            cameraMode: validation.cameraMode ?? this._getCurrentCameraMode(),
            contextMode: validation.contextMode ?? this._getCurrentContextMode(),
            reason: validation.reason ?? 'invalid-action',
            message: validation.message ?? 'Comando no disponible.',
            source: 'input-state',
            code: event?.code ?? null,
            key: event?.key ?? null,
            keys: formatControlKeys(control),
        };

        this.runtimeSignals?.emit?.('PG:INVALID_ACTION_ATTEMPT', payload);
        this.runtimeSignals?.emit?.('ON_INVALID_ACTION_ATTEMPT', payload);
        this.runtimeSignals?.emit?.('PG:HUD_TRANSMISSION', {
            sourceLabel: 'Comando no disponible',
            stateLabel: 'Restriccion',
            message: payload.message,
        });
    }

    _onPauseState(event) {
        const active = typeof event?.active === 'boolean' ? event.active : !!event?.detail?.active;
        if (!active) return;
        this._resetPointerMotion();
        this._cancelActiveGesture('pause-state');
        this._skipLockedPointerSamples = 2;
    }

    _isLoginActive() {
        return this.runtimeState?.isLoginActive?.() ?? !!window.__loginActive;
    }

    _isGamePaused() {
        return this.runtimeState?.isGamePaused?.() ?? !!window.__gamePaused;
    }

    _getCurrentCameraMode() {
        const nav = Registry.tryGet('navigationSystem') ?? window.engine?.navigationSystem ?? null;
        return nav?.getCameraMode?.() ?? nav?.fsm?.currentStateId ?? nav?.state ?? CONTROL_MODE.ANY;
    }

    _getCurrentContextMode() {
        if (this.hudMode) {
            return CONTROL_CONTEXT.HUD_MODE;
        }

        const nav = Registry.tryGet('navigationSystem') ?? window.engine?.navigationSystem ?? null;
        return nav?.getContextMode?.() ?? CONTROL_CONTEXT.NONE;
    }

    _getPointerPresentationController() {
        this.pointerPresentation =
            this.pointerPresentation ||
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        return this.pointerPresentation;
    }

    _resolvePointerSurface() {
        const pointerController = this._getPointerPresentationController?.();
        const domElement =
            pointerController?.domElement ||
            document.getElementById('pg-renderer') ||
            document.querySelector('canvas');
        return domElement || null;
    }

    _updateSharedCursorNDC(clientX = this.mouse.x, clientY = this.mouse.y) {
        if (this.pointer.locked) {
            this.sharedCursorNDC.x = 0;
            this.sharedCursorNDC.y = 0;
            return;
        }

        this._pointerSurface = this._pointerSurface || this._resolvePointerSurface();
        const surface = this._pointerSurface;
        const rect = surface?.getBoundingClientRect?.();
        const width = rect?.width || window.innerWidth || 1;
        const height = rect?.height || window.innerHeight || 1;
        const left = rect?.left || 0;
        const top = rect?.top || 0;

        const clampedX = Math.max(0, Math.min(width, clientX - left));
        const clampedY = Math.max(0, Math.min(height, clientY - top));

        this.sharedCursorNDC.x = ((clampedX / Math.max(1, width)) * 2) - 1;
        this.sharedCursorNDC.y = -(((clampedY / Math.max(1, height)) * 2) - 1);
    }

    _requestPointerLockFromPrimaryPointer() {
        if (document.pointerLockElement || !this.isImmersiveFlightContext() || this._isLoginActive() || this._isGamePaused()) {
            return false;
        }

        const cameraMode = this._getCurrentCameraMode();
        const canRecover =
            cameraMode === CONTROL_MODE.FREE_FLIGHT ||
            cameraMode === CONTROL_MODE.COCKPIT;

        if (!canRecover) {
            return false;
        }

        this._getPointerPresentationController()?.requestPointerLock?.({
            source: 'input-primary-canvas-click',
        });
        return true;
    }

    _upsertPointerIntent(source, intent) {
        return this._getPointerPresentationController()?.upsertIntent?.(source, intent) ?? null;
    }

    _clearPointerIntent(source) {
        return this._getPointerPresentationController()?.clearIntent?.(source) ?? null;
    }

    _resetPointerMotion() {
        this._pendingMouseDX = 0;
        this._pendingMouseDY = 0;
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        this.pointer.dx = 0;
        this.pointer.dy = 0;
    }

    _beginTacticalPointerGesture(event, isUiTarget) {
        if (!this._isGesturePointer(event) || this._isLoginActive() || this._isGamePaused() || this._isTypingTarget(event.target)) {
            this._resetTacticalPointerGesture();
            return;
        }

        this.tacticalPointerGesture.active = true;
        this.tacticalPointerGesture.pointerId = event.pointerId ?? null;
        this.tacticalPointerGesture.pointerType = event.pointerType || 'mouse';
        this.tacticalPointerGesture.button = event.button ?? 0;
        this.tacticalPointerGesture.startedOverUi = !!isUiTarget;
        this.tacticalPointerGesture.dragging = false;
        this.tacticalPointerGesture.dragSignaled = false;
        this.tacticalPointerGesture.longPressTriggered = false;
        this.tacticalPointerGesture.startedAt = performance.now();
        this.tacticalPointerGesture.releasedAt = 0;
        this.tacticalPointerGesture.contextAtStart = this.currentContext;
        this.tacticalPointerGesture.downX = event.clientX ?? 0;
        this.tacticalPointerGesture.downY = event.clientY ?? 0;
        this.tacticalPointerGesture.lastX = event.clientX ?? 0;
        this.tacticalPointerGesture.lastY = event.clientY ?? 0;
        this.tacticalPointerGesture.dragDistanceSq = 0;

        this._inputArbitrationDebug.lastIntent = isUiTarget
            ? 'GESTURE_UI_CAPTURE'
            : `${this.currentContext}_GESTURE_PENDING`;
        this._inputArbitrationDebug.overUi = !!isUiTarget;
        this._inputArbitrationDebug.wasDragging = false;
        this._inputArbitrationDebug.dragDistance = 0;
        if (!isUiTarget) {
            this._emitGestureSignal(GESTURE_SIGNALS.DOWN, {
                context: this.currentContext,
                x: event.clientX,
                y: event.clientY,
                ndc: this._cloneSharedCursorNDC(),
                pointerType: this.tacticalPointerGesture.pointerType,
                button: this.tacticalPointerGesture.button,
                target: event.target ?? null,
            });
        }
    }

    _pollActiveGesture(now) {
        const gesture = this.tacticalPointerGesture;
        if (
            !gesture.active ||
            gesture.startedOverUi ||
            gesture.dragging ||
            gesture.longPressTriggered ||
            this._isLoginActive() ||
            this._isGamePaused()
        ) {
            return;
        }

        const durationMs = Math.max(0, now - gesture.startedAt);
        if (durationMs < this._longPressTimeMs) {
            return;
        }

        gesture.longPressTriggered = true;
        this._inputArbitrationDebug.longPresses += 1;
        this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_LONG_PRESS`;
        this._emitGestureSignal(GESTURE_SIGNALS.LONG_PRESS, {
            context: gesture.contextAtStart,
            x: gesture.lastX,
            y: gesture.lastY,
            ndc: this._cloneSharedCursorNDC(),
            durationMs,
            pointerType: gesture.pointerType,
            button: gesture.button,
            target: null,
        });
    }

    _updateTacticalPointerGesture(event, movementX, movementY) {
        const gesture = this.tacticalPointerGesture;
        if (!gesture.active) {
            return;
        }
        if (gesture.pointerId !== null && event.pointerId != null && gesture.pointerId !== event.pointerId) {
            return;
        }
        gesture.lastX = event.clientX ?? gesture.lastX;
        gesture.lastY = event.clientY ?? gesture.lastY;
        if (gesture.startedOverUi || gesture.longPressTriggered) {
            return;
        }

        const dx = (event.clientX ?? gesture.lastX) - gesture.downX;
        const dy = (event.clientY ?? gesture.lastY) - gesture.downY;
        const dragDistanceSq = (dx * dx) + (dy * dy);
        gesture.dragDistanceSq = dragDistanceSq;
        this._inputArbitrationDebug.dragDistance = Number(Math.sqrt(dragDistanceSq).toFixed(2));

        if (!gesture.dragging && dragDistanceSq > this._tacticalDragThresholdSq) {
            gesture.dragging = true;
            gesture.dragSignaled = true;
            this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_DRAG`;
            this._inputArbitrationDebug.wasDragging = true;
            this._inputArbitrationDebug.dragStarts += 1;
            this._emitGestureSignal(GESTURE_SIGNALS.DRAG_START, {
                context: gesture.contextAtStart,
                x: gesture.downX,
                y: gesture.downY,
                ndc: this._cloneSharedCursorNDC(),
                movementX,
                movementY,
                pointerType: gesture.pointerType,
                button: gesture.button,
                target: event.target ?? null,
            });
            // Seal the FSM: capture all future pointer events to this element
            // so pointerup is received even if the pointer leaves the window.
            if (gesture.pointerId !== null) {
                try {
                    this._pointerSurface = this._pointerSurface || this._resolvePointerSurface();
                    this._pointerSurface?.setPointerCapture?.(gesture.pointerId);
                } catch (_e) { /* pointerId already released or element not focusable */ }
            }
            if (gesture.contextAtStart === InputContexts.OPS) {
                this.runtimeSignals?.emit?.('PG:INPUT:TACTICAL_DRAG_START', {
                    source: 'input-state',
                    context: gesture.contextAtStart,
                    x: gesture.downX,
                    y: gesture.downY,
                    button: 0,
                });
                this._inputArbitrationDebug.lastSignal = 'PG:INPUT:TACTICAL_DRAG_START';
            }
        }

        if (gesture.dragging) {
            // Accumulate sensitivity-adjusted delta into the per-frame gesture-drag channel.
            // FSM states (FreeFlightState, OrbitState) read this instead of pointer.locked delta
            // when neither pointer lock nor a button hold is active (touch / free mouse drag).
            const sensitivityFactor = POINTER_TYPE_SENSITIVITY[gesture.pointerType] ?? 1.0;
            this._pendingGestureDragDX += movementX * sensitivityFactor;
            this._pendingGestureDragDY += movementY * sensitivityFactor;
            this._emitGestureSignal(GESTURE_SIGNALS.DRAG_MOVE, {
                context: gesture.contextAtStart,
                x: event.clientX,
                y: event.clientY,
                ndc: this._cloneSharedCursorNDC(),
                movementX,
                movementY,
                pointerType: gesture.pointerType,
                button: gesture.button,
                target: event.target ?? null,
            });
            if (gesture.contextAtStart === InputContexts.OPS) {
                this.runtimeSignals?.emit?.('PG:INPUT:TACTICAL_DRAGGING', {
                    source: 'input-state',
                    context: gesture.contextAtStart,
                    x: event.clientX,
                    y: event.clientY,
                    movementX,
                    movementY,
                    ndc: this._cloneSharedCursorNDC(),
                });
                this._inputArbitrationDebug.lastSignal = 'PG:INPUT:TACTICAL_DRAGGING';
            }
        }
    }

    _commitTacticalPointerGesture(event, isUiTarget) {
        const gesture = this.tacticalPointerGesture;
        if (!gesture.active) {
            return;
        }
        if (gesture.pointerId !== null && event.pointerId != null && gesture.pointerId !== event.pointerId) {
            return;
        }

        const overUi = gesture.startedOverUi || !!isUiTarget;
        const wasDragging = gesture.dragging;
        const durationMs = Math.max(0, performance.now() - gesture.startedAt);
        this._inputArbitrationDebug.overUi = overUi;
        this._inputArbitrationDebug.wasDragging = wasDragging;
        this._inputArbitrationDebug.dragDistance = Number(Math.sqrt(gesture.dragDistanceSq).toFixed(2));
        this.tacticalPointerGesture.releasedAt = performance.now();

        if (overUi || this._isTypingTarget(event.target) || this._isLoginActive() || this._isGamePaused()) {
            this._inputArbitrationDebug.lastIntent = overUi ? 'GESTURE_UI_BLOCKED' : 'GESTURE_SUPPRESSED';
            this._resetTacticalPointerGesture();
            return;
        }

        if (wasDragging) {
            this._emitGestureSignal(GESTURE_SIGNALS.DRAG_END, {
                context: gesture.contextAtStart,
                x: event.clientX,
                y: event.clientY,
                ndc: this._cloneSharedCursorNDC(),
                durationMs,
                pointerType: gesture.pointerType,
                target: event.target ?? null,
            });
            if (gesture.contextAtStart === InputContexts.OPS && gesture.dragSignaled) {
                this.runtimeSignals?.emit?.('PG:INPUT:TACTICAL_DRAG_END', {
                    source: 'input-state',
                    context: gesture.contextAtStart,
                    x: event.clientX,
                    y: event.clientY,
                    button: 0,
                });
                this._inputArbitrationDebug.lastSignal = 'PG:INPUT:TACTICAL_DRAG_END';
            }
            this._inputArbitrationDebug.dragEnds += 1;
            this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_DRAG_RESOLVED`;
            this._resetTacticalPointerGesture();
            return;
        }

        const upPayload = {
            context: gesture.contextAtStart,
            x: event.clientX,
            y: event.clientY,
            ndc: this._cloneSharedCursorNDC(),
            durationMs,
            pointerType: gesture.pointerType,
            button: gesture.button,
            longPress: gesture.longPressTriggered,
            target: event.target ?? null,
        };

        if (gesture.longPressTriggered) {
            this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_LONG_PRESS_RELEASE`;
            this._emitGestureSignal(GESTURE_SIGNALS.UP, upPayload);
            this._resetTacticalPointerGesture();
            return;
        }

        const isDoubleTap = this._isDoubleTapCandidate(
            durationMs,
            event.clientX ?? gesture.lastX,
            event.clientY ?? gesture.lastY,
            gesture.contextAtStart
        );

        if (isDoubleTap) {
            this._inputArbitrationDebug.doubleTaps += 1;
            this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_DOUBLE_TAP`;
            this._emitGestureSignal(GESTURE_SIGNALS.DOUBLE_TAP, upPayload);
            this._lastTapTime = 0;
        } else {
            this._inputArbitrationDebug.taps += 1;
            this._inputArbitrationDebug.lastIntent = `${gesture.contextAtStart}_TAP`;
            this._emitGestureSignal(GESTURE_SIGNALS.TAP, upPayload);
            this._lastTapTime = performance.now();
            // Under pointer lock the cursor is fixed at center — persist (0,0) so
            // the next tap's spatial comparison is coherent with this one.
            this._lastTapX = this.pointer.locked ? 0 : (event.clientX ?? gesture.lastX);
            this._lastTapY = this.pointer.locked ? 0 : (event.clientY ?? gesture.lastY);
            this._lastTapContext = gesture.contextAtStart;
        }

        this._emitGestureSignal(GESTURE_SIGNALS.UP, upPayload);
        this._resetTacticalPointerGesture();
    }

    _cancelActiveGesture(reason = 'cancelled') {
        if (this.tacticalPointerGesture.active && this.tacticalPointerGesture.longPressTriggered) {
            this._emitGestureSignal(GESTURE_SIGNALS.UP, {
                context: this.tacticalPointerGesture.contextAtStart,
                x: this.tacticalPointerGesture.lastX,
                y: this.tacticalPointerGesture.lastY,
                ndc: this._cloneSharedCursorNDC(),
                durationMs: Math.max(0, performance.now() - this.tacticalPointerGesture.startedAt),
                pointerType: this.tacticalPointerGesture.pointerType,
                longPress: true,
                cancelled: true,
                reason,
                target: null,
            });
        }
        this._resetTacticalPointerGesture();
    }

    _resetTacticalPointerGesture() {
        // Release pointer capture if a drag was in progress, to unseal the FSM.
        if (this.tacticalPointerGesture.dragging && this.tacticalPointerGesture.pointerId !== null) {
            try {
                this._pointerSurface = this._pointerSurface || this._resolvePointerSurface();
                this._pointerSurface?.releasePointerCapture?.(this.tacticalPointerGesture.pointerId);
            } catch (_e) { /* already released or element gone */ }
        }
        this.tacticalPointerGesture.active = false;
        this.tacticalPointerGesture.pointerId = null;
        this.tacticalPointerGesture.pointerType = 'mouse';
        this.tacticalPointerGesture.button = 0;
        this.tacticalPointerGesture.startedOverUi = false;
        this.tacticalPointerGesture.dragging = false;
        this.tacticalPointerGesture.dragSignaled = false;
        this.tacticalPointerGesture.longPressTriggered = false;
        this.tacticalPointerGesture.startedAt = 0;
        this.tacticalPointerGesture.releasedAt = 0;
        this.tacticalPointerGesture.contextAtStart = this.currentContext;
        this.tacticalPointerGesture.downX = 0;
        this.tacticalPointerGesture.downY = 0;
        this.tacticalPointerGesture.lastX = 0;
        this.tacticalPointerGesture.lastY = 0;
        this.tacticalPointerGesture.dragDistanceSq = 0;
    }

    _clampPointerDelta(value, limit) {
        if (!Number.isFinite(value)) return 0;
        if (Math.abs(value) > limit * 6) return 0;
        return Math.max(-limit, Math.min(limit, value));
    }

    _transitionToContext(newContext, options = {}) {
        const {
            requestPointerLock = newContext === InputContexts.HELM,
            source = 'input-state',
            announce = true,
            force = false,
        } = options;

        const nextHudState = newContext === InputContexts.OPS;
        if (!force && this.currentContext === newContext && this.hudMode === nextHudState) {
            return false;
        }

        const previousContext = this.currentContext;
        this.currentContext = newContext;
        this.hudMode = nextHudState;
        this._pendingMouseDX = 0;
        this._pendingMouseDY = 0;
        this._cancelActiveGesture('context-transition');

        if (this.isTacticalOSContext()) {
            this._getPointerPresentationController()?.releasePointerLock?.({
                reason: 'input-context-tactical',
            });
            document.body.classList.add('pg-hud-mode');
            this._upsertPointerIntent('hud-mode', {
                kind: 'ui',
                cursor: 'default',
                priority: 280,
                reticleMode: 'hidden',
            });
            this.runtimeSignals?.emit?.('PG:NAV:ENGAGE_AUTO_BRAKE', {
                source,
                previousContext,
                currentContext: this.currentContext,
            });
        } else {
            document.body.classList.remove('pg-hud-mode');
            this._clearPointerIntent('hud-mode');

            const menuOpen =
                !!document.getElementById('pg-game-menu')?.offsetParent ||
                document.body.classList.contains('pg-game-paused');

            if (
                requestPointerLock &&
                !document.pointerLockElement &&
                !this._isLoginActive() &&
                !this._isGamePaused() &&
                !menuOpen
            ) {
                this._getPointerPresentationController()?.requestPointerLock?.({
                    source: 'input-context-immersive',
                });
            }

            this.runtimeSignals?.emit?.('PG:NAV:DISENGAGE_AUTO_BRAKE', {
                source,
                previousContext,
                currentContext: this.currentContext,
            });
        }

        this._updateSharedCursorNDC(this.mouse.x, this.mouse.y);

        const payload = {
            previousContext,
            newContext: this.currentContext,
            currentContext: this.currentContext,
            source,
            hudMode: this.hudMode,
            pointerLocked: this.pointer.locked,
        };

        this.runtimeSignals?.emit?.('PG:INPUT:CONTEXT_CHANGED', payload);
        this.runtimeSignals?.emit?.('PG:HUD_MODE', {
            active: this.hudMode,
            source,
            currentContext: this.currentContext,
            previousContext,
        });

        if (announce) {
            const text = this.isTacticalOSContext()
                ? '[SISTEMA] :: Contexto OPS activo. Auto-freno engranado.'
                : '[SISTEMA] :: Contexto HELM activo. Controles de vuelo enlazados.';
            this.runtimeSignals?.emit?.('PG:UI:PRINT_LULU', { text });
        }

        return true;
    }

    _emitGestureSignal(signal, payload = {}) {
        const gesturePayload = {
            source: 'input-state',
            ...payload,
        };
        this.runtimeSignals?.emit?.(signal, gesturePayload);
        this._inputArbitrationDebug.lastSignal = signal;
        return gesturePayload;
    }

    _cloneSharedCursorNDC() {
        return {
            x: this.sharedCursorNDC.x,
            y: this.sharedCursorNDC.y,
        };
    }

    _isGesturePointer(event) {
        if (!event) return false;
        // Solo clic izquierdo (0) entra al sistema gestual.
        // Clic derecho (2): preventDefault en contextmenu, pero cero comportamiento.
        if (event.pointerType === 'mouse') {
            return event.button === 0;
        }
        return event.button === 0 || event.button === -1 || event.button == null;
    }

    _isDoubleTapCandidate(durationMs, clientX, clientY, context) {
        if (durationMs >= this._longPressTimeMs) {
            return false;
        }
        if ((performance.now() - this._lastTapTime) > this._doubleTapWindowMs) {
            return false;
        }
        if (this._lastTapContext !== context) {
            return false;
        }
        // Under pointer lock the cursor is mathematically anchored to the screen center.
        // The spatial proximity check is semantically void and would incorrectly block
        // HELM_DOUBLE_TAP recognition (headless synthetic events also hit this case).
        if (this.pointer.locked) {
            return true;
        }
        const dx = (clientX ?? 0) - this._lastTapX;
        const dy = (clientY ?? 0) - this._lastTapY;
        return ((dx * dx) + (dy * dy)) <= this._doubleTapToleranceSq;
    }

    _emitTacticalPointerSignal(signal, event) {
        const payload = {
            source: 'input-state',
            context: this.currentContext,
            button: event.button ?? 0,
            x: event.clientX,
            y: event.clientY,
            ndc: {
                x: this.sharedCursorNDC.x,
                y: this.sharedCursorNDC.y,
            },
            target: event.target ?? null,
        };
        this.runtimeSignals?.emit?.(signal, payload);
        this._inputArbitrationDebug.lastSignal = signal;
        return payload;
    }

    _isTypingTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    _isUiTarget(target) {
        return !!target?.closest?.(
            [
                '#window-layer',
                '#kernel-bar',
                '#initial-menu-overlay',
                '#login-screen',
                '#pg-game-menu',
                '#lulu-panel',
                '#lulu-bar-wrap',
                '#lulu-manual-panel',
                '#lulu-response-panel',
                '#lulu-response-wrap',
                '#lulu-modeler-panel',
                '.glass-window',
                '.glass-panel',
                '.window-shelf',
                '.kernel-dock',
                '.lulu-command-input',
                '.helmet-transmission',
                '.transmission-close',
                '.pg-pause-shell',
                '.pg-pause-nav',
                '.pg-pause-main',
                'button',
                'input',
                'textarea',
                'select',
                '[contenteditable="true"]',
            ].join(', ')
        );
    }

    _isPointOverUi(clientX, clientY) {
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return false;
        }

        const element = document.elementFromPoint(clientX, clientY);
        return this._isUiTarget(element);
    }

    get state() {
        return {
            keysHeld: this.keyboard.held,
            mouseButtons: this.mouse.buttons,
            mouseX: this.mouse.x,
            mouseY: this.mouse.y,
            mouseDX: this.mouse.dx,
            mouseDY: this.mouse.dy,
            scrollDY: this.scroll.dy,
            pointerLocked: this.pointer.locked,
            inputContext: this.currentContext,
            sharedCursorNDC: this.sharedCursorNDC,
        };
    }
}
