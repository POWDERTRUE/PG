import { LULUInfoChip } from './LULUInfoChip.js';

/**
 * LULUContextualHUD.js — OMEGA V30
 * Makes LULU reactive to the universe: hover tooltips, auto-narration on approach,
 * and solar system welcome message.
 */
export class LULUContextualHUD {
    constructor(kernel, responsePanel) {
        this.kernel        = kernel;
        this.responsePanel = responsePanel;
        this._chip         = new LULUInfoChip();
        this._lastHovered  = null;
        this._solarWelcome = false;
        this._descentPhase = -1;
    }

    init() {
        this._chip.init();
        this._bindHoverEvents();
        this._bindDescentEvents();
        this._bindEntranceDetection();
        console.log('[LULUContextualHUD] Contextual awareness online.');
    }

    // ── Hover Chip ────────────────────────────────────────────────────────────

    _bindHoverEvents() {
        window.addEventListener('INTERACTION:HOVER_UPDATE', (e) => {
            const obj = e.detail?.object ?? e.detail?.target ?? null;
            if (!obj) { this._chip.hide(); this._lastHovered = null; return; }

            const ud = obj.userData ?? {};
            if (!ud.nodeType && !ud.isApp) { this._chip.hide(); return; }

            if (obj === this._lastHovered) return;
            this._lastHovered = obj;

            this._chip.show({
                name:        obj.name,
                nodeType:    ud.nodeType,
                planetClass: ud.planetClass,
                bodyProfile: ud.bodyProfile,
            });
        });

        // Also hide chip if pointer moves far from any target
        window.addEventListener('mousemove', () => {
            if (!this._lastHovered) this._chip.hide();
        });
    }

    // ── Descent narration ─────────────────────────────────────────────────────

    _bindDescentEvents() {
        window.addEventListener('DESCENT_ALTITUDE', (e) => {
            const { altitude, planetRadius } = e.detail ?? {};
            if (altitude == null || !planetRadius) return;

            const ratio  = altitude / (planetRadius * 2);
            const phase  = Math.floor((1 - Math.min(ratio, 1)) * 4); // 0–4

            if (phase === this._descentPhase) return;
            this._descentPhase = phase;

            const phrases = [
                ['Descendiendo hacia la superficie…',    'system'],
                ['Atmósfera detectable. Ajustando trayectoria.', 'info'],
                ['Superficie en rango visual. Velocidad reducida.', 'info'],
                ['Aproximación final. Modo aterrizaje activo.', 'success'],
            ];
            if (phrases[phase]) {
                this.responsePanel.log(...phrases[phase]);
            }
        });

        window.addEventListener('LANDING_COMPLETE', (e) => {
            const planet = e.detail?.planet;
            const name   = planet?.userData?.appName ?? planet?.name ?? 'planeta';
            this.responsePanel.log(`Aterrizaje en ${name} completado.`, 'success');
            this._descentPhase = -1;
        });
    }

    // ── Solar system entrance ─────────────────────────────────────────────────

    _bindEntranceDetection() {
        // Check every 2s if camera crossed threshold into the solar system
        this._entranceTimer = setInterval(() => {
            if (this._solarWelcome) return;
            const cam = this.kernel?.camera;
            if (!cam) return;
            const d = cam.position.length();
            if (d < 450) {
                this._solarWelcome = true;
                this._greetSolarSystem();
                clearInterval(this._entranceTimer);
            }
        }, 2000);
    }

    _greetSolarSystem() {
        this.responsePanel.log('Bienvenido al sistema Sol.', 'system');
        this.responsePanel.log('6 planetas activos. Usa "navegar a [planeta]" para orientarte.', 'info');
        this.responsePanel.log('Temperatura solar: 5778K | Tipo G2V.', 'info');
    }

    dispose() {
        clearInterval(this._entranceTimer);
        this._chip.hide();
    }
}
