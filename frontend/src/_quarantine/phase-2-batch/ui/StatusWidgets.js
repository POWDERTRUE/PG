import gsap from 'https://unpkg.com/gsap@3.12.5/index.js';
import { Registry } from '../engine/core/ServiceRegistry.js';


/**
 * ==========================================================
 * Powder Galaxy Engine - StatusWidgets V28 (OMEGA)
 * ==========================================================
 * @file StatusWidgets.js
 * @description V38 Quantum Status Monitors
 */
export class StatusWidgets {
    constructor() {
        this.container = document.getElementById('hud-layer');
        this.widgets = {};
        this.kernel = null;
    }

    render(kernel) {
        if (!this.container) return;
        this.kernel = kernel;

        // Create Widget Container
        const wrapper = document.createElement('div');
        wrapper.id = 'status-widgets-wrapper';
        wrapper.style.cssText = `
            position: fixed;
            top: 25px;
            right: 25px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            pointer-events: none;
            z-index: 2000;
        `;
        this.container.appendChild(wrapper);

        this.createWidget(wrapper, 'engine', 'CORE HEARTBEAT', 'STABLE');
        this.createWidget(wrapper, 'fps', 'ENGINE SPEED', '0 FPS');
        this.createWidget(wrapper, 'coords', 'SPATIAL COORDINATES', '0.00, 0.00, 0.00');
        this.createWidget(wrapper, 'drawcalls', 'DRAW CALLS', '0');
        this.createWidget(wrapper, 'triangles', 'TRIANGLES', '0');
        this.createWidget(wrapper, 'population', 'STAR POPULATION', '1,000,000');

        this.startUpdating();
    }

    createWidget(parent, id, label, defaultValue) {
        const widget = document.createElement('div');
        widget.className = 'glass-capsule-premium';
        widget.style.cssText = `
            padding: 12px 20px;
            width: 220px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            opacity: 0;
            transform: translateX(50px);
            pointer-events: auto;
            cursor: pointer;
        `;

        widget.innerHTML = `
            <div class="glass-refraction-overlay"></div>
            <span style="font-size: 8px; font-weight: 800; color: rgba(0, 240, 255, 0.6); letter-spacing: 1px;">${label}</span>
            <span id="widget-val-${id}" style="font-family: 'Inter', sans-serif; font-size: 13px; color: #fff; font-weight: 500; letter-spacing: 0.5px;">${defaultValue}</span>
            <div style="position: absolute; bottom: 0; left: 0; height: 1px; width: 0%; background: #00f0ff; opacity: 0.3;" id="widget-progress-${id}"></div>
        `;

        parent.appendChild(widget);
        this.widgets[id] = widget;

        gsap.to(widget, { 
            opacity: 1, 
            x: 0, 
            duration: 1, 
            ease: "expo.out", 
            delay: Object.keys(this.widgets).length * 0.1 
        });

        widget.onmouseenter = () => {
            gsap.to(widget, { scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)', duration: 0.4 });
        };
        widget.onmouseleave = () => {
            gsap.to(widget, { scale: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', duration: 0.4 });
        };
    }

    startUpdating() {
        setInterval(() => this.update(), 100);
    }

    update() {
        if (!this.kernel) return;

        // 1. Update Spatial Coordinates & FPS
        const camera = Registry.get('camera');
        if (camera) {
            const p = camera.position;
            const el = document.getElementById('widget-val-coords');
            if (el) el.innerText = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
        }

        const scheduler = Registry.get('scheduler');
        if (scheduler) {
            const fpsEl = document.getElementById('widget-val-fps');
            if (fpsEl) fpsEl.innerText = `${Math.round(scheduler.fps || 0)} FPS`;
        }

        // 2. Pulse Heartbeat & Renderer Info
        const heartbeat = document.getElementById('widget-progress-engine');
        if (heartbeat) {
            gsap.to(heartbeat, { width: '100%', duration: 0.1, onComplete: () => {
                gsap.set(heartbeat, { width: '0%' });
            }});
        }

        const renderer = Registry.get('renderer');
        if (renderer && renderer.info) {
            const dcEl = document.getElementById('widget-val-drawcalls');
            const triEl = document.getElementById('widget-val-triangles');
            if (dcEl) dcEl.innerText = renderer.info.render.calls.toLocaleString();
            if (triEl) triEl.innerText = renderer.info.render.triangles.toLocaleString();
        }

        // 3. Population Density (Synthetic but reactive)
        const pop = document.getElementById('widget-val-population');
        if (pop) {
            const val = 1000000 + Math.floor(Math.random() * 100);
            pop.innerText = val.toLocaleString();
        }
    }
}

