/**
 * Vector3.js — V31 ZERO DEPENDENCY ENGINE MATH
 *
 * V31 additions:
 *   subVectors(a, b)     — set this = a - b  (used by HierarchySystem, physics)
 *   lerpVectors(a, b, t) — set this = lerp(a→b, t) (used by orbital descent)
 *   lengthSq()           — squared length (avoids sqrt, used in collision checks)
 *   toArray()            — [x, y, z] snapshot for debugging / serialization
 *   negate()             — flip sign (used in spring force calculations)
 */
export class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }

    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    addScaledVector(v, s) {
        this.x += v.x * s;
        this.y += v.y * s;
        this.z += v.z * s;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    /**
     * V31: set this = a - b (zero-alloc, mirrors THREE.Vector3.subVectors)
     * @param {Vector3} a
     * @param {Vector3} b
     */
    subVectors(a, b) {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
    }

    /**
     * V31: set this = lerp(a → b, t) (zero-alloc, mirrors THREE.Vector3.lerpVectors)
     * @param {Vector3} a
     * @param {Vector3} b
     * @param {number}  t  [0,1]
     */
    lerpVectors(a, b, t) {
        this.x = a.x + (b.x - a.x) * t;
        this.y = a.y + (b.y - a.y) * t;
        this.z = a.z + (b.z - a.z) * t;
        return this;
    }

    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }

    divideScalar(s) {
        return this.multiplyScalar(1 / s);
    }

    negate() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return this.crossVectors(this, v);
    }

    crossVectors(a, b) {
        const ax = a.x, ay = a.y, az = a.z;
        const bx = b.x, by = b.y, bz = b.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;

        return this;
    }

    /** @returns {number} squared length — avoids sqrt, use for comparisons */
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length() {
        return Math.sqrt(this.lengthSq());
    }

    normalize() {
        return this.divideScalar(this.length() || 1);
    }

    distanceTo(v) {
        return Math.sqrt(this.distanceToSquared(v));
    }

    distanceToSquared(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }

    lerp(v, alpha) {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        this.z += (v.z - this.z) * alpha;
        return this;
    }

    /** @returns {[number, number, number]} */
    toArray() {
        return [this.x, this.y, this.z];
    }

    toString() {
        return `Vector3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
    }
}


