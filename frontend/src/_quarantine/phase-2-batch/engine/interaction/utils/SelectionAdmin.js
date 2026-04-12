/**
 * SelectionAdmin.js
 * OMEGA V31 — Global mitigation and control tool for GPUPicking
 */

import { Registry } from '../../core/ServiceRegistry.js';

export const SelectionAdmin = {
    
    /**
     * Fuerzamiento físico y manual de Fallback Universal
     * Apaga en seco todo el rendering pass y desvía al BVH
     */
    forceGlobalFallback: function() {
        console.warn('[OMEGA ADMIN] ALERTA: Forzando Fallback CPU Global para GPU Picking.');
        const rs = Registry.tryGet('SelectionService');
        if (rs) rs.config.gpuTimeoutMs = 0; // Obligará a perder siempre la carrera
        
        const events = Registry.tryGet('events');
        if (events) events.emit('PG:OS:ENABLE_GPU_PICKING', { enabled: false });
    },

    /**
     * Rehabilitar sistema por defecto
     */
    enableGPUPicking: function() {
        console.log('[OMEGA ADMIN] Rehabilitando hardware puro (GPU Picking).');
        const rs = Registry.tryGet('SelectionService');
        if (rs) rs.config.gpuTimeoutMs = 12; // Restaurar el timeout saludable
        
        const events = Registry.tryGet('events');
        if (events) events.emit('PG:OS:ENABLE_GPU_PICKING', { enabled: true });
    },

    /**
     * Aplica el aislamiento condicionado para Vendor
     */
    blockVendor: function(vendorSubstring) {
        console.warn(`[OMEGA ADMIN] Bloqueando driver vendor (RegEx test): ${vendorSubstring}`);
        const events = Registry.tryGet('events');
        if (events) events.emit('PG:OS:FORCE_CPU_FOR_VENDOR', { vendor: vendorSubstring, reason: `Bloqueo dinámico LULU (P95 Spikes)` });
    }
};

export default SelectionAdmin;
