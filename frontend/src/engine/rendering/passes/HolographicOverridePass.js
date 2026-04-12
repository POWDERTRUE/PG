import * as THREE from 'three';
import { createHolographicMaterial } from '../materials/HolographicMaterial.js';
import { Registry } from '../../core/ServiceRegistry.js';
import gsap from 'gsap';

/**
 * HolographicOverridePass — V31 Tactical Map Render Layer
 *
 * Se inyecta temporalmente en el pipeline para renderizar la escena con
 * un override material enfocado en hologramas militares sin causar Garbage Collection.
 */
export class HolographicOverridePass {
    constructor() {
        this.priority = 40; // Antes del DOM occlusion (50) y postprocess (200), pero despúes de main renders
        this.enabled = false; // Se activa solo en modo táctico
        this.holographicMaterial = createHolographicMaterial();
        this._time = 0;
        this._transitionWeight = 0; // Para tweening
        
        // Referencias cacheadas
        this._originalClearColor = new THREE.Color();
        this._overrideColor = new THREE.Color('#0a192f');
        this._fallbackBackground = new THREE.Color('#000008');
        this._blendedBackground = new THREE.Color();
    }

    setMode(active) {
        if (active) {
            this.enabled = true;
            gsap.to(this, { _transitionWeight: 1.0, duration: 0.8, ease: 'power2.out' });
        } else {
            gsap.to(this, { 
                _transitionWeight: 0.0, 
                duration: 0.5, 
                ease: 'power2.in',
                onComplete: () => { this.enabled = false; }
            });
        }
    }

    execute(renderer, scene, camera, deltaTime) {
        if (!this.enabled && this._transitionWeight <= 0.01) return;

        this._time += deltaTime;
        if (this.holographicMaterial.uniforms.uTime) {
            this.holographicMaterial.uniforms.uTime.value = this._time;
            this.holographicMaterial.uniforms.uOpacity.value = 0.3 * this._transitionWeight;
        }

        // Caching the original background state
        let originalBackground = scene.background;
        
        // Forzando el fondo a azul profundo
        scene.background = this._blendedBackground.copy(this._overrideColor).lerp(
            (originalBackground && originalBackground.isColor) ? originalBackground : this._fallbackBackground,
            1.0 - this._transitionWeight
        );

        // Activando el Override global
        const oldOverride = scene.overrideMaterial;
        scene.overrideMaterial = this.holographicMaterial;

        // Render pass con override (se pinta en el frame buffer actual)
        renderer.render(scene, camera);

        // Restaurar estado
        scene.overrideMaterial = oldOverride;
        scene.background = originalBackground;
    }

    dispose() {
        this.holographicMaterial?.dispose?.();
        this.holographicMaterial = null;
    }
}
