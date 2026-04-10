// frontend/src/engine/rendering/passes/DOMOcclusionPass.js

/**
 * DOMOcclusionPass — V31 FrameGraph Pass
 *
 * A lightweight FrameGraph pass that drives the DOMOcclusionSystem
 * AFTER the main scene render but BEFORE post-processing.
 *
 * Priority 50 places it between:
 *   CoreRenderPass (priority 0) → DOMOcclusionPass (50) → PostProcessPass (100)
 *
 * Does NOT touch the GPU framebuffer — only reads a single pixel
 * per registered window (via DOMOcclusionSystem's throttled update).
 */
export class DOMOcclusionPass {
    /** Execution order within FrameGraph — between core render and bloom */
    priority = 50;
    enabled  = true;

    /**
     * @param {import('../../interaction/DOMOcclusionSystem.js').DOMOcclusionSystem} occlusionSystem
     */
    constructor(occlusionSystem) {
        this.occlusionSystem = occlusionSystem;
    }

    /**
     * Called every frame by FrameGraph.execute().
     * The main scene has already been rendered at this point.
     *
     * @param {THREE.WebGLRenderer} _renderer  - unused (system has its own ref)
     * @param {THREE.Scene}         _scene     - unused
     * @param {THREE.Camera}        _camera    - unused
     * @param {number}              _deltaTime - unused
     */
    execute(_renderer, _scene, _camera, _deltaTime) {
        if (this.occlusionSystem) {
            this.occlusionSystem.update(performance.now());
        }
    }

    dispose() {
        this.occlusionSystem = null;
    }
}
