/**
 * KernelButtonSystem.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import { events } from '../core/EventBus.js';

export class KernelButtonSystem {
    static phase = 'workspace';
    init() {
        const input = document.querySelector('#kernel-input');
        if (!input) {
            console.warn('[KernelButtonSystem] #kernel-input not found in DOM.');
            return;
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = input.value.trim();
                console.log('[KernelButtonSystem] Command emitted:', command);
                events.emit('kernel:command', command);
                input.value = ''; // Clear input after command
            }
        });

        console.log('[KernelButton] OMEGA Command Interface Online.');
    }
}

