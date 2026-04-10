/**
 * InteractionModeController - OMEGA V-DIAMOND
 * Escucha la se\u00f1al de HUD Mode y orquesta sistemas perif\u00e9ricos 
 * (TargetTracker, OrbitalMechanics) para garantizar Friction-Zero escapes.
 */
export class InteractionModeController {
    constructor({ runtimeSignals, targetTrackingSystem, orbitalMechanics }) {
        this.runtimeSignals = runtimeSignals;
        this.targetTrackingSystem = targetTrackingSystem;
        this.orbitalMechanics = orbitalMechanics;
        
        this._onHudModeChange = this._onHudModeChange.bind(this);
    }

    init() {
        if (this.runtimeSignals) {
            this.runtimeSignals.on('PG:HUD_MODE', this._onHudModeChange);
        }
        console.log('[InteractionModeController] Intelligent Escape Orbiter online.');
    }

    _onHudModeChange(payload) {
        const isHudActive = payload.active;

        if (isHudActive) {
            this.enterHUDMode();
        } else {
            this.enterFlightMode();
        }
    }

    enterHUDMode() {
        // Pausar TargetTracker para evitar jitter en modo HUD
        if (this.targetTrackingSystem && typeof this.targetTrackingSystem.pauseTracking === 'function') {
            this.targetTrackingSystem.pauseTracking();
        }

        // Si es necesario, podemos congelar rotaciones planetarias
        if (this.orbitalMechanics && typeof this.orbitalMechanics.freezeRotation === 'function') {
            this.orbitalMechanics.freezeRotation(true);
        }
    }

    enterFlightMode() {
        // Reanudar TargetTracker
        if (this.targetTrackingSystem && typeof this.targetTrackingSystem.resumeTracking === 'function') {
            this.targetTrackingSystem.resumeTracking();
        }

        // Reanudar rotaciones planetarias
        if (this.orbitalMechanics && typeof this.orbitalMechanics.freezeRotation === 'function') {
            this.orbitalMechanics.freezeRotation(false);
        }
    }
}
