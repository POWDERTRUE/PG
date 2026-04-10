import { Registry } from '../core/ServiceRegistry.js';
import {
    GALLERY_IMAGE_PAYLOADS,
    findGalleryPayloadIndexByUrl,
    getGalleryPayloadByIndex,
} from './windows/GalleryPayloadCatalog.js';

const ACTIVE_PAYLOAD_CHANGED_SIGNAL = 'PG:OS:ACTIVE_PAYLOAD_CHANGED';
const IMAGE_REVEAL_COMPLETE_SIGNAL = 'PG:FX:IMAGE_REVEAL_COMPLETE';
const OPEN_GALLERY_SIGNAL = 'PG:UI:OPEN_GALLERY_APP';
const SET_ACTIVE_PAYLOAD_SIGNAL = 'PG:OS:SET_ACTIVE_PAYLOAD';
const TOGGLE_PAYLOAD_LOCK_SIGNAL = 'PG:OS:TOGGLE_PAYLOAD_LOCK';
const PAYLOAD_LOCK_CHANGED_SIGNAL = 'PG:OS:PAYLOAD_LOCK_CHANGED';
const PRINT_LULU_SIGNAL = 'PG:UI:PRINT_LULU';
const IMAGE_PAYLOAD_TYPE = 'IMAGE';
const DEPLOY_FLASH_MS = 520;

export class PayloadIndicatorSystem {
    constructor() {
        this.phase = 'ui';
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.windowManager = Registry.tryGet('WindowManager');
        this.payloadManager = Registry.tryGet('PayloadManager');
        this.quickCatalog = GALLERY_IMAGE_PAYLOADS;
        this.currentIndex = -1;
        this.isLocked = false;
        this.container = null;
        this.infoWrapper = null;
        this.thumbnail = null;
        this.label = null;
        this.lockButton = null;
        this.prevButton = null;
        this.nextButton = null;
        this.clearButton = null;
        this._removePayloadChangedListener = null;
        this._removeLockChangedListener = null;
        this._removeRevealListener = null;
        this._deployTimer = null;
        this._openGallery = this._openGallery.bind(this);
        this._toggleLock = this._toggleLock.bind(this);
        this._cyclePrevious = this._cyclePrevious.bind(this);
        this._cycleNext = this._cycleNext.bind(this);
        this._clearPayload = this._clearPayload.bind(this);
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');

        this._buildDOM();

        if (!this._removePayloadChangedListener && this.runtimeSignals?.on) {
            this._removePayloadChangedListener = this.runtimeSignals.on(
                ACTIVE_PAYLOAD_CHANGED_SIGNAL,
                (detail) => this._handlePayloadChanged(detail)
            );
        }

        if (!this._removeRevealListener && this.runtimeSignals?.on) {
            this._removeRevealListener = this.runtimeSignals.on(
                IMAGE_REVEAL_COMPLETE_SIGNAL,
                () => this._flashDeployed()
            );
        }

        if (!this._removeLockChangedListener && this.runtimeSignals?.on) {
            this._removeLockChangedListener = this.runtimeSignals.on(
                PAYLOAD_LOCK_CHANGED_SIGNAL,
                (detail) => this._handleLockChanged(detail)
            );
        }

        const activeImage = this.payloadManager?.getActivePayload?.(IMAGE_PAYLOAD_TYPE) ?? null;
        this._syncIndicator(activeImage);
    }

    dispose() {
        this._removePayloadChangedListener?.();
        this._removePayloadChangedListener = null;
        this._removeLockChangedListener?.();
        this._removeLockChangedListener = null;
        this._removeRevealListener?.();
        this._removeRevealListener = null;

        if (this._deployTimer) {
            window.clearTimeout(this._deployTimer);
            this._deployTimer = null;
        }

        if (this.container) {
            this.infoWrapper?.removeEventListener('click', this._openGallery);
            this.lockButton?.removeEventListener('click', this._toggleLock);
            this.prevButton?.removeEventListener('click', this._cyclePrevious);
            this.nextButton?.removeEventListener('click', this._cycleNext);
            this.clearButton?.removeEventListener('click', this._clearPayload);
            this.container.remove();
        }

        this.container = null;
        this.infoWrapper = null;
        this.thumbnail = null;
        this.label = null;
        this.lockButton = null;
        this.prevButton = null;
        this.nextButton = null;
        this.clearButton = null;
    }

    getDebugState() {
        return {
            visible: !!this.container && !this.container.classList.contains('hidden'),
            deployed: !!this.container && this.container.classList.contains('deployed'),
            label: this.label?.textContent ?? '',
            src: this.thumbnail?.getAttribute('src') ?? null,
            currentIndex: this.currentIndex,
            isLocked: this.isLocked,
        };
    }

    _buildDOM() {
        const host = document.getElementById('hud-layer') || document.body;
        document.getElementById('omega-payload-indicator')?.remove();

        this.container = document.createElement('div');
        this.container.id = 'omega-payload-indicator';
        this.container.className = 'payload-indicator hidden';
        this.container.setAttribute('role', 'group');
        this.container.setAttribute('aria-label', 'Indicador tactico de payload activo');
        this.container.innerHTML = `
            <button type="button" class="payload-info-wrapper" aria-label="Abrir galeria de payload">
                <span class="payload-thumbnail">
                    <img alt="Payload activo">
                </span>
                <span class="payload-text-wrapper">
                    <span class="payload-title">CARGA ACTIVA</span>
                    <span class="payload-label">NINGUNA</span>
                </span>
            </button>
            <div class="payload-controls" aria-label="Controles rapidos de payload">
                <button type="button" class="payload-btn btn-lock payload-btn-lock" title="Alternar seguro tactico" aria-label="Alternar seguro tactico">LOCK</button>
                <button type="button" class="payload-btn payload-btn-prev" title="Payload anterior" aria-label="Payload anterior">◄</button>
                <button type="button" class="payload-btn btn-danger payload-btn-clear" title="Expulsar payload" aria-label="Expulsar payload">×</button>
                <button type="button" class="payload-btn payload-btn-next" title="Payload siguiente" aria-label="Payload siguiente">►</button>
            </div>
        `;

        this.infoWrapper = this.container.querySelector('.payload-info-wrapper');
        this.thumbnail = this.container.querySelector('.payload-thumbnail img');
        this.label = this.container.querySelector('.payload-label');
        this.lockButton = this.container.querySelector('.payload-btn-lock');
        this.prevButton = this.container.querySelector('.payload-btn-prev');
        this.nextButton = this.container.querySelector('.payload-btn-next');
        this.clearButton = this.container.querySelector('.payload-btn-clear');
        this.infoWrapper?.addEventListener('click', this._openGallery);
        this.lockButton?.addEventListener('click', this._toggleLock);
        this.prevButton?.addEventListener('click', this._cyclePrevious);
        this.nextButton?.addEventListener('click', this._cycleNext);
        this.clearButton?.addEventListener('click', this._clearPayload);
        host.appendChild(this.container);
    }

    _openGallery() {
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        if (this.windowManager?.openApp) {
            this.windowManager.openApp('gallery', { source: 'payload-indicator' });
            return;
        }

        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.runtimeSignals?.emit?.(OPEN_GALLERY_SIGNAL, { source: 'payload-indicator' }, { mirrorDom: false });
    }

    _toggleLock(event) {
        event?.stopPropagation?.();
        if (!this.payloadManager?.getActivePayload?.(IMAGE_PAYLOAD_TYPE)) {
            return;
        }

        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.runtimeSignals?.emit?.(TOGGLE_PAYLOAD_LOCK_SIGNAL, {
            type: IMAGE_PAYLOAD_TYPE,
            source: 'payload-indicator',
        }, { mirrorDom: false });
    }

    _cyclePrevious(event) {
        this._cyclePayload(event, -1);
    }

    _cycleNext(event) {
        this._cyclePayload(event, 1);
    }

    _cyclePayload(event, direction) {
        event?.stopPropagation?.();
        if (this.isLocked) {
            return;
        }

        const total = this.quickCatalog.length;
        if (!total) {
            return;
        }

        let nextIndex = this.currentIndex;
        if (nextIndex < 0) {
            nextIndex = direction >= 0 ? 0 : total - 1;
        } else {
            nextIndex = (nextIndex + direction + total) % total;
        }

        const nextPayload = getGalleryPayloadByIndex(nextIndex);
        if (!nextPayload) {
            return;
        }

        this.currentIndex = nextIndex;
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        if (this.runtimeSignals?.emit) {
            this.runtimeSignals.emit(SET_ACTIVE_PAYLOAD_SIGNAL, {
                type: IMAGE_PAYLOAD_TYPE,
                data: {
                    url: nextPayload.url,
                    thumbnailUrl: nextPayload.thumbnailUrl,
                    label: nextPayload.label,
                    galleryId: nextPayload.id,
                    source: 'payload-indicator',
                },
            }, { mirrorDom: false });
            return;
        }

        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');
        this.payloadManager?.setActivePayload?.(IMAGE_PAYLOAD_TYPE, {
            url: nextPayload.url,
            thumbnailUrl: nextPayload.thumbnailUrl,
            label: nextPayload.label,
            galleryId: nextPayload.id,
            source: 'payload-indicator',
        });
    }

    _clearPayload(event) {
        event?.stopPropagation?.();
        if (this.isLocked) {
            return;
        }
        this.currentIndex = -1;
        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');
        this.payloadManager?.clearPayload?.(IMAGE_PAYLOAD_TYPE);
    }

    _handlePayloadChanged(detail) {
        if (String(detail?.type || '').toUpperCase() !== IMAGE_PAYLOAD_TYPE) {
            return;
        }

        this._syncIndicator(detail?.data ?? null);
    }

    _syncIndicator(payload) {
        if (payload?.url) {
            this.currentIndex = findGalleryPayloadIndexByUrl(payload.url);
            this.isLocked = this.payloadManager?.isPayloadLocked?.(IMAGE_PAYLOAD_TYPE) ?? false;
            this._updateVisuals(payload.thumbnailUrl || payload.url, payload.label || 'Municion visual');
            this._applyLockVisualState(this.isLocked);
            this.container?.classList.remove('hidden');
            this.container?.classList.add('active');
            return;
        }

        this.currentIndex = -1;
        this.isLocked = false;
        this._updateVisuals('', 'NINGUNA');
        this._applyLockVisualState(false);
        this.container?.classList.remove('active', 'deployed');
        this.container?.classList.add('hidden');
    }

    _handleLockChanged(detail) {
        if (String(detail?.type || '').toUpperCase() !== IMAGE_PAYLOAD_TYPE) {
            return;
        }

        this.isLocked = !!detail?.isLocked;
        this._applyLockVisualState(this.isLocked);

        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.runtimeSignals?.emit?.(PRINT_LULU_SIGNAL, {
            text: this.isLocked
                ? '[SISTEMA] :: Seguro tactico ACTIVADO.'
                : '[SISTEMA] :: Seguro tactico LIBERADO.',
            type: 'system',
        }, { mirrorDom: false });
    }

    _updateVisuals(url, labelText) {
        if (this.thumbnail) {
            if (url) {
                this.thumbnail.src = url;
            } else {
                this.thumbnail.removeAttribute('src');
            }
        }

        if (this.label) {
            this.label.textContent = String(labelText || 'NINGUNA').toUpperCase();
        }
    }

    _applyLockVisualState(isLocked) {
        this.container?.classList.toggle('is-locked', !!isLocked);
        if (this.lockButton) {
            this.lockButton.textContent = isLocked ? 'LOCKED' : 'LOCK';
            this.lockButton.title = isLocked ? 'Liberar seguro tactico' : 'Activar seguro tactico';
            this.lockButton.setAttribute('aria-label', this.lockButton.title);
        }
    }

    _flashDeployed() {
        if (!this.container || this.container.classList.contains('hidden')) {
            return;
        }

        if (this._deployTimer) {
            window.clearTimeout(this._deployTimer);
        }

        this.container.classList.add('deployed');
        this._deployTimer = window.setTimeout(() => {
            this.container?.classList.remove('deployed');
            this._deployTimer = null;
        }, DEPLOY_FLASH_MS);
    }
}

export default PayloadIndicatorSystem;
