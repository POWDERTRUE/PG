// frontend/src/windows/systems/WindowDOMSystem.js
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Registry } from '../../engine/core/ServiceRegistry.js';
import { SpatialAnchorSystem } from './SpatialAnchorSystem.js';

/**
 * WindowDOMSystem
 * Creates and manages glass silicon OS windows inside #window-layer.
 */
export class WindowDOMSystem {
    constructor(layerEl = null, scene = null) {
        this.container = this._resolveLayerElement(layerEl);
        this.scene = scene || layerEl?.scene || window?.engine?.scene || null;
        this.camera = window?.engine?.camera || null;
        this.zIndexSeed = 1200;
        this.collapsibleWindows = new Map(); // Track collapsible windows
        this.droneObjects = new Map();
        this.messengerObjects = new Map();
        this.bubbleAnimations = new Map();
        this.worldPulseObjects = new Map();
        this._droneOrbitRaf = null;
        this._messengerRaf = null;
        this._droneOrbitCenter = new THREE.Vector3();
        this.hudModeActive = false;
        this.layoutContextAppId = null;
        this._layoutRaf = null;
        this._isLifecycleReady = false;
        this.layoutStorageKey = 'pg.window.layout.v1';
        this._boundHudMode = this._onHudMode.bind(this);
        this._boundHudTargetContext = this._onHudTargetContext.bind(this);
        this._boundHudLayoutMetrics = this._scheduleHudLayout.bind(this);
        this._boundViewportChange = this._scheduleHudLayout.bind(this);
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.pointerPresentation = Registry.tryGet('PointerPresentationController') || Registry.tryGet('pointerPresentation');
        
        this.spatialAnchorSystem = new SpatialAnchorSystem(this.camera, document.body);

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'window-layer';
            this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000;';
            document.body.appendChild(this.container);
            console.warn('[WindowDOMSystem] #window-layer not found, auto-created.');
        }

        this.container.style.pointerEvents = 'none';
        this.windowShelf = this._ensureWindowShelf();
        this._boundNotificationHandler = this.showHologramNotification.bind(this);
    }

    initialize() {
        if (WindowDOMSystem._activeInstance && WindowDOMSystem._activeInstance !== this) {
            return;
        }
        if (this._isLifecycleReady) {
            return;
        }
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        WindowDOMSystem._activeInstance = this;
        this._isLifecycleReady = true;
        window.addEventListener('SHOW_LARGE_NOTIFICATION', this._boundNotificationHandler);
        this._removeHudModeListener = this.runtimeSignals?.on?.('PG:HUD_MODE', this._boundHudMode) || null;
        this._removeHudTargetContextListener = this.runtimeSignals?.on?.('PG:HUD_TARGET_CONTEXT', this._boundHudTargetContext) || null;
        if (!this._removeHudModeListener) {
            window.addEventListener('PG:HUD_MODE', this._boundHudMode);
        }
        if (!this._removeHudTargetContextListener) {
            window.addEventListener('PG:HUD_TARGET_CONTEXT', this._boundHudTargetContext);
        }
        window.addEventListener('PG:HUD_LAYOUT_METRICS', this._boundHudLayoutMetrics);
        window.addEventListener('resize', this._boundViewportChange);
    }

    dispose() {
        if (WindowDOMSystem._activeInstance !== this) {
            return;
        }
        window.removeEventListener('SHOW_LARGE_NOTIFICATION', this._boundNotificationHandler);
        this._removeHudModeListener?.();
        this._removeHudModeListener = null;
        this._removeHudTargetContextListener?.();
        this._removeHudTargetContextListener = null;
        window.removeEventListener('PG:HUD_MODE', this._boundHudMode);
        window.removeEventListener('PG:HUD_TARGET_CONTEXT', this._boundHudTargetContext);
        window.removeEventListener('PG:HUD_LAYOUT_METRICS', this._boundHudLayoutMetrics);
        window.removeEventListener('resize', this._boundViewportChange);
        if (this._layoutRaf) {
            cancelAnimationFrame(this._layoutRaf);
            this._layoutRaf = null;
        }
        this._isLifecycleReady = false;
        WindowDOMSystem._activeInstance = null;
    }

    _getPointerPresentationController() {
        this.pointerPresentation =
            this.pointerPresentation ||
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        return this.pointerPresentation;
    }

    _resolveLayerElement(layerEl) {
        if (this._isElement(layerEl)) {
            return layerEl;
        }
        if (this._isElement(layerEl?.container)) {
            return layerEl.container;
        }
        if (this._isElement(layerEl?.domSystem?.container)) {
            return layerEl.domSystem.container;
        }
        return document.getElementById('window-layer');
    }

    _isElement(value) {
        return !!value && typeof value === 'object' && value.nodeType === 1;
    }

    _readWindowLayoutStore() {
        try {
            const raw = localStorage.getItem(this.layoutStorageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    _writeWindowLayoutStore(store) {
        try {
            localStorage.setItem(this.layoutStorageKey, JSON.stringify(store));
        } catch (_) {}
    }

    _saveWindowLayoutState(windowId) {
        const win = document.getElementById(windowId);
        const state = this.collapsibleWindows.get(windowId);
        if (!win || !state) return;
        const sourceStyles = state.hudDockRestore || (state.isCollapsed ? state.originalStyles : null);
        const left = sourceStyles?.left || win.style.left || '';
        const top = sourceStyles?.top || win.style.top || '';
        if (!left || !top) return;
        const store = this._readWindowLayoutStore();
        store[windowId] = {
            appId: state.appId,
            left,
            top,
            zIndex: sourceStyles?.zIndex || win.style.zIndex || '',
            isCollapsed: !!state.isCollapsed
        };
        this._writeWindowLayoutStore(store);
    }

    _loadWindowLayoutState(windowId) {
        const store = this._readWindowLayoutStore();
        return store[windowId] || null;
    }

    _removeWindowLayoutState(windowId) {
        const store = this._readWindowLayoutStore();
        if (!store[windowId]) return;
        delete store[windowId];
        this._writeWindowLayoutStore(store);
    }

    getWorkspaceWindows() {
        if (!this.container) {
            return [];
        }
        return Array.from(this.container.querySelectorAll('.glass-window'))
            .filter((win) => {
                const style = window.getComputedStyle(win);
                return style.display !== 'none' && style.visibility !== 'hidden' && !win.classList.contains('is-hud-stashed');
            });
    }

    _getRestingWindowTransform() {
        return 'scale(1)';
    }

    _applyStoredWindowLayout(win, storedLayout = null) {
        const state = this.collapsibleWindows.get(win.id);
        if (!win || !storedLayout) return false;
        if (storedLayout.appId && state?.appId && storedLayout.appId !== state.appId) return false;

        const left = Number.parseFloat(storedLayout.left);
        const top = Number.parseFloat(storedLayout.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return false;

        const clamped = this._clampWindowPosition(win, left, top);
        win.style.position = 'absolute';
        win.style.left = `${Math.round(clamped.left)}px`;
        win.style.top = `${Math.round(clamped.top)}px`;
        win.style.transform = this._getRestingWindowTransform();

        const zIndex = Number.parseInt(storedLayout.zIndex, 10);
        if (Number.isFinite(zIndex)) {
            this.zIndexSeed = Math.max(this.zIndexSeed, zIndex);
            win.style.zIndex = String(zIndex);
        }

        return true;
    }

    injectWindow(appId, metadata = {}) {
        const windowId = `os-window-${appId}`;
        const existing = document.getElementById(windowId);
        const customRenderer = typeof metadata.customRender === 'function' ? metadata.customRender : null;
        if (existing) {
            const state = this.collapsibleWindows.get(windowId);
            if (state) {
                state.metadata = metadata;
            }
            if (typeof metadata.windowClassName === 'string' && metadata.windowClassName.trim()) {
                metadata.windowClassName.split(/\s+/).filter(Boolean).forEach((cls) => existing.classList.add(cls));
            }
            this._promoteWindow(existing);
            existing.style.opacity = '1';
            existing.style.transform = this._getRestingWindowTransform();
            existing.style.transition = 'opacity 0.24s ease, transform 0.28s ease';
            existing.__refreshEditor?.(metadata);
            existing.__refreshCustom?.(metadata);
            // Restore from collapsed state if applicable
            if (this.collapsibleWindows.get(windowId)?.isCollapsed) this._toggleWindowCollapse(windowId, false);
            else {
                this._dispatchWindowState(appId, 'focused', windowId);
                this._scheduleHudLayout();
            }
            return existing;
        }

        const win = document.createElement('div');
        win.id = windowId;
        win.dataset.appId = appId;
        win.className = 'glass-window glass-ice';
        if (typeof metadata.windowClassName === 'string' && metadata.windowClassName.trim()) {
            metadata.windowClassName.split(/\s+/).filter(Boolean).forEach((cls) => win.classList.add(cls));
        }

        const isMetamorphosis = metadata.nodeType === 'metamorph-moon';
        const isPlanetWindow = metadata.nodeType === 'planet' || metadata.nodeType === 'star';
        
        if (isMetamorphosis) {
            win.classList.add('is-metamorphosis-window');
        }
        
        if (isPlanetWindow) {
            win.classList.add('is-planet-window');
        }

        // All windows can collapse into an accessible sphere.
        const savedLayout = this._loadWindowLayoutState(windowId);
        this.collapsibleWindows.set(windowId, { isCollapsed: false, appId, metadata });

        const label = (metadata.parentName || metadata.appName || appId).toUpperCase();
        const header = document.createElement('div');
        header.className = 'glass-header';
        header.innerHTML = `
            <span class="glass-header-controls">
                <span class="os-window-dot os-window-close" data-close></span>
                <span class="os-window-dot os-window-min"></span>
                <span class="os-window-dot os-window-max"></span>
            </span>
            <div class="glass-header-copy">
                <span class="glass-header-badge">${isMetamorphosis ? 'Metamorfosis' : 'Sistema orbital'}</span>
                <span class="glass-header-title">${label}</span>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'glass-content';

        if (customRenderer) {
            win.__refreshCustom = (nextMetadata) => {
                const renderer = typeof nextMetadata?.customRender === 'function'
                    ? nextMetadata.customRender
                    : customRenderer;
                renderer?.(content, nextMetadata ?? metadata, win);
            };
            win.__refreshCustom(metadata);
        } else if (isMetamorphosis) {
            win.__refreshEditor = (nextMetadata) => this._renderMetamorphosisPanel(content, appId, nextMetadata, win);
            this._renderMetamorphosisPanel(content, appId, metadata, win);
        } else {
            this._renderStandardModule(content, appId, metadata);
        }

        win.appendChild(header);
        win.appendChild(content);
        this.container.appendChild(win);

        win.style.transform = this._getRestingWindowTransform();
        if (!this._applyStoredWindowLayout(win, savedLayout)) {
            this._positionWindow(win);
        }
        this._promoteWindow(win);
        this._makeWindowDraggable(win, header);

        win.style.opacity = '0';
        win.style.transform = 'translate3d(0, 18px, 0) scale(0.96)';

        requestAnimationFrame(() => {
            win.style.transition = 'opacity 0.36s ease, transform 0.45s cubic-bezier(0.22,1.2,0.35,1)';
            win.style.opacity = '1';
            win.style.transform = this._getRestingWindowTransform();
        });

        win.addEventListener('pointerdown', () => this._promoteWindow(win));

        const closeBtn = header.querySelector('[data-close]');
        closeBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this._closeWindow(win);
        });
        
        // Add collapse/expand button for any window.
        const minBtn = header.querySelector('.os-window-min');
        minBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this._toggleWindowCollapse(windowId);
        });

        // Keep window draggability and promotion active when collapsed or expanded.
        win.addEventListener('pointerdown', () => this._promoteWindow(win));

        // Si hay masa conectada al appId, inicia la nave mensajera inmediatamente
        const state = this.collapsibleWindows.get(windowId);
        if (state && !state.massObject) {
            const massObject = this._findMassObjectByAppId(appId);
            if (massObject) {
                state.massObject = massObject;
                this._spawnMessengerForWindow(windowId, massObject);
            }
        }

        this._saveWindowLayoutState(windowId);
        this._dispatchWindowState(appId, 'open', windowId);
        this._scheduleHudLayout();

        return win;
    }

    _renderStandardModule(content, appId, metadata = {}) {
        const isPlanet = metadata.nodeType === 'planet' || metadata.nodeType === 'star';
        const label = (metadata.appName || appId).toUpperCase();
        const planetClass = metadata.planetClass || 'desconocida';
        const dist = metadata.distance ? `${Math.round(metadata.distance)} km` : 'N/A';
        const badgeText = isPlanet ? 'Sistema planetario' : 'Modulo del sistema';
        const copyText = isPlanet ? `Conexion establecida con el planeta de clase ${planetClass}.` : 'Conexion establecida con el subsistema seleccionado del universo.';

        let appSpecificHTML = '';
        if (appId === 'terminal') {
            appSpecificHTML = `
                <style>@keyframes txtblink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }</style>
                <div style="background:rgba(0,15,30,0.7); padding:16px; font-family:'Courier New', monospace; color:#00ffcc; border-radius:6px; margin-top:20px; border:1px solid rgba(0,255,204,0.2); font-size:12px; line-height:1.6; box-shadow: inset 0 0 20px rgba(0, 255, 204, 0.05);">
                    <div style="color:#00ffcc; opacity:0.6;">[${new Date().toLocaleTimeString()}] CONECTANDO A TERMINAL ORBITAL...</div>
                    <div style="color:#ffffff;">> CLASE DE SUPERFICIE: <span style="color:#ffaa00;">${planetClass.toUpperCase()}</span></div>
                    <div style="color:#ffffff;">> ESTADO TERMODINAMICO: ESTABLE</div>
                    <div style="margin-top:10px;">> <span style="animation: txtblink 1s step-end infinite; background:#00ffcc; color:#000;">&nbsp;</span></div>
                </div>
            `;
        } else if (appId === 'explorer') {
            appSpecificHTML = `
                <div style="margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div style="background:linear-gradient(135deg, rgba(0,136,255,0.1) 0%, rgba(0,0,0,0) 100%); padding:12px; border-left:3px solid #0088ff; border-radius:4px; font-size:11px; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(0,136,255,0.2)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(0,136,255,0.1) 0%, rgba(0,0,0,0) 100%)'">
                        <div style="color:#0088ff; font-weight:bold; margin-bottom:4px;">[ARCH] Bioma local</div>
                        <div style="color:#8899aa; font-size:10px;">Analisis de flora y fauna</div>
                    </div>
                    <div style="background:linear-gradient(135deg, rgba(0,255,200,0.1) 0%, rgba(0,0,0,0) 100%); padding:12px; border-left:3px solid #00ffc8; border-radius:4px; font-size:11px; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(0,255,200,0.2)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(0,255,200,0.1) 0%, rgba(0,0,0,0) 100%)'">
                        <div style="color:#00ffc8; font-weight:bold; margin-bottom:4px;">[ARCH] Especies</div>
                        <div style="color:#8899aa; font-size:10px;">Formas de vida activas</div>
                    </div>
                    <div style="background:linear-gradient(135deg, rgba(255,136,0,0.1) 0%, rgba(0,0,0,0) 100%); padding:12px; border-left:3px solid #ff8800; border-radius:4px; font-size:11px; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,136,0,0.2)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(255,136,0,0.1) 0%, rgba(0,0,0,0) 100%)'">
                        <div style="color:#ff8800; font-weight:bold; margin-bottom:4px;">[ARCH] Geologia</div>
                        <div style="color:#8899aa; font-size:10px;">Composicion del manto</div>
                    </div>
                    <div style="background:linear-gradient(135deg, rgba(255,50,100,0.1) 0%, rgba(0,0,0,0) 100%); padding:12px; border-left:3px solid #ff3264; border-radius:4px; font-size:11px; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,50,100,0.2)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(255,50,100,0.1) 0%, rgba(0,0,0,0) 100%)'">
                        <div style="color:#ff3264; font-weight:bold; margin-bottom:4px;">[ARCH] Ruinas</div>
                        <div style="color:#8899aa; font-size:10px;">Estructuras precursores</div>
                    </div>
                </div>
            `;
        } else if (appId === 'gallery') {
            appSpecificHTML = `
                <div style="margin-top:20px; display:flex; gap:12px; overflow-x:auto; padding-bottom:8px;">
                    <div style="min-width:140px; height:100px; background:linear-gradient(to top, rgba(0,255,200,0.1), transparent); border:1px solid rgba(0,255,200,0.4); border-radius:6px; position:relative; overflow:hidden; display:flex; align-items:flex-end; padding:8px; box-sizing:border-box;">
                        <span style="font-size:10px; color:#fff; text-shadow:0 0 4px #000;">Superficie Alfa</span>
                    </div>
                    <div style="min-width:140px; height:100px; background:linear-gradient(to top, rgba(0,150,255,0.1), transparent); border:1px solid rgba(0,150,255,0.4); border-radius:6px; position:relative; overflow:hidden; display:flex; align-items:flex-end; padding:8px; box-sizing:border-box;">
                        <span style="font-size:10px; color:#fff; text-shadow:0 0 4px #000;">Corteza Subterranea</span>
                    </div>
                    <div style="min-width:140px; height:100px; background:linear-gradient(to top, rgba(255,100,50,0.1), transparent); border:1px solid rgba(255,100,50,0.4); border-radius:6px; position:relative; overflow:hidden; display:flex; align-items:flex-end; padding:8px; box-sizing:border-box;">
                        <span style="font-size:10px; color:#fff; text-shadow:0 0 4px #000;">Anomalia 7</span>
                    </div>
                </div>
            `;
        } else if (appId === 'database') {
             appSpecificHTML = `
                <div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:6px; margin-top:20px; font-size:12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                        <span style="color:#aaa;">Poblacion Total:</span>
                        <span style="color:#fff;">[Dato Corrupto]</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                        <span style="color:#aaa;">Composicion Atmosferica:</span>
                        <span style="color:#00ffc8;">N2 78% / O2 21%</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#aaa;">Nivel de radiacion:</span>
                        <span style="color:#ffaa00;">Beta / Moderado</span>
                    </div>
                </div>
            `;
        } else if (appId === 'settings') {
             appSpecificHTML = `
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:12px; background:rgba(0,0,0,0.2); padding:16px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
                    <label style="display:flex; align-items:center; gap:12px; font-size:12px; color:#fff; cursor:pointer;">
                        <input type="checkbox" checked style="accent-color:#00ffc8;"> Sincronizar huso horario orbital
                    </label>
                    <label style="display:flex; align-items:center; gap:12px; font-size:12px; color:#fff; cursor:pointer;">
                        <input type="checkbox" style="accent-color:#00ffc8;"> Alertas de radiacion temporal
                    </label>
                    <label style="display:flex; align-items:center; gap:12px; font-size:12px; color:#fff; cursor:pointer;">
                        <input type="checkbox" checked style="accent-color:#00ffc8;"> Auto-anclar camara al warp
                    </label>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="module-window" style="animation: fade 0.3s ease;">
                <div class="module-window-badge">${badgeText}</div>
                <div class="module-window-title" style="text-shadow: 0 0 10px rgba(255,255,255,0.3); letter-spacing: 1px;">${label}</div>
                <div class="module-window-copy" style="color: #9ab;">${copyText}</div>
                <div class="module-window-grid">
                    <div class="module-window-cell">
                        <span class="module-window-key">Estado</span>
                        <span class="module-window-value" style="color:#00ffc8; text-shadow:0 0 5px #00ffc8;">En linea</span>
                    </div>
                    <div class="module-window-cell">
                        <span class="module-window-key">${isPlanet ? 'Clase Registrada' : 'Enlace'}</span>
                        <span class="module-window-value" style="color:#fff;">${isPlanet ? planetClass.toUpperCase() : 'Nucleo sincronizado'}</span>
                    </div>
                    <div class="module-window-cell module-window-cell-wide">
                        <span class="module-window-key">${isPlanet ? 'Distancia orbital exacta' : 'Sesion'}</span>
                        <span class="module-window-value" style="color:#ffaa00;">${isPlanet ? dist : Math.random().toString(36).slice(2, 10).toUpperCase()}</span>
                    </div>
                </div>
                ${appSpecificHTML}
            </div>
        `;
    }

    _renderMetamorphosisPanel(content, appId, metadata, win) {
        const context = this._resolveMassContext(appId);
        const label = (metadata.parentName || metadata.appName || appId).toUpperCase();

        if (!context.mass || !context.orbitEntry) {
            content.innerHTML = `
                <div class="metamorph-window">
                    <div class="metamorph-window-badge">Satelite humano de metamorfosis</div>
                    <div class="metamorph-window-title">${label}</div>
                    <div class="metamorph-window-copy">La masa vinculada no esta disponible para edicion en este momento.</div>
                </div>
            `;
            return;
        }

        const material = context.mass.material;
        const initialState = {
            scale: Number(context.mass.scale.x || 1),
            orbitSpeed: Number(context.orbitEntry.speed || 0),
            glow: Number(this._readGlowStrength(material)),
            color: material?.color ? `#${material.color.getHexString()}` : '#dff8ff'
        };

        content.innerHTML = `
            <div class="metamorph-window">
                <div class="metamorph-window-hero">
                    <div class="metamorph-window-badge">Satelite humano de metamorfosis</div>
                    <div class="metamorph-window-title">${label}</div>
                    <div class="metamorph-window-copy">Panel modular de dos planos para deformar la masa seleccionada a gusto humano, sin perder el lenguaje glass ice del universo.</div>
                </div>

                <div class="metamorph-window-layout">
                    <section class="metamorph-plane metamorph-plane-primary">
                        <div class="metamorph-plane-head">
                            <div class="metamorph-plane-title">Plano de control</div>
                            <div class="metamorph-plane-copy">Ajustes directos sobre la masa vinculada en tiempo real.</div>
                        </div>
                        <div class="metamorph-window-grid">
                            <label class="meta-control">
                                <span class="meta-control-key">Escala de la masa</span>
                                <input class="meta-control-slider" data-role="scale" type="range" min="0.7" max="1.85" step="0.01" value="${initialState.scale.toFixed(2)}">
                                <span class="meta-control-value" data-value="scale">${initialState.scale.toFixed(2)}x</span>
                            </label>
                            <label class="meta-control">
                                <span class="meta-control-key">Velocidad orbital</span>
                                <input class="meta-control-slider" data-role="orbitSpeed" type="range" min="0.02" max="1.8" step="0.01" value="${initialState.orbitSpeed.toFixed(2)}">
                                <span class="meta-control-value" data-value="orbitSpeed">${initialState.orbitSpeed.toFixed(2)} rad</span>
                            </label>
                            <label class="meta-control">
                                <span class="meta-control-key">Intensidad del aura</span>
                                <input class="meta-control-slider" data-role="glow" type="range" min="0.02" max="0.75" step="0.01" value="${initialState.glow.toFixed(2)}">
                                <span class="meta-control-value" data-value="glow">${initialState.glow.toFixed(2)}</span>
                            </label>
                            <label class="meta-control meta-control-color">
                                <span class="meta-control-key">Color base</span>
                                <input class="meta-control-color-input" data-role="color" type="color" value="${initialState.color}">
                                <span class="meta-control-value" data-value="color">${initialState.color.toUpperCase()}</span>
                            </label>
                        </div>
                    </section>

                    <aside class="metamorph-plane metamorph-plane-secondary">
                        <div class="metamorph-plane-head">
                            <div class="metamorph-plane-title">Segundo plano</div>
                            <div class="metamorph-plane-copy">Lectura elaborada del panel 2D. Puedes arrastrar esta ventana libremente por la pantalla.</div>
                        </div>
                        <div class="metamorph-plane-grid">
                            <div class="metamorph-plane-cell">
                                <span class="metamorph-plane-key">Representacion 3D</span>
                                <span class="metamorph-plane-value">Satelite humano</span>
                            </div>
                            <div class="metamorph-plane-cell">
                                <span class="metamorph-plane-key">Modo</span>
                                <span class="metamorph-plane-value">Metamorfosis total</span>
                            </div>
                            <div class="metamorph-plane-cell">
                                <span class="metamorph-plane-key">Masa vinculada</span>
                                <span class="metamorph-plane-value">${label}</span>
                            </div>
                            <div class="metamorph-plane-cell">
                                <span class="metamorph-plane-key">Plano 2D</span>
                                <span class="metamorph-plane-value">Arrastrable</span>
                            </div>
                            <div class="metamorph-plane-cell metamorph-plane-cell-wide">
                                <span class="metamorph-plane-key">Estado</span>
                                <span class="metamorph-plane-value" data-value="status">Sintonia orbital activa</span>
                            </div>
                        </div>
                        <div class="metamorph-plane-note">El satelite humano encarna la huella con la que deformamos y reescribimos las masas del universo.</div>
                    </aside>
                </div>

                <div class="metamorph-window-footer">
                    <button class="meta-action" type="button" data-action="reset">Restaurar masa</button>
                    <button class="meta-action meta-action-secondary" type="button" data-action="center">Centrar panel</button>
                    <div class="metamorph-window-status">Editor listo. Este panel puede moverse como modulo 2D sobre el universo.</div>
                </div>
            </div>
        `;

        const scaleInput = content.querySelector('[data-role="scale"]');
        const orbitInput = content.querySelector('[data-role="orbitSpeed"]');
        const glowInput = content.querySelector('[data-role="glow"]');
        const colorInput = content.querySelector('[data-role="color"]');
        const resetButton = content.querySelector('[data-action="reset"]');
        const centerButton = content.querySelector('[data-action="center"]');

        const scaleValue = content.querySelector('[data-value="scale"]');
        const orbitValue = content.querySelector('[data-value="orbitSpeed"]');
        const glowValue = content.querySelector('[data-value="glow"]');
        const colorValue = content.querySelector('[data-value="color"]');
        const statusValue = content.querySelector('[data-value="status"]');

        const setStatus = (text) => {
            if (statusValue) {
                statusValue.textContent = text;
            }
        };

        const applyColor = () => {
            if (!material?.color) {
                return;
            }

            material.color.set(colorInput.value);
            if (material.emissive) {
                material.emissive.copy(material.color).multiplyScalar(Number(glowInput.value));
            }
        };

        const updateScale = () => {
            const value = Number(scaleInput.value);
            context.mass.scale.setScalar(value);
            scaleValue.textContent = `${value.toFixed(2)}x`;
            setStatus('Escala de la masa reconfigurada');
        };

        const updateOrbit = () => {
            const value = Number(orbitInput.value);
            context.orbitEntry.speed = value;
            orbitValue.textContent = `${value.toFixed(2)} rad`;
            setStatus('Velocidad orbital ajustada');
        };

        const updateGlow = () => {
            const value = Number(glowInput.value);
            if (material?.emissive) {
                material.emissive.copy(material.color).multiplyScalar(value);
            }
            glowValue.textContent = value.toFixed(2);
            setStatus('Aura luminica modulada');
        };

        const updateColor = () => {
            applyColor();
            colorValue.textContent = colorInput.value.toUpperCase();
            setStatus('Color base reescrito');
        };

        const resetAll = () => {
            scaleInput.value = initialState.scale.toFixed(2);
            orbitInput.value = initialState.orbitSpeed.toFixed(2);
            glowInput.value = initialState.glow.toFixed(2);
            colorInput.value = initialState.color;
            updateScale();
            updateOrbit();
            updateGlow();
            updateColor();
            setStatus('Masa restaurada a la lectura inicial');
        };

        scaleInput.addEventListener('input', updateScale);
        orbitInput.addEventListener('input', updateOrbit);
        glowInput.addEventListener('input', updateGlow);
        colorInput.addEventListener('input', updateColor);
        resetButton?.addEventListener('click', resetAll);
        centerButton?.addEventListener('click', () => {
            this._positionWindow(win, true);
            setStatus('Panel centrado en el plano 2D');
        });

        updateScale();
        updateOrbit();
        updateGlow();
        updateColor();
        setStatus('Sintonia orbital activa');
    }

    /**
     * V31: O(1) mass context resolution via CelestialRegistry name index.
     *
     * Priority:
     *   1. CelestialRegistry.get(appId)  — O(1), name index lookup
     *   2. SpatialIndexSystem.query()    — O(log n) spatial index
     *   3. scene.traverse()             — O(n) fallback with early-exit
     *
     * Previously: always O(n) traverse over THE ENTIRE scene graph (100k+ objects).
     */
    _resolveMassContext(appId) {
        const engine = window.engine;
        const context = { mass: null, orbit: null, orbitEntry: null };
        if (!engine?.scene) return context;

        // ── Strategy 1: CelestialRegistry O(1) name lookup ─────────────────
        const registry = engine.registry?.get?.('CelestialRegistry')
            ?? engine.registry?.get?.('celestialRegistry')
            ?? null;
        if (registry) {
            const found = registry.get(appId);
            if (found && (
                found.userData?.isMass ||
                found.userData?.nodeType === 'planet' ||
                found.userData?.nodeType === 'star' ||
                found.userData?.isMetamorphMoon
            )) {
                context.mass = found;
            }
        }

        // ── Strategy 2: scene.getObjectByProperty — Three.js internal hash ──
        if (!context.mass) {
            // Three.js maintains an internal uuid map for getObjectById.
            // getObjectByProperty walks but short-circuits — still O(n) worst case
            // but avoids callback overhead and exits immediately on first match.
            const candidate = engine.scene.getObjectByProperty('userData.appId', appId);
            if (candidate && (
                candidate.userData?.isMass ||
                candidate.userData?.nodeType === 'planet' ||
                candidate.userData?.nodeType === 'star' ||
                candidate.userData?.isMetamorphMoon
            )) {
                context.mass = candidate;
            }
        }

        // ── Strategy 3: Fallback traverse with early-exit flag ───────────────
        if (!context.mass) {
            let found = false;
            engine.scene.traverse((object) => {
                if (found) return; // Three.js traverse doesn't support break — use flag
                if (
                    object.userData?.appId === appId &&
                    (
                        object.userData?.isMass ||
                        object.userData?.nodeType === 'planet' ||
                        object.userData?.nodeType === 'star' ||
                        object.userData?.isMetamorphMoon
                    )
                ) {
                    context.mass = object;
                    found = true;
                }
            });
        }

        if (!context.mass) return context;

        context.orbit      = context.mass.parent || null;
        context.orbitEntry = engine.physicsSystem?.orbitalNodes?.find(
            (entry) => entry.node === context.orbit
        ) || null;
        return context;
    }

    _readGlowStrength(material) {
        if (!material?.emissive || !material?.color) {
            return 0.08;
        }

        const maxColor = Math.max(material.color.r, material.color.g, material.color.b, 0.001);
        const maxEmissive = Math.max(material.emissive.r, material.emissive.g, material.emissive.b, 0);
        return Math.min(0.75, Math.max(0.02, maxEmissive / maxColor));
    }

    _positionWindow(win, animate = false) {
        const rect = win.getBoundingClientRect();
        const left = Math.max(14, (window.innerWidth - rect.width) * 0.5);
        const top = Math.max(14, (window.innerHeight - rect.height) * 0.5);

        if (animate) {
            win.style.transition = 'left 0.26s ease, top 0.26s ease, transform 0.26s ease';
        }

        win.style.left = `${Math.round(left)}px`;
        win.style.top = `${Math.round(top)}px`;
    }

    _onHudMode(event) {
        const detail = event?.detail || event || {};
        this.hudModeActive = !!detail.active;
        if (!this.hudModeActive) {
            this.layoutContextAppId = null;
        }
        this._scheduleHudLayout();
    }

    _onHudTargetContext(event) {
        const detail = event?.detail || event || {};
        this.layoutContextAppId = detail.hudMode ? (detail.appId || null) : null;
        this._scheduleHudLayout();
    }

    _scheduleHudLayout() {
        if (WindowDOMSystem._activeInstance !== this) {
            return;
        }
        if (this._layoutRaf) {
            cancelAnimationFrame(this._layoutRaf);
        }
        this._layoutRaf = requestAnimationFrame(() => {
            this._layoutRaf = null;
            this._applyHudWindowLayout();
        });
    }

    _applyHudWindowLayout() {
        if (!this.container) {
            return;
        }

        const windows = this._getVisibleWindowsForHudLayout();
        if (!this.hudModeActive || windows.length === 0) {
            this._restoreHudWindowLayout();
            return;
        }

        const maxVisibleWindows = 2;
        const reserveTop = this._readLayoutVar('--pg-tab-top-reserve', 96);
        const reserveBottom = this._readLayoutVar('--pg-tab-bottom-reserve', 168);
        const margin = 18;
        const gap = 14;
        const maxHeight = Math.max(260, window.innerHeight - reserveTop - reserveBottom);
        const leftLane = this._readLayoutVar('--pg-tab-left-lane', 280);
        const rightLane = this._readLayoutVar('--pg-tab-right-lane', 320);
        let leftCursor = this._readLayoutVar('--pg-tab-left-start', reserveTop);
        let rightCursor = this._readLayoutVar('--pg-tab-right-start', reserveTop);

        windows.forEach((win, index) => {
            const state = this.collapsibleWindows.get(win.id);
            if (!state) {
                return;
            }

            if (!state.hudDockRestore) {
                state.hudDockRestore = {
                    position: win.style.position || '',
                    left: win.style.left || '',
                    top: win.style.top || '',
                    width: win.style.width || '',
                    minWidth: win.style.minWidth || '',
                    maxHeight: win.style.maxHeight || '',
                    transform: win.style.transform || '',
                    display: win.style.display || '',
                    pointerEvents: win.style.pointerEvents || '',
                    zIndex: win.style.zIndex || ''
                };
            }

            if (index >= maxVisibleWindows) {
                win.classList.add('is-hud-stashed');
                win.classList.remove('is-hud-docked', 'is-hud-primary', 'is-hud-secondary');
                win.style.display = 'none';
                win.style.pointerEvents = 'none';
                return;
            }

            const isPrimary = this.layoutContextAppId
                ? win.dataset.appId === this.layoutContextAppId
                : index === 0;

            win.classList.remove('is-hud-stashed');
            win.classList.add('is-hud-docked');
            win.classList.toggle('is-hud-primary', isPrimary);
            win.classList.toggle('is-hud-secondary', !isPrimary);
            win.style.position = 'fixed';
            win.style.transform = 'none';
            win.style.maxHeight = `${maxHeight}px`;
            win.style.display = '';
            win.style.opacity = '1';
            win.style.pointerEvents = 'auto';

            const preferredColumns = isPrimary
                ? ['right', 'left']
                : (leftCursor <= rightCursor ? ['left', 'right'] : ['right', 'left']);
            const columnCandidates = preferredColumns.map((column) => {
                const laneWidth = column === 'left' ? leftLane : rightLane;
                const preferredWidth = Math.max(
                    180,
                    Math.min(window.innerWidth - margin * 2, laneWidth - margin - 10)
                );
                win.style.setProperty('--pg-hud-window-width', `${preferredWidth}px`);
                win.style.width = `${preferredWidth}px`;
                win.style.minWidth = `${preferredWidth}px`;

                const measuredRect = win.getBoundingClientRect();
                const measuredWidth = measuredRect.width || preferredWidth;
                const measuredHeight = measuredRect.height || maxHeight;
                const topCursor = column === 'left' ? leftCursor : rightCursor;
                const maxTop = Math.max(reserveTop, window.innerHeight - reserveBottom - measuredHeight);
                return {
                    column,
                    preferredWidth,
                    measuredWidth,
                    measuredHeight,
                    topCursor,
                    maxTop,
                    fits: topCursor <= maxTop
                };
            });
            const selectedColumn = columnCandidates.find((candidate) => candidate.fits)
                || columnCandidates.reduce((best, candidate) => (candidate.maxTop > best.maxTop ? candidate : best));
            let column = selectedColumn.column;
            let top = Math.min(selectedColumn.topCursor, selectedColumn.maxTop);
            const measuredWidth = selectedColumn.measuredWidth;
            const measuredHeight = selectedColumn.measuredHeight;

            win.style.setProperty('--pg-hud-window-width', `${selectedColumn.preferredWidth}px`);
            win.style.width = `${selectedColumn.preferredWidth}px`;
            win.style.minWidth = `${selectedColumn.preferredWidth}px`;

            const left = column === 'left'
                ? margin
                : Math.max(margin, window.innerWidth - measuredWidth - margin);

            win.style.left = `${Math.round(left)}px`;
            win.style.top = `${Math.round(top)}px`;
            win.style.zIndex = isPrimary ? '1420' : String(1360 - index);

            if (column === 'left') {
                leftCursor = top + measuredHeight + gap;
            } else {
                rightCursor = top + measuredHeight + gap;
            }
        });
    }

    _restoreHudWindowLayout() {
        this.collapsibleWindows.forEach((state, windowId) => {
            const win = document.getElementById(windowId);
            if (!win) {
                return;
            }

            if (state?.hudDockRestore) {
                win.style.position = state.hudDockRestore.position;
                win.style.left = state.hudDockRestore.left;
                win.style.top = state.hudDockRestore.top;
                win.style.width = state.hudDockRestore.width;
                win.style.minWidth = state.hudDockRestore.minWidth;
                win.style.maxHeight = state.hudDockRestore.maxHeight;
                win.style.transform = state.hudDockRestore.transform;
                win.style.display = state.hudDockRestore.display;
                win.style.pointerEvents = state.hudDockRestore.pointerEvents;
                win.style.zIndex = state.hudDockRestore.zIndex;
                delete state.hudDockRestore;
            }

            win.style.removeProperty('--pg-hud-window-width');
            win.classList.remove('is-hud-docked', 'is-hud-primary', 'is-hud-secondary', 'is-hud-stashed');
        });
    }

    _getVisibleWindowsForHudLayout() {
        return Array.from(this.container.querySelectorAll('.glass-window'))
            .filter((win) => {
                if (win.classList.contains('is-minimized') || win.classList.contains('is-collapsed')) {
                    return false;
                }
                const style = window.getComputedStyle(win);
                return style.display !== 'none';
            })
            .sort((a, b) => {
                const aAppId = a.dataset.appId || '';
                const bAppId = b.dataset.appId || '';
                const aScore = (aAppId === this.layoutContextAppId ? 10000 : 0) + (Number(a.style.zIndex) || 0);
                const bScore = (bAppId === this.layoutContextAppId ? 10000 : 0) + (Number(b.style.zIndex) || 0);
                return bScore - aScore;
            });
    }

    _readLayoutVar(name, fallback) {
        const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    _makeWindowDraggable(win, handle) {
        let dragState = null;

        const onPointerMove = (event) => {
            if (!dragState) {
                return;
            }

            const nextLeft = event.clientX - dragState.offsetX;
            const nextTop = event.clientY - dragState.offsetY;
            const clamped = this._clampWindowPosition(win, nextLeft, nextTop);

            win.style.left = `${clamped.left}px`;
            win.style.top = `${clamped.top}px`;
        };

        const onPointerUp = (event) => {
            if (!dragState) {
                return;
            }

            handle.releasePointerCapture?.(event.pointerId);
            win.classList.remove('is-dragging');
            dragState = null;
            this._getPointerPresentationController()?.clearIntent?.('window-drag');
            this._saveWindowLayoutState(win.id);
        };

        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) {
                return;
            }

            if (this.hudModeActive || win.classList.contains('is-hud-docked') || win.classList.contains('is-hud-stashed')) {
                return;
            }

            // Don't start drag when interacting with control dots
            if (event.target.closest('.os-window-dot')) {
                return;
            }

            const rect = win.getBoundingClientRect();
            dragState = {
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };

            this._promoteWindow(win);
            win.classList.add('is-dragging');
            handle.setPointerCapture?.(event.pointerId);
            this._getPointerPresentationController()?.upsertIntent?.('window-drag', {
                kind: 'drag',
                cursor: 'grabbing',
                priority: 500,
                reticleMode: 'hidden',
            });
            event.preventDefault();
        });

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        win.__disposeDrag = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            this._getPointerPresentationController()?.clearIntent?.('window-drag');
        };
    }

    setWindowCollapsed(windowId, shouldCollapse) {
        this._toggleWindowCollapse(windowId, shouldCollapse);
    }

    _findMassObjectByAppId(appId) {
        if (!this.scene) return null;

        let found = null;
        this.scene.traverse((obj) => {
            if (found) return;
            if (obj.userData?.appId === appId && obj.userData?.isMass) {
                found = obj;
            }
        });

        return found;
    }

    _findMetamorphSatelliteForMass(massObject) {
        if (!this.scene || !massObject || !massObject.userData?.appId) return null;
        let satellite = null;
        const parentId = massObject.userData.appId;

        this.scene.traverse((obj) => {
            if (satellite) return;
            if (obj.userData?.isMetamorphMoon && (obj.userData.parentAppId === parentId || obj.userData.appId === parentId)) {
                satellite = obj;
            }
        });

        // Fallback: primer metamorph visible cercano
        if (!satellite) {
            this.scene.traverse((obj) => {
                if (satellite) return;
                if (obj.userData?.isMetamorphMoon) satellite = obj;
            });
        }

        return satellite;
    }

    _ensureWindowShelf() {
        let shelf = this.container.querySelector('.window-shelf');
        if (!shelf) {
            shelf = document.createElement('div');
            shelf.className = 'window-shelf';
            this.container.appendChild(shelf);
        }
        return shelf;
    }

    _createMinimizedChip(windowId, state, win) {
        const chipId = `${windowId}-chip`;
        let chip = document.getElementById(chipId);
        if (!chip) {
            chip = document.createElement('button');
            chip.type = 'button';
            chip.id = chipId;
            chip.className = 'window-shelf-chip';
            chip.addEventListener('click', (event) => {
                event.stopPropagation();
                this._toggleWindowCollapse(windowId, false);
            });
            this.windowShelf.appendChild(chip);
        }

        const title = win.querySelector('.glass-header-title')?.textContent || state.appId || 'Modulo';
        const badge = win.querySelector('.glass-header-badge')?.textContent || 'Visor';
        chip.innerHTML = `<span class="window-shelf-dot"></span><span class="window-shelf-copy"><span class="window-shelf-label">${title}</span><span class="window-shelf-badge">${badge}</span></span>`;
        this.windowShelf.classList.toggle('has-items', this.windowShelf.children.length > 0);
    }

    _removeMinimizedChip(windowId) {
        const chip = document.getElementById(`${windowId}-chip`);
        chip?.remove();
        if (this.windowShelf) {
            this.windowShelf.classList.toggle('has-items', this.windowShelf.children.length > 0);
        }
    }

    _dispatchWindowState(appId, state, windowId) {
        const detail = { appId, state, windowId };
        const runtimeSignals = Registry.tryGet('RuntimeSignals');
        if (runtimeSignals?.emit) {
            runtimeSignals.emit('PG:WINDOW_STATE', detail);
            return;
        }
        window.dispatchEvent(new CustomEvent('PG:WINDOW_STATE', { detail }));
    }

    _spawnDroneForWindow(windowId) {
        return this.collapsibleWindows.get(windowId);
    }

    _createDockedBubble(windowId) {
        const bubbleId = `${windowId}-bubble`;
        let bubble = document.getElementById(bubbleId);
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = bubbleId;
            bubble.className = 'glass-bubble docked-os-bubble';
            bubble.innerHTML = `
                <span class="bubble-icon">•</span>
                <span class="bubble-text">ABRIR</span>
            `;
            bubble.style.pointerEvents = 'auto';
            bubble.style.position = 'fixed';
            bubble.style.left = '20px';
            bubble.style.zIndex = '99999';
            bubble.style.transformOrigin = 'left center';

            // Glow styles
            if (!document.getElementById('bubble-cyan-flash-style')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'bubble-cyan-flash-style';
                styleEl.textContent = `
                    @keyframes bubble-cyan-pulse {
                        0% { transform: scale(1); opacity: 1; text-shadow: 0 0 4px rgba(0,255,255,0.8); }
                        50% { transform: scale(1.35); opacity: 0.75; text-shadow: 0 0 12px rgba(0,255,255,0.95), 0 0 24px rgba(0,255,255,0.4); }
                        100% { transform: scale(1); opacity: 1; text-shadow: 0 0 4px rgba(0,255,255,0.8); }
                    }
                    .glass-bubble .bubble-icon { color: #00ffff; font-size: 18px; line-height: 1; animation: bubble-cyan-pulse 0.66s ease-in-out infinite; }
                    .glass-bubble .bubble-text { color: #bbffff; font-size: 12px; margin-left: 6px; letter-spacing: 0.7px; text-transform: uppercase; }
                    .docked-os-bubble {
                        display: flex; align-items: center; justify-content: flex-start;
                        background: rgba(5, 8, 15, 0.6); backdrop-filter: blur(8px);
                        border: 1px solid rgba(0, 255, 255, 0.2); border-radius: 20px;
                        padding: 8px 16px; cursor: pointer; transition: background 0.2s;
                    }
                    .docked-os-bubble:hover { background: rgba(0, 50, 80, 0.7); border-color: rgba(0, 255, 255, 0.5); }
                `;
                document.head.appendChild(styleEl);
            }

            bubble.addEventListener('click', (event) => {
                event.stopPropagation();
                this._toggleWindowCollapse(windowId, false);
            });
            document.body.appendChild(bubble); // Al body directo para asegurar Fija izquierda
        }

        const existingBubbles = document.querySelectorAll('.docked-os-bubble');
        const offset = (existingBubbles.length - 1) * 55;
        bubble.style.top = `calc(50% - 30px + ${offset}px)`;

        gsap.fromTo(bubble, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.5, ease: 'back.out(1.2)' });
    }

    _recalcBubblePositions() {
        const bubbles = document.querySelectorAll('.docked-os-bubble');
        bubbles.forEach((b, i) => {
            gsap.to(b, { top: `calc(50% - 30px + ${i * 55}px)`, duration: 0.3, ease: 'power2.out' });
        });
    }

    _createGlassSilicon3DLabel(text = 'ABRIR', size = { width: 1.2, height: 0.36 }) {
        const group = new THREE.Group();

        const radius = size.height / 2;
        const length = size.width - size.height;

        // 1. Cuerpo de la Burbuja (Volumen 3D principal con fallback geométrico)
        let bodyGeo, shadowGeo;
        try {
            if (THREE.CapsuleGeometry) {
                bodyGeo = new THREE.CapsuleGeometry(radius, length, 16, 32);
                shadowGeo = new THREE.CapsuleGeometry(radius * 0.85, length * 0.95, 12, 24);
            } else {
                throw new Error("CapsuleGeometry missing");
            }
        } catch (e) {
            console.warn('[WindowDOMSystem] CapsuleGeometry fallback triggered:', e?.message);
            bodyGeo = new THREE.SphereGeometry(radius * 1.5, 32, 16);
            bodyGeo.scale(1, 0.5, 1);
            shadowGeo = new THREE.SphereGeometry(radius * 1.5 * 0.85, 32, 16);
            shadowGeo.scale(1, 0.45, 0.95);
        }

        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            metalness: 0.1,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.5,
            ior: 1.45,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.rotation.z = Math.PI / 2; 
        group.add(body);

        // 2. Sombra Interna / Núcleo oscuro (Provee profundidad volumétrica)
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x001122,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.z = Math.PI / 2;
        shadow.position.z = -0.05; 
        group.add(shadow);

        // 3. Brillo Especular Estilo Mario (Highlight orgánico superior)
        const hlGeo = new THREE.SphereGeometry(radius * 0.35, 16, 16);
        const hlMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });
        const highlight = new THREE.Mesh(hlGeo, hlMat);
        highlight.scale.set(1.8, 0.6, 1);
        highlight.position.set(-length * 0.35, radius * 0.55, radius * 0.7);
        highlight.rotation.z = Math.PI / 8;
        group.add(highlight);

        // 4. Texto Flotante (Limpio, sin tarjeta ni rectángulos)
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 52px var(--font-ui, Inter, Arial)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 255, 255, 0.95)';
        ctx.shadowBlur = 14;
        ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const textGeo = new THREE.PlaneGeometry(size.width * 0.95, size.height * 0.95);
        const textMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const textMesh = new THREE.Mesh(textGeo, textMat);
        textMesh.position.z = radius + 0.02; // Flotando justo delante de la burbuja
        
        group.add(textMesh);
        group.renderOrder = 1001;

        return group;
    }

    _getMessengerLayer() {
        return null;
    }

    _spawnMessengerForWindow(windowId, massObject) {
        // Deprecated. Handled by the CSS Dock on the left UI.
    }

    _removeMessenger(windowId) {
        // Deprecated. Handled by the CSS Dock.
    }

    _ensureMessengerLoop() {
        // Deprecated.
    }

    _stopMessengerLoop() {
        // Deprecated.
    }

    _removeDrone(windowId) {
        const entry = this.droneObjects.get(windowId);
        if (!entry) return;

        // Eliminar Bubble visual Docked
        const bubbleId = `${windowId}-bubble`;
        const bubble = document.getElementById(bubbleId);
        if (bubble) {
            gsap.to(bubble, { opacity: 0, x: -30, duration: 0.25, onComplete: () => {
                if(bubble.parentElement) bubble.parentElement.removeChild(bubble);
                this._recalcBubblePositions();
            }});
        }

        // Limpiar restos legacy si existieran (Drones 3D viejos)
        if (entry.drone) {
            const label = entry.drone.userData?.labelMesh;
            if (label) {
                if (label.material) {
                    if (label.material.map) label.material.map.dispose();
                    label.material.dispose();
                }
                if (label.geometry) label.geometry.dispose();
            }
            this.scene.remove(entry.drone);
            if (entry.drone.geometry) entry.drone.geometry.dispose();
            if (entry.drone.material) entry.drone.material.dispose();
        }

        this.droneObjects.delete(windowId);

        if (this.droneObjects.size === 0) {
            this._stopDroneOrbitLoop();
        }
    }

    _ensureDroneOrbitLoop() {
        if (this._droneOrbitRaf) return;

        const animate = () => {
            this.droneObjects.forEach((entry) => {
                const { drone, massObject } = entry;
                if (!massObject) return;

                const center = this._droneOrbitCenter;
                massObject.getWorldPosition(center);
                const orbit = drone.userData.orbitSettings;

                orbit.angle += orbit.speed;
                const x = center.x + Math.cos(orbit.angle) * orbit.radius;
                const y = center.y + Math.sin(orbit.angle * 0.58) * (orbit.radius * 0.24) + 1.2;
                const z = center.z + Math.sin(orbit.angle) * orbit.radius;

                drone.position.set(x, y, z);
                drone.lookAt(center);

                // Etiqueta 3D glass-silicon face to camera
                const label = drone.userData?.labelMesh;
                if (label && this.camera) {
                    label.quaternion.copy(this.camera.quaternion);
                }
            });

            this._droneOrbitRaf = requestAnimationFrame(animate);
        };

        this._droneOrbitRaf = requestAnimationFrame(animate);
    }

    _stopDroneOrbitLoop() {
        if (!this._droneOrbitRaf) return;
        cancelAnimationFrame(this._droneOrbitRaf);
        this._droneOrbitRaf = null;
    }

    _worldToScreen(position) {
        if (!this.camera || !this.scene) return null;
        const vector = position.clone().project(this.camera);
        const x = (vector.x + 1) / 2 * window.innerWidth;
        const y = (-vector.y + 1) / 2 * window.innerHeight;
        return { x, y };
    }

    _createBubbleElement(windowId, massObject = null) {
        const bubbleId = `${windowId}-bubble`;
        let bubble = document.getElementById(bubbleId);
        if (!bubble) {
            bubble = document.createElement('div');
            bubble.id = bubbleId;
            bubble.className = 'glass-bubble';
            bubble.innerHTML = `
                <span class="bubble-icon">•</span>
                <span class="bubble-text">ABRIR</span>
            `;
            bubble.style.pointerEvents = 'auto';

            // Estilo de punto titilante cian
            if (!document.getElementById('bubble-cyan-flash-style')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'bubble-cyan-flash-style';
                styleEl.textContent = `
                    @keyframes bubble-cyan-pulse {
                        0% { transform: scale(1); opacity: 1; text-shadow: 0 0 4px rgba(0,255,255,0.8); }
                        50% { transform: scale(1.35); opacity: 0.75; text-shadow: 0 0 12px rgba(0,255,255,0.95), 0 0 24px rgba(0,255,255,0.4); }
                        100% { transform: scale(1); opacity: 1; text-shadow: 0 0 4px rgba(0,255,255,0.8); }
                    }
                    .glass-bubble .bubble-icon {
                        color: #00ffff;
                        font-size: 18px;
                        line-height: 1;
                        animation: bubble-cyan-pulse 0.66s ease-in-out infinite;
                    }
                    .glass-bubble .bubble-text {
                        color: #bbffff;
                        font-size: 12px;
                        margin-left: 6px;
                        letter-spacing: 0.7px;
                        text-transform: uppercase;
                    }
                `;
                document.head.appendChild(styleEl);
            }

            bubble.addEventListener('mouseenter', () => bubble.classList.add('hovered'));
            bubble.addEventListener('mouseleave', () => bubble.classList.remove('hovered'));
            bubble.addEventListener('click', (event) => {
                event.stopPropagation();
                this._toggleWindowCollapse(windowId, false);
            });
            this.container.appendChild(bubble);
        }

        const targetPos = massObject ? this._worldToScreen(massObject.getWorldPosition(new THREE.Vector3())) : null;
        if (targetPos) {
            gsap.set(bubble, {
                left: `${targetPos.x - 28}px`,
                top: `${targetPos.y - 28}px`,
                opacity: 0,
                scale: 0.7
            });
        } else {
            const win = document.getElementById(windowId);
            if (win) {
                const rect = win.getBoundingClientRect();
                gsap.set(bubble, {
                    left: `${rect.left + rect.width / 2 - 28}px`,
                    top: `${rect.top + rect.height / 2 - 28}px`,
                    opacity: 0,
                    scale: 0.7
                });
            }
        }

        gsap.to(bubble, {
            opacity: 1,
            scale: 1,
            duration: 0.45,
            ease: 'back.out(1.6)'
        });

        const floatTween = gsap.to(bubble, {
            x: `+=${(Math.random() - 0.5) * 24}px`,
            y: `+=${(Math.random() - 0.5) * 18}px`,
            duration: 2.2,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });

        this.bubbleAnimations.set(windowId, { bubble, floatTween });

        return bubble;
    }

    _destroyBubbleElement(windowId) {
        const record = this.bubbleAnimations.get(windowId);
        if (record) {
            record.floatTween.kill();
            this.bubbleAnimations.delete(windowId);
        }

        const bubble = document.getElementById(`${windowId}-bubble`);
        if (!bubble) return;

        gsap.to(bubble, {
            scale: 0.4,
            opacity: 0,
            duration: 0.24,
            ease: 'power2.in',
            onComplete: () => bubble.remove()
        });
    }

    _pulseMassSurface(massObject, intensity = 1) {
        if (!massObject?.material) return;

        const material = Array.isArray(massObject.material) ? massObject.material[0] : massObject.material;
        if (!material) return;

        const origin = {
            emissiveIntensity: material.emissiveIntensity || 0.2,
            metalness: material.metalness || 0.1,
            dom: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000)
        };

        this._surfacePulseTween?.kill?.();
        this._surfacePulseTween = gsap.to(material, {
            emissiveIntensity: Math.min(2.1, origin.emissiveIntensity + 0.7 * intensity),
            metalness: Math.min(1, origin.metalness + 0.5 * intensity),
            duration: 0.8,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut',
            onUpdate: () => {
                if (material.emissive) {
                    material.emissive.lerp(new THREE.Color(0x99cfff), 0.22 * intensity);
                }
            },
            onComplete: () => {
                material.emissiveIntensity = origin.emissiveIntensity;
                material.metalness = origin.metalness;
                if (material.emissive) {
                    material.emissive.copy(origin.dom);
                }
            }
        });
    }

    _clampWindowPosition(win, left, top) {
        const margin = 12;
        const rect = win.getBoundingClientRect();
        const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
        const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

        return {
            left: Math.min(maxLeft, Math.max(margin, left)),
            top: Math.min(maxTop, Math.max(margin, top))
        };
    }

    _promoteWindow(win) {
        this.zIndexSeed += 1;
        win.style.zIndex = String(this.zIndexSeed);
    }

    _closeWindow(win) {
        const state = this.collapsibleWindows.get(win.id);
        this._saveWindowLayoutState(win.id);
        if (state?.hudDockRestore) {
            delete state.hudDockRestore;
        }
        this._destroyBubbleElement(win.id);
        this._removeDrone(win.id);
        this._removeMessenger(win.id);
        this._removeMinimizedChip(win.id);
        if (this.spatialAnchorSystem) this.spatialAnchorSystem.releaseWindow(win.id);
        win.__disposeDrag?.();
        win.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        win.style.opacity = '0';
        win.style.transform = 'scale(0.9)';
        setTimeout(() => win.remove(), 220);
        if (state?.appId) this._dispatchWindowState(state.appId, 'closed', win.id);
        this.collapsibleWindows.delete(win.id);
        this._scheduleHudLayout();
    }

    _toggleWindowCollapse(windowId, toggle = undefined) {
        const win = document.getElementById(windowId);
        if (!win) return;
        const state = this.collapsibleWindows.get(windowId);
        if (!state) return;
        const isCollapsed = toggle !== undefined ? toggle : !state.isCollapsed;
        if (state.isCollapsed === isCollapsed) return;
        state.isCollapsed = isCollapsed;
        if (isCollapsed) {
            state.originalStyles = {
                width: win.style.width || '',
                height: win.style.height || '',
                minWidth: win.style.minWidth || '',
                minHeight: win.style.minHeight || '',
                maxHeight: win.style.maxHeight || '',
                borderRadius: win.style.borderRadius || '',
                padding: win.style.padding || '',
                overflow: win.style.overflow || '',
                position: win.style.position || '',
                top: win.style.top || '',
                left: win.style.left || '',
                zIndex: win.style.zIndex || '',
                transform: win.style.transform || '',
                opacity: win.style.opacity || '',
                display: win.style.display || '',
                pointerEvents: win.style.pointerEvents || ''
            };
            this._destroyBubbleElement(windowId);
            this._removeDrone(windowId);
            this._removeMessenger(windowId);
            if (this.spatialAnchorSystem) this.spatialAnchorSystem.releaseWindow(windowId);
            win.classList.add('is-minimized');
            win.style.pointerEvents = 'none';
            win.style.transition = 'opacity 0.22s ease, transform 0.24s ease';
            win.style.opacity = '0';
            win.style.transform = 'translate3d(0, 26px, 0) scale(0.9)';
            window.setTimeout(() => {
                if (state.isCollapsed) win.style.display = 'none';
            }, 220);
            this._createMinimizedChip(windowId, state, win);
            if (state.massObject) this._pulseMassSurface(state.massObject, 0.95);
            this._saveWindowLayoutState(windowId);
            this._dispatchWindowState(state.appId, 'minimized', windowId);
            this._scheduleHudLayout();
        } else {
            this._destroyBubbleElement(windowId);
            this._removeDrone(windowId);
            this._removeMessenger(windowId);
            this._removeMinimizedChip(windowId);
            if (state.massObject) this._pulseMassSurface(state.massObject, 0.6);
            win.classList.remove('is-minimized');
            if (state.originalStyles) {
                win.style.width = state.originalStyles.width;
                win.style.height = state.originalStyles.height;
                win.style.minWidth = state.originalStyles.minWidth;
                win.style.minHeight = state.originalStyles.minHeight;
                win.style.maxHeight = state.originalStyles.maxHeight;
                win.style.borderRadius = state.originalStyles.borderRadius;
                win.style.padding = state.originalStyles.padding;
                win.style.overflow = state.originalStyles.overflow;
                win.style.position = state.originalStyles.position;
                win.style.top = state.originalStyles.top;
                win.style.left = state.originalStyles.left;
                win.style.zIndex = state.originalStyles.zIndex;
                win.style.display = state.originalStyles.display;
                win.style.pointerEvents = state.originalStyles.pointerEvents;
            } else {
                win.style.width = '';
                win.style.height = '';
                win.style.minWidth = '';
                win.style.minHeight = '';
                win.style.maxHeight = 'none';
                win.style.overflow = 'visible';
                win.style.display = '';
                win.style.pointerEvents = '';
            }
            win.style.opacity = '0';
            win.style.transform = 'translate3d(0, 18px, 0) scale(0.94)';
            requestAnimationFrame(() => {
                win.style.transition = 'opacity 0.26s ease, transform 0.28s cubic-bezier(0.22,1,0.36,1)';
                win.style.opacity = state.originalStyles?.opacity || '1';
                win.style.transform = state.originalStyles?.transform || this._getRestingWindowTransform();
            });
            this._promoteWindow(win);
            this._saveWindowLayoutState(windowId);
            this._dispatchWindowState(state.appId, 'restored', windowId);
            this._scheduleHudLayout();
        }
        console.log(`[PlanetWindow] ${state.appId} ${isCollapsed ? 'Collapsed' : 'Expanded'}`);
    }

    showHologramNotification(event) {
        const drone = event.detail?.target;
        if (!drone) return;
        window.dispatchEvent(new CustomEvent('PG:HUD_TRANSMISSION', {
            detail: {
                drone,
                message: drone.userData?.message || 'Mensaje desde satelite'
            }
        }));
    }
    setWindowCollapsedOnPlanetHover(appIdOrWindowId, shouldCollapse = true) {
        const windowId = appIdOrWindowId.startsWith('os-window-')
            ? appIdOrWindowId
            : `os-window-${appIdOrWindowId}`;
        const state = this.collapsibleWindows.get(windowId);
        if (state && !shouldCollapse && shouldCollapse !== state.isCollapsed) {
            this._toggleWindowCollapse(windowId, shouldCollapse);
        }
    }

    // ── Descent HUD ───────────────────────────────────────────────────────────

    /**
     * Show a cinematic letterbox + altitude/speed HUD during orbital descent.
     * @param {string} planetName
     * @param {string} planetClass
     */
    showDescentHUD(planetName = 'Planet', planetClass = 'default') {
        if (document.getElementById('descent-hud')) return;

        // Inject HUD styles if not already present
        if (!document.getElementById('descent-hud-style')) {
            const style = document.createElement('style');
            style.id = 'descent-hud-style';
            style.textContent = `
                @keyframes descentBarSlide {
                    from { opacity: 0; transform: scaleY(0); }
                    to   { opacity: 1; transform: scaleY(1); }
                }
                #descent-hud {
                    position: fixed; inset: 0; pointer-events: none; z-index: 5000;
                    font-family: 'Courier New', monospace;
                }
                .descent-letterbox {
                    position: absolute; left: 0; right: 0; height: 64px;
                    background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);
                    transform-origin: top center;
                    animation: descentBarSlide 0.55s cubic-bezier(0.22,1.2,0.35,1) forwards;
                }
                .descent-letterbox-top { top: 0; transform-origin: top; }
                .descent-letterbox-bot { bottom: 0; transform-origin: bottom; }
                .descent-planet-name {
                    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
                    color: #fff; font-size: 16px; font-weight: bold; letter-spacing: 4px;
                    text-transform: uppercase; text-shadow: 0 0 14px rgba(0,255,204,0.6);
                }
                .descent-class-badge {
                    position: absolute; top: 38px; left: 50%; transform: translateX(-50%);
                    color: rgba(0,255,204,0.7); font-size: 10px; letter-spacing: 3px;
                    text-transform: uppercase;
                }
                .descent-altitude-row {
                    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
                    display: flex; align-items: center; gap: 14px;
                }
                .descent-alt-bar-wrap {
                    width: 200px; height: 4px; background: rgba(255,255,255,0.12);
                    border-radius: 2px; overflow: hidden;
                }
                .descent-alt-bar-fill {
                    height: 100%; width: 100%; background: linear-gradient(90deg, #00ffc8, #0088ff);
                    border-radius: 2px; transition: width 0.15s linear;
                }
                .descent-alt-label {
                    color: rgba(0,255,204,0.9); font-size: 11px; letter-spacing: 1px; min-width: 80px;
                }
                .descent-scanline {
                    position: absolute; inset: 64px 0;
                    background: repeating-linear-gradient(
                        to bottom, transparent 0px, transparent 3px, rgba(0,255,200,0.015) 3px, rgba(0,255,200,0.015) 4px
                    );
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }

        const hud = document.createElement('div');
        hud.id = 'descent-hud';
        hud.innerHTML = `
            <div class="descent-letterbox descent-letterbox-top">
                <div class="descent-planet-name">${planetName}</div>
                <div class="descent-class-badge">Clase: ${planetClass.replace('_', ' ')}</div>
            </div>
            <div class="descent-scanline"></div>
            <div class="descent-letterbox descent-letterbox-bot">
                <div class="descent-altitude-row">
                    <span class="descent-alt-label" id="descent-alt-text">ALT: ---</span>
                    <div class="descent-alt-bar-wrap">
                        <div class="descent-alt-bar-fill" id="descent-alt-fill" style="width:100%;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(hud);

        // Wire altitude updates from nav system events
        this._descentAltHandler = (e) => {
            const { altitude, planetRadius } = e.detail ?? {};
            const pct = Math.max(0, Math.min(100, (altitude / (planetRadius ?? 300)) * 100));
            const fill = document.getElementById('descent-alt-fill');
            const label = document.getElementById('descent-alt-text');
            if (fill) fill.style.width = `${pct.toFixed(1)}%`;
            if (label) label.textContent = `ALT: ${altitude?.toFixed(0) ?? '---'} u`;
        };
        window.addEventListener('DESCENT_ALTITUDE', this._descentAltHandler);

        console.log('[WindowDOMSystem] Descent HUD shown.');
    }

    /** Remove the descent HUD. */
    hideDescentHUD() {
        const hud = document.getElementById('descent-hud');
        if (hud) {
            hud.style.transition = 'opacity 0.55s ease';
            hud.style.opacity = '0';
            setTimeout(() => hud.remove(), 580);
        }
        if (this._descentAltHandler) {
            window.removeEventListener('DESCENT_ALTITUDE', this._descentAltHandler);
            this._descentAltHandler = null;
        }
        console.log('[WindowDOMSystem] Descent HUD hidden.');
    }

    // ── Cockpit HUD ───────────────────────────────────────────────────────────

    /** Show the cinematic cockpit overlay (SPD / ALT / HDG / ROLL / PITCH). */
    showCockpitHUD() {
        if (document.getElementById('cockpit-hud')) return;

        if (!document.getElementById('cockpit-hud-style')) {
            const style = document.createElement('style');
            style.id = 'cockpit-hud-style';
            style.textContent = `
                @keyframes cockpitFadeIn {
                    from { opacity:0; transform:scale(0.97); }
                    to   { opacity:1; transform:scale(1); }
                }
                #cockpit-hud {
                    position:fixed; inset:0; pointer-events:none; z-index:5500;
                    font-family:'Courier New',monospace;
                    animation: cockpitFadeIn 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
                }
                .cockpit-corner {
                    position:absolute; width:40px; height:40px;
                    border-color:rgba(0,255,200,0.55); border-style:solid; border-width:0;
                }
                .cockpit-corner-tl{top:20px;left:20px;border-top-width:2px;border-left-width:2px;}
                .cockpit-corner-tr{top:20px;right:20px;border-top-width:2px;border-right-width:2px;}
                .cockpit-corner-bl{bottom:20px;left:20px;border-bottom-width:2px;border-left-width:2px;}
                .cockpit-corner-br{bottom:20px;right:20px;border-bottom-width:2px;border-right-width:2px;}
                .cockpit-scanlines {
                    position:absolute; inset:0;
                    background:repeating-linear-gradient(to bottom,transparent 0px,transparent 3px,rgba(0,255,200,0.012) 3px,rgba(0,255,200,0.012) 4px);
                }
                .cockpit-crosshair {
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    width:18px; height:18px;
                }
                .cockpit-crosshair::before,.cockpit-crosshair::after {
                    content:''; position:absolute; background:rgba(0,255,200,0.55);
                }
                .cockpit-crosshair::before{width:2px;height:100%;left:50%;transform:translateX(-50%);}
                .cockpit-crosshair::after{height:2px;width:100%;top:50%;transform:translateY(-50%);}
                .cockpit-mode-badge {
                    position:absolute; top:24px; right:70px;
                    color:rgba(0,255,200,0.55); font-size:10px; letter-spacing:3px; text-transform:uppercase;
                }
                .cockpit-esc-hint {
                    position:absolute; top:24px; left:70px;
                    color:rgba(255,255,255,0.25); font-size:10px; letter-spacing:2px;
                }
                .cockpit-telemetry {
                    position:absolute; bottom:28px; left:50%; transform:translateX(-50%);
                    display:flex; gap:36px; align-items:flex-end;
                    background:rgba(0,5,12,0.55); backdrop-filter:blur(6px);
                    border:1px solid rgba(0,255,200,0.18); border-radius:6px;
                    padding:10px 28px;
                }
                .cockpit-channel{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px;}
                .cockpit-channel-label{color:rgba(0,255,200,0.5);font-size:9px;letter-spacing:2px;text-transform:uppercase;}
                .cockpit-channel-value {
                    color:#00ffc8; font-size:18px; font-weight:bold; letter-spacing:1px;
                    text-shadow:0 0 8px rgba(0,255,200,0.7); transition:color 0.1s;
                }
                .cockpit-channel-value.warn{color:#ffaa00;text-shadow:0 0 8px rgba(255,170,0,0.7);}
            `;
            document.head.appendChild(style);
        }

        const hud = document.createElement('div');
        hud.id = 'cockpit-hud';
        hud.innerHTML = `
            <div class="cockpit-corner cockpit-corner-tl"></div>
            <div class="cockpit-corner cockpit-corner-tr"></div>
            <div class="cockpit-corner cockpit-corner-bl"></div>
            <div class="cockpit-corner cockpit-corner-br"></div>
            <div class="cockpit-scanlines"></div>
            <div class="cockpit-crosshair"></div>
            <div class="cockpit-mode-badge">COCKPIT MODE</div>
            <div class="cockpit-esc-hint">[C] EXIT</div>
            <div class="cockpit-telemetry">
                <div class="cockpit-channel"><span class="cockpit-channel-label">SPD</span><span class="cockpit-channel-value" id="cht-spd">0</span></div>
                <div class="cockpit-channel"><span class="cockpit-channel-label">ALT</span><span class="cockpit-channel-value" id="cht-alt">---</span></div>
                <div class="cockpit-channel"><span class="cockpit-channel-label">HDG</span><span class="cockpit-channel-value" id="cht-hdg">000°</span></div>
                <div class="cockpit-channel"><span class="cockpit-channel-label">ROLL</span><span class="cockpit-channel-value" id="cht-roll">0°</span></div>
                <div class="cockpit-channel"><span class="cockpit-channel-label">PITCH</span><span class="cockpit-channel-value" id="cht-pitch">0°</span></div>
            </div>
        `;
        document.body.appendChild(hud);
        console.log('[WindowDOMSystem] Cockpit HUD shown.');
    }

    /**
     * Update live cockpit telemetry — called every frame while in COCKPIT mode.
     * @param {{ speed, heading, pitch, roll, altitude? }} t
     */
    updateCockpitHUD(t = {}) {
        const el = (id) => document.getElementById(id);
        const spd = el('cht-spd'); const alt = el('cht-alt');
        const hdg = el('cht-hdg'); const roll = el('cht-roll'); const ptch = el('cht-pitch');
        if (spd)  { const v = Math.round(t.speed ?? 0); spd.textContent = v; spd.classList.toggle('warn', v > 450); }
        if (alt)  alt.textContent  = t.altitude != null ? `${Math.round(t.altitude)} u` : '---';
        if (hdg)  hdg.textContent  = `${Math.round(t.heading  ?? 0).toString().padStart(3, '0')}°`;
        if (roll) roll.textContent = `${Math.round(t.roll     ?? 0)}°`;
        if (ptch) ptch.textContent = `${Math.round(t.pitch    ?? 0)}°`;
    }

    /** Fade out and remove the cockpit HUD. */
    hideCockpitHUD() {
        const hud = document.getElementById('cockpit-hud');
        if (!hud) return;
        hud.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        hud.style.opacity = '0';
        hud.style.transform = 'scale(1.03)';
        setTimeout(() => hud.remove(), 420);
        console.log('[WindowDOMSystem] Cockpit HUD hidden.');
    }
}

