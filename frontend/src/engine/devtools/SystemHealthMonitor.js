import { Registry } from '../core/ServiceRegistry.js';

export class SystemHealthMonitor {
    constructor() {
        this.registry = Registry;
    }

    report() {
        const titleStyle = 'color: #00ffcc; font-size: 14px; font-weight: bold; background: #222; padding: 4px;';
        console.log('%c[SystemHealthMonitor] Diagnostic Report:', titleStyle);
        
        // Asumiendo que Registry utiliza un objeto interno de servicios (por defecto ServiceLocator js).
        const services = this.registry.services || this.registry._services || this.registry;
        
        if (services instanceof Map) {
            services.forEach((system, name) => {
                console.log(`%c■ ${name}`, 'color: #aaa;', system);
            });
        } else {
            Object.keys(services).forEach(name => {
                if (name !== 'services' && name !== '_services' && typeof services[name] === 'object') {
                    console.log(`%c■ ${name}`, 'color: #aaa;', services[name]);
                }
            });
        }
        console.log('%c----------------------------------------', 'color: #555;');
    }
}
