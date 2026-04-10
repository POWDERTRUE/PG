---
name: powder-galaxy-boot-debug
description: Diagnose and fix Powder Galaxy startup failures, boot-order bugs, missing registry wiring, or race conditions in the kernel startup path. Use when Codex is debugging `main.js`, `UniverseKernel.boot()`, BootGraph resolution, ServiceRegistry timing, async startup phases, or UI mount sequencing and must preserve the canonical boot chain without introducing timer-based patches.
---

# Powder Galaxy Boot Debug

Use this skill to debug startup, not gameplay. Keep the context tight: load the boot orchestrators first, identify the failing phase, then fix wiring or ordering without inventing parallel startup paths.

## Canon

Follow this chain unless the code proves a newer canonical path:

`main.js` -> `UniverseKernel.boot()` -> `BootGraphDebugger.resolveBootSequence()` -> `_mountUI()` -> final `READY`

Read `references/canonical-files.md` first. Do not start with individual gameplay systems.

## Lifecycle Phases

Classify every boot issue into one of these phases before editing code:

1. Registration
   Create kernel-owned instances and register them in `ServiceRegistry`.
   Typical failures: missing registry keys, wrong alias, duplicate registration, accessing `Registry.get(...)` before the owner exists.
2. Initialization
   Run `init()` or `initialize()` through `BootGraphDebugger`, resolve dependencies, and await async startup like galaxy build.
   Typical failures: phase-order mismatch, circular dependency, missing await, early access to a not-yet-booted subsystem.
3. Mount
   Attach UI, HUD, windows, interaction bridges, and late boot systems in `_mountUI()`, then resolve BootGraph again.
   Typical failures: DOM nodes missing, UI initialized before the scene is ready, interaction systems mounted before their registry dependencies exist.

## Workflow

1. Reproduce the failure and identify the first red error or first missing success log.
2. Map the failure to Registration, Initialization, or Mount.
3. Read only the matching canonical orchestrators from `references/canonical-files.md`.
4. Prefer fixing boot order, explicit awaits, or registry ownership instead of adding fallback timers.
5. Re-run a smoke boot and confirm the chain reaches `Boot Complete` or the new expected recovery state.

## Dogma

- Do not patch startup races with `setTimeout` or `setInterval`.
- Do not add a second `requestAnimationFrame` loop to "unstick" boot.
- Do not silently swallow boot errors; preserve explicit logging.
- Do not bypass BootGraph by calling deep subsystem `init()` methods ad hoc unless the kernel already treats that subsystem as a deliberate exception.
- Do not use direct subsystem imports as a substitute for missing registry wiring when the runtime contract is registry-based.

## High-Signal Triage

- If the error is `ServiceRegistry ... does not exist in the registry`:
  inspect registration order, registry aliases, and whether the consumer should use `tryGet()` or `waitFor()` during early boot.
- If the scene is black but logs continue:
  inspect the renderer/camera setup in `UniverseKernel.boot()`, then check whether the loop started and whether fallback or galaxy build ever completed.
- If boot reaches core systems but not UI:
  inspect `_mountUI()` and the second `resolveBootSequence()` call before touching any window or HUD subsystem.
- If BootGraph reports a dependency failure:
  fix phase order or dependency declaration first, not downstream symptoms.

## What Counts As Done

- The boot chain remains single-path and explicit.
- Startup uses formal awaits, BootGraph gates, or registry/event contracts instead of timers.
- The console no longer shows the boot failure that triggered the task.
- The engine reaches its intended boot state, ideally including `[Kernel] Boot Complete`.
