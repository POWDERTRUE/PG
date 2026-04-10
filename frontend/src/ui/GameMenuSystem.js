import { gsap } from 'gsap';
import { Registry } from '../engine/core/ServiceRegistry.js';
import {
    CONTROL_CATEGORY,
    CONTROL_SECTION_ORDER,
    formatControlKeys,
    formatControlModes,
    getControlsByCategory,
} from '../engine/input/ControlsManifest.js';

const STORAGE_KEY = 'pg.pause.settings.v2';

const DEFAULT_SETTINGS = {
    gameplay: {
        fieldOfView: 42,
        lookSensitivity: 1,
        invertY: false,
        targetFps: 60,
    },
    audio: {
        master: 100,
        ambience: 82,
        interface: 74,
        transmission: 86,
    },
    interface: {
        hudOpacity: 1,
        glassOpacity: 0.45,
        reticleGlow: 1,
        compactDock: false,
        reduceMotion: false,
        showNotifications: true,
    },
};

export class GameMenuSystem {
    constructor(kernel) {
        this.kernel = kernel;
        this.runtimeState = kernel?.runtimeState || Registry.tryGet('RuntimeState');
        this.runtimeSignals = kernel?.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.isOpen = false;
        this.menuUI = null;
        this.activeSection = 'gameplay';
        this.previousPointerLock = false;
        this.previousHudMode = false;
        this.pointerPresentation = Registry.tryGet('PointerPresentationController') || Registry.tryGet('pointerPresentation');
        this.settings = this._loadSettings();
        this._onKeyDown = this._onKeyDown.bind(this);
        this._toggleMenu = () => this.toggle();

        this.runtimeState?.setSettings(this.settings, { source: 'game-menu:constructor' });
        this._applySettings();

        this._removeToggleRequestListener =
            this.runtimeSignals?.on?.('PG:UI:REQUEST_GAME_MENU_TOGGLE', this._toggleMenu) || null;
        this._removeLegacyToggleListener =
            this.runtimeSignals?.on?.('PG:TOGGLE_GAME_MENU', this._toggleMenu) || null;
        if (!this._removeToggleRequestListener && !this._removeLegacyToggleListener) {
            window.addEventListener('PG:UI:REQUEST_GAME_MENU_TOGGLE', this._toggleMenu);
            window.addEventListener('PG:TOGGLE_GAME_MENU', this._toggleMenu);
        }
    }

    _buildMenu() {
        if (this.menuUI) return;

        this.menuUI = document.createElement('div');
        this.menuUI.id = 'pg-game-menu';
        this.menuUI.className = 'pg-pause-menu';
        this.menuUI.hidden = true;
        this.menuUI.setAttribute('role', 'dialog');
        this.menuUI.setAttribute('aria-modal', 'true');
        this.menuUI.setAttribute('aria-labelledby', 'pg-pause-title');
        this.menuUI.setAttribute('aria-hidden', 'true');
        this.menuUI.innerHTML = `
            <div class="pg-pause-backdrop"></div>
            <div class="pg-pause-shell">
                <aside class="pg-pause-nav">
                    <div class="pg-pause-kicker">Pausa tactica</div>
                    <h1 class="pg-pause-title" id="pg-pause-title">Omega Vista</h1>
                    <p class="pg-pause-copy">La pausa ahora responde como un juego AAA: detiene la accion, devuelve el cursor y concentra todas las opciones del simulador y del sistema operativo del universo.</p>

                    <div class="pg-pause-tabs">
                        <button type="button" class="pg-pause-tab is-active" data-section="gameplay">Juego</button>
                        <button type="button" class="pg-pause-tab" data-section="audio">Audio</button>
                        <button type="button" class="pg-pause-tab" data-section="interface">Interfaz OS</button>
                        <button type="button" class="pg-pause-tab" data-section="controls">Controles</button>
                        <button type="button" class="pg-pause-tab" data-section="system">Sistema</button>
                    </div>

                    <div class="pg-pause-runtime">
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Camara</span>
                            <span class="pg-runtime-value" data-runtime="camera-state">---</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Puntero</span>
                            <span class="pg-runtime-value" data-runtime="pointer-state">---</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Objetivo</span>
                            <span class="pg-runtime-value" data-runtime="focus-target">Sin objetivo</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Paneles</span>
                            <span class="pg-runtime-value" data-runtime="window-count">0</span>
                        </div>
                    </div>

                    <div class="pg-pause-actions">
                        <button type="button" class="pg-pause-action pg-pause-action-primary" data-action="resume">Reanudar</button>
                        <button type="button" class="pg-pause-action" data-action="preset-cinematic">Preset cinematico</button>
                        <button type="button" class="pg-pause-action" data-action="preset-precision">Preset preciso</button>
                        <button type="button" class="pg-pause-action pg-pause-action-danger" data-action="reload">Salir al selector</button>
                    </div>
                </aside>

                <section class="pg-pause-main">
                    <div class="pg-pause-panel is-active" data-panel="gameplay">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Juego</div>
                                <h2 class="pg-panel-title">Camara, vuelo y ritmo</h2>
                            </div>
                            <p class="pg-panel-copy">Ajustes vivos para la sensacion del visor, el encuadre y la suavidad general del universo.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Campo de vision</span>
                                <span class="pg-control-value" data-value-for="gameplay.fieldOfView" data-format="fov"></span>
                                <input type="range" min="36" max="78" step="1" data-setting="gameplay.fieldOfView">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Sensibilidad del mouse</span>
                                <span class="pg-control-value" data-value-for="gameplay.lookSensitivity" data-format="multiplier"></span>
                                <input type="range" min="0.65" max="1.65" step="0.01" data-setting="gameplay.lookSensitivity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Objetivo de FPS</span>
                                <span class="pg-control-value" data-value-for="gameplay.targetFps" data-format="fps"></span>
                                <select data-setting="gameplay.targetFps">
                                    <option value="30">30</option>
                                    <option value="45">45</option>
                                    <option value="60">60</option>
                                    <option value="90">90</option>
                                    <option value="120">120</option>
                                </select>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="gameplay.invertY">
                                <span>Invertir eje vertical</span>
                                <small>Aplica a vuelo libre y cockpit.</small>
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="audio">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Audio</div>
                                <h2 class="pg-panel-title">Mezcla general del simulador</h2>
                            </div>
                            <p class="pg-panel-copy">Preparado para ambience, interfaz y transmisiones tacticas sin salir de la pausa.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Master</span>
                                <span class="pg-control-value" data-value-for="audio.master" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.master">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Ambiente</span>
                                <span class="pg-control-value" data-value-for="audio.ambience" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.ambience">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Interfaz</span>
                                <span class="pg-control-value" data-value-for="audio.interface" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.interface">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Transmisiones</span>
                                <span class="pg-control-value" data-value-for="audio.transmission" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.transmission">
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="interface">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Interfaz OS</div>
                                <h2 class="pg-panel-title">HUD, dock y capas del sistema</h2>
                            </div>
                            <p class="pg-panel-copy">Opciones de lectura visual inspiradas en una vista en primera persona, amplia y con horizonte limpio.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Opacidad HUD</span>
                                <span class="pg-control-value" data-value-for="interface.hudOpacity" data-format="opacity"></span>
                                <input type="range" min="0.55" max="1" step="0.01" data-setting="interface.hudOpacity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Profundidad glass</span>
                                <span class="pg-control-value" data-value-for="interface.glassOpacity" data-format="opacity"></span>
                                <input type="range" min="0.30" max="0.68" step="0.01" data-setting="interface.glassOpacity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Brillo de reticula</span>
                                <span class="pg-control-value" data-value-for="interface.reticleGlow" data-format="multiplier"></span>
                                <input type="range" min="0.70" max="1.40" step="0.01" data-setting="interface.reticleGlow">
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.compactDock">
                                <span>Dock compacto</span>
                                <small>Reduce ancho y peso visual del flight deck.</small>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.reduceMotion">
                                <span>Reducir movimiento</span>
                                <small>Suaviza animaciones y baja transiciones decorativas.</small>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.showNotifications">
                                <span>Mostrar transmisiones emergentes</span>
                                <small>Controla avisos tacticos del casco y del sistema.</small>
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="controls">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Controles</div>
                                <h2 class="pg-panel-title">Mapa actual del teclado y raton</h2>
                            </div>
                            <p class="pg-panel-copy">El visor contextual pasa a TAB por alternancia. ESC queda reservado para pausa y regreso de menus.</p>
                        </div>

                        <div class="pg-controls-list" data-controls-manifest></div>
                    </div>

                    <div class="pg-pause-panel" data-panel="system">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Sistema</div>
                                <h2 class="pg-panel-title">Estado en vivo del kernel</h2>
                            </div>
                            <p class="pg-panel-copy">Lectura rapida del perfil de ejecucion actual y accesos directos para dejar el sistema listo.</p>
                        </div>

                        <div class="pg-system-grid">
                            <div class="pg-system-card">
                                <span class="pg-system-key">Perfil GPU</span>
                                <strong class="pg-system-value" data-runtime="gpu-profile">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">FPS target</span>
                                <strong class="pg-system-value" data-runtime="fps-target">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">HUD</span>
                                <strong class="pg-system-value" data-runtime="hud-state">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">Ventanas</span>
                                <strong class="pg-system-value" data-runtime="window-count-wide">---</strong>
                            </div>
                        </div>

                        <div class="pg-system-actions">
                            <button type="button" class="pg-pause-action" data-action="reset-settings">Restaurar ajustes</button>
                            <button type="button" class="pg-pause-action" data-action="resume">Volver al universo</button>
                        </div>
                    </div>
                </section>
            </div>

            <div class="pg-pause-rail">
                <div class="pg-pause-rail-copy">
                    <span class="pg-pause-rail-kicker">Borde de observacion</span>
                    <span class="pg-pause-rail-text">La pausa respeta la vista amplia: el mundo queda inmovil y el overlay trabaja como una baranda tactica, sin pelear con la escena.</span>
                </div>
                <div class="pg-pause-rail-hints">
                    <span>ESC cierra la pausa</span>
                    <span>TAB alterna el visor libre</span>
                    <span>M abre el mapa</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.menuUI);

        this.menuUI.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-section]');
            if (tab) {
                this._setSection(tab.dataset.section);
                return;
            }

            const action = event.target.closest('[data-action]');
            if (!action) return;

            switch (action.dataset.action) {
                case 'resume':
                    this.close();
                    break;
                case 'reload':
                    window.location.reload();
                    break;
                case 'reset-settings':
                    this.settings = this._cloneDefaults();
                    this._saveSettings();
                    this._applySettings();
                    this._syncForm();
                    break;
                case 'preset-cinematic':
                    this._applyPreset({
                        gameplay: { fieldOfView: 46, lookSensitivity: 0.92, invertY: false, targetFps: 60 },
                        interface: { hudOpacity: 0.94, glassOpacity: 0.52, reticleGlow: 1.16, compactDock: false, reduceMotion: false, showNotifications: true }
                    });
                    break;
                case 'preset-precision':
                    this._applyPreset({
                        gameplay: { fieldOfView: 40, lookSensitivity: 1.08, invertY: false, targetFps: 90 },
                        interface: { hudOpacity: 0.84, glassOpacity: 0.40, reticleGlow: 0.94, compactDock: true, reduceMotion: false, showNotifications: true }
                    });
                    break;
                default:
                    break;
            }
        });

        const onControlChange = (event) => {
            const control = event.target.closest('[data-setting]');
            if (!control) return;
            const path = control.dataset.setting;
            const value = control.type === 'checkbox' ? control.checked : Number(control.value);
            this._setValue(path, value);
            this._saveSettings();
            this._applySettings();
            this._syncForm();
        };

        this.menuUI.addEventListener('input', onControlChange);
        this.menuUI.addEventListener('change', onControlChange);
        this._renderControlsPanel();
        this._syncForm();
    }

    _cloneDefaults() {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return this._cloneDefaults();
            const parsed = JSON.parse(raw);
            return {
                gameplay: { ...DEFAULT_SETTINGS.gameplay, ...(parsed.gameplay || {}) },
                audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
                interface: { ...DEFAULT_SETTINGS.interface, ...(parsed.interface || {}) },
            };
        } catch (_) {
            return this._cloneDefaults();
        }
    }

    _saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    }

    _setValue(path, value) {
        const [group, key] = path.split('.');
        if (!group || !key || !this.settings[group]) return;
        this.settings[group][key] = value;
    }

    _getValue(path) {
        const [group, key] = path.split('.');
        return this.settings?.[group]?.[key];
    }

    _applyPreset(preset) {
        this.settings = {
            gameplay: { ...this.settings.gameplay, ...(preset.gameplay || {}) },
            audio: { ...this.settings.audio, ...(preset.audio || {}) },
            interface: { ...this.settings.interface, ...(preset.interface || {}) },
        };
        this._saveSettings();
        this._applySettings();
        this._syncForm();
    }

    _applySettings() {
        this.runtimeState?.setSettings(this.settings, { source: 'game-menu:apply-settings' });

        const root = document.documentElement;
        const interfaceSettings = this.settings.interface;
        root.style.setProperty('--pg-hud-opacity', `${interfaceSettings.hudOpacity}`);
        root.style.setProperty('--silicon-blue', `rgba(0, 40, 80, ${interfaceSettings.glassOpacity})`);
        root.style.setProperty('--pg-reticle-glow', `${interfaceSettings.reticleGlow}`);

        document.body.classList.toggle('pg-compact-dock', !!interfaceSettings.compactDock);
        document.body.classList.toggle('pg-reduced-motion', !!interfaceSettings.reduceMotion);
        document.body.classList.toggle('pg-notifications-muted', !interfaceSettings.showNotifications);

        const gameplay = this.settings.gameplay;
        this.kernel?.renderPipeline?.setTargetFPS?.(Number(gameplay.targetFps) || 60);

        const nav = this.kernel?.navigationSystem;
        if (nav) {
            nav.defaultFov = Number(gameplay.fieldOfView) || 42;
            nav.targetFov = nav.defaultFov;
            nav.lookSensitivity = 0.0018 * (Number(gameplay.lookSensitivity) || 1);

            const freeFlight = nav.fsm?.states?.get?.('FREE_FLIGHT');
            if (freeFlight) {
                freeFlight._baseFov = nav.defaultFov;
            }

            if (nav.state !== 'WARP' && nav.state !== 'WARPING' && nav.state !== 'ORBITAL_DESCENT') {
                nav._setFov?.(nav.defaultFov, document.body.classList.contains('pg-reduced-motion') ? 0.01 : 0.28, 'power2.out');
            }
        }

        const master = (Number(this.settings.audio.master) || 0) / 100;
        document.querySelectorAll('audio, video').forEach((node) => {
            const channel = node.dataset.audioChannel || 'ambience';
            const channelValue = (Number(this.settings.audio[channel]) || 100) / 100;
            node.volume = Math.max(0, Math.min(1, master * channelValue));
        });
    }

    _syncForm() {
        if (!this.menuUI) return;

        this.menuUI.querySelectorAll('[data-setting]').forEach((control) => {
            const value = this._getValue(control.dataset.setting);
            if (control.type === 'checkbox') control.checked = !!value;
            else control.value = `${value}`;
        });

        this.menuUI.querySelectorAll('[data-value-for]').forEach((node) => {
            const path = node.dataset.valueFor;
            const value = this._getValue(path);
            node.textContent = this._formatValue(value, node.dataset.format || 'raw');
        });

        this._refreshRuntimeCards();
    }

    _renderControlsPanel() {
        if (!this.menuUI) return;

        const container = this.menuUI.querySelector('[data-controls-manifest]');
        if (!container) return;

        const sectionLabels = {
            [CONTROL_CATEGORY.SYSTEM]: 'Sistema y navegacion global',
            [CONTROL_CATEGORY.FLIGHT]: 'Vuelo libre',
            [CONTROL_CATEGORY.COCKPIT]: 'Modo cockpit',
            [CONTROL_CATEGORY.INTERACTION]: 'Interaccion y contexto',
        };

        const sectionsHtml = CONTROL_SECTION_ORDER
            .filter((category) => category !== CONTROL_CATEGORY.DEBUG)
            .map((category) => {
                const controls = getControlsByCategory(category);
                if (!controls.length) return '';

                const rows = controls
                    .map((control) => `
                        <div class="pg-controls-row">
                            <span>${control.label} <small>[${formatControlModes(control)}]</small></span>
                            <strong>${formatControlKeys(control)}</strong>
                        </div>
                        <div class="pg-controls-row pg-controls-row-copy">
                            <span>${control.description}</span>
                            <strong>${Array.isArray(control.source) ? control.source.join(', ') : control.source}</strong>
                        </div>
                    `)
                    .join('');

                return `
                    <div class="pg-controls-group">
                        <div class="pg-controls-group-title">${sectionLabels[category] || category}</div>
                        ${rows}
                    </div>
                `;
            })
            .join('');

        container.innerHTML = sectionsHtml;
    }

    _formatValue(value, format) {
        switch (format) {
            case 'fov':
                return `${Math.round(value)} deg`;
            case 'fps':
                return `${Math.round(value)} FPS`;
            case 'percent':
                return `${Math.round(value)}%`;
            case 'opacity':
                return `${Math.round(Number(value) * 100)}%`;
            case 'multiplier':
                return `${Number(value).toFixed(2)}x`;
            default:
                return `${value}`;
        }
    }

    _refreshRuntimeCards() {
        if (!this.menuUI) return;

        const nav = this.kernel?.navigationSystem;
        const hud = this.kernel?.inputStateSystem;
        const openWindows = this.kernel?.hudManager?.windowTelemetry?.open?.size ?? 0;
        const minimized = this.kernel?.hudManager?.windowTelemetry?.minimized?.size ?? 0;
        const liveWindows = Math.max(0, openWindows - minimized);
        const focusTarget =
            nav?.focusTarget?.userData?.label ||
            nav?.focusTarget?.userData?.appName ||
            nav?.focusTarget?.name ||
            this.kernel?.interactionSystem?.getActiveTarget?.()?.name ||
            'Sin objetivo';
        const pointerSnapshot = this._getPointerPresentationController()?.getSnapshot?.() ?? null;
        const pointerStateLabel = pointerSnapshot?.state === 'flight-locked'
            ? 'LOCK'
            : pointerSnapshot?.state === 'flight-pending-lock'
                ? 'PEND'
                : pointerSnapshot?.state === 'text-visible'
                    ? 'TEXTO'
                    : pointerSnapshot?.state === 'drag-visible'
                        ? 'DRAG'
                        : 'CURSOR';

        const runtime = {
            'camera-state': nav?.getPresentationMode?.() || nav?.state || 'OFFLINE',
            'pointer-state': pointerStateLabel,
            'focus-target': focusTarget,
            'window-count': `${liveWindows}/${openWindows}`,
            'gpu-profile': this.kernel?.engineProfile || 'standard',
            'fps-target': `${this.kernel?.renderPipeline?.targetFPS || this.settings.gameplay.targetFps} FPS`,
            'hud-state': hud?.hudMode ? 'TAB activo' : 'Visor cerrado',
            'window-count-wide': `${liveWindows} visibles / ${openWindows} totales`,
        };

        Object.entries(runtime).forEach(([key, value]) => {
            const node = this.menuUI.querySelector(`[data-runtime="${key}"]`);
            if (node) node.textContent = value;
        });
    }

    _setSection(section) {
        this.activeSection = section;
        this.menuUI?.querySelectorAll('[data-section]').forEach((node) => {
            node.classList.toggle('is-active', node.dataset.section === section);
        });
        this.menuUI?.querySelectorAll('[data-panel]').forEach((node) => {
            node.classList.toggle('is-active', node.dataset.panel === section);
        });
    }

    _onKeyDown(event) {
        if (!this.isOpen || event.code !== 'Escape') return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (!event.repeat) {
            this.close();
        }
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open(section = 'gameplay') {
        this._buildMenu();
        this._setSection(section);
        this._syncForm();

        this.previousPointerLock = !!document.pointerLockElement;
        this.previousHudMode = !!this.kernel?.inputStateSystem?.hudMode;
        this.kernel.isPaused = true;
        this.isOpen = true;
        this.runtimeState?.setGamePaused(true, { source: 'game-menu:open' });
        document.body.classList.add('pg-game-paused');
        this.runtimeSignals?.emit?.('PG:GAME_PAUSE_STATE', { active: true, source: 'game-menu' });
        this._upsertPointerIntent('game-menu', {
            kind: 'ui',
            cursor: 'default',
            priority: 340,
            reticleMode: 'hidden',
        });

        this._getPointerPresentationController()?.releasePointerLock?.({
            reason: 'game-menu-open',
        });

        // Ensure cursor is visible inside the settings menu — fix for the hidden cursor bug
        this.menuUI.hidden = false;
        this.menuUI.setAttribute('aria-hidden', 'false');
        this.menuUI.style.pointerEvents = 'auto';
        window.addEventListener('keydown', this._onKeyDown, true);

        gsap.killTweensOf(this.menuUI);
        gsap.set(this.menuUI, { opacity: 1 });
        gsap.fromTo(
            this.menuUI.querySelector('.pg-pause-shell'),
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.34, ease: 'power3.out' }
        );
        gsap.fromTo(
            this.menuUI.querySelector('.pg-pause-rail'),
            { y: 26, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.38, ease: 'power2.out', delay: 0.06 }
        );
    }

    close() {
        if (!this.isOpen) return;

        const shouldRelock =
            this.previousPointerLock &&
            !this.previousHudMode &&
            !(this.runtimeState?.isLoginActive?.() ?? !!window.__loginActive) &&
            this.kernel?.navigationSystem?.state !== 'MOUSE_UI';

        this.kernel.isPaused = false;
        this.isOpen = false;
        this.runtimeState?.setGamePaused(false, { source: 'game-menu:close' });
        document.body.classList.remove('pg-game-paused');
        this.runtimeSignals?.emit?.('PG:GAME_PAUSE_STATE', { active: false, source: 'game-menu' });
        this._clearPointerIntent('game-menu');
        this.menuUI.style.pointerEvents = 'none';
        window.removeEventListener('keydown', this._onKeyDown, true);

        if (shouldRelock) {
            this.kernel?.navigationSystem?.requestPointerLock?.();
        }

        gsap.killTweensOf(this.menuUI);
        gsap.to(this.menuUI, {
            opacity: 0,
            duration: 0.2,
            ease: 'power2.inOut',
            onComplete: () => {
                this.menuUI.hidden = true;
                this.menuUI.setAttribute('aria-hidden', 'true');
                this.menuUI.style.opacity = '1';
            }
        });
    }

    _getPointerPresentationController() {
        this.pointerPresentation =
            this.pointerPresentation ||
            Registry.tryGet('PointerPresentationController') ||
            Registry.tryGet('pointerPresentation');
        return this.pointerPresentation;
    }

    _upsertPointerIntent(source, intent) {
        return this._getPointerPresentationController()?.upsertIntent?.(source, intent) ?? null;
    }

    _clearPointerIntent(source) {
        return this._getPointerPresentationController()?.clearIntent?.(source) ?? null;
    }
}
