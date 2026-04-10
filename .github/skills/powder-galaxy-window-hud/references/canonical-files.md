# Canonical Files

Read these first and in this order.

## Pointer And Input

- `frontend/src/engine/input/PointerPresentationController.js`
- `frontend/src/engine/input/InputStateSystem.js`

## HUD Presentation

- `frontend/src/hud/HUDManager.js`

## CSS Contract

- `frontend/src/styles/glass.css`

## Expand Only If Needed

If the issue is specifically about window opening, minimizing, or DOM bridge lifecycle after the core pointer/HUD contract is understood, then read:

- `frontend/src/windows/WindowManager.js`
- `frontend/src/windows/systems/WindowDOMSystem.js`
