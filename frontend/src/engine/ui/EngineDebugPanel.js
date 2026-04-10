export class EngineDebugPanel {
    constructor(renderer, spatialGrid, universeStreamer) {
        this.renderer = renderer;
        this.spatialGrid = spatialGrid;
        this.universeStreamer = universeStreamer;
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        
        this.panelElement = null;
        this.metrics = {};
    }

    async initialize() {
        this.createDOM();
        console.log("📊 [EngineDebugPanel] Overlay initialized.");
    }

    createDOM() {
        const debugEnabled = new URLSearchParams(window.location.search).has('debug');
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'omega-debug-panel';
        Object.assign(this.panelElement.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 20, 40, 0.75)',
            border: '1px solid rgba(0, 255, 204, 0.3)',
            backdropFilter: 'blur(10px)',
            color: '#00ffcc',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '12px',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: '9999',
            minWidth: '200px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            display: debugEnabled ? 'block' : 'none'
        });

        const layout = `
            <div style="border-bottom: 1px solid #00ffcc; padding-bottom: 5px; margin-bottom: 5px; font-weight: bold;">OMEGA V17 DEBUG</div>
            <div style="display: flex; justify-content: space-between;"><span>FPS:</span> <span id="dbg-fps">0</span></div>
            <div style="display: flex; justify-content: space-between;"><span>DRAW CALLS:</span> <span id="dbg-draws">0</span></div>
            <div style="display: flex; justify-content: space-between;"><span>GEOMETRIES:</span> <span id="dbg-geo">0</span></div>
            <div style="display: flex; justify-content: space-between;"><span>TEXTURES:</span> <span id="dbg-tex">0</span></div>
            <div style="display: flex; justify-content: space-between;"><span>ENTITIES (GRID):</span> <span id="dbg-entities">0</span></div>
            <div style="display: flex; justify-content: space-between;"><span>ACTIVE SECTORS:</span> <span id="dbg-sectors">0</span></div>
        `;
        
        this.panelElement.innerHTML = layout;
        document.body.appendChild(this.panelElement);

        this.metrics = {
            fps: document.getElementById('dbg-fps'),
            draws: document.getElementById('dbg-draws'),
            geo: document.getElementById('dbg-geo'),
            tex: document.getElementById('dbg-tex'),
            entities: document.getElementById('dbg-entities'),
            sectors: document.getElementById('dbg-sectors')
        };
    }

    update() {
        if (!this.panelElement) return;

        this.frameCount++;
        const now = performance.now();

        if (now >= this.lastTime + 250) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            
            this.metrics.fps.textContent = this.fps;
            this.metrics.fps.style.color = this.fps >= 55 ? '#00ffcc' : (this.fps > 30 ? '#ffaa00' : '#ff3333');
            
            this.metrics.draws.textContent = this.renderer.info.render.calls;
            this.metrics.geo.textContent = this.renderer.info.memory.geometries;
            this.metrics.tex.textContent = this.renderer.info.memory.textures;

            const spatialObjects = this.spatialGrid?.objects;
            const entityCount = spatialObjects?.size ?? spatialObjects?.length ?? 0;
            this.metrics.entities.textContent = entityCount;

            this.metrics.sectors.textContent =
                this.universeStreamer?.activeSectors?.size ??
                this.universeStreamer?.loadedSectorCount ??
                0;

            this.frameCount = 0;
            this.lastTime = now;
        }
    }
}
