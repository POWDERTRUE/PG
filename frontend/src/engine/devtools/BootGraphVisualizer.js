export class BootGraphVisualizer {
    constructor(registry) {
        this.registry = registry;
    }

    renderGraph() {
        const graph = {};
        
        console.log("=========================================");
        console.log("🌌 POWDER GALAXY - SYSTEM GRAPH RUNTIME 🌌");
        console.log("=========================================");

        if (this.registry && this.registry._services) {
            this.registry._services.forEach((service, name) => {
                graph[name] = service.constructor?.dependencies || [];
            });
            console.table(graph);
        } else {
            console.warn("[BootGraphVisualizer] No valid service registry found to analyze!");
        }

        return graph;
    }
}
