---
name: powder-galaxy
description: Repo router for Powder Galaxy engine work. Use when Codex needs the canonical map for this repository, must choose the right Powder Galaxy child skill, or is making a cross-cutting change across boot, Zero-GC, physics, rendering, HUD/window, navigation, or galaxy generation.
---

# Powder Galaxy Router

Use this skill as the top-level router for the repo. Keep it lean: identify the domain, open only the canonical files for that domain, then load the matching child skill when one exists.

## Routing

- For REGLA 8, LEY 15, REGLA 19, scratch buffers, `CelestialBody`, or `MaterialRegistry` work:
  use `$powder-galaxy-zero-gc-audit`.
- For boot failures, missing registry wiring, or phase-order bugs:
  use `$powder-galaxy-boot-debug`.
- For HUD, DOM bridge, pointer lock, or window-stack work:
  use `$powder-galaxy-window-hud`.
- For planet migration or local solar-system refactors:
  use `$powder-galaxy-planet-migration`.
  If the task is specifically the Explorer migration campaign and the user-local skill exists, layer in `$migrate-powder-galaxy-phase-2`.

## Operating Rules

- Treat `UNIVERSE_LAWS.md` as binding.
- If docs and code disagree, trust the live code first and update docs as part of the change.
- Prefer canonical active paths over legacy duplicates or anything under `_quarantine`.
- Run the checks from `references/review-checklist.md` before calling the task done.

## Canonical Entry Points

- Global architecture:
  `ALBUM_UNIVERSAL/00_INDICE_MAESTRO.md`, `ENGINE_MAP.md`, `UNIVERSE_LAWS.md`
- Runtime boot:
  `frontend/src/main.js`, `frontend/src/engine/UniverseKernel.js`, `frontend/src/engine/core/FrameScheduler.js`
- Physics and mass systems:
  `frontend/src/engine/physics/`
- Rendering and shader cache:
  `frontend/src/engine/rendering/`
- UI and windows:
  `frontend/src/hud/`, `frontend/src/windows/`, `frontend/src/engine/windows/systems/`

## Current Child Skills

- `$powder-galaxy-boot-debug`
  Focused startup diagnostics for `main.js`, `UniverseKernel`, BootGraph, and registry timing.
- `$powder-galaxy-window-hud`
  Focused pointer, HUD, DOM, and window-stack contracts for the WebGL/DOM seam.
- `$powder-galaxy-zero-gc-audit`
  Focused audit/fix flow for REGLA 8, LEY 15, and REGLA 19.
- `$powder-galaxy-planet-migration`
  Focused planet, moon, cloud, and ring migration workflow under `CelestialBody` and `MaterialRegistry`.

## Planned Children

- `powder-galaxy-dead-code-audit`
