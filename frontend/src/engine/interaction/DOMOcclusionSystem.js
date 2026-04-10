// frontend/src/engine/interaction/DOMOcclusionSystem.js
import * as THREE from 'three';

/**
 * DOMOcclusionSystem — V31 Holographic Depth
 *
 * Reads a single pixel of the WebGL Z-Buffer for each registered DOM
 * window and hides it (opacity: 0) when a 3D object (planet, ship, etc.)
 * is in front of it. Creates genuine holographic depth: a planet can
 * visually occlude a Glass Silicon floating window.
 *
 * THROTTLED: checks run at ~10 fps (100 ms interval) to avoid costly
 * GPU readback on every frame.
 *
 * RENDERER REQUIREMENT: set `preserveDrawingBuffer: true` when creating
 * THREE.WebGLRenderer, otherwise readPixels() returns zeros.
 *
 * FALLBACK: if WEBGL_depth_texture is unavailable, uses THREE.Raycaster
 * (slightly more expensive but works universally).
 */
export class DOMOcclusionSystem {
    /**
     * @param {THREE.WebGLRenderer} renderer - Must have preserveDrawingBuffer: true
     * @param {THREE.Camera}        camera
     */
    constructor(renderer, camera) {
        this.renderer = renderer;
        this.camera   = camera;

        /** @type {Map<string, {domElement:HTMLElement, worldPos:THREE.Vector3, lastOccluded:boolean}>} */
        this.registered = new Map();

        // ── Pre-allocated zero-GC buffers ──────────────────────────
        this._ndc         = new THREE.Vector3();
        this._rgbaPixel   = new Uint8Array(4);
        this._lastCheck   = 0;
        this._checkMs     = 100;        // 10 fps throttle
        this._raycaster   = new THREE.Raycaster();
        this._ndcVec2     = new THREE.Vector2();
        // ───────────────────────────────────────────────────────────

        this._useRaycastFallback = false;
        this._detectDepthSupport();

        console.log('%c[DOMOcclusionSystem] V31 Holographic Depth online', 'color:#aa88ff;font-weight:bold');
    }

    _detectDepthSupport() {
        try {
            const gl = this.renderer.getContext();
            const hasDepth = gl.getExtension('WEBGL_depth_texture') ||
                             gl.getExtension('WEBKIT_WEBGL_depth_texture');
            this._useRaycastFallback = !hasDepth;
            if (this._useRaycastFallback) {
                console.warn('[DOMOcclusionSystem] WEBGL_depth_texture not available — using Raycaster fallback.');
            }
        } catch (_) {
            this._useRaycastFallback = true;
        }
    }

    // ── Public API ────────────────────────────────────────────────

    /**
     * Register a floating DOM window with its 3D world anchor position.
     * Call this when a window is opened.
     *
     * @param {HTMLElement}   domElement    - The window / panel element
     * @param {THREE.Vector3} worldPosition - 3D anchor point in world space
     * @param {string}        windowId      - Unique stable ID
     */
    register(domElement, worldPosition, windowId) {
        this.registered.set(windowId, {
            domElement,
            worldPos:    worldPosition.clone(),
            lastOccluded: false,
        });
    }

    /**
     * Unregister a window (call when closed / destroyed).
     * @param {string} windowId
     */
    unregister(windowId) {
        const entry = this.registered.get(windowId);
        if (entry) {
            // Restore visibility before removing tracking
            entry.domElement.style.opacity      = '1';
            entry.domElement.style.pointerEvents = 'auto';
        }
        this.registered.delete(windowId);
    }

    /**
     * Update the 3D anchor for a window that moves with a 3D object.
     * @param {string}        windowId
     * @param {THREE.Vector3} newWorldPos
     */
    updatePosition(windowId, newWorldPos) {
        const entry = this.registered.get(windowId);
        if (entry) entry.worldPos.copy(newWorldPos);
    }

    /**
     * Call from the game loop (or from DOMOcclusionPass.execute()).
     * Internally throttled — safe to call every frame.
     *
     * @param {number} nowMs - performance.now()
     */
    update(nowMs) {
        if (!this.registered.size) return;
        if (nowMs - this._lastCheck < this._checkMs) return;
        this._lastCheck = nowMs;

        for (const [windowId, entry] of this.registered) {
            const isOccluded = this._useRaycastFallback
                ? this._checkRaycaster(entry.worldPos)
                : this._checkZBuffer(entry.worldPos);

            if (isOccluded !== entry.lastOccluded) {
                entry.lastOccluded = isOccluded;
                entry.domElement.style.transition    = 'opacity 0.4s ease';
                entry.domElement.style.opacity       = isOccluded ? '0'    : '1';
                entry.domElement.style.pointerEvents = isOccluded ? 'none' : 'auto';
            }
        }
    }

    // ── Private depth checks ──────────────────────────────────────

    /**
     * Strategy A: read one pixel of the colour buffer after render.
     * Approximate depth from RGBA channel R.
     * @param {THREE.Vector3} worldPos
     * @returns {boolean}
     */
    _checkZBuffer(worldPos) {
        // Project world position to NDC
        this._ndc.copy(worldPos).project(this.camera);

        // Out of frustum → not occluded
        if (this._ndc.z > 1.0 || Math.abs(this._ndc.x) > 1 || Math.abs(this._ndc.y) > 1) {
            return false;
        }

        const canvas = this.renderer.domElement;
        const px = Math.round(( this._ndc.x * 0.5 + 0.5) * canvas.width);
        const py = Math.round((1 - (this._ndc.y * 0.5 + 0.5)) * canvas.height); // flip Y

        try {
            const gl = this.renderer.getContext();
            gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this._rgbaPixel);
        } catch (_) {
            return false;
        }

        // R channel ≈ scene depth at that pixel (rough but fast)
        const sceneDepth  = this._rgbaPixel[0] / 255.0;
        const anchorDepth = (this._ndc.z + 1.0) * 0.5; // NDC z → [0,1]

        // If scene has something closer than the anchor → occluded
        return sceneDepth < anchorDepth - 0.02;
    }

    /**
     * Strategy B: THREE.Raycaster fallback.
     * @param {THREE.Vector3} worldPos
     * @returns {boolean}
     */
    _checkRaycaster(worldPos) {
        // Project to NDC first to set up raycaster
        this._ndc.copy(worldPos).project(this.camera);
        if (this._ndc.z > 1.0 || Math.abs(this._ndc.x) > 1 || Math.abs(this._ndc.y) > 1) {
            return false;
        }

        this._ndcVec2.set(this._ndc.x, this._ndc.y);
        this._raycaster.setFromCamera(this._ndcVec2, this.camera);

        const sceneObj = window.Registry?.get('SceneGraph')?.scene
                      ?? window.Registry?.get('scene');
        if (!sceneObj) return false;

        const anchorDist = this.camera.position.distanceTo(worldPos);
        const hits       = this._raycaster.intersectObjects(sceneObj.children, true);

        return hits.some(h => h.distance < anchorDist - 5.0);
    }

    dispose() {
        this.registered.clear();
    }
}
