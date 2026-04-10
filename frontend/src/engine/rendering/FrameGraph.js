export class FrameGraph {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.passes = [];
    }
    addPass(pass) {
        this.passes.push(pass);
        this.passes.sort((a, b) => a.priority - b.priority); 
    }
    getPass(type) {
        return this.passes.find(p => p instanceof type);
    }
    execute(deltaTime) {
        for (let i = 0; i < this.passes.length; i++) {
            if (this.passes[i].enabled) {
                this.passes[i].execute(this.renderer, this.scene, this.camera, deltaTime);
            }
        }
    }
}
