/**
 * CockpitState.js - Powder Galaxy
 *
 * First-person ship flight FSM state.
 *
 * Rules:
 *   - Reads input only from InputStateSystem.
 *   - Moves only the ShipRig.
 *   - Delegates physics to ShipRigSystem.applyInputs().
 */
import * as THREE from 'three';
import { CAMERA_STATE } from '../CameraStateMachine.js';
import { Registry } from '../../core/ServiceRegistry.js';
import { ShipController } from '../ShipController.js';

const LOOK_SENSITIVITY = 0.0016;
const MAX_LOOK_DELTA = 110;
const COCKPIT_FOV = 65;

export class CockpitState {
    constructor() {
        this.fsm = null;
        this.nav = null;

        this._inputSys = null;
        this._shipRigSys = null;
        this._windowSys = null;
        this._savedFov = COCKPIT_FOV;
        this._worldPos = new THREE.Vector3();
    }

    enter(data = {}) {
        this._inputSys = Registry.tryGet('InputStateSystem');
        this._shipRigSys = Registry.tryGet('shipRigSystem') ?? window.engine?.shipRigSystem;
        this._windowSys =
            Registry.tryGet('WindowDOMSystem') ??
            Registry.tryGet('windowSystem') ??
            window.engine?.windowDOMSystem ??
            window.engine?.windowSystem;

        if (!this._windowSys) {
            console.error('[CockpitState] WindowDOMSystem not found - HUD will be skipped.');
        } else if (typeof this._windowSys.showCockpitHUD !== 'function') {
            console.warn('[CockpitState] windowSys missing showCockpitHUD() - trying window.engine.windowDOMSystem');
            this._windowSys = window.engine?.windowDOMSystem ?? null;
        }

        if (!this._inputSys) {
            console.error('[CockpitState] InputStateSystem not found - aborting enter.');
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT);
            return;
        }

        if (!this._shipRigSys) {
            console.error('[CockpitState] ShipRigSystem not found - aborting enter.');
            this.fsm.to(CAMERA_STATE.FREE_FLIGHT);
            return;
        }

        this._savedFov = this.nav.cameraRig?.fov ?? COCKPIT_FOV;
        if (this.nav.cameraRig?.fov !== undefined) {
            this.nav.cameraRig.fov = COCKPIT_FOV;
        }

        const startPos = data.startPosition ?? this.nav.cameraRig.position.clone();
        const startQuat = data.startQuaternion ?? this.nav.cameraRig.quaternion.clone();
        this._shipRigSys.activate(startPos, startQuat);

        const scene = Registry.tryGet('scene') ?? this.nav.scene ?? window.engine?.scene;
        this._shipRigSys.mountCamera(this.nav.cameraRig, scene);

        if (typeof this._windowSys?.showCockpitHUD === 'function') {
            this._windowSys.showCockpitHUD();
        } else {
            CockpitState._injectHUDDirect();
        }

        console.log('[CockpitState] Entered - ship flight active. Press C to exit.');
    }

    update(delta) {
        if (!this._inputSys || !this._shipRigSys) return;

        const input = this._inputSys;
        const forward = input.getControlAxis?.('FLIGHT_THRUST') ?? 0;
        const right = input.getControlAxis?.('FLIGHT_STRAFE') ?? 0;
        const up = input.getControlAxis?.('COCKPIT_ELEVATION') ?? 0;
        const boost = input.isControlActive?.('FLIGHT_BOOST') ? 4.0 : 1.0;
        const cappedDelta = Math.min(delta, 1 / 20);

        if (input.isHudMode?.()) {
            const brakeBlend = Math.exp(-(this.nav?.isAutoBrakeActive?.() ? 10 : 5) * cappedDelta);
            this._shipRigSys.velocity.multiplyScalar(brakeBlend);
            this._shipRigSys.angularVelocity.multiplyScalar(Math.exp(-12 * cappedDelta));
            if (this._shipRigSys.velocity.lengthSq() < 0.0004) {
                this._shipRigSys.velocity.set(0, 0, 0);
            }
            if (this._shipRigSys.angularVelocity.lengthSq() < 0.0004) {
                this._shipRigSys.angularVelocity.set(0, 0, 0);
            }
            this._shipRigSys.rig.position.addScaledVector(this._shipRigSys.velocity, cappedDelta);
            this.nav.cameraRig.getWorldPosition(this._worldPos);
            this._tickHUD();
            return;
        }

        const settings = Registry.tryGet('RuntimeState')?.getGameplaySettings?.() ?? window.__PG_SETTINGS?.gameplay ?? {};
        const lookMultiplier = Number.isFinite(settings.lookSensitivity) ? settings.lookSensitivity : 1;
        const invertY = settings.invertY ? -1 : 1;
        const rawDX = THREE.MathUtils.clamp(input.getLookDX?.() ?? (input.pointer.locked ? input.pointer.dx : 0), -MAX_LOOK_DELTA, MAX_LOOK_DELTA);
        const rawDY = THREE.MathUtils.clamp(input.getLookDY?.() ?? (input.pointer.locked ? input.pointer.dy : 0), -MAX_LOOK_DELTA, MAX_LOOK_DELTA) * invertY;
        const dYaw = -rawDX * LOOK_SENSITIVITY * lookMultiplier;
        const dPitch = rawDY * LOOK_SENSITIVITY * lookMultiplier;
        const dRoll = -(input.getControlAxis?.('COCKPIT_ROLL') ?? input.getRollAxis?.() ?? 0) * 1.2;

        this._shipRigSys.applyInputs({
            forward,
            right,
            up,
            dPitch,
            dYaw,
            dRoll,
            boost,
        }, cappedDelta);

        this.nav.cameraRig.getWorldPosition(this._worldPos);
        this._tickHUD();
    }

    exit() {
        if (this.nav.cameraRig?.fov !== undefined) {
            this.nav.cameraRig.fov = this._savedFov;
        }

        if (this._shipRigSys) {
            const scene = Registry.tryGet('scene') ?? this.nav.scene ?? window.engine?.scene;
            this._shipRigSys.unmountCamera(this.nav.cameraRig, scene);
            this._shipRigSys.deactivate();
        }

        if (typeof this._windowSys?.hideCockpitHUD === 'function') {
            this._windowSys.hideCockpitHUD();
        } else {
            CockpitState._removeHUDDirect();
        }

        Registry.tryGet('PointerPresentationController')
            ?.releasePointerLock?.({ reason: 'cockpit-exit' });

        console.log('[CockpitState] Exited.');
    }

    getSnapshot() {
        return {};
    }

    _tickHUD() {
        const shipRig = this._shipRigSys;
        if (!shipRig) return;

        const rigQuaternion = shipRig.rig.quaternion;
        const data = {
            speed: shipRig.speed ?? 0,
            heading: ShipController.headingDeg(rigQuaternion),
            pitch: ShipController.pitchDeg(rigQuaternion),
            roll: ShipController.rollDeg(rigQuaternion),
        };

        if (typeof this._windowSys?.updateCockpitHUD === 'function') {
            this._windowSys.updateCockpitHUD(data);
        } else {
            CockpitState._updateHUDDirect(data);
        }
    }

    static _injectHUDDirect() {
        if (document.getElementById('cockpit-hud')) return;

        if (!document.getElementById('cockpit-hud-style')) {
            const style = document.createElement('style');
            style.id = 'cockpit-hud-style';
            style.textContent = `
                @keyframes ckFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
                #cockpit-hud{position:fixed;inset:0;pointer-events:none;z-index:5500;font-family:'Courier New',monospace;animation:ckFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
                .ck-corner{position:absolute;width:40px;height:40px;border-color:rgba(0,255,200,.55);border-style:solid;border-width:0}
                .ck-tl{top:20px;left:20px;border-top-width:2px;border-left-width:2px}
                .ck-tr{top:20px;right:20px;border-top-width:2px;border-right-width:2px}
                .ck-bl{bottom:20px;left:20px;border-bottom-width:2px;border-left-width:2px}
                .ck-br{bottom:20px;right:20px;border-bottom-width:2px;border-right-width:2px}
                .ck-badge{position:absolute;top:24px;right:70px;color:rgba(0,255,200,.55);font-size:10px;letter-spacing:3px;text-transform:uppercase}
                .ck-hint{position:absolute;top:24px;left:70px;color:rgba(255,255,255,.25);font-size:10px;letter-spacing:2px}
                .ck-telem{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:36px;align-items:flex-end;background:rgba(0,5,12,.55);backdrop-filter:blur(6px);border:1px solid rgba(0,255,200,.18);border-radius:6px;padding:10px 28px}
                .ck-ch{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px}
                .ck-lbl{color:rgba(0,255,200,.5);font-size:9px;letter-spacing:2px;text-transform:uppercase}
                .ck-val{color:#00ffc8;font-size:18px;font-weight:bold;letter-spacing:1px;text-shadow:0 0 8px rgba(0,255,200,.7);transition:color .1s}
                .ck-val.warn{color:#ffaa00;text-shadow:0 0 8px rgba(255,170,0,.7)}
            `;
            document.head.appendChild(style);
        }

        const hud = document.createElement('div');
        hud.id = 'cockpit-hud';
        hud.innerHTML = `
            <div class="ck-corner ck-tl"></div><div class="ck-corner ck-tr"></div>
            <div class="ck-corner ck-bl"></div><div class="ck-corner ck-br"></div>
            <div class="ck-badge">COCKPIT MODE</div>
            <div class="ck-hint">[C] EXIT</div>
            <div class="ck-telem">
                <div class="ck-ch"><span class="ck-lbl">SPD</span><span class="ck-val" id="cht-spd">0</span></div>
                <div class="ck-ch"><span class="ck-lbl">ALT</span><span class="ck-val" id="cht-alt">---</span></div>
                <div class="ck-ch"><span class="ck-lbl">HDG</span><span class="ck-val" id="cht-hdg">000°</span></div>
                <div class="ck-ch"><span class="ck-lbl">ROLL</span><span class="ck-val" id="cht-roll">0°</span></div>
                <div class="ck-ch"><span class="ck-lbl">PITCH</span><span class="ck-val" id="cht-pitch">0°</span></div>
            </div>`;
        document.body.appendChild(hud);
        console.log('[CockpitState] HUD injected directly.');
    }

    static _removeHUDDirect() {
        const hud = document.getElementById('cockpit-hud');
        if (!hud) return;
        hud.style.transition = 'opacity .4s ease';
        hud.style.opacity = '0';
        setTimeout(() => hud.remove(), 420);
    }

    static _updateHUDDirect(telemetry = {}) {
        const getNode = (id) => document.getElementById(id);
        const speedNode = getNode('cht-spd');
        const altitudeNode = getNode('cht-alt');
        const headingNode = getNode('cht-hdg');
        const rollNode = getNode('cht-roll');
        const pitchNode = getNode('cht-pitch');

        if (speedNode) {
            const value = Math.round(telemetry.speed ?? 0);
            speedNode.textContent = value;
            speedNode.classList.toggle('warn', value > 450);
        }
        if (altitudeNode) altitudeNode.textContent = telemetry.altitude != null ? `${Math.round(telemetry.altitude)} u` : '---';
        if (headingNode) headingNode.textContent = `${Math.round(telemetry.heading ?? 0).toString().padStart(3, '0')}°`;
        if (rollNode) rollNode.textContent = `${Math.round(telemetry.roll ?? 0)}°`;
        if (pitchNode) pitchNode.textContent = `${Math.round(telemetry.pitch ?? 0)}°`;
    }
}
