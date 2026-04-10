import { Registry } from '../engine/core/ServiceRegistry.js';

const APPS = [
    {
        id: 'terminal',
        label: 'Terminal',
        caption: 'Control',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 6.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"></path>
                <path d="m8 11 2.4 2.4L8 15.8"></path>
                <path d="M12.6 15.8h3.4"></path>
            </svg>
        `
    },
    {
        id: 'explorer',
        label: 'Explorador',
        caption: 'Cartografia',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7.5h5l1.4 1.6H19a2 2 0 0 1 2 2v5.4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"></path>
                <path d="M3.8 11.3h16.4"></path>
            </svg>
        `
    },
    {
        id: 'gallery',
        label: 'Galeria',
        caption: 'Registro',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2"></rect>
                <circle cx="8.6" cy="10" r="1.3"></circle>
                <path d="m7 16 3.2-3.2 2.4 2.2 2.8-3 2.6 4"></path>
            </svg>
        `
    },
    {
        id: 'database',
        label: 'Base de datos',
        caption: 'Canon',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <ellipse cx="12" cy="7" rx="7.5" ry="2.8"></ellipse>
                <path d="M4.5 7v4.6C4.5 13.4 7.9 15 12 15s7.5-1.6 7.5-3.4V7"></path>
                <path d="M4.5 11.6v4.1C4.5 17.4 7.9 19 12 19s7.5-1.6 7.5-3.3v-4.1"></path>
            </svg>
        `
    },
    {
        id: 'hologram',
        label: 'Holograma',
        caption: 'Proyeccion',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4.5 6 8v8l6 3.5 6-3.5V8l-6-3.5Z"></path>
                <path d="m12 4.5 6 3.5-6 3.5L6 8l6-3.5Z"></path>
                <path d="M12 11.5v8"></path>
            </svg>
        `
    },
    {
        id: 'settings',
        label: 'Ajustes',
        caption: 'Sistema',
        icon: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 4.5 1.3 1.8 2.2.5.5 2.2 1.8 1.3-1.8 1.3-.5 2.2-2.2.5L12 17.5l-1.3-1.8-2.2-.5-.5-2.2-1.8-1.3 1.8-1.3.5-2.2 2.2-.5L12 4.5Z"></path>
                <circle cx="12" cy="11" r="2.3"></circle>
            </svg>
        `
    }
];

const TAB_FALLBACK_APPS = new Set(['terminal', 'gallery', 'settings']);

export class KernelBarSystem {
    constructor() {
        this.runtimeSignals = null;
        this.container = null;
        this.dock = null;
        this.isInitialized = false;
        this.buttons = new Map();
        this.windowStates = new Map();
        this.contextTarget = null;
        this.statusNode = null;
        this._onWindowState = this._onWindowState.bind(this);
        this._onHudTargetContext = this._onHudTargetContext.bind(this);
    }

    initialize() {
        if (this.isInitialized) return;

        this.container = document.getElementById('kernel-bar');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'kernel-bar';
            this.container.className = 'ui-layer';
            this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;';
            document.body.appendChild(this.container);
        } else {
            this.container.innerHTML = ''; // Clean up for Hot Reload
        }

        this.container.style.pointerEvents = 'none';
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');

        this.dock = document.createElement('div');
        this.dock.className = 'glass-panel kernel-dock';
        this.dock.innerHTML = `
            <div class="kernel-dock-head">
                <span class="kernel-dock-badge">OMEGA FLIGHT DECK</span>
                <span class="kernel-dock-status">Visor contextual para raton libre y vuelo</span>
            </div>
            <div class="kernel-dock-cluster"></div>
        `;
        this.statusNode = this.dock.querySelector('.kernel-dock-status');

        const cluster = this.dock.querySelector('.kernel-dock-cluster');
        APPS.forEach((app) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'kernel-btn';
            button.dataset.appId = app.id;
            button.setAttribute('aria-label', app.label);
            button.innerHTML = `
                <span class="kb-indicator"></span>
                <span class="kb-icon" aria-hidden="true">${app.icon}</span>
                <span class="kb-copy">
                    <span class="kb-label">${app.label}</span>
                    <span class="kb-caption">${app.caption}</span>
                </span>
            `;

            button.addEventListener('click', () => this._launch(app.id));
            button.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this._launch(app.id);
                }
            });

            this.buttons.set(app.id, button);
            cluster.appendChild(button);
        });

        this.container.appendChild(this.dock);
        this._setupMagnification(cluster);
        this._removeWindowStateListener = this.runtimeSignals?.on?.('PG:WINDOW_STATE', this._onWindowState) || null;
        this._removeHudContextListener = this.runtimeSignals?.on?.('PG:HUD_TARGET_CONTEXT', this._onHudTargetContext) || null;
        if (!this._removeWindowStateListener) {
            window.addEventListener('PG:WINDOW_STATE', this._onWindowState);
        }
        if (!this._removeHudContextListener) {
            window.addEventListener('PG:HUD_TARGET_CONTEXT', this._onHudTargetContext);
        }
        this.isInitialized = true;
        console.log('%c[KernelBar] Dock tactico inicializado.', 'color:#00ffcc;font-weight:bold');
    }

    _setupMagnification(cluster) {
        const MAX_SCALE = 1.35;
        const WAVE_RADIUS = 140; 
        
        cluster.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX;
            for (const button of this.buttons.values()) {
                if (button.classList.contains('is-layout-hidden')) continue;
                const rect = button.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const dist = Math.abs(mouseX - centerX);
                let scale = 1;
                if (dist < WAVE_RADIUS) {
                    const ratio = Math.pow(1 - (dist / WAVE_RADIUS), 1.25);
                    scale = 1 + ratio * (MAX_SCALE - 1);
                }
                button.style.setProperty('--kb-scale', scale);
                button.style.setProperty('--kb-y', `${-(scale - 1) * 32}px`);
                button.classList.add('is-magnetized');
            }
        });

        cluster.addEventListener('mouseleave', () => {
            for (const button of this.buttons.values()) {
                button.style.removeProperty('--kb-scale');
                button.style.removeProperty('--kb-y');
                button.classList.remove('is-magnetized');
            }
        });
    }

    _launch(appId) {
        window.dispatchEvent(new CustomEvent('WARP_FLIGHT_COMPLETE', {
            bubbles: true,
            detail: { appId, openWindow: true, source: 'dock' }
        }));
    }

    _onWindowState(event) {
        const detail = event?.detail || event || {};
        const appId = detail.appId;
        const state = detail.state;
        if (!appId || !this.buttons.has(appId)) return;
        this.windowStates.set(appId, state);
        this._syncButton(appId);
        this._syncDockStatus();
    }

    _onHudTargetContext(event) {
        const detail = event?.detail || event || {};
        this.contextTarget = {
            hudMode: !!detail.hudMode,
            appId: detail.appId || null,
            label: detail.label || null,
            isLocked: !!detail.isLocked,
            hasTarget: !!detail.hasTarget,
        };
        for (const appId of this.buttons.keys()) {
            this._syncButton(appId);
        }
        this._syncDockStatus();
    }

    _syncButton(appId) {
        const button = this.buttons.get(appId);
        if (!button) return;
        const state = this.windowStates.get(appId);
        const isWindowVisible = state === 'open' || state === 'focused' || state === 'restored' || state === 'minimized';
        const hasContextTarget = !!(this.contextTarget?.hudMode && this.contextTarget?.appId);
        const isContextual = !!(
            hasContextTarget &&
            this.contextTarget.appId === appId
        );
        const shouldHideForLayout = !!(
            this.contextTarget?.hudMode &&
            !isWindowVisible &&
            hasContextTarget &&
            !isContextual
        );
        button.classList.toggle('is-active', state === 'open' || state === 'restored' || state === 'focused');
        button.classList.toggle('is-minimized', state === 'minimized');
        button.classList.toggle('is-closed', state === 'closed');
        button.classList.toggle('is-contextual', isContextual);
        button.classList.toggle('is-layout-hidden', shouldHideForLayout);
        button.tabIndex = shouldHideForLayout ? -1 : 0;
        button.setAttribute('aria-hidden', shouldHideForLayout ? 'true' : 'false');
        this.dock?.classList.toggle('is-tab-layout', !!this.contextTarget?.hudMode);
        this.dock?.classList.toggle('has-context-target', !!(this.contextTarget?.hudMode && this.contextTarget?.appId));
    }

    _syncDockStatus() {
        if (!this.statusNode) return;
        if (!this.contextTarget?.hudMode) {
            this.statusNode.textContent = 'Visor contextual para raton libre y vuelo';
            return;
        }

        if (!this.contextTarget?.hasTarget || !this.contextTarget?.appId) {
            this.statusNode.textContent = 'TAB activo: selecciona una masa con modulo para desplegarla rapido';
            return;
        }

        const state = this.windowStates.get(this.contextTarget.appId);
        const verb =
            state === 'minimized' ? 'restaurar' :
            state === 'open' || state === 'focused' || state === 'restored' ? 'traer al frente' :
            'desplegar';
        const lockState = this.contextTarget.isLocked ? 'lock activo' : 'scan activo';
        this.statusNode.textContent = `${this.contextTarget.label} · ${lockState} · click en la masa o en el dock para ${verb}`;
    }
}
