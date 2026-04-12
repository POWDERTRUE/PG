import { StatusWidgets } from './StatusWidgets.js';
import { Dashboard } from './Dashboard.js';

/**
 * ==========================================================
 * Powder Galaxy Engine - HUDController V28 (OMEGA)
 * ==========================================================
 * @file HUDController.js
 * @description V38 HUD & Dashboard Orchestrator
 */
export class HUDController {
    constructor() {
        this.statusWidgets = new StatusWidgets();
        this.dashboard = new Dashboard();
        this.kernel = null;
    }

    init(kernel) {
        console.log('[HUDController] Initializing OMEGA V28 Interactive HUD Layers.');
        this.kernel = kernel;
        
        this.createSystemBar();
        this.statusWidgets.render(kernel);
        this.dashboard.render(kernel);

        this.bindGlobalKeys();
    }

    createSystemBar() {
        const bar = document.createElement('div');
        bar.id = 'system-bar';
        bar.className = 'glass-capsule-premium';
        
        // Add Dashboard Trigger Button
        const dashBtn = document.createElement('button');
        dashBtn.className = 'glass-btn-premium';
        dashBtn.innerHTML = 'DASH';
        dashBtn.style.cssText = `
            padding: 8px 24px;
            font-size: 10px;
            border-radius: 12px;
        `;
        dashBtn.onclick = () => {
            if (this.kernel) this.kernel.events.emit('os:toggle_dashboard');
        };
        
        bar.appendChild(dashBtn);
        document.body.appendChild(bar);
    }

    bindGlobalKeys() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                if (this.kernel) this.kernel.events.emit('os:toggle_dashboard');
            }
        });
    }
}

export const hudController = new HUDController();

