/**
 * InputController.js
 * V10 ULTRA - Unified gesture and interaction handler
 */
export class InputController {
    constructor(eventBus) {
        if (InputController.instance) return InputController.instance;
        this.events = eventBus;
        this.pointer = { x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0 };
        this.isDown = false;
        InputController.instance = this;
    }

    init() {
        console.log('[InputController] Online.');
        window.addEventListener('mousemove', (e) => this.handleMove(e), { passive: true });
        window.addEventListener('mousedown', () => { this.isDown = true; });
        window.addEventListener('mouseup', () => { this.isDown = false; });
        
        window.addEventListener('click', (e) => {
            this.events.emit('input:click', { x: e.clientX, y: e.clientY, event: e });
        });

        window.addEventListener('dblclick', (e) => {
            this.events.emit('input:doubleclick', { x: e.clientX, y: e.clientY, event: e });
        });
    }

    update(delta, time) {
        if (!this.isDown) {
            this.pointer.vx *= 0.95; 
            this.pointer.vy *= 0.95;
        }
    }

    handleMove(e) {
        this.pointer.lastX = this.pointer.x;
        this.pointer.lastY = this.pointer.y;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        
        this.pointer.vx = this.pointer.x - this.pointer.lastX;
        this.pointer.vy = this.pointer.y - this.pointer.lastY;

        this.events.emit('input:move', this.pointer);
    }
}

