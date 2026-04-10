---
name: powder-galaxy-planet-migration
description: Migrate or add Powder Galaxy planets, moons, clouds, atmospheres, or ring systems under the canonical planet architecture. Use when Codex is refactoring legacy planet creation into `CelestialBody` classes, wiring orbital hierarchies, moving complex materials behind `MaterialRegistry`, or auditing planet geometry for REGLA 8, LEY 15, and REGLA 19 compliance.
---

# Powder Galaxy Planet Migration

Use this skill for planet-content architecture, not generic boot or HUD work. Keep the task anchored to the live mass, material, and geometry contracts so new worlds ship without reintroducing legacy mesh sprawl or per-frame garbage.

## Read First

1. Read `UNIVERSE_LAWS.md` only for REGLA 8, LEY 15, and REGLA 19.
2. Read `references/canonical-files.md` before opening broader folders.
3. Use `frontend/src/engine/physics/planets/TerminalPlanet.js` as the canary pattern for production planet classes.
4. If the task is specifically the Explorer migration campaign, prefer the user-local specialist skill `$migrate-powder-galaxy-phase-2` after loading this repo skill.

## Core Contracts

### LEY 15: Mass Contract

- Every orbital body with `isMass: true` must come from `CelestialBody` or a subclass such as `MoonBody`.
- Do not ship anonymous `THREE.Mesh` instances as physical planets, moons, or orbiting bodies.
- Planet-owned moon systems must be registered through the same physics/orbit graph the kernel already uses, not attached as decorative scene-only children that bypass simulation state.
- Preserve canonical `userData` and ownership markers such as `celestialBodyInstance` when constructing runtime bodies.

### REGLA 19: Material Contract

- Shared or complex planet materials must come from `MaterialRegistry.get(...)`.
- Do not instantiate `new THREE.ShaderMaterial(...)` or reusable `new THREE.MeshStandardMaterial(...)` directly inside production planet classes when the registry should own that material family.
- Clouds, atmospheres, emissive shells, and ring shaders must use stable registry ids and stable parameter shapes so shader caching remains deterministic.
- Avoid dynamic color object creation in reusable flows. Pass raw numeric colors or registry-friendly params instead of constructing throwaway `THREE.Color` instances.

### REGLA 8: Geometry And Update Contract

- `update(dt)` and other per-frame methods must remain allocation-free.
- Allocate `BufferGeometry`, `Float32Array`, scratch vectors, orbit helpers, and particle buffers once during construction or setup.
- Reuse module-level or class-owned scratch buffers for orbital math and transform work.
- Treat rings, asteroid belts, cloud shells, and atmosphere offsets as setup-time geometry problems, not per-frame object-construction problems.

## Workflow

1. Classify the task.
   Planet class migration, moon hierarchy, shader/material migration, or zero-GC geometry retrofit.
2. Open only the canonical files from `references/canonical-files.md`.
3. If the body has mass, design the class hierarchy first.
   Planet -> `CelestialBody`; moons -> `CelestialBody` subclass or `MoonBody`.
4. If the body has clouds, rings, or atmosphere layers, design the material ownership next.
   Route every reusable complex material through `MaterialRegistry.get(...)`.
5. Build geometry and typed arrays in setup only.
6. Audit the final `update` path for REGLA 8 violations before considering the task done.
7. Run the checks in `references/validation.md`.

## Accepted Patterns

- A primary planet class creates and owns moon instances, but the moons still remain real `CelestialBody` participants in the physics graph.
- Planet visuals can use layered meshes such as surface + clouds, as long as the physical owner remains the `CelestialBody` instance and shared materials come from the registry.
- Setup-time allocation is acceptable inside constructors, `_build`, `_init`, moon-registration helpers, and one-shot geometry baking.
- Small cold-path helpers are acceptable if they do not leak into scheduler-driven hot loops.

## Anti-Patterns

- `new THREE.Vector3`, `new THREE.Color`, temporary arrays, or cloned objects inside `update`, `tick`, `simulate`, or tight orbital loops.
- Scene-only moon meshes with `isMass: true` that do not inherit from `CelestialBody`.
- Direct `ShaderMaterial` construction for clouds or atmospheres inside reusable planet classes.
- Ring or particle systems that rebuild `BufferGeometry` or typed arrays every frame.
- Reading from legacy paths or anything under `frontend/src/_quarantine/`.

## What Counts As Done

- The planet, moon, or ring system follows LEY 15 ownership rules.
- Shared complex materials are routed through `MaterialRegistry`.
- Per-frame methods stay allocation-free under REGLA 8.
- The implementation follows the live canonical pattern instead of reviving legacy `THREE.Mesh` factories.
- Validation passes and the engine boots or renders without introducing new red-console errors.

## References

- Canonical files and expansion rules:
  `references/canonical-files.md`
- Validation commands and migration checks:
  `references/validation.md`
