import { LULUCommands } from './LULUCommandRegistry.js';
import { normalizeLuluText } from './LULUCanon.js';

const CATEGORY_ICON = {
    nav:    '🗺',
    create: '🪐',
    scan:   '📡',
    docs:   '📖',
    voice:  '🔊',
    info:   'ℹ',
};

export class LULUCommandPalette {
    constructor(input) {
        this.input    = input;
        this.panel    = null;
        this._items   = [];
        this._cursor  = -1;
    }

    init() {
        this._injectStyles();

        this.panel = document.createElement('div');
        this.panel.id = 'lulu-palette';
        const targetLayer = document.getElementById('window-layer') || document.body;
        targetLayer.appendChild(this.panel);

        this.input.addEventListener('input', () => {
            const v = this.input.value.trim();
            v ? this.update(v) : this.hide();
        });
        this.input.addEventListener('blur', () => {
            setTimeout(() => this.hide(), 160);
        });
        this.input.addEventListener('focus', () => {
            if (this.input.value.trim()) this.update(this.input.value);
        });
    }

    update(text) {
        this.panel.innerHTML = '';
        this._items   = [];
        this._cursor  = -1;
        const query = normalizeLuluText(text);

        const results = LULUCommands.filter(cmd => {
            const n = normalizeLuluText(cmd.name);
            const d = normalizeLuluText(cmd.description || '');
            return n.includes(query) || d.includes(query);
        }).slice(0, 9);

        if (!results.length) { this.hide(); return; }

        this.panel.style.display = 'block';

        results.forEach((cmd, idx) => {
            const item = document.createElement('div');
            item.className = 'lulu-palette-item';
            item.dataset.idx = idx;

            const icon = CATEGORY_ICON[cmd.category] ?? '›';
            const highlighted = this._highlight(cmd.name, query);

            item.innerHTML = `
                <span class="lp-icon">${icon}</span>
                <span class="lp-name">${highlighted}</span>
                <span class="lp-desc">${cmd.description}</span>
            `;

            item.addEventListener('mouseenter', () => this._setCursor(idx));
            item.addEventListener('click', () => {
                this.input.value = cmd.name;
                this.hide();
                this.input.focus();
            });

            this.panel.appendChild(item);
            this._items.push(item);
        });
    }

    _highlight(name, query) {
        if (!query) return name;
        const idx = normalizeLuluText(name).indexOf(query);
        if (idx === -1) return name;
        return name.slice(0, idx)
            + `<strong>${name.slice(idx, idx + query.length)}</strong>`
            + name.slice(idx + query.length);
    }

    hide() {
        if (this.panel) this.panel.style.display = 'none';
        this._cursor = -1;
    }

    selectNext() {
        this._setCursor(Math.min(this._cursor + 1, this._items.length - 1));
    }

    selectPrev() {
        this._setCursor(Math.max(this._cursor - 1, 0));
    }

    acceptSelected(input) {
        if (this._cursor >= 0 && this._items[this._cursor]) {
            input.value = LULUCommands[this._cursor]?.name ?? input.value;
            this.hide();
        }
    }

    _setCursor(idx) {
        this._items.forEach((el, i) => el.classList.toggle('lp-active', i === idx));
        this._cursor = idx;
    }

    _injectStyles() {
        if (document.getElementById('lulu-palette-styles')) return;
        const s = document.createElement('style');
        s.id = 'lulu-palette-styles';
        s.textContent = `
            #lulu-palette {
                display: none;
                position: fixed;
                bottom: 68px;
                left: 20px;
                width: 440px;
                background: rgba(0, 6, 18, 0.88);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(0, 255, 204, 0.22);
                border-bottom: none;
                border-radius: 14px 14px 0 0;
                overflow: hidden;
                z-index: 10001;
                box-shadow: 0 -4px 24px rgba(0,255,204,0.07);
                font-family: "Inter", "Segoe UI", monospace;
            }
            .lulu-palette-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 9px 14px;
                cursor: pointer;
                border-bottom: 1px solid rgba(0,255,204,0.08);
                transition: background 0.1s;
            }
            .lulu-palette-item:last-child { border-bottom: none; }
            .lulu-palette-item:hover, .lp-active {
                background: rgba(0,255,204,0.09) !important;
            }
            .lp-icon  { font-size: 15px; min-width: 22px; text-align: center; }
            .lp-name  { color: #e0fff8; font-size: 13px; flex: 1; }
            .lp-name strong { color: #00ffcc; }
            .lp-desc  {
                color: rgba(0,255,204,0.42);
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 160px;
            }
        `;
        document.head.appendChild(s);
    }
}
