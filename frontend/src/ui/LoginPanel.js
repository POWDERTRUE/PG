import gsap from 'gsap';
import { Registry } from '../engine/core/ServiceRegistry.js';

/**
 * LoginPanel — OMEGA V30
 *
 * Fixes:
 *  1. Sets window.__loginActive = true while visible — camera won't steal pointer lock
 *  2. GSAP dismiss uses a single timeline (no race between two parallel tweens)
 *  3. pointer-events:none applied immediately on dismiss — no re-trigger
 *  4. Password check for POWDERTRUE profile
 */
export class LoginPanel {
    constructor(kernel) {
        this.kernel = kernel;
        this.runtimeState = kernel?.runtimeState || Registry.tryGet('RuntimeState');
        this.container = document.getElementById('hud-layer');
        this.element = null;
    }

    render() {
        if (!this.container) return;

        // ── Block camera mouse/pointer-lock while login is visible ─────────
        this.runtimeState?.setLoginActive(true, { source: 'login-panel:render' });

        this.element = document.createElement('div');
        this.element.id = 'login-screen';
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            pointer-events: auto;
        `;

        this.element.innerHTML = `
            <div class="login-ice-shell" style="transform: scale(0.9);">
                <div class="login-ice-header">
                    <p class="login-ice-badge">Glass Silicon Ice</p>
                    <h1 class="login-ice-title">Seleccionar Perfil</h1>
                    <p class="login-ice-subtitle">Login para entrar al universo</p>
                </div>

                <div class="login-ice-fields">
                    <label class="login-ice-field">
                        Perfil
                        <input type="text" id="login-profile" placeholder="@perfil" class="glass-input login-ice-input" autocomplete="off" />
                    </label>
                    <label class="login-ice-field">
                        Access Key
                        <input type="password" id="login-password" placeholder="••••••••" class="glass-input login-ice-input" autocomplete="off" />
                    </label>
                    <p id="login-error" style="color:#ff4466;font-size:12px;text-align:center;display:none;margin:4px 0 0;">
                        Contraseña incorrecta
                    </p>
                </div>

                <button id="login-btn" class="glass-btn-premium login-ice-button">Entrar al Universo</button>
            </div>
        `;

        this.container.appendChild(this.element);

        // Entry animation
        gsap.to(this.element, { opacity: 1, duration: 1.5, ease: 'power2.out' });
        gsap.to(this.element.querySelector('.login-ice-shell'), {
            scale: 1, duration: 1.5, ease: 'expo.out'
        });

        this.bindEvents();
    }

    bindEvents() {
        const btn = this.element.querySelector('#login-btn');
        btn.addEventListener('click', () => this.handleLogin());

        // Stop all pointer events from bubbling to the canvas/universe
        this.element.addEventListener('pointerdown', e => e.stopPropagation(), true);
        this.element.addEventListener('mousedown',   e => e.stopPropagation(), true);

        this.element.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    handleLogin() {
        const profile  = this.element.querySelector('#login-profile')?.value?.trim()?.toUpperCase();
        const password = this.element.querySelector('#login-password')?.value?.trim();
        const errEl    = this.element.querySelector('#login-error');

        // POWDERTRUE requires password 'milulu'
        if (profile === 'POWDERTRUE') {
            if (password !== 'milulu') {
                if (errEl) { errEl.style.display = 'block'; }
                const pwEl = this.element.querySelector('#login-password');
                if (pwEl) { pwEl.value = ''; pwEl.focus(); }
                return;
            }
        }

        if (errEl) errEl.style.display = 'none';

        const btn = this.element.querySelector('#login-btn');
        if (btn) { btn.textContent = 'ENLAZANDO...'; btn.style.pointerEvents = 'none'; }

        setTimeout(() => {
            if (this.kernel?.events) {
                this.kernel.events.emit('os:login_success');
            }
            this.dismiss();
        }, 800);
    }

    dismiss() {
        if (!this.element) return;

        // Immediately block all input — no re-triggers during fade-out
        this.element.style.pointerEvents = 'none';

        // Release the camera — pointer lock is allowed again
        this.runtimeState?.setLoginActive(false, { source: 'login-panel:dismiss' });

        const el    = this.element;
        const shell = el.querySelector('.login-ice-shell');

        // Single unified GSAP timeline — no race condition
        gsap.timeline({ onComplete: () => { el.remove(); } })
            .to(shell ?? el, { scale: 1.08, opacity: 0, duration: 0.6, ease: 'expo.in' })
            .to(el, { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0);

        this.element = null;
    }
}
