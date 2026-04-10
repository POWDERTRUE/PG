import * as THREE from 'three';
import { gsap } from 'gsap';
// ── DEV-ONLY: TrackballControls es una prótesis de inspección técnica (godControls).
// No forma parte de la experiencia de usuario ni del CameraFSM.
// Tree-shaking lo elimina en producción (import.meta.env.PROD = true → bloque muerto).
// REGLA 6: no usarlo como sistema de navegación real.
let TrackballControls = null;
if (import.meta.env?.DEV !== false) {
    // Dynamic import — solo carga en dev, ignorado por el bundler en producción
    import('three/examples/jsm/controls/TrackballControls.js')
        .then(m => { TrackballControls = m.TrackballControls; })
        .catch(() => { /* silent — no afecta al runtime de producción */ });
}
import { Registry } from '../core/ServiceRegistry.js';

import { CameraStateMachine, CAMERA_STATE } from './CameraStateMachine.js';
import { FreeFlightState }     from './states/FreeFlightState.js';
import { OrbitState }          from './states/OrbitState.js';
import { FocusState }          from './states/FocusState.js';
import { WarpState }           from './states/WarpState.js';
import { OrbitalDescentState } from './states/OrbitalDescentState.js';
import { CockpitState }        from './states/CockpitState.js';
import { ShipRigSystem }       from './ShipRigSystem.js';
import { ShipController }      from './ShipController.js';
import { PlanetSurfacePatch }  from '../galaxy/PlanetSurfacePatch.js';

export const CAMERA_STATES = Object.freeze({
    FREE_FLIGHT: CAMERA_STATE.FREE_FLIGHT,
    MOUSE_UI: 'MOUSE_UI',
    WARP: CAMERA_STATE.WARP,
    WARPING: CAMERA_STATE.WARP,
    FOCUS: CAMERA_STATE.FOCUS,
    WORLD_FOCUS: 'WORLD_FOCUS',
    ORBIT: CAMERA_STATE.ORBIT,
    STELARYI: 'STELARYI',
    SOLAR_SYSTEM: 'SOLAR_SYSTEM',
    FIRST_PERSON_WALK: 'FIRST_PERSON_WALK',
    MAP_MODE: 'MAP_MODE',
    ORBITAL_DESCENT: CAMERA_STATE.ORBITAL_DESCENT,
    COCKPIT: CAMERA_STATE.COCKPIT,
});

export const CAMERA_MODES = CAMERA_STATES;

export const NAV_CONTEXT_STATES = Object.freeze({
    NONE: 'NONE',
    WORLD_FOCUS: 'WORLD_FOCUS',
    MAP_MODE: 'MAP_MODE',
    MOUSE_UI: 'MOUSE_UI',
});

const FSM_STATES = new Set([
    CAMERA_STATE.FREE_FLIGHT,
    CAMERA_STATE.ORBIT,
    CAMERA_STATE.FOCUS,
    CAMERA_STATE.WARP,
    CAMERA_STATE.ORBITAL_DESCENT,
    CAMERA_STATE.COCKPIT,
]);

const NAV_REQUEST_SIGNAL_TO_ACTION = Object.freeze({
    'PG:NAV:REQUEST_MAP_CONTEXT_TOGGLE': 'TOGGLE_MAP_CONTEXT',
    'PG:NAV:REQUEST_ORBITAL_DESCENT': 'TRIGGER_LANDING',
    'PG:NAV:REQUEST_COCKPIT_TOGGLE': 'TOGGLE_COCKPIT_MODE',
    'PG:NAV:REQUEST_CLEAR_SELECTION': 'CLEAR_SELECTION',
    'PG:NAV:REQUEST_PRECISION_TRAVEL': 'PRECISION_TRAVEL',
});

export class UniverseNavigationSystem {
    constructor(camera, scene, domElement = null) {
        this.camera = camera;
        this.scene = scene;
        this.domElement = domElement || document.getElementById('pg-renderer') || document.body;
        this.renderPhase = 'navigation';
        this.runtimeState = Registry.tryGet('RuntimeState');
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.pointerPresentation = Registry.tryGet('PointerPresentationController');

        this.defaultFov = camera.fov;
        this.targetFov = this.defaultFov;
        this.focusFov = 110;
        this.warpKickFov = 140;
        this.baseOrbitDistance = 40;
        this.damping = 5.0;

        this.focusTarget = null;
        this.focusDistance = this.baseOrbitDistance;
        this.focusOffsetDirection = new THREE.Vector3(1, 0.4, 1).normalize();
        this.focusOrbitRotation = new THREE.Quaternion();
        this.contextState = NAV_CONTEXT_STATES.NONE;
        this.presentationState = CAMERA_STATES.FREE_FLIGHT;
        
        this.historyStack = [];
        this.trackballUp = new THREE.Vector3(0, 1, 0);
        
        this.isOrbitDragging = false;
        this.orbitDeltaX = 0;
        this.orbitDeltaY = 0;

        // Solar system mode: manages linear row and reorder control.
        this.solarSystemMode = 'creation';
        this.solarSystemAnchor = null;
        this.solarSystemMasses = [];
        this.solarSystemSelectedIndex = -1;
        this.solarSystemSelected = null;
        this.solarSystemOriginalTransforms = new Map();
        // REGLA 8: buffer pre-alocado para _layoutSolarSystem — cero GC en el loop de layout.
        this._layoutWorldTarget = new THREE.Vector3();

        this.freeFlightSpeed = 220;
        this.acceleration = 20;
        this.drag = 14;
        this.lookSensitivity = 0.0018;

        // Adaptive viewport tuning
        this.minFov = 45;
        this.maxFov = 84;
        this.portraitFov = 58;
        this.landscapeFov = 65;

        this.shakeActive = false;
        this.wallpaperTween = null;
        this.wallpaperProgress = { value: 0 };
        this.wallpaperStartPosition = new THREE.Vector3();
        this.wallpaperStartQuaternion = new THREE.Quaternion();
        this.wallpaperTargetPosition = new THREE.Vector3();
        this.wallpaperLookTarget = new THREE.Vector3(0, 0, 0);

        // ── Resolve the shared CameraRig instead of creating a duplicate Object3D ──
        // CameraRig is the canonical write point; CameraSystem.sync() copies it
        // to THREE.Camera each render frame. All nav code writes to this.cameraRig.
        this.cameraRig = Registry.get('cameraRig');
        if (!this.cameraRig) {
            // Graceful fallback if boot order slips — create a plain rig so nothing crashes
            console.warn('[NavSystem] CameraRig not yet in Registry — using local fallback.');
            this.cameraRig = new THREE.Object3D();
            this.cameraRig.name = 'CameraRig_FALLBACK';
        }
        this.cameraRig.rotation.order = 'YXZ';
        this.cameraRig.position.copy(camera.position);
        this.cameraRig.quaternion.copy(camera.quaternion);

        // Shake / mount hierarchy hangs off the shared rig
        this.cameraShakeRig = new THREE.Object3D();
        this.cameraShakeRig.name = 'CameraShakeRig';
        this.cameraMount = new THREE.Object3D();
        this.cameraMount.name = 'CameraMount';
        this.cameraRig.add(this.cameraShakeRig);
        this.cameraShakeRig.add(this.cameraMount);
        // Do NOT scene.add(this.cameraRig) — kernel already placed it in the scene

        const rigEuler = new THREE.Euler().setFromQuaternion(this.cameraRig.quaternion, 'YXZ');
        this.pitch = rigEuler.x;
        this.yaw = rigEuler.y;

        this.velocity = new THREE.Vector3();
        this.inputVector = new THREE.Vector3();
        this.targetVelocity = new THREE.Vector3();
        this.autoBrakeActive = false;
        this.autoBrakeDamping = 0.85;
        this.alignBowActive = false;
        this.frameDisplacement = new THREE.Vector3();
        this.worldUp = new THREE.Vector3(0, 1, 0);
        this.localXAxis = new THREE.Vector3(1, 0, 0);
        this.localYAxis = new THREE.Vector3(0, 1, 0);

        this.worldTarget = new THREE.Vector3();
        this.desiredRigPosition = new THREE.Vector3();
        this.warpPosition = new THREE.Vector3();
        this.followPosition = new THREE.Vector3();
        this.followQuaternion = new THREE.Quaternion();
        this.targetQuaternion = new THREE.Quaternion();
        this.warpQuaternion = new THREE.Quaternion();
        this.wallpaperQuaternion = new THREE.Quaternion();
        this._lookHelperCamera = new THREE.PerspectiveCamera();
        this.warpStartPosition = new THREE.Vector3();
        this.warpStartQuaternion = new THREE.Quaternion();
        this.lookMatrix = new THREE.Matrix4();
        this.objectScale = new THREE.Vector3();
        this.bounds = new THREE.Box3();
        this.boundsSize = new THREE.Vector3();
        this.lookYawQuaternion = new THREE.Quaternion();
        this.lookPitchQuaternion = new THREE.Quaternion();
        this.warpProgress = { value: 0 };
        this.warpTween = null;
        this.warpDuration = 2.0;
        this.stelaryiFov = 38;
        this.stelaryiOrbitLevels = 3;
        this.stelaryiAnchor = null;
        this.stelaryiPlanets = [];
        this.stelaryiSystemCenter = new THREE.Vector3();
        this.stelaryiTargetPosition = new THREE.Vector3();
        this.stelaryiRigPosition = new THREE.Vector3();
        this.stelaryiLookTarget = new THREE.Vector3();
        this.stelaryiViewRadial = new THREE.Vector3();
        this.stelaryiViewTangent = new THREE.Vector3();
        this.stelaryiViewNormal = new THREE.Vector3();
        this.stelaryiPlanetPosition = new THREE.Vector3();
        this.stelaryiSnapshot = {
            active: false,
            anchorLabel: 'Sin masa',
            anchorState: 'Selecciona una masa para organizar el universo.',
            levels: [[], [], []]
        };

        // ── 4-State Camera FSM ───────────────────────────────────
        // States read from InputStateSystem, write exclusively to CameraRig
        this.fsm = new CameraStateMachine(this);
        this.fsm.registerState(CAMERA_STATE.FREE_FLIGHT, new FreeFlightState());
        this.fsm.registerState(CAMERA_STATE.ORBIT,       new OrbitState());
        this.fsm.registerState(CAMERA_STATE.FOCUS,       new FocusState());
        this.fsm.registerState(CAMERA_STATE.WARP,        new WarpState());
        this.fsm.registerState(CAMERA_STATE.ORBITAL_DESCENT, new OrbitalDescentState());
        this.fsm.registerState(CAMERA_STATE.COCKPIT,     new CockpitState());

        // ── ShipRigSystem (physics engine for cockpit mode) ───────────────
        this._shipRigSystem = new ShipRigSystem();
        // Use this.scene (constructor argument) — NOT Registry.get('scene') which throws on boot
        this._shipRigSystem._scene = this.scene ?? null;
        Registry.register('shipRigSystem', this._shipRigSystem);


        // Surface patch management
        this._surfacePatch = null;
        this._descentTarget = null;

        this.fsm.to(CAMERA_STATE.FREE_FLIGHT);

        // ── backward-compat shim: expose CAMERA_STATE as CAMERA_STATES ──
        this.CAMERA_STATES = CAMERA_STATE;

        // ── Planetary Landing events ─────────────────────────────────────
        window.addEventListener('LANDING_COMPLETE', () => this._onLandingComplete());

        this.onWheel = this.onWheel.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.onInputCommand = this.onInputCommand.bind(this);
        this._runtimeSignalRemovers = [];

        window.addEventListener('wheel', this.onWheel, { passive: true });
        document.addEventListener('pointerlockchange', this.onPointerLockChange, false);
        this._runtimeSignalRemovers.push(this._subscribeRuntimeSignal('PG:INPUT_COMMAND', this.onInputCommand));
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:NAV:ENGAGE_AUTO_BRAKE', () => {
                this.autoBrakeActive = true;
            })
        );
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:NAV:DISENGAGE_AUTO_BRAKE', () => {
                this.autoBrakeActive = false;
            })
        );
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:INPUT:IMMERSIVE_ALIGN_BOW_START', () => {
                this.alignBowActive = true;
            })
        );
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:INPUT:IMMERSIVE_ALIGN_BOW_END', () => {
                this.alignBowActive = false;
            })
        );
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:INPUT:GESTURE_LONG_PRESS', (payload) => {
                const detail = payload?.detail || payload || {};
                if (detail.context === 'HELM' && (detail.button ?? 0) === 0) {
                    this.alignBowActive = true;
                }
            })
        );
        this._runtimeSignalRemovers.push(
            this._subscribeRuntimeSignal('PG:INPUT:GESTURE_UP', (payload) => {
                const detail = payload?.detail || payload || {};
                if (detail.context === 'HELM' && detail.longPress && (detail.button ?? 0) === 0) {
                    this.alignBowActive = false;
                }
            })
        );
        for (const [signalName, action] of Object.entries(NAV_REQUEST_SIGNAL_TO_ACTION)) {
            this._runtimeSignalRemovers.push(
                this._subscribeRuntimeSignal(signalName, (event) => {
                    const detail = event?.detail || event || {};
                    this._handleNavigationCommand(action, detail);
                })
            );
        }

        this.domElement.addEventListener('click', () => {
            if (this._isGamePaused()) return;
            if (this.state === CAMERA_STATES.STELARYI) {
                this.resumeFreeFlight({ requestPointerLock: false });
            } else if (this.state === CAMERA_STATES.FIRST_PERSON_WALK && document.pointerLockElement !== this.domElement) {
                // El único modo que aún necesita Pointer Lock es la Primera Persona Clásica
                this.requestPointerLock();
            }
        }, { passive: true });

        this._initGodModeControls();
        
        // FASE 4: Unification Navigation Pipeline
        const events = Registry.tryGet('events');
        if (events) {
            events.on('PLANET_SELECTED', ({ object }) => this.setMode(CAMERA_STATES.WARPING, { targetObject: object }));
            events.on('SATELLITE_SELECTED', ({ object }) => this.focusObject(object));
        }
    }

    _initGodModeControls() {
        // ── DEV-ONLY: godControls (TrackballControls) ─────────────────────────────
        // Herramienta de inspección técnica EXCLUSIVA de entornos de desarrollo.
        // enabled = false por defecto — nunca activo en gameplay normal.
        // REGLA 6: no reemplaza al CameraFSM. Se purga en builds de producción.
        this._dynamicTargetPos = new THREE.Vector3();
        this._previousTargetPos = new THREE.Vector3();
        this.godControls = null;

        if (import.meta.env?.DEV === false) return; // producción: salir sin inicializar

        // TrackballControls carga asíncronamente en dev (ver import dinámico en el módulo)
        const tryInit = () => {
            if (!TrackballControls) {
                // Reintentar hasta que el dynamic import resuelva
                setTimeout(tryInit, 200);
                return;
            }
            this.godControls = new TrackballControls(this.camera, this.domElement);
            this.godControls.rotateSpeed = 2.5;
            this.godControls.zoomSpeed = 1.2;
            this.godControls.noZoom = false;
            this.godControls.noPan = true;
            this.godControls.staticMoving = false;
            this.godControls.dynamicDampingFactor = 0.08;
            this.godControls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE
            };
            this.godControls.enabled = false; // siempre deshabilitado hasta intervención dev
        };
        tryInit();
    }

    setMode(nextState, options = {}) {
        const requestedState = nextState;
        const requestedContext =
            requestedState === CAMERA_STATES.WORLD_FOCUS ? NAV_CONTEXT_STATES.WORLD_FOCUS :
            requestedState === CAMERA_STATES.MAP_MODE ? NAV_CONTEXT_STATES.MAP_MODE :
            requestedState === CAMERA_STATES.MOUSE_UI ? NAV_CONTEXT_STATES.MOUSE_UI :
            NAV_CONTEXT_STATES.NONE;
        const fsmState = requestedState === CAMERA_STATES.MAP_MODE
            ? CAMERA_STATE.FOCUS
            : this._resolveFSMState(requestedState);
        const effectiveNextState = fsmState ?? requestedState;
        const presentationState =
            requestedContext === NAV_CONTEXT_STATES.MAP_MODE ? CAMERA_STATES.MAP_MODE :
            requestedContext === NAV_CONTEXT_STATES.WORLD_FOCUS ? CAMERA_STATES.WORLD_FOCUS :
            requestedContext === NAV_CONTEXT_STATES.MOUSE_UI ? CAMERA_STATES.MOUSE_UI :
            effectiveNextState;
        const {
            clearFocus = requestedContext !== NAV_CONTEXT_STATES.WORLD_FOCUS &&
                requestedContext !== NAV_CONTEXT_STATES.MAP_MODE &&
                effectiveNextState !== CAMERA_STATES.WARPING &&
                effectiveNextState !== CAMERA_STATES.STELARYI,
            requestPointerLock = false,
            force = false
        } = options;

        if (presentationState !== CAMERA_STATES.MOUSE_UI) {
            this.clearPointerIntent('navigation-mouse-ui');
        }

        if (this.state === CAMERA_STATES.WARPING && effectiveNextState !== CAMERA_STATES.WARPING && !force) {
            return false;
        }

        if (clearFocus) {
            this.focusTarget = null;
            this._setContextMode(NAV_CONTEXT_STATES.NONE);
        } else {
            this._setContextMode(requestedContext);
        }

        // Enrutar al FSM para todos los estados canónicos
        if (this.fsm && fsmState) {
             // Limpieza ruda de animaciones GSAP heredadas sobre el rig para evitar terremotos
             if (typeof gsap !== 'undefined') {
                 gsap.killTweensOf(this.cameraRig.position);
                 gsap.killTweensOf(this.cameraRig.quaternion);
             }
             this.fsm.changeState(
                fsmState,
                this._buildFSMTransitionData(fsmState, options),
                force
            );
        } else {
             // Fallback al sistema legado
             this.state = effectiveNextState;
        }
        this._applyState(presentationState);

        if (effectiveNextState === CAMERA_STATES.FREE_FLIGHT) {
            this._killWallpaperDrift();
            this._killMotionTweens();
            this._stopWarpShake();
            this._syncRigEulerFromQuaternion();
            this._setFov(this.defaultFov, 0.45, 'power2.out');
            if (requestPointerLock) {
                this.requestPointerLock();
            }
            return true;
        }

        if (presentationState === CAMERA_STATES.MOUSE_UI) {
            this.velocity.set(0, 0, 0);
            this._killWallpaperDrift();
            this._killMotionTweens();
            this._stopWarpShake();
            if (!this._isLoginActive()) {
                this._setFov(this.defaultFov, 0.35, 'power2.out');
            }
            this._releasePointerLock('navigation-mouse-ui');
            return true;
        }

        if (effectiveNextState === CAMERA_STATES.WARPING) {
            this.velocity.set(0, 0, 0);
            this._killWallpaperDrift();
            if (!options.keepPointerLock) {
                this._releasePointerLock('navigation-warp');
            }
            return true;
        }

        if (effectiveNextState === CAMERA_STATES.STELARYI) {
            this.velocity.set(0, 0, 0);
            this._killWallpaperDrift();
            this._releasePointerLock('navigation-stelaryi');
            return true;
        }

        if (this.isFocusContextActive()) {
            this.velocity.set(0, 0, 0);
            this._releasePointerLock('navigation-focus-context');
            if (this.focusTarget && this.godControls) {
                this.focusTarget.getWorldPosition(this._dynamicTargetPos);
                
                // Initialize offset context
                this.godControls.target.copy(this._dynamicTargetPos);
                if (!this._previousTargetPos) this._previousTargetPos = new THREE.Vector3();
                this._previousTargetPos.copy(this._dynamicTargetPos);
                
                // Muro físico anti-colisión: la cámara no podrá atravesar el mundo
                let collisionRadius = 1;
                if (this.focusTarget.geometry) {
                    if (!this.focusTarget.geometry.boundingSphere) this.focusTarget.geometry.computeBoundingSphere();
                    collisionRadius = this.focusTarget.geometry.boundingSphere.radius;
                }
                const worldScale = Math.max(this.focusTarget.scale.x, this.focusTarget.scale.y, this.focusTarget.scale.z);
                this.godControls.minDistance = collisionRadius * worldScale * 1.05; // 5% de margen sobre el nivel del suelo

                this.godControls.enabled = true;
            }
        }

        if (!this.isFocusContextActive() && this.godControls) {
            this.godControls.enabled = false;
        }

        return true;
    }

    _resolveFSMState(state) {
        if (!state) return null;

        const map = {
            FREE_FLIGHT: CAMERA_STATE.FREE_FLIGHT,
            ORBIT: CAMERA_STATE.ORBIT,
            FOCUS: CAMERA_STATE.FOCUS,
            WORLD_FOCUS: CAMERA_STATE.FOCUS,
            WARP: CAMERA_STATE.WARP,
            WARPING: CAMERA_STATE.WARP,
            ORBITAL_DESCENT: CAMERA_STATE.ORBITAL_DESCENT,
            COCKPIT: CAMERA_STATE.COCKPIT,
        };

        return map[state] ?? (FSM_STATES.has(state) ? state : null);
    }

    _buildFSMTransitionData(fsmState, options = {}) {
        const data = { ...options };

        if ((fsmState === CAMERA_STATE.WARP || fsmState === CAMERA_STATE.FOCUS || fsmState === CAMERA_STATE.ORBIT) && !data.targetObject) {
            data.targetObject = this.focusTarget ?? null;
        }

        if ((fsmState === CAMERA_STATE.FOCUS || fsmState === CAMERA_STATE.ORBIT) && data.orbitDistance == null) {
            data.orbitDistance = this.focusDistance;
        }

        return data;
    }

    _getRuntimeState() {
        this.runtimeState = this.runtimeState || Registry.tryGet('RuntimeState');
        return this.runtimeState;
    }

    _getRuntimeSignals() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        return this.runtimeSignals;
    }

    _getPointerPresentationController() {
        this.pointerPresentation =
            this.pointerPresentation ||
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        return this.pointerPresentation;
    }

    upsertPointerIntent(source, intent) {
        return this._getPointerPresentationController()?.upsertIntent?.(source, intent) ?? null;
    }

    clearPointerIntent(source) {
        return this._getPointerPresentationController()?.clearIntent?.(source) ?? null;
    }

    _isLoginActive() {
        return this._getRuntimeState()?.isLoginActive?.() ?? !!window.__loginActive;
    }

    _isGamePaused() {
        return this._getRuntimeState()?.isGamePaused?.() ?? !!window.__gamePaused;
    }

    _emitRuntimeSignal(name, detail) {
        const runtimeSignals = this._getRuntimeSignals();
        if (runtimeSignals?.emit) {
            runtimeSignals.emit(name, detail);
            return;
        }
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }

    _subscribeRuntimeSignal(name, handler) {
        const runtimeSignals = this._getRuntimeSignals();
        if (runtimeSignals?.on) {
            return runtimeSignals.on(name, handler);
        }
        window.addEventListener(name, handler);
        return () => window.removeEventListener(name, handler);
    }

    getCameraMode() {
        const presentation = this.state ?? null;
        if (presentation === CAMERA_STATES.WORLD_FOCUS || presentation === CAMERA_STATES.MAP_MODE) {
            return CAMERA_STATE.FOCUS;
        }
        if (presentation && !FSM_STATES.has(presentation)) {
            return presentation;
        }
        return this.fsm?.currentStateId ?? presentation ?? CAMERA_STATE.FREE_FLIGHT;
    }

    getContextMode() {
        return this.contextState ?? NAV_CONTEXT_STATES.NONE;
    }

    getPresentationMode() {
        return this.presentationState ?? this.getCameraMode();
    }

    isAutoBrakeActive() {
        return this.autoBrakeActive;
    }

    isBowAlignmentActive() {
        return this.alignBowActive;
    }

    isFocusContextActive() {
        return this.getCameraMode() === CAMERA_STATE.FOCUS && this.getContextMode() === NAV_CONTEXT_STATES.WORLD_FOCUS;
    }

    isMapContextActive() {
        return this.getContextMode() === NAV_CONTEXT_STATES.MAP_MODE;
    }

    _setContextMode(nextContext = NAV_CONTEXT_STATES.NONE) {
        this.contextState = nextContext || NAV_CONTEXT_STATES.NONE;
        if (this.contextState === NAV_CONTEXT_STATES.MAP_MODE) {
            this.presentationState = CAMERA_STATES.MAP_MODE;
            return;
        }
        if (this.contextState === NAV_CONTEXT_STATES.WORLD_FOCUS) {
            this.presentationState = CAMERA_STATES.WORLD_FOCUS;
            return;
        }
        if (this.contextState === NAV_CONTEXT_STATES.MOUSE_UI) {
            this.presentationState = CAMERA_STATES.MOUSE_UI;
            return;
        }
        this.presentationState = this.getCameraMode();
    }

    _releasePointerLock(reason = 'navigation-state-change') {
        return this._getPointerPresentationController()?.releasePointerLock?.({ reason }) ?? null;
    }

    requestPointerLock(options = {}) {
        const normalized = typeof options === 'string'
            ? { source: options }
            : options;
        const {
            source = 'navigation-system',
            preferUnadjustedMovement = true,
        } = normalized;

        if (this._isLoginActive() || this._isGamePaused()) {
            return Promise.resolve({ ok: false, reason: 'blocked' });
        }

        const pointerPresentation = this._getPointerPresentationController();
        if (pointerPresentation?.requestPointerLock) {
            return pointerPresentation.requestPointerLock({
                source,
                preferUnadjustedMovement,
            });
        }

        if (!this.domElement.requestPointerLock) {
            return Promise.resolve({ ok: false, reason: 'unsupported' });
        }

        try {
            const result = preferUnadjustedMovement
                ? this.domElement.requestPointerLock({ unadjustedMovement: true })
                : this.domElement.requestPointerLock();
            if (result && typeof result.then === 'function') {
                result.catch((err) => {
                    if (err instanceof DOMException && err.name === 'NotSupportedError' && preferUnadjustedMovement) {
                        this.requestPointerLock({ source, preferUnadjustedMovement: false });
                        return;
                    }
                    if (err instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(err.name)) {
                        console.info('[UniverseNavigationSystem] Pointer lock deferred until the next canvas click.');
                        return;
                    }
                    console.warn('[UniverseNavigationSystem] Pointer lock request failed:', err);
                });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'NotSupportedError' && preferUnadjustedMovement) {
                return this.requestPointerLock({ source, preferUnadjustedMovement: false });
            }
            if (err instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(err.name)) {
                console.info('[UniverseNavigationSystem] Pointer lock deferred until the next canvas click.');
                return Promise.resolve({ ok: false, reason: 'deferred' });
            }
            console.warn('[UniverseNavigationSystem] Pointer lock request threw:', err);
        }

        return Promise.resolve({ ok: true, reason: 'requested' });
    }

    enterMouseUIMode() {
        this.setMode(CAMERA_STATES.MOUSE_UI);
    }

    resumeFreeFlight(options = {}) {
        this.setMode(CAMERA_STATES.FREE_FLIGHT, {
            requestPointerLock: options.requestPointerLock !== false
        });
    }

    onInputCommand(event) {
        const detail = event?.detail || event || {};
        if (!detail?.action) return;
        if (detail.signal && NAV_REQUEST_SIGNAL_TO_ACTION[detail.signal]) {
            return;
        }

        this._handleNavigationCommand(detail.action, detail);
    }

    _handleNavigationCommand(action, detail = {}) {
        switch (action) {
        case 'TOGGLE_MAP_CONTEXT':
            if (this.isMapContextActive()) {
                this.exitMapMode();
            } else if (this.isFocusContextActive()) {
                this.enterMapMode();
            }
            break;
        case 'TRIGGER_LANDING':
            if (this.isFocusContextActive() && this.focusTarget) {
                this.beginOrbitalDescent(this.focusTarget);
            }
            break;
        case 'TOGGLE_COCKPIT_MODE':
            if (this.state === CAMERA_STATES.COCKPIT) {
                this._exitCockpitMode();
            } else if (this.state !== CAMERA_STATES.WARPING) {
                this.enterCockpitMode();
            }
            break;
        case 'CLEAR_SELECTION':
            this.clearMassSelection({ source: detail.source || 'input-command' });
            break;
        case 'PRECISION_TRAVEL':
            this.precisionTravelToAimPoint({
                source: detail.source || 'input-command',
                targetId: detail.targetId ?? null,
            });
            break;
        default:
            break;
        }
    }

    precisionTravelToAimPoint({ source = 'navigation-precision-travel', targetId = null } = {}) {
        if (this.state === CAMERA_STATES.WARPING || this._isLoginActive() || this._isGamePaused()) {
            return false;
        }

        const explicitTarget = this._resolveTargetObjectById(targetId);
        if (explicitTarget) {
            this._emitRuntimeSignal('PG:HUD_TRANSMISSION', {
                sourceLabel: 'Navegacion',
                stateLabel: 'Objetivo tactico',
                message: `Aproximacion warp solicitada hacia ${explicitTarget.name || 'masa objetivo'}.`,
            });
            this.focusObject(explicitTarget);
            return true;
        }

        const raycastSelectionSystem =
            Registry.tryGet('RaycastSelectionSystem') ??
            window.engine?.raycastSelectionSystem ??
            null;
        const target = raycastSelectionSystem?.getNavigationTarget?.({
            fallbackDistance: Math.max(180, Math.min(480, this.cameraRig.position.length() * 0.04 || 240)),
        });

        if (!target?.point) {
            this._emitRuntimeSignal('PG:HUD_TRANSMISSION', {
                sourceLabel: 'Navegacion',
                stateLabel: 'Vector vacio',
                message: 'No se pudo fijar un punto de viaje preciso.',
            });
            return false;
        }

        const distanceToPoint = this.cameraRig.position.distanceTo(target.point);
        const duration = THREE.MathUtils.clamp(distanceToPoint / 260, 0.32, 1.45);
        const distanceOffset = target.fromFallback
            ? THREE.MathUtils.clamp(distanceToPoint * 0.16, 10, 42)
            : THREE.MathUtils.clamp(distanceToPoint * 0.08, 6, 30);

        this.clearMassSelection({ source: `${source}:clear-selection` });
        this._emitRuntimeSignal('PG:HUD_TRANSMISSION', {
            sourceLabel: 'Navegacion',
            stateLabel: 'Vector fijado',
            message: 'Sujecion precisa confirmada. Ejecutando salto de aproximacion.',
        });

        return this.setMode(CAMERA_STATES.WARPING, {
            force: true,
            clearFocus: true,
            keepPointerLock: true,
            targetPoint: target.point.clone(),
            targetNormal: target.normal?.clone?.() ?? null,
            targetObject: target.object ?? null,
            onCompleteState: CAMERA_STATE.FREE_FLIGHT,
            distanceOffset,
            duration,
        });
    }

    _resolveTargetObjectById(targetId) {
        if (!targetId) {
            return null;
        }
        const celestialRegistry = Registry.tryGet('CelestialRegistry') ?? Registry.tryGet('celestialRegistry');
        return (
            celestialRegistry?.getById?.(targetId) ??
            this.scene?.getObjectByProperty?.('uuid', targetId) ??
            null
        );
    }

    toggleStelaryi(preferredTarget = null) {
        if (this.state === CAMERA_STATES.WARPING) {
            return false;
        }

        if (this.state === CAMERA_STATES.STELARYI) {
            if (this.focusTarget) {
                this.setMode(CAMERA_STATES.WORLD_FOCUS, {
                    clearFocus: false,
                    force: true
                });
                this._setFov(this.defaultFov, 0.6, 'power2.out');
                return true;
            }

            this.enterMouseUIMode();
            return true;
        }

        const anchor = this._resolveStelaryiTarget(preferredTarget || this.focusTarget);
        if (!anchor) {
            return false;
        }

        this.focusTarget = anchor;
        this.stelaryiAnchor = anchor;
        this._collectStelaryiPlanets();
        this._updateStelaryiSolution();
        this._updateStelaryiSnapshot();

        this.setMode(CAMERA_STATES.STELARYI, {
            clearFocus: false,
            force: true
        });

        this._killMotionTweens();
        this._stopWarpShake();
        this._syncRigEulerFromQuaternion();

        gsap.to(this.cameraRig.position, {
            x: this.stelaryiRigPosition.x,
            y: this.stelaryiRigPosition.y,
            z: this.stelaryiRigPosition.z,
            duration: 1.1,
            ease: 'expo.out'
        });

        gsap.to(this.cameraRig.quaternion, {
            x: this.targetQuaternion.x,
            y: this.targetQuaternion.y,
            z: this.targetQuaternion.z,
            w: this.targetQuaternion.w,
            duration: 1.1,
            ease: 'expo.out',
            onUpdate: () => this.cameraRig.quaternion.normalize()
        });

        this._setFov(this.stelaryiFov, 0.85, 'power3.out');
        return true;
    }


    flyToTarget(targetObject, distanceOffset = 30, completionEventName = null) {
        if (this.state === CAMERA_STATES.WARPING || !targetObject) return;
        this.setMode(CAMERA_STATES.WARPING, { force: true });

        const targetPos = new THREE.Vector3();
        targetObject.getWorldPosition(targetPos);

        const offset = new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(distanceOffset);
        const finalPos = targetPos.clone().add(offset);

        gsap.to(this.cameraRig.position, {
            x: finalPos.x,
            y: finalPos.y,
            z: finalPos.z,
            duration: 1.8,
            ease: 'power3.inOut'
        });

        const lookMatrix = new THREE.Matrix4().lookAt(finalPos, targetPos, this.cameraRig.up);
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

        gsap.to(this.cameraRig.quaternion, {
            x: targetQuat.x,
            y: targetQuat.y,
            z: targetQuat.z,
            w: targetQuat.w,
            duration: 1.8,
            ease: 'power3.inOut',
            onComplete: () => {
                this.focusTarget = targetObject;
                this.setMode(CAMERA_STATES.WORLD_FOCUS, { clearFocus: false, force: true });

                if (completionEventName) {
                    window.dispatchEvent(new CustomEvent(completionEventName, { detail: { target: targetObject } }));
                }
            }
        });
    }

    // ── Orbital Descent ──────────────────────────────────────────────────────

    /**
     * Begin a cinematic orbital descent toward a planet.
     * @param {THREE.Object3D} planetMesh
     */
    beginOrbitalDescent(planetMesh) {
        if (this.state === CAMERA_STATES.ORBITAL_DESCENT) return;
        if (!planetMesh) {
            console.warn('[UniverseNavigationSystem] beginOrbitalDescent: no planet target');
            return;
        }

        this._descentTarget = planetMesh;

        // Spawn surface terrain patch
        const planetClass = planetMesh.userData?.planetClass ?? 'default';
        this._surfacePatch = new PlanetSurfacePatch(planetMesh, planetClass);
        this._surfacePatch.attach();

        // Show descent HUD via WindowDOMSystem
        const windowSystem = Registry.tryGet('windowSystem') ?? Registry.tryGet('WindowDOMSystem') ?? window.engine?.windowSystem;
        if (windowSystem?.showDescentHUD) {
            const name = planetMesh.userData?.appName ?? planetMesh.userData?.label ?? planetMesh.name ?? 'Planeta';
            windowSystem.showDescentHUD(name, planetClass);
        }

        console.log(`[UniverseNavigationSystem] Orbital descent initiated → ${planetMesh.name ?? 'planet'}`);

        this.fsm.to(CAMERA_STATE.ORBITAL_DESCENT, { targetObject: planetMesh });
    }

    _abortOrbitalDescent() {
        console.log('[UniverseNavigationSystem] Orbital descent aborted by user.');
        this._cleanupDescent();

        // Return to FOCUS on the target, or FREE_FLIGHT if none
        if (this._descentTarget) {
            this.focusTarget = this._descentTarget;
            this._descentTarget = null;
            this.fsm.to(CAMERA_STATE.FOCUS, { targetObject: this.focusTarget, force: true });
        } else {
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT, { force: true });
        }
    }

    _onLandingComplete() {
        console.log('[UniverseNavigationSystem] Landing complete — cleaning up descent systems.');
        this._cleanupDescent();
    }

    _cleanupDescent() {
        // Remove terrain patch
        if (this._surfacePatch) {
            this._surfacePatch.detach();
            this._surfacePatch = null;
        }

        // Hide descent HUD
        const windowSystem = Registry.tryGet('windowSystem') ?? Registry.tryGet('WindowDOMSystem') ?? window.engine?.windowSystem;
        if (windowSystem?.hideDescentHUD) {
            windowSystem.hideDescentHUD();
        }
    }

    // ── Cockpit Mode ──────────────────────────────────────────────────────────

    /**
     * Enter first-person cockpit flight mode.
     * Positions the ShipRig at the current camera position and activates physics.
     */
    enterCockpitMode() {
        if (this.state === CAMERA_STATES.COCKPIT) return;
        console.log('[UniverseNavigationSystem] → COCKPIT mode');
        this.setMode(CAMERA_STATES.COCKPIT, {
            clearFocus: true,
            force: true,
        });
    }

    /** Exit cockpit mode and return to FREE_FLIGHT. Called by CockpitState.exit() or ESC. */
    _exitCockpitMode() {
        if (this.state !== CAMERA_STATES.COCKPIT) return;
        this.setMode(CAMERA_STATES.FREE_FLIGHT, {
            requestPointerLock: false,
            force: true,
        });
    }

    /**
     * Read ShipRigSystem telemetry and push it to the cockpit HUD.
     * Called every frame while in COCKPIT state.
     */
    _tickCockpitHUD() {
        const windowSystem = Registry.tryGet('windowSystem') ?? Registry.tryGet('WindowDOMSystem') ?? window.engine?.windowSystem;
        if (!windowSystem?.updateCockpitHUD) return;
        const srs = this._shipRigSystem;
        if (!srs?.active) return;

        windowSystem.updateCockpitHUD({
            speed:   srs.speed,
            heading: ShipController.headingDeg(srs.rig.quaternion),
            pitch:   ShipController.pitchDeg(srs.rig.quaternion),
            roll:    ShipController.rollDeg(srs.rig.quaternion),
        });
    }


    pushCurrentState() {
        if (this.state !== CAMERA_STATES.WARPING) {
            this.historyStack.push({
                state: this.state,
                position: this.cameraRig.position.clone(),
                quaternion: this.cameraRig.quaternion.clone(),
                focusTarget: this.focusTarget,
                fov: this.targetFov
            });
            console.log(`[UniverseNavigationSystem] State saved. Stack size: ${this.historyStack.length}`);
        }
    }

    popState() {
        if (this.historyStack.length === 0 || this.state === CAMERA_STATES.WARPING) return;
        
        const previous = this.historyStack.pop();
        this.focusTarget = null; // Clear to prevent update hooks from interfering
        
        this.setMode(CAMERA_STATES.WARPING, { force: true });
        this._killMotionTweens();
        
        this.warpStartPosition.copy(this.cameraRig.position);
        this.warpStartQuaternion.copy(this.cameraRig.quaternion);
        
        this.desiredRigPosition.copy(previous.position);
        this.warpQuaternion.copy(previous.quaternion);

        this.warpProgress.value = 0;
        
        if (this.warpTween) this.warpTween.kill();
        this.warpTween = gsap.to(this.warpProgress, {
            value: 1,
            duration: 1.5,
            ease: 'power3.inOut',
            onComplete: () => {
                this.warpTween = null;
                this.focusTarget = previous.focusTarget;
                this.targetFov = previous.fov || this.defaultFov;
                this.setMode(previous.state, { force: true });
                console.log(`[UniverseNavigationSystem] Restored to ${previous.state}`);
            }
        });
    }


    toggleSolarSystem(preferredTarget = null) {
        if (this.state === CAMERA_STATES.WARPING) {
            return false;
        }

        if (this.state === CAMERA_STATES.SOLAR_SYSTEM) {
            this._exitSolarSystem();
            const target = this.focusTarget;
            // this.setMode(CAMERA_STATES.MOUSE_UI, { clearFocus: false, force: true }); // Removed based on instruction
            if (target) {
                this.focusObject(target); // Changed from setMode to focusObject
            } else { // Added to handle case where focusTarget is null
                this.setMode(CAMERA_STATES.MOUSE_UI, { clearFocus: false, force: true }); // Fallback to MOUSE_UI if no target
            }
            return true;
        }

        const anchor = this._resolveSolarSystemTarget(preferredTarget || this.focusTarget);
        if (!anchor) {
            return false;
        }

        this.solarSystemAnchor = anchor;
        this.focusTarget = anchor;
        this._collectSolarSystemMasses();

        if (!this.solarSystemMasses.length) {
            return false;
        }

        this.solarSystemMode = 'creation';
        this.solarSystemSelected = anchor;
        this.solarSystemSelectedIndex = Math.max(0, this.solarSystemMasses.indexOf(anchor));

        this._layoutSolarSystem(this.solarSystemMode);
        this._updateSolarSystemSnapshot();

        this.setMode(CAMERA_STATES.SOLAR_SYSTEM, { clearFocus: false, force: true });
        this._setFov(52, 0.8, 'power2.out');

        return true;
    }

    _resolveSolarSystemTarget(target) {
        return target || null;
    }

    _collectSolarSystemMasses() {
        this.solarSystemMasses = [];
        this.solarSystemOriginalTransforms.clear();

        const systemRoot = this._findSystemRoot(this.solarSystemAnchor || this.focusTarget);
        if (!systemRoot) {
            return;
        }

        let orderCounter = 0;

        systemRoot.traverse((object) => {
            if (!this._isSolarSystemMassCandidate(object)) {
                return;
            }

            orderCounter += 1;
            if (object.userData.creationOrder == null) {
                object.userData.creationOrder = orderCounter;
            }
            if (object.userData.priority == null) {
                object.userData.priority = 100 + orderCounter;
            }

            this.solarSystemOriginalTransforms.set(object, {
                parent: object.parent,
                position: object.position.clone(),
                quaternion: object.quaternion.clone(),
                scale: object.scale.clone()
            });

            this.solarSystemMasses.push(object);
        });
    }

    _layoutSolarSystem(orderBy = 'creation') {
        if (!this.solarSystemMasses.length || !this.scene) return;

        const snapshot = [...this.solarSystemMasses];

        snapshot.sort((a, b) => {
            if (orderBy === 'priority') {
                const pa = a.userData?.priority ?? 0;
                const pb = b.userData?.priority ?? 0;
                if (pa !== pb) return pa - pb;
                return (a.userData?.creationOrder ?? 0) - (b.userData?.creationOrder ?? 0);
            }
            const ca = a.userData?.creationOrder ?? 0;
            const cb = b.userData?.creationOrder ?? 0;
            return ca - cb;
        });

        this.solarSystemMasses = snapshot;

        const selected = snapshot.includes(this.solarSystemSelected)
            ? this.solarSystemSelected
            : (snapshot.includes(this.solarSystemAnchor) ? this.solarSystemAnchor : snapshot[0]);

        this.solarSystemSelected = selected ?? null;
        this.solarSystemSelectedIndex = selected ? snapshot.indexOf(selected) : -1;

        const anchorPos = new THREE.Vector3();
        if (this.solarSystemAnchor) {
            this.solarSystemAnchor.getWorldPosition(anchorPos);
        }

        // REGLA 8: _layoutWorldTarget pre-alocado en el constructor — cero GC en este loop.
        const worldTarget = this._layoutWorldTarget;
        const count = snapshot.length;
        const spacing = 70;

        for (let i = 0; i < count; i++) {
            const target = snapshot[i];
            const lineOffset = (i - (count - 1) / 2) * spacing;

            worldTarget.set(
                anchorPos.x + lineOffset,
                anchorPos.y,
                anchorPos.z - 160
            );

            this.scene.attach(target);
            target.position.copy(worldTarget);
            target.quaternion.identity();

            if (i === this.solarSystemSelectedIndex) {
                target.scale.setScalar(1.15);
            } else {
                target.scale.setScalar(1.0);
            }
        }
    }

    _exitSolarSystem() {
        if (!this.solarSystemMasses.length) return;

        for (const target of this.solarSystemMasses) {
            const original = this.solarSystemOriginalTransforms.get(target);
            if (!original) continue;

            original.parent.attach(target);
            target.position.copy(original.position);
            target.quaternion.copy(original.quaternion);
            target.scale.copy(original.scale);
        }

        this.solarSystemMasses = [];
        this.solarSystemSelected = null;
        this.solarSystemSelectedIndex = -1;
        this.solarSystemAnchor = null;
        this.solarSystemOriginalTransforms.clear();
    }

    _shiftSolarSystemSelection(offset) {
        if (!this.solarSystemMasses.length) return;

        const maxIndex = this.solarSystemMasses.length - 1;
        this.solarSystemSelectedIndex = Math.min(maxIndex, Math.max(0, this.solarSystemSelectedIndex + offset));
        this.solarSystemSelected = this.solarSystemMasses[this.solarSystemSelectedIndex];
        this._layoutSolarSystem(this.solarSystemMode);
        this._updateSolarSystemSnapshot();
    }

    _moveSelectedSolarMass(direction) {
        if (!this.solarSystemSelected || !this.solarSystemMasses.length) return;

        const from = this.solarSystemSelectedIndex;
        const to = Math.min(this.solarSystemMasses.length - 1, Math.max(0, from + direction));
        if (from === to) return;

        const item = this.solarSystemMasses.splice(from, 1)[0];
        this.solarSystemMasses.splice(to, 0, item);
        this.solarSystemSelectedIndex = to;
        this._layoutSolarSystem(this.solarSystemMode);
        this._updateSolarSystemSnapshot();
    }

    _toggleSolarSystemSort() {
        this.solarSystemMode = this.solarSystemMode === 'creation' ? 'priority' : 'creation';
        this._layoutSolarSystem(this.solarSystemMode);
        this._updateSolarSystemSnapshot();
    }

    _updateSolarSystemSnapshot() {
        this.solarSystemSnapshot = {
            active: this.state === CAMERA_STATES.SOLAR_SYSTEM,
            mode: this.solarSystemMode,
            anchorLabel: this.solarSystemAnchor?.userData?.appName || this.solarSystemAnchor?.userData?.label || this.solarSystemAnchor?.name || 'Sin masa',
            selected: this.solarSystemSelected?.userData?.appName || this.solarSystemSelected?.userData?.label || this.solarSystemSelected?.name || 'Ninguno',
            size: this.solarSystemMasses.length
        };
    }

    getSolarSystemSnapshot() {
        return this.solarSystemSnapshot || {
            active: false,
            mode: 'creation',
            anchorLabel: 'Sin masa',
            selected: 'Ninguno',
            size: 0
        };
    }

    updateSolarSystemTracking() {
        if (!this.solarSystemSelected) return;

        const worldTarget = new THREE.Vector3();
        this.solarSystemSelected.getWorldPosition(worldTarget);

        this.desiredRigPosition
            .copy(worldTarget)
            .add(new THREE.Vector3(0, 30, 90));

        this.cameraRig.position.lerp(this.desiredRigPosition, 0.18);

        this._computeLookQuaternion(this.targetQuaternion, this.cameraRig.position, worldTarget);
        this.cameraRig.quaternion.slerp(this.targetQuaternion, 0.18);
        this._syncRigEulerFromQuaternion();
    }

    unfocusObject() {
        const interactionEventSystem =
            Registry.tryGet('InteractionEventSystem') ??
            window.engine?.interactionEventSystem ??
            null;
        const raycastSelectionSystem =
            Registry.tryGet('RaycastSelectionSystem') ??
            window.engine?.raycastSelectionSystem ??
            null;

        if (this.focusTarget) {
            window.dispatchEvent(new CustomEvent('PG:MASS_FOCUS_RELEASED', {
                detail: {
                    object: this.focusTarget,
                    source: 'navigation-unfocus',
                }
            }));
        }

        this.focusTarget = null;
        interactionEventSystem?.clearSelection?.({ source: 'navigation-unfocus' });
        raycastSelectionSystem?.clearSelection?.({ source: 'navigation-unfocus' });
        
        // AAA DELEGATION: Liberar el Avatar Control
        const pawnController = Registry.tryGet('pawnController');
        if (pawnController) pawnController.setPawn(null);
        
        const aimRay = Registry.tryGet('aimRay');
        if (aimRay) aimRay.showReticle(false);

        // Mantener la cámara en su posición actual al salir de órbita
        this.cameraRig.position.copy(this.camera.position);
        this.cameraRig.quaternion.copy(this.camera.quaternion);
        this._syncRigEulerFromQuaternion();
        
        this.setMode(CAMERA_STATES.FREE_FLIGHT, { requestPointerLock: false, force: true });
        
        if (this.godControls) {
            this.godControls.enabled = false;
        }
        
        if (this.historyStack.length > 0) {
            this.historyStack.pop(); // Clear the pre-orbit position so we don't warp back to spawn
        }
    }

    clearMassSelection({ source = 'navigation-clear-selection' } = {}) {
        const interactionEventSystem =
            Registry.tryGet('InteractionEventSystem') ??
            window.engine?.interactionEventSystem ??
            null;
        const raycastSelectionSystem =
            Registry.tryGet('RaycastSelectionSystem') ??
            window.engine?.raycastSelectionSystem ??
            null;
        const aimRay = Registry.tryGet('aimRay');

        interactionEventSystem?.clearSelection?.({ source });
        raycastSelectionSystem?.clearSelection?.({ source });
        aimRay?.showReticle?.(false);

        if (this.focusTarget) {
            this.unfocusObject();
        }
    }

    focusObject(object) {
        if (!object || this.state === CAMERA_STATES.WARPING) {
            return;
        }

        if (this.isMapContextActive()) {
            const physics = Registry.tryGet('kernel')?.physicsSystem;
            if (physics && physics.restoreFromMapMode) {
                physics.restoreFromMapMode();
            }
            if (this._mapModeRotationTween) this._mapModeRotationTween.kill();
        }

        this.pushCurrentState();

        this.focusTarget = object;
        this.focusDistance = this._computeFocusDistance(object);
        
        // AAA TPS Integration: Immediately convert selected mass into the Avatar Sandbox Pawn

        // Deshabilitar controles Trackball para dejarle toda la autoridad de rotación a la masa y TPSCamera
        if (this.godControls) {
            this.godControls.enabled = false;
        }
        
        // Calculate offset direction using Vectors (ArcBall approach)
        const targetWorldPos = new THREE.Vector3();
        this.focusTarget.getWorldPosition(targetWorldPos);
        
        const currentOffset = new THREE.Vector3().subVectors(this.cameraRig.position, targetWorldPos);
        if (currentOffset.lengthSq() > 0.001) {
            currentOffset.normalize();
        } else {
            currentOffset.set(1, 0.4, 1).normalize();
        }
        
        this.focusOffsetDirection.copy(currentOffset);
        
        // Reset absolute trackball 'Up' alignment for a predictable warp approach
        this.trackballUp.copy(this.cameraRig.up).normalize();
        if (this.trackballUp.lengthSq() < 0.001) this.trackballUp.set(0,1,0);

        this._updateFocusSolution();

        const warpStarted = this.setMode(CAMERA_STATES.WARPING, {
            clearFocus: false,
            force: true,
            targetObject: this.focusTarget,
            orbitDistance: this.focusDistance,
        });
        if (!warpStarted) return;

        // Canonical FSM warp path owns FOV/tween/event lifecycle.
        if (this.fsm?.currentStateId === CAMERA_STATE.WARP) {
            return;
        }

        this._killMotionTweens();
        this._stopWarpShake();
        this._syncRigEulerFromQuaternion();

        this.warpStartPosition.copy(this.cameraRig.position);
        this.warpStartQuaternion.copy(this.cameraRig.quaternion);
        this.warpProgress.value = 0;

        this.warpFOV();
        this.moveRig();
    }

    enterWallpaperMode() {
        if (this.state === CAMERA_STATES.WARPING) {
            return;
        }

        this.focusTarget = null;
        this.setMode(CAMERA_STATES.MOUSE_UI);
        this._killMotionTweens();
        this._killWallpaperDrift();
        this.velocity.set(0, 0, 0);

        this.wallpaperTargetPosition.set(160, 7200, 1800);
        this.wallpaperLookTarget.set(0, 0, 0);
        this.wallpaperStartPosition.copy(this.cameraRig.position);
        this.wallpaperStartQuaternion.copy(this.cameraRig.quaternion);
        this.wallpaperProgress.value = 0;
        this._computeLookQuaternion(this.wallpaperQuaternion, this.wallpaperTargetPosition, this.wallpaperLookTarget);

        this.wallpaperTween = gsap.to(this.wallpaperProgress, {
            value: 1,
            duration: 5.2,
            ease: 'expo.inOut',
            onUpdate: () => {
                this.cameraRig.position.lerpVectors(
                    this.wallpaperStartPosition,
                    this.wallpaperTargetPosition,
                    this.wallpaperProgress.value
                );
                this.cameraRig.quaternion.slerpQuaternions(
                    this.wallpaperStartQuaternion,
                    this.wallpaperQuaternion,
                    this.wallpaperProgress.value
                );
                this.cameraRig.quaternion.normalize();
                this._syncRigEulerFromQuaternion();
            },
            onComplete: () => {
                this.wallpaperTween = null;
                this.cameraRig.position.copy(this.wallpaperTargetPosition);
                this.cameraRig.quaternion.copy(this.wallpaperQuaternion);
                this.cameraRig.quaternion.normalize();
                this._syncRigEulerFromQuaternion();

                if (!this._isLoginActive() && !this._isGamePaused()) {
                    this._startCinematicDrift();
                }
            }
        });

        this._setFov(28, 2.6, 'expo.inOut');
    }

    warpFOV() {
        gsap.killTweensOf(this.camera);
        gsap.to(this.camera, {
            fov: this.warpKickFov,
            duration: 0.3,
            ease: 'power4.out',
            onUpdate: () => this.camera.updateProjectionMatrix(),
            onComplete: () => {
                gsap.to(this.camera, {
                    fov: this.focusFov,
                    duration: 0.7,
                    ease: 'power2.out',
                    onUpdate: () => this.camera.updateProjectionMatrix()
                });
            }
        });
    }

    moveRig() {
        this._startWarpShake();
        if (this.warpTween) {
            this.warpTween.kill();
        }

        this.warpTween = gsap.to(this.warpProgress, {
            value: 1,
            duration: this.warpDuration,
            ease: 'expo.inOut',
            onComplete: () => {
                this.warpTween = null;
                this.setMode(CAMERA_STATES.WORLD_FOCUS, {
                    clearFocus: false,
                    force: true
                });
                this.endWarp();
            }
        });
    }
    
    enterFirstPersonWalk(targetMass) {
        if (!targetMass) return;
        
        console.log("[Navigation] Transitioning to First Person Walk on:", targetMass.name);
        this.focusTarget = targetMass;
        
        // Fija la posición inicial cerca de la superficie
        const planetRadius = targetMass.geometry?.boundingSphere?.radius || 1;
        this.focusDistance = planetRadius + 2.0;

        this.setMode(CAMERA_STATES.FIRST_PERSON_WALK, {
            clearFocus: false,
            requestPointerLock: true
        });
    }

    endWarp() {
        this._stopWarpShake();
        gsap.killTweensOf(this.camera);
        gsap.to(this.camera, {
            fov: this.defaultFov,
            duration: 1.2,
            ease: 'elastic.out(1, 0.4)',
            onUpdate: () => this.camera.updateProjectionMatrix(),
            onComplete: () => {
                if (this.focusTarget?.userData?.appId) {
                    window.dispatchEvent(new CustomEvent('WARP_FLIGHT_COMPLETE', {
                        detail: {
                            ...this.focusTarget.userData,
                            source: 'navigation',
                            openWindow: false
                        }
                    }));
                }
            }
        });
    }

    onPointerLockChange() {
        const isLocked = document.pointerLockElement === this.domElement;
        const inputState = Registry.tryGet('InputStateSystem');
        const hudMode = inputState?.hudMode ?? false;

        // States that manage their own pointer-lock lifecycle — don't interfere
        const selfManagedState =
            this.state === CAMERA_STATES.COCKPIT ||
            this.state === CAMERA_STATES.ORBITAL_DESCENT ||
            this.isFocusContextActive();

        if (isLocked) {
            if (hudMode) {
                return;
            }

            if (this.state === CAMERA_STATES.MOUSE_UI) {
                this.setMode(CAMERA_STATES.FREE_FLIGHT, {
                    requestPointerLock: false,
                    force: true
                });
            }
            return;
        }

        if (hudMode || this._isLoginActive() || this._isGamePaused() || selfManagedState) {
            return;
        }
    }


    onPointerDown(_event) {
        // Deprecated local pointer listener. InputStateSystem is the single source of truth.
    }

    onPointerUp(_event) {
        // Deprecated local pointer listener. InputStateSystem is the single source of truth.
    }

    onMouseMove(_event) {
        // Deprecated local pointer listener. InputStateSystem is the single source of truth.
        return;
        if (this._isGamePaused()) return;
        const activeFsmState = this.fsm?.currentStateId ?? null;
        if (activeFsmState && FSM_STATES.has(activeFsmState)) return;

        // ── Cockpit: ShipRig owns mouse look ─ don't fight it ────────────────────
        if (this.state === CAMERA_STATES.COCKPIT) return;

        if (this.state === CAMERA_STATES.WORLD_FOCUS) return;
        if (this._isUiInteractionTarget(event.target) || Registry.tryGet('InputStateSystem')?.isUiCapturingPointer?.()) return;
        
        const isLocked = document.pointerLockElement === this.domElement;

        if (this.state !== CAMERA_STATES.FREE_FLIGHT || !isLocked) {
            return;
        }

        const yawDelta = -event.movementX * this.lookSensitivity;
        const pitchDelta = -event.movementY * this.lookSensitivity;

        this.lookYawQuaternion.setFromAxisAngle(this.localYAxis, yawDelta);
        this.lookPitchQuaternion.setFromAxisAngle(this.localXAxis, pitchDelta);

        this.cameraRig.quaternion.multiply(this.lookYawQuaternion);
        this.cameraRig.quaternion.multiply(this.lookPitchQuaternion);
        this.cameraRig.quaternion.normalize();
        this._syncRigEulerFromQuaternion();
    }

    onKeyDown(_event) {
        // Deprecated local key listener. InputStateSystem is the single source of truth.
        return;
        if (this._isTypingTarget(_event.target)) return;
        if (this._isGamePaused() && event.code !== 'Escape') return;

        if (FLIGHT_KEYS.has(event.code)) {
            event.preventDefault();
        }
        
        if (event.code === 'KeyM') {
            event.preventDefault(); // Prevenir navegacion de interfaz
            
            if (this.state === CAMERA_STATES.MAP_MODE) {
                this.exitMapMode();
                return;
            }
            if (this.state === CAMERA_STATES.WORLD_FOCUS) {
                this.enterMapMode();
                return;
            }
            return;
        }

        // legacy local key state removed

        // ── ESC [───────────────────────────────────────────────────────────
        if (event.code === 'Escape') {
            const gm = Registry.tryGet('GameMenuSystem');
            if (event.repeat) return;
            if (gm?.isOpen) gm.close();
            else this._emitRuntimeSignal('PG:TOGGLE_GAME_MENU', { source: 'navigation', reason: 'escape' });
            return;


            // ── COCKPIT: exit back to free flight ───────────────────────────────
        }

        // ── L key: begin orbital descent ─────────────────────────────────────────
        if (event.code === 'KeyL' && this.state === CAMERA_STATES.WORLD_FOCUS && this.focusTarget) {
            this.beginOrbitalDescent(this.focusTarget);
            return;
        }

        // ── C key: toggle cockpit (guard repeat so no bounce) ───────────────────
        if (event.code === 'KeyC' && !event.repeat) {
            if (this.state === CAMERA_STATES.COCKPIT) {
                this._exitCockpitMode();
            } else if (this.state !== CAMERA_STATES.WARPING) {
                this.enterCockpitMode();
            }
            return;
        }


        if (this.state === CAMERA_STATES.SOLAR_SYSTEM) {
            if (event.code === 'ArrowLeft') {
                this._shiftSolarSystemSelection(-1);
                return;
            }
            if (event.code === 'ArrowRight') {
                this._shiftSolarSystemSelection(1);
                return;
            }
            if (event.code === 'KeyA') {
                this._moveSelectedSolarMass(1);
                return;
            }
            if (event.code === 'KeyD') {
                this._moveSelectedSolarMass(-1);
                return;
            }
            if (event.code === 'KeyS') {
                this._toggleSolarSystemSort();
                return;
            }
        }

        if (!FLIGHT_KEYS.has(event.code)) return;

        if (this.state === CAMERA_STATES.MOUSE_UI && event.code !== 'Tab') {
            this.resumeFreeFlight({ requestPointerLock: false });
        }
    }

    onKeyUp(_event) {
        // Deprecated local key listener. InputStateSystem is the single source of truth.
        return;
        // legacy local key state removed
    }

    enterMapMode() {
        if (!this.focusTarget || this.isMapContextActive()) return;
        this.pushCurrentState();
        this.setMode(CAMERA_STATES.MAP_MODE, { clearFocus: false, force: true });
        
        if (this.godControls) this.godControls.enabled = false;
        
        // Animación cinemática: girar 180° dando la espalda al mundo para ver el universo
        this._mapModeRotationTween = gsap.to(this.cameraRig.rotation, {
            y: this.cameraRig.rotation.y + Math.PI,
            duration: 1.8,
            ease: "power2.inOut"
        });
        
        const physics = Registry.tryGet('kernel')?.physicsSystem;
        if (physics && physics.arrangeInMapMode) {
            physics.arrangeInMapMode(this.cameraRig, this.focusTarget);
        }
    }

    exitMapMode() {
        if (!this.isMapContextActive()) return;
        
        const physics = Registry.tryGet('kernel')?.physicsSystem;
        if (physics && physics.restoreFromMapMode) {
            physics.restoreFromMapMode();
        }
        
        if (this._mapModeRotationTween) this._mapModeRotationTween.kill();
        
        // Restaurar giro 180
        gsap.to(this.cameraRig.rotation, {
            y: this.cameraRig.rotation.y - Math.PI,
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
                if (this.historyStack.length > 0) {
                    const previous = this.historyStack.pop();
                    this.setMode(previous.state, { force: true, clearFocus: false });
                    // Habilitar controles si regresamos a WORLD_FOCUS
                    if (previous.state === CAMERA_STATES.WORLD_FOCUS && this.godControls) {
                        this.godControls.enabled = true;
                    }
                } else {
                    this.unfocusObject();
                }
            }
        });
    }

    update(deltaTime = 0) {
        const delta = Math.min(Math.max(deltaTime, 0), 0.05);
        const cameraMode = this.getCameraMode();

        // Keep camera projection aligned with viewport changes.
        this._adaptFOVByAspect();

        // ── 4-State FSM delegation ────────────────────────────────────────────────
        // All canonical states delegate to the FSM. Hard-copy rig→camera after each tick
        // so the renderer always sees current position even if CameraSystem.sync() is absent.
        if (cameraMode && FSM_STATES.has(cameraMode)) {
            this.fsm.update(delta);

            // Tick surface patch terrain (no-op unless an orbital descent is active)
            this._tickSurfacePatch(delta);

            // Force Three.js matrix tree update so world positions are correct
            this.cameraRig.updateMatrixWorld(true);

            // Hard sync: CameraRig → THREE.Camera (render endpoint)
            this.camera.position.copy(this.cameraRig.position);
            this.camera.quaternion.copy(this.cameraRig.quaternion);

            // Sync FOV from CameraRig.fov (WarpState animates this)
            if (this.cameraRig.fov && this.cameraRig.fov !== this.camera.fov) {
                this.camera.fov = this.cameraRig.fov;
                this.camera.updateProjectionMatrix();
            }
            return;
        }


        // --------------------------------------------------
        // LEGACY STATES FALLBACK
        // --------------------------------------------------
        switch (this.state) {
        case CAMERA_STATES.FIRST_PERSON_WALK:
            this.updateFirstPersonWalk(delta);
            break;
        case CAMERA_STATES.STELARYI:
            this.updateStelaryiTracking();
            break;
        case CAMERA_STATES.SOLAR_SYSTEM:
            this.updateSolarSystemTracking();
            break;
        case CAMERA_STATES.MOUSE_UI:
        default:
            break;
        }

        this._guardTransforms();

        this.cameraMount.updateMatrixWorld(true);
        this.cameraMount.getWorldPosition(this.followPosition);
        this.cameraMount.getWorldQuaternion(this.followQuaternion);

        if (this.state === CAMERA_STATES.FIRST_PERSON_WALK) {
            this.camera.position.copy(this.followPosition);
            this.camera.quaternion.copy(this.followQuaternion);
        } else {
            const lerpFactor = 1 - Math.exp(-this.damping * delta);
            this.camera.position.lerp(this.followPosition, lerpFactor);
            this.camera.quaternion.slerp(this.followQuaternion, lerpFactor);
        }

        // Apply smooth telescope FOV 
        if (Math.abs(this.camera.fov - this.targetFov) > 0.1) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, delta * 10);
            this.camera.updateProjectionMatrix();
        }
    }

    updateFreeFlight(deltaTime) {
        const input = Registry.tryGet('InputStateSystem');
        const cameraMode = this.getCameraMode();
        const contextMode = this.getContextMode();
        this.inputVector.set(
            input?.getControlAxis?.('FLIGHT_STRAFE', { cameraMode, contextMode }) ?? 0,
            input?.getControlAxis?.('FLIGHT_ELEVATION_DRONE', { cameraMode, contextMode }) ?? 0,
            -(input?.getControlAxis?.('FLIGHT_THRUST', { cameraMode, contextMode }) ?? 0)
        );

        if (this.autoBrakeActive) {
            this.targetVelocity.set(0, 0, 0);
            this.velocity.multiplyScalar(Math.exp(-12 * deltaTime));
            if (this.velocity.lengthSq() < 0.0004) {
                this.velocity.set(0, 0, 0);
            }
        } else if (this.inputVector.lengthSq() > 0) {
            this.inputVector.normalize().multiplyScalar(this.freeFlightSpeed);
            this.targetVelocity.copy(this.inputVector);
            this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-this.acceleration * deltaTime));
        } else {
            this.targetVelocity.copy(this.inputVector);
            this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-this.acceleration * deltaTime));
            this.velocity.multiplyScalar(Math.exp(-this.drag * deltaTime));
        }

        this.frameDisplacement.copy(this.velocity).multiplyScalar(deltaTime);

        this.cameraRig.translateX(this.frameDisplacement.x);
        this.cameraRig.translateY(this.frameDisplacement.y);
        this.cameraRig.translateZ(this.frameDisplacement.z);
    }

    updateDynamicTracking(deltaTime) {
        const input = Registry.tryGet('InputStateSystem');
        // AAA DELEGATION: If a Pawn is actively being controlled, ThirdPersonCameraSystem and PawnOrientationSystem
        // take absolute mechanical precedence via FrameScheduler. Do not collide equations.
        const pawnController = Registry.tryGet('pawnController');
        if (pawnController && pawnController.getPawn()) {
            this._syncRigEulerFromQuaternion();
            return;
        }

        if (this.isFocusContextActive() && this.focusTarget && this.godControls?.enabled) {
            
            // 1. Extraer la nueva posición del planeta (si está en traslación)
            this.focusTarget.getWorldPosition(this._dynamicTargetPos);

            // 1.5 Compensar traslación planetaria: Mover la cámara la misma distancia que se movió la masa
            if (this._previousTargetPos) {
                const deltaPos = new THREE.Vector3().subVectors(this._dynamicTargetPos, this._previousTargetPos);
                this.camera.position.add(deltaPos);
            }
            this._previousTargetPos.copy(this._dynamicTargetPos); // Actualizar base para el siguiente frame

            // Restablecer ancla estricta al centro de la masa (Anti-paneo)
            this.godControls.target.copy(this._dynamicTargetPos);

            // 2. NATIVE WASD ORBITING
            const orbitX = -(input?.getControlAxis?.('FLIGHT_STRAFE', {
                cameraMode: CAMERA_STATE.FOCUS,
                contextMode: this.getContextMode(),
            }) ?? 0);
            const orbitY = -(input?.getControlAxis?.('FLIGHT_THRUST', {
                cameraMode: CAMERA_STATE.FOCUS,
                contextMode: this.getContextMode(),
            }) ?? 0);

            if (orbitX !== 0 || orbitY !== 0) {
                const speed = 1.8 * deltaTime;
                const offset = new THREE.Vector3().subVectors(this.camera.position, this.godControls.target);
                const spherical = new THREE.Spherical().setFromVector3(offset);
                
                spherical.theta -= orbitX * speed;
                spherical.phi -= orbitY * speed;
                spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
                
                offset.setFromSpherical(spherical);
                this.camera.position.copy(this.godControls.target).add(offset);
            }

            // 3. Calcular la inercia y aplicar la matriz final a la cámara
            this.godControls.update();

            // Sincronizar el rig para transiciones consistentes al salir de la órbita
            this.cameraRig.position.copy(this.camera.position);
            this.cameraRig.quaternion.copy(this.camera.quaternion);
            this._syncRigEulerFromQuaternion();
        }
    }

    updateFirstPersonWalk(delta) {
        if (!this.focusTarget) return;
        const input = Registry.tryGet('InputStateSystem');

        // Movimiento WASD sobre la superficie planetaria
        const speed = 15.0 * delta;
        const strafeAxis = (input?.isKey?.('KeyD') ? 1 : 0) - (input?.isKey?.('KeyA') ? 1 : 0);
        const thrustAxis = (input?.isKey?.('KeyW') ? 1 : 0) - (input?.isKey?.('KeyS') ? 1 : 0);
        if (strafeAxis !== 0) this.cameraRig.translateX(speed * strafeAxis);
        if (thrustAxis !== 0) this.cameraRig.translateZ(-speed * thrustAxis);

        // Restricción Vectorial Estricta (Gravedad / Suelo) sin raycaster
        const planetPos = new THREE.Vector3();
        this.focusTarget.getWorldPosition(planetPos);
        
        const planetRadius = this.focusTarget.geometry?.boundingSphere?.radius || 1;
        const playerHeight = 2.0;

        const centerToRig = new THREE.Vector3().subVectors(this.cameraRig.position, planetPos);
        const currentDistance = centerToRig.length();
        const targetDistance = Math.max(currentDistance, planetRadius + playerHeight);

        // Fija la posición usando álgebra vectorial estricta
        centerToRig.normalize().multiplyScalar(targetDistance);
        this.cameraRig.position.copy(planetPos).add(centerToRig);

        // Alineación al up normal del planeta opcional para que no te vayas volando,
        // Pero el mouse mira libremente
        // El FPS puro requiere que el Rig tenga LookQuat libre, lo cual ya hace `onMouseMove` si isLocked
    }

    updateStelaryiTracking() {
        if (!this.focusTarget || !this.focusTarget.parent) {
            return;
        }

        this._updateStelaryiSolution();
        this.cameraRig.position.lerp(this.stelaryiRigPosition, 0.16);
        this.cameraRig.quaternion.slerp(this.targetQuaternion, 0.18);
        this._updateStelaryiSnapshot();
        this._syncRigEulerFromQuaternion();
    }

    updateWarping() {
        const t = this.warpProgress.value;
        
        if (this.focusTarget && this.focusTarget.parent) {
            this._updateFocusSolution();
            this.cameraRig.position.copy(this.warpStartPosition).lerp(this.desiredRigPosition, t);
            
            this._computeLookQuaternion(this.warpQuaternion, this.cameraRig.position, this.worldTarget);
            if (this.warpStartQuaternion.dot(this.warpQuaternion) < 0) {
                this.warpQuaternion.x *= -1;
                this.warpQuaternion.y *= -1;
                this.warpQuaternion.z *= -1;
                this.warpQuaternion.w *= -1;
            }
        } else {
            // Reversing via popState, simple direct lerp
            this.cameraRig.position.copy(this.warpStartPosition).lerp(this.desiredRigPosition, t);
            if (this.warpStartQuaternion.dot(this.warpQuaternion) < 0) {
                this.warpQuaternion.x *= -1;
                this.warpQuaternion.y *= -1;
                this.warpQuaternion.z *= -1;
                this.warpQuaternion.w *= -1;
            }
        }

        this.cameraRig.quaternion.copy(this.warpStartQuaternion).slerp(this.warpQuaternion, t);
        this._syncRigEulerFromQuaternion();
    }

    onWheel(event) {
        if (this._isTypingTarget(event.target) || this._isUiInteractionTarget(event.target)) return;

        let zoomDelta = event.deltaY * 0.35;
        const mapSystem = Registry.tryGet('OntologyMapSystem') || window.Registry?.tryGet('OntologyMapSystem');
        const cosmosSystem = Registry.tryGet('CosmosMapSystem') || window.Registry?.tryGet('CosmosMapSystem');

        if (cosmosSystem?.isActive) {
            if (zoomDelta < -5) {
                cosmosSystem.setMapState(false); // Return to MACRO
                if (mapSystem) mapSystem.setMapState(true);
            }
            return;
        }

        if (mapSystem?.isActive) {
            // If in MACRO mode and trying to zoom in, break back to MICRO
            if (zoomDelta < -5) {
                mapSystem.setMapState(false);
            } else if (zoomDelta > 0) {
                // Zooming OUT into the intergalactic void
                if (mapSystem.focusDistance > 48000) {
                    zoomDelta *= 0.1; // Huge friction at the edge of the galaxy
                }
                mapSystem.focusDistance = Math.min(50000, mapSystem.focusDistance + zoomDelta * 4.0); // Faster zoom in Macro

                if (mapSystem.focusDistance >= 50000) {
                    // FRONTERA 2: Enter COSMOS Multiverse
                    mapSystem.setMapState(false);
                    cosmosSystem?.setMapState(true);
                    mapSystem.focusDistance = 2500; // Reset for next time
                    
                    const audio = Registry.tryGet('AudioEngine');
                    audio?._playAlgorithmicTone?.(30, 'square', 3.0, audio.channels.ui); // Deep Impact / Sub-Bass
                }
            }
            return;
        }

        if (this.isFocusContextActive() || this.state === CAMERA_STATES.SOLAR_SYSTEM) {
            if (zoomDelta > 0 && this.focusDistance > 4800) {
                // Rubber-band resistance near the edge
                zoomDelta *= 0.1;
            }

            // Zoom físico (acercar la cámara a la masa)
            this.focusDistance = Math.max(15, this.focusDistance + zoomDelta);

            // The Break: Crossing 5000 triggers the MACRO Ontology Map
            if (this.focusDistance > 5000) {
                this.focusDistance = 5000; // Clamp
                mapSystem?.setMapState(true);
            }
        } else if (this.state === CAMERA_STATES.MOUSE_UI) {
            // Zoom óptico (FOV) ideal para el menú de inicio / wallpaper
            gsap.killTweensOf(this.camera, "fov"); 
            const fovShift = event.deltaY > 0 ? 4 : -4;
            this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + fovShift, 10, 140);
            this.camera.updateProjectionMatrix();
        }
    }

    dispose() {
        window.removeEventListener('wheel', this.onWheel, false);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);
        if (Array.isArray(this._runtimeSignalRemovers)) {
            this._runtimeSignalRemovers.forEach((remove) => {
                if (typeof remove === 'function') remove();
            });
            this._runtimeSignalRemovers = [];
        }
    }

    _applyState(nextState) {
        this.state = nextState;
        this.mode = nextState;
        this.presentationState = nextState;
        this.stelaryiSnapshot.active = nextState === CAMERA_STATES.STELARYI;
        this.solarSystemSnapshot = this.solarSystemSnapshot || {};
        this.solarSystemSnapshot.active = nextState === CAMERA_STATES.SOLAR_SYSTEM;

        if (nextState === CAMERA_STATES.MOUSE_UI) {
            this.upsertPointerIntent('navigation-mouse-ui', {
                kind: 'ui',
                cursor: 'default',
                priority: 120,
                reticleMode: 'hidden',
            });
        } else {
            this.clearPointerIntent('navigation-mouse-ui');
        }
    }

    _updateFocusSolution() {
        this.focusTarget.getWorldPosition(this.worldTarget);
        this.desiredRigPosition
            .copy(this.focusOffsetDirection)
            .multiplyScalar(this.focusDistance)
            .add(this.worldTarget);
    }

    _computeFocusDistance(object) {
        if (object.geometry) {
            object.geometry.computeBoundingSphere();
            const radius = object.geometry.boundingSphere?.radius || 1;
            object.getWorldScale(this.objectScale);
            const scale = Math.max(this.objectScale.x, this.objectScale.y, this.objectScale.z);
            return Math.max(this.baseOrbitDistance, radius * scale * 3.5);
        }

        this.bounds.setFromObject(object);
        if (this.bounds.isEmpty()) {
            return this.baseOrbitDistance;
        }

        this.bounds.getSize(this.boundsSize);
        return Math.max(this.baseOrbitDistance, this.boundsSize.length() * 0.75);
    }

    getStelaryiSnapshot() {
        return this.stelaryiSnapshot;
    }

    _collectStelaryiPlanets() {
        this.stelaryiPlanets.length = 0;

        this.scene.traverse((object) => {
            if (
                object.userData?.isMass ||
                object.userData?.nodeType === 'planet' ||
                object.userData?.nodeType === 'star' ||
                object.userData?.isApp
            ) {
                this.stelaryiPlanets.push(object);
            }
        });
    }

    _updateStelaryiSolution() {
        this.focusTarget.getWorldPosition(this.stelaryiTargetPosition);

        const systemRoot = this._findSystemRoot(this.focusTarget);
        if (systemRoot) {
            systemRoot.getWorldPosition(this.stelaryiSystemCenter);
        } else {
            this.stelaryiSystemCenter.set(0, 0, 0);
        }

        this.stelaryiViewRadial.copy(this.stelaryiTargetPosition).sub(this.stelaryiSystemCenter);
        if (this.stelaryiViewRadial.lengthSq() < 0.0001) {
            this.stelaryiViewRadial.set(1, 0, 0);
        }
        this.stelaryiViewRadial.normalize();

        this.stelaryiViewNormal.copy(this.worldUp);
        this.stelaryiViewTangent.crossVectors(this.stelaryiViewNormal, this.stelaryiViewRadial);
        if (this.stelaryiViewTangent.lengthSq() < 0.0001) {
            this.stelaryiViewTangent.set(0, 0, 1);
        }
        this.stelaryiViewTangent.normalize();
        this.stelaryiViewNormal.crossVectors(this.stelaryiViewRadial, this.stelaryiViewTangent).normalize();

        const anchorScale = this._computeFocusDistance(this.focusTarget);
        const sideInset = Math.max(18, anchorScale * 0.62);
        const depth = Math.max(130, anchorScale * 4.2);
        const height = Math.max(12, anchorScale * 0.34);
        const lookLead = Math.max(38, anchorScale * 1.24);

        this.stelaryiRigPosition
            .copy(this.stelaryiTargetPosition)
            .addScaledVector(this.stelaryiViewNormal, height)
            .addScaledVector(this.stelaryiViewRadial, -sideInset)
            .addScaledVector(this.stelaryiViewTangent, -depth);

        this.stelaryiLookTarget
            .copy(this.stelaryiTargetPosition)
            .addScaledVector(this.stelaryiViewRadial, lookLead)
            .addScaledVector(this.stelaryiViewNormal, height * 0.12);

        this._computeLookQuaternion(this.targetQuaternion, this.stelaryiRigPosition, this.stelaryiLookTarget);
    }

    _updateStelaryiSnapshot() {
        const levels = Array.from({ length: this.stelaryiOrbitLevels }, () => []);
        const anchorLabel = this.focusTarget?.userData?.appName || this.focusTarget?.userData?.parentName || this.focusTarget?.name || 'Masa desconocida';

        const orderedPlanets = this.stelaryiPlanets
            .filter((planet) => planet !== this.focusTarget)
            .map((planet) => {
                planet.getWorldPosition(this.stelaryiPlanetPosition);
                return {
                    label: planet.userData?.appName || planet.name || 'Masa',
                    radius: this.stelaryiPlanetPosition.distanceTo(this.stelaryiSystemCenter)
                };
            })
            .sort((a, b) => a.radius - b.radius);

        for (let i = 0; i < orderedPlanets.length; i++) {
            const lane = i % this.stelaryiOrbitLevels;
            levels[lane].push({
                label: orderedPlanets[i].label,
                radius: Math.round(orderedPlanets[i].radius)
            });
        }

        this.stelaryiSnapshot.active = this.state === CAMERA_STATES.STELARYI;
        this.stelaryiSnapshot.anchorLabel = anchorLabel;
        this.stelaryiSnapshot.anchorState = this.state === CAMERA_STATES.STELARYI
            ? 'Camara estelaryi activa. La masa ancla queda suspendida y el resto del sistema se ordena en tres niveles orbitales.'
            : 'Selecciona una masa para activar la alineacion estelaryi.';
        this.stelaryiSnapshot.levels = levels;
    }

    _resolveStelaryiTarget(target) {
        return target || null;
    }

    _isSolarSystemMassCandidate(object) {
        if (!object || object === this.solarSystemAnchor?.parent) {
            return false;
        }

        // LEY 4 — SupraconsciousnessMass es el Origen del Grafo de Escena.
        // No puede ser objetivo de SOLAR_SYSTEM ni de ningún reordenamiento.
        if (object.userData?.nodeType === 'supraconsciousness') {
            return false;
        }

        const name = object.name || '';
        if (name.startsWith('Hitbox_') || name === 'SupraconsciousnessMass') {
            return false;
        }

        if (object.userData?.isSatellite || object.userData?.isMetamorphMoon) {
            return true;
        }

        if (object.userData?.nodeType === 'star' || object.userData?.nodeType === 'planet') {
            return true;
        }

        return name.startsWith('Moon_');
    }

    _findSystemRoot(object) {
        let current = object;
        while (current) {
            if (typeof current.name === 'string' && current.name.startsWith('SolarSystem_')) {
                return current;
            }
            current = current.parent;
        }

        return null;
    }

    _computeLookQuaternion(targetQuaternion, cameraPosition, targetPosition) {
        const upVector = this.isFocusContextActive() ? this.trackballUp : this.worldUp;
        this._lookHelperCamera.position.copy(cameraPosition);
        this._lookHelperCamera.up.copy(upVector);
        this._lookHelperCamera.lookAt(targetPosition);
        return targetQuaternion.copy(this._lookHelperCamera.quaternion);
    }

    _setFov(fov, duration, ease) {
        if (this._isLoginActive() && this.state === CAMERA_STATES.MOUSE_UI && Math.abs(fov - this.defaultFov) < 0.001) {
            return;
        }

        if (this.cameraRig) {
            this.cameraRig.fov = this.cameraRig.fov ?? this.camera?.fov ?? fov;
            gsap.killTweensOf(this.cameraRig);
        }
        gsap.killTweensOf(this.camera);
        gsap.to(this.cameraRig ?? this.camera, {
            fov,
            duration,
            ease,
            onUpdate: () => {
                if (this.camera && this.cameraRig?.fov != null) {
                    this.camera.fov = this.cameraRig.fov;
                }
                this.camera?.updateProjectionMatrix();
            }
        });
    }

    _killMotionTweens() {
        gsap.killTweensOf(this.cameraRig.position);
        gsap.killTweensOf(this.cameraRig.quaternion);
        if (this.warpTween) {
            this.warpTween.kill();
            this.warpTween = null;
        }
    }

    _killWallpaperDrift() {
        if (this.wallpaperTween) {
            this.wallpaperTween.kill();
            this.wallpaperTween = null;
        }

        gsap.killTweensOf(this.wallpaperProgress);
        this.wallpaperProgress.value = 0;
        gsap.killTweensOf(this.cameraRig.position);
        gsap.killTweensOf(this.cameraRig.quaternion);
        gsap.killTweensOf(this.cameraRig.rotation);
    }

    _startCinematicDrift() {
        if (this._isLoginActive() || this._isGamePaused() || document.body.classList.contains('init-mode-active')) {
            return;
        }

        gsap.to(this.cameraRig.position, {
            x: 178,
            y: 7218,
            z: 1816,
            duration: 34,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to(this.cameraRig.rotation, {
            y: this.cameraRig.rotation.y + 0.018,
            duration: 42,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    _startWarpShake() {
        this._stopWarpShake();
        this.shakeActive = true;

        const shakeStep = () => {
            if (!this.shakeActive) {
                return;
            }

            gsap.to(this.cameraShakeRig.position, {
                x: THREE.MathUtils.randFloatSpread(1.6),
                y: THREE.MathUtils.randFloatSpread(1.1),
                duration: 0.06,
                ease: 'sine.inOut',
                onComplete: shakeStep
            });
        };

        shakeStep();
    }

    _stopWarpShake() {
        this.shakeActive = false;
        gsap.killTweensOf(this.cameraShakeRig.position);
        gsap.to(this.cameraShakeRig.position, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.18,
            ease: 'power2.out'
        });
    }

    _adaptFOVByAspect() {
        if (!this.camera) return;
        if (this._isLoginActive() || this._isGamePaused() || this.state === CAMERA_STATES.MOUSE_UI || gsap.isTweening(this.camera)) {
            return;
        }

        const aspect = Math.max(0.1, window.innerWidth / window.innerHeight);
        const baseFov = aspect < 1 ? this.portraitFov : this.landscapeFov;
        const aspectScalar = THREE.MathUtils.clamp(1 + (1.0 - Math.min(aspect, 1)) * 0.25, 0.85, 1.15);
        const targetFov = THREE.MathUtils.clamp(baseFov * aspectScalar, this.minFov, this.maxFov);

        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
    }

    _syncRigEulerFromQuaternion() {
        const rigEuler = new THREE.Euler().setFromQuaternion(this.cameraRig.quaternion, 'YXZ');
        this.pitch = rigEuler.x;
        this.yaw = rigEuler.y;
    }

    _guardTransforms() {
        if (!Number.isFinite(this.cameraRig.position.x) || !Number.isFinite(this.cameraRig.position.y) || !Number.isFinite(this.cameraRig.position.z)) {
            this.cameraRig.position.set(0, 80, 400);
        }

        if (!Number.isFinite(this.cameraRig.quaternion.x) || !Number.isFinite(this.cameraRig.quaternion.y) || !Number.isFinite(this.cameraRig.quaternion.z) || !Number.isFinite(this.cameraRig.quaternion.w)) {
            this.cameraRig.quaternion.identity();
            this._syncRigEulerFromQuaternion();
        }

        this.cameraRig.quaternion.normalize();
    }

    _isUiInteractionTarget(target) {
        return !!target?.closest?.(
            [
                '#window-layer',
                '#kernel-bar',
                '#initial-menu-overlay',
                '#login-screen',
                '#lulu-panel',
                '#lulu-manual-panel',
                '#lulu-response-panel',
                '#lulu-response-wrap',
                '#lulu-modeler-panel',
                '.glass-window',
                '.window-shelf',
                '.kernel-dock',
                '.lulu-command-input',
                '.helmet-transmission',
                '.transmission-close',
                'button',
                'input',
                'textarea',
                'select',
                '[contenteditable="true"]',
            ].join(', ')
        );
    }

    _isTypingTarget(target) {
        return !!target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        );
    }

    // ── Surface Patch per-frame update ───────────────────────────────────────
    _tickSurfacePatch(delta) {
        if (!this._surfacePatch?.isAttached) return;
        this._surfacePatch.update(this.camera.position, delta);
    }
}
