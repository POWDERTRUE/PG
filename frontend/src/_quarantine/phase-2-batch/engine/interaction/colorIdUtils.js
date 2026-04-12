/**
 * colorIdUtils.js
 * OMEGA V31 — Zero-GC ID Encoder/Decoder for GPU Picking
 *
 * Transforma un Integer UUID (1..16777215) a un array RGB representable en Shader,
 * garantizando la compatibilidad con \`readPixels\` de un Render Target.
 */

export function encodeIdToRGBBytes(id) {
    if (!Number.isInteger(id) || id <= 0 || id > 0xFFFFFF) {
        throw new Error('ID fuera de rango de Hardware GPU (1..16777215)');
    }
    const r = (id >> 16) & 0xFF;
    const g = (id >> 8) & 0xFF;
    const b = id & 0xFF;
    return [r, g, b];
}

export function decodeRGBToId(r, g, b) {
    return (r << 16) | (g << 8) | (b & 0xFF);
}

export function bytesToNormalizedColor(r, g, b) {
    return [r / 255, g / 255, b / 255];
}
