// frontend/src/engine/ui/GalaxyMapOverlaySystem.js
import { Registry } from '../core/ServiceRegistry.js';
import gsap from 'gsap';

export class GalaxyMapOverlaySystem {
    constructor() {
        this.container = null;
        this.leftPanel = null;
        this.rightPanel = null;
        this.isActive = false;
        
        // Referencias a otros sistemas vía Registry
        this.events = Registry.get('events');
    }

    init() {
        this.buildDOM();
        this.bindEvents();
        console.log('[GalaxyMapOverlay] System online. V31 Tactical DOM ready.');
    }

    buildDOM() {
        // Contenedor principal anclado al body, ignorando eventos de mouse 
        // donde no haya paneles para dejar interactuar con el 3D
        this.container = document.createElement('div');
        this.container.id = 'galaxy-map-hud';
        this.container.style.cssText = `
            position: absolute;
            top: 0; left: 0; width: 100vw; height: 100vh;
            pointer-events: none;
            display: flex;
            justify-content: space-between;
            padding: 40px;
            box-sizing: border-box;
            font-family: 'Share Tech Mono', 'Oxanium', monospace;
            color: #00ffcc;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1000; /* Sobre el canvas, bajo LULU */
        `;

        // Panel Izquierdo: Datos fijos / Telemetría
        this.leftPanel = document.createElement('div');
        this.leftPanel.className = 'tactical-panel';
        this.leftPanel.style.cssText = `
            width: 300px;
            pointer-events: auto;
            border-left: 2px solid rgba(0, 255, 204, 0.8);
            padding-left: 20px;
            background: linear-gradient(90deg, rgba(10, 25, 47, 0.8) 0%, rgba(10, 25, 47, 0.2) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow: inset 0 0 20px rgba(0, 255, 204, 0.05);
            border: 1px solid rgba(0, 255, 204, 0.3);
            border-left-width: 4px;
            border-radius: 4px;
            padding: 24px;
            height: fit-content;
        `;
        this.leftPanel.innerHTML = `
            <h2 style="margin:0; font-size: 24px; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,255,204,0.5);">STAR SECTOR</h2>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 15px; line-height: 1.8;">
                <p style="margin:0;">STATUS: <span style="color:#fff; text-shadow: 0 0 5px #fff;">HOLOGRAPHIC OVERRIDE</span></p>
                <p style="margin:0;">NODES: <span id="telemetry-nodes">SYNCHRONIZING...</span></p>
                <p style="margin:0;">SECURITY: <span style="color:#ffaa00;">MILITARY GRADE</span></p>
            </div>
        `;

        // Panel Derecho: Target Dinámico
        this.rightPanel = document.createElement('div');
        this.rightPanel.className = 'tactical-panel';
        this.rightPanel.style.cssText = `
            width: 350px;
            pointer-events: auto;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            background: rgba(10, 25, 47, 0.5);
            border: 1px solid rgba(0, 255, 204, 0.3);
            border-right: 4px solid rgba(0, 255, 204, 0.8);
            box-shadow: inset 0 0 20px rgba(0, 255, 204, 0.05);
            padding: 24px;
            display: none; /* Oculto hasta seleccionar algo */
            height: fit-content;
            border-radius: 4px;
        `;
        
        this.container.appendChild(this.leftPanel);
        this.container.appendChild(this.rightPanel);
        
        const uiLayer = document.getElementById('window-layer') || document.body;
        uiLayer.appendChild(this.container);
    }

    bindEvents() {
        this.events = this.events || Registry.tryGet('events');

        this.events.on('OBJECT_SELECTED', (payload) => {
            if (!this.isActive) return;
            this.updateTargetInfo(payload.entity);
        });
        
        // Also listen to internal pointer selection events if RaycastSelectionSystem is different
        this.events.on('PG:INPUT:SELECT', (payload) => {
            if (!this.isActive) return;
            this.updateTargetInfo(payload.target);
        });

        // Transiciones de estado de cámara
        this.events.on('CAMERA_STATE_CHANGED', (state) => {
            if (state === 'GALAXY_MAP') {
                this.enable();
            } else if (this.isActive) {
                this.disable();
            }
        });
        
        // Listener the other way around: when navigation mode changes
        const rtSignals = Registry.tryGet('RuntimeSignals');
        if (rtSignals) {
            rtSignals.on('PG:NAVIGATION:MODE_CHANGED', (payload) => {
                if (payload.mode === 'GALAXY_MAP') {
                    this.enable();
                } else if (this.isActive) {
                    this.disable();
                }
            });
        }
    }

    updateTargetInfo(entity) {
        if (!entity || !entity.userData || !entity.userData.isMass) {
            gsap.to(this.rightPanel, { opacity: 0, duration: 0.2, onComplete: () => {
                this.rightPanel.style.display = 'none';
            }});
            return;
        }

        this.rightPanel.style.display = 'block';
        gsap.to(this.rightPanel, { opacity: 1, duration: 0.3 });
        
        const ud = entity.userData;

        this.rightPanel.innerHTML = `
            <div style="border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="margin:0; color:#fff; font-size: 18px; text-shadow: 0 0 8px rgba(255,255,255,0.4);">TARGET IDENT: ${ud.label || ud.name || 'UNKNOWN ANOMALY'}</h3>
                <span style="font-size:11px; color:#ffaa00; letter-spacing: 1px; display: block; margin-top: 4px;">CLASSIFICATION: ${ud.nodeType ? ud.nodeType.toUpperCase() : 'UNKNOWN'}</span>
            </div>
            <div style="font-size: 14px; line-height: 1.8; margin-bottom: 20px;">
                <p style="margin:4px 0;">TEMP: <span style="color:#fff;">${ud.stellarTemperature ? ud.stellarTemperature + ' K' : '---'}</span></p>
                <p style="margin:4px 0;">SYSTEM RADIUS: <span style="color:#fff;">${ud.systemRadius || '---'} u</span></p>
                <p style="margin:4px 0;">PLANET COUNT: <span style="color:#00ffcc;">${ud.systemPlanetCount || 0}</span></p>
            </div>
            <button class="warp-btn" style="
                width:100%; padding: 12px; 
                background: linear-gradient(90deg, rgba(0,255,204,0.1), rgba(0,255,204,0.02)); 
                border: 1px solid #00ffcc; 
                color: #00ffcc; cursor: pointer; font-family: 'Oxanium', monospace; font-weight: bold; font-size: 14px;
                letter-spacing: 2px; text-transform: uppercase;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='rgba(0,255,204,0.2)'; this.style.color='#fff';" 
              onmouseout="this.style.background='linear-gradient(90deg, rgba(0,255,204,0.1), rgba(0,255,204,0.02))'; this.style.color='#00ffcc';">
                INITIATE WARP SEQUENCE
            </button>
        `;

        this.rightPanel.querySelector('.warp-btn').addEventListener('click', () => {
            this.events.emit('INITIATE_WARP', { target: entity });
            const rtSignals = Registry.tryGet('RuntimeSignals');
            if (rtSignals && entity.userData && entity.userData.appId) {
                // Parse the id from 'star_X' to index X
                const idx = parseInt(entity.userData.appId.split('_')[1], 10);
                if (!isNaN(idx)) {
                    rtSignals.emit('PG:OS:COSMOS_WARP_TARGET', { 
                        targetId: idx, 
                        targetPosition: entity.position 
                    });
                }
            }
        });
    }

    enable() {
        if (this.isActive) return;
        this.isActive = true;
        this.container.style.opacity = '1';

        const holographicPass = window.Registry?.tryGet('HolographicOverridePass');
        if (holographicPass) holographicPass.setMode(true);
        
        // Actualizar el conteo de estrellas
        const stats = Registry.get('CelestialRegistry')?.stats?.();
        const nodesSpan = this.leftPanel.querySelector('#telemetry-nodes');
        if (nodesSpan) {
            nodesSpan.textContent = stats?.totalBodies ? stats.totalBodies.toLocaleString() : '210,042';
        }

        // Bloom punch for transition
        const postPass = window.Registry?.tryGet('PostProcessPass');
        if (postPass && postPass.bloomPass) {
            gsap.to(postPass.bloomPass, { strength: 2.5, duration: 0.3, yoyo: true, repeat: 1 });
        }
        
        // Add CSS class to body for specific pointer rendering if necessary
        document.body.classList.add('pg-galaxy-map-mode');
    }

    disable() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.style.opacity = '0';
        // this.rightPanel.style.display = 'none';

        const holographicPass = window.Registry?.tryGet('HolographicOverridePass');
        if (holographicPass) holographicPass.setMode(false);
        
        document.body.classList.remove('pg-galaxy-map-mode');
    }
}
