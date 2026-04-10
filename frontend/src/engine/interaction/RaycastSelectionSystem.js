import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { CAMERA_STATES } from '../navigation/UniverseNavigationSystem.js';
import { OperativeContexts } from '../input/InputStateSystem.js';

const TACTICAL_LEFT_CLICK_SIGNAL = 'PG:INPUT:TACTICAL_LEFT_CLICK';
const TACTICAL_RIGHT_CLICK_SIGNAL = 'PG:INPUT:TACTICAL_RIGHT_CLICK';
const GESTURE_TAP_SIGNAL = 'PG:INPUT:GESTURE_TAP';
const GESTURE_DOUBLE_TAP_SIGNAL = 'PG:INPUT:GESTURE_DOUBLE_TAP';
const GESTURE_LONG_PRESS_SIGNAL = 'PG:INPUT:GESTURE_LONG_PRESS';
const TACTICAL_READOUT_SIGNAL = 'PG:OS:TACTICAL_READOUT_REQUESTED';
const TACTICAL_CLEAR_READOUT_SIGNAL = 'PG:OS:CLEAR_TACTICAL_READOUT';
const OPEN_CONTEXT_MENU_SIGNAL = 'PG:OS:OPEN_CONTEXT_MENU';
const CLOSE_CONTEXT_MENU_SIGNAL = 'PG:OS:CLOSE_CONTEXT_MENU';
const TRACKER_FALLBACK_RADIUS_PX = 72;

export class RaycastSelectionSystem {
    constructor(camera, sceneGraph, navigationSystem) {
        this.camera = camera;
        this.sceneGraph = sceneGraph;
        this.navigationSystem = navigationSystem;
        this.events = Registry.get('events');
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 50000; // Must match camera far plane (planets at Y=0, camera at Y=11000)
        this.raycaster.near = 0.1;
        this.mouse = new THREE.Vector2(-9999, -9999);
        this.pointerRaw = { x: -9999, y: -9999 };
        this.hoverPoint = new THREE.Vector3();
        this.hasHoverPoint = false;
        this.hoverRetentionMs = 90;
        this.lastHoverHitAt = 0;
        this._navigationPoint = new THREE.Vector3();
        this._navigationNormal = new THREE.Vector3();
        this._fallbackPoint = new THREE.Vector3();
        this._fallbackNormal = new THREE.Vector3();
        this._normalMatrix = new THREE.Matrix3();
        
        this.hoveredNode = null;
        this.activeTarget = null;
        this.isEnabled = false;
        
        this.updateMouse = this.updateMouse.bind(this);
        this.handleSelectRequest = this.handleSelectRequest.bind(this);
        this.handleDoubleClick = this.handleDoubleClick.bind(this);
        this.handleTacticalLeftClick = this.handleTacticalLeftClick.bind(this);
        this.handleTacticalRightClick = this.handleTacticalRightClick.bind(this);
        this.handleGestureTap = this.handleGestureTap.bind(this);
        this.handleGestureDoubleTap = this.handleGestureDoubleTap.bind(this);
        this.handleGestureLongPress = this.handleGestureLongPress.bind(this);
        this.update = this.update.bind(this);
        this._removeTacticalLeftListener = null;
        this._removeTacticalRightListener = null;
        this._removeGestureTapListener = null;
        this._removeGestureDoubleTapListener = null;
        this._removeGestureLongPressListener = null;

        // Auto-enable on first update (avoids needing explicit enable() call)
        setTimeout(() => this.enable(), 1000);
    }

    enable() {
        if (this.isEnabled) return;
        this.events.on('INPUT_POINTER_MOVE', this.updateMouse);
        this.events.on('INPUT_POINTER_SELECT_REQUEST', this.handleSelectRequest);
        if (this.runtimeSignals?.on) {
            this._removeTacticalLeftListener = this.runtimeSignals.on(
                TACTICAL_LEFT_CLICK_SIGNAL,
                this.handleTacticalLeftClick
            );
            // TACTICAL_RIGHT_CLICK_SIGNAL eliminado — botón derecho es nulo en OMEGA V31
            this._removeGestureTapListener = this.runtimeSignals.on(
                GESTURE_TAP_SIGNAL,
                this.handleGestureTap
            );
            this._removeGestureDoubleTapListener = this.runtimeSignals.on(
                GESTURE_DOUBLE_TAP_SIGNAL,
                this.handleGestureDoubleTap
            );
            this._removeGestureLongPressListener = this.runtimeSignals.on(
                GESTURE_LONG_PRESS_SIGNAL,
                this.handleGestureLongPress
            );
        }
        window.addEventListener('dblclick', this.handleDoubleClick);
        // Fallback: direct window listener guarantees mouse position is always tracked
        this._onMouseMove = (e) => this.updateMouse({ x: e.clientX, y: e.clientY, target: e.target });
        this._onContextMenu = (e) => {
            e.preventDefault();
            if (false) {
                e.preventDefault();
                console.log('%c[Pipeline] RIGHT_CLICK → PLANET_SELECTED', 'color:#ff8800', hit.object.name);
                this.events.emit('PLANET_SELECTED', { object: hit.object });
            }
        };
        window.addEventListener('mousemove', this._onMouseMove, { passive: true });
        this.isEnabled = true;
    }

    disable() {
        if (!this.isEnabled) return;
        this.events.removeListener('INPUT_POINTER_MOVE', this.updateMouse);
        this.events.removeListener('INPUT_POINTER_SELECT_REQUEST', this.handleSelectRequest);
        this._removeTacticalLeftListener?.();
        this._removeTacticalLeftListener = null;
        this._removeTacticalRightListener?.();
        this._removeTacticalRightListener = null;
        this._removeGestureTapListener?.();
        this._removeGestureTapListener = null;
        this._removeGestureDoubleTapListener?.();
        this._removeGestureDoubleTapListener = null;
        this._removeGestureLongPressListener?.();
        this._removeGestureLongPressListener = null;
        window.removeEventListener('dblclick', this.handleDoubleClick);
        window.removeEventListener('mousemove', this._onMouseMove);
        this.isEnabled = false;
        this.clearHover();
    }

    _getRendererDomElement() {
        if (this.renderer && this.renderer.domElement) return this.renderer.domElement;
        // Fallback por si no est\u00e1 en Registry
        const canvas = document.querySelector('canvas');
        return canvas || document.body;
    }

    updateMouse(data) {
        if (this._isUiTarget(data.target)) {
            this.clearHover();
            return;
        }

        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
            return;
        }

        this._setPointerAim(data.x, data.y);
    }

    handleSelectRequest(data) {
        if (data.button !== 2) return;
        if (this._isUiTarget(data.target)) return;

        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
        } else if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
            this._setPointerAim(data.x, data.y);
        }

        const hit = this.getSelection();
        if (hit) {
            this.activeTarget = hit.object;
            console.log('%c[Pipeline] 2. OBJECT_SELECTED', 'color:#00ffea', hit.object.name || hit.object.userData.appId);
            this.events.emit('OBJECT_SELECTED', {
                object: hit.object,
                point: hit.point,
                rawEvent: data
            });
        } else {
            this.activeTarget = null;
            this.events.emit('OBJECT_SELECTION_CLEARED', { rawEvent: data });
            this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
            this.runtimeSignals?.emit?.('PG:NAV:REQUEST_CLEAR_SELECTION', {
                controlId: 'DESELECT_MASS',
                action: 'CLEAR_SELECTION',
                signal: 'PG:NAV:REQUEST_CLEAR_SELECTION',
                cameraMode: data.cameraMode ?? null,
                contextMode: data.contextMode ?? null,
                source: 'raycast-selection',
                button: data.button ?? 2,
            });
        }
    }

    handleDoubleClick(event) {
        if (event.button !== 2) return;
        if (this._isUiTarget(event.target)) return;

        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
        } else if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            this._setPointerAim(event.clientX, event.clientY);
        }

        const hit = this.getSelection();
        if (!hit) return;

        this.activeTarget = hit.object;
        this.events.emit('OBJECT_OPEN_REQUEST', {
            object: hit.object,
            point: hit.point,
            rawEvent: event
        });
    }

    handleTacticalLeftClick(payload = {}) {
        if (this._isUiTarget(payload.target)) {
            return;
        }

        const hit = this._performRaycastForNDC(payload.ndc);
        if (!hit?.object) {
            this.runtimeSignals?.emit?.(TACTICAL_CLEAR_READOUT_SIGNAL, {
                source: 'raycast-selection',
            });
            this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, {
                source: 'raycast-selection',
            });
            return;
        }

        this.activeTarget = hit.object;
        this.runtimeSignals?.emit?.(TACTICAL_READOUT_SIGNAL, {
            source: 'raycast-selection',
            targetId: hit.object.uuid,
            deterministicKey: hit.object.userData?.deterministicKey ?? null,
            name: hit.object.userData?.appName || hit.object.userData?.label || hit.object.name || 'Anomalia desconocida',
            massData: hit.object.userData ?? {},
            point: {
                x: hit.point.x,
                y: hit.point.y,
                z: hit.point.z,
            },
        });
        this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, {
            source: 'raycast-selection',
        });
    }

    handleGestureTap(payload = {}) {
        // Solo clic izquierdo. Button 2 muere en _isGesturePointer (HAL).
        if ((payload?.button ?? 0) !== 0) return;

        if (payload?.context === 'COSMOS_MAP') {
            const hit = this._handleCosmosRaycast(payload.ndc);
            if (hit) {
                this.runtimeSignals?.emit?.('PG:OS:COSMOS_TARGET_SELECTED', {
                    index: hit.index,
                    point: hit.point,
                    source: 'cosmos-raycast'
                });
            } else {
                this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, { source: 'cosmos-raycast' });
            }
            return;
        }

        if (payload?.context === 'MACRO_MAP') {
            const hit = this._handleMacroRaycast(payload.ndc);
            if (hit) {
                this.runtimeSignals?.emit?.('PG:OS:MACRO_TARGET_SELECTED', {
                    index: hit.index,
                    point: hit.point,
                    source: 'macro-raycast'
                });
            } else {
                this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, { source: 'macro-raycast' });
            }
            return;
        }

        if (payload?.context === OperativeContexts.OPS) {
            this.handleTacticalLeftClick(payload);
            return;
        }

        this._handleHelmTap(payload);
    }

    handleGestureDoubleTap(payload = {}) {
        if ((payload?.button ?? 0) !== 0) return;

        if (payload?.context === 'COSMOS_MAP') {
            const hit = this._handleCosmosRaycast(payload.ndc);
            if (hit) {
                this.runtimeSignals?.emit?.('PG:OS:COSMOS_DOUBLE_TAP', {
                    index: hit.index,
                    point: hit.point,
                    source: 'cosmos-raycast'
                });
                this.runtimeSignals?.emit?.('PG:OS:COSMOS_WARP_TARGET', {
                    targetId: hit.index,
                    targetPosition: hit.point,
                });
            }
            return;
        }

        if (payload?.context === 'MACRO_MAP') {
            const hit = this._handleMacroRaycast(payload.ndc);
            if (hit) {
                this.runtimeSignals?.emit?.('PG:OS:MACRO_DOUBLE_TAP', {
                    index: hit.index,
                    point: hit.point,
                    source: 'macro-raycast'
                });
            }
            return;
        }

        if (payload?.context !== OperativeContexts.HELM || this._isUiTarget(payload.target)) {
            return;
        }

        const hit = this._performRaycastForNDC(payload.ndc);
        const trackerFallback = !hit ? this._resolveTrackerFallback(payload.ndc) : null;
        const targetObject = hit?.object ?? trackerFallback?.object ?? this.activeTarget ?? this.hoveredNode ?? null;
        if (!targetObject) {
            return;
        }

        this.activeTarget = targetObject;
        this.runtimeSignals?.emit?.('PG:NAV:REQUEST_PRECISION_TRAVEL', {
            source: 'gesture-double-tap',
            targetId: targetObject.uuid,
            deterministicKey:
                targetObject.userData?.deterministicKey ??
                trackerFallback?.deterministicKey ??
                this.activeTarget?.userData?.deterministicKey ??
                null,
        });
    }

    handleGestureLongPress(payload = {}) {
        // Solo clic izquierdo (button 0). Funciona en cualquier contexto (HELM y OPS).
        if ((payload?.button ?? 0) !== 0) return;
        this.handleTacticalRightClick(payload);
    }

    handleTacticalRightClick(payload = {}) {
        if (this._isUiTarget(payload.target)) {
            return;
        }

        if (payload?.context === 'COSMOS_MAP') {
            const hit = this._handleCosmosRaycast(payload.ndc);
            if (!hit) {
                this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, { source: 'cosmos-raycast' });
                return;
            }
            const screen = this._ndcToScreen(payload.ndc);
            this.runtimeSignals?.emit?.(OPEN_CONTEXT_MENU_SIGNAL, {
                source: 'cosmos-raycast',
                targetId: hit.index,
                deterministicKey: `COSMOS_GALAXY_${hit.index}`,
                screenX: screen.x,
                screenY: screen.y,
                scale: 'COSMOS',
                massData: { isCosmosGalaxy: true, galaxyIndex: hit.index },
            });
            return;
        }

        if (payload?.context === 'MACRO_MAP') {
            const hit = this._handleMacroRaycast(payload.ndc);
            if (!hit) {
                this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, { source: 'macro-raycast' });
                return;
            }
            const screen = this._ndcToScreen(payload.ndc);
            this.runtimeSignals?.emit?.(OPEN_CONTEXT_MENU_SIGNAL, {
                source: 'macro-raycast',
                targetId: hit.index,
                deterministicKey: `MACRO_STAR_${hit.index}`,
                screenX: screen.x,
                screenY: screen.y,
                scale: 'MACRO',
                massData: { isMacroStar: true, starIndex: hit.index },
            });
            return;
        }

        const hit = this._performRaycastForNDC(payload.ndc);
        const trackerFallback = !hit ? this._resolveTrackerFallback(payload.ndc) : null;
        const targetObject = hit?.object ?? trackerFallback?.object ?? null;
        if (!targetObject) {
            this.runtimeSignals?.emit?.(CLOSE_CONTEXT_MENU_SIGNAL, {
                source: 'raycast-selection',
            });
            return;
        }

        this.activeTarget = targetObject;
        const screen = this._ndcToScreen(payload.ndc);
        this.runtimeSignals?.emit?.(OPEN_CONTEXT_MENU_SIGNAL, {
            source: 'raycast-selection',
            targetId: targetObject.uuid,
            deterministicKey: targetObject.userData?.deterministicKey ?? trackerFallback?.deterministicKey ?? null,
            screenX: screen.x,
            screenY: screen.y,
            massData: targetObject.userData ?? trackerFallback?.massData ?? {},
        });
    }

    _handleMacroRaycast(ndc) {
        const mapSystem = Registry.tryGet('OntologyMapSystem') || window.Registry?.tryGet('OntologyMapSystem');
        if (!mapSystem || !mapSystem.starCloud || !mapSystem.macroCamera) return null;

        const dist = mapSystem.macroCamera.position.length();
        // Umbral Escalable basado en la Distancia (Evita pesadillas en el core galáctico)
        this.raycaster.params.Points.threshold = Math.max(2.0, dist * 0.005);
        this.raycaster.setFromCamera(ndc || new THREE.Vector2(0, 0), mapSystem.macroCamera);

        const intersects = this.raycaster.intersectObject(mapSystem.starCloudContainer, true);
        if (intersects.length > 0) {
            return intersects[0];
        }
        return null;
    }

    _handleCosmosRaycast(ndc) {
        const cosmosSystem = Registry.tryGet('CosmosMapSystem') || window.Registry?.tryGet('CosmosMapSystem');
        if (!cosmosSystem || !cosmosSystem.cosmicWeb || !cosmosSystem.cosmosCamera) return null;

        const dist = cosmosSystem.cosmosCamera.position.length();
        this.raycaster.params.Points.threshold = Math.max(5.0, dist * 0.015);
        this.raycaster.setFromCamera(ndc || new THREE.Vector2(0, 0), cosmosSystem.cosmosCamera);

        const intersects = this.raycaster.intersectObject(cosmosSystem.cosmicWebContainer, true);
        if (intersects.length > 0) {
            return intersects[0];
        }
        return null;
    }

    _handleHelmTap(payload = {}) {
        if (this._isUiTarget(payload.target)) {
            return;
        }

        const hit = this._performRaycastForNDC(payload.ndc);
        if (hit?.object) {
            this.activeTarget = hit.object;
            this.events.emit('OBJECT_SELECTED', {
                object: hit.object,
                point: hit.point,
                rawEvent: payload,
            });
            return;
        }

        this.activeTarget = null;
        this.events.emit('OBJECT_SELECTION_CLEARED', { rawEvent: payload });
        this.runtimeSignals?.emit?.('PG:NAV:REQUEST_CLEAR_SELECTION', {
            controlId: 'DESELECT_MASS',
            action: 'CLEAR_SELECTION',
            signal: 'PG:NAV:REQUEST_CLEAR_SELECTION',
            cameraMode: payload.cameraMode ?? null,
            contextMode: payload.contextMode ?? null,
            source: 'gesture-tap',
            button: 0,
        });
    }

    // El Update se usa solo para el Hovering (FrameScheduler)
    update(delta) {
        if (!this.isEnabled) return;

        // Only fully block raycasting during cinematic WARP — hover works in all other states
        const state = this.navigationSystem.state;
        if (state === 'WARP' || state === CAMERA_STATES.WARPING) {
            this.clearHover();
            return;
        }

        this._processHover();
    }

    _processHover() {
        const now = performance.now();
        const isFps = this.navigationSystem.state === CAMERA_STATES.FIRST_PERSON_WALK;
        const isCenteredAim = this._shouldUseCenteredAim();
        if (isCenteredAim) this._setCenteredAim();

        const hit = this.getSelection();
        const mouseSnapshot = { x: this.mouse.x, y: this.mouse.y };

        if (hit) {
            this.lastHoverHitAt = now;
            this.hoverPoint.copy(hit.point);
            this.hasHoverPoint = true;
            if (hit.object !== this.hoveredNode) {
                this.clearHover();
                this.hoveredNode = hit.object;
                this.hoverPoint.copy(hit.point);
                this.hasHoverPoint = true;

                // Emit hover start for HUD System
                this.events.emit('INTERACTION:HOVER_START', { 
                    node: this.hoveredNode, 
                    isFps, 
                    mouse: mouseSnapshot
                });
            } else {
                // Continuous hover update
                this.events.emit('INTERACTION:HOVER_UPDATE', {
                    node: this.hoveredNode,
                    mouse: mouseSnapshot
                });
            }
        } else {
            if (this.hoveredNode && (now - this.lastHoverHitAt) <= this.hoverRetentionMs) {
                this.events.emit('INTERACTION:HOVER_UPDATE', {
                    node: this.hoveredNode,
                    mouse: mouseSnapshot
                });
                return;
            }
            this.clearHover();
        }
    }

    clearHover() {
        if (!this.hoveredNode) return;
        this.events.emit('INTERACTION:HOVER_END', { node: this.hoveredNode });
        this.hoveredNode = null;
        this.hasHoverPoint = false;
    }

    getHoverNode() {
        return this.hoveredNode;
    }

    getHoverPoint() {
        return this.hasHoverPoint ? this.hoverPoint : null;
    }

    getActiveTarget() {
        return this.activeTarget || this.hoveredNode;
    }

    clearSelection() {
        this.activeTarget = null;
    }

    getNavigationTarget({ fallbackDistance = 240 } = {}) {
        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.sceneGraph.scene.children, true);

        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (this._shouldIgnoreNavigationHit(hit.object)) {
                continue;
            }

            this._navigationPoint.copy(hit.point);
            this._resolveWorldNormalFromHit(this._navigationNormal, hit);
            return {
                point: this._navigationPoint,
                normal: this._navigationNormal,
                object: this._resolveInteractiveNode(hit.object) || hit.object,
                hit,
                fromFallback: false,
            };
        }

        this._fallbackPoint
            .copy(this.raycaster.ray.direction)
            .multiplyScalar(fallbackDistance)
            .add(this.raycaster.ray.origin);
        this._fallbackNormal
            .copy(this.raycaster.ray.direction)
            .multiplyScalar(-1)
            .normalize();

        return {
            point: this._fallbackPoint,
            normal: this._fallbackNormal,
            object: null,
            hit: null,
            fromFallback: true,
        };
    }

    getPointerState() {
        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
        }
        return {
            x: this.pointerRaw.x,
            y: this.pointerRaw.y,
            ndcX: this.mouse.x,
            ndcY: this.mouse.y
        };
    }

    getSelection() {
        if (this._shouldUseCenteredAim()) {
            this._setCenteredAim();
        }
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.sceneGraph.scene.children, true);

        // Usamos filter por si existe flag .interactive expl\u00edcito, si no exploramos padres
        for (let i = 0; i < hits.length; i++) {
            const obj = hits[i].object;
            const interactiveNode = (obj.userData && obj.userData.interactive) ? obj : this._resolveInteractiveNode(obj);
            
            if (interactiveNode) {
                return {
                    ...hits[i],
                    object: interactiveNode
                };
            }
        }
        return null;
    }

    _performRaycastForNDC(ndc) {
        if (!ndc || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) {
            return null;
        }

        this.mouse.set(ndc.x, ndc.y);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.sceneGraph.scene.children, true);

        for (let i = 0; i < hits.length; i++) {
            const actionableNode = this._resolveActionableSpatialNode(hits[i].object);
            if (!actionableNode) {
                continue;
            }
            return {
                ...hits[i],
                object: actionableNode,
            };
        }

        return null;
    }

    _resolveTrackerFallback(ndc) {
        if (!ndc || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) {
            return null;
        }

        const tracker = Registry.tryGet('TargetTrackingSystem') ?? Registry.tryGet('targetTrackingSystem');
        const tracked = tracker?.getTrackedTargetDetails?.() ?? null;
        if (!tracked?.object || tracked.behindCamera) {
            return null;
        }

        const screen = this._ndcToScreen(ndc);
        const dx = (tracked.screenX ?? 0) - screen.x;
        const dy = (tracked.screenY ?? 0) - screen.y;
        if ((dx * dx) + (dy * dy) > (TRACKER_FALLBACK_RADIUS_PX * TRACKER_FALLBACK_RADIUS_PX)) {
            return null;
        }

        return tracked;
    }

    _shouldUseCenteredAim() {
        const input = Registry.tryGet('InputStateSystem');
        const pointerLocked = input?.pointer?.locked ?? !!document.pointerLockElement;
        const hudMode = input?.hudMode ?? false;
        return !hudMode && (pointerLocked || this.navigationSystem.state === CAMERA_STATES.FIRST_PERSON_WALK);
    }

    _setCenteredAim() {
        const domElement = this._getRendererDomElement();
        const rect = domElement.getBoundingClientRect();
        this.mouse.set(0, 0);
        this.pointerRaw.x = rect.left + rect.width * 0.5;
        this.pointerRaw.y = rect.top + rect.height * 0.5;
    }

    _setPointerAim(x, y) {
        const domElement = this._getRendererDomElement();
        const rect = domElement.getBoundingClientRect();
        const safeWidth = Math.max(rect.width, 1);
        const safeHeight = Math.max(rect.height, 1);

        this.mouse.x = ((x - rect.left) / safeWidth) * 2 - 1;
        this.mouse.y = -((y - rect.top) / safeHeight) * 2 + 1;
        this.pointerRaw.x = x;
        this.pointerRaw.y = y;
    }

    _resolveInteractiveNode(object) {
        let current = object;
        while (current) {
            // LEY 4 — SupraconsciousnessMass es el Origen del Grafo de Escena.
            // No puede ser seleccionada como masa ordinaria por el raycast.
            if (current.userData?.nodeType === 'supraconsciousness') return null;
            if (current.userData && (current.userData.isApp || current.userData.isNode || current.userData.isDrone || current.userData.isSatellite || current.userData.spatialType)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    _resolveActionableSpatialNode(object) {
        let current = object;
        while (current) {
            if (current.userData?.isHitbox || /^Hitbox_/i.test(current.name || '')) {
                current = current.parent;
                continue;
            }
            if (current.userData?.nodeType === 'supraconsciousness') {
                return null;
            }
            if (
                current.userData?.isMass ||
                current.userData?.isApp ||
                current.userData?.isNode ||
                current.userData?.isSatellite ||
                current.userData?.spatialType ||
                ['planet', 'star', 'moon', 'cluster', 'nebula', 'metamorph-moon'].includes(current.userData?.nodeType)
            ) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    _ndcToScreen(ndc) {
        const domElement = this._getRendererDomElement();
        const rect = domElement.getBoundingClientRect();
        return {
            x: rect.left + (((ndc.x + 1) * 0.5) * rect.width),
            y: rect.top + (((-ndc.y + 1) * 0.5) * rect.height),
        };
    }

    _isUiTarget(target) {
        const input = Registry.tryGet('InputStateSystem');
        if (input?.isHudWorkspaceExclusive?.()) {
            return true;
        }
        return !!target?.closest?.('#window-layer, #kernel-bar, #initial-menu-overlay, #login-screen, .glass-window, .window-shelf, .kernel-dock, .lulu-command-input, #lulu-panel, #lulu-response-panel, #lulu-response-wrap, #lulu-modeler-panel, .helmet-transmission, button, input, textarea, select, [contenteditable=\"true\"]');
    }

    _shouldIgnoreNavigationHit(object) {
        if (!object || object.visible === false) return true;
        if (object.type === 'Line' || object.type === 'LineSegments' || object.type === 'Points') return true;
        if (object.userData?.ignoreNavigationTravel) return true;
        const name = object.name || '';
        if (name.startsWith('Hitbox_')) return true;
        if (name === 'CameraRig' || name === 'CameraMount' || name === 'CameraShakeRig') return true;
        return false;
    }

    _resolveWorldNormalFromHit(target, hit) {
        if (hit?.face?.normal) {
            this._normalMatrix.getNormalMatrix(hit.object.matrixWorld);
            target.copy(hit.face.normal).applyMatrix3(this._normalMatrix).normalize();
            return target;
        }

        target.copy(this.raycaster.ray.direction).multiplyScalar(-1).normalize();
        return target;
    }
}
