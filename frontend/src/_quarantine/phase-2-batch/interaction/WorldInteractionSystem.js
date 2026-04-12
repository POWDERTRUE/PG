// frontend/src/interaction/WorldInteractionSystem.js
import * as THREE from 'three';

export class WorldInteractionSystem {
    constructor(camera, sceneGraph, navigationSystem) {
        this.camera           = camera;
        this.sceneGraph       = sceneGraph;
        this.navigationSystem = navigationSystem;
        this.raycaster        = new THREE.Raycaster();
        this.mouse            = new THREE.Vector2();
        this.onClick          = this.onClick.bind(this);
    }

    enable()  { window.addEventListener('click',    this.onClick, false); }
    disable() { window.removeEventListener('click', this.onClick, false); }

    onClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth)  *  2 - 1;
        this.mouse.y = (event.clientY / window.innerHeight) * -2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Raycast only against planets layer
        const hits = this.raycaster.intersectObjects(
            this.sceneGraph.layers.planets.children,
            true
        );

        if (hits.length > 0) {
            const hit = hits.find(h => h.object.userData?.isApp);
            if (hit) this.navigationSystem.focusPlanet(hit.object);
        }
    }
}
