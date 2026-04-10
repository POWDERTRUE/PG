# Quarantine Batch Phase 1

Date: 2026-04-07
Mode: Prepared only. Not executed.
Goal: Move the lowest-risk legacy/orphaned files into `frontend/src/_quarantine/phase-1/` without deleting them.

## Important Runtime Note

The current frontend is not wired as a Vite or Webpack app in this repo snapshot.

- Active entrypoint: `frontend/index.html`
- Active module bootstrap: `frontend/src/main.js`
- Runtime assembly: direct browser ES modules plus import maps

That means residual imports will surface at page boot and module load time, not at a bundler compile step. The quarantine move is still a valid stress test, but the failure mode will be:

- browser module resolution failure during boot, or
- a static grep finding stale import paths after the move.

## Batch Scope

This batch intentionally excludes ambiguous dormant systems such as:

- `PlanetWorkerPipeline`
- `PlanetLODSystem`
- `PlanetAppSystem`
- `AppLauncher`
- `SystemManifest`
- any `SpatialIndexSystem` variant beyond the clearly orphaned low-risk set

Those belong to a later audit phase because they may represent incomplete features rather than dead code.

## Files To Move

| Source | Destination | Rationale |
| --- | --- | --- |
| `frontend/src/startPowderGalaxy.js` | `frontend/src/_quarantine/phase-1/startPowderGalaxy.js` | Explicitly deprecated bootstrap superseded by `src/main.js`. |
| `frontend/src/engine/assets/MaterialRegistry.js` | `frontend/src/_quarantine/phase-1/engine/assets/MaterialRegistry.js` | Orphaned duplicate; live code uses `engine/rendering/MaterialRegistry.js`. |
| `frontend/src/engine/navigation/FloatingOriginSystem.js` | `frontend/src/_quarantine/phase-1/engine/navigation/FloatingOriginSystem.js` | Orphaned duplicate; live kernel uses `engine/core/spatial/FloatingOriginSystem.js`. |
| `frontend/src/engine/core/BootGraphVisualizer.js` | `frontend/src/_quarantine/phase-1/engine/core/BootGraphVisualizer.js` | Superseded by `engine/devtools/BootGraphVisualizer.js`. |
| `frontend/src/engine/ui/lulu/LULU_KNOWLEDGE.js` | `frontend/src/_quarantine/phase-1/engine/ui/lulu/LULU_KNOWLEDGE.js` | Legacy alias layer superseded by `LULUCanon.js`. |
| `frontend/src/engine/workspace/BubbleLauncher.js` | `frontend/src/_quarantine/phase-1/engine/workspace/BubbleLauncher.js` | Prototype/orphaned UI module with no confirmed runtime wiring. |

## Prepared Execution Commands

### 1. Dry run

```powershell
node tools/quarantine-batch-phase1.js
```

### 2. Execute quarantine move

```powershell
node tools/quarantine-batch-phase1.js --execute
```

### 3. Restore the batch if anything breaks

```powershell
node tools/quarantine-batch-phase1.js --restore --execute
```

## Equivalent Manual PowerShell Moves

Use these only if you do not want the scripted path.

```powershell
New-Item -ItemType Directory -Force 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\assets' | Out-Null
New-Item -ItemType Directory -Force 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\navigation' | Out-Null
New-Item -ItemType Directory -Force 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\core' | Out-Null
New-Item -ItemType Directory -Force 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\ui\lulu' | Out-Null
New-Item -ItemType Directory -Force 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\workspace' | Out-Null

Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\startPowderGalaxy.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\startPowderGalaxy.js'
Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\engine\assets\MaterialRegistry.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\assets\MaterialRegistry.js'
Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\engine\navigation\FloatingOriginSystem.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\navigation\FloatingOriginSystem.js'
Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\engine\core\BootGraphVisualizer.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\core\BootGraphVisualizer.js'
Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\engine\ui\lulu\LULU_KNOWLEDGE.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\ui\lulu\LULU_KNOWLEDGE.js'
Move-Item -LiteralPath 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\engine\workspace\BubbleLauncher.js' -Destination 'C:\xampp\htdocs\Powder_Galaxy\frontend\src\_quarantine\phase-1\engine\workspace\BubbleLauncher.js'
```

## Runtime Verification Files

After the move, these are the first files to verify because they sit on or near the live runtime path:

- `frontend/index.html`
- `frontend/src/main.js`
- `frontend/src/engine/UniverseKernel.js`
- `frontend/src/windows/WindowManager.js`
- `frontend/src/windows/systems/WindowDOMSystem.js`
- `frontend/src/engine/rendering/MaterialRegistry.js`
- `frontend/src/engine/core/spatial/FloatingOriginSystem.js`
- `frontend/src/engine/devtools/BootGraphVisualizer.js`
- `frontend/src/engine/ui/lulu/LULUCanon.js`

## Static Greps To Run After Execution

### JS/TS/HTML imports and module references

```powershell
Get-ChildItem -Path 'C:\xampp\htdocs\Powder_Galaxy\frontend' -Recurse -Include *.js,*.ts,*.html -File |
  Select-String -Pattern 'startPowderGalaxy\.js|engine/assets/MaterialRegistry\.js|engine/navigation/FloatingOriginSystem\.js|engine/core/BootGraphVisualizer\.js|LULU_KNOWLEDGE\.js|BubbleLauncher\.js'
```

Expected result:

- No runtime source file should still import these quarantine targets.
- Documentation hits are acceptable in this phase and can be cleaned up later.

### Repo-wide non-runtime references worth tracking

These will likely still appear after the move and should not block the quarantine batch:

- `BOOT_PROTOCOL.md`
- `ALBUM_UNIVERSAL/11_CONTROLADORES_RAIZ.md`
- `ALBUM_UNIVERSAL/01_NUCLEO_Y_ARQUITECTURA_CORE.md`
- `ALBUM_UNIVERSAL/04_NAVEGACION_ESTELAR_NAVIGATION.md`
- `LULU_UNIVERSE_BIBLE_P4.md`
- `docs/dead-code-audit.md`

## Smoke Test Checklist After Execution

1. Open `frontend/index.html`.
2. Confirm `src/main.js` still boots without module-resolution errors.
3. Confirm `window.engine` is created.
4. Confirm no console error mentions a missing moved file.
5. Confirm the initial scene, HUD layer, and window layer still mount.

## Exit Criteria

The quarantine batch is considered successful when:

- all six files exist under `frontend/src/_quarantine/phase-1/`,
- none remain in their old paths,
- the static grep finds no live runtime imports to the old paths, and
- boot through `frontend/index.html` still succeeds.
