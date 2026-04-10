import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';

export class SpatialOptimizationPass {
    constructor(spatialGrid, cullingDistance = 5000) {
        this.priority = 10;
        this.enabled = true;
        this.spatialGrid = spatialGrid;
        this.cullingDistance = cullingDistance;
        this.lodThreshold = 1500;
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
    }
    
    execute(renderer, scene, camera, deltaTime) {
        this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        const entityManager = Registry.tryGet('EntityManager');
        if (!entityManager) return;

        // O(1) Data-Oriented Query: Devuelve un array/set de enteros.
        // Asume que spatialGrid es el nuevo `core/spatial/SpatialIndexSystem.js`
        const visibleEntityIds = this.spatialGrid.queryFrustum(this.frustum);

        // Ocultar TODO
        entityManager.hideAll();

        // Encender solo lo visible por índice O(1)
        for (let i = 0; i < visibleEntityIds.length; i++) {
            const eId = visibleEntityIds[i];
            const obj = entityManager.getMeshByEntityId(eId);
            
            if (!obj) continue;
            
            const dist = camera.position.distanceTo(obj.position);
            if (dist > this.cullingDistance) {
                obj.visible = false;
                continue;
            }
            
            obj.visible = true;

            if (obj.userData && obj.userData.hasLOD) {
                if (dist > this.lodThreshold && obj.userData.currentLOD !== 'LOW') {
                    obj.userData.currentLOD = 'LOW';
                } else if (dist <= this.lodThreshold && obj.userData.currentLOD !== 'HIGH') {
                    obj.userData.currentLOD = 'HIGH';
                }
            }
        }
    }
}
