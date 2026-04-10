# Validation

Run the smallest set of checks that matches the task.

## Static Checks

1. Search edited planet and moon classes for `new THREE.` inside `update`, `tick`, `simulate`, or other hot methods.
2. Search edited planet classes for direct `new THREE.ShaderMaterial` or shared-material `new THREE.MeshStandardMaterial` usage that should be owned by `MaterialRegistry`.
3. Confirm every new orbital body still extends `CelestialBody` and preserves canonical runtime markers such as `userData.celestialBodyInstance`.

## Repo Checks

1. Run `npm run lint:gc` if the change touches hot paths or per-frame code.
2. If the task changes generator wiring, recheck imports so no code reads from quarantined legacy paths.

## Runtime Checks

1. Smoke boot the engine and verify the console does not show new red errors.
2. If the task adds clouds, rings, or moons, confirm the planet renders and the hierarchy behaves without allocating new objects per frame.
3. If the task changes material registration, confirm the registry path is hit instead of a direct constructor path.
