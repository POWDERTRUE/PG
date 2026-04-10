export class CoreRenderPass {
    constructor() {
        this.priority = 100;
        this.enabled = true;
    }
    execute(renderer, scene, camera, deltaTime) {
        renderer.render(scene, camera);
    }
}
