import { Registry } from '../core/ServiceRegistry.js';

export const POINTER_VIEW_STATE = Object.freeze({
    UI_VISIBLE: 'ui-visible',
    TEXT_VISIBLE: 'text-visible',
    DRAG_VISIBLE: 'drag-visible',
    FLIGHT_PENDING_LOCK: 'flight-pending-lock',
    FLIGHT_LOCKED: 'flight-locked',
});

const BODY_STATE_CLASS = Object.freeze({
    [POINTER_VIEW_STATE.UI_VISIBLE]: 'pg-pointer-ui-visible',
    [POINTER_VIEW_STATE.TEXT_VISIBLE]: 'pg-pointer-text-visible',
    [POINTER_VIEW_STATE.DRAG_VISIBLE]: 'pg-pointer-drag-visible',
    [POINTER_VIEW_STATE.FLIGHT_PENDING_LOCK]: 'pg-pointer-flight-pending',
    [POINTER_VIEW_STATE.FLIGHT_LOCKED]: 'pg-pointer-flight-locked',
});

const RETICLE_MODE_CLASS = Object.freeze({
    hidden: 'pg-reticle-primary-hidden',
    dim: 'pg-reticle-primary-dim',
    active: 'pg-reticle-primary-active',
});

const LOCK_REQUEST_COOLDOWN_MS = 1500;

export class PointerPresentationController {
    constructor({ domElement = null, helperId = 'pg-pointer-helper' } = {}) {
        this.domElement = domElement;
        this.helperId = helperId;
        this.activeIntents = new Map();
        this.runtimeSignals = null;
        this.snapshot = {
            state: POINTER_VIEW_STATE.UI_VISIBLE,
            cursor: 'default',
            helperText: null,
            pointerLocked: false,
            winnerSource: null,
            winnerKind: null,
            reticleMode: 'hidden',
            hasLockError: false,
            lockRequestInFlight: false,
            activeIntentsCount: 0,
        };

        this._intentSerial = 0;
        this._lockCooldownUntil = 0;
        this._lockRequestInFlight = false;
        this._lockErrorActive = false;
        this._lockErrorTimer = null;
        this._helperEl = null;
        this._lastAppliedSignature = '';

        this._boundLockChange = this._onPointerLockChange.bind(this);
        this._boundLockError = this._onPointerLockError.bind(this);
    }

    init() {
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        document.addEventListener('pointerlockchange', this._boundLockChange, false);
        document.addEventListener('pointerlockerror', this._boundLockError, false);
        this._ensureHelperElement();
        this._applyResolvedState();
    }

    destroy() {
        document.removeEventListener('pointerlockchange', this._boundLockChange, false);
        document.removeEventListener('pointerlockerror', this._boundLockError, false);
        this.activeIntents.clear();
        if (this._helperEl) {
            this._helperEl.remove();
            this._helperEl = null;
        }
        if (this._lockErrorTimer) {
            clearTimeout(this._lockErrorTimer);
            this._lockErrorTimer = null;
        }
        if (document.body) {
            document.body.classList.remove(
                ...Object.values(BODY_STATE_CLASS),
                ...Object.values(RETICLE_MODE_CLASS),
                'pg-pointer-lock-error',
                'pg-pointer-helper-visible'
            );
            delete document.body.dataset.pgPointerState;
            delete document.body.dataset.pgPointerWinner;
        }
    }

    setDomElement(domElement) {
        if (domElement) {
            this.domElement = domElement;
        }
        return this._applyResolvedState();
    }

    upsertIntent(source, intent = {}) {
        if (!source) {
            return this.getSnapshot();
        }

        this.activeIntents.set(source, this._normalizeIntent(source, intent));
        return this._applyResolvedState();
    }

    clearIntent(source) {
        if (!source) {
            return this.getSnapshot();
        }

        if (this.activeIntents.delete(source)) {
            return this._applyResolvedState();
        }

        return this.getSnapshot();
    }

    async requestPointerLock({ source = 'pointer-presentation', preferUnadjustedMovement = true } = {}) {
        const target = this._resolveDomElement();
        if (!target?.requestPointerLock) {
            this.notifyPointerLockError(new Error('Pointer Lock API is not available on the current target.'));
            return { ok: false, reason: 'unsupported' };
        }

        if (document.pointerLockElement === target) {
            this.notifyPointerLockChange({ locked: true, element: target });
            return { ok: true, reason: 'already-locked' };
        }

        const now = performance.now();
        if (this._lockRequestInFlight) {
            return { ok: false, reason: 'in-flight' };
        }
        if (now < this._lockCooldownUntil) {
            return { ok: false, reason: 'cooldown' };
        }

        this._lockRequestInFlight = true;
        this._applyResolvedState();

        try {
            await this._requestPointerLockWithFallback(target, preferUnadjustedMovement);
            return { ok: true, reason: 'requested', source };
        } catch (error) {
            this.notifyPointerLockError(error);
            return { ok: false, reason: 'error', source, error };
        } finally {
            this._lockRequestInFlight = false;
            this._applyResolvedState();
        }
    }

    releasePointerLock({ reason = 'release' } = {}) {
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }
        this._applyResolvedState();
        return { ok: true, reason };
    }

    notifyPointerLockChange() {
        if (document.pointerLockElement === this._resolveDomElement()) {
            this._clearLockError();
        }
        return this._applyResolvedState();
    }

    notifyPointerLockError(error = null) {
        this._lockCooldownUntil = performance.now() + LOCK_REQUEST_COOLDOWN_MS;
        if (error) {
            this._lockErrorActive = true;
            if (this._lockErrorTimer) {
                clearTimeout(this._lockErrorTimer);
            }
            this._lockErrorTimer = setTimeout(() => {
                this._clearLockError();
                this._applyResolvedState();
            }, LOCK_REQUEST_COOLDOWN_MS);
            console.warn('[PointerPresentationController] Pointer lock request failed:', error);
        }
        return this._applyResolvedState();
    }

    getSnapshot() {
        return {
            ...this.snapshot,
            activeIntentsCount: this.activeIntents.size,
        };
    }

    _onPointerLockChange() {
        this.notifyPointerLockChange();
    }

    _onPointerLockError() {
        this.notifyPointerLockError();
    }

    _resolveDomElement() {
        if (!this.domElement || !this.domElement.isConnected) {
            this.domElement = document.getElementById('pg-renderer') || document.body;
        }
        return this.domElement;
    }

    _normalizeIntent(source, intent) {
        const kind = intent?.kind || 'ui';
        return {
            source,
            kind,
            cursor: intent?.cursor || this._defaultCursorForKind(kind),
            wantsPointerLock: !!intent?.wantsPointerLock,
            helperText: typeof intent?.helperText === 'string' ? intent.helperText : null,
            priority: Number.isFinite(intent?.priority) ? intent.priority : 0,
            reticleMode: intent?.reticleMode || (kind === 'flight' ? 'dim' : 'hidden'),
            serial: ++this._intentSerial,
        };
    }

    _defaultCursorForKind(kind) {
        switch (kind) {
            case 'text':
                return 'text';
            case 'drag':
                return 'grabbing';
            case 'flight':
                return 'default';
            default:
                return 'default';
        }
    }

    _resolveWinningIntent() {
        let winner = null;
        for (const intent of this.activeIntents.values()) {
            if (!winner) {
                winner = intent;
                continue;
            }

            if (intent.priority > winner.priority) {
                winner = intent;
                continue;
            }

            if (intent.priority === winner.priority && intent.serial > winner.serial) {
                winner = intent;
            }
        }
        return winner;
    }

    _resolveState() {
        const winner = this._resolveWinningIntent();
        const pointerLocked = document.pointerLockElement === this._resolveDomElement();

        let state = POINTER_VIEW_STATE.UI_VISIBLE;
        let cursor = 'default';
        let helperText = null;
        let reticleMode = 'hidden';

        if (winner) {
            switch (winner.kind) {
                case 'flight':
                    state = pointerLocked ? POINTER_VIEW_STATE.FLIGHT_LOCKED : POINTER_VIEW_STATE.FLIGHT_PENDING_LOCK;
                    cursor = pointerLocked ? 'none' : winner.cursor;
                    helperText = pointerLocked ? null : winner.helperText ?? null;
                    reticleMode = pointerLocked ? 'active' : (winner.reticleMode === 'hidden' ? 'hidden' : 'dim');
                    break;
                case 'text':
                    state = POINTER_VIEW_STATE.TEXT_VISIBLE;
                    cursor = 'text';
                    break;
                case 'drag':
                    state = POINTER_VIEW_STATE.DRAG_VISIBLE;
                    cursor = winner.cursor || 'grabbing';
                    break;
                default:
                    state = POINTER_VIEW_STATE.UI_VISIBLE;
                    cursor = winner.cursor || 'default';
                    break;
            }
        } else if (pointerLocked) {
            state = POINTER_VIEW_STATE.FLIGHT_LOCKED;
            cursor = 'none';
            reticleMode = 'active';
        }

        return {
            state,
            cursor,
            helperText,
            pointerLocked,
            winnerSource: winner?.source || null,
            winnerKind: winner?.kind || null,
            reticleMode,
            hasLockError: this._lockErrorActive,
            lockRequestInFlight: this._lockRequestInFlight,
            activeIntentsCount: this.activeIntents.size,
        };
    }

    _applyResolvedState() {
        const nextSnapshot = this._resolveState();
        this.snapshot = nextSnapshot;

        const body = document.body;
        if (!body) {
            return this.getSnapshot();
        }

        body.classList.remove(
            ...Object.values(BODY_STATE_CLASS),
            ...Object.values(RETICLE_MODE_CLASS),
            'pg-pointer-lock-error',
            'pg-pointer-helper-visible'
        );
        body.classList.add(BODY_STATE_CLASS[nextSnapshot.state]);
        body.classList.add(RETICLE_MODE_CLASS[nextSnapshot.reticleMode]);
        if (nextSnapshot.hasLockError) {
            body.classList.add('pg-pointer-lock-error');
        }

        body.dataset.pgPointerState = nextSnapshot.state;
        body.dataset.pgPointerWinner = nextSnapshot.winnerSource || '';

        const helper = this._ensureHelperElement();
        const showHelper = !!nextSnapshot.helperText;
        if (helper) {
            helper.textContent = nextSnapshot.helperText || '';
            helper.hidden = !showHelper;
        }
        body.classList.toggle('pg-pointer-helper-visible', showHelper);

        window.__PG_POINTER_SNAPSHOT = this.getSnapshot();

        const nextSignature = this._buildSignature(nextSnapshot);
        if (nextSignature !== this._lastAppliedSignature) {
            this.runtimeSignals?.emit?.('PG:POINTER_PRESENTATION_STATE', this.getSnapshot());
            this._lastAppliedSignature = nextSignature;
        }

        return this.getSnapshot();
    }

    _buildSignature(snapshot) {
        return [
            snapshot.state,
            snapshot.cursor,
            snapshot.helperText || '',
            snapshot.pointerLocked ? '1' : '0',
            snapshot.winnerSource || '',
            snapshot.winnerKind || '',
            snapshot.reticleMode,
            snapshot.hasLockError ? '1' : '0',
            snapshot.lockRequestInFlight ? '1' : '0',
            String(snapshot.activeIntentsCount),
        ].join('|');
    }

    _ensureHelperElement() {
        if (this._helperEl && this._helperEl.isConnected) {
            return this._helperEl;
        }
        if (!document.body) {
            return null;
        }

        let helper = document.getElementById(this.helperId);
        if (!helper) {
            helper = document.createElement('div');
            helper.id = this.helperId;
            helper.className = 'pg-pointer-helper';
            helper.hidden = true;
            helper.setAttribute('aria-live', 'polite');
            helper.setAttribute('aria-atomic', 'true');
            document.body.appendChild(helper);
        }

        this._helperEl = helper;
        return helper;
    }

    async _requestPointerLockWithFallback(target, preferUnadjustedMovement) {
        try {
            if (preferUnadjustedMovement) {
                await this._awaitPointerLockRequest(target, { unadjustedMovement: true });
                return;
            }

            await this._awaitPointerLockRequest(target);
        } catch (error) {
            if (preferUnadjustedMovement && error?.name === 'NotSupportedError') {
                await this._awaitPointerLockRequest(target);
                return;
            }

            if (this._isDeferredPointerLockError(error)) {
                return;
            }

            throw error;
        }
    }

    _awaitPointerLockRequest(target, options = null) {
        try {
            const result = options ? target.requestPointerLock(options) : target.requestPointerLock();
            if (result && typeof result.then === 'function') {
                return result;
            }
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    _isDeferredPointerLockError(error) {
        return error instanceof DOMException &&
            ['AbortError', 'NotAllowedError', 'SecurityError'].includes(error.name);
    }

    _clearLockError() {
        this._lockErrorActive = false;
        if (this._lockErrorTimer) {
            clearTimeout(this._lockErrorTimer);
            this._lockErrorTimer = null;
        }
    }
}
