import { Registry } from '../core/ServiceRegistry.js';

/**
 * PerformancePanel.js
 * OMEGA V28 Master Edition — Sensory & HUD
 */
export class PerformancePanel {
    static phase = 'sensory';
    constructor(services) {
        this.services = services;
        this.container = null;
    }

    init() {
        if (!this.services) return;
        console.log('[Performance] OMEGA Monitoring Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        if (!this.events) return;
        this.frameCount = 0;

        this.container = document.createElement('div');
        this.container.id = 'engine-performance-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #aaa;
            font-family: monospace;
            font-size: 10px;
            pointer-events: none;
            z-index: 9999;
        `;
        document.body.appendChild(this.container);

        this.events.on('frame:end', ({ delta }) => {
            this.frameCount++;
            if (this.frameCount % 30 === 0) this.update(delta);
        });
    }

    update(delta) {
        if (!this.registry) return;
        let objectCount = 0;
        const sceneGraph = this.Registry.get('SceneGraph');
        if (sceneGraph) {
            // Optimization: Count children only, avoid full recursive traverse if possible
            objectCount = sceneGraph.getScene().children.length;
        }

        const fps = delta > 0 ? (1 / delta).toFixed(0) : 0;
        const dt = (delta * 1000).toFixed(2);

        this.container.innerHTML = `
            FPS: <span style="color: #00ffaa; font-weight: bold;">${fps}</span> | 
            DT: ${dt}ms | 
            OBJS: ${objectCount}
        `;
    }
}
