# Canonical Files

Open these first. Expand outward only if the task includes generator wiring or cross-system integration.

## Primary Canon

- `frontend/src/engine/physics/CelestialBody.js`
  Base ownership, runtime body contract, and reusable scratch-state expectations.
- `frontend/src/engine/rendering/MaterialRegistry.js`
  Shared material cache and factory entry point for emissive, cloud, atmosphere, and other reusable shaders.
- `frontend/src/engine/physics/planets/TerminalPlanet.js`
  Canary implementation for a production planet class under the new inheritance model.

## Expand Only When Needed

- `frontend/src/engine/universe/GalaxyGenerator.js`
  Read when the task changes spawn wiring, planet selection, or local solar-system assembly.
- `frontend/src/engine/galaxy/PlanetShaderSystem.js`
  Read when the task touches planet-specific shader coordination outside the planet class itself.

## Legacy Paths To Ignore

- `frontend/src/engine/assets/MaterialRegistry.js`
- anything under `frontend/src/_quarantine/`
