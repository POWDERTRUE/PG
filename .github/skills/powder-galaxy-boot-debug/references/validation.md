# Validation

Use the smallest boot check that proves the fix.

## Minimum Checks

- Open the app through the real project server, not a plain static server, so boot headers and runtime behavior match production.
- Confirm the original boot error is gone from the browser console.
- Confirm the kernel reaches its expected success log, ideally `[Kernel] Boot Complete`.

## Order Checks

- If the fix touched registration:
  verify the required registry key exists before the first consumer reads it.
- If the fix touched initialization:
  verify the relevant async call is still awaited and BootGraph order is intact.
- If the fix touched mount:
  verify `_mountUI()` still runs after the scene and core runtime are ready.

## Anti-Regression Checks

- No new timer-based boot patches.
- No new duplicate engine loops or double registration.
- No individual subsystem boot path that bypasses the kernel canon.
