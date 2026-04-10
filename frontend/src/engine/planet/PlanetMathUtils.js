// frontend/src/engine/planet/PlanetMathUtils.js
/**
 * OMEGA V31 — PlanetMathUtils
 * Fuente única de verdad para las matemáticas procedurales del planeta.
 *
 * Este módulo ES la "biblia numérica". Tanto el TerrainWorker (Web Worker thread)
 * como el LandingPhysicsSystem (Main thread) importan aquí para garantizar
 * sincronía altimétrica exacta (mismo hash, mismas octavas, mismo factor de escala).
 *
 * OMEGA LAW: Zero code duplication in procedural math pipelines.
 */

// --- Hash determinístico (LCG) ---
export function hash3D(x, y, z) {
    let h = (x * 1619 + y * 31337 + z * 6971) & 0xFFFFFFFF;
    h = (h ^ (h >>> 16)) * 0x85ebca6b;
    h = (h ^ (h >>> 13)) * 0xc2b2ae35;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296.0;
}

// Interpolación quíntica (C2-smooth, AAA quality)
export function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
export function lerp(t, a, b) { return a + t * (b - a); }

// Value Noise 3D con hash determinístico
export function noise3D(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const u = fade(x), v = fade(y), w = fade(z);

    const n000 = hash3D(X,   Y,   Z),   n100 = hash3D(X+1, Y,   Z);
    const n010 = hash3D(X,   Y+1, Z),   n110 = hash3D(X+1, Y+1, Z);
    const n001 = hash3D(X,   Y,   Z+1), n101 = hash3D(X+1, Y,   Z+1);
    const n011 = hash3D(X,   Y+1, Z+1), n111 = hash3D(X+1, Y+1, Z+1);

    return lerp(w,
        lerp(v, lerp(u, n000, n100), lerp(u, n010, n110)),
        lerp(v, lerp(u, n001, n101), lerp(u, n011, n111))
    ) * 2.0 - 1.0; // Rango [-1, 1]
}

// Fractional Brownian Motion — parámetros CANÓNICOS del motor
export const TERRAIN_NOISE_SCALE   = 1.5;  // Factor de frecuencia de entrada
export const TERRAIN_HEIGHT_FACTOR = 0.05; // Multiplicador de elevación sobre el radio

export function fbm3D(x, y, z, octaves = 6, persistence = 0.5, lacunarity = 2.0) {
    let total = 0, amplitude = 1.0, frequency = 1.0, maxValue = 0;

    for (let i = 0; i < octaves; i++) {
        total    += noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}

/**
 * evaluateTerrain(dirX, dirY, dirZ, planetRadius)
 * Devuelve la distancia radial exacta de la superficie en una dirección unitaria.
 * Esta ES la función de colisión analítica — sin mallas, sin BVH.
 */
export function evaluateTerrain(dirX, dirY, dirZ, planetRadius) {
    const noiseVal = fbm3D(
        dirX * TERRAIN_NOISE_SCALE,
        dirY * TERRAIN_NOISE_SCALE,
        dirZ * TERRAIN_NOISE_SCALE,
        6
    );
    return planetRadius + (noiseVal * planetRadius * TERRAIN_HEIGHT_FACTOR);
}

// Mapeo Tangente (Nowell) — Esfera Perfecta desde Cubo
export function mapCubeToSphere(cx, cy, cz) {
    const x2 = cx * cx, y2 = cy * cy, z2 = cz * cz;
    return {
        x: cx * Math.sqrt(1.0 - y2*0.5 - z2*0.5 + (y2*z2)/3.0),
        y: cy * Math.sqrt(1.0 - x2*0.5 - z2*0.5 + (x2*z2)/3.0),
        z: cz * Math.sqrt(1.0 - x2*0.5 - y2*0.5 + (x2*y2)/3.0)
    };
}
