/**
 * [OMEGA V30] ServiceRegistry
 * Patrón: Service Locator / Singleton
 * Propósito: Almacenamiento centralizado y seguro de todos los subsistemas del motor.
 */
export class ServiceRegistry {
    constructor() {
        // Usamos un Map estricto. Esto elimina por completo el error de variables duplicadas.
        this._services = new Map();
        this._waiters = new Map();
    }

    /**
     * Registra un nuevo sistema en el motor.
     * @param {string} name - Nombre único del servicio (ej. 'physics', 'navigation')
     * @param {Object} serviceInstance - La instancia de la clase
     */
    register(name, serviceInstance) {
        if (this._isFrozen) {
            console.error(`[ServiceRegistry] PROTECCIÓN DE KERNEL: Intento de inyectar '${name}' después del Registry Freeze. Bloqueado.`);
            return;
        }
        if (this._services.has(name)) {
            console.warn(`[ServiceRegistry] Alerta Espacial: El servicio '${name}' ya está registrado. Sobrescribiendo...`);
        }
        this._services.set(name, serviceInstance);
        console.log(`[ServiceRegistry] Sistema anclado exitosamente: ${name}`);

        if (this._waiters.has(name)) {
            this._waiters.get(name).forEach(resolve => resolve(serviceInstance));
            this._waiters.delete(name);
        }
    }

    freeze() {
        this._isFrozen = true;
        console.log('%c[ServiceRegistry] KERNEL INMUTABLE: Registry congelado. No se permiten nuevas inyecciones de sistemas.', 'color:#ff0055; font-weight:bold');
        Object.freeze(this._services);
        Object.freeze(this);
    }

    waitFor(name) {
        if (this._services.has(name)) {
            return Promise.resolve(this._services.get(name));
        }
        return new Promise(resolve => {
            if (!this._waiters.has(name)) {
                this._waiters.set(name, []);
            }
            this._waiters.get(name).push(resolve);
        });
    }

    /**
     * Extrae un sistema para usarlo en otra parte del código.
     * @param {string} name - Nombre del servicio a buscar
     * @returns {Object} La instancia del servicio
     */
    get(name) {
        if (!this._services.has(name)) {
            throw new Error(`[ServiceRegistry] Falla Crítica: El subsistema '${name}' no existe en el registro.`);
        }
        return this._services.get(name);
    }

    /**
     * Soft lookup — returns null (never throws) when the service isn't registered yet.
     * Use this inside systems that can tolerate a missing dep during early boot.
     * @param {string} name
     * @returns {Object|null}
     */
    tryGet(name) {
        return this._services.get(name) ?? null;
    }

    /**
     * Limpia todos los servicios registrados.
     */
    clear() {
        this._services.clear();
        console.log('[ServiceRegistry] Todos los sistemas han sido liberados.');
    }

    /**
     * Inicializa todos los servicios que tengan un método init()
     */
    bootAll() {
        this._services.forEach((service, name) => {
            if (typeof service.init === 'function') {
                service.init();
                console.log(`[ServiceRegistry] Secuencia de inicio completada para: ${name}`);
            }
        });
    }
}

// Exportamos una única instancia inmutable para todo el proyecto (Patrón Singleton)
export const Registry = new ServiceRegistry();

// ── Protocolo Anti-Zombi (HMR Vite) ──────────────────────────────────────────
// ServiceRegistry es un Singleton con estado congelado (Registry.freeze()).
// Un hot-patch parcial de Vite crearía un estado zombi donde el Kernel
// mantiene referencias al módulo antiguo pero el grafo de dependencias
// apunta al nuevo — colapsando Registry.get() silenciosamente.
// decline() fuerza full-page reload al detectar un cambio en este archivo.
if (import.meta.hot) {
    import.meta.hot.decline();
}

