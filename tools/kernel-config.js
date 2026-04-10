#!/usr/bin/env node
/**
 * REGLA 8: kernel-config.json
 * ============================
 * Configuración formal del kernel para UNIVERSE_LAWS enforcement.
 * Leído por el validador zero-gc-lint.js y documentado en UNIVERSE_LAWS.md.
 */
export const KERNEL_CONFIG = {
    kernel_version: "2.0.0",
    laws: {
        LEY_1: {
            name: "Celestial_Dynamics",
            systems: ["CelestialPhysicsSystem", "OrbitalMechanicsSystem"],
            params: { integration: "RK4", memory_mode: "Zero-GC" }
        },
        LEY_ANCLAJE: {
            name: "Supraconsciousness_Anchor",
            target: "SupraconsciousnessMass",
            properties: { immutability: true, origin_point: [0, 0, 0] }
        }
    },
    rules: {
        RULE_4: {
            id: "NAVIGATION_RESTRICTION",
            allow_orbit_controls: false,
            dev_exceptions: ["godControls"],
            debug_only: true
        },
        RULE_8: {
            id: "ZERO_GC_ENFORCEMENT",
            forbidden_tokens: ["new Vector3", "new Quaternion", "new Matrix4", "new Euler", "new Box3", "new Spherical"],
            scope: ["physics", "simulation"],
            enforcement: "Strict_Error",
            allowed_contexts: ["constructor", "_init", "_build", "registerOrbit", "arrangeInMapMode"],
            scanner: "tools/zero-gc-lint.js",
            ci_exit_code: 1
        }
    }
};
