# Dead Code Audit

Date: 2026-04-07
Scope: `frontend/src`, repo-local architecture docs, repo-local skill surface
Mode: Static audit only. No code removal or rewiring performed.

## Method

- Read the active frontend entrypoint and HTML bootstrap.
- Inspected the current runtime kernel wiring in `frontend/src/engine/UniverseKernel.js`.
- Built a static relative-import graph for `frontend/src`.
- Cross-checked suspicious files with targeted text searches for registry keys, dynamic references, and legacy comments.
- Classified findings conservatively. Files with dynamic or registry-only traces are not treated as safe-delete until runtime wiring is confirmed.

## Status Legend

- `ACTIVE`: Referenced by the live runtime path.
- `LEGACY-COMPAT`: Still serving a compatibility bridge or soft migration path.
- `ORPHANED`: Has no confirmed runtime wiring in the current architecture.
- `ARCHIVE-CANDIDATE`: Clearly superseded by another file or explicitly deprecated.
- `NEEDS-TRACE`: Shows signs of intended use, but no confirmed runtime registration.

## Key Evidence

- Active frontend bootstrap: `frontend/index.html` loads `src/main.js`.
- Deprecated bootstrap: `frontend/src/startPowderGalaxy.js` explicitly states it is not loaded by `index.html`.
- Live engine boot path: `frontend/src/engine/UniverseKernel.js`.
- Live window path uses `frontend/src/windows/WindowManager.js`, not `frontend/src/engine/windows/WindowManager.js`.
- Live material path uses `frontend/src/engine/rendering/MaterialRegistry.js`, not `frontend/src/engine/assets/MaterialRegistry.js`.
- Live floating-origin path uses `frontend/src/engine/core/spatial/FloatingOriginSystem.js`, not `frontend/src/engine/navigation/FloatingOriginSystem.js`.
- Live spatial index path uses `frontend/src/engine/spatial/SpatialIndexSystem.js`, while several alternate implementations remain in-tree.

## Priority Findings

| Path | Category | State | Evidence | Delete Risk | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| `frontend/src/startPowderGalaxy.js` | Bootstrap | `ARCHIVE-CANDIDATE` | File is explicitly marked deprecated and `frontend/index.html` loads `src/main.js`. | Low | Move to an archive folder or remove after one final grep for external references outside `frontend/`. |
| `frontend/src/engine/assets/MaterialRegistry.js` | Duplicate core system | `ARCHIVE-CANDIDATE` | No inbound refs found; live code imports `engine/rendering/MaterialRegistry.js`. | Low | Quarantine first, then remove if no dynamic import or docs still depend on it. |
| `frontend/src/engine/navigation/FloatingOriginSystem.js` | Duplicate core system | `ARCHIVE-CANDIDATE` | No inbound refs found; kernel imports `engine/core/spatial/FloatingOriginSystem.js`. | Low | Archive or remove after doc cleanup. |
| `frontend/src/engine/windows/WindowManager.js` | Duplicate window stack | `ARCHIVE-CANDIDATE` | No inbound refs found; live kernel imports `frontend/src/windows/WindowManager.js`. | Medium | Quarantine with paired `engine/windows/systems/WindowDOMSystem.js`; verify no off-path tooling imports it. |
| `frontend/src/engine/windows/systems/WindowDOMSystem.js` | Duplicate window stack | `ARCHIVE-CANDIDATE` | Only referenced by the orphaned `engine/windows/WindowManager.js`. | Medium | Remove together with the legacy engine-window stack, not in isolation. |
| `frontend/src/engine/core/BootGraphVisualizer.js` | Duplicate devtool | `ARCHIVE-CANDIDATE` | No inbound refs found; live kernel imports `engine/devtools/BootGraphVisualizer.js`. | Low | Archive or remove after verifying no docs or scripts still import the old path. |
| `frontend/src/engine/rendering/SpatialIndexSystem.js` | Duplicate spatial index | `ORPHANED` | No inbound refs found. | Medium | Consolidate under a canonical spatial index decision before deleting. |
| `frontend/src/engine/simulation/SpatialIndexSystem.js` | Duplicate spatial index | `ORPHANED` | No inbound refs found. | Medium | Same as above; handle as part of a single spatial-index consolidation PR. |
| `frontend/src/engine/streaming/SpatialIndexSystem.js` | Duplicate spatial index | `ORPHANED` | No inbound refs found. | Medium | Same as above; consolidate before removal. |
| `frontend/src/engine/core/spatial/SpatialIndexSystem.js` | Duplicate spatial index | `NEEDS-TRACE` | Referenced by `engine/core/SystemManifest.js`, but the live kernel imports `engine/spatial/SpatialIndexSystem.js`. | Medium | Keep until `SystemManifest.js` is formally retired or rewired. |
| `frontend/src/engine/core/SystemManifest.js` | Parallel boot architecture | `NEEDS-TRACE` | Contains a second assembly model not used by `UniverseKernel.js`, but still references old paths. | High | Audit as architecture debt, not immediate deletion. Decide whether to retire it, regenerate it, or make it the true source of boot assembly. |
| `frontend/src/engine/universe/PlanetWorkerPipeline.js` | Incomplete feature chain | `NEEDS-TRACE` | No runtime registration found, but `CubeSphereLOD.js` requests `Registry.get('PlanetWorkerPipeline')`. | Medium | Keep for now; classify as dormant/incomplete. Audit the whole planet-LOD branch together. |
| `frontend/src/engine/universe/PlanetLODSystem.js` | Incomplete feature chain | `NEEDS-TRACE` | Static import chain exists from `PlanetLODSystem -> CubeSphereLOD -> PlanetWorkerPipeline`, but no kernel wiring found. | Medium | Keep for a dedicated dormant-feature audit; do not delete piecemeal yet. |
| `frontend/src/engine/universe/planets/CubeSphereLOD.js` | Incomplete feature chain | `NEEDS-TRACE` | Referenced by `PlanetLODSystem.js`, but not wired into the live kernel. | Medium | Same dormant-feature audit as above. |
| `frontend/src/engine/universe/PlanetAppSystem.js` | Dormant subsystem | `NEEDS-TRACE` | `core/apps/AppLauncher.js` expects `PlanetAppSystem` in Registry, but no runtime registration found. | Medium | Keep until app-launch flow is audited end-to-end. Likely dormant, not dead. |
| `frontend/src/core/apps/AppLauncher.js` | Dormant subsystem | `NEEDS-TRACE` | Depends on `PlanetAppSystem` and `WindowManager`, but no live kernel registration found. | Medium | Audit together with `PlanetAppSystem`. Candidate for archival if spatial app launching moved elsewhere. |
| `frontend/src/engine/workspace/BubbleLauncher.js` | Prototype UI | `ORPHANED` | No inbound refs found; only appears in an audit report comment. | Low | Quarantine first; likely safe to archive after UI owner review. |
| `frontend/src/engine/ui/lulu/LULU_KNOWLEDGE.js` | Legacy alias layer | `ORPHANED` | No inbound refs found; file itself says to use `LULUCanon.js` as the source of truth. | Low | Remove after confirming no external scripts depend on `window.LULU_UNIVERSE`. |

## Active Compatibility Layers Worth Keeping for Now

| Path | State | Reason to Keep |
| --- | --- | --- |
| `frontend/src/core/RuntimeState.js` | `LEGACY-COMPAT` | Installs global legacy bridge and is called by the live kernel. |
| `frontend/src/core/ResourceManager.js` | `LEGACY-COMPAT` | Explicitly preserves legacy sync maps and compatibility API. |
| `frontend/src/engine/core/EntityManager.js` | `LEGACY-COMPAT` | Wraps new ECS behavior with legacy-compatible APIs. |
| `frontend/src/engine/navigation/CameraStateMachine.js` | `LEGACY-COMPAT` | Contains compatibility path for legacy state aliases while still participating in the live navigation stack. |
| `frontend/src/windows/systems/WindowDOMSystem.js` | `ACTIVE` | Contains deprecated methods internally, but the file itself belongs to the active window path. Do not confuse internal deprecated methods with a dead file. |

## Architectural Drift Clusters

### 1. Spatial Index Drift

Observed implementations:

- `frontend/src/engine/spatial/SpatialIndexSystem.js`
- `frontend/src/engine/core/spatial/SpatialIndexSystem.js`
- `frontend/src/engine/rendering/SpatialIndexSystem.js`
- `frontend/src/engine/simulation/SpatialIndexSystem.js`
- `frontend/src/engine/streaming/SpatialIndexSystem.js`

Risk:

- Developers cannot tell which implementation is canonical.
- Docs, manifests, and runtime can drift independently.
- Future changes may patch the wrong file and silently fail to affect runtime.

Recommended policy:

- Declare one canonical implementation.
- Mark all others as archived or explicitly experimental.
- Update skills and docs to point to the canonical path only.

### 2. Window Stack Drift

Observed stacks:

- Active: `frontend/src/windows/*`
- Legacy/orphaned: `frontend/src/engine/windows/*`

Risk:

- UI fixes can land in the wrong stack.
- Engineers may debug non-runtime code.

Recommended policy:

- Keep only one window stack in active source.
- Archive the non-runtime stack with a note in the audit trail.

### 3. Boot Assembly Drift

Observed entry models:

- Active boot: `frontend/index.html` -> `frontend/src/main.js` -> `UniverseKernel.js`
- Legacy boot: `frontend/src/startPowderGalaxy.js`
- Parallel assembly abstraction: `frontend/src/engine/core/SystemManifest.js`

Risk:

- Conflicting mental models for how systems are created and registered.
- Old manifests continue to point at outdated paths.

Recommended policy:

- Decide whether `SystemManifest.js` is dead, future-facing, or intended to become canonical again.
- If dead, archive it.
- If future-facing, rewire it to current paths and document that it is inactive but preserved intentionally.

## Implementation Plan After Audit Approval

1. Create a quarantine batch for clear archive candidates.
2. Resolve canonical owners for spatial index, floating origin, material registry, window stack, and boot graph visualizer.
3. Audit dormant feature branches as bundles, not as individual files:
   - `PlanetLODSystem` + `CubeSphereLOD` + `PlanetWorkerPipeline`
   - `PlanetAppSystem` + `AppLauncher`
4. Update repo-local skills and docs to reference only canonical paths.
5. Remove or archive the quarantined set in a separate low-risk cleanup PR.

## Recommended First Cleanup Batch

These are the strongest low-risk candidates after one final repo-wide grep outside `frontend/src`:

- `frontend/src/startPowderGalaxy.js`
- `frontend/src/engine/assets/MaterialRegistry.js`
- `frontend/src/engine/navigation/FloatingOriginSystem.js`
- `frontend/src/engine/core/BootGraphVisualizer.js`
- `frontend/src/engine/ui/lulu/LULU_KNOWLEDGE.js`
- `frontend/src/engine/workspace/BubbleLauncher.js`

## Open Questions Before Deletion

- Does any external tooling, local script, or unpublished branch still use `SystemManifest.js`?
- Is the planet worker pipeline a paused roadmap item or an abandoned prototype?
- Does any external UI code still rely on `window.LULU_UNIVERSE` from `LULU_KNOWLEDGE.js`?
- Should archived engine-window files live under `archive/`, `docs/legacy/`, or be removed entirely after audit sign-off?
