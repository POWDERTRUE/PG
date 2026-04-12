/**
 * AppLauncher.js — OMEGA V-DIAMOND
 * The bridge between spatial interactions and OS window spawning.
 */

export class AppLauncher {
    constructor(kernel) {
        // 1. Core References
        this.kernel = kernel;
        this.registry = kernel.registry;
        
        // 2. Dependency Placeholders (Strictly populated in init)
        this.events = null;
        this.appSystem = null;
        this.windowManager = null;
        
        // 4. Internal State
        this.isActive = false;

        // 5. Bound handlers (Required for memory-safe disposal)
        this._handleLaunch = this._handleLaunch.bind(this);
    }

    /**
     * Executes once during Kernel Boot Phase.
     * ONLY fetch dependencies here. Do NOT execute loop logic.
     */
    init() {
        // Inyección estricta desde el Registro Central
        this.events = this.registry.get('events');
        this.appSystem = this.registry.get('PlanetAppSystem');
        this.windowManager = this.registry.get('WindowManager');
        
        // Protocolo "Fail Fast" (Ley de Manejo de Errores)
        if (!this.events || !this.appSystem || !this.windowManager) {
            throw new Error(`[${this.constructor.name}] Critical Dependency Missing in Registry.`);
        }

        // Suscripción al bus de eventos del Kernel
        this.events.on('celestial:clicked', this._handleLaunch);

        this.isActive = true;
        console.log(`[${this.constructor.name}] Online and Registered. Listening for celestial triggers.`);
    }

    /**
     * Internal event handler for planetary interactions.
     */
    _handleLaunch(payload) {
        if (!this.isActive) return;

        const { bodyId } = payload;
        const appConfig = this.appSystem.getAppForBody(bodyId);
        
        if (appConfig) {
            console.log(`[${this.constructor.name}] Spawning interactive node: ${appConfig.name}`);
            this.windowManager.open(appConfig.type, {
                title: appConfig.name,
                source: bodyId
            });
        }
    }

    /**
     * Executes every frame based on FrameScheduler phase.
     * @param {number} deltaTime - Time elapsed since last frame.
     */
    update(deltaTime) {
        if (!this.isActive) return;
        // El AppLauncher es manejado por eventos, no requiere lógica por frame en este momento.
    }

    /**
     * Absolute destruction. Required for memory safety when unloading systems.
     */
    dispose() {
        this.isActive = false;
        
        // Desconexión estricta de eventos para prevenir Memory Leaks
        if (this.events) {
            this.events.off('celestial:clicked', this._handleLaunch);
        }
        
        // Liberación de referencias
        this.events = null;
        this.appSystem = null;
        this.windowManager = null;
        
        console.log(`[${this.constructor.name}] Terminated and memory released.`);
    }
}