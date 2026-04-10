import { GALAXY_SPEC, PHYSICS_CONSTANTS } from '../../config/UniverseSpec.js';
import { LULU_WISDOM_LIBRARY, getWisdomDisciplineSummary } from './LULUWisdom.js';

export const LULU_DOCUMENT_MAP = [
    {
        path: 'ALBUM_UNIVERSAL/00_INDICE_MAESTRO.md',
        title: 'Indice maestro del Album Universal',
        tags: ['indice', 'album', 'canon', 'arquitectura', 'docs'],
    },
    {
        path: 'ALBUM_UNIVERSAL/01_NUCLEO_Y_ARQUITECTURA_CORE.md',
        title: 'Nucleo, boot, registry y scheduler',
        tags: ['core', 'boot', 'registry', 'scheduler', 'kernel', 'arquitectura'],
    },
    {
        path: 'ALBUM_UNIVERSAL/02_GENERACION_COSMICA_GALAXY.md',
        title: 'Generacion galactica y distribucion de estrellas',
        tags: ['galaxia', 'brazos', 'estrellas', 'generacion', 'nebulosas'],
    },
    {
        path: 'ALBUM_UNIVERSAL/03_GRAVEDAD_Y_FISICA_PHYSICS.md',
        title: 'Gravedad, orbitas y fisica orbital',
        tags: ['fisica', 'gravedad', 'orbitas', 'masa', 'kepler'],
    },
    {
        path: 'ALBUM_UNIVERSAL/04_NAVEGACION_ESTELAR_NAVIGATION.md',
        title: 'Camara, vuelo libre, warp y floating origin',
        tags: ['navegacion', 'camara', 'vuelo', 'warp', 'floating origin'],
    },
    {
        path: 'ALBUM_UNIVERSAL/05_SISTEMA_DE_RENDER_PIPELINE.md',
        title: 'Render, LOD, postproceso y draw calls',
        tags: ['render', 'pipeline', 'post', 'lod', 'draw calls', 'three'],
    },
    {
        path: 'ALBUM_UNIVERSAL/06_SENSORES_INPUT.md',
        title: 'Input, teclado, mouse y sensores',
        tags: ['input', 'controles', 'mouse', 'teclado'],
    },
    {
        path: 'ALBUM_UNIVERSAL/07_LOGICA_INTERACCION.md',
        title: 'Interaccion, raycast, hitboxes y eventos',
        tags: ['interaccion', 'raycast', 'hover', 'eventos', 'hitbox'],
    },
    {
        path: 'ALBUM_UNIVERSAL/10_INTERFACES_DOM.md',
        title: 'HUD, ventanas, menu inicial y apps',
        tags: ['ui', 'hud', 'ventanas', 'menu', 'apps'],
    },
    {
        path: 'LULU_UNIVERSE_BIBLE_P1.md',
        title: 'Escalas cosmicas, gravedad y floating scale',
        tags: ['biblia', 'escalas', 'gravedad', 'fisica', 'floating origin'],
    },
    {
        path: 'LULU_UNIVERSE_BIBLE_P2.md',
        title: 'Estrellas, planetas y atmosferas',
        tags: ['biblia', 'estrellas', 'planetas', 'atmosfera', 'sistema solar'],
    },
    {
        path: 'LULU_UNIVERSE_BIBLE_P3.md',
        title: 'Nebulosas, cumulos y volumen cosmico',
        tags: ['biblia', 'nebulosa', 'cumulo', 'halo', 'volumetrico'],
    },
    {
        path: 'LULU_UNIVERSE_BIBLE_P4.md',
        title: 'HUD cosmologico, interaccion y apps de planeta',
        tags: ['biblia', 'hud', 'ui', 'interaccion', 'apps'],
    },
    {
        path: 'LULU_UNIVERSE_BIBLE_P5.md',
        title: 'Streaming, LOD y rendimiento',
        tags: ['biblia', 'streaming', 'lod', 'performance', 'fps'],
    },
    {
        path: 'LULU_EVOLUTION_PLAN.md',
        title: 'Evolucion de LULU y traduccion del feedback',
        tags: ['lulu', 'evolucion', 'feedback', 'roadmap'],
    },
    {
        path: 'CLIENT_FEEDBACK.md',
        title: 'Feedback y expectativas del producto',
        tags: ['feedback', 'cliente', 'ux', 'prioridades'],
    },
    {
        path: 'UNIVERSE_LAWS.md',
        title: 'Leyes globales del universo',
        tags: ['leyes', 'universo', 'canon', 'reglas'],
    },
];

export const LULU_CREATION_LIBRARY = {
    star: {
        label: 'Estrella',
        colors: { base: '#ffe8a3', glow: '#ffd05a' },
        mass: 40,
        radius: 1.1,
    },
    planet: {
        label: 'Planeta',
        colors: { base: '#4f8cff', atmosphere: '#9ec5ff' },
        mass: 8,
        radius: 1.0,
    },
    black_hole: {
        label: 'Agujero negro',
        colors: { base: '#090909', glow: '#ff9955' },
        mass: 120,
        radius: 1.35,
    },
    nebula: {
        label: 'Nebulosa',
        colors: { base: '#44ccff', glow: '#9b5cff' },
        mass: 2,
        radius: 1.6,
    },
    cluster: {
        label: 'Cumulo estelar',
        colors: { base: '#fff2bf', glow: '#88ccff' },
        mass: 12,
        radius: 1.25,
    },
    satellite: {
        label: 'Satelite',
        colors: { base: '#cdd7e6', glow: '#7dd3fc' },
        mass: 3,
        radius: 0.75,
    },
    station: {
        label: 'Estacion orbital',
        colors: { base: '#d7dde8', glow: '#6ee7f9' },
        mass: 5,
        radius: 1.1,
    },
    asteroid: {
        label: 'Asteroide',
        colors: { base: '#8c735f', glow: '#c28f62' },
        mass: 2.5,
        radius: 0.9,
    },
    portal: {
        label: 'Portal',
        colors: { base: '#1ec8ff', glow: '#6effd6' },
        mass: 1,
        radius: 1.1,
    },
    esfera: { label: 'Esfera', mass: 1, radius: 0.5, primitive: true },
    cubo: { label: 'Cubo', mass: 2, radius: 0.866, primitive: true },
    cilindro: { label: 'Cilindro', mass: 1.5, radius: 0.65, primitive: true },
    cono: { label: 'Cono', mass: 1.2, radius: 0.65, primitive: true },
    torus: { label: 'Torus', mass: 0.8, radius: 0.55, primitive: true },
};

export function normalizeLuluText(text = '') {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function pickColor(normalized, fallback) {
    const palette = [
        { keys: ['azul', 'blue'], value: '#66aaff' },
        { keys: ['rojo', 'red'], value: '#ff6655' },
        { keys: ['verde', 'green'], value: '#55dd88' },
        { keys: ['cyan', 'teal'], value: '#3de3d6' },
        { keys: ['dorado', 'gold', 'amarillo'], value: '#ffd36b' },
        { keys: ['violeta', 'purple', 'magenta'], value: '#b77dff' },
        { keys: ['blanco', 'white'], value: '#f5f7ff' },
        { keys: ['naranja', 'orange'], value: '#ff9b54' },
    ];

    for (const entry of palette) {
        if (entry.keys.some((key) => normalized.includes(key))) {
            return entry.value;
        }
    }

    return fallback;
}

function pickScale(normalized) {
    if (/(mini|pequeno|pequena|small)/.test(normalized)) return 0.65;
    if (/(enorme|gigante|mega|colosal|huge|giant)/.test(normalized)) return 1.8;
    return 1;
}

function pickPlanetClass(normalized) {
    if (/(volcanic|volcanico)/.test(normalized)) return 'volcanic';
    if (/(desert|desierto)/.test(normalized)) return 'desert';
    if (/(ocean|oceano)/.test(normalized)) return 'ocean';
    if (/(ice|hielo)/.test(normalized)) return 'ice';
    if (/(jungle|jungla)/.test(normalized)) return 'jungle';
    if (/(gas|gaseoso|gigante gaseoso)/.test(normalized)) return 'gas_giant';
    return 'ocean';
}

export function findDocumentationRoutes(query = '') {
    const normalized = normalizeLuluText(query);

    const matches = LULU_DOCUMENT_MAP
        .map((doc) => ({
            ...doc,
            score: doc.tags.reduce((sum, tag) => sum + (normalized.includes(tag) ? 1 : 0), 0),
        }))
        .filter((doc) => normalized === '' || doc.score > 0)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

    return matches.slice(0, normalized ? 6 : 10);
}

export function parseLuluCreationPrompt(text = '') {
    const normalized = normalizeLuluText(text);
    let type = 'planet';

    if (/(agujero negro|black hole)/.test(normalized)) type = 'black_hole';
    else if (/(nebulosa|nebula)/.test(normalized)) type = 'nebula';
    else if (/(cumulo|cluster)/.test(normalized)) type = 'cluster';
    else if (/(estrella|star|sol)/.test(normalized)) type = 'star';
    else if (/(satelite|satellite|luna)/.test(normalized)) type = 'satellite';
    else if (/(estacion|station)/.test(normalized)) type = 'station';
    else if (/(asteroide|asteroid)/.test(normalized)) type = 'asteroid';
    else if (/(portal|wormhole)/.test(normalized)) type = 'portal';
    else if (/(esfera|cubo|cilindro|cono|torus)/.test(normalized)) {
        type = ['esfera', 'cubo', 'cilindro', 'cono', 'torus'].find((entry) => normalized.includes(entry)) ?? 'esfera';
    }

    const base = LULU_CREATION_LIBRARY[type] ?? LULU_CREATION_LIBRARY.planet;
    const scale = pickScale(normalized);
    const explicitColor = pickColor(normalized, null);
    const color = type === 'planet' && !explicitColor
        ? null
        : (explicitColor || base.colors?.base || null);
    const glowColor = explicitColor || base.colors?.glow || color;
    const planetClass = type === 'planet' ? pickPlanetClass(normalized) : null;
    const rings = /(ring|anillo)/.test(normalized) || planetClass === 'gas_giant';

    return {
        type,
        label: base.label,
        scale,
        color,
        glowColor,
        rings,
        planetClass,
        sourceText: text,
    };
}

export function buildUniverseTelemetry(kernel) {
    const navigation = kernel?.navigationSystem;
    const camera = kernel?.camera;
    const rendererInfo = kernel?.renderer?.info?.render;
    const points = kernel?.galaxyGenSystem?.points?.geometry?.getAttribute?.('position');
    const sectorCount =
        kernel?.sectorStreamingSystem?.activeSectors?.size ??
        kernel?.sectorStreamingSystem?.loadedSectorCount ??
        0;

    return {
        status: kernel?.state ?? 'OFFLINE',
        cameraState: navigation?.state ?? 'OFFLINE',
        position: camera ? {
            x: Number(camera.position.x.toFixed(1)),
            y: Number(camera.position.y.toFixed(1)),
            z: Number(camera.position.z.toFixed(1)),
        } : null,
        stars: points?.count ?? 0,
        drawCalls: rendererInfo?.calls ?? 0,
        activeSectors: sectorCount,
    };
}

export const LULU_CANON = {
    identity: {
        name: 'LULU',
        role: 'Universe architect, operator and administrator',
        version: 'OMEGA V30',
        mission: 'Keep the Powder Galaxy universe coherent, visible, deterministic and operable.',
    },
    docs: {
        sourceCount: LULU_DOCUMENT_MAP.length,
        primarySources: LULU_DOCUMENT_MAP,
    },
    laws: {
        gravity: `G=${PHYSICS_CONSTANTS.G}`,
        floatingOriginThreshold: 25000,
        galaxySeed: GALAXY_SPEC.seed,
        galaxyRadius: GALAXY_SPEC.haloRadius,
        diskRadius: GALAXY_SPEC.diskRadius,
        armFormula: `r = ${GALAXY_SPEC.armA} * e^(${GALAXY_SPEC.armB} * theta)`,
    },
    galaxy: {
        arms: GALAXY_SPEC.armCount,
        coreRadius: GALAXY_SPEC.coreRadius,
        bulgeRadius: GALAXY_SPEC.bulgeRadius,
        diskRadius: GALAXY_SPEC.diskRadius,
        haloRadius: GALAXY_SPEC.haloRadius,
        mainStars: GALAXY_SPEC.totalMainStars,
    },
    solarSystem: {
        sunRadius: GALAXY_SPEC.solarSystem.sun.radius,
        planets: GALAXY_SPEC.solarSystem.planets.map((planet) => ({
            name: planet.name,
            orbitRadius: planet.orbitRadius,
            className: planet.className,
        })),
    },
    creationLibrary: LULU_CREATION_LIBRARY,
    wisdom: {
        sourceCount: LULU_WISDOM_LIBRARY.length,
        disciplineSummary: getWisdomDisciplineSummary(),
        referenceMode: 'numeric-source-map-pending',
        entries: LULU_WISDOM_LIBRARY,
    },
};

if (typeof window !== 'undefined') {
    window.LULU_UNIVERSE = LULU_CANON;
    window.LULU_DOCUMENT_MAP = LULU_DOCUMENT_MAP;
    window.LULU_WISDOM_LIBRARY = LULU_WISDOM_LIBRARY;
}
