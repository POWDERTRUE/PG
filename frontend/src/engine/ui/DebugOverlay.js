import { Registry } from '../core/ServiceRegistry.js';

/**
 * DebugOverlay.js
 * OMEGA V28 Master Edition — Sensory & HUD
 */
export class DebugOverlay {
    static phase = 'sensory';
    constructor(services) {
        this.services = services;
        this.container = null;
        this.stats = {
            fps: 0,
            distance: 0,
            mode: 'NAVIGATION'
        };
        this.lastTime = performance.now();
        this.frames = 0;
    }

    init() {
        console.log('[DebugOverlay] OMEGA Telemetry Active.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');

        this.container = document.createElement('div');
        this.container.id = 'engine-debug-overlay';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #00ff88;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            pointer-events: none;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(this.container);

        this.frameCount = 0;
        this.events.on('frame:end', () => {
            this.frameCount++;
            if (this.frameCount % 10 === 0) this.updateStats();
        });
    }

    updateStats() {
        this.frames++;
        const now = performance.now();
        if (now > this.lastTime + 1000) {
            this.stats.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
            this.frames = 0;
            this.lastTime = now;
        }

        if (this.registry.has('CameraSystem')) {
            this.stats.distance = Math.round(this.Registry.get('CameraSystem').camera.position.z);
        }

        if (this.registry.has('WorldInteractionSystem')) {
            const interaction = this.Registry.get('WorldInteractionSystem');
            this.stats.mode = 'ACTIVE';
        }

        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div style="border-bottom: 1px solid rgba(0,255,136,0.2); margin-bottom: 8px; padding-bottom: 4px; font-weight: bold; color: #fff;">OMEGA_ENGINE_V28</div>
            <div>FPS: <span style="color: #fff">${this.stats.fps}</span></div>
            <div>DISTANCE: <span style="color: #fff">${this.stats.distance}</span></div>
            <div>MODE: <span style="color: #fff">${this.stats.mode}</span></div>
            <div style="margin-top: 8px; font-size: 9px; opacity: 0.5;">SPATIAL_OS_READY</div>
        `;
    }
}
