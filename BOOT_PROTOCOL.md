# POWDER GALAXY MASTER BOOT PROTOCOL
Autonomous Engine Recovery & Diagnostics System

## [0] FAILURE AXIOMS & PRIME DIRECTIVES
When the Powder Galaxy engine fails to boot, LULU MUST act as a diagnostic architect.
- **AXIOM 1:** The UniverseKernel must NEVER crash silently. Every failure must be trapped and logged.
- **AXIOM 2:** A failure in a downstream system (e.g., UI or Networking) MUST NOT halt the Core Simulation or Render Pipeline.
- **AXIOM 3:** If LULU is tasked with repairing a boot failure, she MUST analyze the Dependency Graph before proposing code changes.

## [1] DETERMINISTIC BOOT SEQUENCE
The engine MUST boot in this exact sequence. If a phase fails, LULU must identify the specific phase and halt autonomous creation until it is resolved.
- **PHASE 1 - KERNEL IGNITION:** `UniverseKernel` initializes, creates `WebGLRenderer`, `Scene`, `Camera`, and `ServiceRegistry`.
- **PHASE 2 - CORE SERVICES:** `EventBus`, `EntityManager`, `FrameScheduler` are anchored to the registry.
- **PHASE 3 - SIMULATION:** `CelestialRegistry`, `GalaxyGenerator`, `OrbitalMechanicsSystem` are injected.
- **PHASE 4 - NAVIGATION:** `CameraRig`, `ThirdPersonCameraSystem`, `FreeFlightState` take control of the view.
- **PHASE 5 - RENDER:** `RenderPipeline`, `PostProcessing`, `InstancedRenderSystem` begin drawing.
- **PHASE 6 - UI & I/O:** `HUDManager`, `SpatialInputSystem`, `DOMWindows` become interactive.

## [2] CRITICAL ERROR RESOLUTION PROTOCOLS
When analyzing engine logs, LULU must apply these specific resolution strategies:

### A. The Registry Missing Error
**Symptom:** `[ServiceRegistry] Falla Crítica: El subsistema 'X' no existe en el registro.`
**LULU Action:**
1. Do NOT attempt to rewrite the missing subsystem immediately.
2. Check the `bootGraph` or `startPowderGalaxy.js` to see if the system was instantiated but *forgotten* to be added via `registry.register('X', system)`.
3. Check if the subsystem requesting 'X' is executing its `init()` phase BEFORE 'X' is registered. Fix the boot order.

### B. The Reference Error (Undefined Variables)
**Symptom:** `ReferenceError: THREE is not defined` (e.g., inside GalaxyGenerator).
**LULU Action:**
1. Acknowledge that the module is missing its ESM imports.
2. Output the exact `import * as THREE from 'three';` statement and specify the file path where it must be injected.
3. Verify if fallback modes were triggered and attempt to restore primary systems.

### C. The 404 Asset Protocol (Not Found)
**Symptom:** `Failed to load resource: the server responded with a status of 404 (Not Found)` (e.g., `mano_izquierda.glb`).
**LULU Action:**
1. Identify that this is a File System / Pathing error, NOT an engine logic error.
2. Instruct the human operator to verify asset placement in the `public/` or `assets/` directory.
3. Check for absolute vs. relative pathing errors in the code (e.g., `/assets/...` vs `./assets/...`).
4. Ensure spaces are removed from filenames (e.g., `mano izquierda` -> `mano_izquierda`).

## [3] AUTONOMOUS REPAIR BOUNDARIES
If the architecture is broken and the user authorizes repair, LULU may:
- Generate missing system stubs strictly following the template in `AUTONOMOUS_BUILDER.md`.
- Reorder initialization arrays in the Kernel configuration to fix dependency injection cycles.
- Suggest fallback meshes (e.g., `THREE.BoxGeometry`) when external 3D models fail to load via 404.

## [4] BLACK SCREEN TRIAGE
If the logs are clear but the screen is black, LULU must verify mathematically:
1. Are camera coordinates `(NaN, NaN, NaN)`? (Usually caused by dividing by zero in physics).
2. Is the `requestAnimationFrame` loop actually calling `renderer.render(scene, camera)`?
3. Is there a light source illuminating the materials?