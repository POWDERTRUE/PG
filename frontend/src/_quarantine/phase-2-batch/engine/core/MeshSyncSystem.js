import * as THREE from 'three';
import { System, TransformComponent, MeshComponent } from './EntityManager.js';
import { Registry } from './ServiceRegistry.js';

/**
 * MeshSyncSystem — V31
 *
 * Syncs ECS TransformComponent data into Three.js mesh transforms.
 *
 * V31 fix: the hierarchical branch was creating a plain object { x, y, z }
 * every frame per entity (GC allocation in the render hot-path).
 * Replaced with a static pre-allocated THREE.Vector3 scratch buffer.
 */
export class MeshSyncSystem extends System {
    /** @type {string} */
    static phase = 'render';
    static components = [TransformComponent, MeshComponent];

    // ── Static zero-GC scratch buffer ─────────────────────────────────────────
    // Shared across all MeshSyncSystem instances (there should be exactly one).
    static _localScratch = new THREE.Vector3();

    constructor(services) {
        super();
        this.services = services;
        this.registry = Registry.get('registry');
    }

    execute(world, delta, time) {
        const scratch = MeshSyncSystem._localScratch;

        for (const [id, transform, meshComp] of world.each(TransformComponent, MeshComponent)) {
            const mesh = meshComp.mesh;
            if (!mesh) continue;

            if (mesh.parent && mesh.parent.type !== 'Scene' && mesh.parent.name !== 'Universe_Root') {
                // Hierarchical sync: convert world transform to parent-local space
                // V31: reuse static scratch — no object allocation per entity per frame
                scratch.set(transform.position.x, transform.position.y, transform.position.z);
                mesh.parent.worldToLocal(scratch);
                mesh.position.copy(scratch);

                if (transform.rotation && mesh.rotation) {
                    transform.rotation.x = mesh.rotation.x;
                    transform.rotation.y = mesh.rotation.y;
                    transform.rotation.z = mesh.rotation.z;
                }
            } else {
                mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
                if (transform.rotation && mesh.rotation) {
                    mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
                }
            }

            if (transform.scale && mesh.scale) {
                mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
            }
        }
    }
}
