import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';
import { gsap } from 'gsap';

export class InteractionEventSystem {
    constructor() {
        this.events = Registry.get('events');
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.isEnabled = false;
        this.selectedObject = null;
        
        this.onObjectSelected = this.onObjectSelected.bind(this);
        this.onObjectOpenRequested = this.onObjectOpenRequested.bind(this);
        this.onSelectionCleared = this.onSelectionCleared.bind(this);
    }

    clearSelection() {
        this.selectedObject = null;
    }

    setWindowDOMSystem(domSystem) {
        this.windowDOMSystem = domSystem;
    }

    enable() {
        if (this.isEnabled) return;
        this.events.on('OBJECT_SELECTED', this.onObjectSelected);
        this.events.on('OBJECT_OPEN_REQUEST', this.onObjectOpenRequested);
        this.events.on('OBJECT_SELECTION_CLEARED', this.onSelectionCleared);
        this.isEnabled = true;
    }

    disable() {
        if (!this.isEnabled) return;
        this.events.removeListener('OBJECT_SELECTED', this.onObjectSelected);
        this.events.removeListener('OBJECT_OPEN_REQUEST', this.onObjectOpenRequested);
        this.events.removeListener('OBJECT_SELECTION_CLEARED', this.onSelectionCleared);
        this.isEnabled = false;
    }

    onSelectionCleared() {
        this.clearSelection();
    }

    onObjectSelected({ object, rawEvent }) {
        const input = Registry.tryGet('InputStateSystem') ?? window.engine?.inputStateSystem ?? null;
        const nav = Registry.tryGet('navigationSystem') ?? window.engine?.navigationSystem ?? null;
        const focused = nav?.focusTarget ?? null;
        const sameFocus = object === focused || (object.userData?.appId && object.userData.appId === focused?.userData?.appId);
        const hudMode = !!input?.hudMode;
        this.selectedObject = object;
        const spatialType = object.userData.spatialType || this._inferSpatialType(object);

        switch (spatialType) {
            case 'PLANET':
            case 'STAR':
                if (this._requestContextWindowOpen(object, hudMode, sameFocus, rawEvent)) {
                    break;
                }
                console.log('%c[Pipeline] 3. PLANET_SELECTED', 'color:#00ff55', object.name || object.userData.appId);
                this.events.emit('PLANET_SELECTED', { object });
                break;

            case 'SATELLITE':
                if (this._requestContextWindowOpen(object, hudMode, sameFocus, rawEvent)) {
                    break;
                }
                console.log('%c[Pipeline] 3. SATELLITE_SELECTED', 'color:#00ff55');
                this.events.emit('SATELLITE_SELECTED', { object });
                window.dispatchEvent(new CustomEvent('SATELLITE_CLICKED', {
                    detail: {
                        satellite: object,
                        massObject: this._resolveSatelliteMass(object)
                    }
                }));
                break;

            case 'DRONE':
                this.events.emit('DRONE_SELECTED', { object });
                
                // Drone Hold logic simulated
                gsap.to(object.scale, { x: 0.8, y: 0.8, z: 0.8, duration: 0.2, yoyo: true, repeat: 1 });
                window.dispatchEvent(new CustomEvent('DRONE_HOLD_COMPLETE', { detail: { drone: object } }));
                
                if (this.windowDOMSystem && object.userData.droneWindowId) {
                    this.windowDOMSystem.setWindowCollapsed(object.userData.droneWindowId, false);
                }
                break;
                
            default:
                console.log("[InteractionEventSystem] Unknown SpatialType Selected:", spatialType, object);
        }
    }

    onObjectOpenRequested({ object }) {
        if (!object) return;

        const spatialType = object.userData.spatialType || this._inferSpatialType(object);
        const focused = Registry.tryGet('navigationSystem')?.focusTarget ?? window.engine?.navigationSystem?.focusTarget ?? null;
        const sameFocus = object === focused || (object.userData?.appId && object.userData.appId === focused?.userData?.appId);
        if (object !== this.selectedObject && !sameFocus) {
            return;
        }

        if ((spatialType === 'PLANET' || spatialType === 'STAR' || spatialType === 'SATELLITE') && object.userData?.appId) {
            this._emitRequestWindowOpen({
                ...object.userData,
                targetName: object.name || object.userData?.appName || null,
                openWindow: true,
            });
        }
    }

    _requestContextWindowOpen(object, hudMode, sameFocus, rawEvent) {
        if (!hudMode || !sameFocus || rawEvent?.button !== 0 || !object?.userData?.appId) {
            return false;
        }

        this._emitRequestWindowOpen({
            ...object.userData,
            targetName: object.name || object.userData?.appName || null,
            openWindow: true,
            source: 'hud-context-click',
        });
        return true;
    }

    _emitRequestWindowOpen(detail) {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (this.runtimeSignals?.emit) {
            this.runtimeSignals.emit('PG:REQUEST_WINDOW_OPEN', detail);
            return;
        }
        window.dispatchEvent(new CustomEvent('PG:REQUEST_WINDOW_OPEN', { detail }));
    }

    _inferSpatialType(object) {
        if (object.userData.isDrone || object.userData.isNotifier || object.userData.spatialType === 'DRONE') return 'DRONE';
        if (object.userData.isSatellite || object.userData.isMetamorphMoon || object.userData.nodeType === 'metamorph-moon') return 'SATELLITE';
        if (object.userData.isApp) return 'PLANET';
        if (object.userData.isNode || object.userData.nodeType === 'planet' || object.userData.nodeType === 'star') return 'PLANET';
        return 'UNKNOWN';
    }

    _resolveSatelliteMass(object) {
        if (object?.userData?.parentMass) {
            return object.userData.parentMass;
        }

        let current = object?.parent ?? null;
        while (current) {
            if (
                current.userData?.isMass &&
                !current.userData?.isSatellite &&
                !current.userData?.isMetamorphMoon &&
                !(current.name || '').startsWith('Hitbox_')
            ) {
                return current;
            }
            current = current.parent ?? null;
        }

        return object;
    }
}
