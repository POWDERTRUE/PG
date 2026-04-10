// inject_wisdom.js — extiende LULUWisdom.js con 13 nuevas entradas
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'engine', 'ui', 'lulu', 'LULUWisdom.js');
let content = fs.readFileSync(filePath, 'utf8');

// Marker: the last entry closing before ]);
const MARKER = "        keywords: ['bien', 'etica', 'normatividad'],\n    }),\n]);";
const idx = content.indexOf(MARKER);
if (idx === -1) {
    // Already injected — check if we added our entries
    if (content.includes('rayleigh_scattering')) {
        console.log('[inject_wisdom] Already injected. Skipping.');
        process.exit(0);
    }
    console.error('[inject_wisdom] Marker not found and not already injected!');
    process.exit(1);
}

const EXTRA_ENTRIES = `        keywords: ['bien', 'etica', 'normatividad'],
    }),

    // ── RENDERIZADO 3D / GRAFICOS ──────────────────────────────────────────
    freezeEntry('rayleigh_scattering', {
        discipline: 'Fisica / Graficos 3D',
        title: 'Dispersion de Rayleigh',
        nature: 'Fenomeno fisico de optica de ondas',
        status: 'Aceptado',
        support: 'El cielo es azul porque moleculas pequenas dispersan luz de onda corta (ley inversa de la cuarta potencia de la longitud de onda). Base del raymarching en OMEGA V31 PlanetShaderSystem con 8 pasos.',
        challenge: 'El limbo tangente tiene rutas 10x mas largas que el cenith. Reducir de 16 a 8 pasos recupera 10 a 15 FPS en hardware de gama media.',
        sourceRefs: ['OMEGA-PlanetShaderSystem'],
        aliases: ['rayleigh', 'dispersion rayleigh', 'cielo azul', 'scattering'],
        keywords: ['atmosfera', 'raymarching', 'shader', 'longitud de onda'],
    }),
    freezeEntry('beer_lambert', {
        discipline: 'Fisica / Graficos 3D',
        title: 'Ley de Beer-Lambert',
        nature: 'Universal — atenuacion exponencial de luz en medios',
        status: 'Aceptado',
        support: 'T = exp(-sigma d). Define cuanta luz del terreno PBR sobrevive al cruzar la atmosfera. En OMEGA V31 el alpha del shader = 1.0 - transmitancia con guard alpha > 0.001 para evitar division por cero.',
        challenge: 'Si alpha es cercano a 0 en el vacio, inscatter/alpha genera valores HDR que hacen explotar el Bloom. El guard alpha > 0.001 devuelve color negro en el vacio.',
        sourceRefs: ['OMEGA-PlanetShaderSystem'],
        aliases: ['beer lambert', 'transmitancia', 'atenuacion exponencial'],
        keywords: ['volumen', 'densidad optica', 'blending', 'webgl', 'bloom'],
    }),
    freezeEntry('float32_precision', {
        discipline: 'Matematicas Computacionales',
        title: 'Perdida de Precision Float32',
        nature: 'Limitacion fundamental del hardware GPU',
        status: 'Conocido — mitigado con Floating Origin en OMEGA V31',
        support: 'GPU opera con float32 y solo 7 digitos significativos. A 100000u del origen solo quedan 2 digitos para posiciones relativas, causando shimmering y z-fighting.',
        challenge: 'La unica solucion robusta es el Floating Origin: mantener la camara siempre cerca del origen moviendo el universo.',
        sourceRefs: ['OMEGA-FloatingOriginSystem'],
        aliases: ['float32', 'precision flotante', 'jitter', 'shimmering'],
        keywords: ['gpu', 'coordenadas', 'precision numerica', 'mundos grandes'],
    }),
    freezeEntry('zero_gc_engine', {
        discipline: 'Ingenieria de Software',
        title: 'Zero-GC — Sin Garbage Collection en tiempo real',
        nature: 'Patron de diseño para motores de alto rendimiento',
        status: 'Ley numero 3 del motor OMEGA V31',
        support: 'El GC de JavaScript pausa el hilo principal al liberar memoria. OMEGA V31 usa pools pre-alocados como TerrainChunkPool con 1000 mallas. El linter zero-gc-lint.js verifica compliance automaticamente.',
        challenge: 'Todo vector temporal debe ser pre-declarado en el constructor. Jamas instanciar con new dentro de update(). La disciplina debe mantenerse en cada sistema registrado.',
        sourceRefs: ['OMEGA-UNIVERSE_LAWS', 'OMEGA-TerrainChunkPool'],
        aliases: ['zero gc', 'cero gc', 'pool de objetos', 'zero gc compliance', 'sin new'],
        keywords: ['javascript', 'rendimiento', 'memoria', 'pool', 'buffer'],
    }),
    freezeEntry('floating_origin', {
        discipline: 'Graficos 3D / Fisica de Juegos',
        title: 'Floating Origin',
        nature: 'Tecnica para mundos a escala real sin jitter float32',
        status: 'Implementado en OMEGA V31 — activo solo en modo planetario',
        support: 'Cuando la camara supera 5000u del origen, el universeLayer se desplaza en sentido opuesto regresando la camara al centro. La escena parece moverse pero la camara siempre tiene maxima precision.',
        challenge: 'Debe ejecutarse en fase post-navigation. Si corre antes, el motor detecta el shift y lo corrige inmediatamente creando rubberbanding o hyper-shifting.',
        sourceRefs: ['OMEGA-FloatingOriginSystem', 'OMEGA-UNIVERSE_LAWS'],
        aliases: ['floating origin', 'origen flotante', 'hyper shifting', 'rubberbanding'],
        keywords: ['coordenadas', 'mundos grandes', 'precision', 'shift'],
    }),
    freezeEntry('quadtree_sphere', {
        discipline: 'Graficos 3D / Algoritmos',
        title: 'QuadTree LOD Planetario',
        nature: 'Subdivision adaptiva de malla por distancia camara-nodo',
        status: 'Implementado en OMEGA V31 sobre CubeSphere de 6 caras',
        support: 'Cada cara del planeta es un QuadTree independiente. Los nodos se dividen al acercarse y fusionan al alejarse. La geometria se genera en TerrainWorker via Transferable ArrayBuffer para zero-copy entre threads.',
        challenge: 'Los chunks del pool estan en Layer 1. Sin Layer isolation, computeBoundingSphere sobre buffers vacios devuelve NaN y el RaycastSelectionSystem crashea 60 veces por segundo.',
        sourceRefs: ['OMEGA-QuadTreeSphere', 'OMEGA-TerrainChunkPool'],
        aliases: ['quadtree', 'lod terreno', 'cubo esfera', 'terrain pool', 'terrain chunk'],
        keywords: ['subdivision', 'worker', 'mesh', 'planeta', 'chunk', 'layer'],
    }),
    freezeEntry('bootgraph_omega', {
        discipline: 'Ingenieria de Software',
        title: 'BootGraph OMEGA — Arranque Determinista en 7 Fases',
        nature: 'Grafo de dependencias para inicializacion segura',
        status: 'Implementado en OMEGA V31',
        support: 'Fases: CORE entonces RENDERING entonces SIMULATION entonces PHYSICS entonces NAVIGATION entonces UI entonces POST. Registry.freeze() al final impide inyecciones tardias.',
        challenge: 'Todo sistema que acceda al Registry fuera de su fase causa ReferenceError (Kernel Panic). El PHASE_ORDER del FrameScheduler es ley inmutable.',
        sourceRefs: ['OMEGA-UniverseKernel', 'OMEGA-ServiceRegistry'],
        aliases: ['bootgraph', 'secuencia boot', 'kernel panic', 'boot sequence', 'registry freeze'],
        keywords: ['inicializacion', 'dependencias', 'freeze', 'phase order', 'kernel'],
    }),

    // ── MECANICA ORBITAL ───────────────────────────────────────────────────
    freezeEntry('kepler_laws', {
        discipline: 'Fisica / Astronomia',
        title: 'Leyes de Kepler',
        nature: 'Descripcion matematica de orbitas elipticas',
        status: 'Aceptado',
        support: 'Primera ley: orbitas son elipses. Segunda ley: areas iguales en tiempos iguales. Tercera ley: el cuadrado del periodo es proporcional al cubo del semieje mayor. Base de OrbitalMechanicsSystem.',
        challenge: 'Solo exacto para dos cuerpos ideales. Perturbaciones de otros planetas requieren integracion numerica RK4.',
        sourceRefs: ['OMEGA-OrbitalMechanicsSystem'],
        aliases: ['kepler', 'orbitas elipticas', 'leyes de kepler', 'periodo orbital'],
        keywords: ['elipse', 'semieje mayor', 'excentricidad', 'orbita gravitacional'],
    }),
    freezeEntry('hohmann_transfer', {
        discipline: 'Fisica / Ingenieria Espacial',
        title: 'Transferencia de Hohmann',
        nature: 'Maniobra orbital de minima energia',
        status: 'Estandar en viajes interplanetarios',
        support: 'Dos quemados: el primero eleva la apoapsida al radio objetivo y el segundo circulariza. Minimo delta-v para orbitas coplanares. MacroWarpSystem usa este principio.',
        challenge: 'Solo funciona entre orbitas coplanares. Cambios de inclinacion orbital son extremadamente costosos en delta-v.',
        sourceRefs: ['OMEGA-MacroWarpSystem'],
        aliases: ['hohmann', 'transferencia de orbita', 'delta v minimo'],
        keywords: ['delta v', 'orbita', 'warp', 'interplanetario'],
    }),

    // ── ASTROFISICA ────────────────────────────────────────────────────────
    freezeEntry('stellar_classification', {
        discipline: 'Astronomia / Astrofisica',
        title: 'Clasificacion Espectral Estelar OBAFGKM',
        nature: 'Sistema de clasificacion por temperatura y color',
        status: 'Aceptado — estandar de la IAU',
        support: 'O mayor de 30000K azul, B, A, F, G Sol G2V amarillo, K, M menor de 3500K roja. OMEGA V31 usa esta distribucion en CosmicBackgroundSystem para 18000 estrellas de fondo con tamaños y brillos calibrados.',
        challenge: 'Tipo O son esplendorosas pero viven solo 1 a 10 millones de años. Tipo M son las mas abundantes al 70 por ciento de la galaxia pero invisibles a simple vista.',
        sourceRefs: ['OMEGA-CosmicBackgroundSystem', 'OMEGA-GalaxyGenerator'],
        aliases: ['obafgkm', 'tipo espectral', 'clasificacion estelar', 'clase g', 'tipo m'],
        keywords: ['temperatura estelar', 'color estrella', 'luminosidad', 'espectro'],
    }),
    freezeEntry('hertzsprung_russell', {
        discipline: 'Astronomia / Astrofisica',
        title: 'Diagrama de Hertzsprung-Russell',
        nature: 'Mapa de la evolucion estelar: luminosidad vs temperatura',
        status: 'Aceptado',
        support: 'La Secuencia Principal agrupa estrellas en fusion de hidrogeno. Gigantes rojas y enanas blancas son fases evolutivas posteriores. El Sol permanecera en la Secuencia Principal otros 5000 millones de años.',
        challenge: 'Las estrellas no evolucionan en escala humana. El diagrama se construye de cumulos estelares de distintas edades usando el turnoff point.',
        sourceRefs: ['OMEGA-GalaxyGenerator'],
        aliases: ['diagrama hr', 'hertzsprung russell', 'secuencia principal', 'gigante roja', 'enana blanca'],
        keywords: ['luminosidad', 'temperatura', 'evolucion estelar', 'main sequence'],
    }),
    freezeEntry('dark_matter', {
        discipline: 'Cosmologia',
        title: 'Materia Oscura',
        nature: 'Hipotetica — masa invisible que no interactua electromagneticamente',
        status: 'Inferida — sin confirmacion directa',
        support: 'Las curvas de rotacion galactica planas no se explican con la masa visible. Representa 27 por ciento del contenido energetico del universo y forma halos invisibles alrededor de galaxias.',
        challenge: 'Ningun experimento ha detectado WIMPs ni axiones. MOND o gravedad modificada es alternativa no descartada.',
        sourceRefs: ['OMEGA-GalaxyGenerator'],
        aliases: ['materia oscura', 'dark matter', 'wimps', 'halo oscuro', 'curva de rotacion'],
        keywords: ['galaxia', 'masa invisible', 'cosmologia', 'gravedad'],
]);`;

content = content.slice(0, idx) + EXTRA_ENTRIES;
fs.writeFileSync(filePath, content, 'utf8');
console.log('[inject_wisdom] Done — 13 new entries injected into LULUWisdom.js');
