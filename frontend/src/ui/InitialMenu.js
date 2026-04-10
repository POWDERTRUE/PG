// frontend/src/ui/InitialMenu.js
import gsap from 'gsap';
import { Registry } from '../engine/core/ServiceRegistry.js';

/**
 * InitialMenu — V30 OMEGA Entry Interface
 *
 * Input Isolation Rules:
 *  - While active: pointer ONLY reaches this overlay (pointer-events block universe)
 *  - Modal open: pointer ONLY reaches modal (menu grid gets pointer-events:none)
 *  - ESC key is consumed here and does NOT propagate to navigation/FSM
 *  - RaycastSelectionSystem is disabled while active, re-enabled on dismiss
 *  - _selecting guard is reset on cancel so the user can retry
 */
export class InitialMenu {
    constructor(kernel) {
        this.kernel = kernel;
        this.runtimeState = kernel?.runtimeState || Registry.tryGet('RuntimeState');
        this.container = document.getElementById('pg-root');
        this.element   = null;
        this.active    = false;
        this.profileLabels = new Map();
        this._selecting    = false;
        this.pointerPresentation = Registry.tryGet('PointerPresentationController') || Registry.tryGet('pointerPresentation');

        // ESC guard: consume ESC while login is showing so it doesn't release pointer lock
        this._onESC = (e) => {
            if (e.key === 'Escape' && this.active) {
                e.stopImmediatePropagation();
                e.preventDefault();
                // If password modal is open → close it
                const modal = this.element?.querySelector('#pg-pass-modal');
                if (modal && modal.style.display !== 'none') {
                    modal.style.display = 'none';
                    this._selecting = false; // allow retry
                    this._clearPasswordPointerIntent();
                    this._restoreMenuPointer();
                }
            }
        };
    }

    render() {
        if (this.active) return;
        this.active = true;
        this.runtimeState?.setLoginActive(true, { source: 'initial-menu:render' });

        document.body.classList.add('init-mode-active');
        this._upsertPointerIntent('initial-menu', {
            kind: 'ui',
            cursor: 'default',
            priority: 320,
            reticleMode: 'hidden',
        });

        // Disable raycasting so 3D objects don't highlight under the menu
        this._setRaycast(false);

        // Consume ESC at capture phase before FreeFlightState sees it
        document.addEventListener('keydown', this._onESC, true);

        this.element = document.createElement('div');
        this.element.id = 'initial-menu-overlay';
        this.element.setAttribute('role', 'dialog');
        this.element.setAttribute('aria-modal', 'true');
        this.element.setAttribute('aria-labelledby', 'pg-menu-title');
        this.element.setAttribute('aria-describedby', 'pg-menu-subtitle');
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 5000; /* Priority Alpha mobile fix */
            opacity: 0;
            pointer-events: auto;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
            padding: max(40px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
        `;

        const items = [
            { id: 'powdertrue', title: 'POWDERTRUE', description: 'Entrada como Dios', color: '#dffaff', featured: true, locked: true },
            { id: 'artistas',   title: 'ARTISTAS',   description: 'Sesion creativa',   color: '#b9e8ff' },
            { id: 'clientes',   title: 'CLIENTES',   description: 'Acceso guiado',     color: '#d9f3ff' },
            { id: 'publico',    title: 'PUBLICO',    description: 'Modo exploracion',  color: '#eef9ff' },
            { id: 'wallpaper',  title: 'FONDO VIVO', description: 'Visual inmersivo',  color: '#f4fbff' },
            { id: 'salir',      title: 'SALIR',      description: 'Cerrar portal',     color: '#f7fbff' }
        ];
        this.profileLabels = new Map(items.map(i => [i.id, i.title]));

        const itemsHTML = items.map(item => `
            <button type="button"
                class="menu-item-glass menu-item-${item.id} ${item.featured ? 'featured' : ''}"
                data-id="${item.id}"
                style="--item-color: ${item.color}">
                <span class="menu-copy">
                    ${item.featured ? '<span class="menu-tier">Entrada como Dios</span>' : ''}
                    <span class="menu-label">${item.title}</span>
                    <span class="menu-meta">${item.description}${item.locked ? ' 🔐' : ''}</span>
                </span>
            </button>
        `).join('');

        this.element.innerHTML = `
            <div class="menu-stage" id="pg-menu-stage" style="margin: auto; max-width: 100%;">
                <div class="menu-container">
                    <div class="menu-header">
                        <h1 class="menu-title" id="pg-menu-title">Seleccionar Perfil</h1>
                        <div class="menu-subtitle" id="pg-menu-subtitle">Entrar al universo</div>
                    </div>
                    <div class="menu-grid" id="pg-menu-grid">
                        ${itemsHTML}
                    </div>
                </div>
            </div>

            <!-- Password modal — position:fixed covers everything including menu items -->
            <div id="pg-pass-modal" style="
                display:none; position:fixed; inset:0; z-index:10000;
                background:rgba(0,0,0,0.82); backdrop-filter:blur(16px);
                align-items:center; justify-content:center; flex-direction:column;"
                role="dialog" aria-modal="true" aria-labelledby="pg-pass-title" aria-describedby="pg-pass-copy">
                <div id="pg-pass-card" style="
                    background:rgba(0,10,20,0.95); border:1px solid rgba(0,255,200,0.35);
                    border-radius:18px; padding:40px 44px; text-align:center;
                    box-shadow:0 0 60px rgba(0,255,200,0.12); min-width:340px;
                    pointer-events:auto;">
                    <div id="pg-pass-copy" style="color:#00ffcc;font-size:11px;letter-spacing:3px;margin-bottom:6px;opacity:0.8;">ACCESO RESTRINGIDO</div>
                    <div id="pg-pass-title" style="color:#fff;font-size:24px;font-weight:700;margin-bottom:22px;letter-spacing:2px;">POWDERTRUE</div>
                    <input id="pg-pass-input" type="password" name="powdertrue-password" aria-label="Contraseña de Powdertrue" placeholder="Contraseña" autocomplete="current-password" spellcheck="false" style="
                        width:100%; padding:13px 18px; border-radius:10px;
                        border:1px solid rgba(0,255,200,0.4); background:rgba(0,20,30,0.85);
                        color:#fff; font-size:15px; outline:none; letter-spacing:3px;
                        box-sizing:border-box; margin-bottom:10px;" />
                    <div id="pg-pass-error" aria-live="polite" style="color:#ff4466;font-size:12px;min-height:18px;margin-bottom:14px;"></div>
                    <div style="display:flex;gap:10px;">
                        <button id="pg-pass-cancel" type="button" style="
                            flex:1; padding:11px; border-radius:9px;
                            border:1px solid rgba(255,255,255,0.15);
                            background:transparent; color:#aaa; cursor:pointer; font-size:13px;">
                            Cancelar
                        </button>
                        <button id="pg-pass-ok" type="button" style="
                            flex:2; padding:11px; border-radius:9px; border:none;
                            background:linear-gradient(135deg,#00ffcc,#0055ff); color:#000;
                            font-weight:800; cursor:pointer; font-size:13px; letter-spacing:1px;">
                            ENTRAR →
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Stable entry: no delayed cards or half-hidden profiles.
        const menuCards = Array.from(this.element.querySelectorAll('.menu-item-glass'));
        this.element.style.opacity = '1';
        gsap.set(menuCards, { autoAlpha: 1, y: 0, clearProps: 'opacity,visibility,transform' });
        gsap.fromTo(
            this.element.querySelector('.menu-container'),
            { autoAlpha: 0, y: 14, scale: 0.992 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'power2.out', clearProps: 'opacity,transform' }
        );

        if (this.kernel.navigationSystem) {
            this.kernel.navigationSystem.enterWallpaperMode?.();
        }

        this._bindEvents();
    }

    // ── Event Binding ───────────────────────────────────────────────────────
    _bindEvents() {
        const items = this.element.querySelectorAll('.menu-item-glass');

        items.forEach(item => {
            item.addEventListener('pointerup', (e) => {
                if (this._selecting) return;
                // Don't fire if the modal is currently showing
                const modal = this.element.querySelector('#pg-pass-modal');
                if (modal && modal.style.display !== 'none') return;

                e.preventDefault();
                e.stopPropagation();

                const id = item.dataset.id;
                if (id === 'powdertrue') {
                    this._showPasswordModal();
                } else {
                    this._handleSelect(id);
                }
            });

            item.addEventListener('mousemove', () => {
                gsap.to(item, { y: -2, duration: 0.18, ease: 'power2.out' });
            });
            item.addEventListener('mouseleave', () => {
                gsap.to(item, { y: 0, duration: 0.22, ease: 'power2.out' });
            });
        });
    }

    // ── Password Modal ──────────────────────────────────────────────────────
    _showPasswordModal() {
        const modal   = this.element.querySelector('#pg-pass-modal');
        const input   = this.element.querySelector('#pg-pass-input');
        const error   = this.element.querySelector('#pg-pass-error');
        const btnOk   = this.element.querySelector('#pg-pass-ok');
        const btnCancel = this.element.querySelector('#pg-pass-cancel');

        // Disable the menu grid so buttons under the modal can't be triggered
        this._lockMenuPointer();

        modal.style.display = 'flex';
        error.textContent = '';
        input.value = '';
        this._upsertPointerIntent('initial-menu-password', {
            kind: 'text',
            cursor: 'text',
            priority: 420,
            reticleMode: 'hidden',
        });
        setTimeout(() => input.focus(), 80);

        // Prevent ALL clicks inside the modal from reaching anything underneath
        modal.onpointerdown = (e) => e.stopPropagation();
        modal.onpointerup = (e) => e.stopPropagation();

        const attempt = () => {
            if (input.value === 'milulu') {
                modal.style.display = 'none';
                this._clearPasswordPointerIntent();
                this._restoreMenuPointer();
                this._handleSelect('powdertrue');
            } else {
                error.textContent = 'Contraseña incorrecta';
                input.value = '';
                input.focus();
                gsap.fromTo(input,
                    { x: -10 },
                    { x: 0, duration: 0.45, ease: 'elastic.out(1,0.3)' }
                );
            }
        };

        // Wire buttons — use onclick to replace any previous handlers
        btnOk.onclick = (e) => { e.stopPropagation(); attempt(); };
        btnCancel.onclick = (e) => {
            e.stopPropagation();
            modal.style.display = 'none';
            this._selecting = false;      // allow retry
            this._clearPasswordPointerIntent();
            this._restoreMenuPointer();
        };
        input.onkeydown = (e) => {
            e.stopPropagation(); // don't let keystrokes reach FSM / nav
            if (e.key === 'Enter') attempt();
        };
    }

    _lockMenuPointer() {
        const grid = this.element?.querySelector('#pg-menu-grid');
        if (grid) grid.style.pointerEvents = 'none';
    }

    _restoreMenuPointer() {
        const grid = this.element?.querySelector('#pg-menu-grid');
        if (grid) grid.style.pointerEvents = 'auto';
    }

    // ── Profile Select ──────────────────────────────────────────────────────
    _handleSelect(id) {
        if (this._selecting) return;
        this._selecting = true;

        if (id === 'salir') {
            gsap.to(document.body, { opacity: 0, duration: 2 });
            return;
        }

        console.log(`%c[Menu] Selected Protocol: ${id.toUpperCase()}`, 'color:#00ffcc;font-weight:bold');
        const role = this.profileLabels.get(id) || id;
        const shouldEnterFlight = id !== 'wallpaper' && !!this.kernel.navigationSystem;

        this.element.style.pointerEvents = 'none';

        if (shouldEnterFlight) {
            const nav = this.kernel.navigationSystem;
            const rig = this.kernel.cameraRig;
            if (rig) {
                const lookTarget = new rig.position.constructor(0, 0, 0);
                rig.position.set(520, 10800, 4600);
                if (typeof nav._computeLookQuaternion === 'function') {
                    nav._computeLookQuaternion(nav.targetQuaternion, rig.position, lookTarget);
                    rig.quaternion.copy(nav.targetQuaternion);
                } else if (this.kernel.camera) {
                    this.kernel.camera.position.copy(rig.position);
                    this.kernel.camera.lookAt(lookTarget);
                    rig.quaternion.copy(this.kernel.camera.quaternion);
                }
            }
            this.runtimeState?.setLoginActive(false, { source: 'initial-menu:handle-select' });
            nav.setMode?.('FREE_FLIGHT', {
                requestPointerLock: false,
            });
            nav.requestPointerLock?.();
            nav._setFov?.(42, 0.8, 'power2.out');
        }

        document.dispatchEvent(new CustomEvent('os:login', { detail: { role } }));
        document.body.classList.remove('init-mode-active');

        const flash = document.createElement('div');
        flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.22);z-index:99999;pointer-events:none;opacity:0';
        document.body.appendChild(flash);
        gsap.fromTo(
            flash,
            { opacity: 0.38 },
            { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => flash.remove() }
        );

        this.dismiss(true);
    }

    // ── Dismiss ─────────────────────────────────────────────────────────────
    dismiss(immediate = false) {
        if (!this.element) return;
        this.element.style.pointerEvents = 'none';
        document.body.classList.remove('init-mode-active');
        this._clearPointerIntent('initial-menu');
        this._clearPasswordPointerIntent();
        this.runtimeState?.setLoginActive(false, { source: 'initial-menu:dismiss' });

        // Re-enable raycasting now that login is complete
        this._setRaycast(true);
        // Stop consuming ESC
        document.removeEventListener('keydown', this._onESC, true);

        if (immediate) {
            this.element.remove();
            this.element = null;
            this.active = false;
            return;
        }

        gsap.to(this.element, {
            opacity: 0, duration: 0.5, ease: 'power2.in',
            onComplete: () => {
                if (this.element) this.element.remove();
                this.element = null;
                this.active = false;
            }
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
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

    _clearPasswordPointerIntent() {
        this._clearPointerIntent('initial-menu-password');
    }

    _setRaycast(enabled) {
        try {
            const rs = this.kernel?.raycastSelectionSystem;
            if (!rs) return;
            if (enabled) rs.enable?.();
            else         rs.disable?.();
        } catch (_) {}
    }
}
