# Review Checklist

Use this checklist before and after editing Powder Galaxy engine code.

## Before Editing

- Identify the owning subsystem and its `FrameScheduler` phase.
- Identify the registry keys, `userData` fields, and public contracts the change touches.
- Read the matching docs from `references/source-map.md`.
- Decide whether the path is hot (`physics`, `simulation`, heavy render prep) or cold (boot, setup, tooling).

## Hot Path Audit

- Search for `new THREE.` inside `update`, `tick`, `execute`, and other per-frame methods.
- Search for array, object, or closure creation in hot loops if the file is performance-sensitive.
- If the code touches masses, confirm LEY 15 and `CelestialBody` ownership.
- If the code touches planet, moon, or shader materials, confirm REGLA 19 and `MaterialRegistry` ownership.

## Lifecycle Checks

- Confirm `init()`, `update(dt)`, and `dispose()` remain coherent when the subsystem uses that lifecycle.
- Dispose geometries, materials, textures, event listeners, and registry-held references on teardown.
- Preserve canonical `userData` fields expected by HUD, raycast, and physics systems.

## Validation Commands

- `npm run lint:gc`
  - Run after touching performance-sensitive engine code.
- `npm run lint:gc:strict`
  - Run when the task is specifically about REGLA 8 or CI-safe Zero-GC enforcement.
- `npm run test`
  - Available, but it is currently a placeholder; do not rely on it as proof of engine correctness.

## Triage Shortcuts

- Black screen or boot failure:
  - Check `BOOT_PROTOCOL.md`, `UniverseKernel.js`, `ServiceRegistry.js`, and the failing phase registration order.
- Orbit instability or mass-tracking bugs:
  - Check `CelestialPhysicsSystem.js`, `OrbitalMechanicsSystem.js`, `CelestialBody.js`, and `UNIVERSE_LAWS.md`.
- FPS drop or stutter:
  - Run the Zero-GC lint, inspect `dispose()` coverage, and look for duplicate materials or uncached shaders.
- HUD, LULU, or window regressions:
  - Verify the engine state source, event flow, and CSS/DOM overlays without blocking simulation.
