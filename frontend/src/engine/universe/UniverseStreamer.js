import * as THREE from 'three';
import { SectorAddress, SectorGridSpec } from '../core/SectorAddress.js';
import { Registry } from '../core/ServiceRegistry.js';
import { MeshComponent } from '../core/EntityManager.js';

export class UniverseStreamer {
    constructor(camera, sceneGraph, spatialGrid, sectorGrid = SectorGridSpec, renderDistance = SectorGridSpec.LOAD_RADIUS) {
        this.camera = camera;
        this.sceneGraph = sceneGraph;
        this.spatialGrid = spatialGrid;

        if (typeof sectorGrid === 'number') {
            this.gridSpec = Object.freeze({
                WIDTH: sectorGrid,
                HEIGHT: sectorGrid,
                DEPTH: sectorGrid,
                LOAD_RADIUS: renderDistance,
            });
        } else {
            this.gridSpec = sectorGrid ?? SectorGridSpec;
        }

        this.renderDistance = Number.isFinite(renderDistance)
            ? renderDistance
            : (this.gridSpec.LOAD_RADIUS ?? SectorGridSpec.LOAD_RADIUS);

        this.activeSectors = new Map();
        this.currentSectorId = null;
        this._scratchSector = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
        this._scratchWorldCenter = new THREE.Vector3();
        this._scratchParsedSector = new THREE.Vector3();
        this._scratchEntityWorldPos = new THREE.Vector3();
        this._requiredSectors = new Set();
    }

    async initialize() {
        console.log('[UniverseStreamer] Initialized. Awaiting camera movement...');
        this.checkAndStreamSectors();
    }

    getSectorId(position) {
        const sector = SectorAddress.worldToSector(position, this._scratchSector, this.gridSpec);
        return SectorAddress.getSectorKey(sector.x, sector.y, sector.z);
    }

    update(_deltaTime) {
        const newSectorId = this.getSectorId(this.camera.position);

        if (newSectorId !== this.currentSectorId) {
            this.currentSectorId = newSectorId;
            this.checkAndStreamSectors();
        }
    }

    checkAndStreamSectors() {
        if (!this.currentSectorId) return;

        const currentSector = SectorAddress.parseSectorKey(this.currentSectorId, this._scratchParsedSector);
        if (!currentSector) {
            return;
        }

        const cx = currentSector.x;
        const cy = currentSector.y;
        const cz = currentSector.z;
        const requiredSectors = this._requiredSectors;
        requiredSectors.clear();

        for (let x = cx - this.renderDistance; x <= cx + this.renderDistance; x++) {
            for (let y = cy - this.renderDistance; y <= cy + this.renderDistance; y++) {
                for (let z = cz - this.renderDistance; z <= cz + this.renderDistance; z++) {
                    requiredSectors.add(SectorAddress.getSectorKey(x, y, z));
                }
            }
        }

        for (const [sectorId, sectorGroup] of this.activeSectors.entries()) {
            if (!requiredSectors.has(sectorId)) {
                this.unloadSector(sectorId, sectorGroup);
            }
        }

        for (const sectorId of requiredSectors) {
            if (!this.activeSectors.has(sectorId)) {
                this.loadSector(sectorId);
            }
        }
    }

    async loadSector(sectorId) {
        this.activeSectors.set(sectorId, null);

        const sectorGroup = new THREE.Group();
        sectorGroup.name = `Sector_${sectorId}`;

        await this.generateSectorContent(sectorId, sectorGroup);

        if (this.activeSectors.has(sectorId)) {
            this.sceneGraph.layers.galaxy.add(sectorGroup);
            this.activeSectors.set(sectorId, sectorGroup);

            const entityManager = Registry.tryGet('EntityManager');
            const eWorld = entityManager ? entityManager.getWorld() : null;

            sectorGroup.traverse((child) => {
                if (child.isMesh && eWorld) {
                    // OMEGA RULE: Pure Data-Oriented Bridge
                    // Generate integer ID, store the mesh in ECS, and feed the ID to SpatialIndex
                    const eId = eWorld.createEntity();
                    eWorld.addComponent(eId, 'MeshComponent', new MeshComponent(child));
                    child.userData.entityId = eId;

                    child.getWorldPosition(this._scratchEntityWorldPos);
                    this.spatialGrid.updateEntity(eId, this._scratchEntityWorldPos);
                }
            });
        } else {
            this.disposeGroup(sectorGroup);
        }
    }

    unloadSector(sectorId, sectorGroup) {
        if (sectorGroup) {
            this.sceneGraph.layers.galaxy.remove(sectorGroup);

            const entityManager = Registry.tryGet('EntityManager');
            const eWorld = entityManager ? entityManager.getWorld() : null;

            sectorGroup.traverse((child) => {
                if (child.isMesh && eWorld) {
                    const eId = child.userData.entityId;
                    if (eId !== undefined) {
                        this.spatialGrid.removeEntity(eId);
                        eWorld.destroyEntity(eId); // Free component and ID
                    }
                }
            });

            this.disposeGroup(sectorGroup);
        }
        this.activeSectors.delete(sectorId);
    }

    disposeGroup(group) {
        group.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((material) => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    dispose() {
        for (const [sectorId, sectorGroup] of this.activeSectors) {
            this.unloadSector(sectorId, sectorGroup);
        }
        this.activeSectors.clear();
        this._requiredSectors.clear();
    }

    async generateSectorContent(sectorId, group) {
        const sector = SectorAddress.parseSectorKey(sectorId, this._scratchParsedSector);
        if (!sector) {
            return;
        }

        const sectorCenter = SectorAddress.sectorToWorldCenter(
            sector.x,
            sector.y,
            sector.z,
            this._scratchWorldCenter,
            this.gridSpec
        );
        const halfW = this.gridSpec.WIDTH * 0.5;
        const halfH = this.gridSpec.HEIGHT * 0.5;
        const halfD = this.gridSpec.DEPTH * 0.5;

        const starGeo = new THREE.BufferGeometry();
        const starCount = 500;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = sectorCenter.x + (Math.random() * this.gridSpec.WIDTH) - halfW;
            positions[i + 1] = sectorCenter.y + (Math.random() * this.gridSpec.HEIGHT) - halfH;
            positions[i + 2] = sectorCenter.z + (Math.random() * this.gridSpec.DEPTH) - halfD;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x88ccff, size: 2.0, transparent: true, opacity: 0.8 });

        const stars = new THREE.Points(starGeo, starMat);
        group.add(stars);

        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
