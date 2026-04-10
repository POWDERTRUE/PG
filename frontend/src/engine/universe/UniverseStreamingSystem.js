import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { SectorAddress, SectorGridSpec } from '../core/SectorAddress.js';
import { GALAXY_SPEC } from '../config/UniverseSpec.js';

/**
 * UniverseStreamingSystem — AAA Sector Streaming
 *
 * Divides the galaxy into a 3D grid of sectors.
 * Sectors are lazy-loaded as the camera approaches and unloaded when far away.
 *
 * Architecture:
 *   SECTOR_SIZE  = 2000 × 600 × 2000 units
 *   LOAD_RADIUS  = 2 sectors in each axis
 *   STAR_DENSITY = 2400 stars per sector (procedural, seeded)
 *
 * Each sector uses the same logarithmic spiral math as GalaxyGenerationSystem
 * so stars appear continuous across sector boundaries.
 */
export class UniverseStreamingSystem {
    static phase = 'streaming';

    static STARS_PER_SECTOR = 2400;
    static TICK_INTERVAL = 90;
    static R_MAX = GALAXY_SPEC.haloRadius;
    static ARMS  = GALAXY_SPEC.armCount;
    static SCALE = GALAXY_SPEC.armA;
    static WIND  = GALAXY_SPEC.armB;

    constructor() {
        this._scene      = null;
        this._camera     = null;
        this._sectors    = new Map();
        this._tickCount  = 0;
        this._prevSectorKey = null;
        this._scratchSector = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
        this._scratchWorldCenter = new THREE.Vector3();
        this._scratchParsedSector = new THREE.Vector3();
    }

    init() {
        const kernel = Registry.get('kernel');
        this._scene  = kernel?.sceneGraph?.scene;
        this._camera = kernel?.camera ?? Registry.get('camera');
        if (!this._scene || !this._camera) {
            console.warn('[UniverseStreamer] Scene or camera not found — streaming disabled.');
            return;
        }
        console.log('🌌 [UniverseStreamer] Sector streaming online.');
    }

    update(_delta) {
        if (!this._scene || !this._camera) return;
        this._tickCount++;
        if (this._tickCount % UniverseStreamingSystem.TICK_INTERVAL !== 0) return;

        const currentSector = SectorAddress.worldToSector(this._camera.position, this._scratchSector, SectorGridSpec);
        const ix = currentSector.x;
        const iy = currentSector.y;
        const iz = currentSector.z;
        const sectorKey = SectorAddress.getSectorKey(ix, iy, iz);
        if (sectorKey === this._prevSectorKey) return;
        this._prevSectorKey = sectorKey;

        const wanted = new Set();
        for (let dx = -SectorGridSpec.LOAD_RADIUS; dx <= SectorGridSpec.LOAD_RADIUS; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -SectorGridSpec.LOAD_RADIUS; dz <= SectorGridSpec.LOAD_RADIUS; dz++) {
                    wanted.add(SectorAddress.getSectorKey(ix + dx, iy + dy, iz + dz));
                }
            }
        }

        for (const [key, pts] of this._sectors) {
            if (!wanted.has(key)) this._unloadSector(key, pts);
        }

        for (const key of wanted) {
            if (!this._sectors.has(key)) {
                const parsed = SectorAddress.parseSectorKey(key, this._scratchParsedSector);
                if (!parsed) {
                    continue;
                }
                const sx = parsed.x;
                const sy = parsed.y;
                const sz = parsed.z;
                const worldCenter = SectorAddress.sectorToWorldCenter(sx, sy, sz, this._scratchWorldCenter, SectorGridSpec);
                const worldX = worldCenter.x;
                const worldZ = worldCenter.z;
                const distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
                if (distFromCenter > GALAXY_SPEC.diskRadius && distFromCenter < UniverseStreamingSystem.R_MAX) {
                    this._loadSector(key, sx, sy, sz);
                }
            }
        }
    }

    execute(world, delta) { this.update(delta); }

    _loadSector(key, sx, sy, sz) {
        const N = UniverseStreamingSystem.STARS_PER_SECTOR;
        const { ARMS, SCALE, WIND, R_MAX } = UniverseStreamingSystem;

        const positions = new Float32Array(N * 3);
        const colors    = new Float32Array(N * 3);

        const seed = ((sx * 73856093) ^ (sy * 19349663) ^ (sz * 83492791)) >>> 0;
        const rng  = this._lcg(seed);

        const cOuter = new THREE.Color(0xff8844);
        const cMid   = new THREE.Color(0xffeedd);
        const cHot   = new THREE.Color(0x88aaff);

        const worldCenter = SectorAddress.sectorToWorldCenter(sx, sy, sz, this._scratchWorldCenter, SectorGridSpec);
        const worldCX = worldCenter.x;
        const worldCY = worldCenter.y;
        const worldCZ = worldCenter.z;
        const halfW = SectorGridSpec.WIDTH * 0.5;
        const halfH = SectorGridSpec.HEIGHT * 0.5;
        const halfD = SectorGridSpec.DEPTH * 0.5;
        let count = 0;

        for (let i = 0; i < N; i++) {
            const lx = (rng() * SectorGridSpec.WIDTH) - halfW;
            const ly = ((rng() * SectorGridSpec.HEIGHT) - halfH) * 0.4;
            const lz = (rng() * SectorGridSpec.DEPTH) - halfD;
            const wx = worldCX + lx;
            const wz = worldCZ + lz;
            const r  = Math.sqrt(wx * wx + wz * wz);
            const theta = Math.atan2(wz, wx);
            const armBias = this._spiralArmDensity(r, theta, ARMS, SCALE, WIND);
            if (rng() > armBias * 0.6 + 0.3) continue;

            positions[count * 3]     = wx;
            positions[count * 3 + 1] = worldCY + ly;
            positions[count * 3 + 2] = wz;

            const t = Math.min(1, r / R_MAX);
            const col = t < 0.3 ? cHot : t < 0.65 ? cMid : cOuter;
            colors[count * 3]     = col.r * (0.4 + rng() * 0.3);
            colors[count * 3 + 1] = col.g * (0.4 + rng() * 0.3);
            colors[count * 3 + 2] = col.b * (0.4 + rng() * 0.3);
            count++;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, count * 3), 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors.slice(0, count * 3), 3));

        const mat = new THREE.PointsMaterial({
            size: 1.4, vertexColors: true, transparent: true, opacity: 0.7,
            sizeAttenuation: true, depthWrite: false,
        });

        const pts = new THREE.Points(geo, mat);
        pts.name = `Sector_${key}`;
        pts.frustumCulled = true;
        this._scene.add(pts);
        this._sectors.set(key, pts);
    }

    _unloadSector(key, pts) {
        pts.geometry.dispose();
        pts.material.dispose();
        pts.parent?.remove(pts);
        this._sectors.delete(key);
    }

    _spiralArmDensity(r, theta, ARMS, SCALE, WIND) {
        if (r < 10) return 1;
        let maxBias = 0;
        for (let arm = 0; arm < ARMS; arm++) {
            const armBase = (arm / ARMS) * Math.PI * 2;
            const spiralT = Math.log(Math.max(1, r) / SCALE) / WIND + armBase;
            let dTheta = Math.abs(((theta - spiralT) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
            const bias = Math.exp(-dTheta * dTheta * 4);
            if (bias > maxBias) maxBias = bias;
        }
        return maxBias;
    }

    _lcg(seed) {
        let s = seed | 0;
        return () => {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0xFFFFFFFF;
        };
    }

    get loadedSectorCount() { return this._sectors.size; }
}
