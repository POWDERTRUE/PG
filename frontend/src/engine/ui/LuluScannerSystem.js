/**
 * LuluScannerSystem.js — OMEGA V31
 *
 * Escáner holográfico de ontología de masas cósmicas.
 * Triggered by PG:UI:OPEN_LULU_SCAN (emitido por TacticalContextMenuSystem sector SCN).
 *
 * LEY 8 (Zero-GC): DOM construido una sola vez en el constructor.
 * Todas las actualizaciones mutan .textContent de nodos pre-cacheados.
 * Sin innerHTML caliente, sin querySelector en el loop de señales.
 *
 * Flujo:
 *   menú radial SCN → PG:UI:OPEN_LULU_SCAN { targetId, deterministicKey }
 *     → LuluScannerSystem._executeScan()
 *         → CelestialRegistry.getById(uuid) → position + userData
 *         → PersistenceSystem.getScar(deterministicKey) → scar record
 *         → mutación textContent en nodos cacheados
 *         → panel.classList.add('is-active')
 */

import { Registry } from '../core/ServiceRegistry.js';

const OPEN_SCAN_SIGNAL    = 'PG:UI:OPEN_LULU_SCAN';
const CONTEXT_CHANGED_SIG = 'PG:INPUT:CONTEXT_CHANGED';

// ── Constantes de estado de integridad ───────────────────────────────────────
const INTEGRITY_PRISTINE    = 'PRISTINE · 100%';
const INTEGRITY_COMPROMISED = 'COMPROMETIDA · CICATRICES DETECTADAS';
const INTEGRITY_UNKNOWN     = 'DESCONOCIDA';

export class LuluScannerSystem {
    constructor() {
        this.phase    = 'ui';
        this.isActive = false;

        // Nodos de texto pre-cacheados — cero querySelector en caliente
        this.nodes = null;
        this.panel = null;

        // Signal unsub handles
        this._removeScanListener    = null;
        this._removeContextListener = null;
        this._removeRefreshListener = null;

        // Último payload escaneado (para getDebugState y auto-refresh)
        this._lastScanKey  = null;
        this._lastTargetId = null;

        this._buildDOM();
        this._initSignalListeners();
    }

    // ── Ciclo de vida ─────────────────────────────────────────────────────────

    /**
     * Stub requerido por UniverseKernel._mountUI()
     * El DOM real se construye en el constructor (LEY 8).
     */
    init() {
        return this;
    }

    getDebugState() {
        return {
            isActive:     this.isActive,
            lastScanKey:  this._lastScanKey,
            lastTargetId: this._lastTargetId,
        };
    }

    destroy() {
        this._removeScanListener?.();
        this._removeContextListener?.();
        this._removeRefreshListener?.();
        this.panel?.remove();
    }

    // ── Construcción DOM (única instancia) ────────────────────────────────────

    _buildDOM() {
        this.panel = document.createElement('div');
        this.panel.id        = 'lulu-scanner-panel';
        this.panel.className = 'lulu-scanner-panel';
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-label', 'LULU Ontology Scanner');

        // innerHTML una sola vez — nunca se vuelve a llamar
        this.panel.innerHTML = `
            <header class="lsp-header">
                <span class="lsp-title">
                    <span class="lsp-icon" aria-hidden="true">◈</span>
                    LULU <span class="lsp-title-sub">// ONTOLOGY_SCAN</span>
                </span>
                <button class="lsp-close" id="lsp-close-btn" aria-label="Cerrar escáner" data-action="close">✕</button>
            </header>

            <div class="lsp-scan-bar" aria-hidden="true">
                <div class="lsp-scan-sweep"></div>
            </div>

            <section class="lsp-body" aria-live="polite">
                <div class="lsp-row">
                    <span class="lsp-label">CLAVE</span>
                    <span class="lsp-value" id="lsp-key">···</span>
                </div>
                <div class="lsp-row">
                    <span class="lsp-label">APP_NAME</span>
                    <span class="lsp-value" id="lsp-app">···</span>
                </div>
                <div class="lsp-row">
                    <span class="lsp-label">CLASS</span>
                    <span class="lsp-value" id="lsp-type">···</span>
                </div>
                <div class="lsp-row">
                    <span class="lsp-label">COORDS</span>
                    <span class="lsp-value lsp-monospace" id="lsp-coords">···</span>
                </div>
                <div class="lsp-row">
                    <span class="lsp-label">INTEGRIDAD</span>
                    <span class="lsp-value lsp-integrity" id="lsp-integrity">···</span>
                </div>
                <div class="lsp-row lsp-scar-row" id="lsp-scar-row" hidden>
                    <span class="lsp-label">CICATRIZ</span>
                    <span class="lsp-value lsp-monospace" id="lsp-scar">···</span>
                </div>
            </section>

            <footer class="lsp-footer">
                <span class="lsp-footer-tag">OMEGA V31 · TACTICAL OS</span>
            </footer>
        `;

        // Cachear nodos — cero allocations en _executeScan
        this.nodes = {
            key:        this.panel.querySelector('#lsp-key'),
            app:        this.panel.querySelector('#lsp-app'),
            type:       this.panel.querySelector('#lsp-type'),
            coords:     this.panel.querySelector('#lsp-coords'),
            integrity:  this.panel.querySelector('#lsp-integrity'),
            scarRow:    this.panel.querySelector('#lsp-scar-row'),
            scar:       this.panel.querySelector('#lsp-scar'),
        };

        // Click-outside y botón de cierre — delegación única
        this.panel.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'close') {
                this.closeScan();
            }
        });

        // Anclaje a #hud-layer (siempre existe en index.html)
        const hudLayer = document.getElementById('hud-layer');
        if (hudLayer) {
            hudLayer.appendChild(this.panel);
        } else {
            // Fallback robusto — no debería ocurrir
            document.body.appendChild(this.panel);
        }
    }

    // ── Señales ───────────────────────────────────────────────────────────────

    _initSignalListeners() {
        const tryBind = () => {
            const rs = Registry.tryGet('RuntimeSignals');
            if (!rs) return false;

            this._removeScanListener = rs.on(OPEN_SCAN_SIGNAL, (payload) => {
                const detail = payload?.detail ?? payload ?? {};
                this._executeScan(
                    detail.targetId        ?? null,
                    detail.deterministicKey ?? null,
                );
            });

            // Auto-refresh: when INJ writes a scar, refresh if this panel shows that target
            this._removeRefreshListener = rs.on('PG:UI:LULU_SCAN_REFRESH_REQUESTED', (payload) => {
                const detail   = payload?.detail ?? payload ?? {};
                const targetId = detail.targetId ?? null;
                if (this.isActive && (targetId === this._lastTargetId || !targetId)) {
                    this._executeScan(this._lastTargetId, this._lastScanKey);
                }
            });

            // Autocierre en HELM (vuelo inmersivo con Pointer Lock)
            this._removeContextListener = rs.on(CONTEXT_CHANGED_SIG, (ctx) => {
                const context = (typeof ctx === 'string') ? ctx : (ctx?.detail ?? ctx?.context ?? '');
                if (context === 'HELM' && this.isActive) {
                    this.closeScan();
                }
            });

            return true;
        };

        if (!tryBind()) {
            const t = setInterval(() => { if (tryBind()) clearInterval(t); }, 120);
        }
    }

    // ── Lógica de escaneo ─────────────────────────────────────────────────────

    /**
     * Resuelve los datos de la masa y muta los nodos de texto.
     * Zero-GC: sin createElement, sin innerHTML, sin querySelector.
     *
     * @param {string|null} targetId         UUID del objeto THREE.js
     * @param {string|null} deterministicKey Clave de persistencia
     */
    _executeScan(targetId, deterministicKey) {
        // ── 1. Resolver objeto 3D desde CelestialRegistry ────────────────────
        const celestialRegistry =
            Registry.tryGet('CelestialRegistry') ??
            Registry.tryGet('celestialRegistry');

        const massObject = targetId
            ? (celestialRegistry?.getById?.(targetId) ?? null)
            : null;

        const userData = massObject?.userData ?? {};
        const pos      = massObject?.position ?? null;

        // Usar deterministicKey del payload; fallback al userData del objeto
        const scarKey = deterministicKey ?? userData.deterministicKey ?? null;

        // ── 2. Mutación Zero-GC ───────────────────────────────────────────────
        this.nodes.key.textContent  = scarKey                    ?? userData.deterministicKey ?? 'UNKNOWN_ORBITAL';
        this.nodes.app.textContent  = userData.appName           ?? userData.label            ?? 'MASA_NO_CLASIFICADA';
        this.nodes.type.textContent = userData.nodeType          ?? userData.osType           ?? 'ANOMALÍA';

        if (pos) {
            this.nodes.coords.textContent =
                `X:${pos.x.toFixed(1)}  Y:${pos.y.toFixed(1)}  Z:${pos.z.toFixed(1)}`;
        } else {
            this.nodes.coords.textContent = 'VECTOR NO DISPONIBLE';
        }

        // ── 3. Estado de cicatriz desde PersistenceSystem ────────────────────
        const persistence = Registry.tryGet('PersistenceSystem') ??
                            Registry.tryGet('persistenceSystem');

        const scar = (scarKey && persistence)
            ? persistence.getScar(scarKey)
            : null;

        if (scar) {
            this.nodes.integrity.textContent = INTEGRITY_COMPROMISED;
            this.nodes.integrity.dataset.state = 'compromised';

            // Mostrar fila de cicatriz con label + fecha
            const scarDate = scar.recordedAt
                ? new Date(scar.recordedAt).toISOString().slice(0, 10)
                : '??-??-??';
            this.nodes.scar.textContent = `${scar.label ?? 'PAYLOAD_DESCONOCIDO'} · ${scarDate}`;
            this.nodes.scarRow.hidden   = false;
        } else if (!scarKey) {
            this.nodes.integrity.textContent   = INTEGRITY_UNKNOWN;
            this.nodes.integrity.dataset.state = 'unknown';
            this.nodes.scarRow.hidden          = true;
        } else {
            this.nodes.integrity.textContent   = INTEGRITY_PRISTINE;
            this.nodes.integrity.dataset.state = 'pristine';
            this.nodes.scarRow.hidden          = true;
        }

        // ── 4. Mostrar panel ──────────────────────────────────────────────────
        this._lastScanKey  = scarKey;
        this._lastTargetId = targetId;
        this.panel.classList.add('is-active');
        this.isActive = true;
    }

    /**
     * Oculta el panel sin destruir el DOM.
     */
    closeScan() {
        this.panel.classList.remove('is-active');
        this.isActive = false;
    }
}

export default LuluScannerSystem;
