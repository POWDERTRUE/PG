import { Registry } from '../engine/core/ServiceRegistry.js';

/**
 * @file ServiceContainer.js
 * @description Registro centralizado para servicios core (Math, Events, Persistence).
 */
export class ServiceContainer {
    constructor() {
        if (typeof window !== 'undefined' && window.__OMEGA_SERVICES__) {
            return window.__OMEGA_SERVICES__;
        }

        /** @private @type {Map<string, any>} */
        this._services = new Map();

        if (typeof window !== 'undefined') {
            window.__OMEGA_SERVICES__ = this;
        }
    }

    /**
     * Registra un servicio en el contenedor.
     * @param {string} key - Identificador único.
     * @param {any} instance - Instancia del servicio.
     */
    register(key, instance) {
        if (this._services.has(key)) {
            console.warn(`[ServiceContainer] Sobrescribiendo servicio: ${key}`);
        }
        this._services.set(key, instance);
        console.debug(`[ServiceContainer] Servicio registrado: ${key}`);
    }

    /**
     * Obtiene un servicio. Lanza error si no existe (Fail-fast).
     * @param {string} key 
     */
    get(key) {
        const service = this._services.get(key);
        if (!service) {
            console.error(`[ServiceContainer] ERROR: Servicio crítico no encontrado: ${key}`);
            console.log('[ServiceContainer] Inventario actual:', Array.from(this._services.keys()));
            throw new Error(`[ServiceContainer] Servicio crítico no encontrado: ${key}`);
        }
        return service;
    }

    /**
     * Verifica si un servicio existe.
     * @param {string} key 
     */
    has(key) {
        return this._services.has(key);
    }
}

