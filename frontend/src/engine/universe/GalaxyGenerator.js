// frontend/src/engine/universe/GalaxyGenerator.js
import * as THREE from 'three';
import { SunCoronaSystem } from '../galaxy/SunCoronaSystem.js';
import { OrbitalRingSystem } from '../galaxy/OrbitalRingSystem.js';
import { AsteroidBeltRenderer } from '../galaxy/AsteroidBeltRenderer.js';
import { ASTRONOMY_BODY_PROFILES, GALAXY_SPEC } from '../config/UniverseSpec.js';
import { createSeededRandom, range } from '../utils/SeededRandom.js';
import { Registry } from '../core/ServiceRegistry.js';
import { TerminalPlanet } from '../physics/planets/TerminalPlanet.js';
import { ExplorerPlanet } from '../physics/planets/ExplorerPlanet.js';
import { GalleryPlanet } from '../physics/planets/GalleryPlanet.js';
import { HologramPlanet } from '../physics/planets/HologramPlanet.js';

export class GalaxyGenerator {
    constructor(sceneGraph, physicsSystem) {
        this.sceneGraph = sceneGraph;
        this.physicsSystem = physicsSystem;
        this.appNodes = ['Terminal', 'Explorer', 'Gallery', 'Database', 'Hologram', 'Settings'];
        this._planetShader = null;
        this._planetClasses = {
            Terminal: 'volcanic',
            Explorer: 'desert',
            Gallery: 'ocean',
            Database: 'ice',
            Hologram: 'gas_giant',
            Settings: 'jungle',
        };
        this.options = { starCount: 50000, maxOrbitCount: 40 };
        this._rng = createSeededRandom(`${GALAXY_SPEC.seed}:observer-system`);

        this.sunCorona = null;
        this.asteroidBelt = null;
        this.orbitRings = null;
        this._solarSystemRoot = null;
        this._moonMatCache = new Map();
    }

    setOptions(options = {}) {
        this.options = { ...this.options, ...options };
    }

    async buildAsync() {
        await this.createStarfield();
        await this.createHierarchicalSolarSystem();
    }

    async createStarfield() {
        return Promise.resolve();
    }

    async createHierarchicalSolarSystem() {
        this._planetShader = this._getPlanetShader();
        if (!this._planetShader) {
            throw new Error('[GalaxyGenerator] PlanetShaderSystem is not registered.');
        }

        const supramass = Registry
            .tryGet('SupraconsciousnessMass')
            ?.gravitationalMass
            ?? 1_000_000;
        const observerScenario = GALAXY_SPEC.visibleScenario?.observerSystem;

        const solarSystem = new THREE.Object3D();
        solarSystem.name = 'SolarSystem_Core';
        solarSystem.position.set(
            observerScenario?.position?.x ?? 800,
            observerScenario?.position?.y ?? 0,
            observerScenario?.position?.z ?? 0
        );
        solarSystem.userData = {
            isSystemRoot: true,
            scenarioRole: 'observer-system',
            label: 'Observer Solar System',
            systemRadius: observerScenario?.boundaryRadius ?? 470,
        };
        this._solarSystemRoot = solarSystem;

        this.physicsSystem.registerOrbitAroundSupraconsciousness(solarSystem, supramass);
        this.sceneGraph.layers.systems.add(solarSystem);

        const sunColor = GALAXY_SPEC.solarSystem.sun.color;
        const sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(GALAXY_SPEC.solarSystem.sun.radius, 64, 64),
            new THREE.MeshBasicMaterial({ color: 0xfffbf0 })
        );
        sunMesh.name = 'MegaSun';
        sunMesh.userData = {
            isApp: true,
            isNode: true,
            isMass: true,
            nodeType: 'star',
            appId: 'sol',
            appName: 'Sol',
            label: 'Sol - Estrella del Sistema Solar',
            bodyProfile: GALAXY_SPEC.solarSystem.sun.bodyProfile,
        };

        const sunHitbox = new THREE.Mesh(
            new THREE.SphereGeometry(GALAXY_SPEC.solarSystem.sun.hitboxRadius, 6, 6),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        sunHitbox.userData = { ...sunMesh.userData };
        sunHitbox.name = 'Hitbox_MegaSun';
        sunMesh.add(sunHitbox);
        solarSystem.add(sunMesh);
        this._planetShader.setSunReference(sunMesh);

        this.sunCorona = new SunCoronaSystem(this.sceneGraph.scene, sunMesh);
        this.sceneGraph.scene.add(new THREE.AmbientLight(0x112244, 0.35));

        const planetGeo = new THREE.IcosahedronGeometry(10, 5);
        const moonGeo = new THREE.IcosahedronGeometry(2.5, 2);
        const satelliteHeadGeo = new THREE.SphereGeometry(1.55, 18, 18);
        const satelliteTorsoGeo = new THREE.CylinderGeometry(1.18, 1.5, 5.6, 18);
        const satelliteArmGeo = new THREE.BoxGeometry(5.6, 0.42, 0.42);
        const satellitePanelGeo = new THREE.BoxGeometry(4.8, 2.8, 0.18);
        const satelliteSpineGeo = new THREE.CylinderGeometry(0.18, 0.22, 3.8, 12);
        const satelliteHaloGeo = new THREE.TorusGeometry(2.55, 0.16, 12, 40);
        const satelliteDishGeo = new THREE.ConeGeometry(1.15, 1.9, 24);

        const sunMetamorphOrbit = new THREE.Object3D();
        sunMetamorphOrbit.name = 'MetamorphOrbit_Sol';
        sunMetamorphOrbit.rotation.x = Math.PI * 0.18;
        sunMetamorphOrbit.rotation.z = Math.PI * 0.1;
        this.physicsSystem.registerOrbit(sunMetamorphOrbit, 0.24);
        sunMesh.add(sunMetamorphOrbit);

        const sunMetamorphColor = new THREE.Color(sunColor).lerp(new THREE.Color(0xf6fbff), 0.62);
        const sunSatellite = new THREE.Group();
        sunSatellite.position.set(58, 0, 0);
        sunSatellite.scale.setScalar(0.001);
        sunSatellite.visible = false;
        sunSatellite.name = 'MetamorphSatellite_Sol';
        sunSatellite.userData = {
            isApp: true,
            isNode: true,
            isMass: true,
            isSatellite: true,
            isMetamorphMoon: true,
            spatialType: 'SATELLITE',
            nodeType: 'metamorph-moon',
            appId: 'sol',
            appName: 'Sol',
            label: 'Satelite humano de metamorfosis Sol',
            parentAppId: 'sol',
            parentName: 'Sol',
            parentMass: sunMesh,
            bodyProfile: ASTRONOMY_BODY_PROFILES.satellite,
        };

        {
            const sunBodyMat = new THREE.MeshStandardMaterial({
                color: sunMetamorphColor.clone().lerp(new THREE.Color(0xffffff), 0.24),
                roughness: 0.16,
                metalness: 0.8,
                emissive: sunMetamorphColor.clone().multiplyScalar(0.26),
                transparent: true,
                opacity: 0.97,
            });
            const sunPanelMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xfff3d6),
                roughness: 0.15,
                metalness: 0.82,
                emissive: sunMetamorphColor.clone().multiplyScalar(0.2),
                transparent: true,
                opacity: 0.9,
            });
            const sunAccentMat = new THREE.MeshStandardMaterial({
                color: sunMetamorphColor.clone().lerp(new THREE.Color(0xffffff), 0.4),
                roughness: 0.12,
                metalness: 0.86,
                emissive: sunMetamorphColor.clone().multiplyScalar(0.36),
                transparent: true,
                opacity: 0.94,
            });

            const sunParts = [
                new THREE.Mesh(satelliteTorsoGeo, sunBodyMat.clone()),
                new THREE.Mesh(satelliteHeadGeo, sunBodyMat.clone()),
                new THREE.Mesh(satelliteSpineGeo, sunAccentMat.clone()),
                new THREE.Mesh(satelliteArmGeo, sunAccentMat.clone()),
                new THREE.Mesh(satellitePanelGeo, sunPanelMat.clone()),
                new THREE.Mesh(satellitePanelGeo, sunPanelMat.clone()),
                new THREE.Mesh(satelliteHaloGeo, sunAccentMat.clone()),
                new THREE.Mesh(satelliteDishGeo, sunAccentMat.clone()),
                new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), sunAccentMat.clone()),
            ];
            sunParts[0].position.y = 0.6;
            sunParts[1].position.set(0, 4.6, 0);
            sunParts[2].position.set(0, -1.4, 0);
            sunParts[3].position.set(0, 1.5, 0);
            sunParts[4].position.set(-5.3, 1.5, 0);
            sunParts[5].position.set(5.3, 1.5, 0);
            sunParts[6].position.set(0, 1.2, 0);
            sunParts[6].rotation.x = Math.PI * 0.5;
            sunParts[7].position.set(0, -3.2, 0);
            sunParts[7].rotation.x = -Math.PI * 0.5;
            sunParts[8].position.set(0, 1.5, 0);

            for (const part of sunParts) {
                part.userData.baseOpacity = part.material.opacity;
                sunSatellite.add(part);
            }
        }
        sunMetamorphOrbit.add(sunSatellite);

        const planetConfigs = GALAXY_SPEC.solarSystem.planets;

        for (let i = 0; i < planetConfigs.length; i++) {
            const config = planetConfigs[i];
            const appName = config.name;
            const appId = config.appId;

            const planetOrbit = new THREE.Object3D();
            planetOrbit.name = `PlanetOrbit_${appName}`;
            // Distribución en arco de 180° frente al usuario (vista de galería)
            // Los planetas se despliegan de izquierda a derecha en Y=0 estricto
            const arcAngle = (i / (this.appNodes.length - 1)) * Math.PI - (Math.PI * 0.5);
            planetOrbit.rotation.y = arcAngle;
            this.physicsSystem.registerOrbit(planetOrbit, config.orbitSpeed * 0.4); // Órbita más lenta y serena
            solarSystem.add(planetOrbit);

            let planet;
            let usesManagedMoons = false;
            const distance = config.orbitRadius;
            const planetClass = config.class ?? this._planetClasses[appName] ?? 'default';
            const planetColor = config.color;

            if (config.name === 'Terminal') {
                const terminalBody = new TerminalPlanet();
                planet = terminalBody.buildMesh(this._planetShader);
            } else if (config.name === 'Explorer') {
                const explorerBody = new ExplorerPlanet();
                planet = explorerBody.buildMesh(this._planetShader, this.physicsSystem);
                usesManagedMoons = true;
            } else if (config.name === 'Gallery') {
                const galleryBody = new GalleryPlanet();
                planet = galleryBody.buildMesh(this._planetShader, this.physicsSystem);
                usesManagedMoons = true;
            } else if (config.name === 'Hologram') {
                const hologramBody = new HologramPlanet();
                planet = hologramBody.buildMesh(this._planetShader, this.physicsSystem);
                usesManagedMoons = true;
            } else {
                planet = new THREE.Mesh(
                    planetGeo,
                    new THREE.MeshStandardMaterial({
                        color: planetColor,
                        roughness: 0.55,
                        metalness: 0.4,
                        emissive: new THREE.Color(planetColor).multiplyScalar(0.02), // Emissive mínimo
                    })
                );
                planet.position.set(distance, 0, 0);
                planet.name = `Planet_${appName}`;
                planet.castShadow = true;
                planet.receiveShadow = true;

                planet.userData = {
                    isApp: true,
                    isNode: true,
                    isMass: true,
                    nodeType: 'planet',
                    appId,
                    appName,
                    planetClass,
                    distance,
                    orbitRadius: distance,
                    moonCount: config.moonCount,
                    label: appName,
                    bodyProfile: config.bodyProfile || ASTRONOMY_BODY_PROFILES[planetClass] || null,
                };

                const hitbox = new THREE.Mesh(
                    new THREE.SphereGeometry(180, 6, 6),
                    new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0,
                        depthWrite: false,
                        side: THREE.FrontSide,
                    })
                );
                hitbox.userData = { ...planet.userData };
                hitbox.name = `Hitbox_${appName}`;
                planet.add(hitbox);

                this._planetShader.upgradePlanet(planet, planetClass, planetClass === 'gas_giant');
            }

            planetOrbit.add(planet);

            if (!usesManagedMoons) {
                for (let m = 0; m < config.moonCount; m++) {
                    const moonOrbit = new THREE.Object3D();
                    moonOrbit.name = `MoonOrbit_${appName}_${m}`;
                    moonOrbit.rotation.x = range(this._rng, 0, Math.PI);
                    moonOrbit.rotation.y = range(this._rng, 0, Math.PI * 2);
                    this.physicsSystem.registerOrbit(moonOrbit, 2.1 + (i * 0.15) + (m * 0.45));
                    planet.add(moonOrbit);

                    const moon = new THREE.Mesh(moonGeo, this._getMoonMaterial(planetClass));
                    moon.position.set(18 + m * 7, 0, 0);
                    moon.name = `Moon_${appName}_${m}`;
                    moon.castShadow = true;
                    moon.receiveShadow = true;
                    moon.userData = {
                        isMass: true,
                        nodeType: 'moon',
                        label: `Luna ${m + 1} de ${appName}`,
                        parentAppId: appId,
                        parentName: appName,
                        parentMass: planet,
                        bodyProfile: ASTRONOMY_BODY_PROFILES.moon,
                    };
                    moonOrbit.add(moon);
                }
            }

            const metamorphOrbit = new THREE.Object3D();
            metamorphOrbit.name = `MetamorphOrbit_${appName}`;
            metamorphOrbit.rotation.x = Math.PI * 0.32;
            metamorphOrbit.rotation.z = Math.PI * 0.12;
            this.physicsSystem.registerOrbit(metamorphOrbit, 0.75 + (i * 0.04));
            planet.add(metamorphOrbit);

            const metamorphColor = new THREE.Color(planetColor).lerp(new THREE.Color(0xe8f8ff), 0.55);
            const metamorphSatellite = new THREE.Group();
            metamorphSatellite.position.set(28, 0, 0);
            metamorphSatellite.scale.setScalar(0.001);
            metamorphSatellite.visible = false;
            metamorphSatellite.name = `MetamorphSatellite_${appName}`;
            metamorphSatellite.userData = {
                isNode: true,
                isMass: true,
                isSatellite: true,
                isMetamorphMoon: true,
                spatialType: 'SATELLITE',
                nodeType: 'metamorph-moon',
                appId,
                appName,
                label: `Satelite humano de metamorfosis ${appName}`,
                parentAppId: appId,
                parentName: appName,
                parentMass: planet,
                bodyProfile: ASTRONOMY_BODY_PROFILES.satellite,
            };

            {
                const bodyMat = new THREE.MeshStandardMaterial({
                    color: metamorphColor.clone().lerp(new THREE.Color(0xf7fbff), 0.24),
                    roughness: 0.2,
                    metalness: 0.78,
                    emissive: metamorphColor.clone().multiplyScalar(0.24),
                    transparent: true,
                    opacity: 0.96,
                });
                const panelMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0xeef9ff),
                    roughness: 0.16,
                    metalness: 0.84,
                    emissive: metamorphColor.clone().multiplyScalar(0.16),
                    transparent: true,
                    opacity: 0.88,
                });
                const accentMat = new THREE.MeshStandardMaterial({
                    color: metamorphColor.clone().lerp(new THREE.Color(0xffffff), 0.35),
                    roughness: 0.14,
                    metalness: 0.82,
                    emissive: metamorphColor.clone().multiplyScalar(0.34),
                    transparent: true,
                    opacity: 0.92,
                });

                const torso = new THREE.Mesh(satelliteTorsoGeo, bodyMat.clone());
                torso.position.y = 0.6;
                const head = new THREE.Mesh(satelliteHeadGeo, bodyMat.clone());
                head.position.set(0, 4.6, 0);
                const spine = new THREE.Mesh(satelliteSpineGeo, accentMat.clone());
                spine.position.set(0, -1.4, 0);
                const arms = new THREE.Mesh(satelliteArmGeo, accentMat.clone());
                arms.position.set(0, 1.5, 0);
                const leftPanel = new THREE.Mesh(satellitePanelGeo, panelMat.clone());
                leftPanel.position.set(-5.3, 1.5, 0);
                const rightPanel = new THREE.Mesh(satellitePanelGeo, panelMat.clone());
                rightPanel.position.set(5.3, 1.5, 0);
                const halo = new THREE.Mesh(satelliteHaloGeo, accentMat.clone());
                halo.position.set(0, 1.2, 0);
                halo.rotation.x = Math.PI * 0.5;
                const dish = new THREE.Mesh(satelliteDishGeo, accentMat.clone());
                dish.position.set(0, -3.2, 0);
                dish.rotation.x = -Math.PI * 0.5;
                const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), accentMat.clone());
                shoulder.position.set(0, 1.5, 0);

                for (const part of [torso, head, spine, arms, leftPanel, rightPanel, halo, dish, shoulder]) {
                    part.userData.baseOpacity = part.material.opacity;
                    metamorphSatellite.add(part);
                }
            }
            metamorphOrbit.add(metamorphSatellite);
        }

        this.orbitRings = new OrbitalRingSystem(solarSystem, GALAXY_SPEC);
        this.asteroidBelt = new AsteroidBeltRenderer(solarSystem, GALAXY_SPEC);
        this._buildObserverSystemEnvelope(solarSystem);
        this._stampObserverSystemDeterministicKeys(solarSystem);
        await this._restoreObserverSystemScars(solarSystem);

        console.log('[GalaxyGenerator] Solar System built: 6 planets, corona, orbital rings, asteroid belt.');
    }

    _stampObserverSystemDeterministicKeys(solarSystem) {
        const rootKey = 'observer-system/root';
        solarSystem.userData = {
            ...(solarSystem.userData ?? {}),
            deterministicKey: rootKey,
        };

        solarSystem.traverse((node) => {
            if (node === solarSystem) {
                return;
            }

            const key = this._buildObserverSystemKey(node);
            if (!key) {
                return;
            }

            const isHitbox = /^Hitbox_/i.test(node.name || '');
            node.userData = {
                ...(node.userData ?? {}),
                deterministicKey: key,
                ...(isHitbox ? {
                    isHitbox: true,
                    projectionHostKey: node.parent?.userData?.deterministicKey ?? null,
                } : {}),
            };
        });
    }

    _buildObserverSystemKey(node) {
        const root = 'observer-system';
        const appId = typeof node.userData?.appId === 'string'
            ? node.userData.appId.trim().toLowerCase()
            : null;
        const parentAppId = typeof node.userData?.parentAppId === 'string'
            ? node.userData.parentAppId.trim().toLowerCase()
            : appId;
        const nodeType = typeof node.userData?.nodeType === 'string'
            ? node.userData.nodeType.trim().toLowerCase()
            : '';
        const slug = this._slugify(node.name || node.userData?.label || nodeType || 'node');

        if (/^Hitbox_/i.test(node.name || '')) {
            const parentKey = node.parent?.userData?.deterministicKey;
            return parentKey ? `${parentKey}/hitbox` : `${root}/hitbox/${slug}`;
        }

        if (nodeType === 'star') {
            return `${root}/star/${appId || slug}`;
        }

        if (nodeType === 'planet') {
            return `${root}/planet/${appId || slug}`;
        }

        if (nodeType === 'moon') {
            return `${root}/moon/${parentAppId || 'unknown'}/${this._extractOrdinal(node)}`;
        }

        if (nodeType === 'metamorph-moon') {
            return `${root}/satellite/${parentAppId || appId || slug}/metamorph`;
        }

        if (node.userData?.isMass || node.userData?.isApp) {
            return `${root}/mass/${appId || slug}`;
        }

        return null;
    }

    _extractOrdinal(node) {
        const candidates = [
            node?.name ?? '',
            node?.userData?.label ?? '',
        ];

        for (let i = 0; i < candidates.length; i++) {
            const match = String(candidates[i]).match(/(\d+)(?!.*\d)/);
            if (match) {
                return match[1];
            }
        }

        return '0';
    }

    _slugify(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'node';
    }

    async _restoreObserverSystemScars(solarSystem) {
        const persistence = Registry.tryGet('PersistenceSystem');
        if (!persistence) {
            return;
        }

        try {
            await persistence.restoreScarsInTree(solarSystem, { silent: true });
        } catch (error) {
            console.warn('[GalaxyGenerator] Failed to restore persistent scars for observer system.', error);
        }
    }

    _buildObserverSystemEnvelope(solarSystem) {
        const observerScenario = GALAXY_SPEC.visibleScenario?.observerSystem;
        if (!observerScenario) {
            return;
        }

        const envelope = new THREE.Group();
        envelope.name = 'ObserverSystemEnvelope';
        envelope.renderOrder = -2;

        const plane = new THREE.Mesh(
            new THREE.RingGeometry(64, observerScenario.planeRadius, 96),
            new THREE.MeshBasicMaterial({
                color: 0x4bb9ff,
                transparent: true,
                opacity: 0.018,  // Más sutil — solo guia visual
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        plane.rotation.x = Math.PI * 0.5;
        plane.name = 'ObserverSystemPlane';
        envelope.add(plane);

        const boundary = new THREE.Mesh(
            new THREE.RingGeometry(observerScenario.boundaryRadius - 2.2, observerScenario.boundaryRadius, 128),
            new THREE.MeshBasicMaterial({
                color: 0xa4d9ff,
                transparent: true,
                opacity: 0.10,  // Borde limpio pero apenas visible
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        boundary.rotation.x = Math.PI * 0.5;
        boundary.name = 'ObserverSystemBoundary';
        envelope.add(boundary);

        const halo = new THREE.Mesh(
            new THREE.RingGeometry(observerScenario.haloRadius - 10, observerScenario.haloRadius, 128),
            new THREE.MeshBasicMaterial({
                color: 0x3b86d6,
                transparent: true,
                opacity: 0.09,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        halo.rotation.x = Math.PI * 0.5;
        halo.name = 'ObserverSystemHalo';
        envelope.add(halo);

        solarSystem.add(envelope);
    }

    _getMoonMaterial(planetClass) {
        const specs = {
            volcanic: { color: 0x443322, roughness: 0.95, metalness: 0.05 },
            desert: { color: 0xcc8866, roughness: 0.90, metalness: 0.02 },
            ocean: { color: 0x88ccee, roughness: 0.40, metalness: 0.05 },
            ice: { color: 0xeef8ff, roughness: 0.10, metalness: 0.30 },
            gas_giant: { color: 0xddcc44, roughness: 0.60, metalness: 0.10 },
            jungle: { color: 0x335522, roughness: 0.80, metalness: 0.02 },
        };

        if (!this._moonMatCache.has(planetClass)) {
            const spec = specs[planetClass] || { color: 0xaaaaaa, roughness: 0.75, metalness: 0.05 };
            const mat = new THREE.MeshStandardMaterial({
                color: spec.color,
                roughness: spec.roughness,
                metalness: spec.metalness,
                emissive: new THREE.Color(spec.color).multiplyScalar(0.04),
            });
            this._moonMatCache.set(planetClass, mat);
        }

        return this._moonMatCache.get(planetClass).clone();
    }

    update(delta) {
        this.sunCorona?.update(delta);
        this.asteroidBelt?.update(delta);
    }

    dispose() {
        this.sunCorona?.dispose?.();
        this.asteroidBelt?.dispose?.();
        this.orbitRings?.dispose?.();

        const shader = this._planetShader ?? Registry.tryGet('PlanetShaderSystem');
        const geometries = new Set();
        const materials = new Set();
        this._solarSystemRoot?.traverse((object) => {
            if (object.userData?.isApp || object.userData?.isPlanetShaderDecoration) {
                shader?.detachPlanet?.(object);
            }
            if (object.geometry) geometries.add(object.geometry);
            if (Array.isArray(object.material)) {
                object.material.forEach((material) => material && materials.add(material));
            } else if (object.material) {
                materials.add(object.material);
            }
        });

        this._solarSystemRoot?.parent?.remove(this._solarSystemRoot);
        geometries.forEach((geometry) => geometry.dispose?.());
        materials.forEach((material) => material.dispose?.());

        for (const material of this._moonMatCache.values()) {
            material.dispose?.();
        }
        this._moonMatCache.clear();
        this._solarSystemRoot = null;
        this.sunCorona = null;
        this.asteroidBelt = null;
        this.orbitRings = null;
    }

    _getPlanetShader() {
        if (this._planetShader) return this._planetShader;
        this._planetShader = Registry.tryGet('PlanetShaderSystem');
        return this._planetShader;
    }
}
