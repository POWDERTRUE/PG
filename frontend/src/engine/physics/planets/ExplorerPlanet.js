import * as THREE from 'three';
import { CelestialBody } from '../CelestialBody.js';
import { MaterialRegistry } from '../../rendering/MaterialRegistry.js';
import { ASTRONOMY_BODY_PROFILES, GALAXY_SPEC } from '../../config/UniverseSpec.js';

const EXPLORER_SPEC = GALAXY_SPEC.solarSystem.planets.find((planet) => planet.appId === 'explorer');

const EXPLORER_CONFIG = Object.freeze({
    appId: EXPLORER_SPEC?.appId ?? 'explorer',
    appName: EXPLORER_SPEC?.name ?? 'Explorer',
    planetClass: EXPLORER_SPEC?.class ?? 'desert',
    color: EXPLORER_SPEC?.color ?? 0xcc8844,
    orbitRadius: EXPLORER_SPEC?.orbitRadius ?? 195,
    orbitSpeed: EXPLORER_SPEC?.orbitSpeed ?? 1.04,
    moonCount: EXPLORER_SPEC?.moonCount ?? 2,
    bodyProfile: EXPLORER_SPEC?.bodyProfile ?? null,
    geometryRadius: 10,
    geometryDetail: 5,
    hitboxRadius: 180,
    surfaceMaterial: Object.freeze({
        color: EXPLORER_SPEC?.color ?? 0xcc8844,
        roughness: 0.82,
        metalness: 0.08,
        emissiveIntensity: 0.05,
    }),
    cloudMaterial: Object.freeze({
        cloudColor: 0xffddaa,
        coverage: 0.25,
        opacity: 0.70,
    }),
});

const EXPLORER_MOON_SPECS = Object.freeze([
    Object.freeze({
        index: 1,
        orbitRadius: 18,
        orbitSpeed: 2.25,
        tiltX: Math.PI * 0.18,
        tiltY: Math.PI * 0.27,
        color: 0xcc8866,
    }),
    Object.freeze({
        index: 2,
        orbitRadius: 25,
        orbitSpeed: 2.70,
        tiltX: Math.PI * 0.36,
        tiltY: Math.PI * 0.61,
        color: 0xb87452,
    }),
]);

class ExplorerMoon extends CelestialBody {
    constructor(spec) {
        super({
            mass: 0.0123,
            radius: 2.5,
            nodeType: 'moon',
            name: `Moon_Explorer_${spec.index}`,
            bodyProfile: ASTRONOMY_BODY_PROFILES.moon,
        });

        this.index = spec.index;
        this.orbitRadius = spec.orbitRadius;
        this.orbitSpeed = spec.orbitSpeed;
        this.tiltX = spec.tiltX;
        this.tiltY = spec.tiltY;
        this._surfaceParams = Object.freeze({
            color: spec.color,
            roughness: 0.90,
            metalness: 0.02,
        });

        this._orbitPivot = null;
        this._meshBuilt = false;
    }

    buildMesh(parentPlanetMesh, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        const moonOrbit = new THREE.Object3D();
        moonOrbit.name = `MoonOrbit_Explorer_${this.index}`;
        moonOrbit.rotation.x = this.tiltX;
        moonOrbit.rotation.y = this.tiltY;

        const moonGeometry = new THREE.IcosahedronGeometry(this.radius, 2);
        const moonMaterial = MaterialRegistry.get('moon-surface', this._surfaceParams);

        this.mesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.mesh.name = this.name;
        this.mesh.position.set(this.orbitRadius, 0, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // LEY 15: this moon is a real CelestialBody-backed mass, not an anonymous mesh.
        this.mesh.userData = this.buildUserData({
            isNode: true,
            label: `Luna ${this.index} de ${EXPLORER_CONFIG.appName}`,
            parentAppId: EXPLORER_CONFIG.appId,
            parentName: EXPLORER_CONFIG.appName,
            parentMass: parentPlanetMesh,
        });

        moonOrbit.add(this.mesh);
        parentPlanetMesh.add(moonOrbit);

        // LEY 15: register an orbit node that already owns the moon mass.
        physicsSystem.registerOrbit(moonOrbit, this.orbitSpeed);

        this._orbitPivot = moonOrbit;
        this._meshBuilt = true;
        this._initialized = true;

        return this.mesh;
    }

    update(dt) {
        // REGLA 8: zero-GC by design. Moon motion is delegated to CelestialPhysicsSystem.
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

export class ExplorerPlanet extends CelestialBody {
    constructor() {
        super({
            mass: EXPLORER_CONFIG.bodyProfile?.massEarths ?? 0.64,
            radius: EXPLORER_CONFIG.geometryRadius,
            nodeType: 'planet',
            name: `Planet_${EXPLORER_CONFIG.appName}`,
            bodyProfile: EXPLORER_CONFIG.bodyProfile,
        });

        this.planetClass = EXPLORER_CONFIG.planetClass;
        this.appId = EXPLORER_CONFIG.appId;
        this.appName = EXPLORER_CONFIG.appName;
        this.orbitRadius = EXPLORER_CONFIG.orbitRadius;
        this.orbitSpeed = EXPLORER_CONFIG.orbitSpeed;
        this.moonCount = EXPLORER_CONFIG.moonCount;
        this.color = EXPLORER_CONFIG.color;
        this.hasClouds = true;

        this._surfaceMaterialParams = EXPLORER_CONFIG.surfaceMaterial;
        this._cloudMaterialParams = EXPLORER_CONFIG.cloudMaterial;
        this._shaderSystem = null;
        this._hitboxMesh = null;
        this._meshBuilt = false;

        // LEY 15: every Explorer moon is itself a CelestialBody subclass.
        this.moons = EXPLORER_MOON_SPECS.map((spec) => new ExplorerMoon(spec));
    }

    buildMesh(shaderSystem, physicsSystem) {
        if (this._meshBuilt) return this.mesh;

        this._shaderSystem = shaderSystem;

        const planetGeometry = new THREE.IcosahedronGeometry(
            EXPLORER_CONFIG.geometryRadius,
            EXPLORER_CONFIG.geometryDetail
        );

        // REGLA 19: the base surface comes from MaterialRegistry, not an inline constructor.
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
        });

        const hitboxGeometry = new THREE.SphereGeometry(EXPLORER_CONFIG.hitboxRadius, 6, 6);
        const hitboxMaterial = MaterialRegistry.get('hitbox-invisible');
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.name = `Hitbox_${this.appName}`;
        hitbox.userData = { ...this.mesh.userData };
        this.mesh.add(hitbox);
        this._hitboxMesh = hitbox;

        // REGLA 19: PlanetShaderSystem may add atmosphere and clouds, but Explorer keeps
        // its registry-owned surface material instead of replacing it inline.
        shaderSystem.upgradePlanet(this.mesh, this.planetClass, false, {
            preserveSurfaceMaterial: true,
            cloudMaterialParams: this._cloudMaterialParams,
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
        // REGLA 8: no allocations here. Orbital physics and cloud animation are owned
        // by CelestialPhysicsSystem and PlanetShaderSystem respectively.
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
