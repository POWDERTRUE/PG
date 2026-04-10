import * as THREE from 'three';
import { GALAXY_SPEC } from '../config/UniverseSpec.js';
import { createSeededRandom, createGaussian, pick, range } from '../utils/SeededRandom.js';

export class NebulaSystem {
    constructor() {
        this._spriteGroups = [];
        this._nebulaTexture = null;
        this.hitboxesGroup = new THREE.Group();
        this.hitboxesGroup.name = 'NebulaHitboxes';
    }

    build(scene, options = {}) {
        const params = {
            ARMS: options.ARMS ?? GALAXY_SPEC.armCount,
            SCALE: options.SCALE ?? GALAXY_SPEC.armA,
            WIND: options.WIND ?? GALAXY_SPEC.armB,
            R_MAX: options.R_MAX ?? GALAXY_SPEC.diskRadius,
            emissionCount: options.emissionCount ?? GALAXY_SPEC.nebulaCounts.emission,
            reflectionCount: options.reflectionCount ?? GALAXY_SPEC.nebulaCounts.reflection,
            planetaryCount: options.planetaryCount ?? GALAXY_SPEC.nebulaCounts.planetary,
        };

        scene.add(this.hitboxesGroup);
        this._nebulaTexture = this._generateNebulaTexture();

        const armRng = createSeededRandom(`${GALAXY_SPEC.seed}:nebulae:arms`);
        const armGauss = createGaussian(armRng);
        const thetaMax = Math.log(params.R_MAX / params.SCALE) / params.WIND;

        const sampleArm = () => {
            const arm = Math.floor(armRng() * params.ARMS);
            const theta = Math.pow(armRng(), 0.86) * thetaMax;
            const armTheta = theta + GALAXY_SPEC.armOffsetsRad[arm];
            const r = params.SCALE * Math.exp(params.WIND * theta);
            return {
                x: Math.cos(armTheta) * r + armGauss(90),
                y: armGauss(36),
                z: Math.sin(armTheta) * r + armGauss(90),
            };
        };

        this._buildNebulaGroup(
            scene,
            params.emissionCount,
            sampleArm,
            createSeededRandom(`${GALAXY_SPEC.seed}:nebulae:emission`),
            [new THREE.Color(0xff3355), new THREE.Color(0xff6688), new THREE.Color(0xff2244)],
            300,
            0.18,
            'Emission'
        );

        this._buildNebulaGroup(
            scene,
            params.reflectionCount,
            sampleArm,
            createSeededRandom(`${GALAXY_SPEC.seed}:nebulae:reflection`),
            [new THREE.Color(0x3388ff), new THREE.Color(0x55aaff), new THREE.Color(0x2266cc)],
            220,
            0.14,
            'Reflection'
        );

        const planetaryRng = createSeededRandom(`${GALAXY_SPEC.seed}:nebulae:planetary`);
        const planetaryGauss = createGaussian(planetaryRng);
        this._buildNebulaGroup(
            scene,
            params.planetaryCount,
            () => {
                const r = 500 + planetaryRng() * params.R_MAX * 0.6;
                const theta = planetaryRng() * Math.PI * 2;
                return {
                    x: Math.cos(theta) * r + planetaryGauss(60),
                    y: planetaryGauss(30),
                    z: Math.sin(theta) * r + planetaryGauss(60),
                };
            },
            planetaryRng,
            [new THREE.Color(0x00ffcc), new THREE.Color(0xffffff), new THREE.Color(0x88ffee)],
            140,
            0.24,
            'Planetary'
        );
    }

    _buildNebulaGroup(scene, count, positionSampler, rng, palette, baseSize, baseOpacity, labelPrefix) {
        const PARTICLES_PER_NEBULA = 180;
        const total = count * PARTICLES_PER_NEBULA;
        const positions = new Float32Array(total * 3);
        const colors = new Float32Array(total * 3);

        let idx = 0;

        for (let nebulaIndex = 0; nebulaIndex < count; nebulaIndex++) {
            const center = positionSampler();
            const nebulaR = baseSize * (0.48 + rng() * 0.62);
            const color = pick(rng, palette);

            for (let particleIndex = 0; particleIndex < PARTICLES_PER_NEBULA; particleIndex++) {
                const frac = Math.pow(rng(), 0.42);
                const r = frac * nebulaR;
                const theta = rng() * Math.PI * 2;
                const phi = Math.acos(range(rng, -1, 1));

                positions[idx * 3] = center.x + Math.sin(phi) * Math.cos(theta) * r;
                positions[idx * 3 + 1] = center.y + Math.cos(phi) * r * 0.3;
                positions[idx * 3 + 2] = center.z + Math.sin(phi) * Math.sin(theta) * r;

                const brightness = 0.52 + frac * 0.48;
                colors[idx * 3] = color.r * brightness;
                colors[idx * 3 + 1] = color.g * brightness;
                colors[idx * 3 + 2] = color.b * brightness;
                idx++;
            }

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(nebulaR * 1.5 + 100, 8, 8),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide })
            );
            hitbox.position.set(center.x, center.y, center.z);
            hitbox.userData = {
                isNode: true,
                isMass: true,
                nodeType: 'nebula',
                label: `${labelPrefix} Nebula ${String(nebulaIndex + 1).padStart(2, '0')}`,
            };
            hitbox.name = `Hitbox_${labelPrefix}_Nebula_${nebulaIndex}`;
            this.hitboxesGroup.add(hitbox);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, idx * 3), 3));

        const material = new THREE.PointsMaterial({
            size: 250,
            map: this._nebulaTexture,
            vertexColors: true,
            transparent: true,
            opacity: baseOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, material);
        points.name = `${labelPrefix}NebulaCloud`;
        points.frustumCulled = false;
        scene.add(points);
        this._spriteGroups.push(points);
    }

    _generateNebulaTexture() {
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(
            SIZE / 2,
            SIZE / 2,
            0,
            SIZE / 2,
            SIZE / 2,
            SIZE / 2
        );
        gradient.addColorStop(0.0, 'rgba(255,255,255,1.0)');
        gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, SIZE, SIZE);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    updateLOD(dist) {
        const targetOpacity = dist > 6000 ? 0.08 : dist > 2000 ? 0.15 : 0.22;
        this._spriteGroups.forEach((pts) => {
            pts.material.opacity += (targetOpacity - pts.material.opacity) * 0.05;
            pts.visible = dist > 80;
        });
    }

    dispose() {
        this._nebulaTexture?.dispose();
        this._spriteGroups.forEach((pts) => {
            pts.geometry.dispose();
            pts.material.dispose();
            pts.parent?.remove(pts);
        });
        this._spriteGroups = [];

        this.hitboxesGroup.children.slice().forEach((hb) => {
            hb.geometry.dispose();
            hb.material.dispose();
            this.hitboxesGroup.remove(hb);
        });
        this.hitboxesGroup.parent?.remove(this.hitboxesGroup);
    }
}
