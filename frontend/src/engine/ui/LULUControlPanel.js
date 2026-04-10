import { Registry } from '../core/ServiceRegistry.js';
import { LULUManualSystem } from './lulu/LULUManualSystem.js';

export class LULUControlPanel {
    constructor(kernel) {
        this.kernel = kernel;
        this.registry = kernel.registry;
        this.panel = null;
        this.responsePanel = null;
        this.last = 0;
    }

    async init() {
        // ── Anti-duplication guard ─────────────────────────────────────────────
        document.getElementById('lulu-panel')?.remove();

        const brain = await Registry.waitFor('Orquestador');
        const debugEnabled = new URLSearchParams(window.location.search).has('debug');

        this.panel = document.createElement('div');
        this.panel.id = 'lulu-panel';
        this.panel.style.position = 'absolute';
        this.panel.style.bottom = '80px';
        this.panel.style.left = '20px';
        this.panel.style.transform = 'none';
        this.panel.style.width = '280px';
        this.panel.style.background = 'rgba(0,0,0,0.6)';
        this.panel.style.color = '#00ffcc';
        this.panel.style.fontFamily = 'monospace';
        this.panel.style.padding = '10px';
        this.panel.style.zIndex = '9999';
        this.panel.style.display = debugEnabled ? 'block' : 'none';
        this.panel.innerHTML = `
<b>LULU ENGINE PANEL</b>
<div id="lulu-fps">FPS:</div>
<div id="lulu-systems">Systems:</div>
<div id="lulu-entities">Entities:</div>
<div id="lulu-memory">Memory:</div>
`;

        const targetLayer = document.getElementById('window-layer') || document.body;
        targetLayer.appendChild(this.panel);

        window.LULU = this;
        console.log('%c[LULU] Assistant online. Console bridge ready.', 'color:#ff00ff;font-weight:bold;font-size:14px');

        if (brain) {
            this.inspect_system = (name) => this._log(JSON.stringify(brain.inspect_system(name), null, 2));
            this.system_graph = () => this._log(JSON.stringify(brain.system_graph(), null, 2));
            this.performance = () => this._log(JSON.stringify(brain.performance(), null, 2));
            this.boot_analysis = () => this._log(JSON.stringify(brain.boot_analysis(), null, 2));
            this.memory = () => this._log(JSON.stringify(brain.memory(), null, 2));
            this.show_manual = () => LULUManualSystem.open();
            this.manual = () => LULUManualSystem.open();
            this.help = () => this._log("Comandos LULU: inspect_system('name'), system_graph(), manual(), etc.");
        }
    }

    setResponsePanel(panel) {
        this.responsePanel = panel;
    }

    _log(msg) {
        if (this.responsePanel?.log) {
            this.responsePanel.log(msg);
            return;
        }
        console.log('[LULU]', msg);
    }

    _setMetric(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.innerText = value;
        }
    }

    update() {
        this.updateFPS();
        this.updateSystems();
        this.updateEntities();
        this.updateMemory();
    }

    updateFPS() {
        if (!this.last) this.last = performance.now();

        const now = performance.now();
        const fps = Math.round(1000 / Math.max(now - this.last, 1));
        this.last = now;

        this._setMetric('lulu-fps', `FPS: ${fps}`);
    }

    updateSystems() {
        if (!this.registry) return;
        const systems = this.registry._services?.size ?? 0;
        this._setMetric('lulu-systems', `Systems: ${systems}`);
    }

    updateEntities() {
        const entities =
            Registry.tryGet('EntityManager')?.entityCount ||
            this.kernel?.scene?.children?.length ||
            0;
        this._setMetric('lulu-entities', `Entities: ${entities}`);
    }

    updateMemory() {
        if (!performance.memory) return;

        const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
        this._setMetric('lulu-memory', `Memory: ${mb} MB`);
    }

    scan() {
        const msg = 'Scanning OMEGA V30 architecture...';
        console.log(`%c[LULU] ${msg}`, 'color:#00ffcc; font-weight:bold; font-size:13px');
        this._log(msg);

        const nodes = this.kernel?.bootGraph?.systems?.size ?? 0;
        const services = this.registry?._services?.size ?? 0;
        this._log(`Estado: ${this.kernel?.state ?? 'OFFLINE'} | Nodos boot: ${nodes} | Servicios: ${services}`);
        this._log('Arquitectura verificada.');
    }

    debug_boot() {
        const msg = 'Analizando Boot Graph...';
        console.log(`%c[LULU] ${msg}`, 'color:#ffaa00; font-weight:bold; font-size:13px');
        this._log(msg);

        if (!this.kernel?.bootGraph?.systems) {
            this._log('BootGraph offline.');
            return;
        }

        const tableData = [];
        for (const [key, value] of this.kernel.bootGraph.systems.entries()) {
            tableData.push({
                Nodo: key,
                Dependencias: value.dependencies.join(', ') || 'Ninguna',
                Resuelto: value.booted ? 'READY' : 'PENDING'
            });
        }

        console.table(tableData);
        this._log('Analisis completado. Revisa la consola para la tabla completa.');
    }

    optimize_gpu() {
        const msg = 'Ajustando perfil visual para maximo rendimiento...';
        console.log(`%c[LULU] ${msg}`, 'color:#00ffcc; font-weight:bold; font-size:13px');
        this._log(msg);

        if (this.kernel.renderPipeline?.setTargetFPS) {
            this.kernel.renderPipeline.setTargetFPS(60);
        }
        if (this.kernel.renderer) {
            this.kernel.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        }

        this._log('Perfil GPU estabilizado.');
    }

    expand_engine() {
        this._log('Modulo de expansion iniciado...');
        this._log('Pide por chat: "LULU, generame un sistema nuevo" para abrir la siguiente capa.');
    }

    upgrade_architecture() {
        this._log(`Propuestas actuales:
1. Migrar SpatialHashGrid a WebWorkers.
2. Rendering instanciado (InstancedMesh).
3. Transformar el flujo a ECS puro.`);
        this._log('Dime cual implementamos.');
    }
}
