function hashSeed(input) {
    const text = String(input ?? '');
    let hash = 2166136261 >>> 0;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

export function createSeededRandom(seed) {
    let state = hashSeed(seed) || 0x12345678;

    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function createGaussian(rng) {
    return (sigma = 1) => {
        const u = Math.max(1e-9, rng());
        const v = Math.max(1e-9, rng());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
    };
}

export function range(rng, min, max) {
    return min + (max - min) * rng();
}

export function int(rng, min, maxInclusive) {
    return Math.floor(range(rng, min, maxInclusive + 1));
}

export function pick(rng, items) {
    if (!Array.isArray(items) || items.length === 0) return undefined;
    return items[int(rng, 0, items.length - 1)];
}
