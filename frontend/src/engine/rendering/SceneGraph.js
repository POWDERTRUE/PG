import { Scene, Group, Color } from 'three';

/**
 * SceneGraph.js
 * Gestor de Nodos OMEGA V30.
 * Organiza la topología del universo en capas estables.
 */
class SceneGraph {
    constructor() {
        this.scene = new Scene();
        this.scene.background = new Color(0x020205); // Espacio profundo puro

        // Capa 1: Fondo Inmutable (Estrellas lejanas, nebulosas de fondo)
        this.backgroundLayer = new Group();
        this.backgroundLayer.name = "BackgroundLayer";
        
        // Capa 2: Universo Dinámico (Sistemas solares, planetas rotatorios)
        this.universeLayer = new Group();
        this.universeLayer.name = "UniverseLayer";

        // Capa 3: UI 3D y Telemetría (Drones, marcadores visuales, anillos de selección)
        this.overlayLayer = new Group();
        this.overlayLayer.name = "OverlayLayer";

        // Ensamblaje maestro
        this.scene.add(this.backgroundLayer);
        this.scene.add(this.universeLayer);
        this.scene.add(this.overlayLayer);

        // Compatibilidad con código anterior (alias layers)
        this.layers = {
            background: this.backgroundLayer,
            galaxy: this.universeLayer,
            systems: this.universeLayer,
            planets: this.universeLayer,
            ui: this.overlayLayer
        };
    }

    addPlanet(mesh) {
        this.universeLayer.add(mesh);
    }

    addStarfield(mesh) {
        this.backgroundLayer.add(mesh);
    }

    get(layerName) {
        return this.layers[layerName] || this.universeLayer;
    }

    clearUniverse() {
        while(this.universeLayer.children.length > 0){ 
            const child = this.universeLayer.children[0];
            this.universeLayer.remove(child); 
        }
    }
}

export default SceneGraph;
