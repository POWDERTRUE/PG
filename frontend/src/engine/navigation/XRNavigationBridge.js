import { Registry } from '../core/ServiceRegistry.js';
import { events } from '../../core/EventBus.js';

/**
 * XRNavigationBridge.js - V16 INDUSTRIAL
 * 
 * Translates XR Controller inputs into Engine Navigation commands.
 */
export class XRNavigationBridge {
    constructor() {
        this.dependencies = ['XRSystem', 'UniverseNavigationSystem'];
    }

    init() {
        console.log('[XRNavigationBridge] Input translation active.');
        events.on('xr:input:joystick', (data) => this.handleJoystick(data));
        events.on('xr:input:trigger', (data) => this.handleTrigger(data));
    }

    handleJoystick(data) {
        const nav = Registry.get('UniverseNavigationSystem');
        if (!nav) return;

        // data.axes[0] = Horizontal, data.axes[1] = Vertical
        if (data.hand === 'left') {
            // Mapping left joystick to Physical Flight Translation
            nav.velocity.set(data.axes[0] * 50, 0, data.axes[1] * 50);
        } else {
            // Mapping right joystick to Snap/Smooth Turn
            this.handleRotation(data.axes[0]);
        }
    }

    handleTrigger(data) {
        const nav = Registry.get('UniverseNavigationSystem');
        if (data.pressed && data.hand === 'right') {
            // Trigger Warp on right hand click
            nav.initiateWarp();
        }
    }

    handleRotation(amount) {
        const cameraSystem = Registry.get('CameraSystem');
        // logic for smooth or snap turn
    }
}

export const xrNavigationBridge = new XRNavigationBridge();

