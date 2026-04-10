import * as THREE from 'three';
import { System } from '../core/EntityManager.js';
import { Registry } from '../core/ServiceRegistry.js';
import { StarClusterSystem } from './StarClusterSystem.js';
import { NebulaSystem } from './NebulaSystem.js';
import { PhysicalStarSystem } from './PhysicalStarSystem.js';
import { DeepSpaceHDRI } from './DeepSpaceHDRI.js';
import { SupraconsciousnessMass } from './SupraconsciousnessMass.js';
import { GALAXY_SPEC } from '../config/UniverseSpec.js';
import { createSeededRandom, createGaussian, pick, range } from '../utils/SeededRandom.js';
import { resourceManager } from '../../core/ResourceManager.js';

const MAIN_FIELD_STAR_TEXTURE_KEY = 'galaxy:main-field:star-glow';

const GALAXY_PARAMS = Object.freeze({
    ARMS: GALAXY_SPEC.armCount,
    SCALE: GALAXY_SPEC.armA,
    WIND: GALAXY_SPEC.armB,
    R_MAX: GALAXY_SPEC.diskRadius,
    HALO_R: GALAXY_SPEC.haloRadius,
    HALO_INNER: GALAXY_SPEC.haloInnerRadius,
    BULGE_R: GALAXY_SPEC.bulgeRadius,
    BULGE_H: GALAXY_SPEC.bulgeHeight,
    CORE_R: GALAXY_SPEC.coreRadius,
    CORE_H: GALAXY_SPEC.coreHeight,
    BAR_LENGTH: GALAXY_SPEC.barLength,
    BAR_WIDTH: GALAXY_SPEC.barWidth,
    BAR_ANGLE: GALAXY_SPEC.barAngleRad,
    ARM_THICKNESS: GALAXY_SPEC.armThickness,
    seed: GALAXY_SPEC.seed,
    globularCount: GALAXY_SPEC.globularClusterCount,
    openCount: GALAXY_SPEC.openClusterCount,
    emissionCount: GALAXY_SPEC.nebulaCounts.emission,
    reflectionCount: GALAXY_SPEC.nebulaCounts.reflection,
    planetaryCount: GALAXY_SPEC.nebulaCounts.planetary,
});

export class GalaxyGenerationSystem extends System {
    static phase = 'simulation';

    constructor() {
        super();
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.points = null;
        this.mat = null;
        this.starGlowTexture = null;
        this._rotY = 0;
        this._scene = null;
        this._camera = null;
        this._lodTick = 0;
        this._clusters = null;
        this._nebulae = null;
        this._hdri = null;
        this._supramass = null;  // ← Masa de Supraconciencia
        this.namedStarsGroup = new THREE.Group();
        this.namedStarsGroup.name = 'NamedStars';
        this._namedOrbitMaterials = [];
        this.namedSystemDescriptors = [];
        this._initialized = false;
    }

    init(world) {
        if (this._initialized) {
            return;
        }

        this.world = world;
        const kernel = Registry.get('kernel');
        this._scene = kernel?.sceneGraph?.scene;
        this._camera = kernel?.camera ?? Registry.get('camera');

        if (!this._scene) {
            console.error('[GalaxyGenerationSystem] SceneGraph offline.');
            return;
        }

        this._hdri = new DeepSpaceHDRI();
        this._hdri.build(this._scene);

        const oldPopulationCount = this._buildMainField(GALAXY_SPEC.totalMainStars);

        // ── Masa de Supraconciencia — origen único e inamovible del universo ──
        const existingSupramass = Registry.tryGet('SupraconsciousnessMass');
        if (existingSupramass) {
            this._supramass = existingSupramass;
            this._supramass.scene = this._scene;
            const supramassGroup = this._supramass.group;
            if (supramassGroup && supramassGroup.parent !== this._scene) {
                supramassGroup.parent?.remove?.(supramassGroup);
                this._scene.add(supramassGroup);
            }
        } else {
            this._supramass = new SupraconsciousnessMass(this._scene);
            Registry.register('SupraconsciousnessMass', this._supramass);
        }

        if (this.points) {
            const rng = createSeededRandom(`${GALAXY_SPEC.seed}:physical-colors`);
            PhysicalStarSystem.applyPhysicalColorsToGalaxy(this.points, oldPopulationCount, rng);
        }

        this._clusters = new StarClusterSystem();
        this._clusters.build(this._scene, GALAXY_PARAMS);

        this._nebulae = new NebulaSystem();
        this._nebulae.build(this._scene, GALAXY_PARAMS);

        this._scene.add(this.namedStarsGroup);
        this._buildNamedStars(GALAXY_SPEC.visibleScenario?.namedSystems?.count ?? 120);
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.runtimeSignals?.emit?.('PG:GALAXY:SYSTEMS_GENERATED', {
            source: 'galaxy-generation-system',
            count: this.namedSystemDescriptors.length,
            systems: this.namedSystemDescriptors,
            parent: this.namedStarsGroup,
        }, { mirrorDom: false });

        console.log('âœ… [GalaxyGenerationSystem] Deterministic galaxy assembled.');
        this._initialized = true;
    }

    _buildMainField(totalStars) {
        console.log(`ðŸŒŒ [GalaxyGenerationSystem] Weaving ${totalStars} deterministic stars...`);

        const rng = createSeededRandom(`${GALAXY_SPEC.seed}:main-field`);
        const gauss = createGaussian(rng);
        const positions = new Float32Array(totalStars * 3);
        const colors = new Float32Array(totalStars * 3);

        const {
            CORE_R,
            CORE_H,
            BULGE_R,
            BULGE_H,
            BAR_LENGTH,
            BAR_WIDTH,
            BAR_ANGLE,
            R_MAX,
            HALO_R,
            HALO_INNER,
            SCALE,
            WIND,
            ARM_THICKNESS,
        } = GALAXY_PARAMS;

        const C_CORE = new THREE.Color(0xfff5dd);
        const C_BULGE = new THREE.Color(0xffcc88);
        const C_BAR = new THREE.Color(0xffd8a2);
        const C_HOT = new THREE.Color(0x88ccff);
        const C_MID = new THREE.Color(0xfff0dd);
        const C_COOL = new THREE.Color(0xff8844);
        const C_HALO = new THREE.Color(0xff5522);

        let idx = 0;
        const set = (x, y, z, c) => {
            positions[idx * 3] = x;
            positions[idx * 3 + 1] = y;
            positions[idx * 3 + 2] = z;
            colors[idx * 3] = c.r;
            colors[idx * 3 + 1] = c.g;
            colors[idx * 3 + 2] = c.b;
            idx++;
        };

        for (let i = 0; i < GALAXY_SPEC.coreStars; i++) {
            const r = Math.abs(gauss(CORE_R * 0.38));
            const theta = rng() * Math.PI * 2;
            const vertical = gauss(CORE_H * 0.18);
            const t = Math.min(1, r / CORE_R);
            set(
                Math.cos(theta) * r,
                vertical,
                Math.sin(theta) * r,
                C_CORE.clone().lerp(C_BULGE, t * 0.45)
            );
        }

        for (let i = 0; i < GALAXY_SPEC.bulgeStars; i++) {
            const r = Math.abs(gauss(BULGE_R * 0.42));
            const theta = rng() * Math.PI * 2;
            const phi = Math.acos(range(rng, -1, 1));
            const radiusXZ = Math.sin(phi) * r;
            const t = Math.min(1, r / BULGE_R);
            set(
                Math.cos(theta) * radiusXZ,
                Math.cos(phi) * r * (BULGE_H / BULGE_R),
                Math.sin(theta) * radiusXZ,
                C_BULGE.clone().lerp(C_COOL, t * 0.35)
            );
        }

        for (let i = 0; i < GALAXY_SPEC.barStars; i++) {
            const major = gauss(BAR_LENGTH * 0.2);
            const minor = gauss(BAR_WIDTH * 0.16);
            const vertical = gauss(CORE_H * 0.45);
            const x = major;
            const z = minor;
            const rotX = x * Math.cos(BAR_ANGLE) - z * Math.sin(BAR_ANGLE);
            const rotZ = x * Math.sin(BAR_ANGLE) + z * Math.cos(BAR_ANGLE);
            const t = Math.min(1, Math.abs(major) / (BAR_LENGTH * 0.5));
            set(rotX, vertical, rotZ, C_BAR.clone().lerp(C_BULGE, t * 0.5));
        }

        for (let i = 0; i < GALAXY_SPEC.interArmStars; i++) {
            const r = Math.pow(rng(), 1.75) * R_MAX;
            const theta = rng() * Math.PI * 2;
            if (this._armInfluence(r, theta) > 0.3) {
                i--;
                continue;
            }

            const dustBite = Math.max(0.2, 1 - this._dustLaneStrength(r, theta));
            const scatter = 40 + r * 0.02;
            const vertical = gauss((GALAXY_SPEC.coreHeight + 42) * dustBite);
            set(
                Math.cos(theta) * r + gauss(scatter),
                vertical,
                Math.sin(theta) * r + gauss(scatter),
                pick(rng, [C_MID, C_COOL])
            );
        }

        for (let i = 0; i < GALAXY_SPEC.haloStars; i++) {
            const r = HALO_INNER + Math.pow(rng(), 0.58) * (HALO_R - HALO_INNER);
            const u = range(rng, -1, 1);
            const phi = rng() * Math.PI * 2;
            const spread = Math.sqrt(Math.max(0, 1 - u * u));
            set(
                spread * Math.cos(phi) * r,
                u * r * 0.45,
                spread * Math.sin(phi) * r,
                C_HALO
            );
        }

        const thetaMax = Math.log(R_MAX / SCALE) / WIND;
        const armPalettes = [C_HOT, C_MID, C_COOL];

        for (let i = 0; i < GALAXY_SPEC.armStars; i++) {
            const armIndex = Math.floor(rng() * GALAXY_SPEC.armCount);
            const theta = Math.pow(rng(), 0.9) * thetaMax;
            const armTheta = theta + GALAXY_SPEC.armOffsetsRad[armIndex];
            const r = SCALE * Math.exp(WIND * theta);
            const spread = ARM_THICKNESS * (0.32 + r / (R_MAX * 1.8));
            const x = Math.cos(armTheta) * r + gauss(spread);
            const z = Math.sin(armTheta) * r + gauss(spread);
            const y = gauss(Math.max(6, 34 - (r / R_MAX) * 22));
            const populationBlend = Math.min(1, r / R_MAX);
            const color =
                populationBlend < 0.34
                    ? pick(rng, [C_HOT, C_MID])
                    : populationBlend > 0.8
                        ? pick(rng, [C_COOL, C_MID])
                        : pick(rng, armPalettes);

            set(x, y, z, color);
        }

        const validCount = idx;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, validCount * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors.slice(0, validCount * 3), 3));
        this.starGlowTexture = resourceManager.getTexture(MAIN_FIELD_STAR_TEXTURE_KEY, () => {
            const texture = new THREE.TextureLoader().load('/assets/fx/star_glow.png');
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        });

        this.mat = new THREE.PointsMaterial({
            size: 4.5,
            vertexColors: true,
            map: this.starGlowTexture,
            alphaMap: this.starGlowTexture,
            transparent: true,
            opacity: 0.24,
            alphaTest: 0.02,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });
        this.mat.toneMapped = true;

        this.points = new THREE.Points(geo, this.mat);
        this.points.name = 'GalaxyField_Main';
        this.points.frustumCulled = false;
        this.points.renderOrder = -10;
        this._scene.add(this.points);

        console.log(`   Stars: ${validCount.toLocaleString()} (core/bulge/bar/inter-arm/halo/arms)`);
        return GALAXY_SPEC.coreStars + GALAXY_SPEC.bulgeStars + GALAXY_SPEC.barStars + GALAXY_SPEC.interArmStars + GALAXY_SPEC.haloStars;
    }


    // _buildCentralBlackHole() eliminado — reemplazado por SupraconsciousnessMass


    _armInfluence(r, theta) {
        if (r <= 1) return 1;

        let strongest = 0;
        for (let arm = 0; arm < GALAXY_SPEC.armCount; arm++) {
            const spiralTheta = (Math.log(Math.max(GALAXY_SPEC.armA, r) / GALAXY_SPEC.armA) / GALAXY_SPEC.armB) + GALAXY_SPEC.armOffsetsRad[arm];
            const delta = Math.abs(((theta - spiralTheta + Math.PI) % (Math.PI * 2)) - Math.PI);
            const width = 0.18 + (r / GALAXY_SPEC.diskRadius) * 0.12;
            const influence = Math.exp(-(delta * delta) / width);
            strongest = Math.max(strongest, influence);
        }

        return strongest;
    }

    _dustLaneStrength(r, theta) {
        if (r < GALAXY_SPEC.coreRadius || r > GALAXY_SPEC.diskRadius) return 0;
        const innerBias = 1 - Math.min(1, r / GALAXY_SPEC.diskRadius);
        return this._armInfluence(r, theta) * (0.35 + innerBias * 0.45);
    }

    update(delta) {
        if (!this.points) return;

        const cam = this._camera ?? Registry.get('camera');
        if (cam) this._hdri?.syncToCamera(cam.position);
        this._hdri?.update(delta);

        // Animar la Masa de Supraconciencia cada frame
        this._supramass?.update(delta);

        this._rotY += GALAXY_SPEC.rotationSpeed;
        this.points.rotation.y = this._rotY;

        if (this._clusters?.globularPoints) this._clusters.globularPoints.rotation.y = this._rotY;
        if (this._clusters?.openPoints) this._clusters.openPoints.rotation.y = this._rotY;
        if (this._clusters?.hitboxesGroup) this._clusters.hitboxesGroup.rotation.y = this._rotY;
        if (this._nebulae?.hitboxesGroup) this._nebulae.hitboxesGroup.rotation.y = this._rotY;
        this._nebulae?._spriteGroups?.forEach((group) => {
            group.rotation.y = this._rotY;
        });
        if (this.namedStarsGroup) this.namedStarsGroup.rotation.y = this._rotY;
        if (this._blackHole) this._blackHole.rotation.y = this._rotY * 1.04;

        this._lodTick++;
        if (this._lodTick % 30 !== 0 || !cam) return;

        const dist = cam.position.length();
        let targetSize;
        if (dist > 12000) targetSize = 5.8;
        else if (dist > 8000) targetSize = 5.0;
        else if (dist > 5000) targetSize = 4.1;
        else if (dist > 2500) targetSize = 3.1;
        else if (dist > 900) targetSize = 2.4;
        else targetSize = 1.9;

        this.mat.size += (targetSize - this.mat.size) * 0.15;
        this._clusters?.updateLOD(dist);
        this._nebulae?.updateLOD(dist);

        const targetOrbitOpacity =
            dist > 12000 ? 0.06 :
            dist > 8000 ? 0.09 :
            dist > 5000 ? 0.13 :
            dist > 2500 ? 0.18 :
            0.24;

        for (let i = 0; i < this._namedOrbitMaterials.length; i++) {
            const material = this._namedOrbitMaterials[i];
            material.opacity += (targetOrbitOpacity - material.opacity) * 0.12;
        }
    }

    execute(world, delta) {
        this.update(delta);
    }

    _buildUnitCircleGeometry(segments = 72) {
        const pts = new Float32Array((segments + 1) * 3);
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            pts[i * 3] = Math.cos(theta);
            pts[i * 3 + 1] = 0;
            pts[i * 3 + 2] = Math.sin(theta);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        return geometry;
    }

    _buildNamedStars(count) {
        this.namedStarsGroup.clear();
        this._namedOrbitMaterials.length = 0;
        this.namedSystemDescriptors.length = 0;

        const rng = createSeededRandom(`${GALAXY_SPEC.seed}:named-stars`);
        const gauss = createGaussian(rng);
        const namedSystemSpec = GALAXY_SPEC.visibleScenario?.namedSystems ?? {};
        const starGeo = new THREE.SphereGeometry(6, 10, 10);
        const orbitGeo = this._buildUnitCircleGeometry(88);
        const thetaMax = Math.log(GALAXY_SPEC.diskRadius / GALAXY_SPEC.armA) / GALAXY_SPEC.armB;

        for (let i = 0; i < count; i++) {
            const armIndex = Math.floor(rng() * GALAXY_SPEC.armCount);
            const theta = Math.pow(rng(), 0.92) * thetaMax;
            const r = Math.max(
                GALAXY_SPEC.bulgeRadius * 1.05,
                GALAXY_SPEC.armA * Math.exp(GALAXY_SPEC.armB * theta)
            );
            const armTheta = theta + GALAXY_SPEC.armOffsetsRad[armIndex];
            const spread = namedSystemSpec.armSpread ?? 78;
            const systemRadius = range(
                rng,
                namedSystemSpec.systemRadiusMin ?? 42,
                namedSystemSpec.systemRadiusMax ?? 128
            );
            const orbitLaneCount = Math.round(range(
                rng,
                namedSystemSpec.orbitLaneMin ?? 2,
                namedSystemSpec.orbitLaneMax ?? 4
            ));
            const starTemp = PhysicalStarSystem.sampleStellarTemperature(rng);
            const starColor = PhysicalStarSystem.temperatureToColor(starTemp);
            const starBrightness = PhysicalStarSystem.brightnessForTemperature(starTemp);
            const starScale =
                (namedSystemSpec.starScaleMin ?? 0.8) +
                ((namedSystemSpec.starScaleMax ?? 1.85) - (namedSystemSpec.starScaleMin ?? 0.8)) * starBrightness;

            const system = new THREE.Group();
            system.name = `NamedSystem_${i}`;
            system.position.set(
                Math.cos(armTheta) * r + gauss(spread),
                gauss(namedSystemSpec.verticalSpread ?? 18),
                Math.sin(armTheta) * r + gauss(spread)
            );
            system.rotation.z = range(rng, -0.22, 0.22);
            system.rotation.x = range(rng, -0.08, 0.08);

            const star = new THREE.Mesh(
                starGeo,
                new THREE.MeshBasicMaterial({
                    color: starColor.clone().multiplyScalar(0.6 + starBrightness * 0.55),
                    transparent: true,
                    opacity: 0.96,
                })
            );
            star.scale.setScalar(starScale);
            star.renderOrder = -4;

            const hitbox = new THREE.Mesh(
                new THREE.SphereGeometry(systemRadius + (namedSystemSpec.hitboxPadding ?? 54), 6, 6),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide })
            );

            star.userData = {
                isApp: true,
                isMass: true,
                nodeType: 'star',
                appId: `star_${i}`,
                label: `Stellar System ${String(i + 1).padStart(3, '0')}`,
                stellarTemperature: Math.round(starTemp),
                systemRadius: Number(systemRadius.toFixed(2)),
                systemPlanetCount: orbitLaneCount,
            };
            hitbox.userData = { ...star.userData };

            star.name = `NamedStar_${i}`;
            hitbox.name = `Hitbox_NamedStar_${i}`;
            star.add(hitbox);

            const orbitMaterial = new THREE.LineBasicMaterial({
                color: starColor.clone().lerp(new THREE.Color(0xffffff), 0.4),
                transparent: true,
                opacity: 0.14,
                depthWrite: false,
            });
            this._namedOrbitMaterials.push(orbitMaterial);

            for (let lane = 0; lane < orbitLaneCount; lane++) {
                const laneRadius = systemRadius * (0.34 + (lane / Math.max(1, orbitLaneCount - 1)) * 0.62);
                const orbitLine = new THREE.Line(orbitGeo, orbitMaterial);
                orbitLine.scale.set(laneRadius, 1, laneRadius);
                orbitLine.rotation.x = Math.PI * 0.5;
                orbitLine.name = `NamedSystemOrbit_${i}_${lane}`;
                orbitLine.renderOrder = -6;
                system.add(orbitLine);
            }

            const boundaryMaterial = new THREE.LineBasicMaterial({
                color: starColor.clone().lerp(new THREE.Color(0xffffff), 0.65),
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
            });
            this._namedOrbitMaterials.push(boundaryMaterial);

            const boundary = new THREE.Line(orbitGeo, boundaryMaterial);
            boundary.scale.set(systemRadius, 1, systemRadius);
            boundary.rotation.x = Math.PI * 0.5;
            boundary.name = `NamedSystemBoundary_${i}`;
            boundary.renderOrder = -5;
            system.add(boundary);

            system.add(star);
            this.namedStarsGroup.add(system);

            this.namedSystemDescriptors.push({
                id: i,
                label: star.userData.label,
                group: system,
                parent: this.namedStarsGroup,
                proxyColor: starColor.clone().multiplyScalar(0.72 + starBrightness * 0.48),
                proxyScale: Math.max(14, (systemRadius * 0.22) + (starScale * 4.4)),
                systemRadius,
                detailMaterials: [star.material, orbitMaterial, boundaryMaterial],
                detailBaseOpacities: [star.material.opacity, orbitMaterial.opacity, boundaryMaterial.opacity],
            });
        }
    }

    getNamedSystemDescriptors() {
        return this.namedSystemDescriptors;
    }
}

