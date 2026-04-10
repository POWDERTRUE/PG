import * as THREE from 'three';
import { System, HierarchyComponent, TransformComponent } from './EntityManager.js';
import { Registry } from './ServiceRegistry.js';

/**
 * @file HierarchySystem.js
 * @description Syncs parent→child world transforms in the ECS scene graph.
 *
 * V31 — Now computes actual world matrices via matrix multiplication.
 * Pre-allocs static reuse buffers to stay zero-GC.
 *
 * Transform propagation rule:
 *   child.worldMatrix = parent.worldMatrix × child.localMatrix
 *
 * Any system that needs a child's world position should read
 * child.userData.worldMatrix instead of mesh.matrixWorld (for pure-ECS
 * entities that have no Three.js counterpart).
 */
export class HierarchySystem extends System {
    static components = [HierarchyComponent, TransformComponent];
    static phase = 'physics'; // Runs before navigation so camera-parented entities are ready

    // ── Static zero-GC buffers (shared across all instances) ──────────────────
    static _parentMat  = new THREE.Matrix4();   // parent world matrix
    static _localMat   = new THREE.Matrix4();   // child local matrix
    static _childWorld = new THREE.Matrix4();   // computed child world matrix
    static _pos        = new THREE.Vector3();
    static _quat       = new THREE.Quaternion();
    static _scale      = new THREE.Vector3();

    constructor(services) {
        super();
        this.services = services;
        this.registry = Registry.get('registry');
    }

    execute(world, delta, time) {
        // Walk only root entities (no parent) that are dirty
        const entities = world.query(HierarchyComponent, TransformComponent);

        for (const id of entities) {
            const hier = world.getComponent(id, HierarchyComponent);
            if (hier.parent === null && hier.dirty) {
                // Root's world matrix is its local matrix (no parent to inherit from)
                const tf = world.getComponent(id, TransformComponent);
                HierarchySystem._parentMat.compose(
                    tf.position,
                    new THREE.Quaternion().setFromEuler(tf.rotation),
                    tf.scale
                );
                this._propagate(world, id, HierarchySystem._parentMat);
            }
        }
    }

    /**
     * Recursively propagate world matrices top-down.
     * @param {import('./EntityManager.js').ECSWorld} world
     * @param {number} id
     * @param {THREE.Matrix4} parentWorld — caller's world matrix (pre-computed)
     */
    _propagate(world, id, parentWorld) {
        const hier = world.getComponent(id, HierarchyComponent);
        if (!hier) return;

        for (const childId of hier.children) {
            const childTf   = world.getComponent(childId, TransformComponent);
            const childHier = world.getComponent(childId, HierarchyComponent);
            if (!childTf) continue;

            // Build child local matrix from ECS transform
            const { _localMat, _childWorld, _pos, _quat, _scale } = HierarchySystem;
            _pos.copy(childTf.position);
            _quat.setFromEuler(childTf.rotation);
            _scale.copy(childTf.scale);
            _localMat.compose(_pos, _quat, _scale);

            // child world = parent world × child local
            _childWorld.multiplyMatrices(parentWorld, _localMat);

            // Write result into userData so Three.js meshes / other systems can read it
            if (childTf.mesh) {
                childTf.mesh.matrixWorld.copy(_childWorld);
                childTf.mesh.matrixWorldNeedsUpdate = false;
            }
            // Also store for pure-ECS consumers
            childTf.worldMatrix = childTf.worldMatrix ?? new THREE.Matrix4();
            childTf.worldMatrix.copy(_childWorld);

            if (childHier) {
                childHier.dirty = false;
                // Pass child's world down to its children
                this._propagate(world, childId, _childWorld);
            }
        }

        hier.dirty = false;
    }
}
