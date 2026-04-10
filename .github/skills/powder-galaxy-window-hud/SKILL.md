---
name: powder-galaxy-window-hud
description: Diagnose and fix Powder Galaxy pointer, HUD, DOM-overlay, or window-stack issues while preserving the ownership boundary between hardware input, pointer presentation, and UI rendering. Use when Codex is working on `PointerPresentationController`, `InputStateSystem`, `HUDManager`, pointer-lock UX, reticle classes, HUD visibility, or CSS-driven window and visor presentation.
---

# Powder Galaxy Window HUD

Use this skill for the DOM/WebGL seam. Keep the contract sharp: hardware state belongs to input, pointer visuals belong to the presentation controller, and HUD/window rendering belongs to the DOM layer.

## Read First

1. Read `references/canonical-files.md`.
2. If the bug is visual, inspect CSS before changing JS.
3. If the bug is pointer-lock or cursor behavior, inspect `PointerPresentationController.js` before touching any caller.

## Pointer Contract

- `PointerPresentationController` is the only source of truth for body-level pointer presentation.
- Do not mutate `document.body.style.cursor` or equivalent direct cursor styling anywhere else.
- Do not add ad hoc `classList` toggles for pointer state outside `PointerPresentationController`.
- Change pointer visuals by dispatching intent through `upsertIntent(source, intent)` and `clearIntent(source)`.

## Intent Model

- Use `kind` plus `priority` to arbitrate pointer state.
- Supported high-signal kinds in the live controller:
  `flight`, `ui`, `text`, `drag`.
- Typical priority ladder:
  `flight < ui < text < drag`
- Let the controller resolve the winner. Do not duplicate that arbitration in callers.

## Lock States And Fallbacks

- `flight-pending-lock` exists because the browser may defer or reject pointer lock until a valid user gesture.
- `flight-locked` means the canvas owns pointer lock and the reticle can switch to active mode.
- The controller first requests `unadjustedMovement: true`.
- If that throws `NotSupportedError`, it must fall back to a normal pointer-lock request instead of failing the feature.
- `NotAllowedError`, `SecurityError`, and similar deferred lock cases should remain explicit, not hidden by retry loops.

## Required CSS Contract

These body classes are part of the runtime contract and should stay centralized in the presentation controller plus CSS:

- `pg-pointer-ui-visible`
- `pg-pointer-text-visible`
- `pg-pointer-drag-visible`
- `pg-pointer-flight-pending`
- `pg-pointer-flight-locked`
- `pg-pointer-lock-error`
- `pg-pointer-helper-visible`
- `pg-reticle-primary-hidden`
- `pg-reticle-primary-dim`
- `pg-reticle-primary-active`
- `pg-hud-mode`

If a new visual pointer state is needed, add it through the controller-to-CSS contract, not with isolated DOM mutations in feature code.

## Separation Of Responsibilities

- `InputStateSystem`
  Owns hardware state, input accumulation, lock state observation, and spatial queries such as look deltas or HUD gating.
- `PointerPresentationController`
  Owns pointer DOM classes, helper text, reticle mode classes, pointer-lock request fallback, and visual intent arbitration.
- `HUDManager`
  Owns visor, telemetry, DOM HUD layout, and stateful HUD presentation over the canvas.

Keep these boundaries hard. If a subsystem wants to affect the pointer, it should ask the controller. If it wants to know hardware state, it should read input.

## Anti-Patterns

- Do not patch pointer races with `setTimeout` or `setInterval`.
- Do not re-request pointer lock from arbitrary states without a fresh user gesture.
- Do not let gameplay systems write CSS classes directly to emulate HUD mode or pointer mode.
- Do not move CSS-only presentation rules into JS when the class contract already exists.

## Triage Shortcuts

- Cursor wrong but input correct:
  inspect `PointerPresentationController` and body classes first.
- Look deltas wrong but cursor visuals correct:
  inspect `InputStateSystem`.
- HUD hidden, overlapping, or unclickable:
  inspect `HUDManager` plus `glass.css`.
- Window stack opens but feels visually inconsistent with HUD mode:
  inspect the shared CSS classes and `WindowManager` only after the canonical pointer/HUD files.

## What Counts As Done

- Pointer visuals still flow through intent arbitration.
- HUD mode still gates the correct DOM surfaces.
- Pointer-lock fallback still works without timer patches.
- The CSS contract remains centralized and readable.
