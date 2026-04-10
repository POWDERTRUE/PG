/**
 * Window3DSystem.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';


export class Window3DSystem {
    static phase = 'workspace';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.windows = new Map();
    }

    init() {
        console.log('[Window3D] OMEGA Projection Engine Online.');
    }

    create3DWindow(entity, id, config) {
        const sceneGraph = this.Registry.get('SceneGraph');
        if (!sceneGraph) return null;
        const scene = sceneGraph.getScene();
        
        const width = config.width || 400;
        const height = config.height || 300;
        
        const geometry = new THREE.PlaneGeometry(width / 10, height / 10, 10, 10);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transmission: 0.9,
            roughness: 0.05,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.id = id;
        scene.add(mesh);
        
        this.windows.set(id, mesh);
        
        const entityManager = Registry.get('EntityManager');
        if (entityManager && entity) {
            entityManager.addComponent(entity, "MeshComponent", { mesh });
        }
        
        return mesh;
    }

    removeWindow(id) {
        const mesh = this.windows.get(id);
        if (mesh) {
            const sceneGraph = this.Registry.get('SceneGraph');
            if (sceneGraph) sceneGraph.getScene().remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.windows.delete(id);
        }
    }
}

