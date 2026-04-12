export class InteractionModeController {
    constructor({ kernel, inputPriorityStack, navigationSystem, targetTrackingSystem }) {
        this.kernel = kernel;
        this.stack = inputPriorityStack;
        this.navigationSystem = navigationSystem;
        this.targetTrackingSystem = targetTrackingSystem;
        this.runtimeSignals = kernel?.runtimeSignals || window.Registry?.get('runtimeSignals');

        this.registerListeners();
    }

    registerListeners() {
        if (this.runtimeSignals) {
            this.runtimeSignals.on('PG:HUD_MODE', (payload) => {
                const active = payload.active !== undefined ? payload.active : payload;
                if (active) {
                    this.enterHUD();
                } else {
                    this.exitHUD();
                }
            });
        }
    }

    enterHUD() {
        if (this.stack.current() === "HUD") return;
        
        // InputStateSystem.js natively hands document.exitPointerLock(), 
        // PG:NAV:ENGAGE_AUTO_BRAKE (cinematic damping), and body.pg-hud-mode (CSS pointer-events).
        // Therefore, we only need to pause tracking and update the InputPriorityStack.
        
        if (this.targetTrackingSystem && typeof this.targetTrackingSystem.pauseTracking === 'function') {
            this.targetTrackingSystem.pauseTracking();
        }

        this.stack.push("HUD");
    }

    exitHUD() {
        if (this.stack.current() !== "HUD") return;

        // InputStateSystem.js naturally commands the requestPointerLock(), 
        // PG:NAV:DISENGAGE_AUTO_BRAKE, and body class removal.

        if (this.targetTrackingSystem && typeof this.targetTrackingSystem.resumeTracking === 'function') {
            this.targetTrackingSystem.resumeTracking();
        }

        this.stack.pop();
    }
}
