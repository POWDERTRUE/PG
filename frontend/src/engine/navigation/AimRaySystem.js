import * as THREE from "three";
import { gsap } from "gsap";

export class AimRaySystem {
    static dependencies = ["kernel", "camera", "SceneGraph"];

    constructor(kernel) {
        this.kernel = kernel || window.engine;
        this._skipSelfRegister = !!kernel;
        this.registry = window.Registry || (this.kernel ? this.kernel.registry : null);
        
        this.camera = null;
        this.scene = null;
        this.mouse = new THREE.Vector2(0, 0);
        this.reticle = null;
        this.isVisible = false;

        this.registryDeps();

        window.addEventListener("mousemove", (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Retrasamos la instanciación de gráficos en caso the SceneGraph no haya booteado
        setTimeout(() => this._initReticle(), 100);
    }

    registryDeps() {
        if (!this.registry) return;
        this.camera = this.registry.tryGet ? this.registry.tryGet("camera") : this.registry.get("camera");
        this.scene = this.registry.tryGet ? this.registry.tryGet("SceneGraph")?.scene : this.registry.get("SceneGraph")?.scene;
        // Map alias to global Registry just in case
        if (window.Registry && !window.Registry.tryGet?.("aimRay") && !this._skipSelfRegister) {
            window.Registry.register("aimRay", this);
        }
    }

    _initReticle() {
        if (!this.scene) {
            this.scene = this.registry?.get("SceneGraph")?.scene;
            if (!this.scene) return;
        }

        // Holographic Tactical AIM Reticle
        const geo = new THREE.RingGeometry(2.5, 3.8, 32);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffcc, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false
        });
        this.reticle = new THREE.Mesh(geo, mat);

        const dotGeo = new THREE.CircleGeometry(0.5, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        this.reticle.add(dot);

        this.reticle.renderOrder = 9999;
        this.reticle.visible = false;
        this.scene.add(this.reticle);
    }

    showReticle(state) {
        this.isVisible = state;
        if (this.reticle) {
            this.reticle.visible = state;
            if (state) {
                gsap.killTweensOf(this.reticle.scale);
                gsap.fromTo(this.reticle.scale, 
                    { x: 3, y: 3, z: 3 }, 
                    { x: 1, y: 1, z: 1, duration: 0.4, ease: "back.out(1.5)" }
                );
            }
        }
    }

    getAimPoint(distance = 15000) {
        if (!this.camera) return new THREE.Vector3();

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);
        const direction = raycaster.ray.direction.clone();
        
        const aimPt = raycaster.ray.origin.clone().add(direction.clone().multiplyScalar(distance));
        
        if (this.reticle && this.isVisible) {
            // Posicionar reticle flotante visualmente más cerca (para perspectiva)
            const reticleDistance = Math.min(distance, 500); 
            const reticlePt = raycaster.ray.origin.clone().add(direction.clone().multiplyScalar(reticleDistance));
            this.reticle.position.copy(reticlePt);
            this.reticle.lookAt(this.camera.position); // Sprite/Bilboard math
        }

        return aimPt;
    }

    update(delta) {
        if (this.isVisible) {
            this.getAimPoint();
            if (this.reticle) {
                // Rotación cosmética del anillo de la mira
                this.reticle.rotation.z -= (delta || 0.016) * 3.5;
            }
        }
    }
}
