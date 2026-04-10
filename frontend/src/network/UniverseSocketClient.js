import { Registry } from '../engine/core/ServiceRegistry.js';

export class UniverseSocketClient {
    constructor(url = 'ws://localhost:5556') {
        this.url = url;
        this.retry = 0;
        this.maxRetryDelay = 10000;
        this.ws = null;
        this.events = Registry.get('events');
        this.clientId = `cmd-${Math.random().toString(36).slice(2, 9)}`;
        this.messageListeners = new Set();
        this.reconnectTimer = null;
        this.disposed = false;
        this.connect();
    }

    connect() {
        if (this.disposed) return;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('[UniverseSocketClient] Connected to Universe Socket');
            this.retry = 0;
            this.events?.emit('network:socket:open', { clientId: this.clientId });
        };

        this.ws.onmessage = (msg) => {
            let data = null;
            try {
                data = JSON.parse(msg.data);
            } catch (error) {
                console.warn('[UniverseSocketClient] Parse error on message', error);
                return;
            }

            this.events?.emit('network:socket:message', data);

            if (data.type === 'OPEN_APP') {
                this.events?.emit('os:open_app', data.payload);
            }
            if (data.type === 'NETWORK_TRANSFORM_UPDATE') {
                this.events?.emit('network:remote_transform', data);
            }

            this.messageListeners.forEach((listener) => {
                try {
                    listener(data);
                } catch (error) {
                    console.error('[UniverseSocketClient] Message listener failed', error);
                }
            });
        };

        this.ws.onerror = () => {
            // onclose handles reconnect policy
        };

        this.ws.onclose = () => {
            this.events?.emit('network:socket:close', { clientId: this.clientId });
            this.scheduleReconnect();
        };
    }

    scheduleReconnect() {
        if (this.disposed) return;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        const delay = Math.min(1000 * Math.pow(2, this.retry), this.maxRetryDelay);
        console.warn(`[UniverseSocketClient] Orbit lost. Reconnecting in ${delay}ms...`);

        this.reconnectTimer = setTimeout(() => {
            if (this.disposed) return;
            this.retry += 1;
            this.connect();
        }, delay);
    }

    addMessageListener(listener) {
        this.messageListeners.add(listener);
        return () => this.removeMessageListener(listener);
    }

    removeMessageListener(listener) {
        this.messageListeners.delete(listener);
    }

    send(payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (typeof payload === 'string') {
            this.ws.send(payload);
            return;
        }

        const envelope = {
            ...payload,
            clientId: payload?.clientId || this.clientId,
        };
        this.ws.send(JSON.stringify(envelope));
    }

    destroy() {
        this.disposed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.messageListeners.clear();
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
        }
    }
}
