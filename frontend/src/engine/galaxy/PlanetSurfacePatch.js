/**
 * PlanetSurfacePatch.js — Powder Galaxy v2.0.0
 *
 * Creates a GPU-displaced terrain plane that hugs the surface of a planet mesh
 * during orbital descent. Fully disposed when descent ends.
 *
 * Design:
 *   - PlaneGeometry(size, size, 96, 96) is projected onto the sphere via a
 *     vertex shader that adds undulating value-noise height displacement.
 *   - Color tint matches the planet class via a simple uniform sampled in the
 *     fragment shader alongside the existing PlanetShaderSystem canvas texture.
 *   - Only visible when camera altitude < VISIBILITY_ALTITUDE.
 *
 * Usage:
 *   const patch = new PlanetSurfacePatch(planetMesh, 'ocean');
 *   patch.attach();   // adds mesh to planet parent
 *   patch.update(cameraPosition);  // call every frame for fade
 *   patch.detach();   // removes from scene, disposes GPU resources
 */
import * as THREE from 'three';

const VISIBILITY_ALTITUDE = 320;   // units above planet surface
const PATCH_SEGMENTS      = 80;

const _camLocal = new THREE.Vector3();

// ── GLSL ─────────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
    uniform float uTime;
    uniform float uPlanetRadius;
    uniform vec3  uPlanetCenter;
    uniform float uPatchSize;

    varying vec2  vUv;
    varying float vHeight;

    // Simple 3-octave value noise (no texture lookup needed)
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i + vec2(0.0, 0.0));
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) {
            v += a * valueNoise(p);
            p *= 2.1;
            a *= 0.5;
        }
        return v;
    }

    void main() {
        vUv = uv;

        // Place patch on top of sphere surface
        // position is in local plane space; project up onto sphere
        vec3 localPos  = position;
        vec3 surfaceNormal = normalize(vec3(localPos.x, 1.0, localPos.z));
        vec3 onSphere  = surfaceNormal * uPlanetRadius;

        // Height noise
        float n   = fbm(localPos.xz * 0.018 + uTime * 0.012);
        float bump = n * 1.8 - 0.3;
        vHeight    = n;

        vec3 displaced = onSphere + surfaceNormal * bump;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
`;

const FRAGMENT_SHADER = /* glsl */ `
    uniform vec3  uBaseColor;
    uniform vec3  uHighColor;
    uniform float uOpacity;

    varying vec2  vUv;
    varying float vHeight;

    void main() {
        vec3 col   = mix(uBaseColor, uHighColor, smoothstep(0.3, 0.7, vHeight));
        // Vignette fade at patch edges
        vec2 edge  = abs(vUv - 0.5) * 2.0;
        float fade = 1.0 - pow(max(edge.x, edge.y), 3.0);
        gl_FragColor = vec4(col, uOpacity * fade * 0.92);
    }
`;

// ── Color palettes per planet class ──────────────────────────────────────────
const CLASS_COLORS = {
    ocean:     { base: [0.00, 0.15, 0.50], high: [0.20, 0.55, 0.90] },
    desert:    { base: [0.55, 0.22, 0.02], high: [0.90, 0.55, 0.15] },
    gas_giant: { base: [0.52, 0.34, 0.10], high: [0.82, 0.60, 0.30] },
    ice:       { base: [0.65, 0.82, 0.95], high: [0.95, 0.98, 1.00] },
    volcanic:  { base: [0.10, 0.02, 0.01], high: [0.75, 0.10, 0.00] },
    jungle:    { base: [0.01, 0.18, 0.03], high: [0.10, 0.52, 0.08] },
    default:   { base: [0.20, 0.20, 0.28], high: [0.45, 0.45, 0.60] },
};

// ─────────────────────────────────────────────────────────────────────────────

export class PlanetSurfacePatch {
    /**
     * @param {THREE.Mesh} planetMesh
     * @param {string}     planetClass  — one of PlanetShaderSystem classes
     */
    constructor(planetMesh, planetClass = 'default') {
        this._planet    = planetMesh;
        this._class     = planetClass;
        this._mesh      = null;
        this._uniforms  = null;
        this._attached  = false;
        this._planetWorldPos = new THREE.Vector3();
        this._surfaceDir = new THREE.Vector3();
        this._patchPos = new THREE.Vector3();
        this._upAxis = new THREE.Vector3(0, 1, 0);

        const bbox = new THREE.Box3().setFromObject(planetMesh);
        const size = bbox.getSize(new THREE.Vector3());
        this._radius    = size.length() / 2;
        this._patchSize = this._radius * 2.2;
    }

    /** Attach the terrain patch to the planet's parent (world space aligned). */
    attach() {
        if (this._attached) return;

        const palette = CLASS_COLORS[this._class] ?? CLASS_COLORS.default;

        this._uniforms = {
            uTime:         { value: 0 },
            uPlanetRadius: { value: this._radius },
            uPlanetCenter: { value: new THREE.Vector3() },
            uPatchSize:    { value: this._patchSize },
            uBaseColor:    { value: new THREE.Color(...palette.base) },
            uHighColor:    { value: new THREE.Color(...palette.high) },
            uOpacity:      { value: 0.0 },
        };

        const geo = new THREE.PlaneGeometry(
            this._patchSize, this._patchSize,
            PATCH_SEGMENTS, PATCH_SEGMENTS
        );
        // Rotate plane to be horizontal (XZ plane by default is XY)
        geo.rotateX(-Math.PI / 2);

        const mat = new THREE.ShaderMaterial({
            uniforms:       this._uniforms,
            vertexShader:   VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent:    true,
            depthWrite:     false,
            side:           THREE.FrontSide,
        });

        this._mesh      = new THREE.Mesh(geo, mat);
        this._mesh.name = `${this._planet.name ?? 'planet'}_surface_patch`;
        this._mesh.renderOrder = 2;

        // Attach to scene (world-space positioning handled in update())
        const scene = this._planet.parent;
        if (scene) {
            scene.add(this._mesh);
        } else {
            console.warn('[PlanetSurfacePatch] Planet has no parent scene — patch not added.');
            return;
        }

        this._attached = true;
        console.log(`[PlanetSurfacePatch] Created for class=${this._class}, radius=${this._radius.toFixed(1)}`);
    }

    /**
     * Call every frame. Positions the patch on the planet surface closest to the camera,
     * fades it in/out based on altitude, and advances time uniform.
     *
     * @param {THREE.Vector3} cameraWorldPos
     * @param {number}        delta  — frame delta in seconds
     */
    update(cameraWorldPos, delta = 0.016) {
        if (!this._attached || !this._mesh) return;

        const u = this._uniforms;
        u.uTime.value += delta;

        // Get planet world position
        this._planet.getWorldPosition(this._planetWorldPos);
        u.uPlanetCenter.value.copy(this._planetWorldPos);

        // Align patch center at the surface point directly below the camera
        _camLocal.copy(cameraWorldPos).sub(this._planetWorldPos);
        const altitude = _camLocal.length() - this._radius;

        // Compute surface point in the direction of the camera
        this._surfaceDir.copy(_camLocal).normalize();
        this._patchPos.copy(this._planetWorldPos).addScaledVector(this._surfaceDir, this._radius);
        this._mesh.position.copy(this._patchPos);

        // Orientate the patch normal toward camera (face away from planet center)
        this._mesh.quaternion.setFromUnitVectors(
            this._upAxis,
            this._surfaceDir
        );

        // Fade in/out based on altitude
        const t = 1.0 - Math.min(1, Math.max(0, altitude / VISIBILITY_ALTITUDE));
        u.uOpacity.value += (t - u.uOpacity.value) * Math.min(1, delta * 2.5);
    }

    /** Remove mesh from scene and free GPU resources. */
    detach() {
        if (!this._attached || !this._mesh) return;

        this._mesh.parent?.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
        this._mesh      = null;
        this._uniforms  = null;
        this._attached  = false;

        console.log('[PlanetSurfacePatch] Detached and disposed.');
    }

    dispose() {
        this.detach();
    }

    get isAttached() { return this._attached; }
}
