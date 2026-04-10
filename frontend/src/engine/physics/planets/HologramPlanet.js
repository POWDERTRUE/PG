import * as THREE from 'three';
import { CelestialBody } from '../CelestialBody.js';
import { MaterialRegistry } from '../../rendering/MaterialRegistry.js';
import { ASTRONOMY_BODY_PROFILES, GALAXY_SPEC } from '../../config/UniverseSpec.js';

const HOLOGRAM_SPEC = GALAXY_SPEC.solarSystem.planets.find((planet) => planet.appId === 'hologram');

const HOLOGRAM_CONFIG = Object.freeze({
    appId: HOLOGRAM_SPEC?.appId ?? 'hologram',
    appName: HOLOGRAM_SPEC?.name ?? 'Hologram',
    planetClass: HOLOGRAM_SPEC?.class ?? 'gas_giant',
    color: HOLOGRAM_SPEC?.color ?? 0xffaa55,
    orbitRadius: HOLOGRAM_SPEC?.orbitRadius ?? 330,
    orbitSpeed: HOLOGRAM_SPEC?.orbitSpeed ?? 1.52,
    moonCount: HOLOGRAM_SPEC?.moonCount ?? 5,
    bodyProfile: HOLOGRAM_SPEC?.bodyProfile ?? null,
    geometryRadius: 10,
    geometryDetail: 5,
    hitboxRadius: 210,
    hasRings: HOLOGRAM_SPEC?.hasRings ?? true,
    ringTiltX: Math.PI / 2 + 0.14,
    surfaceMaterial: Object.freeze({
        color: HOLOGRAM_SPEC?.color ?? 0xffaa55,
        roughness: 0.44,
        metalness: 0.06,
        emissiveIntensity: 0.04,
    }),
    cloudMaterial: Object.freeze({
        cloudColor: 0xffeecc,
        coverage: 0.82,
        opacity: 0.74,
    }),
    ringMaterial: Object.freeze({
        color1: 0xe5cf9f,
        color2: 0x8f693f,
        color3: 0xfff4d9,
    }),
});

const HOLOGRAM_MOON_SPECS = Object.freeze([
    Object.freeze({ index: 1, orbitRadius: 20, orbitSpeed: 2.10, tiltX: Math.PI * 0.10, tiltY: Math.PI * 0.17, color: 0xd7c58f }),
    Object.freeze({ index: 2, orbitRadius: 28, orbitSpeed: 2.45, tiltX: Math.PI * 0.21, tiltY: Math.PI * 0.34, color: 0xcdb77b }),
    Object.freeze({ index: 3, orbitRadius: 36, orbitSpeed: 2.80, tiltX: Math.PI * 0.31, tiltY: Math.PI * 0.52, color: 0xbda46d }),
    Object.freeze({ index: 4, orbitRadius: 45, orbitSpeed: 3.15, tiltX: Math.PI * 0.39, tiltY: Math.PI * 0.71, color: 0xa98d58 }),
    Object.freeze({ index: 5, orbitRadius: 55, orbitSpeed: 3.50, tiltX: Math.PI * 0.48, tiltY: Math.PI * 0.89, color: 0x8f7447 }),
]);

class HologramMoon extends CelestialBody {
    constructor(spec) {
        super({
            mass: 0.0123,
            radius: 2.5,
            nodeType: 'moon',
            name: `Moon_Hologram_${spec.index}`,
            bodyProfile: ASTRONOMY_BODY_PROFILES.moon,
        });

        this.index = spec.index;
        this.orbitRadius = spec.orbitRadius;
        this.orbitSpeed = spec.orbitSpeed;
        this.tiltX = spec.tiltX;
        this.tiltY = spec.tiltY;
        this._surfaceParams = Object.freeze({
            color: spec.color,
            roughness: 0.64,
            metalness: 0.08,
        });

        this._orbitPivot = null;
        this._meshBuilt = false;
    }

    buildMesh(parentPlanetMesh, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        const moonOrbit = new THREE.Object3D();
        moonOrbit.name = `MoonOrbit_Hologram_${this.index}`;
        moonOrbit.rotation.x = this.tiltX;
        moonOrbit.rotation.y = this.tiltY;

        const moonGeometry = new THREE.IcosahedronGeometry(this.radius, 2);
        const moonMaterial = MaterialRegistry.get('moon-surface', this._surfaceParams);

        this.mesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.mesh.name = this.name;
        this.mesh.position.set(this.orbitRadius, 0, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // LEY 15: each Hologram moon is a real CelestialBody-backed mass.
        this.mesh.userData = this.buildUserData({
            isNode: true,
            label: `Luna ${this.index} de ${HOLOGRAM_CONFIG.appName}`,
            parentAppId: HOLOGRAM_CONFIG.appId,
            parentName: HOLOGRAM_CONFIG.appName,
            parentMass: parentPlanetMesh,
        });

        moonOrbit.add(this.mesh);
        parentPlanetMesh.add(moonOrbit);
        physicsSystem.registerOrbit(moonOrbit, this.orbitSpeed);

        this._orbitPivot = moonOrbit;
        this._meshBuilt = true;
        this._initialized = true;

        return this.mesh;
    }

    update(dt) {
        // REGLA 8: zero-GC by design. Orbital motion stays in CelestialPhysicsSystem.
    }

    dispose() {
        if (this._disposed) return;

        MaterialRegistry.release('moon-surface', this._surfaceParams);

        if (this.mesh?.geometry) {
            this.mesh.geometry.dispose();
        }

        if (this._orbitPivot?.parent) {
            this._orbitPivot.parent.remove(this._orbitPivot);
        }

        this.mesh = null;
        this._orbitPivot = null;
        this._disposed = true;
    }
}

export class HologramPlanet extends CelestialBody {
    constructor() {
        super({
            mass: HOLOGRAM_CONFIG.bodyProfile?.massEarths ?? 95,
            radius: HOLOGRAM_CONFIG.geometryRadius,
            nodeType: 'planet',
            name: `Planet_${HOLOGRAM_CONFIG.appName}`,
            bodyProfile: HOLOGRAM_CONFIG.bodyProfile,
        });

        this.planetClass = HOLOGRAM_CONFIG.planetClass;
        this.appId = HOLOGRAM_CONFIG.appId;
        this.appName = HOLOGRAM_CONFIG.appName;
        this.orbitRadius = HOLOGRAM_CONFIG.orbitRadius;
        this.orbitSpeed = HOLOGRAM_CONFIG.orbitSpeed;
        this.moonCount = HOLOGRAM_CONFIG.moonCount;
        this.color = HOLOGRAM_CONFIG.color;
        this.hasClouds = true;
        this.hasRings = HOLOGRAM_CONFIG.hasRings;

        this._surfaceMaterialParams = HOLOGRAM_CONFIG.surfaceMaterial;
        this._cloudMaterialParams = HOLOGRAM_CONFIG.cloudMaterial;
        this._ringMaterialParams = HOLOGRAM_CONFIG.ringMaterial;
        this._shaderSystem = null;
        this._hitboxMesh = null;
        this._meshBuilt = false;

        // LEY 15: Hologram owns five independent moon bodies through the same hierarchy.
        this.moons = HOLOGRAM_MOON_SPECS.map((spec) => new HologramMoon(spec));
    }

    buildMesh(shaderSystem, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        this._shaderSystem = shaderSystem;

        const planetGeometry = new THREE.IcosahedronGeometry(
            HOLOGRAM_CONFIG.geometryRadius,
            HOLOGRAM_CONFIG.geometryDetail
        );

        // REGLA 19: gas giant base surface comes from MaterialRegistry, not inline material creation.
        const surfaceMaterial = MaterialRegistry.get('standard-emissive', this._surfaceMaterialParams);

        this.mesh = new THREE.Mesh(planetGeometry, surfaceMaterial);
        this.mesh.name = this.name;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.orbitRadius, 0, 0);

        // LEY 15: buildUserData injects celestialBodyInstance for HUD, raycast, and physics.
        this.mesh.userData = this.buildUserData({
            isApp: true,
            isNode: true,
            appId: this.appId,
            appName: this.appName,
            planetClass: this.planetClass,
            distance: this.orbitRadius,
            orbitRadius: this.orbitRadius,
            moonCount: this.moonCount,
            label: this.appName,
            hasClouds: true,
            hasRings: true,
        });

        const hitboxGeometry = new THREE.SphereGeometry(HOLOGRAM_CONFIG.hitboxRadius, 6, 6);
        const hitboxMaterial = MaterialRegistry.get('hitbox-invisible');
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.name = `Hitbox_${this.appName}`;
        hitbox.userData = { ...this.mesh.userData };
        this.mesh.add(hitbox);
        this._hitboxMesh = hitbox;

        shaderSystem.upgradePlanet(this.mesh, this.planetClass, true, {
            preserveSurfaceMaterial: true,
            cloudMaterialParams: this._cloudMaterialParams,
            ringMaterialParams: this._ringMaterialParams,
            ringTiltX: HOLOGRAM_CONFIG.ringTiltX,
        });

        this._instantiateMoons(physicsSystem);

        this._meshBuilt = true;
        this._initialized = true;

        return this.mesh;
    }

    _instantiateMoons(physicsSystem) {
        for (const moon of this.moons) {
            moon.buildMesh(this.mesh, physicsSystem);
        }
    }

    update(dt) {
        // REGLA 8: no allocations here. Clouds, rings, and orbital motion are system-owned.
    }

    dispose() {
        if (this._disposed) return;

        for (const moon of this.moons) {
            moon.dispose();
        }

        this._shaderSystem?.detachPlanet?.(this.mesh);

        MaterialRegistry.release('standard-emissive', this._surfaceMaterialParams);
        MaterialRegistry.release('hitbox-invisible');

        if (this._hitboxMesh?.geometry) {
            this._hitboxMesh.geometry.dispose();
        }

        if (this.mesh?.geometry) {
            this.mesh.geometry.dispose();
        }

        if (this.mesh?.parent) {
            this.mesh.parent.remove(this.mesh);
        }

        this._hitboxMesh = null;
        this.mesh = null;
        this._disposed = true;
    }
}
