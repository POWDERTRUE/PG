# Canonical Files

Load these first and in this order.

## Primary Chain

- `frontend/src/main.js`
  Browser entrypoint and the only canonical caller of `new UniverseKernel()` plus `await kernel.boot()`.
- `frontend/src/engine/UniverseKernel.js`
  Canonical startup orchestrator. Owns registration, phase sequencing, galaxy build await, loop start, and `_mountUI()`.
- `frontend/src/engine/devtools/BootGraphDebugger.js`
  Formal dependency and phase gate for `init()` / `initialize()` order.

## Registry and Boot Contracts

- `frontend/src/engine/core/ServiceRegistry.js`
  Canonical runtime registry, alias rules, `get`, `tryGet`, and `waitFor`.
- `BOOT_PROTOCOL.md`
  Repo boot doctrine and triage language for startup failures.

## Optional Instrumentation

- `frontend/src/engine/devtools/BootGraphVisualizer.js`
  Runtime graph inspection helper when the live registry shape is part of the problem.
