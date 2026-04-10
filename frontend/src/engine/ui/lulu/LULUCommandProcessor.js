import * as THREE from 'three';
import { LULUCommands } from './LULUCommandRegistry.js';
import {
    LULU_CANON,
    buildUniverseTelemetry,
    findDocumentationRoutes,
    normalizeLuluText,
    parseLuluCreationPrompt,
} from './LULUCanon.js';
import {
    findWisdomByDiscipline,
    findWisdomEntries,
    getWisdomDisciplineSummary,
    isWisdomQuery,
} from './LULUWisdom.js';
import { GALAXY_SPEC } from '../../config/UniverseSpec.js';

const _capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// Base galaxy rotation speed (from spec)
const BASE_GALAXY_ROT  = 0.000035;
const FAST_GALAXY_ROT  = BASE_GALAXY_ROT * 6;
const SLOW_GALAXY_ROT  = BASE_GALAXY_ROT * 0.2;

export class LULUCommandProcessor {
    constructor(kernel, responsePanel) {
        this.kernel        = kernel;
        this.responsePanel = responsePanel;
        this.universe      = LULU_CANON;
        this._heroPosition = new THREE.Vector3(520, 10800, 4600);
        this._heroTarget   = new THREE.Vector3(0, 0, 0);

        if (typeof window !== 'undefined') window.LULU_UNIVERSE = LULU_CANON;
    }

    process(rawCommand) {
        const text = rawCommand.trim();
        if (!text) return;

        const normalized = normalizeLuluText(text);
        this.responsePanel.log(`${text}`, 'system');

        // Match registry entry
        const registryCommand = LULUCommands.find((cmd) => {
            const n = normalizeLuluText(cmd.name);
            const c = normalizeLuluText(cmd.command);
            return normalized === n || normalized === c;
        });
        const targetCommand = registryCommand?.command ?? text;

        if (this._processBuiltin(targetCommand, normalized)) return;
        if (this._handleDiagnostics(text, normalized))       return;
        if (this._handleCreation(text, normalized))           return;
        if (this._handleParticleProjector(text, normalized))  return;
        if (this._handleFraming(normalized))                  return;
        if (this._handleWisdom(text, normalized))             return;
        if (this._handleDocumentation(text, normalized))      return;
        if (this._handleUniverseStatus(normalized))           return;
        if (this._handleNavigateTo(normalized))               return;
        if (this._handleNavigation(normalized))               return;
        if (this._handleWeather(normalized))                  return;
        if (this._handlePlanetList(normalized))               return;
        if (this._handleWhereAmI(normalized))                 return;
        if (this._handleGalaxyRotation(normalized))           return;
        if (this._handleZoom(normalized))                     return;
        if (this._handleVoiceToggle(normalized))              return;

        this._showHelp();
    }

    // ── Built-in command dispatch ─────────────────────────────────────────────

    _processBuiltin(targetCommand, normalized) {
        switch (targetCommand) {
        case 'LULU.scan()':           this._reportUniverseStatus(true);  return true;
        case 'LULU.system_graph()':   this._openOntologyMap('builtin-system-graph'); return true;
        case 'LULU.performance()':    return this._invokeLuluMethod('performance',    'Telemetry brain offline.');
        case 'LULU.memory()':         return this._invokeLuluMethod('memory',         'Memory bridge offline.');
        case 'LULU.boot_analysis()':  return this._invokeLuluMethod('boot_analysis',  'Kernel diagnostic offline.');
        case 'LULU.debug_boot()':     return this._invokeLuluMethod('debug_boot',     'Kernel diagnostic offline.');
        case 'LULU.optimize_gpu()':   return this._invokeLuluMethod('optimize_gpu',   'GPU optimizer offline.');
        case 'LULU.inspect_render()': this._inspectRenderPipeline(); return true;
        case 'LULU.expand_engine()':  this._showExpansionRoadmap();  return true;
        case 'LULU.upgrade_architecture()': this._showArchitectureUpgrade(); return true;
        case 'LULU.analyze_feedback()':     this._analyzeFeedback();  return true;
        case 'LULU.show_manual()':    return this._invokeLuluMethod('show_manual', 'LULU manual offline.');
        }
        if (['manual', 'ayuda', 'help', 'lulu help'].includes(normalized)) {
            this._showHelp(); return true;
        }
        return false;
    }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    _handleDiagnostics(text, normalized) {
        if (/(mostrar mapa mental|mapa mental|mapa ontologico|ontology map|topologia de conocimiento|visualizador ontologico)/.test(normalized)) {
            this._openOntologyMap('lulu-diagnostics');
            return true;
        }
        if (/(system graph|grafo de sistemas|mapa de sistemas)/.test(normalized))
            return this._openOntologyMap('lulu-system-graph');
        if (/(rendimiento|performance|fps|draw calls)/.test(normalized))
            return this._invokeLuluMethod('performance', 'Telemetry brain offline.');
        if (/(memory|memoria|heap)/.test(normalized))
            return this._invokeLuluMethod('memory', 'Memory bridge offline.');
        if (/(boot analysis|analisis boot|diagnostico boot)/.test(normalized))
            return this._invokeLuluMethod('boot_analysis', 'Kernel diagnostic offline.');

        const m = normalizeLuluText(text).match(/(?:inspect|inspecciona|revisar|ver)\s+(?:system|sistema)\s+(.+)$/);
        if (!m) return false;
        const inspector = window.LULU?.inspect_system;
        typeof inspector === 'function' ? inspector(m[1].trim()) : this.responsePanel.log('Inspector offline.', 'error');
        return true;
    }

    // ── Creation ─────────────────────────────────────────────────────────────

    _handleCreation(text, normalized) {
        const directPrimitive = ['esfera','cubo','cilindro','cono','torus'].find(s => normalized === s);
        const wantsCreation   = directPrimitive || /(crear|genera|spawn|materializa|construye|forja)/.test(normalized);
        if (!wantsCreation) return false;

        const spawner = window.LULU_SPAWNER || this.kernel?.registry?.tryGet?.('luluSpawner') || null;
        if (!spawner?.spawnBlueprint) { this.responsePanel.log('LULU Spawner offline.', 'error'); return true; }

        const blueprint = parseLuluCreationPrompt(directPrimitive ?? text);
        const created   = spawner.spawnBlueprint(blueprint);
        if (!created) { this.responsePanel.log('No pude materializar ese objeto todavía.', 'warn'); return true; }

        this.responsePanel.log(`Materializado: ${blueprint.label}`, 'success');
        if (blueprint.planetClass) this.responsePanel.log(`Clase: ${blueprint.planetClass}`, 'info');
        this.responsePanel.log(`Escala ${blueprint.scale?.toFixed(2) ?? '1.00'} | Edit mode activo.`, 'info');
        return true;
    }

    _handleParticleProjector(text, normalized) {
        if (!/(^pp\b.*proyecto particulas|^proyecto particulas$|proyector de particulas|particle projector)/.test(normalized)) {
            return false;
        }

        const runtimeSignals = this.kernel?.runtimeSignals ?? this.kernel?.registry?.tryGet?.('RuntimeSignals') ?? null;
        if (!runtimeSignals?.emit) {
            this.responsePanel.log('Proyecto particulas offline.', 'error');
            return true;
        }

        runtimeSignals.emit('PG:LULU:REQUEST_PARTICLE_PROJECTOR', {
            source: 'lulu-command',
            command: text,
        });
        this.responsePanel.log('Proyecto particulas desplegado.', 'success');
        this.responsePanel.log('El enjambre RGB seguira tu aim y se acoplara a la primera masa detectada.', 'info');
        this.responsePanel.log('Al completar el acople, la masa quedara marcada como anfitriona de imagen.', 'info');
        return true;
    }

    // ── Framing ───────────────────────────────────────────────────────────────

    _handleFraming(normalized) {
        if (!/(ver universo|mostrar universo|encuadra galaxia|centrar galaxia|hero shot|ver galaxia)/.test(normalized)) return false;
        const nav = this.kernel?.navigationSystem;
        const rig = nav?.cameraRig ?? this.kernel?.cameraRig ?? null;
        if (!nav || !rig) { this.responsePanel.log('Navigation offline.', 'error'); return true; }
        rig.position.copy(this._heroPosition);
        if (typeof nav._computeLookQuaternion === 'function')
            nav._computeLookQuaternion(nav.targetQuaternion, rig.position, this._heroTarget);
        rig.quaternion.copy(nav.targetQuaternion ?? rig.quaternion);
        nav.setMode?.('FREE_FLIGHT', { requestPointerLock: false });
        nav._setFov?.(42, 0.8, 'power2.out');
        this.responsePanel.log('Galaxia encuadrada en vista heroica.', 'success');
        return true;
    }

    // ── Navigate to planet ────────────────────────────────────────────────────

    _handleNavigateTo(normalized) {
        const m = /(navegar a|ir a|volar a|enfocar)\s+(.+)/.exec(normalized);
        if (!m) return false;

        const rawName = m[2].trim();
        const name    = _capitalize(rawName === 'sol' ? 'MegaSun' : rawName);
        const scene   = this.kernel?.scene;
        const nav     = this.kernel?.navigationSystem;
        if (!scene || !nav) { this.responsePanel.log('Navigation offline.', 'error'); return true; }

        // Look for Planet_X or MegaSun
        let target = scene.getObjectByName(`Planet_${name}`)
                  || scene.getObjectByName(name)
                  || scene.getObjectByName(`Planet_${_capitalize(rawName)}`);

        if (!target) {
            // Try traversal
            scene.traverse(obj => { if (!target && obj.name?.toLowerCase().includes(rawName)) target = obj; });
        }
        if (!target) { this.responsePanel.log(`No encontré "${rawName}" en el sistema.`, 'warn'); return true; }

        nav.focusOn?.(target) ?? nav.setMode?.('FOCUS', { targetObject: target });
        this.responsePanel.log(`Aproximándome a ${rawName}…`, 'success');
        this.responsePanel.log(`Clase: ${target.userData?.planetClass ?? target.userData?.nodeType ?? '–'}`, 'info');
        return true;
    }

    // ── Basic navigation (free flight / stelaryi / despegar) ─────────────────

    _handleNavigation(normalized) {
        const nav = this.kernel?.navigationSystem;
        if (!nav) return false;

        if (/(vuelo libre|free flight)/.test(normalized)) {
            nav.setMode?.('FREE_FLIGHT', { requestPointerLock: false });
            this.responsePanel.log('Modo FREE_FLIGHT activado.', 'success');
            return true;
        }
        if (/(despegar|desorbit|salir del foco)/.test(normalized)) {
            nav.setMode?.('FREE_FLIGHT', { requestPointerLock: false });
            this.responsePanel.log('Despegando del foco actual.', 'success');
            return true;
        }
        if (/(stelaryi|modo estelaryi)/.test(normalized)) {
            nav.toggleStelaryi?.(nav.focusTarget || this.kernel?.interactionSystem?.getActiveTarget?.() || null);
            this.responsePanel.log('Modo STELARYI solicitado.', 'success');
            return true;
        }
        return false;
    }

    // ── Weather / planet profile ──────────────────────────────────────────────

    _handleWeather(normalized) {
        const m = /(clima|atmosfera|temperatura|perfil) (?:de|del?) (.+)/.exec(normalized);
        if (!m) return false;

        const rawName = m[2].trim();
        const cfg = GALAXY_SPEC.solarSystem.planets.find(
            p => normalizeLuluText(p.name) === normalizeLuluText(rawName)
        );
        if (!cfg) { this.responsePanel.log(`No tengo datos de "${rawName}".`, 'warn'); return true; }

        const p = cfg.bodyProfile;
        this.responsePanel.log(`── ${cfg.name} ──`, 'system');
        this.responsePanel.log(`Clase: ${cfg.class}`, 'info');
        this.responsePanel.log(`Temperatura: ${p.temperatureK}K`, 'info');
        this.responsePanel.log(`Gravedad: ${p.gravityG}g`, 'info');
        this.responsePanel.log(`Atmósfera: ${p.atmosphere}`, 'info');
        this.responsePanel.log(`Análogo: ${p.analog}`, 'info');
        this.responsePanel.log(`Período orbital: ${p.orbitalPeriodDays} días`, 'info');
        return true;
    }

    // ── Planet list ───────────────────────────────────────────────────────────

    _handlePlanetList(normalized) {
        if (!/(lista de planetas|planetas del sistema|inventario)/.test(normalized)) return false;

        const planets = GALAXY_SPEC.solarSystem.planets;
        this.responsePanel.log(`Sistema solar — ${planets.length} planetas:`, 'system');
        planets.forEach((p, i) => {
            this.responsePanel.log(
                `${i + 1}. ${p.name} | ${p.class} | r=${p.orbitRadius}u | lunas:${p.moonCount}`,
                'info'
            );
        });
        return true;
    }

    // ── Where am I ────────────────────────────────────────────────────────────

    _handleWhereAmI(normalized) {
        if (!/(donde estoy|posicion|ubicacion|coordenadas)/.test(normalized)) return false;

        const cam  = this.kernel?.camera;
        if (!cam) { this.responsePanel.log('Cámara offline.', 'error'); return true; }
        const pos  = cam.position;
        const dist = pos.length();

        const zone =
            dist < 60   ? 'Núcleo solar'
          : dist < 200  ? 'Sistema Solar interior'
          : dist < 400  ? 'Sistema Solar exterior'
          : dist < 1200 ? 'Disco galáctico interno'
          : dist < 5000 ? 'Brazos espirales'
          : 'Halo galáctico';

        this.responsePanel.log(`Posición: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`, 'info');
        this.responsePanel.log(`Zona: ${zone}`, 'info');
        this.responsePanel.log(`Distancia al centro: ${dist.toFixed(0)}u`, 'info');
        return true;
    }

    // ── Galaxy rotation speed ─────────────────────────────────────────────────

    _handleGalaxyRotation(normalized) {
        if (!/(rotar galaxia|velocidad galactica|rotacion galaxia)/.test(normalized)) return false;

        const gs = this.kernel?.galaxyGenSystem;
        if (!gs?.points) { this.responsePanel.log('Sistema galáxico no disponible.', 'warn'); return true; }

        let speed = BASE_GALAXY_ROT;
        let label = 'normal';
        if (/rapido|fast/.test(normalized))  { speed = FAST_GALAXY_ROT; label = 'rápido (×6)'; }
        if (/lento|slow/.test(normalized))   { speed = SLOW_GALAXY_ROT; label = 'lento (×0.2)'; }

        // Patch into FrameScheduler's render — use a flag on the points object
        gs.points.userData._rotOverride = speed;
        this.responsePanel.log(`Velocidad galáctica → ${label}`, 'success');
        this.responsePanel.log('Efecto visible en la siguiente vuelta.', 'info');
        return true;
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    _handleZoom(normalized) {
        if (!/(zoom in|zoom out|acercar|alejar)/.test(normalized)) return false;

        const nav = this.kernel?.navigationSystem;
        const rig = nav?.cameraRig ?? this.kernel?.cameraRig;
        if (!rig) { this.responsePanel.log('Cámara offline.', 'error'); return true; }

        const dir = /(zoom in|acercar)/.test(normalized) ? -1 : 1;
        const dist = 300 * dir;

        if (typeof nav?.setMode === 'function') {
            // Apply a forward delta by moving along camera forward vector
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.quaternion).multiplyScalar(dist);
            rig.position.addScaledVector(forward, -1);
            this.responsePanel.log(`Cámara ${dir < 0 ? 'acercada' : 'alejada'} 300u.`, 'success');
        }
        return true;
    }

    // ── Voice toggle ──────────────────────────────────────────────────────────

    _handleVoiceToggle(normalized) {
        if (!/(voz activar|voz desactivar|silenciar lulu|activar voz)/.test(normalized)) return false;
        const voice = window._luluVoice;
        if (!voice) { this.responsePanel.log('Módulo de voz no disponible.', 'warn'); return true; }

        if (/(desactivar|silenciar)/.test(normalized)) {
            voice.mute();
            this.responsePanel.log('Voz LULU silenciada.', 'success');
        } else {
            voice.unmute();
            this.responsePanel.log('Síntesis de voz activa.', 'success');
        }
        return true;
    }

    // ── Universe status ───────────────────────────────────────────────────────

    _handleWisdom(text, normalized) {
        if (!isWisdomQuery(text)) return false;

        if (/(catalogo|indice|disciplinas|mapa de sabiduria|fuente de sabiduria)/.test(normalized)) {
            const summary = getWisdomDisciplineSummary();
            this.responsePanel.log(`Fuente de sabiduria conectada: ${this.universe.wisdom.sourceCount} entradas.`, 'system');
            summary.forEach((entry) => this.responsePanel.log(`${entry.discipline} -> ${entry.count} nodos`, 'info'));
            return true;
        }

        if (/(compar|diferencia|versus|\bvs\b)/.test(normalized)) {
            const comparison = findWisdomEntries(text, { limit: 2 });
            if (comparison.length >= 2) {
                const [left, right] = comparison;
                this.responsePanel.log(`Comparativa: ${left.title} vs ${right.title}`, 'system');
                this.responsePanel.log(`${left.title}: ${left.status} | ${left.nature}`, 'info');
                this.responsePanel.log(`A favor: ${left.support}`, 'info');
                if (left.challenge) this.responsePanel.log(`Limite: ${left.challenge}`, 'warn');
                this.responsePanel.log(`${right.title}: ${right.status} | ${right.nature}`, 'info');
                this.responsePanel.log(`A favor: ${right.support}`, 'info');
                if (right.challenge) this.responsePanel.log(`Limite: ${right.challenge}`, 'warn');
                return true;
            }
        }

        const disciplineEntries = findWisdomByDiscipline(text, { limit: 6 });
        if (
            disciplineEntries.length > 0 &&
            /(fisica|biologia|genetica|matematicas|logica|neurociencia|psicologia|economia|etica|filosofia)/.test(normalized)
        ) {
            const discipline = disciplineEntries[0].discipline;
            this.responsePanel.log(`Sabiduria activa en ${discipline}:`, 'system');
            disciplineEntries.forEach((entry) => this.responsePanel.log(`${entry.title} | ${entry.status}`, 'info'));
            return true;
        }

        const matches = findWisdomEntries(text, { limit: 4 });
        if (!matches.length) {
            this.responsePanel.log('No tengo un nodo claro en la fuente de sabiduria para esa consulta todavia.', 'warn');
            return true;
        }

        const primary = matches[0];
        this.responsePanel.log(`Nodo de sabiduria: ${primary.title}`, 'system');
        this.responsePanel.log(`${primary.discipline} | ${primary.status}`, 'info');
        this.responsePanel.log(`Naturaleza: ${primary.nature}`, 'info');
        this.responsePanel.log(`A favor: ${primary.support}`, 'info');
        if (primary.challenge) this.responsePanel.log(`En contra o limite: ${primary.challenge}`, 'warn');
        if (primary.sourceRefs?.length) this.responsePanel.log(`Fuentes numericas: ${primary.sourceRefs.join(', ')}`, 'info');
        if (matches.length > 1) {
            this.responsePanel.log(`Relacionados: ${matches.slice(1).map((entry) => entry.title).join(' | ')}`, 'info');
        }
        return true;
    }

    _handleDocumentation(text, normalized) {
        if (!/(docs|documentacion|md|album|biblia|canon|manual|arquitectura|leyes)/.test(normalized)) return false;
        const routes = findDocumentationRoutes(text);
        if (!routes.length) { this.responsePanel.log('Sin ruta documental clara.', 'warn'); return true; }
        this.responsePanel.log(`${this.universe.docs.sourceCount} fuentes conectadas.`, 'system');
        routes.forEach(r => this.responsePanel.log(`${r.title} → ${r.path}`, 'info'));
        return true;
    }

    _handleUniverseStatus(normalized) {
        if (!/(estado|status|scan|telemetria|universo|diagnostico|resumen)/.test(normalized)) return false;
        this._reportUniverseStatus(false);
        return true;
    }

    _reportUniverseStatus(includeDocs) {
        const telemetry = buildUniverseTelemetry(this.kernel);
        const galaxy    = this.universe.galaxy;
        this.responsePanel.log(`Kernel ${telemetry.status} | ${telemetry.cameraState}`, 'system');
        if (telemetry.position) {
            this.responsePanel.log(
                `Cámara (${telemetry.position.x}, ${telemetry.position.y}, ${telemetry.position.z})`, 'info'
            );
        }
        this.responsePanel.log(`Galaxia Sb | ${galaxy.arms} brazos | ${telemetry.stars} estrellas`, 'info');
        this.responsePanel.log(`Disco ${galaxy.diskRadius}u | Halo ${galaxy.haloRadius}u`, 'info');
        if (includeDocs) this.responsePanel.log(`${this.universe.docs.sourceCount} docs conectados.`, 'info');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _inspectRenderPipeline() {
        this.responsePanel.log('Render pipeline inspeccionado.', 'success');
        console.log('[LULU] RenderPipeline', this.kernel?.renderPipeline);
        console.log('[LULU] Renderer.info.render', this.kernel?.renderer?.info?.render);
    }

    _showExpansionRoadmap() {
        this.responsePanel.log('Roadmap OMEGA:', 'system');
        this.responsePanel.log('› Sistemas solares procedurales', 'info');
        this.responsePanel.log('› Editor de nebulosas in-world', 'info');
        this.responsePanel.log('› Portal entre sistemas', 'info');
    }

    _showArchitectureUpgrade() {
        this.responsePanel.log('Upgrade activos:', 'system');
        this.responsePanel.log('› Canon unificado en LULUCanon', 'info');
        this.responsePanel.log('› Universo determinístico vía UniverseSpec', 'info');
        this.responsePanel.log('› Floating Origin estabiliza coordenadas', 'info');
    }

    _analyzeFeedback() {
        this.responsePanel.log('Prioridades operativas:', 'system');
        this.responsePanel.log('1. Visibilidad clara del universo', 'info');
        this.responsePanel.log('2. Navegación fluida sin drift', 'info');
        this.responsePanel.log('3. Creación in-world de objetos cósmicos', 'info');
    }

    _invokeLuluMethod(methodName, offlineMessage) {
        const method = window.LULU?.[methodName];
        if (typeof method !== 'function') { this.responsePanel.log(offlineMessage, 'error'); return true; }
        try { method.call(window.LULU); }
        catch (err) {
            console.error(`[LULU] ${methodName} falló`, err);
            this.responsePanel.log(`Error en ${methodName}. Ver consola.`, 'error');
        }
        return true;
    }

    _openOntologyMap(source = 'lulu-command') {
        const runtimeSignals = this.kernel?.runtimeSignals ?? this.kernel?.registry?.tryGet?.('RuntimeSignals') ?? null;
        const mindMapWindow = this.kernel?.luluMindMapWindow ?? this.kernel?.registry?.tryGet?.('LULUMindMapWindow') ?? null;
        if (!runtimeSignals?.emit && !mindMapWindow?.open) {
            this.responsePanel.log('Mapa ontologico offline.', 'error');
            return true;
        }

        this.responsePanel.log('Compilando red neuronal y renderizando topologia de conocimiento...', 'system');
        runtimeSignals?.emit?.('PG:UI:OPEN_ONTOLOGY_MAP', {
            source,
            command: 'ontology-map',
        }, { mirrorDom: false });
        if (!runtimeSignals?.emit && mindMapWindow?.open) {
            mindMapWindow.open();
        }
        this.responsePanel.log('Visualizador ontologico de LULU desplegado.', 'success');
        return true;
    }

    _showHelp() {
        this.responsePanel.log('Comandos LULU (presiona 1 para abrir):', 'system');
        this.responsePanel.log('navegar a gallery | clima de hologram', 'info');
        this.responsePanel.log('lista de planetas | donde estoy', 'info');
        this.responsePanel.log('crear planeta volcanico | crear nebulosa', 'info');
        this.responsePanel.log('proyecto particulas | pp proyecto particulas', 'info');
        this.responsePanel.log('mostrar mapa mental | mapa ontologico', 'info');
        this.responsePanel.log('que sabes de consciencia | sabiduria fisica', 'info');
        this.responsePanel.log('comparar relatividad y mecanica cuantica', 'info');
        this.responsePanel.log('scan engine | encuadra galaxia', 'info');
        this.responsePanel.log('rotar galaxia rapido | zoom in | voz activar', 'info');
    }
}
