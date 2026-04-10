# Validation

Use the smallest validation set that matches the change.

## Zero-GC Commands

- `npm run lint:gc`
  Standard audit after touching performance-sensitive code.
- `npm run lint:gc:strict`
  Use when the task is explicitly about REGLA 8 compliance or CI safety.
- `npm run lint:gc:report`
  Generate `tools/zero-gc-report.json` for review.

## Runtime Verification

If the change can affect boot, rendering, or runtime contracts:

- serve the app through the project backend, not a plain static server, so `SharedArrayBuffer` paths keep the required headers
- verify the browser console shows no new red errors
- verify `Boot Complete` still appears
- verify no requests hit legacy or quarantined paths

## Reminder

- `npm test` is currently a placeholder and is not proof of runtime correctness.
