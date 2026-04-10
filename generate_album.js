/**
 * LULU ARCHITECTURAL INDEXER & AUDITOR (generate_album.js)
 * Genera el ALBUM_UNIVERSAL y audita el código fuente contra las Leyes de OMEGA V30.
 * * Ejecución: node scripts/generate_album.js
 */

const fs = require('fs');
const path = require('path');

// ─── 1. CONFIGURACIÓN DEL DOMINIO (EL MAPA DEL UNIVERSO) ───
const TARGET_DIR = path.join(__dirname, '../frontend/src');
const OUTPUT_DIR = path.join(__dirname, '../ALBUM_UNIVERSAL');

const DOMAINS = {
    '01_NUCLEO_Y_ARQUITECTURA_CORE': { path: ['core', 'engine/core', 'config', 'engine/config'], desc: 'El cimiento absoluto de OMEGA. ECS, Registry, configs y FrameScheduler.' },
    '02_INTELIGENCIA_LULU': { path: ['engine/ui/lulu'], desc: 'Sistemas operativos agénticos, paneles de LULU y procesadores de comandos.' },
    '03_GENERACION_COSMICA_GALAXY': { path: ['universe', 'engine/universe', 'engine/galaxy'], desc: 'Instanciación matemática de masas estelares y galaxias procedimentales.' },
    '04_GENERACION_PLANETARIA': { path: ['planets', 'engine/universe/planets', 'engine/universe/workers'], desc: 'Biomas, terrenos, LODs planetarios y WebWorkers.' },
    '05_GRAVEDAD_Y_FISICA_PHYSICS': { path: ['physics', 'engine/physics', 'engine/simulation', 'simulation'], desc: 'Simula órbitas N-Body usando integradores Euler.' },
    '06_NAVEGACION_ESTELAR_NAVIGATION': { path: ['navigation', 'engine/navigation', 'engine/spatial', 'engine/streaming', 'spatial', 'streaming'], desc: 'FSM de Cámara, Floating Origin y streaming de sectores.' },
    '07_SISTEMA_DE_RENDER_PIPELINE': { path: ['rendering', 'engine/rendering', 'assets', 'engine/assets'], desc: 'FrameGraphs, Post-procesado, Shaders y gestores de recursos.' },
    '08_SENSORES_INPUT': { path: ['input', 'engine/input'], desc: 'Capa HW. Abstracción de eventos de Mouse y Teclado.' },
    '09_LOGICA_INTERACCION': { path: ['interaction', 'engine/interaction'], desc: 'Raytracing, colisiones y control de guanteletes/gestos.' },
    '10_SISTEMA_OPERATIVO_WINDOWS': { path: ['windows', 'engine/windows', 'workspace', 'engine/workspace'], desc: 'Gestor de ventanas 3D/DOM, OS espacial y Mission Control.' },
    '11_TELEMETRIA_Y_HUD': { path: ['hud', 'engine/hud'], desc: 'Displays de telemetría, brújula y widgets.' },
    '12_INTERFACES_DOM': { path: ['ui', 'engine/ui', 'styles'], desc: 'Menús 2D inmersivos, Login, KernelBar y CSS.' },
    '13_RED_Y_MULTIJUGADOR': { path: ['network', 'engine/network'], desc: 'WebSockets, sincronización de estado y Remote Players.' },
    '14_HERRAMIENTAS_DEVTOOLS': { path: ['devtools', 'engine/devtools', 'engine/systems'], desc: 'Monitores de salud, BootGraphs y Drones de Notificación.' },
    '15_CONTROLADORES_RAIZ': { path: [''], desc: 'Archivos root (main.js, index.html) y scripts sobrantes.' }
};

// ─── 2. MOTOR DE AUDITORÍA ESTÁTICA PROFUNDA ───
function auditFileContent(filePath, content) {
    const warnings = [];
    
    // A. LEY 1: Búsqueda precisa dentro de update()
    let inUpdate = false;
    let bracketDepth = 0;
    let updateBody = "";
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Entrar al update()
        if (!inUpdate && /\bupdate\s*\([^)]*\)\s*\{/.test(line)) {
            inUpdate = true;
            bracketDepth = 0;
            updateBody = "";
        }

        if (inUpdate) {
            updateBody += line + "\n";
            bracketDepth += (line.match(/\{/g) || []).length;
            bracketDepth -= (line.match(/\}/g) || []).length;

            // Salir del update() y evaluar
            if (bracketDepth <= 0 && updateBody.includes('{')) {
                inUpdate = false;
                
                // Limpiar comentarios (// y /* */) para evitar falsos positivos
                const cleanBody = updateBody.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

                if (/new\s+THREE\.[a-zA-Z0-9]+/.test(cleanBody)) {
                    warnings.push('🚨 [MEMORY LEAK] Instanciación dinámica (new THREE.*) detectada dentro de update().');
                }
                
                if (/console\.(log|warn|error)\s*\(/.test(cleanBody)) {
                    warnings.push('🐌 [PERF DEGRADATION] console.log() detectado en update(). Destruye los FPS. Remuévelo.');
                }
            }
        }
    }

    // B. LEY 2: Fuga de Registry (Evitar dependencias circulares)
    if (/import\s+.*System\s+from/i.test(content) && !filePath.includes('UniverseKernel') && !filePath.includes('Registry')) {
        warnings.push('⚠️ [REGISTRY VIOLATION] Importación directa de un Sistema detectada. Usa `this.registry.get()`.');
    }

    // C. LEY 3: Disposición Obligatoria
    if (filePath.endsWith('System.js') && !/\bdispose\s*\([^)]*\)\s*\{/.test(content)) {
        warnings.push('🗑️ [MEMORY SAFETY] No se encontró el método dispose() para limpieza de RAM/VRAM.');
    }

    // D. LEY 4: Frame Sync Strict
    if (content.includes('requestAnimationFrame') && !filePath.includes('UniverseKernel') && !filePath.includes('FrameScheduler')) {
        warnings.push('⏱️ [FRAME SYNC] Llamada a requestAnimationFrame detectada fuera del Scheduler. Usa la fase del Kernel.');
    }

    return warnings;
}

// ─── 3. ESCÁNER RECURSIVO ───
function scanDirectory(dir, basePath = '') {
    let results = [];
    if (!fs.existsSync(dir)) return results; // Prevenir errores si la carpeta no existe
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.join(basePath, file).replace(/\\/g, '/');
        
        try {
            if (fs.statSync(fullPath).isDirectory()) {
                results = results.concat(scanDirectory(fullPath, relativePath));
            } else if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const warnings = file.endsWith('.js') ? auditFileContent(relativePath, content) : [];
                results.push({ file: relativePath, warnings });
            }
        } catch (e) {
            console.error(`❌ [LULU] Error leyendo archivo: ${relativePath}`, e);
        }
    });
    return results;
}

// ─── 4. GENERADOR DEL ÁLBUM UNIVERSAL ───
function buildAlbum() {
    console.log('\x1b[36m🌌 [LULU] Iniciando Escaneo Profundo Multidominio...\x1b[0m');
    
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const allFiles = scanDirectory(TARGET_DIR);
    let masterIndexContent = `# 🌌 ÁLBUM UNIVERSAL: POWDER GALAXY (BLUEPRINT MAESTRO)\n\n> **Generado el:** ${new Date().toISOString()}\n> **Directiva:** Índice arquitectónico y Reporte de Auditoría Estática de LULU.\n\n## 🗂️ Índice Jerárquico de Módulos\n\n`;
    let treeText = `## 🌳 Árbol Estructural y Auditoría\n\n\`\`\`text\nPOWDER_GALAXY/\n`;
    let totalWarnings = 0;
    
    const processedFiles = new Set();

    for (const [domainName, config] of Object.entries(DOMAINS)) {
        let domainFiles;
        
        // Si el path es vacío [''], es el recolector de basura (Raíz)
        if (config.path[0] === '') {
            domainFiles = allFiles.filter(f => !processedFiles.has(f.file));
        } else {
            // Filtrar archivos que coincidan con CUALQUIERA de las rutas del array
            domainFiles = allFiles.filter(f => {
                if (processedFiles.has(f.file)) return false;
                return config.path.some(p => f.file.includes(`/${p}/`) || f.file.startsWith(`${p}/`) || f.file === `${p}.js`);
            });
        }
        
        if (domainFiles.length === 0) continue;

        let domainContent = `# 💠 ${domainName.replace(/_/g, ' ')}\n> ${config.desc}\n\n### 📄 Archivos y Auditoría\n\n`;
        treeText += `├── ${domainName}/\n`;

        // Ordenar alfabéticamente para mayor limpieza visual
        domainFiles.sort((a, b) => a.file.localeCompare(b.file)).forEach(f => {
            processedFiles.add(f.file);
            const status = f.warnings.length > 0 ? '❌ Falla Auditoría' : '✅ Nivel Diamante';
            domainContent += `- **${f.file}** [${status}]\n`;
            
            treeText += `│   ├── ${path.basename(f.file)}\n`;

            if (f.warnings.length > 0) {
                totalWarnings += f.warnings.length;
                f.warnings.forEach(w => {
                    domainContent += `  - > ${w}\n`;
                });
            }
        });

        fs.writeFileSync(path.join(OUTPUT_DIR, `${domainName}.md`), domainContent);
        masterIndexContent += `### [💠 ${domainName.replace(/_/g, ' ')}](./${domainName}.md)\n*${config.desc}* — **${domainFiles.length} archivos**\n\n`;
    }

    treeText += `\`\`\`\n\n`;
    
    if (totalWarnings > 0) {
        masterIndexContent += `## 🚨 ALERTA DEL KERNEL: Se detectaron ${totalWarnings} violaciones arquitectónicas.\n\n`;
        console.log(`\x1b[31m⚠️ [LULU] Auditoría Finalizada con ${totalWarnings} alertas. Revisa 00_INDICE_MAESTRO.md\x1b[0m`);
    } else {
        masterIndexContent += `## 💎 ESTADO DEL KERNEL: Zero-Garbage. Todas las auditorías superadas.\n\n`;
        console.log(`\x1b[32m✅ [LULU] Nivel Diamante alcanzado. Zero-Garbage verificado en ${allFiles.length} archivos.\x1b[0m`);
    }

    masterIndexContent += treeText;
    fs.writeFileSync(path.join(OUTPUT_DIR, '00_INDICE_MAESTRO.md'), masterIndexContent);
}

buildAlbum();