import * as THREE from 'three';
import { CelestialBody } from '../CelestialBody.js';
import { MaterialRegistry } from '../../rendering/MaterialRegistry.js';
import { ASTRONOMY_BODY_PROFILES, GALAXY_SPEC } from '../../config/UniverseSpec.js';

const GALLERY_SPEC = GALAXY_SPEC.solarSystem.planets.find((planet) => planet.appId === 'gallery');

const GALLERY_CONFIG = Object.freeze({
    appId: GALLERY_SPEC?.appId ?? 'gallery',
    appName: GALLERY_SPEC?.name ?? 'Gallery',
    planetClass: GALLERY_SPEC?.class ?? 'ocean',
    color: GALLERY_SPEC?.color ?? 0x3388ff,
    orbitRadius: GALLERY_SPEC?.orbitRadius ?? 240,
    orbitSpeed: GALLERY_SPEC?.orbitSpeed ?? 1.18,
    moonCount: GALLERY_SPEC?.moonCount ?? 2,
    bodyProfile: GALLERY_SPEC?.bodyProfile ?? null,
    geometryRadius: 10,
    geometryDetail: 5,
    hitboxRadius: 190,
    surfaceMaterial: Object.freeze({
        color: GALLERY_SPEC?.color ?? 0x3388ff,
        roughness: 0.14,
        metalness: 0.05,
        emissiveIntensity: 0.02,
    }),
    cloudMaterial: Object.freeze({
        cloudColor: 0xf5f8ff,
        coverage: 0.60,
        opacity: 0.72,
    }),
    cityLightMaterial: Object.freeze({
        cityColor: 0xffeeaa,
        transitionWidth: 0.20,
        intensity: 0.58,
        textureId: 'city-lights-mask',
        registryKey: GALLERY_SPEC?.appId ?? 'gallery',
    }),
});

const GALLERY_MOON_SPECS = Object.freeze([
    Object.freeze({
        index: 1,
        orbitRadius: 18,
        orbitSpeed: 2.05,
        tiltX: Math.PI * 0.14,
        tiltY: Math.PI * 0.24,
        color: 0xb7cbe2,
    }),
    Object.freeze({
        index: 2,
        orbitRadius: 27,
        orbitSpeed: 2.55,
        tiltX: Math.PI * 0.31,
        tiltY: Math.PI * 0.58,
        color: 0x8da8c7,
    }),
]);

class GalleryMoon extends CelestialBody {
    constructor(spec) {
        super({
            mass: 0.0123,
            radius: 2.5,
            nodeType: 'moon',
            name: `Moon_Gallery_${spec.index}`,
            bodyProfile: ASTRONOMY_BODY_PROFILES.moon,
        });

        this.index = spec.index;
        this.orbitRadius = spec.orbitRadius;
        this.orbitSpeed = spec.orbitSpeed;
        this.tiltX = spec.tiltX;
        this.tiltY = spec.tiltY;
        this._surfaceParams = Object.freeze({
            color: spec.color,
            roughness: 0.32,
            metalness: 0.08,
        });

        this._orbitPivot = null;
        this._meshBuilt = false;
    }

    buildMesh(parentPlanetMesh, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        const moonOrbit = new THREE.Object3D();
        moonOrbit.name = `MoonOrbit_Gallery_${this.index}`;
        moonOrbit.rotation.x = this.tiltX;
        moonOrbit.rotation.y = this.tiltY;

        const moonGeometry = new THREE.IcosahedronGeometry(this.radius, 2);
        const moonMaterial = MaterialRegistry.get('moon-surface', this._surfaceParams);

        this.mesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.mesh.name = this.name;
        this.mesh.position.set(this.orbitRadius, 0, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // LEY 15: each moon is a CelestialBody-backed mass, never an anonymous mesh.
        this.mesh.userData = this.buildUserData({
            isNode: true,
            label: `Luna ${this.index} de ${GALLERY_CONFIG.appName}`,
            parentAppId: GALLERY_CONFIG.appId,
            parentName: GALLERY_CONFIG.appName,
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
        // REGLA 8: zero-GC by design. Orbital movement stays in CelestialPhysicsSystem.
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

export class GalleryPlanet extends CelestialBody {
    constructor() {
        super({
            mass: GALLERY_CONFIG.bodyProfile?.massEarths ?? 1,
            radius: GALLERY_CONFIG.geometryRadius,
            nodeType: 'planet',
            name: `Planet_${GALLERY_CONFIG.appName}`,
            bodyProfile: GALLERY_CONFIG.bodyProfile,
        });

        this.planetClass = GALLERY_CONFIG.planetClass;
        this.appId = GALLERY_CONFIG.appId;
        this.appName = GALLERY_CONFIG.appName;
        this.orbitRadius = GALLERY_CONFIG.orbitRadius;
        this.orbitSpeed = GALLERY_CONFIG.orbitSpeed;
        this.moonCount = GALLERY_CONFIG.moonCount;
        this.color = GALLERY_CONFIG.color;
        this.hasClouds = true;
        this.hasCityLights = true;

        this._surfaceMaterialParams = GALLERY_CONFIG.surfaceMaterial;
        this._cloudMaterialParams = GALLERY_CONFIG.cloudMaterial;
        this._cityLightMaterialParams = GALLERY_CONFIG.cityLightMaterial;
        this._shaderSystem = null;
        this._hitboxMesh = null;
        this._meshBuilt = false;

        // LEY 15: Gallery owns two lunar bodies, both inheriting from CelestialBody.
        this.moons = GALLERY_MOON_SPECS.map((spec) => new GalleryMoon(spec));
    }

    buildMesh(shaderSystem, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        this._shaderSystem = shaderSystem;

        const planetGeometry = new THREE.IcosahedronGeometry(
            GALLERY_CONFIG.geometryRadius,
            GALLERY_CONFIG.geometryDetail
        );

        // REGLA 19: the ocean surface is retrieved through MaterialRegistry.
        const surfaceMaterial = MaterialRegistry.get('standard-emissive', this._surfaceMaterialParams);

        this.mesh = new THREE.Mesh(planetGeometry, surfaceMaterial);
        this.mesh.name = this.name;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(this.orbitRadius, 0, 0);

        // LEY 15: buildUserData keeps the celestialBodyInstance contract for HUD and physics.
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
            hasCityLights: true,
        });

        const hitboxGeometry = new THREE.SphereGeometry(GALLERY_CONFIG.hitboxRadius, 6, 6);
        const hitboxMaterial = MaterialRegistry.get('hitbox-invisible');
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.name = `Hitbox_${this.appName}`;
        hitbox.userData = { ...this.mesh.userData };
        this.mesh.add(hitbox);
        this._hitboxMesh = hitbox;

        shaderSystem.upgradePlanet(this.mesh, this.planetClass, false, {
            preserveSurfaceMaterial: true,
            cloudMaterialParams: this._cloudMaterialParams,
            cityLightMaterialParams: this._cityLightMaterialParams,
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
        // REGLA 8: no allocations here. Lights, clouds, and orbital motion are system-owned.
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
