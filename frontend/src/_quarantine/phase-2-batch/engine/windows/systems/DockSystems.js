import { Registry } from '../../core/ServiceRegistry.js';

/**
 * DockSystems.js
 * OMEGA V28 Master Edition — Workspace & UI
 */

export class SolarDockSystem {
    static phase = 'workspace';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
    }

    update(delta, time) {
        const celestialRegistry = Registry.get('CelestialRegistry');
        const winManager = Registry.get('WindowManager');
        if (!celestialRegistry || !winManager) return;

        const megaSun = celestialRegistry.get('UniversalMegaSun');
        if (!megaSun) return;

        // Sync windows flagged with 'solar-dock'
        const windows = winManager.getWindowsByTag('solar-dock');
        windows.forEach(win => {
            const worldPos = megaSun.getWorldPosition(new THREE.Vector3());
            const screenPos = worldPos.project(Registry.get('camera'));
            
            // Simplified screen-space anchoring for OMEGA V15
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
            
            win.updateDockPosition(x, y);
        });
    }
}

export class PlanetDockSystem {
    /** @type {string} */
    static phase = 'workspace';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
    }

    update(delta, time) {
    }
}

export class MoonDockSystem {
    /** @type {string} */
    static phase = 'post';

    constructor(services) {
        this.services = services;
        this.registry = Registry.get('registry');
    }

    update(delta, time) {
    }
}

/**
 * Unified DockSystems orchestrator for OMEGA V15.
 */
export class DockSystems {
    constructor(services) {
        this.services = services;
        this.solar = new SolarDockSystem(services);
        this.planet = new PlanetDockSystem(services);
        this.moon = new MoonDockSystem(services);
    }

    init() {
        console.log('[DockSystems] OMEGA Celestial Docking Online.');
    }

    update(delta, time) {
        this.solar.update(delta, time);
        this.planet.update(delta, time);
        this.moon.update(delta, time);
    }
}
