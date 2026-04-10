import { LULU_CANON } from './LULUCanon.js';

/**
 * Legacy compatibility layer.
 * Use LULU_CANON from LULUCanon.js as the single source of truth.
 */
export const UNIVERSE_KNOWLEDGE = LULU_CANON;

if (typeof window !== 'undefined') {
    window.LULU_UNIVERSE = UNIVERSE_KNOWLEDGE;
}
