import * as THREE from "three";
import { Registry } from '../core/ServiceRegistry.js';

export class PawnOrientationSystem {
    static dependencies = ["kernel", "aimRay", "pawnController"];

    constructor(kernel) {
        this.kernel = kernel || Registry.tryGet('kernel') || window.engine;
        this.registry = this.kernel?.registry || Registry;
        this.runtimeState = this.kernel?.runtimeState || Registry.tryGet('RuntimeState');
        
        this.aimRay = null;
        this.pawnController = null;

        this.registryDeps();
    }

    registryDeps() {
        if (!this.registry) return;
        const getSafe = (key) => this.registry?.tryGet ? this.registry.tryGet(key) : this.registry?.get(key);
        this.aimRay = getSafe("aimRay");
        this.pawnController = getSafe("pawnController");

        // Alias para fallbacks viejos
        this.registry.register("pawnOrientation", this);
    }

    update(delta) {
        if ((this.runtimeState?.isLoginActive?.() ?? !!window.__loginActive) || (this.runtimeState?.isGamePaused?.() ?? !!window.__gamePaused)) return;

        if (!this.pawnController) {
            this.pawnController = this.registry?.tryGet ? this.registry.tryGet("pawnController") : this.registry?.get("pawnController");
            if (!this.pawnController) return;
        }

        if (this.pawnController.shouldOrientToAim && !this.pawnController.shouldOrientToAim()) {
            return;
        }

        const pawn = this.pawnController.getPawn();
        if (!pawn) return;
        
        // Lazy-loading dependencies in case they booted late
        if (!this.aimRay && this.registry) {
            this.aimRay = this.registry.tryGet ? this.registry.tryGet("aimRay") : this.registry.get("aimRay");
        }
        if (!this.aimRay) return;

        const aimPoint = this.aimRay.getAimPoint();
        const dir = new THREE.Vector3().subVectors(aimPoint, pawn.position);

        const targetRotation = Math.atan2(dir.x, dir.z);

        // Limit range and calculate shortest path for Rotation interpolations (Evita spins 360 locos)
        let diff = targetRotation - pawn.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const lerpFactor = 1 - Math.exp(-8.0 * (delta || 0.016));
        pawn.rotation.y += diff * lerpFactor;
    }
}
