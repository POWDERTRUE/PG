const WebSocket = require('ws');
const { WS_PORT } = require('./config/ports');
const KernelMessages = require('./messages/KernelMessages');

/**
 * websocketServer.js
 * Cluster-aware WebSocket service.
 */
function startWebSocketServer() {
    return new Promise((resolve, reject) => {
        try {
            const wss = new WebSocket.Server({ port: WS_PORT }, () => {
                console.log(`[WS] Server running on port ${WS_PORT}`);
                resolve(wss);
            });

            wss.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    reject(new Error(`WS Port ${WS_PORT} is already in use by another process.`));
                } else {
                    reject(err);
                }
            });

            process.on('message', (packet) => {
                if (!packet || packet.type !== 'WS_CLUSTER_BROADCAST') return;
                const rawMessage = packet.payload?.message;
                if (!rawMessage) return;

                const senderClientId = packet.payload?.senderClientId || null;
                broadcastClusterMessage(wss, rawMessage, senderClientId);
            });

            wss.on('connection', (ws) => {
                ws.__clientId = null;
                console.log('[WS] Client connected to Universe Socket');

                ws.on('message', (messageRaw) => {
                    const senderClientId = extractClientId(messageRaw);
                    if (senderClientId) {
                        ws.__clientId = senderClientId;
                    }

                    KernelMessages.handle(
                        ws,
                        messageRaw,
                        broadcastLocalAndCluster,
                        wss,
                        { senderClientId: ws.__clientId || senderClientId || null }
                    );
                });

                ws.on('close', () => {
                    console.log('[WS] Client disconnected from Universe Socket');
                });

                ws.on('error', (err) => {
                    console.error('[WS] Connection Error:', err);
                });
            });
        } catch (error) {
            reject(error);
        }
    });
}

function extractClientId(rawMessage) {
    try {
        const parsed = JSON.parse(rawMessage);
        return parsed?.clientId || null;
    } catch {
        return null;
    }
}

function sendToLocalClients(wss, senderSocket, rawMessage, senderClientId = null) {
    wss.clients.forEach((client) => {
        if (client.readyState !== WebSocket.OPEN) return;
        if (senderSocket && client === senderSocket) return;
        if (senderClientId && client.__clientId && client.__clientId === senderClientId) return;
        client.send(rawMessage.toString());
    });
}

function broadcastLocalAndCluster(wss, senderSocket, rawMessage, meta = {}) {
    const senderClientId = meta?.senderClientId || null;
    sendToLocalClients(wss, senderSocket, rawMessage, senderClientId);

    if (typeof process.send === 'function') {
        process.send({
            type: 'WS_BROADCAST',
            payload: {
                message: rawMessage.toString(),
                senderClientId,
            },
        });
    }
}

function broadcastClusterMessage(wss, rawMessage, senderClientId = null) {
    sendToLocalClients(wss, null, rawMessage, senderClientId);
}

module.exports = startWebSocketServer;
