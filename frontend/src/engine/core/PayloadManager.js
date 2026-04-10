import { Registry } from './ServiceRegistry.js';

const SET_ACTIVE_PAYLOAD_SIGNAL = 'PG:OS:SET_ACTIVE_PAYLOAD';
const ACTIVE_PAYLOAD_CHANGED_SIGNAL = 'PG:OS:ACTIVE_PAYLOAD_CHANGED';
const TOGGLE_PAYLOAD_LOCK_SIGNAL = 'PG:OS:TOGGLE_PAYLOAD_LOCK';
const PAYLOAD_LOCK_CHANGED_SIGNAL = 'PG:OS:PAYLOAD_LOCK_CHANGED';
const PRINT_LULU_SIGNAL = 'PG:UI:PRINT_LULU';

function normalizePayload(input = {}) {
    const rawType = input?.type ?? input?.data?.type ?? null;
    const type = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
    if (!type) {
        return null;
    }

    const data = input?.data && typeof input.data === 'object'
        ? input.data
        : input;

    return Object.freeze({
        type,
        url: typeof data.url === 'string' && data.url.trim() ? data.url.trim() : null,
        thumbnailUrl: typeof data.thumbnailUrl === 'string' && data.thumbnailUrl.trim()
            ? data.thumbnailUrl.trim()
            : (typeof data.url === 'string' && data.url.trim() ? data.url.trim() : null),
        label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : type,
        source: typeof data.source === 'string' && data.source.trim() ? data.source.trim() : 'runtime',
        meta: data.meta && typeof data.meta === 'object' ? { ...data.meta } : null,
        galleryId: typeof data.galleryId === 'string' && data.galleryId.trim() ? data.galleryId.trim() : null,
    });
}

export class PayloadManager {
    constructor() {
        this.phase = 'core';
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this._activePayloads = new Map();
        this._lockedPayloads = new Set();
        this._removeSetPayloadListener = null;
        this._removeTogglePayloadLockListener = null;
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (!this.runtimeSignals?.on || this._removeSetPayloadListener || this._removeTogglePayloadLockListener) {
            return;
        }

        this._removeSetPayloadListener = this.runtimeSignals.on(
            SET_ACTIVE_PAYLOAD_SIGNAL,
            (payload) => {
                const normalized = normalizePayload(payload);
                if (!normalized) {
                    return;
                }
                this.setActivePayload(normalized.type, normalized);
            }
        );

        this._removeTogglePayloadLockListener = this.runtimeSignals.on(
            TOGGLE_PAYLOAD_LOCK_SIGNAL,
            (payload) => {
                const key = typeof payload?.type === 'string' ? payload.type.trim().toUpperCase() : '';
                if (!key) {
                    return;
                }
                this.toggleLock(key);
            }
        );
    }

    setActivePayload(type, data) {
        const normalized = normalizePayload({ type, data });
        if (!normalized) {
            return null;
        }

        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (this._lockedPayloads.has(normalized.type)) {
            this.runtimeSignals?.emit?.(PRINT_LULU_SIGNAL, {
                text: `[OS BUFFER] :: Denegado. Payload [${normalized.type}] bajo SEGURO TACTICO.`,
                type: 'system',
            }, { mirrorDom: false });
            return this.getActivePayload(normalized.type);
        }

        this._activePayloads.set(normalized.type, normalized);
        this.runtimeSignals?.emit?.(ACTIVE_PAYLOAD_CHANGED_SIGNAL, {
            type: normalized.type,
            data: normalized,
        }, { mirrorDom: false });
        return normalized;
    }

    getActivePayload(type) {
        const key = typeof type === 'string' ? type.trim().toUpperCase() : '';
        if (!key) {
            return null;
        }
        return this._activePayloads.get(key) ?? null;
    }

    isPayloadLocked(type) {
        const key = typeof type === 'string' ? type.trim().toUpperCase() : '';
        if (!key) {
            return false;
        }
        return this._lockedPayloads.has(key);
    }

    toggleLock(type) {
        const key = typeof type === 'string' ? type.trim().toUpperCase() : '';
        if (!key || !this._activePayloads.has(key)) {
            return false;
        }

        const isLocked = this._lockedPayloads.has(key);
        if (isLocked) {
            this._lockedPayloads.delete(key);
        } else {
            this._lockedPayloads.add(key);
        }

        const nextLockedState = !isLocked;
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.runtimeSignals?.emit?.(PAYLOAD_LOCK_CHANGED_SIGNAL, {
            type: key,
            isLocked: nextLockedState,
        }, { mirrorDom: false });
        return nextLockedState;
    }

    clearPayload(type) {
        const key = typeof type === 'string' ? type.trim().toUpperCase() : '';
        if (!key) {
            return;
        }
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (this._lockedPayloads.has(key)) {
            this.runtimeSignals?.emit?.(PRINT_LULU_SIGNAL, {
                text: `[OS BUFFER] :: Denegado. No se puede expulsar [${key}] con el SEGURO TACTICO activo.`,
                type: 'system',
            }, { mirrorDom: false });
            return;
        }
        this._activePayloads.delete(key);
        this._lockedPayloads.delete(key);
        this.runtimeSignals?.emit?.(ACTIVE_PAYLOAD_CHANGED_SIGNAL, {
            type: key,
            data: null,
        }, { mirrorDom: false });
        this.runtimeSignals?.emit?.(PAYLOAD_LOCK_CHANGED_SIGNAL, {
            type: key,
            isLocked: false,
        }, { mirrorDom: false });
    }

    getDebugState() {
        const image = this.getActivePayload('IMAGE');
        return {
            activeTypes: Array.from(this._activePayloads.keys()),
            lockedTypes: Array.from(this._lockedPayloads.keys()),
            image: image ? {
                url: image.url,
                label: image.label,
                source: image.source,
                galleryId: image.galleryId,
                isLocked: this.isPayloadLocked('IMAGE'),
            } : null,
        };
    }

    dispose() {
        this._removeSetPayloadListener?.();
        this._removeSetPayloadListener = null;
        this._removeTogglePayloadLockListener?.();
        this._removeTogglePayloadLockListener = null;
        this._activePayloads.clear();
        this._lockedPayloads.clear();
    }
}

export default PayloadManager;
