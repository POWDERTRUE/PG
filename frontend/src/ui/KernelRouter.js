/**
 * KernelRouter.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import { events } from '../core/EventBus.js';

export class KernelRouter {
    static phase = 'workspace';
    
    init() {
        events.on('kernel:command', (command) => {
            this.route(command);
        });
        console.log('[KernelRouter] OMEGA Command Router Online.');
    }

    route(command) {
        console.log('[KernelRouter] Routing command:', command);
        switch(command) {
            case '/browser':
                events.emit('window:open', { app: 'browser', title: 'Cosmic Browser', url: 'https://bing.com' });
                break;
            case '/gallery':
                events.emit('window:open', { app: 'gallery', title: 'Nebula Gallery' });
                break;
            case '/terminal':
                events.emit('window:open', { app: 'terminal', title: 'Universe Terminal' });
                break;
            case '/system':
                events.emit('window:open', { app: 'settings', title: 'System Settings' });
                break;
            default:
                // Support direct URLs as well
                if (command.startsWith('http') || command.includes('.')) {
                    let formattedUrl = command;
                    if (!command.startsWith('http')) formattedUrl = 'https://' + command;
                    events.emit('window:open', { app: 'browser', url: formattedUrl, title: formattedUrl });
                } else {
                    console.warn('[KernelRouter] Unknown command:', command);
                }
                break;
        }
    }
}

