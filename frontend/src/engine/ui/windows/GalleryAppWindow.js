import { Registry } from '../../core/ServiceRegistry.js';
import { GALLERY_IMAGE_PAYLOADS } from './GalleryPayloadCatalog.js';

const WINDOW_APP_ID = 'gallery';
const WINDOW_ID = `os-window-${WINDOW_APP_ID}`;
const SET_ACTIVE_PAYLOAD_SIGNAL = 'PG:OS:SET_ACTIVE_PAYLOAD';
const ACTIVE_PAYLOAD_CHANGED_SIGNAL = 'PG:OS:ACTIVE_PAYLOAD_CHANGED';
const PAYLOAD_LOCK_CHANGED_SIGNAL = 'PG:OS:PAYLOAD_LOCK_CHANGED';
const OPEN_GALLERY_SIGNAL = 'PG:UI:OPEN_GALLERY_APP';

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class GalleryAppWindow {
    constructor(kernel) {
        this.kernel = kernel;
        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.windowManager = Registry.tryGet('WindowManager');
        this.payloadManager = Registry.tryGet('PayloadManager');
        this.windowId = WINDOW_ID;
        this.activeWindow = null;
        this.activeContent = null;
        this.lastMetadata = null;
        this._removeOpenListener = null;
        this._removePayloadListener = null;
        this._removeLockListener = null;
        this._boundRender = this._renderWindow.bind(this);
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');

        if (this.runtimeSignals?.on && !this._removeOpenListener) {
            this._removeOpenListener = this.runtimeSignals.on(
                OPEN_GALLERY_SIGNAL,
                (detail) => this.open(detail)
            );
        }

        if (this.runtimeSignals?.on && !this._removePayloadListener) {
            this._removePayloadListener = this.runtimeSignals.on(
                ACTIVE_PAYLOAD_CHANGED_SIGNAL,
                (detail) => {
                    if (String(detail?.type || '').toUpperCase() !== 'IMAGE') {
                        return;
                    }
                    this._refreshOpenWindow();
                }
            );
        }

        if (this.runtimeSignals?.on && !this._removeLockListener) {
            this._removeLockListener = this.runtimeSignals.on(
                PAYLOAD_LOCK_CHANGED_SIGNAL,
                (detail) => {
                    if (String(detail?.type || '').toUpperCase() !== 'IMAGE') {
                        return;
                    }
                    this._refreshOpenWindow();
                }
            );
        }
    }

    dispose() {
        this._removeOpenListener?.();
        this._removeOpenListener = null;
        this._removePayloadListener?.();
        this._removePayloadListener = null;
        this._removeLockListener?.();
        this._removeLockListener = null;
        this.activeWindow = null;
        this.activeContent = null;
    }

    open(metadata = {}) {
        this.windowManager = this.windowManager || Registry.tryGet('WindowManager');
        const domSystem = this.windowManager?.getWindowDOMSystem?.();
        if (!domSystem?.injectWindow) {
            return null;
        }

        this.lastMetadata = metadata;
        const snapshot = this._buildSnapshot(metadata);
        const win = domSystem.injectWindow(WINDOW_APP_ID, {
            ...metadata,
            nodeType: metadata.nodeType ?? 'app',
            appName: metadata.appName ?? 'Gallery',
            parentName: metadata.parentName ?? metadata.appName ?? 'Gallery',
            windowClassName: `is-gallery-app-window ${metadata.windowClassName || ''}`.trim(),
            gallerySnapshot: snapshot,
            customRender: this._boundRender,
        });
        this.activeWindow = win || document.getElementById(this.windowId);
        return win;
    }

    openFromPayload(metadata = {}) {
        return this.open(metadata);
    }

    getDebugState() {
        const activeImage = this.payloadManager?.getActivePayload?.('IMAGE') ?? null;
        return {
            isOpen: !!document.getElementById(this.windowId),
            activeImage: activeImage ? {
                url: activeImage.url,
                label: activeImage.label,
                galleryId: activeImage.galleryId,
                isLocked: this.payloadManager?.isPayloadLocked?.('IMAGE') ?? false,
            } : null,
            payloadCount: GALLERY_IMAGE_PAYLOADS.length,
        };
    }

    _buildSnapshot(metadata = {}) {
        const activeImage = this.payloadManager?.getActivePayload?.('IMAGE') ?? null;
        return {
            title: (metadata.parentName || metadata.appName || 'Gallery').toUpperCase(),
            subtitle: 'Municion visual del sistema operativo espacial',
            activeImage,
            isImageLocked: this.payloadManager?.isPayloadLocked?.('IMAGE') ?? false,
            payloads: GALLERY_IMAGE_PAYLOADS,
        };
    }

    _renderWindow(content, metadata = {}, win = null) {
        const snapshot = metadata.gallerySnapshot ?? this._buildSnapshot(metadata);
        this.lastMetadata = metadata;
        this.activeContent = content;
        this.activeWindow = win || content.closest('.glass-window') || document.getElementById(this.windowId);

        const activeUrl = snapshot.activeImage?.url ?? null;
        const activeLabel = snapshot.activeImage?.label ?? 'Sin payload activo';
        const isImageLocked = !!snapshot.isImageLocked;
        const activeTone = snapshot.activeImage?.galleryId
            ? (snapshot.payloads.find((item) => item.id === snapshot.activeImage.galleryId)?.tone ?? 'Custom')
            : 'Idle';

        content.innerHTML = `
            <div class="module-window module-window-shell gallery-app-window">
                <div class="module-window-hero gallery-window-hero">
                    <span class="module-window-badge">Gallery Payload Deck</span>
                    <div class="module-window-title">${escapeHtml(snapshot.title)}</div>
                    <div class="module-window-copy">${escapeHtml(snapshot.subtitle)}</div>
                </div>

                <div class="gallery-payload-status${isImageLocked ? ' is-locked' : ''}">
                    <div class="gallery-payload-status-copy">
                        <span class="gallery-payload-status-kicker">Payload activo</span>
                        <strong>${escapeHtml(activeLabel)}</strong>
                    </div>
                    <div class="gallery-payload-status-meta">
                        <span>${escapeHtml(activeTone)}</span>
                        <span>${activeUrl ? escapeHtml(activeUrl) : 'Selecciona una imagen para cargar el buffer del OS.'}</span>
                    </div>
                </div>

                ${isImageLocked ? `
                    <div class="gallery-payload-lock-note">
                        SEGURO TACTICO ACTIVO. El kernel rechazara cambios de carga hasta liberar el candado.
                    </div>
                ` : ''}

                <div class="gallery-payload-grid">
                    ${snapshot.payloads.map((payload) => `
                        <button
                            type="button"
                            class="gallery-payload-card${payload.url === activeUrl ? ' is-active' : ''}"
                            data-payload-id="${escapeHtml(payload.id)}"
                            data-payload-url="${escapeHtml(payload.url)}"
                            data-payload-label="${escapeHtml(payload.label)}"
                            data-payload-thumb="${escapeHtml(payload.thumbnailUrl)}">
                            <span class="gallery-payload-thumb">
                                <img src="${escapeHtml(payload.thumbnailUrl)}" alt="${escapeHtml(payload.label)}">
                            </span>
                            <span class="gallery-payload-copy">
                                <strong>${escapeHtml(payload.label)}</strong>
                                <span>${escapeHtml(payload.caption)}</span>
                            </span>
                            <span class="gallery-payload-chip">${escapeHtml(payload.tone)}</span>
                        </button>
                    `).join('')}
                </div>

                <div class="gallery-payload-note">
                    Selecciona una imagen aqui, vuelve al espacio 3D y ejecuta <strong>proyecto particulas</strong>. El enjambre leera el payload activo antes de revelar la textura sobre la masa anfitriona.
                </div>
            </div>
        `;

        content.querySelectorAll('.gallery-payload-card').forEach((button) => {
            button.addEventListener('click', () => {
                const payload = {
                    type: 'IMAGE',
                    data: {
                        url: button.dataset.payloadUrl,
                        thumbnailUrl: button.dataset.payloadThumb,
                        label: button.dataset.payloadLabel,
                        galleryId: button.dataset.payloadId,
                        source: 'gallery-app-window',
                    },
                };
                if (this.runtimeSignals?.emit) {
                    this.runtimeSignals.emit(SET_ACTIVE_PAYLOAD_SIGNAL, payload, { mirrorDom: false });
                } else {
                    this.payloadManager?.setActivePayload?.('IMAGE', payload.data);
                }
                this._refreshOpenWindow();
            });
        });
    }

    _refreshOpenWindow() {
        if (!this.activeContent || !document.getElementById(this.windowId)) {
            this.activeWindow = null;
            this.activeContent = null;
            return;
        }
        this._renderWindow(
            this.activeContent,
            {
                ...(this.lastMetadata ?? {}),
                gallerySnapshot: this._buildSnapshot(this.lastMetadata ?? {}),
            },
            this.activeWindow
        );
    }
}

export default GalleryAppWindow;
