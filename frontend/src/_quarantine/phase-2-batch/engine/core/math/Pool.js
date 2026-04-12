import * as THREE from 'three';

/**
 * Pool.js — V31 Global Math Object Pools
 *
 * Eliminates GC spikes by recycling high-frequency Three.js math objects.
 *
 * V31 changes:
 *   • VectorPool.tmp(slot) replaces the single-instance tmp() to prevent
 *     aliasing when two systems use "tmp" in the same call chain.
 *     8 pre-allocated slots (0–7). Use by convention: e.g. physics uses 0-2,
 *     hierarchy uses 3-5, etc.
 *   • Added EulerPool (frequently allocated in HierarchySystem rotations)
 *   • Added globalPoolStats() for EngineDebugPanel
 *
 * Usage:
 *   const v = VectorPool.acquire();
 *   // ... use v ...
 *   VectorPool.release(v);
 *
 *   // Quick temporary (no release needed — reused via slot)
 *   const tmp = VectorPool.tmp(0).set(1, 2, 3);
 */

// ── Vector3 Pool ──────────────────────────────────────────────────────────────

export class VectorPool {
    static _stack   = [];
    static _maxSize = 1000;
    static _tmpSlots = Array.from({ length: 8 }, () => new THREE.Vector3());

    /** @returns {THREE.Vector3} pooled instance (caller must release) */
    static acquire() {
        return this._stack.pop() || new THREE.Vector3();
    }

    /** @param {THREE.Vector3} v */
    static release(v) {
        if (this._stack.length < this._maxSize) {
            this._stack.push(v.set(0, 0, 0));
        }
    }

    /**
     * V31: tmp(slot) — 8 pre-allocated scratch vectors.
     * Use immediately; do NOT hold across async boundaries.
     * Slot 0-2: physics / orbit   Slot 3-5: hierarchy / mesh sync
     * Slot 6-7: UI / cockpit
     * @param {0|1|2|3|4|5|6|7} [slot=0]
     * @returns {THREE.Vector3}
     */
    static tmp(slot = 0) {
        return this._tmpSlots[slot & 7]; // bitwise AND ensures 0–7
    }
}

// ── Quaternion Pool ───────────────────────────────────────────────────────────

export class QuaternionPool {
    static _stack   = [];
    static _maxSize = 200;

    static acquire() {
        return this._stack.pop() || new THREE.Quaternion();
    }

    static release(q) {
        if (this._stack.length < this._maxSize) {
            this._stack.push(q.identity());
        }
    }
}

// ── Matrix4 Pool ──────────────────────────────────────────────────────────────

export class MatrixPool {
    static _stack   = [];
    static _maxSize = 100;

    static acquire() {
        return this._stack.pop() || new THREE.Matrix4();
    }

    static release(m) {
        if (this._stack.length < this._maxSize) {
            this._stack.push(m.identity());
        }
    }
}

// ── Euler Pool (V31) ──────────────────────────────────────────────────────────

export class EulerPool {
    static _stack   = [];
    static _maxSize = 100;

    static acquire() {
        return this._stack.pop() || new THREE.Euler();
    }

    static release(e) {
        if (this._stack.length < this._maxSize) {
            this._stack.push(e.set(0, 0, 0));
        }
    }
}

// ── Global Stats (for EngineDebugPanel) ───────────────────────────────────────

/** @returns {{ vectors: number, quaternions: number, matrices: number, eulers: number }} */
export function globalPoolStats() {
    return {
        vectors:     VectorPool._stack.length,
        quaternions: QuaternionPool._stack.length,
        matrices:    MatrixPool._stack.length,
        eulers:      EulerPool._stack.length,
    };
}


