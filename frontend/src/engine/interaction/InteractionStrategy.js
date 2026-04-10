import { Registry } from '../core/ServiceRegistry.js';

/**
 * InteractionStrategy.js
 * OMEGA V28 Master Edition — Input & Interaction
 */
export class InteractionStrategy {
    static phase = 'interaction';
    constructor(services) {
        this.services = services;
        this.isOverUI = false;
    }

    init() {
        console.log('[InteractionStrategy] OMEGA Masking System Active.');
        this.events = Registry.get('events');

        // Monitor global pointer events to detect UI intersection
        window.addEventListener('mousemove', (e) => {
            const hitUI = this.checkUITarget(e.target);
            if (hitUI !== this.isOverUI) {
                this.isOverUI = hitUI;
                this.events.emit('input:mask:change', { isMasked: this.isOverUI });
            }
        }, true);
    }

    checkUITarget(target) {
        if (!target) return false;

        // V9: Enhanced UI Boundary Detection
        if (target.closest('.os-window') || target.closest('.modular-window')) return true;
        if (target.closest('.glass-panel') && target.id !== 'system-bar') return true; 
        if (target.closest('.os-ui-root')) return true; // New V9 UI container
        
        // Context menus and dropdowns
        if (target.closest('.context-menu') || target.closest('.dropdown')) return true;

        // Explicitly allow background elements
        if (target === document.body || target.tagName === 'HTML') return false;
        if (target.id === 'window-layer' || target.id === 'hud-layer') return false;

        // If target is the 3D canvas, it's definitely NOT UI
        if (target.tagName === 'CANVAS' || target.id === 'universe' || target.id === 'galaxy-canvas') return false;
        
        // Fallback: If it's something else not inside a window, assume it's NOT UI (to prevent ghost blocking)
        return false;
    }

    shouldAllowWorldInput() {
        return !this.isOverUI;
    }
}
