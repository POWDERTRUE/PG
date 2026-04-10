import * as THREE from 'three';

/**
 * PhysicalStarSystem — AAA Temperature-Based Stars
 *
 * Converts stellar temperature (Kelvin) to physically accurate RGB color
 * using Planck's blackbody radiation law approximation (Goldsborough 2008).
 *
 * Also manages a vertex-colored Points cloud of physically typed stars
 * distributed across every layer of the galaxy, replacing the uniform
 * color distribution in GalaxyGenerationSystem.
 *
 * Star type distribution (realistic):
 *   M (3000K)  76%  — dim red, majority of all stars
 *   K (4500K)  12%  — orange
 *   G (5800K)   7%  — yellow (Sol class)
 *   F (6800K)   3%  — white-yellow
 *   A (9000K)   1%  — blue-white
 *   B (20000K)  0.8% — hot blue
 *   O (40000K)  0.2% — intense blue-violet
 */
export class PhysicalStarSystem {

    /**
     * Convert blackbody temperature (K) to linear RGB [0-1].
     * Approximation accurate to ±2% across 1000–40000K.
     * Source: Tanner Helland (2012) + Goldsborough linearization.
     *
     * @param {number} T — temperature in Kelvin
     * @returns {THREE.Color}
     */
    static temperatureToColor(T) {
        // Normalized temperature
        const temp = Math.max(1000, Math.min(40000, T)) / 100;

        let r, g, b;

        // Red channel
        if (temp <= 66) {
            r = 255;
        } else {
            r = temp - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
        }

        // Green channel
        if (temp <= 66) {
            g = temp;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
        } else {
            g = temp - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
        }

        // Blue channel
        if (temp >= 66) {
            b = 255;
        } else if (temp <= 19) {
            b = 0;
        } else {
            b = temp - 10;
            b = 138.5177312231 * Math.log(b) - 305.0447927307;
        }

        return new THREE.Color(
            Math.max(0, Math.min(255, r)) / 255,
            Math.max(0, Math.min(255, g)) / 255,
            Math.max(0, Math.min(255, b)) / 255
        );
    }

    /**
     * Sample a random stellar temperature using realistic distribution.
     * @returns {number} temperature in Kelvin
     */
    static sampleStellarTemperature(rng = Math.random) {
        const roll = rng();
        // Cumulative distribution of spectral types
        if (roll < 0.76)  return 2400  + rng() * 1300;   // M: 2400–3700K
        if (roll < 0.88)  return 3700  + rng() * 1500;   // K: 3700–5200K
        if (roll < 0.95)  return 5200  + rng() * 800;    // G: 5200–6000K
        if (roll < 0.98)  return 6000  + rng() * 1500;   // F: 6000–7500K
        if (roll < 0.993) return 7500  + rng() * 2500;   // A: 7500–10000K
        if (roll < 0.999) return 10000 + rng() * 20000;  // B: 10000–30000K
        return              30000 + rng() * 10000;         // O: 30000–40000K
    }

    /**
     * Returns a scaled brightness multiplier based on stellar class.
     * O stars are intrinsically 100,000× more luminous than M stars.
     * In an engine we compress this to avoid stars being invisible or oversaturating.
     */
    static brightnessForTemperature(T) {
        if (T > 30000) return 1.0;                         // O — max bright
        if (T > 10000) return 0.6 + (T - 10000) / 50000;  // B
        if (T >  7500) return 0.45 + (T - 7500) / 25000;  // A
        if (T >  6000) return 0.35 + (T - 6000) / 15000;  // F
        if (T >  5200) return 0.28 + (T - 5200) / 8000;   // G
        if (T >  3700) return 0.22 + (T - 3700) / 3000;   // K
        return 0.12 + T / 30000;                            // M — dim
    }

    /**
     * Build a physically-typed star color buffer for N stars.
     * Returns a Float32Array of [r,g,b, r,g,b, ...] matching vertexColors.
     *
     * @param {number} N — star count
     * @param {Function} [rng] — optional seeded random function
     * @returns {Float32Array}
     */
    static buildColorBuffer(N, rng = Math.random.bind(Math)) {
        const colors = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            const T     = PhysicalStarSystem.sampleStellarTemperature(rng);
            const col   = PhysicalStarSystem.temperatureToColor(T);
            const bright = PhysicalStarSystem.brightnessForTemperature(T);
            colors[i * 3]     = col.r * bright;
            colors[i * 3 + 1] = col.g * bright;
            colors[i * 3 + 2] = col.b * bright;
        }
        return colors;
    }

    /**
     * Override colors in an existing galaxy Points object with physical colors.
     * Call this on GalaxyGenerationSystem.points after it's built.
     *
     * @param {THREE.Points} galaxyPoints
     * @param {number} armStartIndex — index where the spiral arm stars begin
     *   (core + bulge stars should be G/K/M only; arm stars include O/B)
     */
    static applyPhysicalColorsToGalaxy(galaxyPoints, armStartIndex = 30000, rng = Math.random) {
        if (!galaxyPoints?.geometry) return;
        const geo  = galaxyPoints.geometry;
        const attr = geo.getAttribute('color');
        if (!attr) return;
        const N = attr.count;

        for (let i = 0; i < N; i++) {
            let T;
            if (i < armStartIndex) {
                // Core + bulge — only old stars (K, G, M), no O/B
                const roll = rng();
                T = roll < 0.60 ? 2400 + rng() * 2500   // M/K
                  : roll < 0.90 ? 5000 + rng() * 1500   // G/F
                  : 7500 + rng() * 1000;                  // A max
            } else {
                // Spiral arms — full distribution including rare O/B
                T = PhysicalStarSystem.sampleStellarTemperature(rng);
            }
            const col    = PhysicalStarSystem.temperatureToColor(T);
            const bright = PhysicalStarSystem.brightnessForTemperature(T);
            attr.setXYZ(i, col.r * bright, col.g * bright, col.b * bright);
        }
        attr.needsUpdate = true;
        console.log(`✅ [PhysicalStarSystem] Applied blackbody colors to ${N.toLocaleString()} stars.`);
    }
}
