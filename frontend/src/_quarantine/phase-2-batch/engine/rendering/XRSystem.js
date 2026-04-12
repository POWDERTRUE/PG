import { Registry } from '../core/ServiceRegistry.js';
import { events } from '../../core/EventBus.js';

/**
 * XRSystem.js - V16 INDUSTRIAL
 * 
 * Manages WebXR session lifecycle and renderer adaptation.
 */
export class XRSystem {
    constructor() {
        this.session = null;
        this.isSupported = false;
        this.dependencies = ['RenderPipeline', 'CameraSystem'];
    }

    async init() {
        if ('xr' in navigator) {
            this.isSupported = await navigator.xr.isSessionSupported('immersive-vr');
            console.log(`[XRSystem] VR Supported: ${this.isSupported}`);
            if (this.isSupported) {
                this.createEnterButton();
            }
        }
    }

    async enterVR() {
        const renderPipeline = Registry.get('RenderPipeline');
        const renderer = renderPipeline?.getRenderer();
        if (!renderer) return;

        this.session = await navigator.xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
        });

        renderer.xr.enabled = true;
        await renderer.xr.setSession(this.session);
        
        events.emit('xr:session:started', this.session);
        this.session.addEventListener('end', () => this.exitVR());
    }

    exitVR() {
        const renderPipeline = Registry.get('RenderPipeline');
        const renderer = renderPipeline?.getRenderer();
        if (renderer) renderer.xr.enabled = false;
        
        events.emit('xr:session:ended');
        this.session = null;
    }

    createEnterButton() {
        const btn = document.createElement('button');
        btn.id = 'xr-enter-btn';
        btn.innerHTML = 'ENTER VR';
        btn.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:10000; padding:10px 20px; background:#00f2ff; color:black; border:none; border-radius:5px; cursor:pointer; font-weight:bold;';
        btn.onclick = () => this.enterVR();
        document.body.appendChild(btn);
    }
}

export const xrSystem = new XRSystem();

