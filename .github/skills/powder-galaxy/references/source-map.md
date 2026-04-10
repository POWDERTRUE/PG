# Source Map

Use this map to load only the docs and files needed for the current task.

## Global Entry Points

- `ALBUM_UNIVERSAL/00_INDICE_MAESTRO.md`
  - Read first for repo-wide or unclear tasks.
- `ENGINE_MAP.md`
  - Read for live scheduler order, registry keys, and system placement.
- `UNIVERSE_LAWS.md`
  - Read for hard constraints such as REGLA 8, LEY 15, and REGLA 19.

## Kernel, Boot, and Registry

- Docs:
  - `ALBUM_UNIVERSAL/01_NUCLEO_Y_ARQUITECTURA_CORE.md`
  - `BOOT_PROTOCOL.md`
- Code:
  - `frontend/src/engine/UniverseKernel.js`
  - `frontend/src/engine/core/ServiceRegistry.js`
  - `frontend/src/engine/core/FrameScheduler.js`

## Galaxy Generation and Local Solar System

- Docs:
  - `ALBUM_UNIVERSAL/02_GENERACION_COSMICA_GALAXY.md`
- Code:
  - `frontend/src/engine/universe/GalaxyGenerator.js`
  - `frontend/src/engine/galaxy/GalaxyGenerationSystem.js`
  - `frontend/src/engine/config/UniverseSpec.js`
  - `frontend/src/engine/physics/planets/TerminalPlanet.js`

## Physics and Celestial Bodies

- Docs:
  - `ALBUM_UNIVERSAL/03_GRAVEDAD_Y_FISICA_PHYSICS.md`
  - `PHYSICS_CONSTANTS.md`
- Code:
  - `frontend/src/engine/physics/CelestialPhysicsSystem.js`
  - `frontend/src/engine/physics/OrbitalMechanicsSystem.js`
  - `frontend/src/engine/physics/CelestialBody.js`

## Navigation and Camera

- Docs:
  - `ALBUM_UNIVERSAL/04_NAVEGACION_ESTELAR_NAVIGATION.md`
- Code:
  - `frontend/src/engine/navigation/UniverseNavigationSystem.js`
  - `frontend/src/engine/navigation/CameraStateMachine.js`
  - `frontend/src/engine/navigation/LandingSystem.js`

## Rendering, Shaders, and Materials

- Docs:
  - `ALBUM_UNIVERSAL/05_SISTEMA_DE_RENDER_PIPELINE.md`
  - `RENDERING_PIPELINE.md`
- Code:
  - `frontend/src/engine/rendering/RenderPipeline.js`
  - `frontend/src/engine/rendering/SceneGraph.js`
  - `frontend/src/engine/rendering/MaterialRegistry.js`
  - `frontend/src/engine/galaxy/PlanetShaderSystem.js`

## Input and Interaction

- Docs:
  - `ALBUM_UNIVERSAL/06_SENSORES_INPUT.md`
  - `ALBUM_UNIVERSAL/07_LOGICA_INTERACCION.md`
- Code:
  - `frontend/src/engine/input/SpatialInputSystem.js`
  - `frontend/src/engine/interaction/RaycastSelectionSystem.js`
  - `frontend/src/engine/interaction/InteractionEventSystem.js`

## HUD, DOM, Windows, and LULU

- Docs:
  - `ALBUM_UNIVERSAL/10_INTERFACES_DOM.md`
  - `ALBUM_UNIVERSAL/11_CONTROLADORES_RAIZ.md`
- Code:
  - `frontend/src/engine/input/PointerPresentationController.js`
  - `frontend/src/engine/input/InputStateSystem.js`
  - `frontend/src/hud/HUDManager.js`
  - `frontend/src/styles/glass.css`
  - `frontend/src/windows/WindowManager.js`
  - `frontend/src/windows/systems/WindowDOMSystem.js`
  - `frontend/src/engine/windows/systems/WindowBridgeSystem.js`
  - `frontend/src/engine/ui/lulu/`

## Rule for Doc Drift

If docs and code disagree, trust the current code for behavior and update the relevant docs if your task changes the contract.
