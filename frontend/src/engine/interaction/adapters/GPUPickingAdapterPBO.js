/**
 * GPUPickingAdapterPBO.js
 * OMEGA V31 — WebGL2 PBO Async Readback Adapter
 */

import { decodeRGBToId } from '../colorIdUtils.js';

export class GPUPickingAdapterPBO {
    constructor({ renderer, scene, camera }) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        this.gl = this.renderer.getContext();
        this.isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext;
        
        if (!this.isWebGL2) {
            throw new Error('PBO Architecture requires WebGL2 context');
        }

        this._initPBOs();
        
        // Memoria estática
        this._pixelBuffer = new Uint8Array(4);
        this._pending = new Map(); // frameId -> State
        this._frameCounter = 0;
    }

    _initPBOs() {
        const gl = this.gl;
        this.pbos = [gl.createBuffer(), gl.createBuffer()]; // Buffer doble "Ping-Pong"
        for (const pbo of this.pbos) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        this._ping = 0;
    }

    /**
     * Devuelve promesa retrasada a 1-2 frames.
     */
    async readIdAt(screenX, screenY, { timeoutFrames = 2 } = {}) {
        return new Promise((resolve, reject) => {
            if (!this._rt) return resolve(null);

            const gl = this.gl;
            const dpr = this.renderer.getPixelRatio();
            const rawX = Math.round(screenX * dpr);
            const rawY = Math.round((this.renderer.domElement.clientHeight - screenY) * dpr);

            // Rescatar Estado
            const prevBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
            const oldTarget = this.renderer.getRenderTarget();
            const oldScissorTest = this.renderer.getScissorTest();

            // Settear Buffer Actual (Ping)
            const pbo = this.pbos[this._ping];
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);

            // Preparar Framebuffer
            this.renderer.setRenderTarget(this._rt);
            this.renderer.setClearColor(0x000000, 0);
            this.renderer.clear();
            
            this.renderer.setScissorTest(true);
            this.renderer.setScissor(rawX, rawY, 1, 1);
            
            // Render
            this.renderer.render(this.scene, this.camera);

            // ReadPixels ASINCRÓNICO hacia el PBO buffer
            gl.readPixels(rawX, rawY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
            
            // Colocar valla asíncrona de GPU
            const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

            // Restaurar máquina de estados Three.js y WebGL
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prevBuffer);
            this.renderer.setRenderTarget(oldTarget);
            this.renderer.setScissorTest(oldScissorTest);

            const frameId = ++this._frameCounter;
            
            this._pending.set(frameId, {
                pbo,
                fence,
                resolve,
                reject,
                attempts: 0,
                timeoutFrames
            });
            
            // Alternar buffer
            this._ping = (this._ping + 1) % 2;
        });
    }

    /**
     * Bucle del Motor de Poll a ejecutarse en cada Gameloop de requestAnimationFrame
     */
    pollPending() {
        const gl = this.gl;
        for (const [frameId, entry] of this._pending) {
            const status = gl.clientWaitSync(entry.fence, 0, 0); // No bloqueante
            
            if (status === gl.CONDITION_SATISFIED || status === gl.ALREADY_SIGNALED) {
                const prev = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
                
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, entry.pbo);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this._pixelBuffer);
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prev); // Salvaguardar

                const [r, g, b, a] = this._pixelBuffer;
                
                if (a === 0 || (r === 0 && g === 0 && b === 0)) {
                    entry.resolve(null);
                } else {
                    const id = decodeRGBToId(r, g, b);
                    entry.resolve({ id, distance: 0, hitPoint: null });
                }

                gl.deleteSync(entry.fence);
                this._pending.delete(frameId);
            } else {
                entry.attempts++;
                if (entry.attempts > entry.timeoutFrames) {
                    entry.resolve(null); // Resolvemos a nulo y pasa a Fallback BVH en el orquestador
                    gl.deleteSync(entry.fence);
                    this._pending.delete(frameId);
                }
            }
        }
    }

    dispose() {
        const gl = this.gl;
        for (const pbo of this.pbos) {
            gl.deleteBuffer(pbo);
        }
        for (const [frameId, entry] of this._pending) {
            gl.deleteSync(entry.fence);
            entry.reject(new Error('GPUPickingAdapterPBO disposed'));
        }
        this._pending.clear();
        if (this._rt) this._rt.dispose();
    }
}
