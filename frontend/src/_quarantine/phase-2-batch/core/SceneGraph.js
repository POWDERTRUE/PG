// frontend/src/core/SceneGraph.js
import * as THREE from 'three';

export class SceneGraph {
    constructor() {
        this.scene = new THREE.Scene();
        this.layers = {
            background: new THREE.Group(),
            galaxy:     new THREE.Group(),
            planets:    new THREE.Group(),
            ui:         new THREE.Group()
        };

        this.layers.background.name = 'layer_background';
        this.layers.galaxy.name     = 'layer_galaxy';
        this.layers.planets.name    = 'layer_planets';
        this.layers.ui.name         = 'layer_ui';

        this.scene.add(this.layers.background);
        this.scene.add(this.layers.galaxy);
        this.scene.add(this.layers.planets);
        this.scene.add(this.layers.ui);
    }
}
