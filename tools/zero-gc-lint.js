#!/usr/bin/env node
/**
 * zero-gc-lint.js — REGLA 8 Enforcement Tool
 * ============================================
 * Powder Galaxy / Motor OMEGA V31
 *
 * Escanea los archivos en las fases `physics` y `simulation` buscando
 * instanciación dinámica de objetos matemáticos dentro de funciones de update.
 *
 * Tokens prohibidos (dentro de funciones de actualización):
 *   new THREE.Vector3(), new THREE.Quaternion(), new THREE.Matrix4(),
 *   new THREE.Euler(), new THREE.Box3(), new THREE.Spherical()
 *
 * Modo de uso:
 *   node tools/zero-gc-lint.js              → auditoría normal
 *   node tools/zero-gc-lint.js --strict     → exit code 1 si hay violaciones (CI/pre-commit)
 *   node tools/zero-gc-lint.js --fix-report → genera zero-gc-report.json
 *
 * UNIVERSE_LAWS.md REGLA 8:
 *   Todo bucle de física que ejecute más de 60 cuerpos por frame debe usar
 *   buffers pre-asignados. La asignación de new Vector3() dentro de update()
 *   está prohibida en fases physics y simulation.
 *
 * Changelog:
 *   V31.1 — LEY 15: CelestialBody.js y MaterialRegistry.js añadidos al scope.
 *            _buildMainField, _buildNamedStars, y métodos de construcción en
 *            lista blanca (no son fases update — no violan REGLA 8).
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT      = join(__dirname, '..');
const SRC_ROOT  = join(ROOT, 'frontend', 'src', 'engine');

const STRICT_MODE   = process.argv.includes('--strict');
const FIX_REPORT    = process.argv.includes('--fix-report');
const SILENT        = process.argv.includes('--silent');

// ──────────────────────────────────────────────────────────────────────────────
// TARGET PATHS — only physics and simulation phase files (REGLA 8 scope)
// ──────────────────────────────────────────────────────────────────────────────
const TARGET_DIRS = [
    join(SRC_ROOT, 'physics'),
    join(SRC_ROOT, 'orbital'),
];

// Additional individual files registered to physics/simulation in UniverseKernel
// LEY 15 V31.1: CelestialBody.js y MaterialRegistry.js incluidos en la auditoría
const ADDITIONAL_FILES = [
    join(SRC_ROOT, 'physics',   'CelestialPhysicsSystem.js'),
    join(SRC_ROOT, 'physics',   'OrbitalMechanicsSystem.js'),
    join(SRC_ROOT, 'physics',   'CelestialBody.js'),           // LEY 15 — clase base kernel
    join(SRC_ROOT, 'galaxy',    'GalaxyGenerationSystem.js'),
    join(SRC_ROOT, 'rendering', 'MaterialRegistry.js'),        // LEY 15 — registry de shaders
    join(SRC_ROOT, 'core',      'spatial', 'FloatingOriginSystem.js'),
    join(SRC_ROOT, 'spatial',   'SpatialIndexSystem.js'),
];

// ──────────────────────────────────────────────────────────────────────────────
// FORBIDDEN PATTERN — new THREE.XxxXxx() inside an update/step/tick method
// ──────────────────────────────────────────────────────────────────────────────
const FORBIDDEN_TOKENS = [
    'Vector3', 'Quaternion', 'Matrix4', 'Matrix3',
    'Euler', 'Box3', 'Sphere', 'Spherical', 'Object3D',
];

const FORBIDDEN_RE = new RegExp(
    `new\\s+(?:THREE\\.)?(?:${FORBIDDEN_TOKENS.join('|')})\\s*\\(`,
    'g'
);

// Names that identify per-frame update functions:
// NOTE: _build*, _init*, registerOrbit, arrangeInMapMode son fases de
// CONSTRUCCIÓN/SETUP — exentas de REGLA 8. Solo se auditan los métodos de update.
const UPDATE_FUNC_NAMES = new Set([
    'update', 'fixedUpdate', 'step', 'tick', 'simulate',
    'execute', 'integrateRK4', '_gravitationalAcceleration',
    'fixedStep', '_applyGravity', '_integrateBody',
]);

// Contextos de construcción — EXCLUIDOS de la auditoría (asignación en boot es válida)
const BUILD_CONTEXTS = new Set([
    '_buildMainField', '_buildNamedStars', '_buildCentralBlackHole',
    '_buildPlanet', '_buildMoon', '_buildSatellite', '_buildSolarSystem',
    'createHierarchicalSolarSystem', 'registerOrbit',
    'registerOrbitAroundSupraconsciousness', 'arrangeInMapMode',
    'init', '_init', '_build', '_setup', 'constructor',
]);

// ──────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────────────────────────────
function collectFiles(dir) {
    const results = [];
    try {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            const stat = statSync(full);
            if (stat.isDirectory()) results.push(...collectFiles(full));
            else if (extname(entry) === '.js') results.push(full);
        }
    } catch { /* dir may not exist */ }
    return results;
}

function isInsideUpdateFunction(lines, lineIdx) {
    // Walk backwards from the violation line to find enclosing function name
    let braceDepth = 0;
    for (let i = lineIdx; i >= 0; i--) {
        const line = lines[i];
        // Count braces to determine nesting
        for (const ch of line) {
            if (ch === '}') braceDepth++;
            if (ch === '{') braceDepth--;
        }
        if (braceDepth > 0) continue; // still inside a block

        // Match any function/method declaration on this line
        const fnMatch = line.match(/(?:^|\s)([\w]+)\s*\([^)]*\)\s*\{/) ||
                        line.match(/(?:^|\s)([\w]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/);

        if (fnMatch) {
            const fnName = fnMatch[1];
            // If enclosing function is a BUILD context → whitelist (no REGLA 8 violation)
            if (BUILD_CONTEXTS.has(fnName)) return false;
            // If enclosing function is an UPDATE context → flag as violation
            if (UPDATE_FUNC_NAMES.has(fnName)) return true;
        }

        // If we hit a class definition boundary, stop searching upward
        if (/^\s*(?:class|export\s+class|static\s+\w+\s*\(|\w+\s*\([^)]*\)\s*\{)/.test(line) && i < lineIdx) {
            break;
        }
    }
    return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// SCANNER
// ──────────────────────────────────────────────────────────────────────────────
function scanFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines   = content.split('\n');
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;
        // Skip constructor declarations (pre-allocation is fine there)
        if (/constructor\s*\(/.test(line)) continue;

        let match;
        FORBIDDEN_RE.lastIndex = 0;
        while ((match = FORBIDDEN_RE.exec(line)) !== null) {
            // Only flag violations inside known update functions
            if (isInsideUpdateFunction(lines, i)) {
                violations.push({
                    file:     relative(ROOT, filePath).replace(/\\/g, '/'),
                    line:     i + 1,
                    col:      match.index + 1,
                    token:    match[0].trim(),
                    source:   line.trim(),
                });
            }
        }
    }

    return violations;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
const allFiles = [
    ...new Set([
        ...TARGET_DIRS.flatMap(collectFiles),
        ...ADDITIONAL_FILES.filter(f => { try { statSync(f); return true; } catch { return false; } }),
    ])
];

const report = { scanned: allFiles.length, violations: [], timestamp: new Date().toISOString() };
let totalViolations = 0;

for (const file of allFiles) {
    const violations = scanFile(file);
    if (violations.length > 0) {
        report.violations.push(...violations);
        totalViolations += violations.length;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// OUTPUT
// ──────────────────────────────────────────────────────────────────────────────
if (!SILENT) {
    const RESET = '\x1b[0m';
    const RED   = '\x1b[31m';
    const GREEN = '\x1b[32m';
    const CYAN  = '\x1b[36m';
    const BOLD  = '\x1b[1m';
    const GRAY  = '\x1b[90m';
    const YELL  = '\x1b[33m';

    console.log(`\n${BOLD}${CYAN}⚡ REGLA 8 — Zero-GC Lint | Motor OMEGA V31 (v31.1 — LEY 15)${RESET}`);
    console.log(`${GRAY}Archivos escaneados: ${report.scanned} | Fase: physics + simulation + CelestialBody + MaterialRegistry${RESET}\n`);

    if (totalViolations === 0) {
        console.log(`${GREEN}${BOLD}✅ Cero violaciones encontradas. Motor Zero-GC compliant.${RESET}\n`);
    } else {
        // Group by file
        const byFile = {};
        for (const v of report.violations) {
            if (!byFile[v.file]) byFile[v.file] = [];
            byFile[v.file].push(v);
        }

        for (const [file, viols] of Object.entries(byFile)) {
            console.log(`${BOLD}${RED}❌ ${file}${RESET} ${GRAY}(${viols.length} violación${viols.length > 1 ? 'es' : ''})${RESET}`);
            for (const v of viols) {
                console.log(`   ${YELL}L${v.line}:${v.col}${RESET}  ${v.source.substring(0, 80)}`);
                console.log(`   ${GRAY}↳ Token prohibido: ${BOLD}${v.token}${RESET}${GRAY} (new dentro de update/simulate/step)${RESET}`);
                console.log(`   ${GRAY}↳ Fix: mueve a constructor como this._scratch = new THREE.${v.token.replace(/new\s+(?:THREE\.)?/, '').replace(/\(.*/, '')}()${RESET}`);
                console.log();
            }
        }

        console.log(`${BOLD}${RED}⚠  Total violaciones REGLA 8: ${totalViolations}${RESET}`);
        console.log(`${GRAY}Guía de corrección → UNIVERSE_LAWS.md#regla-8${RESET}\n`);
    }
}

if (FIX_REPORT) {
    const reportPath = join(ROOT, 'tools', 'zero-gc-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    if (!SILENT) console.log(`📄 Reporte guardado en: tools/zero-gc-report.json\n`);
}

if (STRICT_MODE && totalViolations > 0) {
    process.exit(1); // Bloquea commit/CI
}

process.exit(0);
