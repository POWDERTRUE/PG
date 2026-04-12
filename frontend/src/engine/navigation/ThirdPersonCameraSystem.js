import * as THREE from "three";
import { Registry } from '../core/ServiceRegistry.js';

export class ThirdPersonCameraSystem {
    static dependencies = ["kernel", "camera", "pawnController"];

    constructor(kernel) {
        this.kernel = kernel || Registry.tryGet('kernel') || window.engine;
        this.registry = this.kernel?.registry || Registry;
        this.runtimeState = this.kernel?.runtimeState || Registry.tryGet('RuntimeState');
        
        this.camera = null;
        this.pawnController = null;

        // Vector default solicitado: 0, 50, 150
        this.offset = new THREE.Vector3(0, 50, 150);
        this._dynamicOffset = new THREE.Vector3();
        this._desired = new THREE.Vector3();

        this.registryDeps();
    }

    registryDeps() {
        if (!this.registry) return;
        this.camera = this.registry.get("camera");
        this.pawnController = this.registry.tryGet?.("pawnController") || this.registry.get("pawnController");
        this.registry.register("thirdPersonCamera", this);
    }

    update(delta) {
        if ((this.runtimeState?.isLoginActive?.() ?? !!window.__loginActive) || (this.runtimeState?.isGamePaused?.() ?? !!window.__gamePaused)) return;

        if (!this.pawnController) {
            this.pawnController = this.registry?.tryGet?.("pawnController") || this.registry?.get("pawnController");
            if (!this.pawnController) return;
        }

        if (this.pawnController.shouldDriveCamera && !this.pawnController.shouldDriveCamera()) {
            return;
        }

        const pawn = this.pawnController.getPawn();
        if (!pawn) return;

        if (!this.camera && this.registry) {
            this.camera = this.registry?.get("camera");
            if (!this.camera) return;
        }

        // Si la masa es masiva, multiplicamos el offset para que la cámara no se hunda en la geometría!
        let scaleBoost = 1.0;
        if (pawn.geometry && pawn.geometry.boundingSphere) {
            const rad = pawn.geometry.boundingSphere.radius;
            const absoluteScale = Math.max(pawn.scale.x, pawn.scale.y, pawn.scale.z);
            scaleBoost = Math.max(1.0, (rad * absoluteScale) / 30); // Ecuación elástica para retención de distancia visual
        }

        const dynamicOffset = this._dynamicOffset.copy(this.offset).multiplyScalar(scaleBoost);

        const desired = this._desired.copy(pawn.position).add(dynamicOffset.applyQuaternion(pawn.quaternion));

        const lerpFactor = 1 - Math.exp(-9.0 * (delta || 0.016)); // Frame-Independent Lerp
        this.camera.position.lerp(desired, lerpFactor);

        this.camera.lookAt(pawn.position);
    }
}
