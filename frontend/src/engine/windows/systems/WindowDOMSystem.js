import { Registry } from '../../core/ServiceRegistry.js';

/**
 * WindowDOMSystem V28-REFINED OMEGA — Production
 * - Bug 6: DOM is FULLY BLOCKED until kernel:universe_ready fires
 * - Windows open ONLY on nav:arrival (after cinematic warp completes)
 * - Holographic boot animation: scale 0.85 → 1.0 + opacity fade
 * - Per-app content registered
 * - EventBus aliases: UI:OPEN_APP, OPEN_APP
 * - No innerHTML thrashing after initial creation
 */
export class WindowDOMSystem {
    static phase = 'workspace';

    constructor(services) {
        this.services  = services;
        this.registry  = Registry.get('registry');
        this.container = null;
        this.windows   = new Map();
        this._ready    = false; // Bug 6: gate
    }

    init() {
        const events = Registry.get('events');
        if (!events) return;

        // Bug 6: Mount only post-universe-ready
        events.on('kernel:universe_ready', () => {
            const k = Registry.get('kernel');
            this.container = k?.config?.labelContainer
                           || document.getElementById('label-layer')
                           || document.getElementById('window-layer')
                           || document.body;
            this._ready = true;
            console.log('[WindowDOM] Viewport Layer mounted.');
        });

        // Primary: open on nav:arrival (post-warp) — Bug 6 order
        events.on('nav:arrival', data => this._onArrival(data));

        // Modular window aliases
        events.on('modular-window:open', data => this._openById(data?.id || data?.app));
        events.on('modular-window:close', data => this.removeWindow(data?.id));

        // Legacy aliases
        events.on('UI:OPEN_APP', data => this._openById(data?.id || data?.app));
        events.on('OPEN_APP',    data => this._openById(data?.app));
    }

    _onArrival(data) {
        if (!data?.id) return;
        this._openById(data.id, data.name);
    }

    _openById(id, title) {
        if (!id) return;
        const wid = `app_${id}`;
        if (this.windows.has(wid)) { this._focusWindow(wid); return; }

        this.createDOMWindow(null, wid, {
            title:   title || id.charAt(0).toUpperCase() + id.slice(1),
            width:   620,
            height:  420,
            content: this._buildContent(id),
            zIndex:  1000
        });
    }

    createDOMWindow(entity, id, cfg) {
        if (!this._ready) {
            // Queue until ready
            const events = Registry.get('events');
            events?.once('kernel:universe_ready', () => this.createDOMWindow(entity, id, cfg));
            return null;
        }

        const el     = document.createElement('div');
        el.id        = `win-${id}`;
        el.className = 'os-window modular-window glass-window';
        el.setAttribute('data-window-type', 'modular');
        el.setAttribute('data-ui-label', 'ventana modular');
        const groupId = cfg.groupId || 'default';
        el.setAttribute('data-group-id', groupId);

        el.style.cssText = `
            width:${cfg.width || 560}px;height:${cfg.height || 380}px;
            z-index:${cfg.zIndex || 100};position:absolute;
            top:50%;left:50%;
            transform:translate(-50%,-50%) scale(0.88);
            opacity:0;
            min-width:320px; min-height:220px;
            max-width:calc(100vw - 40px); max-height:calc(100vh - 40px);
        `;

        el.innerHTML = `
            <div class="os-window-header modular-window-header">
                <div class="os-window-controls modular-window-controls">
                    <div class="window-btn close"  data-action="close"></div>
                    <div class="window-btn min"    data-action="minimize"></div>
                    <div class="window-btn max"    data-action="maximize"></div>
                </div>
                <div class="os-window-title modular-window-title">${cfg.title || 'App'}</div>
            </div>
            <div class="os-window-content modular-window-content">${cfg.content || ''}</div>
        `;

        el.querySelector('[data-action="close"]').addEventListener('click', () => this.removeWindow(id));
        el.querySelector('[data-action="minimize"]').addEventListener('click', () => {
            el.style.transition = 'all 0.35s cubic-bezier(0.16,1,0.3,1)';
            el.style.transform  = 'translate(-50%,-50%) scale(0.08)';
            el.style.opacity    = '0';
        });
        el.querySelector('[data-action="maximize"]').addEventListener('click', () => {
            el.style.transition = 'all 0.45s cubic-bezier(0.16,1,0.3,1)';
            el.style.width  = '100vw'; el.style.height = '100vh';
            el.style.top    = '0';    el.style.left   = '0';
            el.style.transform = 'none';
        });

        this.container.appendChild(el);
        this.windows.set(id, el);
        this._normalizeModularWindow(el);

        // Tarjet click / evento de interacción modular
        el.addEventListener('click', () => {
            Registry.get('events')?.emit('modular-window:click', { windowId: id, groupId });
        });

        // Holographic boot animation
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 0.45s cubic-bezier(0.16,1,0.3,1), transform 0.45s cubic-bezier(0.16,1,0.3,1)';
            el.style.opacity    = '1';
            el.style.transform  = 'translate(-50%,-50%) scale(1)';
        });

        const em = Registry.get('EntityManager');
        if (em && entity) em.addComponent(entity, 'DOMComponent', { element: el });

        Registry.get('events')?.emit('window:opened', { id, element: el });
        Registry.get('events')?.emit('modular-window:opened', { id, element: el });
        return el;
    }

    _focusWindow(id) {
        const el = this.windows.get(id);
        if (!el) return;
        el.style.zIndex     = '9999';
        el.style.transition = 'transform 0.3s cubic-bezier(0.16,1,0.3,1)';
        el.style.transform  = 'translate(-50%,-50%) scale(1.03)';
        setTimeout(() => { el.style.transform = 'translate(-50%,-50%) scale(1)'; }, 250);
    }

    removeWindow(id) {
        const el = this.windows.get(id);
        if (!el) return;
        el.style.transition = 'all 0.3s cubic-bezier(0.16,1,0.3,1)';
        el.style.opacity    = '0';
        el.style.transform  = 'translate(-50%,-50%) scale(0.88)';
        setTimeout(() => { el.remove(); this.windows.delete(id); }, 320);
    }

    _normalizeModularWindow(el) {
        if (!el) return;

        el.style.boxSizing = 'border-box';
        el.style.minWidth  = '320px';
        el.style.minHeight = '220px';
        el.style.maxWidth  = 'calc(100vw - 32px)';
        el.style.maxHeight = 'calc(100vh - 32px)';
        el.style.overflow  = 'hidden';

        const content = el.querySelector('.os-window-content, .modular-window-content');
        if (content) {
            content.style.overflow = 'auto';
            content.style.minHeight = '160px';
            content.style.maxHeight = 'calc(100vh - 140px)';
            content.style.boxSizing = 'border-box';
            content.style.padding = '16px';
        }

        el.classList.add('modular-window-normalized');
    }

    _buildContent(id) {
        const map = {
            terminal:     `<div style="font-family:'Courier New';color:#00ffcc;padding:18px"><div>OMEGA Terminal v28</div><div style="opacity:.7;margin-top:10px">$ _</div></div>`,
            browser:      `<div style="padding:18px"><input style="width:100%;background:rgba(0,255,255,.08);border:1px solid rgba(0,255,255,.4);border-radius:8px;padding:10px 14px;color:#fff;font:13px/1 Inter,sans-serif;outline:none" placeholder="Search or enter URL…" /></div>`,
            explorer:     `<div style="padding:18px;color:rgba(255,255,255,.8)">🗂 File Explorer — Spatial OS</div>`,
            settings:     `<div style="padding:18px;color:rgba(255,255,255,.8)">⚙️ System Settings — OMEGA V28</div>`,
            artists:      `<div style="padding:18px;color:rgba(255,255,255,.8)">🎨 Artists Database</div>`,
            tattoos:      `<div style="padding:18px;color:rgba(255,255,255,.8)">🖋 Tattoo Gallery</div>`,
            appointments: `<div style="padding:18px;color:rgba(255,255,255,.8)">📅 Appointments</div>`
        };
        return map[id] || `<div style="padding:18px;color:rgba(255,255,255,.8)">${id}</div>`;
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
