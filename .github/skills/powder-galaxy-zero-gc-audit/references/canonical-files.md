# Canonical Files

Read only the files that match the audit you are performing.

## Laws and Enforcement

- `UNIVERSE_LAWS.md`
  Read only REGLA 8, LEY 15, and REGLA 19.
- `tools/zero-gc-lint.js`
  Read when changing lint scope or investigating a false positive.

## Canonical Hot Paths

- `frontend/src/engine/physics/CelestialPhysicsSystem.js`
- `frontend/src/engine/physics/OrbitalMechanicsSystem.js`
- `frontend/src/engine/physics/CelestialBody.js`
- `frontend/src/engine/rendering/MaterialRegistry.js`
- `frontend/src/engine/core/spatial/FloatingOriginSystem.js`
- `frontend/src/engine/spatial/SpatialIndexSystem.js`

## Setup Files That Often Touch the Same Contracts

- `frontend/src/engine/universe/GalaxyGenerator.js`
- `frontend/src/engine/galaxy/GalaxyGenerationSystem.js`

These files are usually cold-path setup code, not per-frame loops. Audit them for LEY 15 and REGLA 19 first, and for REGLA 8 only if logic has been moved into scheduler-driven methods.

## Legacy Paths To Avoid

- `frontend/src/engine/assets/MaterialRegistry.js`
- `frontend/src/engine/navigation/FloatingOriginSystem.js`
- `frontend/src/_quarantine/`
