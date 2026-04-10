/**
 * OMEGAEngineDevTools.js
 * OMEGA V28+ Architecture - Diagnostics Layer
 */
export class OMEGAEngineDevTools {
    constructor(kernel) {
        this.kernel = kernel;
        this.container = null;
        this.stats = {
            fps: 0,
            drawCalls: 0,
            triangles: 0,
            memory: 0,
            systems: 0
        };
    }

    init() {
        if (typeof document === 'undefined') return;
        
        console.log("[DevTools] Diagnostic Layer Online.");
        
        this.container = document.createElement('div');
        this.container.id = 'omega-devtools-panel';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 200px;
            background: rgba(0, 10, 20, 0.85);
            border: 1px solid #00f2ff;
            color: #00f2ff;
            font-family: 'OCR A Extended', monospace;
            font-size: 10px;
            padding: 10px;
            box-shadow: 0 0 15px rgba(0, 242, 255, 0.2);
            pointer-events: none;
            z-index: 9999;
            backdrop-filter: blur(5px);
            border-radius: 4px;
        `;
        
        this.container.innerHTML = `
            <div style="border-bottom: 1px solid #00f2ff; margin-bottom: 8px; padding-bottom: 4px; font-weight: bold;">
                OMEGA V28+ TELEMETRY
            </div>
            <div id="omega-stat-fps">FPS: 0</div>
            <div id="omega-stat-dc">DRAW CALLS: 0</div>
            <div id="omega-stat-tri">TRIANGLES: 0</div>
            <div id="omega-stat-mem">MEMORY: 0 MB</div>
            <div id="omega-stat-sys">SYSTEMS: 0</div>
        `;
        
        document.body.appendChild(this.container);
        
        // Polling interaction for stats
        setInterval(() => this.updateDisplay(), 500);
    }

    updateDisplay() {
        if (!this.container) return;

        const renderer = this.kernel.renderer;
        if (renderer) {
            const info = renderer.info;
            this.stats.drawCalls = info.render.calls;
            this.stats.triangles = info.render.triangles;
        }

        this.stats.systems = this.kernel.systems?.systemsArray?.length || 0;
        
        // FPS is handled by FrameScheduler typically, but we can sample
        const fpsElement = document.getElementById('omega-stat-fps');
        if (fpsElement) {
            const delta = this.kernel.scheduler?.delta || 0.016;
            const currentFps = Math.round(1 / delta);
            fpsElement.textContent = `FPS: ${currentFps}`;
        }

        document.getElementById('omega-stat-dc').textContent = `DRAW CALLS: ${this.stats.drawCalls}`;
        document.getElementById('omega-stat-tri').textContent = `TRIANGLES: ${this.stats.triangles.toLocaleString()}`;
        
        if (window.performance && window.performance.memory) {
            const mem = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            document.getElementById('omega-stat-mem').textContent = `MEMORY: ${mem} MB`;
        } else {
            document.getElementById('omega-stat-mem').textContent = `MEMORY: N/A`;
        }

        document.getElementById('omega-stat-sys').textContent = `SYSTEMS: ${this.stats.systems}`;
    }
}
