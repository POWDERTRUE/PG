import { Registry } from '../core/ServiceRegistry.js';

const TACTICAL_READOUT_SIGNAL = 'PG:OS:TACTICAL_READOUT_REQUESTED';
const CLEAR_TACTICAL_READOUT_SIGNAL = 'PG:OS:CLEAR_TACTICAL_READOUT';
const TACTICAL_SCAN_SIGNAL = 'PG:OS:TACTICAL_SCAN_REQUESTED';
const DISENGAGE_AUTO_BRAKE_SIGNAL = 'PG:NAV:DISENGAGE_AUTO_BRAKE';
const IMAGE_PAYLOAD_TYPE = 'IMAGE';

export class TacticalReadoutSystem {
    constructor() {
        this.phase = 'ui';
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.celestialRegistry = Registry.tryGet('CelestialRegistry') ?? Registry.tryGet('celestialRegistry');
        this.persistenceSystem = Registry.tryGet('PersistenceSystem');
        this.payloadManager = Registry.tryGet('PayloadManager');

        this.container = null;
        this.nameNode = null;
        this.typeNode = null;
        this.keyNode = null;
        this.payloadNode = null;
        this.scanNode = null;

        this.activeTargetId = null;
        this.activeDeterministicKey = null;

        this._removeReadoutListener = null;
        this._removeClearListener = null;
        this._removeScanListener = null;
        this._removeDisengageListener = null;
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.celestialRegistry = this.celestialRegistry || Registry.tryGet('CelestialRegistry') || Registry.tryGet('celestialRegistry');
        this.persistenceSystem = this.persistenceSystem || Registry.tryGet('PersistenceSystem');
        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');

        this._buildDOM();

        if (this.runtimeSignals?.on) {
            this._removeReadoutListener = this.runtimeSignals.on(
                TACTICAL_READOUT_SIGNAL,
                (detail) => this._openReadout(detail)
            );
            this._removeMacroSelectListener = this.runtimeSignals.on(
                'PG:OS:MACRO_TARGET_SELECTED',
                (detail) => this._openMacroReadout(detail)
            );
            this._removeClearListener = this.runtimeSignals.on(
                CLEAR_TACTICAL_READOUT_SIGNAL,
                () => this.clear()
            );
            this._removeScanListener = this.runtimeSignals.on(
                TACTICAL_SCAN_SIGNAL,
                (detail) => this._scanTarget(detail)
            );
            this._removeDisengageListener = this.runtimeSignals.on(
                DISENGAGE_AUTO_BRAKE_SIGNAL,
                () => this.clear()
            );
        }
    }

    dispose() {
        this._removeReadoutListener?.();
        this._removeReadoutListener = null;
        this._removeClearListener?.();
        this._removeClearListener = null;
        this._removeScanListener?.();
        this._removeScanListener = null;
        this._removeDisengageListener?.();
        this._removeDisengageListener = null;
        this.container?.remove();
        this.container = null;
    }

    getDebugState() {
        return {
            visible: !!this.container && !this.container.classList.contains('hidden'),
            targetId: this.activeTargetId,
            deterministicKey: this.activeDeterministicKey,
            name: this.nameNode?.textContent ?? '',
        };
    }

    _buildDOM() {
        const host = document.getElementById('hud-layer') || document.body;
        document.getElementById('omega-tactical-readout')?.remove();

        this.container = document.createElement('aside');
        this.container.id = 'omega-tactical-readout';
        this.container.className = 'omega-tactical-readout hidden';
        this.container.innerHTML = `
            <div class="tactical-readout-header">
                <span class="tactical-readout-kicker">TACTICAL READOUT</span>
                <span class="tactical-readout-status">ENLACE ESTABLE</span>
            </div>
            <div class="tactical-readout-name">Sin objetivo</div>
            <div class="tactical-readout-grid">
                <div class="tactical-readout-row">
                    <span class="tactical-readout-label">TIPO</span>
                    <span class="tactical-readout-value" data-field="type">-</span>
                </div>
                <div class="tactical-readout-row">
                    <span class="tactical-readout-label">CLAVE</span>
                    <span class="tactical-readout-value" data-field="key">-</span>
                </div>
                <div class="tactical-readout-row">
                    <span class="tactical-readout-label">CICATRIZ</span>
                    <span class="tactical-readout-value" data-field="payload">NINGUNA</span>
                </div>
                <div class="tactical-readout-row">
                    <span class="tactical-readout-label">SCAN</span>
                    <span class="tactical-readout-value" data-field="scan">CLICK DERECHO</span>
                </div>
            </div>
        `;

        this.nameNode = this.container.querySelector('.tactical-readout-name');
        this.typeNode = this.container.querySelector('[data-field="type"]');
        this.keyNode = this.container.querySelector('[data-field="key"]');
        this.payloadNode = this.container.querySelector('[data-field="payload"]');
        this.scanNode = this.container.querySelector('[data-field="scan"]');
        host.appendChild(this.container);
    }

    _openReadout(detail = {}) {
        const targetObject = this._resolveTarget(detail.targetId);
        const userData = detail.massData ?? targetObject?.userData ?? {};
        const deterministicKey = detail.deterministicKey || userData?.deterministicKey || null;
        const scar = deterministicKey ? this.persistenceSystem?.getScar?.(deterministicKey) ?? null : null;
        const activePayload = this.payloadManager?.getActivePayload?.(IMAGE_PAYLOAD_TYPE) ?? null;

        this.activeTargetId = detail.targetId ?? targetObject?.uuid ?? null;
        this.activeDeterministicKey = deterministicKey;

        const name =
            detail.name ||
            userData?.appName ||
            userData?.label ||
            targetObject?.name ||
            'Anomalia desconocida';
        const type =
            userData?.planetClass ||
            userData?.nodeType ||
            userData?.spatialType ||
            (userData?.isApp ? 'app-mass' : userData?.isMass ? 'celestial-body' : 'objeto');

        this.nameNode.textContent = String(name).toUpperCase();
        this.typeNode.textContent = String(type).toUpperCase();
        this.keyNode.textContent = deterministicKey || 'VOLATIL';
        this.payloadNode.textContent = scar?.payloadLabel || scar?.url || activePayload?.label || 'NINGUNA';
        this.scanNode.textContent = scar ? 'CICATRIZ DETECTADA' : 'LISTO';

        this.container.classList.remove('hidden');
        this.container.classList.add('active');
    }

    _generateMacroTelemetry(starIndex) {
        // Linear Congruential Generator (LCG) Zero-GC Determinístico
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        
        let seed = starIndex + 12345;
        const rand = () => {
            seed = (a * seed + c) % m;
            return seed / m;
        };
        
        const r1 = rand();
        const r2 = rand();
        const r3 = rand();
        
        const prefixes = ['ALPHA', 'SIGMA', 'TAU', 'ORION', 'KEPLER', 'ZETA', 'HYDRA', 'ERIDANUS', 'OMEGA', 'SIRIUS'];
        const types = ['ENANA ROJA M', 'GIGANTE AZUL O', 'ESTRELLA AMARILLA G', 'ENANA BLANCA', 'PULSAR MASIVO'];
        const temp = Math.floor(r3 * 40000 + 2000);
        
        return {
            name: `${prefixes[Math.floor(r1 * prefixes.length)]}-${starIndex}`,
            type: types[Math.floor(r2 * types.length)],
            key: `MACRO_STAR_${starIndex}`,
            scanInfo: `${temp}K TEMPERATURA`
        };
    }

    _openMacroReadout(detail) {
        const { index } = detail;
        const { name, type, key, scanInfo } = this._generateMacroTelemetry(index);

        this.activeTargetId = index;
        this.activeDeterministicKey = key;

        this.nameNode.textContent = name;
        this.typeNode.textContent = type;
        this.keyNode.textContent = key;
        this.payloadNode.textContent = "ESCALA MACRO INMUTABLE";
        this.scanNode.textContent = scanInfo;

        const audio = Registry.tryGet('AudioEngine');
        audio?._playReadout?.();

        this.container.classList.remove('hidden');
        this.container.classList.add('active');
    }

    clear() {
        this.activeTargetId = null;
        this.activeDeterministicKey = null;
        this.container?.classList.remove('active');
        this.container?.classList.add('hidden');
    }

    _scanTarget(detail = {}) {
        const targetObject = this._resolveTarget(detail.targetId);
        const userData = detail.massData ?? targetObject?.userData ?? {};
        const deterministicKey = detail.deterministicKey || userData?.deterministicKey || null;
        const scar = deterministicKey ? this.persistenceSystem?.getScar?.(deterministicKey) ?? null : null;
        const payload = this.payloadManager?.getActivePayload?.(IMAGE_PAYLOAD_TYPE) ?? null;
        const name =
            detail.name ||
            userData?.appName ||
            userData?.label ||
            targetObject?.name ||
            'Anomalia desconocida';
        const type =
            userData?.planetClass ||
            userData?.nodeType ||
            userData?.spatialType ||
            (userData?.isApp ? 'app-mass' : userData?.isMass ? 'celestial-body' : 'objeto');

        const responsePanel =
            Registry.tryGet('LULUResponsePanel') ||
            Registry.tryGet('luluResponse') ||
            window.engine?.luluResponse ||
            null;
        const luluWrap = document.getElementById('lulu-response-wrap');
        if (responsePanel?.open) {
            responsePanel.open();
        } else if (luluWrap && !luluWrap.classList.contains('is-open')) {
            window.dispatchEvent(new Event('PG:UI:REQUEST_LULU_TOGGLE'));
        }

        this.runtimeSignals?.emit?.('PG:UI:PRINT_LULU', {
            text: `[SCAN] :: ${name} | tipo ${type}.`,
        });
        if (deterministicKey) {
            this.runtimeSignals?.emit?.('PG:UI:PRINT_LULU', {
                text: `[SCAN] :: Clave determinista ${deterministicKey}.`,
            });
        }
        this.runtimeSignals?.emit?.('PG:UI:PRINT_LULU', {
            text: scar
                ? `[SCAN] :: Cicatriz persistente detectada: ${scar.payloadLabel || scar.url}.`
                : `[SCAN] :: Sin cicatriz persistente registrada. Payload activo: ${payload?.label || 'NINGUNO'}.`,
        });
    }

    _resolveTarget(targetId) {
        if (!targetId) {
            return null;
        }
        return (
            this.celestialRegistry?.getById?.(targetId) ??
            Registry.tryGet('scene')?.getObjectByProperty?.('uuid', targetId) ??
            null
        );
    }
}

export default TacticalReadoutSystem;
