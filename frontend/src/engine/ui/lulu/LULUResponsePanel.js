import { Registry } from '../../core/ServiceRegistry.js';

export class LULUResponsePanel {
    constructor() {
        this.panel       = null;
        this.wrap        = null;
        this.input       = null;
        this.maxEntries  = 28;
        this.voiceEngine = null; // set externally
        this.processor   = null; // set externally
        this._typeQueue  = [];
        this._typing     = false;
        this._isOpen     = false;
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this._removeSystemPrintListener = null;
        this._toggleRequest = this._toggleRequest.bind(this);
        this._systemPrintRequest = this._systemPrintRequest.bind(this);
    }

    init() {
        this._injectStyles();
        this._buildDOM();
        this._bindEvents();
    }

    _buildDOM() {
        // ── Anti-duplication guard ─────────────────────────────────────────────
        document.getElementById('lulu-response-wrap')?.remove();

        // ── Outer container ──────────────────────────────────────────────────
        this.wrap = document.createElement('div');
        this.wrap.id = 'lulu-response-wrap';

        // Header label
        const header = document.createElement('div');
        header.id = 'lulu-response-header';
        header.innerHTML = `
            <div class="lulu-header-main">
                <span class="lulu-header-icon">⬡</span>
                <span class="lulu-header-title">LULU // ASTRO LOG</span>
            </div>
            <div class="lulu-header-status">
                <span class="lulu-status-dot"></span>
                <span class="lulu-status-label">ADAPTIVE MODE</span>
            </div>
        `;

        // Glass card (Log)
        this.panel = document.createElement('div');
        this.panel.id = 'lulu-response-panel';

        // Command Bar (Input area)
        const controlArea = document.createElement('div');
        controlArea.id = 'lulu-control-area';
        controlArea.innerHTML = `
            <div id="lulu-quick-chips">
                <button class="lulu-mini-chip" data-cmd="donde estoy">📍</button>
                <button class="lulu-mini-chip" data-cmd="lista de planetas">🪐</button>
                <button class="lulu-mini-chip" data-cmd="scan engine">🔍</button>
                <button class="lulu-mini-chip" data-cmd="rendimiento">📊</button>
            </div>
            <div id="lulu-input-container">
                <div id="lulu-input-prompt">›</div>
                <input
                    type="text"
                    id="lulu-unified-input"
                    placeholder="Escribe un comando..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button id="lulu-unified-mic" title="Comando de voz">
                    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                        <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" opacity=".9"/>
                        <path d="M5 10a7 7 0 0014 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        <line x1="12" y1="20" x2="12" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;

        this.wrap.appendChild(header);
        this.wrap.appendChild(this.panel);
        this.wrap.appendChild(controlArea);
        
        const targetLayer = document.getElementById('window-layer') || document.body;
        targetLayer.appendChild(this.wrap);

        this.input = this.wrap.querySelector('#lulu-unified-input');
        
        // Chips listeners
        this.wrap.querySelectorAll('.lulu-mini-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.processor) this.processor.process(btn.dataset.cmd);
            });
        });
    }

    _bindEvents() {
        // Toggle
        window.addEventListener('PG:UI:REQUEST_LULU_TOGGLE', this._toggleRequest);
        window.addEventListener('PG:TOGGLE_LULU', this._toggleRequest);
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (this.runtimeSignals?.on && !this._removeSystemPrintListener) {
            this._removeSystemPrintListener = this.runtimeSignals.on('PG:UI:PRINT_LULU', this._systemPrintRequest);
        } else {
            window.addEventListener('PG:UI:PRINT_LULU', this._systemPrintRequest);
        }

        // Input
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = this.input.value.trim();
                if (val && this.processor) {
                    this.processor.process(val);
                    this.input.value = '';
                }
            }
            if (e.key === 'Escape') this.close();
        });

        // Mic
        this.wrap.querySelector('#lulu-unified-mic').addEventListener('click', () => {
            if (this.voiceEngine) {
                this.voiceEngine.startListening();
                this.wrap.querySelector('#lulu-unified-mic').classList.add('is-listening');
                setTimeout(() => this.wrap.querySelector('#lulu-unified-mic').classList.remove('is-listening'), 3000);
            }
        });
    }

    _toggleRequest() {
        this._isOpen ? this.close() : this.open();
    }

    _systemPrintRequest(event) {
        const detail = event?.detail || event || {};
        const text = typeof detail?.text === 'string' ? detail.text.trim() : '';
        if (!text) {
            return;
        }
        this.log(text, detail?.type || 'system');
    }

    open() {
        this._isOpen = true;
        this.wrap.classList.add('is-open');
        setTimeout(() => this.input.focus(), 100);
    }

    close() {
        this._isOpen = false;
        this.wrap.classList.remove('is-open');
        this.input.blur();
    }

    _injectStyles() {
        if (document.getElementById('lulu-unified-styles')) return;
        const st = document.createElement('style');
        st.id = 'lulu-unified-styles';
        st.textContent = `
            #lulu-response-wrap {
                position: fixed;
                bottom: 30px;
                left: 20px;
                width: 340px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 0;
                background: linear-gradient(165deg, rgba(0,8,20,0.92) 0%, rgba(0,4,12,0.96) 100%);
                backdrop-filter: blur(32px) saturate(1.8);
                -webkit-backdrop-filter: blur(32px) saturate(1.8);
                border: 1px solid rgba(0,255,204,0.18);
                border-top: 1px solid rgba(0,255,204,0.3);
                border-radius: 18px;
                box-shadow: 0 15px 45px rgba(0,0,0,0.8), 0 0 80px rgba(0,255,204,0.03);
                font-family: 'Inter', 'Segoe UI', monospace;
                transform: translateX(-380px);
                transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
                opacity: 0;
                pointer-events: none;
            }
            #lulu-response-wrap.is-open {
                transform: translateX(0);
                opacity: 1;
                pointer-events: all;
            }

            #lulu-response-header {
                padding: 12px 14px 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(0,255,204,0.08);
            }
            .lulu-header-main { display: flex; align-items: center; gap: 8px; }
            .lulu-header-icon { color: #00ffcc; font-size: 16px; text-shadow: 0 0 10px #00ffcc; }
            .lulu-header-title { font-size: 9px; letter-spacing: 2.5px; color: rgba(0,255,204,0.6); font-weight: 700; text-transform: uppercase; }
            
            .lulu-header-status { display: flex; align-items: center; gap: 6px; }
            .lulu-status-dot { width: 4px; height: 4px; border-radius: 50%; background: #00ffcc; box-shadow: 0 0 6px #00ffcc; animation: luluPulse 2s infinite; }
            .lulu-status-label { font-size: 7.5px; font-weight: 700; color: rgba(0,255,204,0.3); }

            #lulu-response-panel {
                padding: 10px 14px;
                max-height: 240px;
                overflow-y: auto;
                scrollbar-width: none;
                mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
                -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
            }
            #lulu-response-panel::-webkit-scrollbar { display: none; }

            #lulu-control-area {
                padding: 8px 12px 12px;
                border-top: 1px solid rgba(0,255,204,0.08);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            #lulu-quick-chips { display: flex; gap: 4px; }
            .lulu-mini-chip {
                background: rgba(0,255,204,0.05);
                border: 1px solid rgba(0,255,204,0.12);
                border-radius: 8px;
                color: #00ffcc;
                font-size: 10px;
                padding: 3px 6px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .lulu-mini-chip:hover { background: rgba(0,255,204,0.15); border-color: rgba(0,255,204,0.4); }

            #lulu-input-container {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(0,255,204,0.04);
                border: 1px solid rgba(0,255,204,0.14);
                border-radius: 10px;
                padding: 4px 8px 4px 10px;
            }
            #lulu-input-prompt { color: rgba(0,255,204,0.4); font-weight: 700; }
            #lulu-unified-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: #e0fff8;
                font-size: 12.5px;
                font-family: inherit;
            }
            #lulu-unified-input::placeholder { color: rgba(0,255,204,0.2); }

            #lulu-unified-mic {
                background: none;
                border: none;
                color: rgba(0,255,204,0.4);
                cursor: pointer;
                display: flex;
                padding: 4px;
            }
            #lulu-unified-mic:hover { color: #00ffcc; }
            #lulu-unified-mic.is-listening { color: #ff5566; animation: luluMicPulse 1s infinite; }

            .lulu-line { animation: luluFadeIn 0.22s ease both; display: flex; gap: 6px; align-items: baseline; }
            .lulu-line-ts { font-size: 9px; opacity: 0.35; flex-shrink: 0; font-variant-numeric: tabular-nums; margin-top: 1px; }
            .lulu-line-text { flex: 1; line-height: 1.5; font-size: 12px; }

            @keyframes luluPulse { 0%,100% { opacity: 1; scale: 1; } 50% { opacity: 0.3; scale: 0.8; } }
            @keyframes luluMicPulse { 0%,100% { filter: drop-shadow(0 0 2px #ff5566); } 50% { filter: drop-shadow(0 0 10px #ff5566); } }
            @keyframes luluFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        `;
        document.head.appendChild(st);
    }

    log(message, type = 'info') {
        if (!this.panel) return;
        const text = typeof message === 'string' ? message : JSON.stringify(message);
        this._typeQueue.push({ text, type });
        if (!this._typing) this._flushQueue();

        if (this.voiceEngine && type !== 'system' && text.length < 120) {
            this.voiceEngine.speakIfActive(text);
        }
    }

    _flushQueue() {
        if (!this._typeQueue.length) { this._typing = false; return; }
        this._typing = true;
        const { text, type } = this._typeQueue.shift();
        const now  = new Date();
        const ts   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const line = document.createElement('div');
        line.className = 'lulu-line';
        line.style.marginBottom = '5px';
        const tsEl = document.createElement('span');
        tsEl.className  = 'lulu-line-ts';
        tsEl.textContent = ts;
        tsEl.style.color = this._colorForType(type);
        const textEl = document.createElement('span');
        textEl.className = 'lulu-line-text';
        textEl.style.color      = this._colorForType(type);
        textEl.style.textShadow = `0 0 7px ${this._glowForType(type)}`;
        const prefix = this._prefixForType(type);
        let charIndex = 0;
        textEl.textContent = prefix;
        line.appendChild(tsEl);
        line.appendChild(textEl);
        this.panel.appendChild(line);
        this.panel.scrollTop = this.panel.scrollHeight;
        while (this.panel.childElementCount > this.maxEntries) {
            this.panel.firstElementChild?.remove();
        }
        const interval = setInterval(() => {
            if (charIndex < text.length) {
                textEl.textContent = prefix + text.slice(0, ++charIndex);
                this.panel.scrollTop = this.panel.scrollHeight;
            } else {
                clearInterval(interval);
                setTimeout(() => this._flushQueue(), 55);
            }
        }, 13);
    }

    _colorForType(type) {
        return { info: '#00ffcc', success: '#44ff88', error: '#ff4455', warn: '#ffcc44', system: '#4488ff' }[type] ?? '#00ffcc';
    }

    _glowForType(type) {
        return { info: 'rgba(0,255,204,0.35)', success: 'rgba(68,255,136,0.35)', error: 'rgba(255,68,85,0.35)', warn: 'rgba(255,204,68,0.35)', system: 'rgba(68,136,255,0.35)' }[type] ?? 'rgba(0,255,204,0.25)';
    }

    _prefixForType(type) {
        return { info: '› ', success: '✓ ', error: '✗ ', warn: '⚠ ', system: '⬡ ' }[type] ?? '› ';
    }

    clear() {
        if (this.panel) this.panel.innerHTML = '';
        this._typeQueue = [];
        this._typing = false;
    }
}
