# Validation

Use the smallest proof that the contract still holds.

## Static Checks

- Search for direct cursor mutations:
  `style.cursor`
  `document.body.style.cursor`
- Search for pointer intent usage:
  `upsertIntent(`
  `clearIntent(`
  `requestPointerLock(`

## Runtime Checks

- Verify HUD mode still toggles the expected DOM surfaces.
- Verify pointer lock can enter pending state, then locked state, without timer-based retries.
- Verify `NotSupportedError` fallback still allows a non-raw pointer lock request.
- Verify the body receives the expected `pg-pointer-*` and `pg-reticle-*` classes instead of ad hoc alternatives.

## Regression Checks

- No new direct body cursor writes outside `PointerPresentationController.js`
- No new timer-based pointer-lock recovery
- No feature-specific class toggles that bypass the canonical controller
