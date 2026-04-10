import * as THREE from 'three';
import { Registry } from '../engine/core/ServiceRegistry.js';
import { ASTRONOMY_BODY_PROFILES } from '../engine/config/UniverseSpec.js';

const LOCALE = 'es-CO';
const EARTH_ESCAPE_VELOCITY_KMS = 11.186;
const EARTH_SURFACE_GRAVITY = 9.80665;
const EARTH_DENSITY = 5.51;
const SOLAR_TO_EARTH_MASS = 333000;

export class HUDManager {
    constructor(layerId) {
        this.container = document.getElementById(layerId);
        this.nodes = {};
        this.isInitialized = false;
        this.telemetry = { frame: 0, drawCalls: 0, systemCount: 0, stars: 0, activeSectors: 0, totalBodies: 0, kernelState: 'BOOT', hudMode: false, pointerLocked: false };
        this.hudModeActive = false;
        this.windowTelemetry = { open: new Set(), minimized: new Set() };
        this.transmission = { visible: false, drone: null, source: 'Sin trafico', message: 'Esperando un enlace de dron o satelite.', state: 'Standby', stamp: '--:--' };
        this.layoutState = {
            hudMode: false,
            hasTarget: false,
            hasLock: false,
            hasTransmission: false,
            hasContextModule: false,
            hasStelaryi: false,
            hasSolar: false,
            hasShelf: false,
            hasWindows: false,
        };
        this._frameCount = 0;
        this._lastTime = performance.now();
        this._lastSpatialTick = performance.now();
        this._cameraVelocity = 0;
        this._hasPreviousCameraPose = false;
        this._worldTarget = new THREE.Vector3();
        this._screenTarget = new THREE.Vector3();
        this._offsetPoint = new THREE.Vector3();
        this._cameraDirection = new THREE.Vector3();
        this._cameraRight = new THREE.Vector3();
        this._cameraVector = new THREE.Vector3();
        this._worldScale = new THREE.Vector3();
        this._lastCameraPosition = new THREE.Vector3();
        this._bearingVector = new THREE.Vector3();
        this._lastDockContextSignature = '';
        this._layoutRaf = null;
        this._layoutObserver = null;
        this._observedLayoutNodes = new WeakSet();
        this._onHudMode = this._onHudMode.bind(this);
        this._onTransmission = this._onTransmission.bind(this);
        this._onNotificationDismissed = this._onNotificationDismissed.bind(this);
        this._onWindowState = this._onWindowState.bind(this);
        this._scheduleLayoutMetrics = this._scheduleLayoutMetrics.bind(this);
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this._removeHudModeListener = this.runtimeSignals?.on?.('PG:HUD_MODE', this._onHudMode) || null;
        this._removeWindowStateListener = this.runtimeSignals?.on?.('PG:WINDOW_STATE', this._onWindowState) || null;
        if (!this._removeHudModeListener) {
            window.addEventListener('PG:HUD_MODE', this._onHudMode);
        }
        window.addEventListener('PG:HUD_TRANSMISSION', this._onTransmission);
        window.addEventListener('NOTIFICATION_DISMISSED', this._onNotificationDismissed);
        if (!this._removeWindowStateListener) {
            window.addEventListener('PG:WINDOW_STATE', this._onWindowState);
        }
        this._buildUI();
    }

    _buildUI() {
        if (!this.container) return;

        // ── Anti-duplication guard: purge any stale HUD nodes from a previous init ──
        // This prevents double panels when the module is re-evaluated (hot-reload / Vite HMR)
        const staleIds = ['visor-panel', 'visor-ts', 'visor-shell', 'visor-speed', 'visor-heading', 'visor-fps', 'visor-sectors', 'visor-masses', 'visor-windows'];
        staleIds.forEach((id) => { document.getElementById(id)?.remove(); });
        this.container.querySelectorAll(
            '.helmet-visor, .kernel-os-hud, .helmet-status-strip, .helmet-context-bar, ' +
            '.helmet-intel-panel, .helmet-transmission, .spatial-reticle, ' +
            '.spatial-target-marker, .spatial-target-card, .stelaryi-launcher, ' +
            '.stelaryi-overlay, .solar-launcher, .solar-overlay'
        ).forEach((n) => n.remove());

        const visor = document.createElement('div');
        visor.className = 'helmet-visor';
        visor.innerHTML = `
            <div class="helmet-visor-frame">
                <div class="helmet-optics-filter"></div>
                <div class="helmet-optics-noise"></div>
                <div class="helmet-frame-top"></div>
                <div class="helmet-frame-left"></div>
                <div class="helmet-frame-right"></div>
                <div class="helmet-frame-bottom"></div>
                <div class="helmet-horizon-line"></div>
                <div class="helmet-arc helmet-arc-left"></div>
                <div class="helmet-arc helmet-arc-right"></div>
            </div>`;

        const panel = document.createElement('div');
        panel.className = 'kernel-os-hud';
        panel.id = 'visor-panel';
        panel.innerHTML = `
            <div class="visor-inner">
                <div class="visor-head">
                    <div class="helmet-panel-kicker">LULU // ASTRO TRACE</div>
                    <div class="visor-timestamp" id="visor-ts">--:--:--</div>
                </div>
                <div class="hud-title">VISOR INTERNO OMEGA</div>
            </div>
        `;
        const innerWrap = panel.querySelector('.visor-inner');
        const mkMetric = (label, id = '') => {
            const row = document.createElement('div');
            row.className = 'hud-row';
            const valId = id ? `id="${id}"` : '';
            row.innerHTML = `<span class="metric-label">${label}</span><span class="metric-value" ${valId}>---</span>`;
            innerWrap.appendChild(row);
            return row.lastElementChild;
        };
        this.nodes.shell   = mkMetric('Casco',     'visor-shell');
        this.nodes.speed   = mkMetric('Velocidad', 'visor-speed');
        this.nodes.heading = mkMetric('Rumbo',     'visor-heading');
        this.nodes.fps     = mkMetric('FPS',       'visor-fps');
        this.nodes.sectors = mkMetric('Sectores',  'visor-sectors');
        this.nodes.masses  = mkMetric('Masas',     'visor-masses');
        this.nodes.windows = mkMetric('Paneles',   'visor-windows');

        // Live timestamp
        this._tsInterval = setInterval(() => {
            const t = new Date();
            const ts = document.getElementById('visor-ts');
            if (ts) ts.textContent =
                `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
        }, 1000);

        const statusStrip = document.createElement('div');
        statusStrip.className = 'helmet-status-strip';
        statusStrip.innerHTML = `
            <div class="visor-chip"><span class="visor-chip-label">Modo</span><span class="visor-chip-value visor-mode-value">VUELO</span></div>
            <div class="visor-chip"><span class="visor-chip-label">Puntero</span><span class="visor-chip-value visor-pointer-value">LOCK</span></div>
            <div class="visor-chip"><span class="visor-chip-label">Traza</span><span class="visor-chip-value visor-track-value">IDLE</span></div>
            <div class="visor-chip"><span class="visor-chip-label">Paneles</span><span class="visor-chip-value visor-panel-value">0 LIVE</span></div>
            <div class="visor-chip"><span class="visor-chip-label">Sectores</span><span class="visor-chip-value visor-sector-value">0 ACT</span></div>
            <div class="visor-chip"><span class="visor-chip-label">Estrellas</span><span class="visor-chip-value visor-star-value">0</span></div>`;

        const contextBar = document.createElement('div');
        contextBar.className = 'helmet-context-bar';
        contextBar.innerHTML = '<div class="context-kicker">Interaccion</div><div class="context-text">Mantén TAB para operar el visor del casco.</div><div class="context-hint">TAB (mantener) = visor | 1 = LULU | Click = fijar masa | Doble click = abrir modulo</div>';

        const intelPanel = document.createElement('div');
        intelPanel.className = 'helmet-intel-panel';
        intelPanel.innerHTML = `
            <div class="intel-head"><div class="intel-eyebrow">Astro matematica</div><div class="intel-title">Sin objetivo</div></div>
            <div class="intel-formula">F = G M / r^2</div>
            <div class="intel-grid">
                <div class="intel-cell"><span class="intel-key">g proxy</span><span class="intel-value intel-gravity">0.0 m/s2</span></div>
                <div class="intel-cell"><span class="intel-key">Temp</span><span class="intel-value intel-temp">0 K</span></div>
                <div class="intel-cell"><span class="intel-key">v escape</span><span class="intel-value intel-escape">0 km/s</span></div>
                <div class="intel-cell"><span class="intel-key">Densidad</span><span class="intel-value intel-density">0 g/cm3</span></div>
                <div class="intel-cell"><span class="intel-key">Periodo</span><span class="intel-value intel-period">N/D</span></div>
                <div class="intel-cell"><span class="intel-key">Masa ref</span><span class="intel-value intel-mass">N/D</span></div>
            </div>
            <div class="intel-foot"><span class="intel-foot-label">Canon</span><span class="intel-foot-value intel-note">El visor solo llena esta banda cuando una masa entra en lectura activa.</span></div>`;

        const transmission = document.createElement('div');
        transmission.className = 'helmet-transmission';
        transmission.innerHTML = `
            <div class="transmission-head"><div class="transmission-badge">Canal tactico</div><button class="transmission-close" type="button">Cerrar</button></div>
            <div class="transmission-source">Sin trafico</div>
            <div class="transmission-message">Esperando un enlace de dron o satelite.</div>
            <div class="transmission-meta"><span class="transmission-state">Standby</span><span class="transmission-time">--:--</span></div>`;

        const reticle = document.createElement('div');
        reticle.className = 'spatial-reticle';
        reticle.innerHTML = '<div class="reticle-ring"></div><div class="reticle-core"></div><div class="reticle-line reticle-line-x"></div><div class="reticle-line reticle-line-y"></div><div class="reticle-ping"></div><div class="reticle-readout"><span class="reticle-name">VISOR OMEGA</span><span class="reticle-state">TRAZA EN ESPERA</span></div>';

        const marker = document.createElement('div');
        marker.className = 'spatial-target-marker';
        marker.innerHTML = '<div class="target-bracket tl"></div><div class="target-bracket tr"></div><div class="target-bracket bl"></div><div class="target-bracket br"></div><div class="target-orbit"></div><div class="target-caption">TRACE</div>';

        const card = document.createElement('div');
        card.className = 'spatial-target-card';
        card.innerHTML = `
            <div class="target-card-top"><div class="target-card-heading"><div class="target-card-eyebrow">Sin lectura</div><div class="target-card-title">Sin objetivo</div></div><div class="target-card-chip">SCAN</div></div>
            <div class="target-card-meta">El visor espera una masa, satelite o dron trazable.</div>
            <div class="target-card-grid">
                <div class="target-card-cell"><span class="target-card-key">Distancia</span><span class="target-card-value target-card-range">0 u</span></div>
                <div class="target-card-cell"><span class="target-card-key">Traza</span><span class="target-card-value target-card-bearing">AZ 000 / EL +00</span></div>
                <div class="target-card-cell"><span class="target-card-key">Firma</span><span class="target-card-value target-card-signature">VACIO</span></div>
                <div class="target-card-cell"><span class="target-card-key">Track</span><span class="target-card-value target-card-track">0%</span></div>
                <div class="target-card-cell target-card-cell-wide"><span class="target-card-key">Clase</span><span class="target-card-value target-card-class">Esperando vector</span></div>
            </div>
            <div class="target-card-footer"><span class="target-card-status">Reposo</span><span class="target-card-hint">Sin enlace activo</span></div>`;

        const stelaryiLauncher = document.createElement('button');
        stelaryiLauncher.type = 'button';
        stelaryiLauncher.className = 'stelaryi-launcher';
        stelaryiLauncher.innerHTML = '<span class="stelaryi-icon" aria-hidden="true"><span class="stelaryi-core"></span><span class="stelaryi-ray ray-a"></span><span class="stelaryi-ray ray-b"></span><span class="stelaryi-ray ray-c"></span><span class="stelaryi-tail"></span></span><span class="stelaryi-launcher-copy"><span class="stelaryi-launcher-title">Modo estelaryi</span><span class="stelaryi-launcher-subtitle">Alinear masa activa</span></span>';
        stelaryiLauncher.addEventListener('click', () => window.dispatchEvent(new CustomEvent('PG:TOGGLE_STELARYI')));

        const stelaryiOverlay = document.createElement('div');
        stelaryiOverlay.className = 'stelaryi-overlay';
        stelaryiOverlay.innerHTML = '<div class="stelaryi-overlay-head"><div class="stelaryi-overlay-badge">Modo estelaryi</div><div class="stelaryi-overlay-title">Alineacion orbital</div></div><div class="stelaryi-anchor-card"><div class="stelaryi-anchor-key">Masa ancla</div><div class="stelaryi-anchor-title">Sin masa</div><div class="stelaryi-anchor-state">Selecciona una masa para ordenar el sistema en tres niveles.</div></div><div class="stelaryi-levels"><div class="stelaryi-level"><div class="stelaryi-level-label">Orbita 01</div><div class="stelaryi-level-track" data-level="0"></div></div><div class="stelaryi-level"><div class="stelaryi-level-label">Orbita 02</div><div class="stelaryi-level-track" data-level="1"></div></div><div class="stelaryi-level"><div class="stelaryi-level-label">Orbita 03</div><div class="stelaryi-level-track" data-level="2"></div></div></div>';

        const solarLauncher = document.createElement('button');
        solarLauncher.type = 'button';
        solarLauncher.className = 'stelaryi-launcher solar-launcher';
        solarLauncher.innerHTML = '<span class="stelaryi-icon" aria-hidden="true"><span class="stelaryi-core"></span></span><span class="stelaryi-launcher-copy"><span class="stelaryi-launcher-title">Modo sistema solar</span><span class="stelaryi-launcher-subtitle">Ordenar masas locales</span></span>';
        solarLauncher.addEventListener('click', () => window.dispatchEvent(new CustomEvent('PG:TOGGLE_SOLAR_SYSTEM')));

        const solarOverlay = document.createElement('div');
        solarOverlay.className = 'stelaryi-overlay solar-overlay';
        solarOverlay.innerHTML = '<div class="stelaryi-overlay-head"><div class="stelaryi-overlay-badge">Modo sistema solar</div><div class="stelaryi-overlay-title">Reordenador local</div></div><div class="stelaryi-anchor-card"><div class="stelaryi-anchor-key">Centro</div><div class="stelaryi-anchor-title">Sin masa</div><div class="stelaryi-anchor-state">Activa el modo solar para inspeccionar y mover masas del mismo sistema.</div></div><div class="stelaryi-levels"><div class="stelaryi-level"><div class="stelaryi-level-label">Seleccion</div><div class="stelaryi-level-track" data-level="0"></div></div></div>';

        transmission.querySelector('.transmission-close').addEventListener('click', () => this._dismissTransmission(true));

        Object.assign(this.nodes, {
            visor, panel, statusStrip, contextBar, intelPanel, transmission, reticle, marker, card, stelaryiLauncher, stelaryiOverlay, solarLauncher, solarOverlay,
            statusMode: statusStrip.querySelector('.visor-mode-value'),
            statusPointer: statusStrip.querySelector('.visor-pointer-value'),
            statusTrack: statusStrip.querySelector('.visor-track-value'),
            statusPanels: statusStrip.querySelector('.visor-panel-value'),
            statusSectors: statusStrip.querySelector('.visor-sector-value'),
            statusStars: statusStrip.querySelector('.visor-star-value'),
            contextText: contextBar.querySelector('.context-text'),
            contextHint: contextBar.querySelector('.context-hint'),
            reticleName: reticle.querySelector('.reticle-name'),
            reticleState: reticle.querySelector('.reticle-state'),
            markerCaption: marker.querySelector('.target-caption'),
            cardEyebrow: card.querySelector('.target-card-eyebrow'),
            cardTitle: card.querySelector('.target-card-title'),
            cardChip: card.querySelector('.target-card-chip'),
            cardMeta: card.querySelector('.target-card-meta'),
            cardRange: card.querySelector('.target-card-range'),
            cardBearing: card.querySelector('.target-card-bearing'),
            cardSignature: card.querySelector('.target-card-signature'),
            cardTrack: card.querySelector('.target-card-track'),
            cardClass: card.querySelector('.target-card-class'),
            cardStatus: card.querySelector('.target-card-status'),
            cardHint: card.querySelector('.target-card-hint'),
            intelTitle: intelPanel.querySelector('.intel-title'),
            intelFormula: intelPanel.querySelector('.intel-formula'),
            intelGravity: intelPanel.querySelector('.intel-gravity'),
            intelTemp: intelPanel.querySelector('.intel-temp'),
            intelEscape: intelPanel.querySelector('.intel-escape'),
            intelDensity: intelPanel.querySelector('.intel-density'),
            intelPeriod: intelPanel.querySelector('.intel-period'),
            intelMass: intelPanel.querySelector('.intel-mass'),
            intelNote: intelPanel.querySelector('.intel-note'),
            transmissionSource: transmission.querySelector('.transmission-source'),
            transmissionMessage: transmission.querySelector('.transmission-message'),
            transmissionState: transmission.querySelector('.transmission-state'),
            transmissionTime: transmission.querySelector('.transmission-time'),
            stelaryiLauncherSubtitle: stelaryiLauncher.querySelector('.stelaryi-launcher-subtitle'),
            stelaryiAnchorTitle: stelaryiOverlay.querySelector('.stelaryi-anchor-title'),
            stelaryiAnchorState: stelaryiOverlay.querySelector('.stelaryi-anchor-state'),
            stelaryiLevelTracks: Array.from(stelaryiOverlay.querySelectorAll('.stelaryi-level-track')),
            solarLauncherSubtitle: solarLauncher.querySelector('.stelaryi-launcher-subtitle'),
            solarAnchorTitle: solarOverlay.querySelector('.stelaryi-anchor-title'),
            solarAnchorState: solarOverlay.querySelector('.stelaryi-anchor-state'),
            solarLevelTracks: Array.from(solarOverlay.querySelectorAll('.stelaryi-level-track'))
        });

        [visor, statusStrip, panel, intelPanel, contextBar, transmission, reticle, marker, card, stelaryiLauncher, stelaryiOverlay, solarLauncher, solarOverlay].forEach((node) => this.container.appendChild(node));
        this.isInitialized = true;
        this._setupLayoutMonitoring();
        this._applyHudModeState();
        this._renderTransmission();
    }

    updateMetrics(frame, drawCalls, systemCount, telemetry = null) {
        if (!this.isInitialized) return;
        this._frameCount++;
        if (telemetry) this.telemetry = { ...this.telemetry, ...telemetry };
        if (frame != null) this.telemetry.frame = frame;
        if (drawCalls != null) this.telemetry.drawCalls = drawCalls;
        if (systemCount != null) this.telemetry.systemCount = systemCount;
        const now = performance.now();
        const delta = now - this._lastTime;
        if (delta < 100) return;
        const fps = Math.round((this._frameCount * 1000) / delta);
        const visibleWindows = Math.max(0, this.windowTelemetry.open.size - this.windowTelemetry.minimized.size);
        // FPS display + live color coding
        this.nodes.fps.textContent = `${fps}`;
        const fpsEl = this.nodes.fps;
        if (fps >= 50) {
            fpsEl.style.color = '#44ff88';
            fpsEl.style.textShadow = '0 0 8px rgba(68,255,136,0.5)';
        } else if (fps >= 30) {
            fpsEl.style.color = '#ffcc44';
            fpsEl.style.textShadow = '0 0 8px rgba(255,204,68,0.5)';
        } else {
            fpsEl.style.color = '#ff4455';
            fpsEl.style.textShadow = '0 0 10px rgba(255,68,85,0.6)';
            fpsEl.style.animation = 'hud-alert-blink 0.8s ease-in-out infinite';
        }
        if (fps >= 30) fpsEl.style.animation = 'hud-data-flicker 8s ease infinite';
        this.nodes.sectors.textContent = this._formatCount(this.telemetry.activeSectors);
        this.nodes.masses.textContent = this._formatCount(this.telemetry.totalBodies || this.telemetry.systemCount);
        this.nodes.windows.textContent = `${visibleWindows}/${this.windowTelemetry.open.size}`;
        this.nodes.statusSectors.textContent = `${this._formatCount(this.telemetry.activeSectors)} ACT`;
        this.nodes.statusStars.textContent = this._formatStarCount(this.telemetry.stars);
        this.nodes.statusPanels.textContent = `${visibleWindows} LIVE`;
        this._frameCount = 0;
        this._lastTime = now;
    }

    updateSpatial(camera, navigationSystem, interactionSystem) {
        if (!this.isInitialized || !camera || !navigationSystem || !interactionSystem) return;
        const focusTarget = navigationSystem.focusTarget || null;
        const hoverTarget = interactionSystem.getHoverNode?.() || interactionSystem.hoveredNode || null;
        const hoverPoint = interactionSystem.getHoverPoint?.() || null;
        const activeTarget = focusTarget || hoverTarget;
        const state = this._normalizeCameraState(navigationSystem.state || 'MOUSE_UI');
        const hudMode = this._resolveHudMode();
        const kinematics = this._updateCameraTelemetry(camera);
        this._applyHudModeState();
        this.nodes.shell.textContent = this._formatShellState(state, hudMode);
        this.nodes.speed.textContent = this._formatSpeed(kinematics.speed);
        this.nodes.heading.textContent = this._formatHeading(kinematics.heading);
        this.nodes.statusMode.textContent = this._formatModeChip(state, hudMode);
        this.nodes.statusPointer.textContent = hudMode ? 'VISIBLE' : (this.telemetry.pointerLocked ? 'LOCK' : 'FLOAT');
        this.nodes.statusTrack.textContent = this._formatTrackChip(state, activeTarget, focusTarget, hudMode);
        this.nodes.contextText.textContent = this._formatInteractionPrompt(state, hudMode, hoverTarget, focusTarget);
        this.nodes.contextHint.textContent = this._formatInteractionHint(state, hudMode, hoverTarget, focusTarget);
        this.nodes.contextBar.classList.toggle('is-engaged', !!activeTarget || hudMode || this.transmission.visible);
        this.nodes.contextBar.classList.toggle('is-passive', !activeTarget && !hudMode && !this.transmission.visible);
        this._updateReticle(state, hoverTarget, focusTarget, hudMode);
        this._updateDockContext(activeTarget, !!focusTarget, hudMode);
        this._updateStelaryi(navigationSystem, hoverTarget, focusTarget);
        this._updateSolarSystem(navigationSystem, hoverTarget, focusTarget);
        this._syncLayoutState(navigationSystem, activeTarget, focusTarget, hudMode);
        if (!activeTarget) {
            this._hideTargetMarker();
            this._hideIntelPanel();
            return;
        }
        const markerAnchor = activeTarget === focusTarget ? null : hoverPoint;
        this._updateTargetMarker(camera, activeTarget, activeTarget === focusTarget, state, hudMode, markerAnchor);
    }

    _updateReticle(state, hoverTarget, focusTarget, hudMode) {
        const target = focusTarget || hoverTarget;
        const isMoon = !!target && target.userData?.nodeType === 'moon';
        const isMass = !!target && (target.userData?.isMass || ['planet', 'star', 'moon'].includes(target.userData?.nodeType) || target.userData?.isMetamorphMoon);
        this.nodes.reticle.classList.toggle('is-flight', state === 'FREE_FLIGHT');
        this.nodes.reticle.classList.toggle('has-target', !!target);
        this.nodes.reticle.classList.toggle('is-locked', !!focusTarget);
        this.nodes.reticle.classList.toggle('is-warping', state === 'WARP');
        this.nodes.reticle.classList.toggle('is-hud-mode', hudMode);
        this.nodes.reticle.classList.toggle('target-planet', isMass && !isMoon);
        this.nodes.reticle.classList.toggle('target-moon', isMoon);
        this.nodes.reticleName.textContent = this._formatLocationLabel(state, hoverTarget, focusTarget, hudMode);
        this.nodes.reticleState.textContent = this._formatLocationState(state, hoverTarget, focusTarget, hudMode);
    }

    _updateTargetMarker(camera, target, isLocked, state, hudMode, anchorPoint = null) {
        if (anchorPoint?.isVector3) {
            this._worldTarget.copy(anchorPoint);
        } else {
            target.getWorldPosition(this._worldTarget);
        }
        this._screenTarget.copy(this._worldTarget).project(camera);
        if (this._screenTarget.z < -1 || this._screenTarget.z > 1) return this._hideTargetMarker();
        const x = (this._screenTarget.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-this._screenTarget.y * 0.5 + 0.5) * window.innerHeight;
        const size = this._computeMarkerSize(camera, target, !!anchorPoint && !isLocked);
        const distance = camera.position.distanceTo(this._worldTarget);
        const bearing = this._computeBearing(camera, this._worldTarget);
        const profile = this._getTargetProfile(target);
        const track = this._estimateTrackQuality(state, isLocked, true, hudMode);

        this.nodes.marker.classList.toggle('is-locked', isLocked);
        this.nodes.marker.classList.toggle('is-warping', state === 'WARP');
        this.nodes.marker.classList.toggle('target-planet', target.userData?.nodeType !== 'moon');
        this.nodes.marker.classList.toggle('target-moon', target.userData?.nodeType === 'moon');
        Object.assign(this.nodes.marker.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, opacity: '1' });
        this.nodes.markerCaption.textContent = this._formatMarkerCaption(target, state, isLocked);

        this.nodes.card.style.opacity = '1';
        this.nodes.card.classList.toggle('is-locked', isLocked);
        this.nodes.card.classList.toggle('is-warping', state === 'WARP');
        this.nodes.card.classList.toggle('target-planet', target.userData?.nodeType !== 'moon');
        this.nodes.card.classList.toggle('target-moon', target.userData?.nodeType === 'moon');
        this.nodes.cardEyebrow.textContent = this._formatTargetCategory(target);
        this.nodes.cardTitle.textContent = this._formatTargetTitle(target);
        this.nodes.cardChip.textContent = this._formatChipLabel(state, isLocked);
        this.nodes.cardMeta.textContent = this._describeTargetState(state, isLocked, target, profile);
        this.nodes.cardRange.textContent = this._formatDistance(distance);
        this.nodes.cardBearing.textContent = this._formatBearingLabel(bearing);
        this.nodes.cardSignature.textContent = this._formatSignature(profile);
        this.nodes.cardTrack.textContent = `${track}%`;
        this.nodes.cardClass.textContent = this._formatTargetClass(target);
        this.nodes.cardStatus.textContent = this._formatStatusLabel(state, isLocked, target);
        this.nodes.cardHint.textContent = this._formatTargetHint(state, hudMode, target, isLocked);
        this._updateIntelPanel(target, profile, distance, state, hudMode);
    }

    _hideTargetMarker() {
        this.nodes.marker.style.opacity = '0';
        this.nodes.card.style.opacity = '0';
        this.nodes.marker.classList.remove('target-planet', 'target-moon', 'is-locked', 'is-warping');
        this.nodes.card.classList.remove('target-planet', 'target-moon', 'is-locked', 'is-warping');
    }

    _updateSolarSystem(navigationSystem, hoverTarget, focusTarget) {
        const snapshot = navigationSystem.getSolarSystemSnapshot?.() || { active: false, mode: 'creation', anchorLabel: 'Sin masa', selected: 'Ninguno', size: 0 };
        this.nodes.solarLauncher.classList.toggle('is-active', !!snapshot.active);
        this.nodes.solarLauncher.disabled = !snapshot.active && !hoverTarget && !focusTarget;
        this.nodes.solarLauncherSubtitle.textContent = snapshot.active ? `Orden ${snapshot.mode.toUpperCase()} | ${snapshot.selected} (${snapshot.size})` : 'Ordena masas del sistema local';
        this.nodes.solarOverlay.classList.toggle('is-visible', !!snapshot.active);
        this.nodes.solarAnchorTitle.textContent = snapshot.anchorLabel || 'Sin masa';
        this.nodes.solarAnchorState.textContent = snapshot.active ? 'Modo solar activo. Flechas cambian la seleccion; A y D mueven la masa.' : 'Selecciona una masa y activa el modo para reorganizar el sistema.';
        const track = this.nodes.solarLevelTracks?.[0];
        if (track) track.innerHTML = snapshot.active ? `<span class="stelaryi-chip"><span class="stelaryi-chip-name">${snapshot.selected}</span><span class="stelaryi-chip-radius">${snapshot.size} masas</span></span>` : '<span class="stelaryi-empty">Modo inactivo</span>';
    }

    _updateStelaryi(navigationSystem, hoverTarget, focusTarget) {
        const snapshot = navigationSystem.getStelaryiSnapshot?.() || { active: false, anchorLabel: 'Sin masa', anchorState: 'Selecciona una masa para organizar el universo.', levels: [[], [], []] };
        const armed = !!(focusTarget || hoverTarget);
        this.nodes.stelaryiLauncher.classList.toggle('is-armed', armed);
        this.nodes.stelaryiLauncher.classList.toggle('is-active', !!snapshot.active);
        this.nodes.stelaryiLauncher.disabled = !armed && !snapshot.active;
        this.nodes.stelaryiLauncherSubtitle.textContent = snapshot.active ? 'Vista orbital viva' : armed ? 'Alinear masa actual' : 'Selecciona una masa';
        this.nodes.stelaryiOverlay.classList.toggle('is-visible', !!snapshot.active);
        this.nodes.stelaryiAnchorTitle.textContent = snapshot.anchorLabel || 'Sin masa';
        this.nodes.stelaryiAnchorState.textContent = snapshot.anchorState || 'Selecciona una masa para activar la alineacion.';
        for (let i = 0; i < this.nodes.stelaryiLevelTracks.length; i++) {
            const items = snapshot.levels?.[i] || [];
            this.nodes.stelaryiLevelTracks[i].innerHTML = items.length ? items.map((item) => `<span class="stelaryi-chip"><span class="stelaryi-chip-name">${item.label}</span><span class="stelaryi-chip-radius">${item.radius}u</span></span>`).join('') : '<span class="stelaryi-empty">Sin masas en este nivel</span>';
        }
    }

    _updateCameraTelemetry(camera) {
        const now = performance.now();
        if (!this._hasPreviousCameraPose) {
            this._lastCameraPosition.copy(camera.position);
            this._hasPreviousCameraPose = true;
            this._lastSpatialTick = now;
        }
        const deltaSeconds = Math.max(0.001, (now - this._lastSpatialTick) / 1000);
        this._cameraVelocity = THREE.MathUtils.lerp(this._cameraVelocity, camera.position.distanceTo(this._lastCameraPosition) / deltaSeconds, 0.2);
        this._lastCameraPosition.copy(camera.position);
        this._lastSpatialTick = now;
        camera.getWorldDirection(this._cameraDirection);
        return { speed: this._cameraVelocity, heading: this._directionToAngles(this._cameraDirection) };
    }

    _updateIntelPanel(target, profile, distance, state, hudMode) {
        if (!target || !profile) return this._hideIntelPanel();
        const metrics = this._derivePhysicsMetrics(profile);
        this.nodes.intelPanel.classList.add('is-visible');
        this.nodes.intelPanel.classList.toggle('is-hud-mode', hudMode);
        this.nodes.intelTitle.textContent = this._formatTargetTitle(target);
        this.nodes.intelFormula.textContent = this._resolveFormulaLabel(target, state);
        this.nodes.intelGravity.textContent = `${metrics.surfaceGravityMs2.toFixed(1)} m/s2`;
        this.nodes.intelTemp.textContent = `${Math.round(profile.temperatureK || 0)} K`;
        this.nodes.intelEscape.textContent = metrics.escapeVelocityKms > 0 ? `${metrics.escapeVelocityKms.toFixed(1)} km/s` : 'N/D';
        this.nodes.intelDensity.textContent = metrics.density > 0 ? `${metrics.density.toFixed(2)} g/cm3` : 'N/D';
        this.nodes.intelPeriod.textContent = profile.orbitalPeriodDays ? `${Math.round(profile.orbitalPeriodDays)} d` : this._formatDistance(distance);
        this.nodes.intelMass.textContent = metrics.massLabel;
        this.nodes.intelNote.textContent = `${profile.analog || 'Canon LULU'} | firma ${this._formatSignature(profile)} | ${profile.atmosphere || 'lectura limpia'}`;
    }

    _hideIntelPanel() {
        this.nodes.intelPanel.classList.remove('is-visible');
    }

    _directionToAngles(direction) {
        return {
            azimuth: (THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z)) + 360) % 360,
            elevation: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)))
        };
    }

    _computeBearing(camera, targetPosition) {
        this._bearingVector.copy(targetPosition).sub(camera.position).normalize();
        return this._directionToAngles(this._bearingVector);
    }

    _resolveHudMode() {
        const inputState = Registry.tryGet('InputStateSystem');
        this.hudModeActive = !!(this.hudModeActive || this.telemetry.hudMode || inputState?.hudMode);
        return this.hudModeActive;
    }

    _onHudMode(event) {
        const detail = event?.detail || event || {};
        this.hudModeActive = !!detail.active;
        this.telemetry.hudMode = this.hudModeActive;
        this._applyHudModeState();
    }

    _applyHudModeState() {
        if (!this.nodes.visor) return;
        const hudMode = !!(this.hudModeActive || this.telemetry.hudMode);
        ['visor', 'panel', 'statusStrip', 'contextBar', 'intelPanel', 'transmission'].forEach((key) => this.nodes[key]?.classList.toggle('is-hud-mode', hudMode));
        this._setLayoutState({ hudMode });
    }

    _onTransmission(event) {
        const drone = event.detail?.drone || event.detail?.target || null;
        this.transmission = {
            visible: true,
            drone,
            source:
                event.detail?.sourceLabel ||
                drone?.userData?.satellite?.userData?.label ||
                drone?.userData?.satellite?.name ||
                'Transmision segura',
            message: event.detail?.message || drone?.userData?.message || 'Mensaje orbital recibido.',
            state: event.detail?.stateLabel || 'Canal abierto',
            stamp: new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' }).format(new Date())
        };
        this._renderTransmission();
    }

    _onNotificationDismissed() {
        this._dismissTransmission(false);
    }

    _dismissTransmission(dispatchAck) {
        const currentDrone = this.transmission.drone;
        this.transmission = { visible: false, drone: null, source: 'Sin trafico', message: 'Esperando un enlace de dron o satelite.', state: 'Standby', stamp: '--:--' };
        this._renderTransmission();
        if (dispatchAck && currentDrone) {
            window.dispatchEvent(new CustomEvent('NOTIFICATION_DISMISSED', { detail: { drone: currentDrone } }));
        }
    }

    _renderTransmission() {
        if (!this.nodes.transmission) return;
        this.nodes.transmission.classList.toggle('is-visible', this.transmission.visible);
        this.nodes.transmissionSource.textContent = this.transmission.source;
        this.nodes.transmissionMessage.textContent = this.transmission.message;
        this.nodes.transmissionState.textContent = this.transmission.state;
        this.nodes.transmissionTime.textContent = this.transmission.stamp;
        this._setLayoutState({ hasTransmission: !!this.transmission.visible });
    }

    _onWindowState(event) {
        const detail = event?.detail || event || {};
        const appId = detail.appId;
        const state = detail.state;
        if (!appId || !state) return;
        if (state === 'closed') {
            this.windowTelemetry.open.delete(appId);
            this.windowTelemetry.minimized.delete(appId);
            this._setLayoutState({
                hasWindows: this.windowTelemetry.open.size > 0,
                hasShelf: this.windowTelemetry.minimized.size > 0,
            });
            return;
        }
        this.windowTelemetry.open.add(appId);
        if (state === 'minimized') this.windowTelemetry.minimized.add(appId);
        else this.windowTelemetry.minimized.delete(appId);
        this._setLayoutState({
            hasWindows: this.windowTelemetry.open.size > 0,
            hasShelf: this.windowTelemetry.minimized.size > 0,
        });
    }

    _syncLayoutState(navigationSystem, activeTarget, focusTarget, hudMode) {
        const stelaryi = navigationSystem.getStelaryiSnapshot?.() || { active: false };
        const solar = navigationSystem.getSolarSystemSnapshot?.() || { active: false };
        this._setLayoutState({
            hudMode,
            hasTarget: !!activeTarget,
            hasLock: !!focusTarget,
            hasTransmission: !!this.transmission.visible,
            hasContextModule: !!activeTarget?.userData?.appId || !!activeTarget?.userData?.parentAppId,
            hasStelaryi: !!stelaryi.active,
            hasSolar: !!solar.active,
            hasShelf: this.windowTelemetry.minimized.size > 0,
            hasWindows: this.windowTelemetry.open.size > 0,
        });
    }

    _applyLayoutClasses() {
        const body = document.body;
        if (!body) return;
        const toggles = {
            'pg-tab-layout': this.layoutState.hudMode,
            'pg-tab-has-target': this.layoutState.hudMode && this.layoutState.hasTarget,
            'pg-tab-has-lock': this.layoutState.hudMode && this.layoutState.hasLock,
            'pg-tab-has-transmission': this.layoutState.hudMode && this.layoutState.hasTransmission,
            'pg-tab-has-context-module': this.layoutState.hudMode && this.layoutState.hasContextModule,
            'pg-tab-has-shelf': this.layoutState.hudMode && this.layoutState.hasShelf,
            'pg-tab-has-windows': this.layoutState.hudMode && this.layoutState.hasWindows,
            'pg-tab-stelaryi': this.layoutState.hudMode && this.layoutState.hasStelaryi,
            'pg-tab-solar': this.layoutState.hudMode && this.layoutState.hasSolar,
            'pg-tab-overlay-active': this.layoutState.hudMode && (this.layoutState.hasStelaryi || this.layoutState.hasSolar),
        };
        Object.entries(toggles).forEach(([className, enabled]) => body.classList.toggle(className, !!enabled));
    }

    _setLayoutState(partialState, force = false) {
        const nextState = { ...this.layoutState, ...partialState };
        const changed = force || Object.keys(nextState).some((key) => this.layoutState[key] !== nextState[key]);
        this.layoutState = nextState;
        if (changed) {
            this._applyLayoutClasses();
            this._scheduleLayoutMetrics();
        }
        return changed;
    }

    _setupLayoutMonitoring() {
        window.addEventListener('resize', this._scheduleLayoutMetrics);
        this._scheduleLayoutMetrics();
    }

    _getLayoutNodes() {
        return [
            this.nodes.panel,
            this.nodes.statusStrip,
            this.nodes.contextBar,
            this.nodes.intelPanel,
            this.nodes.card,
            this.nodes.transmission,
            this.nodes.stelaryiOverlay,
            this.nodes.solarOverlay,
            document.querySelector('.kernel-dock'),
            document.querySelector('.window-shelf'),
            document.querySelector('.lulu-command-input'),
        ].filter(Boolean);
    }

    _observeLayoutNodes() {
        return;
    }

    _scheduleLayoutMetrics() {
        if (this._layoutRaf) {
            cancelAnimationFrame(this._layoutRaf);
        }
        this._layoutRaf = requestAnimationFrame(() => {
            this._layoutRaf = null;
            this._refreshLayoutMetrics();
        });
    }

    _refreshLayoutMetrics() {
        const root = document.documentElement;
        if (!root) return;

        const gap = 18;
        const body = document.body;
        const dockBox = this._measureBox(document.querySelector('.kernel-dock'));
        const shelfBox = this._measureBox(document.querySelector('.window-shelf'));
        const commandBox = this._measureBox(document.querySelector('.lulu-command-input'));
        const panelBox = this._measureBox(this.nodes.panel);
        const intelBox = this.layoutState.hasTarget ? this._measureBox(this.nodes.intelPanel) : this._measureBox(null);
        const dockRect = { width: dockBox.width, height: dockBox.height };
        const shelfRect = { width: shelfBox.width, height: shelfBox.height };
        const panelRect = { width: panelBox.width, height: panelBox.height };
        const intelRect = { width: intelBox.width, height: intelBox.height };
        const rightCardBox = this.layoutState.hasTarget ? this._measureBox(this.nodes.card) : this._measureBox(null);
        const rightTransmissionBox = this.layoutState.hasTransmission ? this._measureBox(this.nodes.transmission) : this._measureBox(null);
        const rightOverlayBox = this.layoutState.hasSolar
            ? this._measureBox(this.nodes.solarOverlay)
            : this.layoutState.hasStelaryi
                ? this._measureBox(this.nodes.stelaryiOverlay)
                : this._measureBox(null);

        const rightLaneCandidates = [dockRect.width];
        if (this.layoutState.hasSolar) rightLaneCandidates.push(rightOverlayBox.width);
        else if (this.layoutState.hasStelaryi) rightLaneCandidates.push(rightOverlayBox.width);
        else {
            if (this.layoutState.hasTarget) rightLaneCandidates.push(rightCardBox.width);
            if (this.layoutState.hasTransmission) rightLaneCandidates.push(rightTransmissionBox.width);
        }

        const leftLane = Math.max(244, Math.round(Math.max(panelRect.width, intelRect.width) + gap * 2));
        const rightLane = Math.max(256, Math.round(Math.max(...rightLaneCandidates, 0) + gap * 2));
        const bottomLeft = Math.max(leftLane, Math.round((shelfRect.width || 0) + gap * 2));
        const bottomRight = Math.max(rightLane, Math.round((dockRect.width || 0) + gap * 2));
        const centerLane = Math.max(0, window.innerWidth - bottomLeft - bottomRight);
        const tightCenter = this.layoutState.hudMode && centerLane < 220;
        const leftStackOffset = shelfBox.height ? shelfBox.height + gap : 0;
        const leftStackHeight = (commandBox.height || 0) + leftStackOffset;
        const bottomReserve = Math.max(
            168,
            Math.round(Math.max(dockRect.height, leftStackHeight, shelfRect.height) + 52 + (tightCenter ? 86 : 0))
        );
        const topReserve = Math.max(92, Math.round(this._measureNode(this.nodes.statusStrip).height + 28));
        const leftStart = Math.max(
            topReserve,
            panelBox.height ? Math.round(panelBox.bottom + gap) : topReserve,
            intelBox.height ? Math.round(intelBox.bottom + gap) : topReserve
        );
        const rightStart = Math.max(
            topReserve,
            rightCardBox.height ? Math.round(rightCardBox.bottom + gap) : topReserve,
            rightTransmissionBox.height ? Math.round(rightTransmissionBox.bottom + gap) : topReserve,
            rightOverlayBox.height ? Math.round(rightOverlayBox.bottom + gap) : topReserve
        );

        const tightChanged = !!body && body.classList.contains('pg-tab-tight-center') !== tightCenter;
        body?.classList.toggle('pg-tab-tight-center', tightCenter);
        root.style.setProperty('--pg-tab-left-lane', `${leftLane}px`);
        root.style.setProperty('--pg-tab-right-lane', `${rightLane}px`);
        root.style.setProperty('--pg-tab-bottom-left', `${bottomLeft}px`);
        root.style.setProperty('--pg-tab-bottom-right', `${bottomRight}px`);
        root.style.setProperty('--pg-tab-bottom-reserve', `${bottomReserve}px`);
        root.style.setProperty('--pg-tab-top-reserve', `${topReserve}px`);
        root.style.setProperty('--pg-tab-left-start', `${leftStart}px`);
        root.style.setProperty('--pg-tab-right-start', `${rightStart}px`);
        root.style.setProperty('--pg-tab-left-stack-offset', `${leftStackOffset}px`);
        root.style.setProperty('--pg-tab-center-lane', `${centerLane}px`);

        // ── Publish real visor panel height for intel panel positioning ──────
        const visorRealBox = this._measureBox(this.nodes.panel);
        const visorH = visorRealBox.height || 160;
        root.style.setProperty('--hz-visor-h', `${visorH}px`);
        // Also publish dock height for context bar / launcher stacking
        root.style.setProperty('--hz-dock-h-real', `${dockBox.height > 0 ? dockBox.height + 18 : 130}px`);

        window.dispatchEvent(new CustomEvent('PG:HUD_LAYOUT_METRICS', {
            detail: { leftLane, rightLane, leftStart, rightStart, bottomReserve, topReserve, centerLane, tightCenter, leftStackOffset }
        }));
        if (tightChanged) {
            this._scheduleLayoutMetrics();

        }
    }

    _measureNode(node) {
        const box = this._measureBox(node);
        return {
            width: box.width,
            height: box.height
        };
    }

    _measureBox(node) {
        if (!node) return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
        const style = window.getComputedStyle(node);
        if (style.display === 'none') return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 };
        const rect = node.getBoundingClientRect();
        return {
            left: Math.round(rect.left || 0),
            top: Math.round(rect.top || 0),
            right: Math.round(rect.right || 0),
            bottom: Math.round(rect.bottom || 0),
            width: Math.round(rect.width || 0),
            height: Math.round(rect.height || 0)
        };
    }

    _computeMarkerSize(camera, target, useAcquisitionPoint = false) {
        if (useAcquisitionPoint) {
            return target?.userData?.nodeType === 'moon' ? 64 : 76;
        }
        let radius = 10;
        if (target.geometry) {
            if (!target.geometry.boundingSphere) target.geometry.computeBoundingSphere();
            radius = target.geometry.boundingSphere?.radius || radius;
            target.getWorldScale(this._worldScale);
            radius *= Math.max(this._worldScale.x, this._worldScale.y, this._worldScale.z);
        }
        camera.getWorldDirection(this._cameraVector);
        this._cameraRight.crossVectors(this._cameraVector, camera.up).normalize().multiplyScalar(radius);
        this._offsetPoint.copy(this._worldTarget).add(this._cameraRight);
        const projectedOffset = this._offsetPoint.project(camera);
        const dx = (projectedOffset.x - this._screenTarget.x) * window.innerWidth * 0.5;
        const dy = (projectedOffset.y - this._screenTarget.y) * window.innerHeight * 0.5;
        return Math.min(180, Math.max(58, Math.sqrt(dx * dx + dy * dy) * 2.6));
    }

    _estimateTrackQuality(state, isLocked, hasTarget, hudMode) {
        if (state === 'WARP') return 100;
        if (state === 'SOLAR_SYSTEM') return 96;
        if (state === 'STELARYI') return 93;
        if (isLocked) return 98;
        if (hasTarget && hudMode) return 82;
        if (hasTarget) return 68;
        if (hudMode) return 40;
        return 14;
    }

    _derivePhysicsMetrics(profile) {
        const gravityG = Number(profile.gravityG || 0);
        const surfaceGravityMs2 = gravityG * EARTH_SURFACE_GRAVITY;
        let massEarths = 0;
        let massLabel = 'N/D';
        if (profile.massEarths) {
            massEarths = Number(profile.massEarths);
            massLabel = `${massEarths.toFixed(2)} M_tierra`;
        } else if (profile.massSolar) {
            massEarths = Number(profile.massSolar) * SOLAR_TO_EARTH_MASS;
            massLabel = `${Number(profile.massSolar).toFixed(2)} M_sol`;
        } else if (profile.massTons) {
            massLabel = `${Math.round(profile.massTons)} t`;
        }
        const radiusEarths = massEarths > 0 && gravityG > 0 ? Math.sqrt(massEarths / gravityG) : 0;
        const escapeVelocityKms = massEarths > 0 && radiusEarths > 0 ? EARTH_ESCAPE_VELOCITY_KMS * Math.sqrt(massEarths / radiusEarths) : 0;
        const density = massEarths > 0 && radiusEarths > 0 ? EARTH_DENSITY * (massEarths / (radiusEarths ** 3)) : 0;
        return { surfaceGravityMs2, escapeVelocityKms, density, massLabel };
    }

    _resolveFormulaLabel(target, state) {
        if (target?.userData?.isDrone) return 'tau = d / c  |  canal y latencia';
        if (target?.userData?.isSatellite || target?.userData?.isMetamorphMoon) return 'omega = sqrt(GM / r^3)';
        if (state === 'SOLAR_SYSTEM') return 'T = 2pi * sqrt(r^3 / GM)';
        return 'v_e = sqrt(2GM / r)';
    }

    _formatShellState(state, hudMode) {
        if (state === 'WARP') return 'SALTO';
        if (state === 'STELARYI') return 'ALINEADO';
        if (state === 'SOLAR_SYSTEM') return 'SOLAR';
        if (hudMode) return 'TACTIL';
        return this.telemetry.kernelState === 'READY' ? 'NOMINAL' : this.telemetry.kernelState;
    }

    _formatModeChip(state, hudMode) {
        if (hudMode) return 'RATON LIBRE';
        if (state === 'FREE_FLIGHT') return 'VUELO LIBRE';
        if (state === 'FOCUS') return 'FOCO';
        if (state === 'WARP') return 'WARP';
        if (state === 'STELARYI') return 'ESTELARYI';
        if (state === 'SOLAR_SYSTEM') return 'SOLAR';
        return state;
    }

    _formatTrackChip(state, activeTarget, focusTarget, hudMode) {
        const quality = this._estimateTrackQuality(state, !!focusTarget, !!activeTarget, hudMode);
        if (focusTarget) return `LOCK ${quality}%`;
        if (activeTarget) return `SCAN ${quality}%`;
        return `IDLE ${quality}%`;
    }

    _formatInteractionPrompt(state, hudMode, hoverTarget, focusTarget) {
        const target = focusTarget || hoverTarget;
        if (hudMode && target?.userData?.isDrone) return 'Mantenga el dron en lectura para abrir la transmision dentro del casco.';
        if (hudMode && target?.userData?.isSatellite) return 'Raton libre activo: click para fijar el satelite. Click derecho rapido limpia la traza; fuera de TAB, mantener derecho prepara un salto preciso.';
        if (hudMode && target?.userData?.isApp) return `Raton libre activo: click para fijar ${this._formatTargetTitle(target)} y doble click para abrir el modulo.`;
        if (hudMode && target) return `Raton libre activo: click para fijar ${this._formatTargetTitle(target)} y doble click para abrir su ventana.`;
        if (hudMode) return 'Raton libre activo. Si LULU tiene un objeto en edicion, el mouse queda reservado al workspace 2D hasta salir de TAB.';
        if (state === 'WARP') return 'Corredor de warp en curso. La traza queda fijada hasta la aproximacion final.';
        if (state === 'STELARYI') return 'Estelaryi organiza el sistema en niveles orbitales legibles para inspeccion rapida.';
        if (state === 'SOLAR_SYSTEM') return 'Modo solar activo. Selecciona y reordena las masas del sistema local.';
        if (focusTarget) return `Objetivo bloqueado sobre ${this._formatTargetTitle(focusTarget)}.`;
        if (hoverTarget) return `Visor listo para adquirir ${this._formatTargetTitle(hoverTarget)}.`;
        return 'TAB alterna el cursor libre. Click derecho rapido limpia la seleccion; mantener derecho ejecuta un salto preciso.';
    }

    _formatInteractionHint(state, hudMode, hoverTarget, focusTarget) {
        const target = focusTarget || hoverTarget;
        if (hudMode && target?.userData?.isDrone) return 'TAB activo | Mantener foco = transmision | ESC = pausa';
        if (hudMode && target?.userData?.isSatellite) return 'TAB activo | Click = foco satelital | Click der rapido = limpiar';
        if (hudMode && target?.userData?.isApp) return 'TAB activo | Click = fijar | Click en lock = desplegar | Doble click = abrir modulo';
        if (hudMode && target) return 'TAB activo | Click = fijar masa | Click sobre lock = desplegar ventana';
        if (hudMode) return 'TAB activo | Cursor libre | Objeto LULU en edicion = mouse 2D exclusivo';
        if (state === 'SOLAR_SYSTEM') return 'Flechas = seleccion | A y D = mover | S = ordenar';
        if (state === 'STELARYI') return 'ESC = salir | Lanzador derecho = mantener alineacion';
        return 'TAB = visor libre | Click = fijar masa | Click der = limpiar | Mantener der = salto preciso';
    }

    _formatLocationLabel(state, hoverTarget, focusTarget, hudMode) {
        const target = focusTarget || hoverTarget;
        if (!target) return hudMode ? 'VISOR INTERACTIVO' : 'ESPACIO INFINITO';
        return this._formatTargetTitle(target).toUpperCase();
    }

    _formatLocationState(state, hoverTarget, focusTarget, hudMode) {
        const target = focusTarget || hoverTarget;
        if (!target) {
            if (hudMode) return 'RATON LIBRE ACTIVO';
            if (state === 'FREE_FLIGHT') return 'DERIVA LIBRE';
            if (state === 'STELARYI') return 'UNIVERSO ORGANIZADO';
            if (state === 'FOCUS') return 'ORBITA ESTABLE';
            if (state === 'WARP') return 'CORREDOR DE WARP';
            return 'SECTOR OBSERVADO';
        }
        if (state === 'STELARYI') return 'MODO ESTELARYI ACTIVO';
        if (state === 'SOLAR_SYSTEM') return 'MODO SOLAR ACTIVO';
        if (state === 'WARP') return 'APROXIMACION EN CURSO';
        if (focusTarget) return 'BLOQUEO ESTABLE';
        return hudMode ? 'TRAZA INTERACTIVA' : 'MASA ADQUIRIBLE';
    }

    _formatTargetCategory(target) {
        const profile = this._getTargetProfile(target);
        if (target?.userData?.isDrone) return 'Dron asistente';
        if (target?.userData?.isSatellite || target?.userData?.isMetamorphMoon) return 'Satelite de servicio';
        if (target?.userData?.nodeType === 'star') return 'Nucleo estelar';
        if (target?.userData?.nodeType === 'moon') return 'Luna orbital';
        if (target?.userData?.nodeType === 'planet') return profile.classification || 'Masa orbital';
        return 'Masa trazable';
    }

    _formatTargetClass(target) {
        const profile = this._getTargetProfile(target);
        return `${(profile.classification || 'MASA').toUpperCase()} / ${(profile.analog || 'CANON LULU').toUpperCase()}`;
    }

    _formatTargetTitle(target) {
        return target?.userData?.label || target?.userData?.appName || target?.name || 'Masa orbital';
    }

    _formatMarkerCaption(target, state, isLocked) {
        if (state === 'STELARYI') return 'ALIGN';
        if (state === 'SOLAR_SYSTEM') return 'SOLAR';
        if (state === 'WARP') return 'WARP';
        if (target?.userData?.isDrone) return isLocked ? 'DRONE' : 'AID';
        if (target?.userData?.isSatellite) return isLocked ? 'LOCK' : 'SAT';
        if (target?.userData?.nodeType === 'star') return isLocked ? 'SOL' : 'STAR';
        if (target?.userData?.nodeType === 'moon') return isLocked ? 'LUNA' : 'MOON';
        return isLocked ? 'LOCK' : 'MASS';
    }

    _formatChipLabel(state, isLocked) {
        if (state === 'SOLAR_SYSTEM') return 'SOLAR';
        if (state === 'STELARYI') return 'ESTELARYI';
        if (state === 'WARP') return 'WARP';
        if (isLocked || state === 'FOCUS') return 'LOCK';
        return 'SCAN';
    }

    _describeTargetState(state, isLocked, target, profile) {
        const signature = this._formatSignature(profile);
        const hazard = profile?.hazard || 'LOW';
        const atmosphere = profile?.atmosphere || 'Lectura limpia';
        if (target?.userData?.isDrone) return `Unidad auxiliar con firma ${signature}. Mantener foco continua la entrega dentro del visor.`;
        if (target?.userData?.isSatellite || target?.userData?.isMetamorphMoon) return `Satelite EVA con firma ${signature}. Riesgo ${hazard}. Preparado para foco y despliegue contextual.`;
        if (state === 'SOLAR_SYSTEM') return `Masa local bajo reorganizacion solar. Firma ${signature}. Entorno ${atmosphere}.`;
        if (state === 'STELARYI') return `Masa anclada en lectura estelaryi. Firma ${signature}. Riesgo ${hazard}.`;
        if (state === 'WARP') return `Trayectoria sincronizada. Firma ${signature}. Lectura atmosferica: ${atmosphere}.`;
        if (isLocked || state === 'FOCUS') return `Bloqueo estable. Firma ${signature}. Riesgo ${hazard}.`;
        return `Traza viva. Firma ${signature}. Lectura atmosferica: ${atmosphere}.`;
    }

    _formatStatusLabel(state, isLocked, target) {
        if (target?.userData?.isDrone) return 'Asistente sincronizado';
        if (state === 'SOLAR_SYSTEM') return 'Modo solar activo';
        if (state === 'STELARYI') return 'Alineacion estable';
        if (state === 'WARP') return 'Corredor estable';
        if (isLocked || state === 'FOCUS') return 'Objetivo bloqueado';
        return 'Vector adquirido';
    }

    _formatTargetHint(state, hudMode, target, isLocked) {
        if (target?.userData?.isDrone) return 'Mantener foco para completar la transmision';
        if (target?.userData?.isSatellite) return 'Click para fijar satelite';
        if (target?.userData?.isApp) return isLocked ? 'Click para desplegar el modulo' : 'Doble click para abrir el modulo';
        if (state === 'STELARYI') return 'Boton derecho conserva la alineacion';
        if (state === 'SOLAR_SYSTEM') return 'Usa flechas, A y D para reordenar';
        if (isLocked) return hudMode ? 'Raton libre: paneles y lanzadores disponibles' : 'ESC para repliegue';
        return hudMode ? 'Click para fijar la masa' : 'TAB libera el visor';
    }

    _updateDockContext(target, isLocked, hudMode) {
        const appId = target?.userData?.appId || target?.userData?.parentAppId || null;
        const label = target ? this._formatTargetTitle(target) : null;
        const signature = `${hudMode ? '1' : '0'}|${appId || '-'}|${label || '-'}|${isLocked ? '1' : '0'}`;
        if (signature === this._lastDockContextSignature) return;
        this._lastDockContextSignature = signature;
        const detail = {
            hudMode,
            appId,
            label,
            isLocked,
            hasTarget: !!target
        };
        const runtimeSignals = Registry.tryGet('RuntimeSignals');
        if (runtimeSignals?.emit) {
            runtimeSignals.emit('PG:HUD_TARGET_CONTEXT', detail);
        } else {
            window.dispatchEvent(new CustomEvent('PG:HUD_TARGET_CONTEXT', { detail }));
        }
        this._scheduleLayoutMetrics();
    }

    _formatSignature(profile) { return profile?.trackingSignature || 'VISUAL'; }
    _formatCount(value) { return Number(value || 0).toLocaleString(LOCALE); }
    _formatStarCount(value) { const n = Number(value || 0); return n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : n.toLocaleString(LOCALE); }
    _formatDistance(value) { const n = Number(value || 0); return n >= 1000 ? `${(n / 1000).toFixed(1)} ku` : `${Math.round(n).toLocaleString(LOCALE)} u`; }
    _formatSpeed(value) { const n = Number(value || 0); return n >= 1000 ? `${(n / 1000).toFixed(2)} ku/s` : `${Math.round(n).toLocaleString(LOCALE)} u/s`; }
    _formatHeading(heading) { const az = Math.round(heading.azimuth).toString().padStart(3, '0'); const el = `${Math.round(heading.elevation) >= 0 ? '+' : ''}${Math.round(heading.elevation)}`.padStart(3, ' '); return `AZ ${az} / EL ${el}`; }
    _formatBearingLabel(bearing) { const az = Math.round(bearing.azimuth).toString().padStart(3, '0'); const el = `${Math.round(bearing.elevation) >= 0 ? '+' : ''}${Math.round(bearing.elevation)}`.padStart(3, ' '); return `AZ ${az} / EL ${el}`; }

    _getTargetProfile(target) {
        if (!target) return null;
        if (target.userData?.bodyProfile) return target.userData.bodyProfile;
        if (target.userData?.isDrone) return ASTRONOMY_BODY_PROFILES.drone;
        if (target.userData?.isSatellite || target.userData?.isMetamorphMoon) return ASTRONOMY_BODY_PROFILES.satellite;
        if (target.userData?.nodeType === 'star') return ASTRONOMY_BODY_PROFILES.star;
        if (target.userData?.nodeType === 'moon' || (target.name || '').startsWith('Moon_')) return ASTRONOMY_BODY_PROFILES.moon;
        if (target.userData?.planetClass && ASTRONOMY_BODY_PROFILES[target.userData.planetClass]) return ASTRONOMY_BODY_PROFILES[target.userData.planetClass];
        return { classification: 'Masa orbital', analog: 'Canon LULU', trackingSignature: 'VISUAL', hazard: 'LOW', atmosphere: 'Lectura limpia' };
    }

    _normalizeCameraState(state) {
        if (state === 'WORLD_FOCUS') return 'FOCUS';
        if (state === 'WARPING') return 'WARP';
        return state || 'MOUSE_UI';
    }
}
