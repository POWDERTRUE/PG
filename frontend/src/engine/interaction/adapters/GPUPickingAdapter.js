/**
 * GPUPickingAdapter.js
 * OMEGA V31 — Render Target Rasterization Handler
 */

import { encodeIdToRGBBytes, decodeRGBToId } from '../colorIdUtils.js';

export class GPUPickingAdapter {
    constructor({ renderer, scene, camera, size = 1 } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.size = size; // Render target size (generalmente 1x1 para el puntero)
        this._rt = null;
        
        // Zero-GC Memory Block Allocation
        this._pixelBuffer = new Uint8Array(4);
        
        this._initRenderTarget();
    }

    _initRenderTarget() {
        // [x] Desactivación de Antialiasing: Internamente THREE falsea MSAA en targets normales.
        // [x] Filtrado de Textura: Estrictamente NearestFilter
        if (typeof THREE !== 'undefined') {
            this._rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType,
                depthBuffer: true,
                stencilBuffer: false,
                generateMipmaps: false,
                colorSpace: THREE.LinearSRGBColorSpace // Linear, no sRGB interpolation
            });
        }
    }

    /**
     * Executes the readPixels hardware fetch.
     * @returns {Promise<{id: Number, distance: Number, hitPoint: Object} | null>}
     */
    async readIdAt(screenX, screenY, { timeoutMs = 12 } = {}) {
        return new Promise((resolve) => {
            try {
                if (!this.renderer || !this._rt) return resolve(null);

                const dpr = this.renderer.getPixelRatio();
                const rawX = Math.round(screenX * dpr);
                const rawY = Math.round((this.renderer.domElement.clientHeight - screenY) * dpr);

                // Guardar render pipeline orginal
                const oldTarget = this.renderer.getRenderTarget();
                const oldClearColor = this.renderer.getClearColor(new THREE.Color());
                const oldClearAlpha = this.renderer.getClearAlpha();
                const oldScissorTest = this.renderer.getScissorTest();

                // Preparación de buffer asilado
                this.renderer.setRenderTarget(this._rt);
                this.renderer.setClearColor(0x000000, 0); // Color nulo identificador nulo
                this.renderer.clear();

                // [x] Scissor Test Activo: Restringiendo full fill-rate, ahorrando % tiempo GPU
                this.renderer.setScissorTest(true);
                this.renderer.setScissor(rawX, rawY, 1, 1);
                
                // --- PUNTO CRÍTICO DE APLICACIÓN ---
                // Aquí es donde en el futuro se activará the scene.overrideMaterial 
                // con un ID-Encoder shader previo al renderizado, p.ej:
                // this.scene.overrideMaterial = pickingMaterial;
                this.renderer.render(this.scene, this.camera);
                // this.scene.overrideMaterial = null;

                // Leer píxeles directamente sobre la región scissor target
                this.renderer.readRenderTargetPixels(this._rt, rawX, rawY, 1, 1, this._pixelBuffer);

                // Restaurar Pipeline Original
                this.renderer.setRenderTarget(oldTarget);
                this.renderer.setClearColor(oldClearColor, oldClearAlpha);
                this.renderer.setScissorTest(oldScissorTest);
                
                const r = this._pixelBuffer[0];
                const g = this._pixelBuffer[1];
                const b = this._pixelBuffer[2];
                const a = this._pixelBuffer[3];

                // a === 0 significa vacío
                if (a === 0 || (r === 0 && g === 0 && b === 0)) {
                    return resolve(null);
                }

                const hitId = decodeRGBToId(r, g, b);
                
                // Nota: la distancia / hitPoint es ciega en WebGL puro a no ser que codifiquemos 
                // en el buffer Z, retornará metricas neutrales para que el EventBus las decodifique
                resolve({ id: hitId, distance: 0, hitPoint: null });

            } catch (err) {
                console.error('GPUPickingAdapter Error:', err);
                resolve(null);
            }
        });
    }

    dispose() {
        if (this._rt) this._rt.dispose();
    }
}
