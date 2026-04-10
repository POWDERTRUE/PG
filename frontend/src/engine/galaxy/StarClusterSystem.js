import * as THREE from 'three';
import { GALAXY_SPEC } from '../config/UniverseSpec.js';
import { createSeededRandom, createGaussian, pick, range } from '../utils/SeededRandom.js';

export class StarClusterSystem {
    constructor() {
        this.globularPoints = null;
        this.openPoints = null;
        this.hitboxesGroup = new THREE.Group();
        this.hitboxesGroup.name = 'StarClusterHitboxes';
    }

    build(scene, options = {}) {
        const params = {
            ARMS: options.ARMS ?? GALAXY_SPEC.armCount,
            SCALE: options.SCALE ?? GALAXY_SPEC.armA,
            WIND: options.WIND ?? GALAXY_SPEC.armB,
            R_MAX: options.R_MAX ?? GALAXY_SPEC.diskRadius,
            HALO_R: options.HALO_R ?? GALAXY_SPEC.haloRadius,
            HALO_INNER: options.HALO_INNER ?? GALAXY_SPEC.haloInnerRadius,
            globularCount: options.globularCount ?? GALAXY_SPEC.globularClusterCount,
            openCount: options.openCount ?? GALAXY_SPEC.openClusterCount,
        };

        scene.add(this.hitboxesGroup);
        this._buildGlobularClusters(scene, params);
        this._buildOpenClusters(scene, params);
    }

    _buildGlobularClusters(scene, params) {
        const rng = createSeededRandom(`${GALAXY_SPEC.seed}:globular-clusters`);
        const gauss = createGaussian(rng);
        const starCount = params.globularCount * GALAXY_SPEC.globularStarsPerCluster;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        const palette = [
            new THREE.Color(0xff8844),
            new THREE.Color(0xffcc88),
            new THREE.Color(0xff5522),
        ];

        let idx = 0;
        for (let clusterIndex = 0; clusterIndex < params.globularCount; clusterIndex++) {
            const radius = params.HALO_INNER + Math.pow(rng(), 0.62) * (params.HALO_R - params.HALO_INNER);
            const u = range(rng, -1, 1);
            const theta = rng() * Math.PI * 2;
            const spread = Math.sqrt(Math.max(0, 1 - u * u));
            const cx = spread * Math.cos(theta) * radius;
            const cy = u * radius * 0.48;
            const cz = spread * Math.sin(theta) * radius;
            const clusterRadius = 36 + rng() * 72;

            for (let star = 0; star < GALAXY_SPEC.globularStarsPerCluster; star++) {
                const r = Math.abs(gauss(clusterRadius * 0.28));
                const localTheta = rng() * Math.PI * 2;
                const phi = Math.acos(range(rng, -1, 1));
                positions[idx * 3] = cx + Math.sin(phi) * Math.cos(localTheta) * r;
                positions[idx * 3 + 1] = cy + Math.cos(phi) * r * 0.9;
                positions[idx * 3 + 2] = cz + Math.sin(phi) * Math.sin(localTheta) * r;

                const col = pick(rng, palette);
                colors[idx * 3] = col.r;
                colors[idx * 3 + 1] = col.g;
                colors[idx * 3 + 2] = col.b;
                idx++;
            }

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(clusterRadius * 2 + 40, 8, 8),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide })
            );
            hitbox.position.set(cx, cy, cz);
            hitbox.userData = {
                isNode: true,
                isMass: true,
                nodeType: 'cluster',
                clusterType: 'globular',
                label: `Globular Cluster ${String(clusterIndex + 1).padStart(2, '0')}`,
            };
            hitbox.name = `Hitbox_GlobularCluster_${clusterIndex}`;
            this.hitboxesGroup.add(hitbox);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 3), 3));

        this.globularPoints = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                size: 1.6,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                sizeAttenuation: true,
                depthWrite: false,
            })
        );
        this.globularPoints.name = 'GlobularClusters';
        this.globularPoints.frustumCulled = false;
        scene.add(this.globularPoints);
    }

    _buildOpenClusters(scene, params) {
        const rng = createSeededRandom(`${GALAXY_SPEC.seed}:open-clusters`);
        const gauss = createGaussian(rng);
        const starCount = params.openCount * GALAXY_SPEC.openClusterStarsPerCluster;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const palette = [
            new THREE.Color(0x88ccff),
            new THREE.Color(0xffffff),
            new THREE.Color(0x99aaff),
        ];

        const thetaMax = Math.log(params.R_MAX / params.SCALE) / params.WIND;
        let idx = 0;

        for (let clusterIndex = 0; clusterIndex < params.openCount; clusterIndex++) {
            const arm = Math.floor(rng() * params.ARMS);
            const theta = Math.pow(rng(), 0.92) * thetaMax;
            const armTheta = theta + GALAXY_SPEC.armOffsetsRad[arm];
            const r = params.SCALE * Math.exp(params.WIND * theta);
            const cx = Math.cos(armTheta) * r + gauss(60);
            const cy = gauss(22);
            const cz = Math.sin(armTheta) * r + gauss(60);
            const clusterRadius = 24 + rng() * 48;

            for (let star = 0; star < GALAXY_SPEC.openClusterStarsPerCluster; star++) {
                positions[idx * 3] = cx + gauss(clusterRadius * 0.5);
                positions[idx * 3 + 1] = cy + gauss(clusterRadius * 0.18);
                positions[idx * 3 + 2] = cz + gauss(clusterRadius * 0.5);

                const col = pick(rng, palette);
                colors[idx * 3] = col.r;
                colors[idx * 3 + 1] = col.g;
                colors[idx * 3 + 2] = col.b;
                idx++;
            }

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(clusterRadius * 2 + 40, 8, 8),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide })
            );
            hitbox.position.set(cx, cy, cz);
            hitbox.userData = {
                isNode: true,
                isMass: true,
                nodeType: 'cluster',
                clusterType: 'open',
                label: `Open Cluster ${arm + 1}.${clusterIndex + 1}`,
            };
            hitbox.name = `Hitbox_OpenCluster_${clusterIndex}`;
            this.hitboxesGroup.add(hitbox);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 3), 3));

        this.openPoints = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                size: 2.8,
                vertexColors: true,
                transparent: true,
                opacity: 0.92,
                sizeAttenuation: true,
                depthWrite: false,
            })
        );
        this.openPoints.name = 'OpenClusters';
        this.openPoints.frustumCulled = false;
        scene.add(this.openPoints);
    }

    updateLOD(cameraDistFromCenter) {
        const d = cameraDistFromCenter;

        if (this.globularPoints) {
            const targetSize = d > 5000 ? 1.2 : d > 1500 ? 2.2 : 3.5;
            this.globularPoints.material.size += (targetSize - this.globularPoints.material.size) * 0.12;
            this.globularPoints.visible = d > 100;
        }

        if (this.openPoints) {
            const targetSize = d > 5000 ? 1.8 : d > 1500 ? 3.2 : 5.0;
            this.openPoints.material.size += (targetSize - this.openPoints.material.size) * 0.12;
            this.openPoints.visible = d > 100;
        }
    }

    dispose() {
        [this.globularPoints, this.openPoints].forEach((obj) => {
            if (!obj) return;
            obj.geometry.dispose();
            obj.material.dispose();
            obj.parent?.remove(obj);
        });

        this.hitboxesGroup.children.slice().forEach((hb) => {
            hb.geometry.dispose();
            hb.material.dispose();
            this.hitboxesGroup.remove(hb);
        });
        this.hitboxesGroup.parent?.remove(this.hitboxesGroup);
    }
}
