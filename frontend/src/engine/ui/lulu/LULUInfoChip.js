/**
 * LULUInfoChip.js — OMEGA V30
 * Floating tooltip that appears near the cursor when hovering a celestial body.
 * Follows the mouse, fades in/out on hover events.
 */
export class LULUInfoChip {
    constructor() {
        this._el      = null;
        this._visible = false;
        this._mx      = 0;
        this._my      = 0;
    }

    init() {
        this._injectStyles();
        this._el = document.createElement('div');
        this._el.id = 'lulu-info-chip';
        this._el.style.opacity = '0';
        document.body.appendChild(this._el);

        window.addEventListener('mousemove', (e) => {
            this._mx = e.clientX;
            this._my = e.clientY;
            if (this._visible) this._placeAt(e.clientX, e.clientY);
        });
    }

    show(data) {
        if (!this._el) return;
        const { name, nodeType, planetClass, bodyProfile } = data;

        const icon  = this._iconFor(nodeType, planetClass);
        const label = name?.replace('Planet_','').replace('MegaSun','Sol') ?? '—';
        const cls   = planetClass ?? nodeType ?? '—';

        let rows = `<div class="lic-header">${icon}&nbsp;${label}</div>`;
        rows += `<div class="lic-row"><span>Tipo</span><span>${cls}</span></div>`;

        if (bodyProfile) {
            if (bodyProfile.temperatureK)  rows += `<div class="lic-row"><span>Temp</span><span>${bodyProfile.temperatureK}K</span></div>`;
            if (bodyProfile.gravityG)      rows += `<div class="lic-row"><span>G</span><span>${bodyProfile.gravityG}g</span></div>`;
            if (bodyProfile.atmosphere)    rows += `<div class="lic-row"><span>Atm</span><span>${bodyProfile.atmosphere}</span></div>`;
        }

        this._el.innerHTML = rows;
        this._el.style.opacity  = '1';
        this._el.style.transform = 'translateY(0)';
        this._placeAt(this._mx, this._my);
        this._visible = true;
    }

    hide() {
        if (!this._el) return;
        this._el.style.opacity  = '0';
        this._el.style.transform = 'translateY(6px)';
        this._visible = false;
    }

    _placeAt(x, y) {
        const el = this._el;
        const W  = el.offsetWidth  || 190;
        const H  = el.offsetHeight || 100;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const left = Math.min(x + 16, vw - W - 8);
        const top  = y + 20 + H > vh ? y - H - 12 : y + 20;
        el.style.left = `${left}px`;
        el.style.top  = `${top}px`;
    }

    _iconFor(nodeType, planetClass) {
        if (nodeType === 'star')    return '⭐';
        if (nodeType === 'moon')    return '🌙';
        if (nodeType === 'satellite') return '📡';
        const icons = { volcanic: '🌋', desert: '🏜', ocean: '🌊', ice: '❄', gas_giant: '🪐', jungle: '🌿' };
        return icons[planetClass] ?? '🪐';
    }

    _injectStyles() {
        if (document.getElementById('lulu-chip-styles')) return;
        const s = document.createElement('style');
        s.id = 'lulu-chip-styles';
        s.textContent = `
            #lulu-info-chip {
                position: fixed;
                z-index: 99999;
                pointer-events: none;
                font-family: "Inter", "Segoe UI", monospace;
                font-size: 12px;
                background: rgba(0, 6, 18, 0.82);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(0,255,204,0.28);
                border-radius: 10px;
                padding: 10px 14px;
                min-width: 160px;
                max-width: 220px;
                box-shadow: 0 4px 20px rgba(0,255,204,0.10);
                transition: opacity 0.18s ease, transform 0.18s ease;
                transform: translateY(6px);
                color: #c8fff5;
            }
            .lic-header {
                font-size: 13px;
                font-weight: 700;
                color: #00ffcc;
                text-shadow: 0 0 8px rgba(0,255,204,0.5);
                margin-bottom: 6px;
                letter-spacing: 0.5px;
            }
            .lic-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
                gap: 8px;
            }
            .lic-row span:first-child { color: rgba(0,255,204,0.55); }
            .lic-row span:last-child  { color: #e0fff8; text-align: right; }
        `;
        document.head.appendChild(s);
    }
}
