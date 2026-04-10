/**
 * RaycastSelectionAdapter.js (Legacy Shim)
 * DEPRECADO: Este sistema será eliminado en 2 Sprints.
 * 
 * Actúa como puente entre la API antigua que consumen los subsistemas del motor
 * (nave, armas, targeting) y el nuevo SelectionService de Hardware (Fase 4 - Cutover).
 */

import { Registry } from '../../core/ServiceRegistry.js';

export class RaycastSelectionSystem {
    constructor() {
        console.warn('⚠️ [DEPRECATION NOTICE] Instanciación de RaycastSelectionSystem detectada. El sistema migrará exclusivamente a SelectionService (GPU/BVH). Por favor, refactorice sus inyecciones pronto.');
        this._selectionService = null;
    }

    init() {
        this._selectionService = Registry.tryGet('SelectionService');
        if (!this._selectionService) {
            console.error('[CRITICAL] RaycastSelectionSystem Shim falló: SelectionService no está presente en la Bóveda de OMEGA.');
        }
        return this;
    }

    /**
     * Traducción del punto de entrada antiguo (Bloqueante/Frame-bound)
     * al nuevo sistema asincrónico (GPU Promise Race).
     */
    async getSelectionAt(screenX, screenY) {
        if (!this._selectionService) return null;
        
        // Passthrough al path del GPU
        const hit = await this._selectionService.queryAtScreen(screenX, screenY);
        return hit;
    }

    getSelection() {
        console.warn('⚠️ [DEPRECATION NOTICE] getSelection() sin coordenadas es ilegal en el nuevo path O(1). Pase x,y');
        return null;
    }
    
    destroy() {
        this._selectionService = null;
    }
}

export default RaycastSelectionSystem;
