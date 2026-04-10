import * as THREE from 'three';
import html2canvas from 'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.esm.js';

export class WindowBridgeSystem {
    constructor() {
        this.bridges = new Map();
        this.vector = new THREE.Vector3();

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const bridgeId = entry.target.dataset.bridgeId;
                if (bridgeId && this.bridges.has(bridgeId)) {
                    this.handleResize(this.bridges.get(bridgeId), entry.contentRect);
                }
            }
        });

        this.mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(m => {
                const target = m.target.closest ? m.target.closest('[data-bridge-id]') : null;
                const bridgeId = target?.dataset.bridgeId;

                if (bridgeId && this.bridges.has(bridgeId)) {
                    this.queueTextureSync(bridgeId);
                }
            });
        });

        // ── V31: DOM Occlusion Culling ──────────────────────────────────────
        // Reads the WebGL Z-buffer each frame to determine if 3D geometry
        // is obscuring a DOM window, making it semi-transparent and non-interactive.
        this._depthRT        = null;    // THREE.WebGLRenderTarget with DepthTexture
        this._depthPixelBuf  = new Uint8Array(4); // reusable read buffer (zero GC)
        this._occlusionFrame = 0;       // frame counter for throttling reads
        this._OCCLUSION_EVERY_N_FRAMES = 3; // sample depth every 3 frames
    }

    /**
     * Call once after renderer is available.
     * Creates a 1×1 DepthTexture render target used for point-sampling the Z-buffer.
     * @param {THREE.WebGLRenderer} renderer
     */
    initDepthSampler(renderer) {
        if (this._depthRT || !renderer) return;
        this._renderer = renderer;

        // 1×1 target: we'll sample it per-bridge at the projected screen position
        this._depthRT = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            type:      THREE.UnsignedByteType,
            format:    THREE.RGBAFormat,
        });
        this._depthRT.depthBuffer   = true;
        this._depthRT.stencilBuffer = false;
        this._depthRT.depthTexture  = new THREE.DepthTexture(1, 1);
        this._depthRT.depthTexture.type   = THREE.UnsignedShortType;
        this._depthRT.depthTexture.format = THREE.DepthFormat;

        console.log('%c[WindowBridge] DOM Occlusion Culling enabled — Z-buffer depth sampler ready.', 'color:#00e5ff;font-weight:bold');
    }

    /**
     * Sample the depth at NDC position (ndcX, ndcY) ∈ [-1,1].
     * Returns a depth value in [0, 1] (0=near, 1=far).
     * Uses the 1×1 render target trick: resize scissor to (1,1) and blit.
     * @param {number} ndcX
     * @param {number} ndcY
     * @param {THREE.Scene}  scene
     * @param {THREE.Camera} camera
     * @returns {number} sampled depth [0..1]
     */
    _sampleDepthAt(ndcX, ndcY, scene, camera) {
        if (!this._renderer || !this._depthRT) return 1.0; // assume unoccluded

        const W = this._renderer.domElement.width;
        const H = this._renderer.domElement.height;
        const px = Math.floor(((ndcX + 1) * 0.5) * W);
        const py = Math.floor(((1 - (ndcY + 1) * 0.5)) * H);

        // render 1×1 region into depth target
        const prev = this._renderer.getRenderTarget();
        this._renderer.setRenderTarget(this._depthRT);
        this._renderer.setScissorTest(true);
        this._renderer.setScissor(px, H - py - 1, 1, 1);
        this._renderer.setViewport(px, H - py - 1, 1, 1);
        this._renderer.render(scene, camera);
        this._renderer.readRenderTargetPixels(this._depthRT, 0, 0, 1, 1, this._depthPixelBuf);
        this._renderer.setScissorTest(false);
        this._renderer.setRenderTarget(prev);
        this._renderer.setViewport(0, 0, W, H);
        this._renderer.setScissor(0, 0, W, H);

        // decode R channel: depth packed as [0..255]
        return this._depthPixelBuf[0] / 255.0;
    }

    createBridge(id, domElement, planeMesh) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.format = THREE.RGBAFormat;

        if (planeMesh.material) {
            planeMesh.material.map = texture;
            planeMesh.material.needsUpdate = true;
        }

        planeMesh.userData.bridgeId = id;

        const bridge = {
            id,
            domElement,
            planeMesh,
            canvas,
            ctx,
            texture,
            isSyncing: false,
            needsTextureUpdate: true,
            syncTimeout: null,
            _lastOccluded: false,   // V31: occlusion state cache
        };

        domElement.dataset.bridgeId = id;

        this.resizeObserver.observe(domElement);
        this.mutationObserver.observe(domElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        this.bridges.set(id, bridge);
        this.queueTextureSync(id);

        return bridge;
    }

    handleResize(bridge, rect) {
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));

        if (bridge.canvas.width === width && bridge.canvas.height === height) return;

        bridge.canvas.width = width;
        bridge.canvas.height = height;

        bridge.planeMesh.scale.set(width / 100, height / 100, 1);
        this.queueTextureSync(bridge.id);
    }

    queueTextureSync(id) {
        const bridge = this.bridges.get(id);
        if (!bridge) return;

        if (bridge.syncTimeout) return;

        bridge.syncTimeout = setTimeout(() => {
            bridge.needsTextureUpdate = true;
            bridge.syncTimeout = null;
        }, 50);
    }

    async executeTextureSync(bridge) {
        if (bridge.isSyncing || !bridge.needsTextureUpdate) return;

        bridge.isSyncing = true;
        bridge.needsTextureUpdate = false;

        try {
            const snapshot = await html2canvas(bridge.domElement, {
                backgroundColor: null,
                scale: 1,
                logging: false
            });

            bridge.ctx.clearRect(0, 0, bridge.canvas.width, bridge.canvas.height);
            bridge.ctx.drawImage(snapshot, 0, 0, bridge.canvas.width, bridge.canvas.height);

            bridge.texture.needsUpdate = true;

            if (snapshot && snapshot.parentNode) {
                snapshot.parentNode.removeChild(snapshot);
            }
            snapshot.width = 0;
            snapshot.height = 0;

        } catch (error) {
            console.error(`[WindowBridge] Rasterization failed for ${bridge.id}:`, error);
        } finally {
            bridge.isSyncing = false;
        }
    }

    /**
     * V31 — update() with DOM Occlusion Culling.
     * Every N frames, samples the WebGL depth buffer at each bridge's
     * projected screen position. If 3D geometry is in front, the DOM
     * element is dimmed and made non-interactive (holographic depth effect).
     *
     * @param {THREE.Camera}       camera
     * @param {THREE.Scene}        [scene]  — required for occlusion sampling
     */
    update(camera, scene) {
        const halfWidth  = window.innerWidth  * 0.5;
        const halfHeight = window.innerHeight * 0.5;

        // throttle depth reads — every N frames
        const doOcclusionCheck = (++this._occlusionFrame % this._OCCLUSION_EVERY_N_FRAMES === 0)
            && !!scene && !!this._depthRT;

        this.bridges.forEach(bridge => {
            bridge.planeMesh.getWorldPosition(this.vector);
            this.vector.project(camera);

            // frustum cull
            if (
                this.vector.z < -1 || this.vector.z > 1 ||
                this.vector.x < -1 || this.vector.x > 1 ||
                this.vector.y < -1 || this.vector.y > 1
            ) {
                bridge.domElement.style.display = 'none';
                return;
            }

            bridge.domElement.style.display = 'block';

            const x = Math.round((this.vector.x * halfWidth)  + halfWidth);
            const y = Math.round(-(this.vector.y * halfHeight) + halfHeight);
            bridge.domElement.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) translateZ(0)`;

            // ── V31: Occlusion test via Z-buffer ────────────────────────────
            if (doOcclusionCheck) {
                try {
                    const sceneDepth  = this._sampleDepthAt(this.vector.x, this.vector.y, scene, camera);
                    // NDC z ∈ [-1,1] → [0,1] for comparison with depth buffer [0,1]
                    const windowDepth = (this.vector.z + 1) * 0.5;
                    // Add small epsilon to avoid z-fighting artifacts
                    const occluded = windowDepth > sceneDepth + 0.004;

                    if (occluded !== bridge._lastOccluded) {
                        bridge._lastOccluded = occluded;
                        if (occluded) {
                            // Behind 3D geometry → holographic ghost effect
                            bridge.domElement.style.transition    = 'opacity 0.25s ease, filter 0.25s ease';
                            bridge.domElement.style.opacity       = '0.12';
                            bridge.domElement.style.filter        = 'blur(1.5px) saturate(0.4)';
                            bridge.domElement.style.pointerEvents = 'none';
                        } else {
                            // In front → fully visible and interactive
                            bridge.domElement.style.transition    = 'opacity 0.25s ease, filter 0.25s ease';
                            bridge.domElement.style.opacity       = '1';
                            bridge.domElement.style.filter        = 'none';
                            bridge.domElement.style.pointerEvents = 'auto';
                        }
                    }
                } catch (_) {
                    // Silently skip if depth sampling fails (e.g. context lost)
                }
            }

            if (bridge.needsTextureUpdate && !bridge.isSyncing) {
                this.executeTextureSync(bridge);
            }
        });
    }

    simulateClickFromUV(bridgeId, uv) {
        const bridge = this.bridges.get(bridgeId);
        if (!bridge) return;

        const localX = uv.x * bridge.domElement.offsetWidth;
        const localY = (1 - uv.y) * bridge.domElement.offsetHeight;

        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: bridge.domElement.getBoundingClientRect().left + localX,
            clientY: bridge.domElement.getBoundingClientRect().top + localY
        });

        const target = document.elementFromPoint(clickEvent.clientX, clickEvent.clientY) || bridge.domElement;
        target.dispatchEvent(clickEvent);
    }

    removeBridge(id) {
        const bridge = this.bridges.get(id);
        if (!bridge) return;

        this.resizeObserver.unobserve(bridge.domElement);

        if (bridge.texture) {
            bridge.texture.dispose();
        }

        if (bridge.planeMesh && bridge.planeMesh.material) {
            bridge.planeMesh.material.map = null;
            bridge.planeMesh.material.dispose();
        }

        this.bridges.delete(id);
    }

    dispose() {
        if (this._depthRT) {
            this._depthRT.depthTexture?.dispose();
            this._depthRT.dispose();
            this._depthRT = null;
        }
    }
}
