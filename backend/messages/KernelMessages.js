const UniverseEvents = require('../protocol/UniverseEvents');

/**
 * Spatial OS Messaging Handler
 * ============================
 * Dispatches raw incoming websocket kernels into
 * specific logic handlers based on UniverseEvents.
 */

class KernelMessages {
    static handle(ws, messageRaw, broadcastFunc, wss, meta = {}) {
        try {
            const data = JSON.parse(messageRaw);
            console.log(`[OS-Kernel] Executing Message: ${data.type}`);

            switch (data.type) {
                case UniverseEvents.PLANET_CLICKED:
                    this._routeAppLaunch(ws, data.payload);
                    break;
                case UniverseEvents.USER_WARPED:
                    // Broadcast user position to other clients
                    if (broadcastFunc) broadcastFunc(wss, ws, messageRaw, meta);
                    break;
                default:
                    // Generic state replication
                    if (broadcastFunc) broadcastFunc(wss, ws, messageRaw, meta);
                    break;
            }
        } catch (error) {
            console.error("[OS-Kernel] Message validation error:", error.message);
        }
    }

    static _routeAppLaunch(ws, payload) {
        const { planetId } = payload;
        console.log(`[OS-Kernel] Translating spatial action: ${planetId} -> App`);
        
        // Dictionary map between celestial names and local OS applications
        const appMap = {
            'terminal': 'terminal',
            'browser': 'browser',
            'settings': 'settings',
            'explorer': 'explorer'
        };

        const targetApp = appMap[planetId] || planetId;

        ws.send(UniverseEvents.createMessage('OPEN_APP', { app: targetApp }));
    }
}

module.exports = KernelMessages;
