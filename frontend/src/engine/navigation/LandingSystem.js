import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';

/**
 * LandingSystem
 *
 * Proximity sensor for planetary landing.
 * Tracks altitude while the camera is focused on a target mass.
 */
export class LandingSystem {
    static phase = 'navigation';

    constructor(services) {
        this.services = services;
        this.events = Registry.tryGet('events');

        // Units from planet surface where the landing hint appears.
        this.autoDescentThreshold = 280;
        this._lastNearPlanet = null;
        this._lastPlanet = null;
        this._lastAltitude = Number.POSITIVE_INFINITY;
        this._lastRadius = 0;

        this._cameraWorldPos = new THREE.Vector3();
        this._planetWorldPos = new THREE.Vector3();
    }

    init() {
        console.log('[LandingSystem] Proximity sensors online.');

        // Legacy/EventBus compatibility path.
        if (this.events?.on) {
            this.events.on('WARP_FLIGHT_COMPLETE', () => this._onWarpComplete());
        }

        // Canonical browser event path.
        window.addEventListener('WARP_FLIGHT_COMPLETE', () => this._onWarpComplete());
        window.addEventListener('LANDING_COMPLETE', () => {
            this._lastNearPlanet = null;
            this._lastPlanet = null;
            this._lastAltitude = Number.POSITIVE_INFINITY;
            this._lastRadius = 0;
        });
    }

    _onWarpComplete() {
        this._lastNearPlanet = null;
    }

    update(_delta, _time) {
        const nav = Registry.tryGet('navigationSystem') ?? window.engine?.navigationSystem;
        if (!nav) return;

        const state = nav.getCameraMode?.() ?? nav.fsm?.currentStateId ?? nav.state;
        if (state === 'ORBITAL_DESCENT') return;

        const isFocus = state === 'FOCUS';
        if (!isFocus || !nav.focusTarget) return;

        const planet = nav.focusTarget;
        if (!planet.geometry) return;

        const cameraRig = Registry.tryGet('cameraRig') ?? window.engine?.cameraRig ?? window.engine?.camera;
        if (!cameraRig) return;

        planet.geometry.computeBoundingSphere?.();
        const sphereR = planet.geometry.boundingSphere?.radius ?? 1;
        const worldScale = Math.max(planet.scale.x, planet.scale.y, planet.scale.z);
        const radius = sphereR * worldScale;

        if (planet.getWorldPosition) {
            planet.getWorldPosition(this._planetWorldPos);
        } else {
            this._planetWorldPos.copy(planet.position);
        }

        if (cameraRig.getWorldPosition) {
            cameraRig.getWorldPosition(this._cameraWorldPos);
        } else if (cameraRig.position) {
            this._cameraWorldPos.copy(cameraRig.position);
        } else {
            return;
        }

        const dist = this._cameraWorldPos.distanceTo(this._planetWorldPos);
        const altitude = dist - radius;
        this._lastPlanet = planet;
        this._lastAltitude = altitude;
        this._lastRadius = radius;

        window.dispatchEvent(new CustomEvent('PLANET_PROXIMITY', {
            detail: { altitude, radius, planet }
        }));

        if (altitude < this.autoDescentThreshold && this._lastNearPlanet !== planet) {
            this._lastNearPlanet = planet;
            console.log(`[LandingSystem] Close approach detected. Altitude ${altitude.toFixed(0)}. Press [L] to land.`);
            window.dispatchEvent(new CustomEvent('SHOW_LARGE_NOTIFICATION', {
                detail: {
                    target: planet,
                    message: 'Proximidad orbital detectada. Presiona [L] para iniciar el descenso.'
                }
            }));
        }
    }

    getProximitySnapshot(targetPlanet = null) {
        const planet = targetPlanet ?? this._lastPlanet ?? null;
        const isSamePlanet =
            !!planet &&
            (planet === this._lastPlanet ||
                (planet?.userData?.appId && planet.userData.appId === this._lastPlanet?.userData?.appId));

        return {
            planet,
            altitude: isSamePlanet ? this._lastAltitude : Number.POSITIVE_INFINITY,
            radius: isSamePlanet ? this._lastRadius : 0,
            threshold: this.autoDescentThreshold,
            canDescend: isSamePlanet && this._lastAltitude <= this.autoDescentThreshold,
        };
    }

    canTriggerOrbitalDescent(targetPlanet = null) {
        return this.getProximitySnapshot(targetPlanet).canDescend;
    }
}
