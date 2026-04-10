import { Registry } from '../../core/ServiceRegistry.js';
import { GALAXY_SPEC } from '../../config/UniverseSpec.js';
import { LULU_CANON, LULU_DOCUMENT_MAP } from '../lulu/LULUCanon.js';
import { LULU_WISDOM_LIBRARY, getWisdomDisciplineSummary } from '../lulu/LULUWisdom.js';

const OPEN_ONTOLOGY_MAP_SIGNAL  = 'PG:UI:OPEN_ONTOLOGY_MAP';
const LULU_SCAN_REFRESH_SIGNAL  = 'PG:UI:LULU_SCAN_REFRESH_REQUESTED';
const WINDOW_APP_ID = 'ontology-map';
const WINDOW_ID = `os-window-${WINDOW_APP_ID}`;
const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 560;
const SPATIAL_LAYERS = Object.freeze([
    Object.freeze({ id: 'kernel', label: 'Kernel Plane', z: -720, depth: 0.42 }),
    Object.freeze({ id: 'simulation', label: 'Simulation Plane', z: -180, depth: 0.72 }),
    Object.freeze({ id: 'interface', label: 'Interface Plane', z: 260, depth: 1.0 }),
]);

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function countBootedNodes(bootSystems) {
    if (!bootSystems || typeof bootSystems.values !== 'function') {
        return 0;
    }
    let count = 0;
    for (const node of bootSystems.values()) {
        if (node?.booted) {
            count++;
        }
    }
    return count;
}

function buildConnectorPath(fromNode, toNode) {
    const x1 = (fromNode.x / 100) * VIEWBOX_WIDTH;
    const y1 = (fromNode.y / 100) * VIEWBOX_HEIGHT;
    const x2 = (toNode.x / 100) * VIEWBOX_WIDTH;
    const y2 = (toNode.y / 100) * VIEWBOX_HEIGHT;
    const dx = x2 - x1;
    const layerDelta = Math.abs((fromNode.depth || 0) - (toNode.depth || 0));
    const curvature = 42 + Math.abs(dx) * 0.12 + layerDelta * 120;
    const c1x = x1 + dx * 0.22;
    const c1y = y1 - curvature;
    const c2x = x1 + dx * 0.78;
    const c2y = y2 - curvature;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export class LULUMindMapWindow {
    constructor(kernel) {
        this.kernel = kernel;
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.windowManager = Registry.tryGet('WindowManager');
        this.inputState = Registry.tryGet('InputStateSystem');
        this.windowId = WINDOW_ID;
        this.lastSnapshot = null;
        this.activeWindow = null;
        this.activeContent = null;
        this.universeContainer = null;
        this.inspectorPanel = null;
        this._spatialGraph = null;
        this._tiltX = 0;
        this._tiltY = 0;
        this._spotX = 50;
        this._spotY = 50;
        this._parallaxStrength = 11;
        this._hoverNodeId = null;
        this._pinnedNodeId = null;
        this._removeOpenListener = null;
        this._boundRender = this._renderWindow.bind(this);
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        this.inputState = this.inputState || Registry.tryGet('InputStateSystem');
        this._removeOpenListener = this.runtimeSignals?.on?.(
            OPEN_ONTOLOGY_MAP_SIGNAL,
            () => this.open()
        ) ?? null;
        // Cuando una cicatriz nueva se graba, si el mapa está abierto lo recompila
        this._removeScarRefreshListener = this.runtimeSignals?.on?.(
            LULU_SCAN_REFRESH_SIGNAL,
            () => { if (document.getElementById(this.windowId)) this.open(); }
        ) ?? null;
    }

    dispose() {
        this._removeOpenListener?.();
        this._removeOpenListener = null;
        this._removeScarRefreshListener?.();
        this._removeScarRefreshListener = null;
        this.activeWindow = null;
        this.activeContent = null;
        this.universeContainer = null;
        this.inspectorPanel = null;
        this._spatialGraph = null;
    }

    update(deltaTime) {
        if (!this.activeWindow?.isConnected || !this.universeContainer) {
            this.activeWindow = document.getElementById(this.windowId);
            if (!this.activeWindow) {
                this.activeContent = null;
                this.universeContainer = null;
                this.inspectorPanel = null;
                return;
            }
        }

        this.inputState = this.inputState || Registry.tryGet('InputStateSystem');
        const cursor =
            this.inputState?.getSharedCursorNDC?.() ??
            this.inputState?.sharedCursorNDC ??
            null;
        if (!cursor) {
            return;
        }

        const blend = 1 - Math.exp(-5.8 * Math.max(0.001, deltaTime || 0.016));
        const targetTiltX = cursor.y * this._parallaxStrength;
        const targetTiltY = cursor.x * (this._parallaxStrength + 1.5);
        this._tiltX += (targetTiltX - this._tiltX) * blend;
        this._tiltY += (targetTiltY - this._tiltY) * blend;
        this._spotX += ((((cursor.x + 1) * 0.5) * 100) - this._spotX) * blend;
        this._spotY += ((((1 - ((cursor.y + 1) * 0.5))) * 100) - this._spotY) * blend;

        this.universeContainer.style.transform =
            `rotateX(${this._tiltX.toFixed(2)}deg) rotateY(${this._tiltY.toFixed(2)}deg)`;
        this.universeContainer.style.setProperty('--ontology-cursor-x', `${this._spotX.toFixed(2)}%`);
        this.universeContainer.style.setProperty('--ontology-cursor-y', `${this._spotY.toFixed(2)}%`);
    }

    open() {
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        const domSystem = this.windowManager?.getWindowDOMSystem?.();
        if (!domSystem?.injectWindow) {
            return null;
        }

        const snapshot = this._buildSnapshot();
        this.lastSnapshot = snapshot;
        this._spatialGraph = snapshot.spatial;

        const win = domSystem.injectWindow(WINDOW_APP_ID, {
            nodeType: 'ontology-map',
            appName: 'LULU Ontology',
            parentName: 'LULU Ontology',
            windowClassName: 'is-ontology-map-window',
            ontologySnapshot: snapshot,
            customRender: this._boundRender,
        });
        win?.classList?.add('is-ontology-map-window');
        this.activeWindow = win || document.getElementById(this.windowId);
        return win;
    }

    getDebugState() {
        const snapshot = this.lastSnapshot;
        return {
            isOpen: !!document.getElementById(this.windowId),
            rootCount: snapshot?.tree?.length ?? 0,
            wisdomDisciplines: snapshot?.metrics?.disciplines ?? 0,
            services: snapshot?.metrics?.services ?? 0,
            spatialNodeCount: snapshot?.spatial?.nodes?.length ?? 0,
            focusedNode: this._hoverNodeId || this._pinnedNodeId || null,
        };
    }

    _buildSnapshot() {
        const bootSystems = this.kernel?.bootGraph?.systems;
        const wisdomSummary = getWisdomDisciplineSummary();
        const namedSystems =
            this.kernel?.galaxyGenSystem?.getNamedSystemDescriptors?.()?.length ??
            GALAXY_SPEC.visibleScenario?.namedSystems?.count ??
            0;
        const activeSectors =
            this.kernel?.sectorStreamingSystem?.activeSectors?.size ??
            this.kernel?.sectorStreamingSystem?.loadedSectorCount ??
            0;
        const services = Registry._services?.size ?? 0;

        const persistence   = Registry.tryGet('PersistenceSystem') ?? Registry.tryGet('persistenceSystem');
        const scarCount      = persistence?._planetaryScars?.size ?? 0;

        const metrics = {
            kernelState: this.kernel?.state ?? 'OFFLINE',
            services,
            booted: countBootedNodes(bootSystems),
            bootNodes: bootSystems?.size ?? 0,
            wisdomEntries: LULU_WISDOM_LIBRARY.length,
            disciplines: wisdomSummary.length,
            documents: LULU_DOCUMENT_MAP.length,
            namedSystems,
            mainStars: GALAXY_SPEC.totalMainStars,
            activeSectors,
            scarCount,
        };

        const snapshot = {
            title: 'LULU OMEGA V31',
            subtitle: 'Topologia ontologica del sistema operativo espacial',
            metrics,
            tree: [
                this._buildRuntimeBranch(metrics),
                this._buildVisibleUniverseBranch(metrics),
                this._buildWisdomBranch(wisdomSummary),
                this._buildDocsBranch(),
            ],
        };
        snapshot.spatial = this._buildSpatialGraph(snapshot);
        return snapshot;
    }

    _buildRuntimeBranch(metrics) {
        const groups = [
            {
                label: 'Core y Runtime',
                services: [
                    { key: 'RuntimeState', label: 'RuntimeState' },
                    { key: 'RuntimeSignals', label: 'RuntimeSignals' },
                    { key: 'RenderPipeline', label: 'RenderPipeline' },
                    { key: 'FrameGraph', label: 'FrameGraph' },
                    { key: 'SceneGraph', label: 'SceneGraph' },
                    { key: 'camera', label: 'MainCamera' },
                    { key: 'cameraRig', bootKey: 'CameraRig', label: 'CameraRig' },
                    { key: 'scheduler', label: 'FrameScheduler' },
                ],
            },
            {
                label: 'Fisica y Espacio',
                services: [
                    { key: 'CelestialRegistry', label: 'CelestialRegistry' },
                    { key: 'orbitalMechanics', bootKey: 'OrbitalMechanicsSystem', label: 'OrbitalMechanicsSystem' },
                    { key: 'floatingOrigin', bootKey: 'FloatingOriginSystem', label: 'FloatingOriginSystem' },
                    { key: 'StellarLODSystem', label: 'StellarLODSystem' },
                    { key: 'ProjectParticlesSystem', label: 'ProjectParticlesSystem' },
                    { key: 'PersistenceSystem', label: 'PersistenceSystem' },
                    { key: 'SectorStreamingSystem', label: 'UniverseStreamingSystem' },
                ],
            },
            {
                label: 'Navegacion e Interaccion',
                services: [
                    { key: 'navigationSystem', bootKey: 'UniverseNavigationSystem', label: 'UniverseNavigationSystem' },
                    { key: 'inputStateSystem', bootKey: 'InputStateSystem', label: 'InputStateSystem' },
                    { key: 'raycastSelectionSystem', bootKey: 'RaycastSelectionSystem', label: 'RaycastSelectionSystem' },
                    { key: 'PointerPresentationController', label: 'PointerPresentationController' },
                    { key: 'aimRaySystem', bootKey: 'AimRaySystem', label: 'AimRaySystem' },
                    { key: 'landingSystem', bootKey: 'LandingSystem', label: 'LandingSystem' },
                ],
            },
            {
                label: 'UI y LULU',
                services: [
                    { key: 'HUDManager', label: 'HUDManager' },
                    { key: 'WindowManager', label: 'WindowManager' },
                    { key: 'WorkspaceManager', label: 'WorkspaceManager' },
                    { key: 'GameMenuSystem', label: 'GameMenuSystem' },
                    { key: 'LULUContextualHUD', label: 'LULUContextualHUD' },
                    { key: 'luluSpawner', label: 'LULUSpatialObjectSpawnerSystem' },
                    { key: 'TacticalContextMenuSystem', label: 'TacticalContextMenuSystem' },
                    { key: 'LuluScannerSystem', label: 'LuluScannerSystem' },
                ],
            },
        ];

        return {
            label: 'Motor y Runtime',
            badge: `${metrics.services} servicios`,
            meta: `${metrics.booted}/${metrics.bootNodes} nodos booted`,
            open: true,
            children: groups.map((group) => {
                const leaves = group.services.map((serviceSpec) => this._makeServiceLeaf(serviceSpec));
                const online = leaves.filter((entry) => entry.badge === 'READY').length;
                return {
                    label: group.label,
                    badge: `${online}/${leaves.length}`,
                    meta: 'sistemas anclados',
                    open: true,
                    children: leaves,
                };
            }),
        };
    }

    _buildVisibleUniverseBranch(metrics) {
        const observerSystem = GALAXY_SPEC.visibleScenario?.observerSystem ?? {};
        const namedScenario = GALAXY_SPEC.visibleScenario?.namedSystems ?? {};

        return {
            label: 'Escenario Visible',
            badge: `${metrics.namedSystems} sistemas`,
            meta: `${metrics.activeSectors} sectores activos`,
            open: true,
            children: [
                {
                    label: 'Topologia galactica',
                    badge: `${GALAXY_SPEC.armCount} brazos`,
                    meta: `${metrics.mainStars} estrellas`,
                    open: true,
                    children: [
                        {
                            label: 'Disco principal',
                            badge: `${GALAXY_SPEC.diskRadius}u`,
                            meta: `halo ${GALAXY_SPEC.haloRadius}u`,
                        },
                        {
                            label: 'Visible scenario',
                            badge: `${namedScenario.count ?? 0} nodos`,
                            meta: `radio ${namedScenario.systemRadiusMin ?? 0}-${namedScenario.systemRadiusMax ?? 0}`,
                        },
                        {
                            label: 'LOD estelar',
                            badge: 'Proxy + detalle',
                            meta: `enter ${namedScenario.lod?.localEnterDistance ?? 0} / fade ${namedScenario.lod?.proxyFadeStartDistance ?? 0}`,
                        },
                    ],
                },
                {
                    label: 'Sistema del observador',
                    badge: `${LULU_CANON.solarSystem.planets.length} planetas`,
                    meta: `sun r=${LULU_CANON.solarSystem.sunRadius}`,
                    open: true,
                    children: [
                        {
                            label: 'Envelope orbital',
                            badge: `${observerSystem.boundaryRadius ?? 0}u`,
                            meta: `halo ${observerSystem.haloRadius ?? 0}u`,
                        },
                        {
                            label: 'Posicion de entrada',
                            badge: `${observerSystem.position?.x ?? 0}, ${observerSystem.position?.y ?? 0}, ${observerSystem.position?.z ?? 0}`,
                            meta: 'observer anchor',
                        },
                        ...LULU_CANON.solarSystem.planets.slice(0, 6).map((planet) => ({
                            label: planet.name,
                            badge: `${planet.className}`,
                            meta: `orbita ${planet.orbitRadius}u`,
                        })),
                    ],
                },
            ],
        };
    }

    _buildWisdomBranch(wisdomSummary) {
        return {
            label: 'Fuente de Sabiduria',
            badge: `${LULU_WISDOM_LIBRARY.length} nodos`,
            meta: `${wisdomSummary.length} disciplinas`,
            open: true,
            children: wisdomSummary.map((entry) => ({
                label: entry.discipline,
                badge: `${entry.count}`,
                meta: 'nodos canonicos',
                open: entry.count <= 4,
                children: LULU_WISDOM_LIBRARY
                    .filter((node) => node.discipline === entry.discipline)
                    .slice(0, 4)
                    .map((node) => ({
                        label: node.title,
                        badge: node.status,
                        meta: node.nature,
                    })),
            })),
        };
    }

    _buildDocsBranch() {
        const groups = [
            {
                label: 'Album Universal',
                matcher: (doc) => doc.path.startsWith('ALBUM_UNIVERSAL/'),
            },
            {
                label: 'Biblia LULU',
                matcher: (doc) => doc.path.startsWith('LULU_UNIVERSE_BIBLE'),
            },
            {
                label: 'Protocolos y roadmap',
                matcher: (doc) => !doc.path.startsWith('ALBUM_UNIVERSAL/') && !doc.path.startsWith('LULU_UNIVERSE_BIBLE'),
            },
        ];

        return {
            label: 'Canon Documental',
            badge: `${LULU_DOCUMENT_MAP.length} fuentes`,
            meta: 'rutas trazables',
            open: false,
            children: groups.map((group) => {
                const docs = LULU_DOCUMENT_MAP.filter(group.matcher);
                return {
                    label: group.label,
                    badge: `${docs.length}`,
                    meta: 'documentos',
                    open: false,
                    children: docs.slice(0, 8).map((doc) => ({
                        label: doc.title,
                        badge: doc.tags?.[0] ?? 'doc',
                        meta: doc.path,
                    })),
                };
            }),
        };
    }

    _buildSpatialGraph(snapshot) {
        const metrics = snapshot.metrics;
        const nodeData = [
            { id: 'kernel', layer: 'kernel', x: 14, y: 28, label: 'Kernel', badge: metrics.kernelState, meta: `${metrics.booted}/${metrics.bootNodes} nodos`, summary: 'Secuencia de boot, ownership del runtime y montaje de escena.', dependencies: ['runtime-signals', 'render-pipeline', 'scene-graph', 'scheduler'] },
            { id: 'runtime-signals', layer: 'kernel', x: 39, y: 18, label: 'RuntimeSignals', badge: 'bridge', meta: 'EventBus + DOM', summary: 'Canal semantico entre UI, navegacion, LULU y diagnostico.', dependencies: ['render-pipeline', 'window-os', 'lulu-brain'] },
            { id: 'render-pipeline', layer: 'kernel', x: 67, y: 26, label: 'RenderPipeline', badge: 'draw', meta: 'FrameGraph / post', summary: 'Ordena render, postproceso y capas visibles del universo.', dependencies: ['scene-graph', 'stellar-lod', 'window-os'] },
            { id: 'scene-graph', layer: 'kernel', x: 84, y: 46, label: 'SceneGraph', badge: 'space', meta: 'camera + rig', summary: 'Espina dorsal espacial donde viven masas, proxies y el observer system.', dependencies: ['visible-scenario', 'observer-system', 'physics-core'] },
            { id: 'scheduler', layer: 'kernel', x: 28, y: 54, label: 'FrameScheduler', badge: 'ticks', meta: 'input/ui/nav', summary: 'Distribuye fases y orden de actualizacion del OS y la simulacion.', dependencies: ['navigation-core', 'lulu-brain'] },
            { id: 'physics-core', layer: 'simulation', x: 16, y: 34, label: 'Physics Core', badge: 'dual', meta: 'RK4 + semi-implicit', summary: 'Fisica orbital y floating origin con constantes inyectadas.', dependencies: ['visible-scenario', 'observer-system'] },
            { id: 'navigation-core', layer: 'simulation', x: 39, y: 48, label: 'Navigation', badge: '6DoF', meta: 'focus / warp', summary: 'Camara, precision travel, cockpit y contextos de vuelo.', dependencies: ['observer-system', 'window-os'] },
            { id: 'visible-scenario', layer: 'simulation', x: 58, y: 22, label: 'Visible Scenario', badge: `${metrics.namedSystems}`, meta: 'named systems', summary: 'GalaxyGenerationSystem teje sistemas visibles y el observer envelope.', dependencies: ['stellar-lod', 'observer-system'] },
            { id: 'stellar-lod', layer: 'simulation', x: 78, y: 38, label: 'Stellar LOD', badge: 'proxy', meta: 'instanced mesh', summary: 'Proxy lejanos y detalle local con histeresis y fade limpio.', dependencies: ['window-os'] },
            { id: 'observer-system', layer: 'simulation', x: 62, y: 58, label: 'Observer System', badge: `${LULU_CANON.solarSystem.planets.length} planetas`, meta: 'SolarSystem_Core', summary: 'Sistema del observador, ancla local y envelope orbital.', dependencies: ['window-os', 'wisdom-library'] },
            { id: 'window-os', layer: 'interface', x: 21, y: 36, label: 'Window OS', badge: 'glass', meta: 'WindowDOMSystem', summary: 'Workspace 2D sobre el universo, docking HUD y apps del sistema.', dependencies: ['ontology-map', 'docs-canon'] },
            { id: 'lulu-brain', layer: 'interface', x: 48, y: 24, label: 'LULU Brain', badge: 'adaptive', meta: 'processor', summary: 'Procesa lenguaje natural, rutas documentales y activacion de herramientas.', dependencies: ['wisdom-library', 'docs-canon', 'ontology-map'] },
            { id: 'wisdom-library', layer: 'interface', x: 73, y: 28, label: 'Wisdom Library', badge: `${metrics.wisdomEntries}`, meta: `${metrics.disciplines} disciplinas`, summary: 'Biblioteca numerica de fisica, biologia, consciencia, logica y etica.', dependencies: ['ontology-map'] },
            { id: 'docs-canon', layer: 'interface', x: 82, y: 54, label: 'Canon Docs', badge: `${metrics.documents}`, meta: 'album + biblia', summary: 'Mapa documental que guia la evolucion arquitectonica del motor.', dependencies: ['ontology-map'] },
            { id: 'ontology-map', layer: 'interface', x: 45, y: 60, label: 'Ontology View', badge: '2.5D', meta: 'parallax', summary: 'Vista espacial del cerebro del OS: capas, enlaces y foco contextual.', dependencies: [] },
            { id: 'scar-memory', layer: 'simulation', x: 46, y: 72, label: 'Scar Memory', badge: metrics.scarCount > 0 ? `${metrics.scarCount} cicatrices` : 'PRISTINE', meta: 'PersistenceSystem', summary: 'Registro persistente de impactos del enjambre balístico. Cada cicatriz sobrevive recargas y altera la integridad de la masa en el Escáner LULU.', dependencies: ['observer-system', 'lulu-brain', 'window-os'] },
        ];

        const layerMap = Object.fromEntries(SPATIAL_LAYERS.map((layer) => [layer.id, layer]));
        const nodes = nodeData.map((node) => ({
            ...node,
            depth: layerMap[node.layer]?.depth ?? 0,
            z: layerMap[node.layer]?.z ?? 0,
        }));
        const nodeIndex = Object.fromEntries(nodes.map((node) => [node.id, node]));
        const links = [];

        for (const node of nodes) {
            for (const dependency of node.dependencies) {
                const target = nodeIndex[dependency];
                if (!target) continue;
                links.push({
                    id: `${node.id}__${dependency}`,
                    from: node.id,
                    to: dependency,
                    fromLayer: node.layer,
                    toLayer: target.layer,
                    path: buildConnectorPath(node, target),
                });
            }
        }

        return {
            layers: SPATIAL_LAYERS.map((layer) => ({
                ...layer,
                nodes: nodes.filter((node) => node.layer === layer.id),
            })),
            nodes,
            links,
        };
    }

    _makeServiceLeaf({ key, label, bootKey = null }) {
        const service = Registry.tryGet(key) ?? this.kernel?.[key] ?? null;
        const bootNode = this.kernel?.bootGraph?.systems?.get?.(bootKey || key) ?? null;
        return {
            label,
            badge: service ? (bootNode?.booted === false ? 'PENDING' : 'READY') : 'OFFLINE',
            meta: service?.constructor?.name ?? 'sin enlace',
        };
    }

    _renderWindow(content, metadata) {
        const snapshot = metadata?.ontologySnapshot ?? this._buildSnapshot();
        this.lastSnapshot = snapshot;
        this._spatialGraph = snapshot.spatial;
        content.innerHTML = `
            <div class="module-window module-window-shell ontology-window">
                <div class="module-window-hero ontology-window-hero">
                    <span class="module-window-badge">Visualizador Ontologico</span>
                    <div class="module-window-title">${escapeHtml(snapshot.title)}</div>
                    <div class="module-window-copy">${escapeHtml(snapshot.subtitle)}</div>
                </div>

                <div class="ontology-toolbar">
                    <div class="ontology-toolbar-actions">
                        <button type="button" class="ontology-action" data-action="expand-all">Expandir</button>
                        <button type="button" class="ontology-action" data-action="collapse-all">Contraer</button>
                        <button type="button" class="ontology-action ontology-action-primary" data-action="refresh">Recompilar</button>
                    </div>
                    <div class="ontology-toolbar-caption">Paralaje estricto 2.5D: DOM arriba, universo intacto abajo.</div>
                </div>

                <section class="ontology-panel ontology-panel-spatial">
                    <div class="module-window-section-head">
                        <div>
                            <div class="module-window-section-kicker">Spatial Mode</div>
                            <div class="module-window-section-title">Ontology Spatial Mode</div>
                        </div>
                        <div class="ontology-panel-meta">${snapshot.spatial?.nodes?.length ?? 0} nodos / ${snapshot.spatial?.links?.length ?? 0} enlaces</div>
                    </div>
                    ${this._renderSpatialViewport(snapshot.spatial)}
                </section>

                <div class="ontology-metrics-grid">
                    ${this._renderMetricCard('Kernel', snapshot.metrics.kernelState, `${snapshot.metrics.booted}/${snapshot.metrics.bootNodes} boot nodes`)}
                    ${this._renderMetricCard('Servicios', snapshot.metrics.services, 'registro canonico')}
                    ${this._renderMetricCard('Sabiduria', snapshot.metrics.wisdomEntries, `${snapshot.metrics.disciplines} disciplinas`)}
                    ${this._renderMetricCard('Galaxia', snapshot.metrics.namedSystems, `${snapshot.metrics.mainStars} estrellas base`)}
                    ${this._renderMetricCard('Cicatrices', snapshot.metrics.scarCount, snapshot.metrics.scarCount > 0 ? 'masas comprometidas' : 'universo pristine')}
                </div>

                <div class="ontology-layout">
                    <section class="ontology-panel ontology-panel-tree">
                        <div class="module-window-section-head">
                            <div>
                                <div class="module-window-section-kicker">Topology</div>
                                <div class="module-window-section-title">Arbol colapsable</div>
                            </div>
                            <div class="ontology-panel-meta">${snapshot.tree.length} raices</div>
                        </div>
                        <div class="ontology-tree-shell">
                            <ul class="ontology-tree-root" data-ontology-tree>
                                ${snapshot.tree.map((node) => this._renderTreeNode(node)).join('')}
                            </ul>
                        </div>
                    </section>

                    <aside class="ontology-panel ontology-panel-side">
                        <div class="module-window-section-head">
                            <div>
                                <div class="module-window-section-kicker">Bridge</div>
                                <div class="module-window-section-title">Lectura viva</div>
                            </div>
                        </div>
                        <div class="ontology-side-list">
                            <div class="ontology-side-item">
                                <span>RuntimeSignals</span>
                                <strong>${escapeHtml(OPEN_ONTOLOGY_MAP_SIGNAL)}</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Window appId</span>
                                <strong>${escapeHtml(WINDOW_APP_ID)}</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Observer system</span>
                                <strong>${escapeHtml(String(GALAXY_SPEC.visibleScenario?.observerSystem?.boundaryRadius ?? 0))}u</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Wisdom mode</span>
                                <strong>${escapeHtml(LULU_CANON.wisdom.referenceMode)}</strong>
                            </div>
                        </div>
                        <div class="ontology-note">
                            Usa <strong>mostrar mapa mental</strong>, <strong>mapa ontologico</strong> o <strong>LULU.system_graph()</strong> para recompilar esta vista desde el chat de LULU.
                        </div>
                        <div class="ontology-inspector" data-ontology-inspector>
                            <div class="ontology-inspector-kicker">Focus</div>
                            <div class="ontology-inspector-title">Esperando nodo</div>
                            <div class="ontology-inspector-copy">Pasa el cursor sobre una capa del cerebro del OS o fija un nodo para seguir sus dependencias.</div>
                            <div class="ontology-inspector-links">Sin conexiones activas.</div>
                        </div>
                    </aside>
                </div>
            </div>
        `;

        this.activeContent = content;
        this.activeWindow = content.closest('.glass-window') || document.getElementById(this.windowId);
        this.universeContainer = content.querySelector('[data-ontology-universe]');
        this.inspectorPanel = content.querySelector('[data-ontology-inspector]');
        this._hoverNodeId = null;
        this._pinnedNodeId = 'kernel';
        this._tiltX = 0;
        this._tiltY = 0;
        this._spotX = 50;
        this._spotY = 50;

        const expandAll = content.querySelector('[data-action="expand-all"]');
        const collapseAll = content.querySelector('[data-action="collapse-all"]');
        const refresh = content.querySelector('[data-action="refresh"]');
        const detailsNodes = () => Array.from(content.querySelectorAll('.ontology-tree-details'));

        expandAll?.addEventListener('click', () => {
            detailsNodes().forEach((node) => { node.open = true; });
        });
        collapseAll?.addEventListener('click', () => {
            detailsNodes().forEach((node, index) => { node.open = index < 1; });
        });
        refresh?.addEventListener('click', () => {
            this.open();
        });

        if (this.universeContainer) {
            this.universeContainer.style.setProperty('--ontology-cursor-x', `${this._spotX}%`);
            this.universeContainer.style.setProperty('--ontology-cursor-y', `${this._spotY}%`);
            this.universeContainer.style.transform = 'rotateX(0deg) rotateY(0deg)';
        }

        this._bindSpatialInteractions(content);
        this._applySpatialFocus(this._pinnedNodeId);
    }

    _renderMetricCard(label, value, meta) {
        return `
            <div class="ontology-metric-card">
                <span class="ontology-metric-label">${escapeHtml(label)}</span>
                <strong class="ontology-metric-value">${escapeHtml(String(value))}</strong>
                <span class="ontology-metric-meta">${escapeHtml(meta)}</span>
            </div>
        `;
    }

    _renderSpatialViewport(spatial) {
        return `
            <div class="ontology-viewport" data-ontology-viewport>
                <div class="ontology-universe" data-ontology-universe>
                    <div class="ontology-universe-glow"></div>
                    <svg class="ontology-connectors" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
                        ${spatial.links.map((link) => this._renderSpatialLink(link)).join('')}
                    </svg>
                    ${spatial.layers.map((layer) => this._renderSpatialLayer(layer)).join('')}
                </div>
            </div>
        `;
    }

    _renderSpatialLayer(layer) {
        return `
            <section class="ontology-layer ontology-layer-${escapeHtml(layer.id)}" data-layer-id="${escapeHtml(layer.id)}" style="--ontology-layer-z:${layer.z}px;">
                <div class="ontology-layer-label">${escapeHtml(layer.label)}</div>
                ${layer.nodes.map((node) => this._renderSpatialNode(node)).join('')}
            </section>
        `;
    }

    _renderSpatialNode(node) {
        const deps = Array.isArray(node.dependencies) ? node.dependencies.join(',') : '';
        return `
            <button
                type="button"
                class="ontology-spatial-node"
                data-node-id="${escapeHtml(node.id)}"
                data-node-label="${escapeHtml(node.label)}"
                data-node-summary="${escapeHtml(node.summary || '')}"
                data-node-badge="${escapeHtml(node.badge || '')}"
                data-node-meta="${escapeHtml(node.meta || '')}"
                data-dependencies="${escapeHtml(deps)}"
                style="--node-x:${node.x}%; --node-y:${node.y}%;">
                <span class="ontology-spatial-node-label">${escapeHtml(node.label)}</span>
                <span class="ontology-spatial-node-badge">${escapeHtml(node.badge || 'node')}</span>
                <span class="ontology-spatial-node-meta">${escapeHtml(node.meta || '')}</span>
            </button>
        `;
    }

    _renderSpatialLink(link) {
        return `
            <path
                class="ontology-connector ontology-connector-${escapeHtml(link.fromLayer)} ontology-connector-${escapeHtml(link.toLayer)}"
                data-link-id="${escapeHtml(link.id)}"
                data-from="${escapeHtml(link.from)}"
                data-to="${escapeHtml(link.to)}"
                d="${escapeHtml(link.path)}" />
        `;
    }

    _bindSpatialInteractions(content) {
        const nodes = Array.from(content.querySelectorAll('.ontology-spatial-node'));
        for (const node of nodes) {
            const nodeId = node.dataset.nodeId;
            if (!nodeId) continue;

            const focusNode = () => {
                this._hoverNodeId = nodeId;
                this._applySpatialFocus(nodeId);
            };
            const blurNode = () => {
                if (this._hoverNodeId === nodeId) {
                    this._hoverNodeId = null;
                }
                this._applySpatialFocus(this._pinnedNodeId);
            };

            node.addEventListener('mouseenter', focusNode);
            node.addEventListener('focus', focusNode);
            node.addEventListener('mouseleave', blurNode);
            node.addEventListener('blur', blurNode);
            node.addEventListener('click', () => {
                this._pinnedNodeId = this._pinnedNodeId === nodeId ? null : nodeId;
                this._applySpatialFocus(this._pinnedNodeId || this._hoverNodeId);
            });
        }
    }

    _collectRelatedNodeIds(nodeId) {
        const related = new Set();
        if (!nodeId || !this._spatialGraph?.links?.length) {
            return related;
        }

        related.add(nodeId);
        for (const link of this._spatialGraph.links) {
            if (link.from === nodeId) {
                related.add(link.to);
            } else if (link.to === nodeId) {
                related.add(link.from);
            }
        }
        return related;
    }

    _applySpatialFocus(nodeId = null) {
        if (!this.activeContent || !this._spatialGraph) {
            return;
        }

        const focusNodeId = nodeId || this._hoverNodeId || null;
        const related = this._collectRelatedNodeIds(focusNodeId);
        const hasFocus = related.size > 0;
        const nodes = this.activeContent.querySelectorAll('.ontology-spatial-node');
        const links = this.activeContent.querySelectorAll('.ontology-connector');

        nodes.forEach((element) => {
            const currentId = element.dataset.nodeId;
            const isFocused = !!focusNodeId && currentId === focusNodeId;
            const isRelated = !isFocused && hasFocus && related.has(currentId);
            element.classList.toggle('is-focused', isFocused);
            element.classList.toggle('is-related', isRelated);
            element.classList.toggle('is-dimmed', hasFocus && !isFocused && !isRelated);
        });

        links.forEach((element) => {
            const fromId = element.dataset.from;
            const toId = element.dataset.to;
            const isActive = !!focusNodeId && (fromId === focusNodeId || toId === focusNodeId);
            const isRelated = hasFocus && related.has(fromId) && related.has(toId);
            element.classList.toggle('is-active', isActive || isRelated);
            element.classList.toggle('is-dimmed', hasFocus && !isActive && !isRelated);
        });

        this._updateInspector(focusNodeId);
    }

    _updateInspector(nodeId) {
        if (!this.inspectorPanel || !this._spatialGraph) {
            return;
        }

        const node = this._spatialGraph.nodes.find((entry) => entry.id === nodeId) || null;
        if (!node) {
            this.inspectorPanel.innerHTML = `
                <div class="ontology-inspector-kicker">Focus</div>
                <div class="ontology-inspector-title">Esperando nodo</div>
                <div class="ontology-inspector-copy">Pasa el cursor sobre una capa del cerebro del OS o fija un nodo para seguir sus dependencias.</div>
                <div class="ontology-inspector-links">Sin conexiones activas.</div>
            `;
            return;
        }

        const relatedLabels = [];
        for (const link of this._spatialGraph.links) {
            if (link.from === node.id) {
                const match = this._spatialGraph.nodes.find((entry) => entry.id === link.to);
                if (match) relatedLabels.push(match.label);
            } else if (link.to === node.id) {
                const match = this._spatialGraph.nodes.find((entry) => entry.id === link.from);
                if (match) relatedLabels.push(match.label);
            }
        }

        this.inspectorPanel.innerHTML = `
            <div class="ontology-inspector-kicker">${escapeHtml(node.layer)}</div>
            <div class="ontology-inspector-title">${escapeHtml(node.label)}</div>
            <div class="ontology-inspector-copy">${escapeHtml(node.summary || 'Sin resumen disponible.')}</div>
            <div class="ontology-inspector-links">
                <strong>${escapeHtml(node.badge || 'node')}</strong>
                <span>${escapeHtml(node.meta || 'Sin metadata')}</span>
                <span>${escapeHtml(relatedLabels.length ? relatedLabels.join(' | ') : 'Sin dependencias directas')}</span>
            </div>
        `;
    }

    _renderTreeNode(node) {
        const label = escapeHtml(node.label);
        const badge = node.badge ? `<span class="ontology-node-badge">${escapeHtml(node.badge)}</span>` : '';
        const meta = node.meta ? `<span class="ontology-node-meta">${escapeHtml(node.meta)}</span>` : '';
        const children = Array.isArray(node.children) ? node.children : [];

        if (!children.length) {
            return `
                <li class="ontology-tree-item ontology-tree-leaf">
                    <div class="ontology-tree-node">
                        <span class="ontology-node-dot"></span>
                        <span class="ontology-node-label">${label}</span>
                        ${badge}
                        ${meta}
                    </div>
                </li>
            `;
        }

        return `
            <li class="ontology-tree-item ontology-tree-branch">
                <details class="ontology-tree-details"${node.open === false ? '' : ' open'}>
                    <summary class="ontology-tree-summary">
                        <span class="ontology-node-dot"></span>
                        <span class="ontology-node-label">${label}</span>
                        ${badge}
                        ${meta}
                    </summary>
                    <ul class="ontology-tree-children">
                        ${children.map((child) => this._renderTreeNode(child)).join('')}
                    </ul>
                </details>
            </li>
        `;
    }
}

export default LULUMindMapWindow;


