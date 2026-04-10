/**
 * URLLauncher — Top-mounted spatial URL bar.
 *
 * Behavior:
 *   - Mounts a lean input bar at the top center of the screen.
 *   - Execution blocked until a user profile is active.
 *   - On submit, emits `system:spawn-protostar` with the URL.
 *   - Shows visual feedback: "locked" state before login, "ready" after.
 */
import { events } from '../core/EventBus.js';
import { Registry } from '../engine/core/ServiceRegistry.js';
import gsap from 'gsap';

export class URLLauncher {
    constructor() {
        this.activeProfile = null;
        this.el = null;
        this.input = null;
        this.statusDot = null;
    }

    init() {
        this._build();
        this._bind();
        console.log('[URLLauncher] Top-bar URL launcher online.');
    }

    _build() {
        this.el = document.createElement('div');
        this.el.id = 'url-launcher-bar';
        this.el.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: min(640px, 80vw);
            height: 44px;
            background: rgba(10, 10, 20, 0.75);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 22px;
            display: flex;
            align-items: center;
            padding: 0 18px;
            gap: 10px;
            z-index: 8000;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
            pointer-events: auto;
            opacity: 0;
        `;

        // Status dot — red = locked, cyan = ready
        this.statusDot = document.createElement('div');
        this.statusDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff4757;
            flex-shrink: 0;
            transition: background 0.4s ease;
            box-shadow: 0 0 8px currentColor;
        `;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Selecciona un perfil para navegar…';
        this.input.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: rgba(255,255,255,0.8);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            letter-spacing: 0.3px;
        `;
        this.input.disabled = true;

        const launchBtn = document.createElement('button');
        launchBtn.id = 'url-launch-btn';
        launchBtn.textContent = '⌁';
        launchBtn.style.cssText = `
            background: rgba(0, 240, 255, 0.1);
            border: 1px solid rgba(0, 240, 255, 0.3);
            color: #00f0ff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        `;

        launchBtn.addEventListener('click', () => this._launch());
        this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._launch(); });

        this.el.appendChild(this.statusDot);
        this.el.appendChild(this.input);
        this.el.appendChild(launchBtn);
        document.body.appendChild(this.el);
    }

    _bind() {
        // Become active after login
        document.addEventListener('os:login', (e) => {
            this.activeProfile = e.detail.role;
            this._unlock();
        });
    }

    _unlock() {
        this.input.disabled = false;
        this.input.placeholder = `Explorar universe como ${this.activeProfile}…`;
        this.statusDot.style.background = '#00f0ff';
        gsap.to(this.input, { color: 'rgba(255,255,255,0.95)', duration: 0.3 });
        console.log('[URLLauncher] Unlocked for profile:', this.activeProfile);
    }

    _launch() {
        if (!this.activeProfile) {
            // Shake — visual "locked" feedback
            gsap.to(this.el, { x: '+= 8', duration: 0.05, repeat: 5, yoyo: true,
                onComplete: () => gsap.set(this.el, { x: 0 }) });
            return;
        }

        let url = this.input.value.trim();
        if (!url) return;

        if (!url.startsWith('http')) url = 'https://' + url;

        // Emit spawn event to SpaceHierarchySystem
        events.emit('system:spawn-protostar', {
            url,
            screenX: window.innerWidth / 2,
            screenY: 44
        });

        this.input.value = '';
        gsap.fromTo(this.statusDot, { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    }

    show() {
        gsap.to(this.el, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    }
}

export const urlLauncher = new URLLauncher();

