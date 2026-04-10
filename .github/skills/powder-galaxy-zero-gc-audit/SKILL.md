---
name: powder-galaxy-zero-gc-audit
description: Audit and fix Powder Galaxy hot paths for REGLA 8 Zero-GC, LEY 15 CelestialBody inheritance, and REGLA 19 MaterialRegistry usage. Use when editing physics or simulation code, hunting per-frame allocations, migrating masses to CelestialBody, reviewing scratch-buffer usage, or verifying that shared materials go through the canonical MaterialRegistry.
---

# Powder Galaxy Zero-GC Audit

Use this skill for hot-path engine work. Optimize for deterministic runtime, zero per-frame allocation, canonical mass ownership, and shared material reuse.

## Read First

1. Read `UNIVERSE_LAWS.md` only for REGLA 8, LEY 15, and REGLA 19.
2. Read `references/canonical-files.md` to open only the live files for this audit.
3. Read `tools/zero-gc-lint.js` if the task changes audit scope or the lint result looks suspicious.

## Workflow

1. Classify the code as hot or cold.
   Hot: `update`, `fixedUpdate`, `step`, `tick`, `simulate`, `execute`, and tight loops inside scheduler phases like `physics` and `simulation`.
   Cold: `constructor`, `_init`, `_build`, setup, registration, boot, and one-shot migration helpers.
2. If the code is hot, remove `new THREE.*`, temporary arrays/objects, `clone()` chains, and throwaway closures from the per-frame path.
3. If the code touches masses, confirm LEY 15:
   every `isMass: true` object must come from `CelestialBody` and expose canonical `userData`, including `celestialBodyInstance`.
4. If the code touches shared materials, confirm REGLA 19:
   route through `MaterialRegistry.get(...)` instead of constructing complex materials inline.
5. Re-run the checks in `references/validation.md`.

## What Counts As A Violation

- REGLA 8:
  `new THREE.Vector3`, `Quaternion`, `Matrix4`, `Matrix3`, `Euler`, `Box3`, `Sphere`, `Spherical`, or `Object3D` inside per-frame methods.
- LEY 15:
  any runtime mass with `isMass: true` that is not backed by `CelestialBody`.
- REGLA 19:
  direct construction of shared complex materials in production paths when a cached `MaterialRegistry` material should own that type.

## Accepted Patterns

- Pre-allocate scratch variables once, then reuse them in hot paths.
- Import module-level scratch buffers from `CelestialBody.js` where the class contract already exposes them.
- Allocate inside constructors, `_init`, `_build`, `registerOrbit`, and other setup-only contexts when they are not called per frame.
- Use `MaterialRegistry.get(...)` for shared complex materials and release or dispose them through the registry lifecycle.

## Audit Shortcuts

- If the lint flags a false positive:
  inspect `tools/zero-gc-lint.js` before changing the engine code.
- If the code is setup-only but close to hot-path logic:
  keep the setup allocation isolated and document why it is cold.
- If a migration touches planets or moons:
  audit both `CelestialBody` inheritance and `MaterialRegistry` usage in the same pass.

## Legacy Paths To Avoid

- `frontend/src/engine/assets/MaterialRegistry.js`
- `frontend/src/engine/navigation/FloatingOriginSystem.js`
- anything under `frontend/src/_quarantine/`

## References

- Canonical files and anti-drift paths:
  `references/canonical-files.md`
- Validation commands and runtime checks:
  `references/validation.md`
