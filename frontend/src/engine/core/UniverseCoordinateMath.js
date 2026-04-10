/**
 * @file UniverseCoordinateMath.js
 * @description Static utilities for Double-Precision Galaxy math.
 */
export class UniverseCoordinateMath {
    /**
     * Subtracts two galaxy positions to get a local 32-bit Vector3.
     * Useful for spawning objects relative to a player.
     */
    static getLocalSub(posA, posB) {
        // Simplified for now, in V30 this will handle 128-bit precision if needed
        return {
            x: (posA.x || 0) - (posB.x || 0),
            y: (posA.y || 0) - (posB.y || 0),
            z: (posA.z || 0) - (posB.z || 0)
        };
    }
    
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

