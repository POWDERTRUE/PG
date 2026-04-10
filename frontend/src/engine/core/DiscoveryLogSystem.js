import { Registry } from './ServiceRegistry.js';

/**
 * DiscoveryLogSystem.js
 * OMEGA V28 Master Edition — Sensory & HUD
 */
export class DiscoveryLogSystem {
    static phase = 'sensory';
    constructor(services) {
        this.services = services;
        this.events = Registry.get('events');
        this.storageKey = 'powder_galaxy_discovered';
        this.discovered = new Map();
    }

    init() {
        this.load();
        this.events.on('planet:discovered', (data) => this.log(data));
        console.log('[DiscoveryLog] OMEGA Survey Database Online.');
    }

    log(data) {
        if (this.discovered.has(data.id)) return;
        
        this.discovered.set(data.id, data);
        this.save();
        console.log(`[DiscoveryLogSystem] Logged: ${data.name}`);
    }

    save() {
        const payload = JSON.stringify(Array.from(this.discovered.entries()));
        localStorage.setItem(this.storageKey, payload);
    }

    load() {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
            try {
                const entries = JSON.parse(raw);
                this.discovered = new Map(entries);
                
                // On load, notify UI systems to redraw existing labels if planets are active
                setTimeout(() => {
                    this.discovered.forEach(data => {
                        this.events.emit('planet:discovered:silent', data);
                    });
                }, 1000); // Wait for LOD system to settle
            } catch (err) {
                console.error('[DiscoveryLogSystem] Load failed:', err);
            }
        }
    }

    getDiscoveries() {
        return Array.from(this.discovered.values());
    }
}
