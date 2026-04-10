import { Registry } from './ServiceRegistry.js';
import { events } from '../../core/EventBus.js';

export class UniverseIntelligence {
    constructor() {
        this.registry = Registry;
        this.events = events;
        this.constellationNames = [
            'Andromeda Cluster', 'Orion Nebula', 'Cygnus Void', 
            'Centauri Sector', 'Pegasus Array', 'Lyra Group'
        ];
    }

    init() {
        console.log('[UniverseIntelligence] Analytical Core Online.');
        
        events.on('window:pinned', (data) => this.analyzeLocalStructure(data));
        events.on('window:group:joined', (data) => this.generateConstellationName(data));
    }

    analyzeLocalStructure(data) {
        const winManager = Registry.get('WindowManager');
        const hierarchy = Registry.get('SpaceHierarchySystem');
        if (!winManager || !hierarchy) return;

        // Check if many windows are near a specific point
        // (Simplified logic for now)
        console.log(`[UniverseIntelligence] Analyzing spatial patterns around: ${data.id}`);
    }

    generateConstellationName(groupId) {
        const name = this.constellationNames[Math.floor(Math.random() * this.constellationNames.length)];
        console.log(`[UniverseIntelligence] Cluster ${groupId} identified as part of the "${name}".`);
        events.emit('intelligence:constellation:named', { groupId, name });
        return name;
    }
}

export const universeIntelligence = new UniverseIntelligence();

