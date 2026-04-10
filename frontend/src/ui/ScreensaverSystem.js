/**
 * ScreensaverSystem.js — Powder Galaxy
 *
 * Idle detection screensaver:
 *   • After IDLE_DELAY ms of no mouse/keyboard activity → fades to black
 *   • While black: a "PowderGalaxy" wordmark drifts slowly across the screen
 *   • Any mouse movement (or key press) → instantly wakes and fades back in
 *
 * Usage:
 *   const sv = new ScreensaverSystem();
 *   sv.start();
 */

const IDLE_DELAY    = 3 * 60 * 1000;   // 3 minutes of inactivity → screensaver
const FADE_DURATION = 2500;             // ms to fade to black
const WAKE_DURATION = 600;             // ms to fade back in

export class ScreensaverSystem {
    constructor() {
        this._idleTimer   = null;
        this._active      = false;
        this._overlay     = null;
        this._driftFrame  = null;
        this._lastActivity = Date.now();

        // Bound handlers
        this._onActivity = this._onActivity.bind(this);
        this._onWake     = this._wake.bind(this);
    }

    start() {
        this._buildOverlay();
        this._listenActivity();
        this._scheduleScreensaver();
        console.log('[ScreensaverSystem] Idle watcher started.');
    }

    // ── DOM ──────────────────────────────────────────────────────────────────

    _buildOverlay() {
        const existing = document.getElementById('pg-screensaver');
        if (existing) {
            this._overlay = existing;
            return;
        }

        const style = document.createElement('style');
        style.textContent = `
            #pg-screensaver {
                position: fixed; inset: 0; z-index: 999999;
                background: #000;
                display: flex; align-items: center; justify-content: center;
                pointer-events: none;
                opacity: 0;
                transition: none;
            }
            #pg-screensaver.sv-fading-in  { transition: opacity ${FADE_DURATION}ms ease; }
            #pg-screensaver.sv-fading-out { transition: opacity ${WAKE_DURATION}ms ease; }

            #pg-sv-wordmark {
                font-family: 'Courier New', monospace;
                font-size: clamp(28px, 5vw, 60px);
                font-weight: 300;
                letter-spacing: 0.3em;
                text-transform: uppercase;
                color: rgba(255, 255, 255, 0.08);
                user-select: none;
                position: absolute;
                white-space: nowrap;
                /* drift is driven by JS */
                will-change: transform;
            }
        `;
        document.head.appendChild(style);

        this._overlay = document.createElement('div');
        this._overlay.id = 'pg-screensaver';
        this._overlay.innerHTML = `<div id="pg-sv-wordmark">PowderGalaxy</div>`;
        document.body.appendChild(this._overlay);
    }

    // ── Activity detection ────────────────────────────────────────────────────

    _listenActivity() {
        // Sleep events (mouse move + keyboard = reset idle timer but don't wake)
        window.addEventListener('mousemove',  this._onActivity, { passive: true });
        window.addEventListener('keydown',    this._onActivity, { passive: true });
        window.addEventListener('pointerdown',this._onActivity, { passive: true });
        window.addEventListener('wheel',      this._onActivity, { passive: true });
    }

    _onActivity() {
        this._lastActivity = Date.now();

        if (this._active) {
            this._wake();
            return;
        }

        // Reset idle countdown
        this._scheduleScreensaver();
    }

    // ── Screensaver lifecycle ─────────────────────────────────────────────────

    _scheduleScreensaver() {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(() => this._sleep(), IDLE_DELAY);
    }

    _sleep() {
        if (this._active) return;
        this._active = true;

        console.log('[ScreensaverSystem] Idle — screensaver ON');

        const ov = this._overlay;
        ov.style.pointerEvents = 'all';

        // Start fade to black
        ov.classList.remove('sv-fading-out');
        ov.classList.add('sv-fading-in');
        ov.style.opacity = '1';

        // Begin wordmark drift after overlay is fully opaque
        setTimeout(() => this._startDrift(), FADE_DURATION + 100);

        // Wake on mouse move (primary wake signal while screensaver is active)
        window.addEventListener('mousemove', this._onWake, { passive: true });
    }

    _wake() {
        if (!this._active) return;
        this._active = false;

        console.log('[ScreensaverSystem] Activity detected — screensaver OFF');

        const ov = this._overlay;

        // Stop drift
        this._stopDrift();

        // Fade back out quickly
        ov.classList.remove('sv-fading-in');
        ov.classList.add('sv-fading-out');
        ov.style.opacity = '0';

        // Re-schedule idle countdown
        this._scheduleScreensaver();

        // Remove wake handler
        window.removeEventListener('mousemove', this._onWake);

        // Remove pointer capture after fade completes
        setTimeout(() => {
            if (!this._active) ov.style.pointerEvents = 'none';
        }, WAKE_DURATION + 50);
    }

    // ── Wordmark drift ────────────────────────────────────────────────────────

    _startDrift() {
        const wordmark = document.getElementById('pg-sv-wordmark');
        if (!wordmark) return;

        const W = window.innerWidth;
        const H = window.innerHeight;

        // Start from a random position
        let x = Math.random() * W * 0.5 + W * 0.1;
        let y = Math.random() * H * 0.5 + H * 0.2;

        // Slow drift velocities (px/s)
        let vx = (Math.random() - 0.5) * 22;
        let vy = (Math.random() - 0.5) * 14;

        let last = performance.now();

        const tick = (now) => {
            if (!this._active) return;

            const dt = (now - last) / 1000;
            last = now;

            x += vx * dt;
            y += vy * dt;

            const ww = wordmark.offsetWidth  || 300;
            const wh = wordmark.offsetHeight || 60;

            // Bounce off edges
            if (x < 20)          { x = 20;        vx = Math.abs(vx); }
            if (x + ww > W - 20) { x = W - ww - 20; vx = -Math.abs(vx); }
            if (y < 20)          { y = 20;        vy = Math.abs(vy); }
            if (y + wh > H - 20) { y = H - wh - 20; vy = -Math.abs(vy); }

            wordmark.style.transform = `translate(${x}px, ${y}px)`;

            this._driftFrame = requestAnimationFrame(tick);
        };

        this._driftFrame = requestAnimationFrame(tick);
    }

    _stopDrift() {
        if (this._driftFrame) {
            cancelAnimationFrame(this._driftFrame);
            this._driftFrame = null;
        }
    }
}
