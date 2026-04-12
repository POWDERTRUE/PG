import { Registry } from '../core/ServiceRegistry.js';

/**
 * AppEmbedSystem.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
export class AppEmbedSystem {
    static phase = 'workspace';
    constructor(services) {
        this.services = services;
    }

    init() {
        console.log('[AppEmbed] OMEGA App Integration Online.');
        this.registry = Registry.get('registry');
        this.events = Registry.get('events');
        
        this.events.on('workspace:spawn-request', (data) => {
            this.spawnAppWindow(data.url, data.originX, data.originY);
        });
    }

    spawnAppWindow(url, x, y) {
        const id = 'app-' + Date.now();
        const title = this.extractTitle(url);

        const content = `
            <div style="width: 100%; height: 100%; overflow: hidden; background: #000; border-radius: 0 0 12px 12px;">
                <iframe src="${url}" style="width: 100%; height: 100%; border: none;" allow="autoplay; fullscreen"></iframe>
                <div style="position: absolute; top:0; left:0; width: 100%; height: 100%; pointer-events: none; box-shadow: inset 0 0 100px rgba(0,136,255,0.1);"></div>
            </div>
        `;

        const windowManager = this.Registry.get('WindowManager');
        if (windowManager) {
            windowManager.createWindow({
                id: id,
                title: title,
                width: 800,
                height: 500,
                content: content,
                spawnPos: { x, y }
            });
        }
    }

    extractTitle(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '').split('.')[0].toUpperCase();
        } catch (e) {
            return "WEB APP";
        }
    }
}
