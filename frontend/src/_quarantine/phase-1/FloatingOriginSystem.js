import * as THREE from 'three';
import { System } from '../../core/EntityManager.js';
import { Registry } from '../../core/ServiceRegistry.js';

const ORIGIN_SHIFT_SIGNAL = 'PG:NAV:ORIGIN_SHIFT';

/**
 * FloatingOriginSystem — AAA Precision Edition
 *
 * THE PRIMARY DEFENSE AGAINST CAMERA JITTER AT GALACTIC SCALE.
 *
 * Root cause of jitter:
 *   float32 has 7 significant digits.
 *   At position x = 10,000 units:
 *     minimum representable step ≈ 0.001 units
 *     → no visible error at planet scale
 *   At position x = 100,000 units:
 *     minimum step ≈ 0.01 units → micro-jitter begins
 *   At position x = 1,000,000 units:
 *     minimum step ≈ 0.1 units → VISIBLE TREMBLING
 *
 * Solution: Keep camera rig near origin at all times.
 *   Camera rig stays at (0,0,0).
 *   Every N frames, shift the entire world by -cameraPosition.
 *
 * Threshold: 5000 units (well within safe float32 range for 120k-star galaxy).
 * This triggers often enough to keep camera close to origin always.
 */
export class FloatingOriginSystem extends System {
    static phase = 'navigation'; // After camera update, before render

    // The playable galaxy fits comfortably inside this radius, so we avoid
    // rebasing during the main reveal/menu fly-in and only rebase once the
    // player actually travels beyond the presentation envelope.
    static THRESHOLD = 25000;

    init(world) {
        this.world      = world;
        const kernel    = Registry.get('kernel');
        this._kernel    = kernel;
        this._scene     = kernel?.sceneGraph?.scene;
        this._runtimeSignals = Registry.tryGet('RuntimeSignals');
        this._cameraRig = null; // resolved lazily
        this._offset    = new THREE.Vector3();
        this._totalShift = new THREE.Vector3();
        this._shiftCount = 0;
        this._originShiftDetail = {
            source: 'floating-origin',
            offset: this._offset,
            totalShift: this._totalShift,
            shiftCount: 0,
            movedNodes: 0,
        };

        console.log('🌌 [FloatingOriginSystem] Precision guard ONLINE. Threshold:', FloatingOriginSystem.THRESHOLD);
    }

    execute(_world, _dt) {
        if (!this._scene) return;

        // Resolve camera rig lazily (navigationSystem boots after us)
        this._resolveCameraRig();
        if (!this._cameraRig) return;

        const nav = this._kernel?.navigationSystem;
        const currentState = nav?.state ?? null;

        // Cinematic/menu states animate the rig through large absolute
        // coordinates. Rebasing during those tweens compounds offsets and can
        // push the entire galaxy outside the view volume.
        if (
            currentState === 'MOUSE_UI' ||
            currentState === 'STELARYI' ||
            nav?.wallpaperTween?.isActive?.()
        ) {
            return;
        }

        // Use the rig position (this is where the camera physically is)
        const rigPos = this._cameraRig.position;
        if (rigPos.lengthSq() < FloatingOriginSystem.THRESHOLD * FloatingOriginSystem.THRESHOLD) return;

        this._shiftOrigin(rigPos);
    }

    _resolveCameraRig() {
        if (!this._cameraRig) {
            this._cameraRig = this._kernel?.navigationSystem?.cameraRig
                           || this._kernel?.cameraRig
                           || this._kernel?.camera
                           || null;
        }
        return this._cameraRig;
    }

    _shiftOrigin(rigPos) {
        const offset = this._offset.copy(rigPos);
        if (offset.lengthSq() === 0) return;

        // 1. Teleport the camera rig back to near origin
        rigPos.sub(offset);

        // Also move the camera itself if it has independent position
        const cam = this._kernel?.camera;
        if (cam && cam !== this._cameraRig) {
            cam.position.sub(offset);
            cam.updateMatrixWorld(true);
        }

        // 2. Shift the entire scene by -offset
        let moved = 0;
        for (const obj of this._scene.children) {
            if (obj === cam || obj === this._cameraRig) continue;
            if (obj.isCamera) continue;
            if (obj.userData?.isFallback) continue;
            if (obj.name === 'DeepSpaceHDRI') continue; // HDRI follows camera, don't shift
            obj.position.sub(offset);
            obj.updateMatrixWorld(true);
            moved++;
        }

        // 3. Track cumulative offset (for debugging / minimap / star shaders).
        // This must never touch body velocities or accumulated orbital energy.
        this._totalShift.add(offset);
        this._shiftCount++;
        this._originShiftDetail.shiftCount = this._shiftCount;
        this._originShiftDetail.movedNodes = moved;

        this._runtimeSignals?.emit?.(
            ORIGIN_SHIFT_SIGNAL,
            this._originShiftDetail,
            { mirrorDom: false }
        );

        if (this._shiftCount % 10 === 0) {
            console.debug(`🌌 [FloatingOrigin] Shift #${this._shiftCount}: [${offset.x.toFixed(1)}, ${offset.y.toFixed(1)}, ${offset.z.toFixed(1)}] → ${moved} nodes`);
        }
    }

    /**
     * Compatibility bridge for legacy callers that still request an explicit rebase.
     * We always prefer the canonical camera rig when available so the shift does not
     * accidentally double-apply on a child render camera.
     */
    _rebase(_camera, position) {
        const rig = this._resolveCameraRig();
        if (rig?.position) {
            this._shiftOrigin(rig.position);
            return;
        }
        if (position) {
            this._shiftOrigin(position);
        }
    }

    copyTotalOffset(out) {
        return out.copy(this._totalShift);
    }

    /** Returns the cumulative offset from the original galaxy center */
    get totalOffset() { return this._totalShift; }
    get sectorOrigin() { return this._totalShift; }
    get galaxyPosition() { return this._totalShift; }
}
