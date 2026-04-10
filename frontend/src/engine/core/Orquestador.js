import { Registry } from './ServiceRegistry.js';

const SYSTEM_ALIASES = {
    pipeline: 'RenderPipeline',
    renderPipeline: 'RenderPipeline',
    frameGraph: 'FrameGraph',
    physics: 'physicsSystem',
    navigation: 'navigationSystem',
    galaxyGen: 'galaxyGenSystem',
    hud: 'HUDManager',
};

/**
 * [OMEGA V30] Orquestador.js
 * LULU's diagnostics brain for registry, telemetry, and boot health.
 */
export class Orquestador {
    constructor(kernel) {
        this.kernel = kernel;
        this.registry = Registry;
        this.bootTime = Date.now();
        this.status = 'ACTIVE';
    }

    init() {
        console.log('%c[Orquestador] LULU-Kernel link online.', 'color:#ff00ff; font-weight:bold;');
        window.ORQUESTADOR = this;
    }

    inspect_system(name) {
        const resolved = this._resolveSystem(name);
        if (!resolved) {
            return { error: `Sistema '${name}' no encontrado en el Registro.` };
        }

        const { key, system } = resolved;
        const bootNode = this.kernel?.bootGraph?.systems?.get?.(key) || null;

        return {
            requestedName: name,
            name: key,
            status: system?.isEnabled === false ? 'DISABLED' : 'RUNNING',
            type: system?.constructor?.name ?? typeof system,
            hasUpdate: typeof system?.update === 'function',
            hasInit: typeof system?.init === 'function' || typeof system?.initialize === 'function',
            booted: bootNode?.booted ?? true
        };
    }

    system_graph() {
        const graph = {};
        this.registry._services.forEach((service, name) => {
            const bootNode = this.kernel?.bootGraph?.systems?.get?.(name) || null;
            graph[name] = {
                className: service?.constructor?.name ?? typeof service,
                isBooted: bootNode?.booted ?? true
            };
        });
        return graph;
    }

    performance() {
        const hud = this.kernel?.hudManager || this.registry.tryGet('HUDManager');
        const entityManager = this.registry.tryGet('EntityManager');
        const renderInfo = this.kernel?.renderer?.info?.render || null;
        const entityCount = entityManager?.entityCount || this.kernel?.scene?.children?.length || 0;

        return {
            fps: hud?.nodes?.fps?.textContent ?? 'N/A',
            drawCalls: hud?.nodes?.draw?.textContent ?? renderInfo?.calls ?? 'N/A',
            systems: hud?.nodes?.systems?.textContent ?? this.registry._services.size,
            entities: entityCount,
            uptime: `${((Date.now() - this.bootTime) / 1000).toFixed(1)}s`
        };
    }

    boot_analysis() {
        const essential = [
            ['camera', 'camera'],
            ['RenderPipeline', 'renderPipeline'],
            ['FrameGraph', 'frameGraph'],
            ['navigationSystem', 'navigationSystem'],
            ['WindowManager', 'windowManager'],
            ['EntityManager', 'entityManager'],
            ['Orquestador', 'orquestador']
        ];

        const report = {
            integrity: 'OPTIMAL',
            missing: [],
            ok: []
        };

        essential.forEach(([registryKey, kernelKey]) => {
            const present = Boolean(this.registry.tryGet(registryKey) || this.kernel?.[kernelKey]);
            if (present) {
                report.ok.push(registryKey);
            } else {
                report.integrity = 'DEGRADED';
                report.missing.push(registryKey);
            }
        });

        return report;
    }

    memory() {
        if (window.performance && window.performance.memory) {
            const mem = window.performance.memory;
            return {
                total: `${(mem.totalJSHeapSize / 1048576).toFixed(1)} MB`,
                used: `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB`,
                limit: `${(mem.jsHeapSizeLimit / 1048576).toFixed(1)} MB`
            };
        }
        return { error: 'API de Memoria no soportada por el navegador.' };
    }

    _resolveSystem(name) {
        if (!name) return null;

        const candidates = [name, SYSTEM_ALIASES[name]].filter(Boolean);
        for (const key of candidates) {
            const system = this.registry.tryGet(key) || this.kernel?.[key];
            if (system) {
                return { key, system };
            }
        }

        return null;
    }
}

export default Orquestador;
