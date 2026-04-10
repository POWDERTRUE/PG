import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const batch = [
  {
    source: 'frontend/src/startPowderGalaxy.js',
    destination: 'frontend/src/_quarantine/phase-1/startPowderGalaxy.js',
    reason: 'Deprecated bootstrap superseded by frontend/src/main.js',
  },
  {
    source: 'frontend/src/engine/assets/MaterialRegistry.js',
    destination: 'frontend/src/_quarantine/phase-1/engine/assets/MaterialRegistry.js',
    reason: 'Orphaned duplicate; active path is engine/rendering/MaterialRegistry.js',
  },
  {
    source: 'frontend/src/engine/navigation/FloatingOriginSystem.js',
    destination: 'frontend/src/_quarantine/phase-1/engine/navigation/FloatingOriginSystem.js',
    reason: 'Orphaned duplicate; active path is engine/core/spatial/FloatingOriginSystem.js',
  },
  {
    source: 'frontend/src/engine/core/BootGraphVisualizer.js',
    destination: 'frontend/src/_quarantine/phase-1/engine/core/BootGraphVisualizer.js',
    reason: 'Superseded by engine/devtools/BootGraphVisualizer.js',
  },
  {
    source: 'frontend/src/engine/ui/lulu/LULU_KNOWLEDGE.js',
    destination: 'frontend/src/_quarantine/phase-1/engine/ui/lulu/LULU_KNOWLEDGE.js',
    reason: 'Legacy alias layer superseded by LULUCanon.js',
  },
  {
    source: 'frontend/src/engine/workspace/BubbleLauncher.js',
    destination: 'frontend/src/_quarantine/phase-1/engine/workspace/BubbleLauncher.js',
    reason: 'Prototype/orphaned UI module with no confirmed runtime wiring',
  },
];

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const restore = args.has('--restore');

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, ...relativePath.split('/'));
}

function describeMove(entry) {
  return restore
    ? { from: entry.destination, to: entry.source, reason: entry.reason }
    : { from: entry.source, to: entry.destination, reason: entry.reason };
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function validatePathState(fromPath, toPath) {
  const fromExists = fs.existsSync(fromPath);
  const toExists = fs.existsSync(toPath);
  return { fromExists, toExists };
}

function run() {
  console.log(`[quarantine-batch-phase1] mode=${restore ? 'restore' : 'quarantine'} execute=${execute}`);

  let hasFailure = false;

  for (const entry of batch) {
    const move = describeMove(entry);
    const fromPath = resolveRepoPath(move.from);
    const toPath = resolveRepoPath(move.to);
    const { fromExists, toExists } = validatePathState(fromPath, toPath);

    console.log('');
    console.log(`FROM ${move.from}`);
    console.log(`TO   ${move.to}`);
    console.log(`WHY  ${move.reason}`);

    if (!fromExists && !toExists) {
      console.log('STATE missing at both source and destination');
      hasFailure = true;
      continue;
    }

    if (!fromExists && toExists) {
      console.log('STATE already moved');
      continue;
    }

    if (fromExists && toExists) {
      console.log('STATE conflict: both source and destination exist');
      hasFailure = true;
      continue;
    }

    if (!execute) {
      console.log('DRY-RUN would move this file');
      continue;
    }

    ensureParentDir(toPath);
    fs.renameSync(fromPath, toPath);
    console.log('DONE moved');
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

run();
