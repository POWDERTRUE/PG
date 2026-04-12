// frontend/src/engine/universe/PlanetBuilderSystem.js
import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';
import { QuadTreeSphere } from '../planet/QuadTreeSphere.js';

export class PlanetBuilderSystem {
    constructor() {
        this.planets = new Map();
        this.isEnabled = true;
        // Zero-GC buffers: pre-alocados, nunca instanciados en update()
        this._relativeCamera = new THREE.Vector3();
        this._projScreenMatrix = new THREE.Matrix4();
        this._frustum = new THREE.Frustum();
    }

    init() {
        // Obtenemos el pool pre-alocado de memoria
        this.chunkPool = Registry.get('TerrainChunkPool');
        
        // El ancla de la escena donde vivirán los nodos
        this.planetGroup = new THREE.Group();
        Registry.get('SceneGraph').get('planets').add(this.planetGroup);

        // Agregamos una luz direccional base para los MeshStandardMaterial
        const sunLight = new THREE.DirectionalLight(0xffffee, 2.0);
        sunLight.position.set(1000, 200, 1000); // Mismo vector del shader atmosférico
        this.planetGroup.add(sunLight);

        // Registro en el FrameScheduler (Fase: SIMULATION)
        Registry.get('scheduler').register(this, 'simulation');
    }

    createPlanet(id, radius, position, type = 'TERRAN') {
        // Enlazar coordenadas locales para resolver los floats 
        const localGroup = new THREE.Group();
        localGroup.position.copy(position);
        this.planetGroup.add(localGroup);

        // Obtener materiales químicos
        const mats = Registry.get('PlanetShaderSystem').createPlanetaryMaterials(radius, type);

        // QuadTreeSphere orquesta internamente las 6 caras del cubo
        // Le pasamos el material de superficie para que sus QuadTreeNodes lo inyecten
        const sphereContainer = new QuadTreeSphere(this.chunkPool, localGroup, radius, mats.surface);

        // Instanciar el envoltorio esférico de Dispersión Atmosférica
        const atmosphereMesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 64, 64), mats.atmosphere);
        localGroup.add(atmosphereMesh);

        this.planets.set(id, {
            id,
            position:       position,
            radius:         radius,
            sphere:         sphereContainer,
            group:          localGroup,
            atmosphereMesh: atmosphereMesh,   // referencia para el Culling Switch dínámico
        });
    }

    update(deltaTime) {
        if (!this.isEnabled) return;

        const camera = Registry.get('camera');
        if (!camera) return;
        const cameraPos = camera.position;

        // V31: Zero-GC Frustum Extraction for QuadTree Culling
        this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

        for (const [id, planet] of this.planets) {
            // ── QuadTree LOD ───────────────────────────────────────
            this._relativeCamera.subVectors(cameraPos, planet.position);
            planet.sphere.update(this._relativeCamera, this._frustum, planet.position);

            // ── Culling Switch Dinámico de Atmósfera ───────────────────────
            // Fuera de la exosfera: FrontSide → Z-Buffer descarta el interior →  60 FPS
            // Dentro de la exosfera: BackSide → cielo envuelve al jugador sin parpadeo
            if (planet.atmosphereMesh) {
                // Usamos lengthSq para evitar sqrt (Zero-GC)
                const atmoRadiusSq = (planet.radius * 1.05) * (planet.radius * 1.05);
                const distSq = this._relativeCamera.lengthSq();
                const mat = planet.atmosphereMesh.material;

                if (distSq < atmoRadiusSq) {
                    // Cámara DENTRO de la atmósfera
                    if (mat.side !== THREE.BackSide) {
                        mat.side = THREE.BackSide;
                        mat.needsUpdate = true;
                    }
                } else {
                    // Cámara FUERA de la atmósfera
                    if (mat.side !== THREE.FrontSide) {
                        mat.side = THREE.FrontSide;
                        mat.needsUpdate = true;
                    }
                }
            }
        }
    }

    dispose() {
        for (const [, planet] of this.planets) {
            planet.sphere?.destroyTree?.();
            planet.atmosphereMesh?.parent?.remove(planet.atmosphereMesh);
            planet.atmosphereMesh?.geometry?.dispose?.();
            planet.atmosphereMesh?.material?.dispose?.();
            planet.group?.parent?.remove(planet.group);
        }
        this.planets.clear();
        this.planetGroup?.parent?.remove(this.planetGroup);
        this.planetGroup = null;
        this.chunkPool = null;
    }
}
