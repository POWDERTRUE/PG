import { gsap } from 'gsap';
import { WindowDOMSystem } from './systems/WindowDOMSystem.js';
import { Registry } from '../engine/core/ServiceRegistry.js';

export class WindowManager {
    constructor(layerEl = null, scene = null) {
        this.domSystem = new WindowDOMSystem(layerEl, scene);
        this.scene = scene;
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.isInitialized = false;
        this.onAppLaunch = this.onAppLaunch.bind(this);
        this.onTargetWindowRequest = this.onTargetWindowRequest.bind(this);
    }

    initialize() {
        if (this.isInitialized) {
            return;
        }
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.domSystem.initialize?.();
        window.addEventListener('WARP_FLIGHT_COMPLETE', this.onAppLaunch);
        this._removeWindowRequestListener = this.runtimeSignals?.on?.('PG:REQUEST_WINDOW_OPEN', this.onTargetWindowRequest) || null;
        this.isInitialized = true;
        console.log('%c[WindowManager] Listening for WARP_FLIGHT_COMPLETE.', 'color:#00ffcc');
    }

    dispose() {
        if (!this.isInitialized) {
            return;
        }
        this.domSystem.dispose?.();
        window.removeEventListener('WARP_FLIGHT_COMPLETE', this.onAppLaunch);
        this._removeWindowRequestListener?.();
        this._removeWindowRequestListener = null;
        this.isInitialized = false;
    }

    getWindowDOMSystem() {
        return this.domSystem;
    }

    getWindowLayer() {
        return this.domSystem?.container || null;
    }

    getWorkspaceWindows() {
        return this.domSystem?.getWorkspaceWindows?.() || [];
    }

    onAppLaunch(event) {
        const payload = event.detail || {};
        if (payload.openWindow !== true) return;
        this._openWindowFromPayload(payload);
    }

    onTargetWindowRequest(event) {
        this._openWindowFromPayload(event?.detail || event || {});
    }

    openApp(appId, payload = {}) {
        if (!appId) {
            return null;
        }

        return this._openWindowFromPayload({
            ...payload,
            appId,
            openWindow: true,
            source: payload.source || 'window-manager',
        });
    }

    _openWindowFromPayload(payload) {
        const appId = payload.appId;
        const nodeType = payload.nodeType;

        if (!appId) {
            return;
        }

        if (nodeType === 'planet' || nodeType === 'star') {
            this.activateMetamorphMoon(appId);
        }

        if (appId === 'gallery') {
            const galleryAppWindow = Registry.tryGet('GalleryAppWindow');
            if (galleryAppWindow?.openFromPayload) {
                return galleryAppWindow.openFromPayload(payload);
            }
        }

        return this.domSystem.injectWindow(appId, payload);
    }

    activateMetamorphMoon(appId) {
        if (!this.scene) {
            return;
        }

        const moons = [];
        this.scene.traverse((object) => {
            if (object.userData?.isMetamorphMoon) {
                moons.push(object);
            }
        });

        for (let i = 0; i < moons.length; i++) {
            const moon = moons[i];
            const isTarget = moon.userData?.parentAppId === appId;

            gsap.killTweensOf(moon.scale);
            this._killMaterialTweens(moon);

            if (isTarget) {
                moon.visible = true;
                gsap.to(moon.scale, {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: 0.55,
                    ease: 'back.out(1.6)'
                });

                this._tweenMaterialOpacity(moon, 1, 0.35, 'power2.out');
            } else {
                gsap.to(moon.scale, {
                    x: 0.001,
                    y: 0.001,
                    z: 0.001,
                    duration: 0.28,
                    ease: 'power2.in',
                    onComplete: () => {
                        moon.visible = false;
                    }
                });

                this._tweenMaterialOpacity(moon, 0.18, 0.22, 'power2.in');
            }
        }
    }

    _killMaterialTweens(object) {
        object.traverse((child) => {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (let i = 0; i < materials.length; i++) {
                if (materials[i]) {
                    gsap.killTweensOf(materials[i]);
                }
            }
        });
    }

    _tweenMaterialOpacity(object, opacityFactor, duration, ease) {
        object.traverse((child) => {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];
                if (!material || typeof material.opacity !== 'number') {
                    continue;
                }

                const baseOpacity = child.userData?.baseOpacity ?? material.opacity;
                material.transparent = true;
                gsap.to(material, {
                    opacity: Math.max(0.04, baseOpacity * opacityFactor),
                    duration,
                    ease
                });
            }
        });
    }
}
