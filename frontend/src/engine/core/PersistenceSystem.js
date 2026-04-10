import { Registry } from './ServiceRegistry.js';
import {
    applyProjectionPayload,
    attachProjectionShell,
    normalizeProjectionImagePayload,
} from '../rendering/ProjectionShellRuntime.js';

const STORAGE_KEY = 'pg.persistence.scars.v1';
const IMAGE_REVEAL_COMPLETE_SIGNAL = 'PG:FX:IMAGE_REVEAL_COMPLETE';
const PRINT_LULU_SIGNAL = 'PG:UI:PRINT_LULU';

function getStorage() {
    try {
        return globalThis?.localStorage ?? null;
    } catch {
        return null;
    }
}

function normalizeScarRecord(deterministicKey, payload = {}) {
    const key = typeof deterministicKey === 'string' ? deterministicKey.trim() : '';
    if (!key) {
        return null;
    }

    const normalizedPayload = normalizeProjectionImagePayload(payload);
    if (!normalizedPayload?.url) {
        return null;
    }

    return Object.freeze({
        deterministicKey: key,
        url: normalizedPayload.url,
        label: normalizedPayload.label,
        source: normalizedPayload.source,
        galleryId: normalizedPayload.galleryId,
        targetName: typeof payload.targetName === 'string' && payload.targetName.trim()
            ? payload.targetName.trim()
            : null,
        recordedAt: Number.isFinite(payload.recordedAt)
            ? payload.recordedAt
            : Date.now(),
    });
}

export class PersistenceSystem {
    constructor() {
        this.phase = 'core';
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this._planetaryScars = new Map();
        this._removeRevealListener = null;
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this._load();

        if (this.runtimeSignals?.on && !this._removeRevealListener) {
            this._removeRevealListener = this.runtimeSignals.on(
                IMAGE_REVEAL_COMPLETE_SIGNAL,
                (payload) => this._handleImageRevealComplete(payload)
            );
        }
    }

    _handleImageRevealComplete(payload) {
        const deterministicKey = typeof payload?.deterministicKey === 'string'
            ? payload.deterministicKey.trim()
            : '';
        if (!deterministicKey) {
            console.warn('[PersistenceSystem] Reveal received without deterministicKey. Scar will not persist.');
            return null;
        }

        const record = this.recordScar(deterministicKey, {
            url: payload?.injectedPayload,
            label: payload?.payloadLabel,
            source: typeof payload?.source === 'string' ? payload.source : 'project-particles-system',
            targetName: payload?.hostName ?? null,
        });

        if (record) {
            this.runtimeSignals?.emit?.(PRINT_LULU_SIGNAL, {
                text: `[SISTEMA] :: Cicatriz cosmica registrada en [${deterministicKey}].`,
                type: 'system',
            }, { mirrorDom: false });
        }

        return record;
    }

    recordScar(deterministicKey, payload) {
        const record = normalizeScarRecord(deterministicKey, payload);
        if (!record) {
            return null;
        }

        this._planetaryScars.set(record.deterministicKey, record);
        this._save();
        return record;
    }

    getScar(deterministicKey) {
        const key = typeof deterministicKey === 'string' ? deterministicKey.trim() : '';
        if (!key) {
            return null;
        }
        return this._planetaryScars.get(key) ?? null;
    }

    hasScar(deterministicKey) {
        return !!this.getScar(deterministicKey);
    }

    removeScar(deterministicKey) {
        const key = typeof deterministicKey === 'string' ? deterministicKey.trim() : '';
        if (!key) {
            return false;
        }

        const removed = this._planetaryScars.delete(key);
        if (removed) {
            this._save();
        }
        return removed;
    }

    async restoreScar(target, { silent = true } = {}) {
        const deterministicKey = typeof target?.userData?.deterministicKey === 'string'
            ? target.userData.deterministicKey.trim()
            : '';
        if (!deterministicKey) {
            return null;
        }

        const scar = this.getScar(deterministicKey);
        if (!scar) {
            return null;
        }

        const shell = attachProjectionShell(target, {
            hostMassName: target?.name ?? scar.targetName ?? null,
        });
        if (!shell) {
            return null;
        }

        const shellState = await applyProjectionPayload(shell, scar);
        target.userData = {
            ...(target.userData ?? {}),
            canProjectImage: true,
            imageProjectionCapable: true,
            persistentScarKey: deterministicKey,
        };

        if (!silent) {
            this.runtimeSignals?.emit?.(PRINT_LULU_SIGNAL, {
                text: `[SISTEMA] :: Cicatriz restaurada en [${deterministicKey}].`,
                type: 'system',
            }, { mirrorDom: false });
        }

        return {
            deterministicKey,
            targetName: target?.name ?? scar.targetName ?? null,
            payloadKey: shellState?.payloadKey ?? shell.userData?.payloadKey ?? null,
            payloadLabel: shellState?.payloadLabel ?? scar.label ?? null,
            shellAttached: !!shell,
        };
    }

    restoreScarsInTree(root, options = {}) {
        if (!root?.traverse) {
            return Promise.resolve([]);
        }

        const tasks = [];
        root.traverse((node) => {
            if (!node?.userData?.deterministicKey || node.userData?.isHitbox) {
                return;
            }
            if (!node.userData?.isMass && !node.userData?.isApp && node.userData?.nodeType !== 'metamorph-moon') {
                return;
            }
            if (!this.hasScar(node.userData.deterministicKey)) {
                return;
            }
            tasks.push(this.restoreScar(node, options));
        });

        return Promise.all(tasks);
    }

    _load() {
        const storage = getStorage();
        if (!storage) {
            return;
        }

        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);
            const entries = parsed?.scars && typeof parsed.scars === 'object'
                ? Object.entries(parsed.scars)
                : [];

            this._planetaryScars.clear();
            for (let i = 0; i < entries.length; i++) {
                const [deterministicKey, value] = entries[i];
                const record = normalizeScarRecord(deterministicKey, value);
                if (record) {
                    this._planetaryScars.set(deterministicKey, record);
                }
            }
        } catch (error) {
            console.warn('[PersistenceSystem] Failed to restore persisted scars.', error);
        }
    }

    _save() {
        const storage = getStorage();
        if (!storage) {
            return;
        }

        const scars = {};
        for (const [deterministicKey, record] of this._planetaryScars.entries()) {
            scars[deterministicKey] = {
                url: record.url,
                label: record.label,
                source: record.source,
                galleryId: record.galleryId,
                targetName: record.targetName,
                recordedAt: record.recordedAt,
            };
        }

        try {
            storage.setItem(STORAGE_KEY, JSON.stringify({
                version: 1,
                scars,
            }));
        } catch (error) {
            console.warn('[PersistenceSystem] Failed to persist scars.', error);
        }
    }

    getDebugState() {
        const scarKeys = Array.from(this._planetaryScars.keys()).sort();
        const latest = scarKeys.length > 0
            ? this._planetaryScars.get(scarKeys[scarKeys.length - 1]) ?? null
            : null;

        return {
            scarCount: this._planetaryScars.size,
            scarKeys,
            latestScar: latest ? {
                deterministicKey: latest.deterministicKey,
                url: latest.url,
                label: latest.label,
                targetName: latest.targetName,
            } : null,
        };
    }

    dispose() {
        this._removeRevealListener?.();
        this._removeRevealListener = null;
    }
}

export default PersistenceSystem;
