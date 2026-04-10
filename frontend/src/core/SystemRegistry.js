// frontend/src/core/SystemRegistry.js
export class SystemRegistry {
    constructor() {
        this.systems = [];
    }

    register(system, priority = 0) {
        this.systems.push({ system, priority });
    }

    resolve() {
        this.systems.sort((a, b) => a.priority - b.priority);
        return this.systems.map(item => item.system);
    }
}
