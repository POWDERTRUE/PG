/**
 * InstancedRenderSystem.js
 * OMEGA V28 Master Edition — Foundation Layer
 */
import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';


export class InstancedRenderSystem {
    static phase = 'foundation';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
        this.batches = new Map(); // id -> { mesh, dummy, matrix, count }
    }

    init() {
        console.log('[InstancedRenderSystem] OMEGA V28 Batching Engine Online.');
    }

    /**
     * Register a new batch
     */
    createBatch(id, geometry, material, count) {
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        const batch = {
            mesh,
            dummy: new THREE.Object3D(),
            matrix: new THREE.Matrix4(),
            count,
            currentIdx: 0,
            isDirty: false
        };

        this.batches.set(id, batch);
        
        const sceneGraph = this.Registry.get('SceneGraph');
        if (sceneGraph) {
            sceneGraph.addToLayer('universe', mesh);
        }

        console.log(`[InstancedRenderSystem] Created batch: ${id} (${count} instances)`);
        return batch;
    }

    /**
     * Set a single instance data
     */
    setInstance(id, index, position, rotation, scale, color) {
        const batch = this.batches.get(id);
        if (!batch) return;

        batch.dummy.position.copy(position);
        if (rotation) batch.dummy.rotation.copy(rotation);
        if (scale) batch.dummy.scale.set(scale, scale, scale);
        
        batch.dummy.updateMatrix();
        batch.mesh.setMatrixAt(index, batch.dummy.matrix);

        if (color) {
            batch.mesh.setColorAt(index, new THREE.Color(color));
        }
        batch.isDirty = true;
    }

    /**
     * Finalize batch updates
     */
    postUpdate() {
        this.batches.forEach(batch => {
            if (batch.isDirty) {
                batch.mesh.instanceMatrix.needsUpdate = true;
                if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
                batch.isDirty = false;
            }
        });
    }

    getMesh(id) {
        return this.batches.get(id)?.mesh;
    }
}

