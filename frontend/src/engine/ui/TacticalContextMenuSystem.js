/**
 * TacticalContextMenuSystem.js
 * OMEGA V31 — Pure Polar DOM Radial Menu
 *
 * Arquitectura DOM-Polar con degradación a 4 nodos y EventBus tracking.
 */

import { Registry } from '../core/ServiceRegistry.js';

// ── Señales de entrada ────────────────────────────────────────────────────────
const OPEN_CONTEXT_MENU_SIGNAL  = 'PG:OS:OPEN_CONTEXT_MENU';
const CLOSE_CONTEXT_MENU_SIGNAL = 'PG:OS:CLOSE_CONTEXT_MENU';
const CONTEXT_CHANGED_SIGNAL    = 'PG:INPUT:CONTEXT_CHANGED';

// ── Señales de salida ─────────────────────────────────────────────────────────
const SIGNAL_WARP   = 'PG:NAV:REQUEST_PRECISION_TRAVEL';
const SIGNAL_INJECT = 'PG:LULU:REQUEST_PARTICLE_PROJECTOR';
const SIGNAL_SCAN   = 'PG:UI:OPEN_LULU_SCAN';
const SIGNAL_HUD_SELECT = 'PG:HUD:TACTICAL_SELECT';

const MENU_RADIUS_PX = 145;
const CLOSE_TRANSITION_MS = 240;

// Configuración de los 8 Nodos Ideales
const SECTOR_DATA_FULL = [
    { id: 'warp',   label: 'WARP',  color: '#38bdf8' },
    { id: 'scan',   label: 'SCAN',  color: '#a78bfa' },
    { id: 'comms',  label: 'COMMS', color: '#6b7280' },
    { id: 'eng',    label: 'ENG',   color: '#6b7280' },
    { id: 'sys',    label: 'SYS',   color: '#6b7280' },
    { id: 'cargo',  label: 'CRGO',  color: '#6b7280' },
    { id: 'inject', label: 'INJ',   color: '#f97316' },
    { id: 'cancel', label: 'ESC',   color: '#ef4444' }
];

export class TacticalContextMenuSystem {
    constructor() {
        this.phase = 'ui';

        // Dependencias del Kernel OMEGA
        this.events = Registry.get('events');
        if (!this.events || typeof this.events.emit !== 'function') {
            console.warn('TacticalContextMenuSystem: EventBus no disponible. Señales deshabilitadas.');
            this.events = { emit: () => {} };
        }
        this._runtimeSignals = null;

        // Atributos base
        this.activeTargetId        = null;
        this.activeDeterministicKey = null;
        this.activeScale           = 'MICRO';
        this.isActive              = false;
        
        // Settings interactivos
        this.nodeCount = 8;
        this.responsiveBreakpoints = { small: 480 };
        this._closeTimer = null;
        this._centerX = 0;
        this._centerY = 0;
        this._activeIndex = -1;
        this._deadzoneRadius = 40;
        
        this._sectorElements = [];

        this._handlePointerMove = this._onPointerMove.bind(this);
        this._handlePointerLeave = this._onPointerLeave.bind(this);
        this._handlePointerUp = this._onPointerUp.bind(this);
        this._onPointerDownOutside = this._onPointerDownOutside.bind(this);
        this._onResize = this._onResize.bind(this);

        this._buildDOM();
        this._applyResponsive();
        this._initSignalListeners();

        window.addEventListener('resize', this._onResize, { passive: true });
    }

    /**
     * Pure function: calcula índice polar dado un ángulo en radianes.
     * Mapea un Math.atan2 estandar donde -PI/2 es Arriba (Norte == indice 0).
     */
    static polarIndexFromAngle(angleRad, nodeCount) {
        const sector = (2 * Math.PI) / nodeCount;
        // Compensar -PI/2 (Norte) a 0. Añadir la mitad del sector para que el hitcone quede centrado.
        let a = angleRad + (Math.PI / 2) + (sector / 2);
        
        // Normalizar a positivo continuo
        while (a < 0) a += 2 * Math.PI;
        
        const idx = Math.floor((a % (2 * Math.PI)) / sector);
        return idx;
    }

    _buildDOM() {
        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'omega-radial-menu';
        this.menuContainer.className = 'is-hidden is-polar';
        this.menuContainer.setAttribute('role', 'dialog');
        this.menuContainer.setAttribute('aria-modal', 'true');
        
        // Para que se inserte en el hud-layer si existe, si no al body
        const hudLayer = document.getElementById('hud-layer');

        const visor = document.createElement('div');
        visor.className = 'polar-visor';
        
        const reticle = document.createElement('div');
        reticle.className = 'polar-reticle';
        
        this._trackerLine = document.createElement('div');
        this._trackerLine.className = 'polar-cursor-tracker';
        
        const targetContainer = document.createElement('div');
        targetContainer.className = 'polar-target-info';
        this._targetNameEl = document.createElement('div');
        this._targetNameEl.id = 'rm-target-name';
        this._targetNameEl.textContent = 'TARGET';
        const subLabel = document.createElement('div');
        subLabel.className = 'rm-target-sub';
        subLabel.textContent = 'HOLD';
        targetContainer.appendChild(this._targetNameEl);
        targetContainer.appendChild(subLabel);

        visor.appendChild(this._trackerLine);
        visor.appendChild(reticle);
        visor.appendChild(targetContainer);
        
        this.menuContainer.appendChild(visor);
        
        if (hudLayer) {
            hudLayer.appendChild(this.menuContainer);
        } else {
            document.body.appendChild(this.menuContainer);
        }

        this.menuContainer.addEventListener('pointerup', this._handlePointerUp);
        document.addEventListener('pointerdown', this._onPointerDownOutside);

        this._injectStyles();
    }

    // Configura los nodos visuales dinámicamente según nodeCount
    _applyResponsive() {
        const w = window.innerWidth;
        const targetCount = (w <= this.responsiveBreakpoints.small) ? 4 : 8;
        
        if (targetCount === this.nodeCount && this._sectorElements.length > 0) return;
        
        this.nodeCount = targetCount;
        this._activeIndex = -1;

        // Limpiar nodos viejos
        this._sectorElements.forEach(n => n.el.remove());
        this._sectorElements = [];

        const visor = this.menuContainer.querySelector('.polar-visor');
        const interval = 360 / this.nodeCount;

        // Si son 4 nodos, usar filtrado (eliminar placeholders diagonales)
        const activeData = this.nodeCount === 4 
            ? [SECTOR_DATA_FULL[0], SECTOR_DATA_FULL[2], SECTOR_DATA_FULL[6], SECTOR_DATA_FULL[7]] 
            : SECTOR_DATA_FULL;

        for (let i = 0; i < this.nodeCount; i++) {
            const nodeData = activeData[i] || { id: 'unknown', label: '---', color: '#fff' };
            const angle = i * interval;
            
            const el = document.createElement('div');
            el.className = 'polar-node';
            el.textContent = nodeData.label;
            el.style.setProperty('--angle', `${angle}deg`);
            el.style.setProperty('--node-color', nodeData.color);
            el.dataset.index = i;
            el.dataset.id = nodeData.id;
            
            const line = document.createElement('div');
            line.className = 'polar-node-line';
            el.appendChild(line);

            visor.appendChild(el);
            this._sectorElements.push({
                el,
                index: i,
                id: nodeData.id,
                label: nodeData.label,
                angle: angle
            });
        }
    }

    _onResize() {
        this._applyResponsive();
    }

    _injectStyles() {
        if (document.getElementById('polar-menu-styles')) return;
        const style = document.createElement('style');
        style.id = 'polar-menu-styles';
        style.textContent = `
            #omega-radial-menu.is-polar {
                position: fixed; left: var(--rm-x, 50%); top: var(--rm-y, 50%);
                transform: translate(-50%, -50%); width: 300px; height: 300px;
                z-index: 9999; pointer-events: auto; user-select: none;
                opacity: 0; transition: opacity 0.2s ease; touch-action: none;
            }
            #omega-radial-menu.is-polar.is-active { opacity: 1; }
            #omega-radial-menu.is-polar.is-closing { opacity: 0; pointer-events: none; }
            #omega-radial-menu.is-polar.is-hidden { display: none; }
            .polar-visor { position: absolute; inset: 0; }
            .polar-reticle {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 40px; height: 40px;
                border: 1px solid rgba(0, 229, 255, 0.4);
                border-radius: 50%; pointer-events: none;
            }
            .polar-target-info {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%); text-align: center;
                pointer-events: none; font-family: 'Courier New', monospace;
                color: rgba(0, 229, 255, 0.8); text-shadow: 0 0 4px rgba(0,255,255,0.4);
            }
            #rm-target-name { font-size: 11px; font-weight: bold; margin-bottom: 2px;}
            .rm-target-sub { font-size: 9px; opacity: 0.6; }
            .polar-cursor-tracker {
                position: absolute; top: 50%; left: 50%; width: 2px; height: 0;
                background: linear-gradient(to top, transparent, rgba(0, 229, 255, 0.4));
                transform-origin: bottom center; pointer-events: none;
                transition: opacity 0.1s; opacity: 0; z-index: 5;
            }
            .polar-node {
                position: absolute; top: 50%; left: 50%;
                --radius-base: -75px; --radius: var(--radius-base);
                transform: translate(-50%, -50%) rotate(var(--angle)) translateY(var(--radius)) rotate(calc(var(--angle) * -1));
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                            color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s;
                padding: 6px 12px; background: rgba(5, 10, 15, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(4px);
                border-radius: 3px; font-family: 'Courier New', monospace;
                font-size: 11px; font-weight: 600; letter-spacing: 1px;
                color: rgba(255, 255, 255, 0.4);
            }
            .polar-node-line {
                content: ''; position: absolute; top: 50%; left: -8px; width: 4px; height: 2px;
                background: rgba(255, 255, 255, 0.2); transform: translateY(-50%);
                transition: background 0.15s, width 0.15s, left 0.15s;
            }
            .polar-node.is-active {
                --radius: -125px; color: var(--node-color); border-color: var(--node-color);
                background: rgba(0, 20, 30, 0.95);
                box-shadow: 0 0 15px rgba(0,0,0,0.5), inset 0 0 10px rgba(0, 229, 255, 0.1);
                z-index: 10; text-shadow: 0 0 5px var(--node-color);
            }
            .polar-node.is-active .polar-node-line {
                background: var(--node-color); box-shadow: 0 0 5px var(--node-color);
                width: 8px; left: -12px;
            }
        `;
        document.head.appendChild(style);
    }

    _initSignalListeners() {
        const tryBind = () => {
            const rs = Registry.tryGet('RuntimeSignals');
            if (!rs) return false;
            this._runtimeSignals = rs;

            rs.on(OPEN_CONTEXT_MENU_SIGNAL, (payload) => {
                this.activeTargetId         = payload.targetId         ?? null;
                this.activeDeterministicKey = payload.deterministicKey ?? null;
                this.openMenu(payload.screenX, payload.screenY, payload.massData ?? {}, payload.scale ?? 'MICRO');
            });
            rs.on(CLOSE_CONTEXT_MENU_SIGNAL, () => this.closeMenu());
            rs.on(CONTEXT_CHANGED_SIGNAL, () => {
                if (this.isActive) this.closeMenu();
            });
            return true;
        };
        if (!tryBind()) {
            const t = setInterval(() => { if (tryBind()) clearInterval(t); }, 100);
        }
    }

    openMenu(screenX, screenY, massData = {}, scale = 'MICRO') {
        if (this._closeTimer !== null) clearTimeout(this._closeTimer);
        this.activeScale = scale;

        const finalX = Math.max(MENU_RADIUS_PX, Math.min(window.innerWidth  - MENU_RADIUS_PX, screenX));
        const finalY = Math.max(MENU_RADIUS_PX, Math.min(window.innerHeight - MENU_RADIUS_PX, screenY));
        this._centerX = finalX;
        this._centerY = finalY;
        
        this.menuContainer.style.setProperty('--rm-x', `${finalX}px`);
        this.menuContainer.style.setProperty('--rm-y', `${finalY}px`);

        const targetName = massData?.appName || massData?.label || massData?.name || null;
        if (this._targetNameEl) {
            this._targetNameEl.textContent = targetName ? targetName.toUpperCase().slice(0, 10) : 'TARGET';
        }

        this.isActive = true;
        this._setActiveSector(-1);
        this._trackerLine.style.opacity = '0';
        
        this.menuContainer.classList.remove('is-hidden', 'is-closing');
        window.addEventListener('pointermove', this._handlePointerMove, { passive: true });
        
        requestAnimationFrame(() => {
            this.menuContainer.classList.add('is-active');
        });
    }

    closeMenu() {
        if (!this.isActive && !this.menuContainer.classList.contains('is-active')) return;

        this.isActive = false;
        this.menuContainer.classList.remove('is-active');
        this.menuContainer.classList.add('is-closing');
        window.removeEventListener('pointermove', this._handlePointerMove);
        this._setActiveSector(-1);
        this._trackerLine.style.opacity = '0';

        if (this._closeTimer !== null) clearTimeout(this._closeTimer);
        this._closeTimer = setTimeout(() => {
            this.menuContainer.classList.add('is-hidden');
            this.menuContainer.classList.remove('is-closing');
            this._closeTimer = null;
        }, CLOSE_TRANSITION_MS + 20);
    }

    _setActiveSector(idx) {
        if (this._activeIndex === idx) return;
        this._activeIndex = idx;
        
        this._sectorElements.forEach(n => {
            if (n.index === idx) {
                if (!n.el.classList.contains('is-active')) n.el.classList.add('is-active');
            } else {
                n.el.classList.remove('is-active');
            }
        });
    }

    _onPointerMove(event) {
        if (!this.isActive) return;

        const dx = event.clientX - this._centerX;
        const dy = event.clientY - this._centerY;
        const distance = Math.hypot(dx, dy);

        if (distance < this._deadzoneRadius) {
            this._setActiveSector(-1);
            this._trackerLine.style.opacity = '0';
            return;
        }

        // Tracker estético dinámico (convertimos rad a grados CSS)
        const angleRad = Math.atan2(dy, dx);
        let cssAngle = (angleRad * (180 / Math.PI) + 90 + 360) % 360;

        this._trackerLine.style.opacity = '1';
        this._trackerLine.style.height = `${Math.min(distance, 90)}px`;
        this._trackerLine.style.transform = `translate(-50%, 0) rotate(${cssAngle}deg)`;

        // Llama a la función pura estructural OMEGA para resolver index
        const idx = TacticalContextMenuSystem.polarIndexFromAngle(angleRad, this.nodeCount);
        this._setActiveSector(idx);
    }

    _onPointerLeave() {
        if (!this.isActive) return;
        this._setActiveSector(-1);
    }

    _onPointerUp(e) {
        if (!this.isActive || this._activeIndex === -1) {
            this.closeMenu();
            return;
        }

        this._triggerNode(this._activeIndex);
        this.closeMenu();
    }

    _onPointerDownOutside(e) {
        if (this.isActive && !this.menuContainer.contains(e.target)) {
            this.closeMenu();
        }
    }

    _triggerNode(idx) {
        const nodeObj = this._sectorElements.find(s => s.index === idx);
        if (!nodeObj) return;

        const action = nodeObj.id;

        // Despachar a nivel Global de la Interface (LULU scanner y Telemetría)
        if (this.events) {
            this.events.emit(SIGNAL_HUD_SELECT, {
                index: idx,
                actionId: action,
                label: nodeObj.label,
                targetId: this.activeTargetId,
                source: 'TacticalContextMenuSystem',
                ts: Date.now()
            });
        }

        // Validar si es un placeholder decorativo
        if (['comms', 'eng', 'sys', 'cargo'].includes(action)) {
            return;
        }

        if (action !== 'cancel' && !this.activeTargetId) {
            return;
        }

        const rs = this._runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (!rs) return;

        // Despachar a nivel físico del Kernel
        switch (action) {
            case 'warp':
                rs.emit(SIGNAL_WARP, {
                    source: 'tactical-radial-menu',
                    targetId: this.activeTargetId,
                    deterministicKey: this.activeDeterministicKey,
                });
                break;
            case 'inject':
                rs.emit(SIGNAL_INJECT, {
                    source: 'tactical-radial-menu',
                    overrideTargetId: this.activeTargetId,
                    deterministicKey: this.activeDeterministicKey,
                });
                break;
            case 'scan':
                rs.emit(SIGNAL_SCAN, {
                    source: 'tactical-radial-menu',
                    targetId: this.activeTargetId,
                    deterministicKey: this.activeDeterministicKey,
                });
                break;
        }
    }

    init() { return this; }
    
    getDebugState() {
        return {
            isActive: this.isActive,
            activeTargetId: this.activeTargetId,
            nodeCount: this.nodeCount
        };
    }

    destroy() {
        document.removeEventListener('pointerdown', this._onPointerDownOutside);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('pointermove', this._handlePointerMove);
        this.menuContainer?.remove();
        if (this._closeTimer !== null) clearTimeout(this._closeTimer);
    }
}

export default TacticalContextMenuSystem;
