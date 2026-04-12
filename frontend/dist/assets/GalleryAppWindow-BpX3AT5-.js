import{t as e}from"./ServiceRegistry-CU0F0t6D.js";import{t}from"./GalleryPayloadCatalog-BLhLvj7I.js";var n=`gallery`,r=`os-window-${n}`,i=`PG:OS:SET_ACTIVE_PAYLOAD`,a=`PG:OS:ACTIVE_PAYLOAD_CHANGED`,o=`PG:OS:PAYLOAD_LOCK_CHANGED`,s=`PG:UI:OPEN_GALLERY_APP`;function c(e=``){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}var l=class{constructor(t){this.kernel=t,this.runtimeSignals=e.tryGet(`RuntimeSignals`),this.windowManager=e.tryGet(`WindowManager`),this.payloadManager=e.tryGet(`PayloadManager`),this.windowId=r,this.activeWindow=null,this.activeContent=null,this.lastMetadata=null,this._removeOpenListener=null,this._removePayloadListener=null,this._removeLockListener=null,this._boundRender=this._renderWindow.bind(this)}init(){this.runtimeSignals=this.runtimeSignals||e.tryGet(`RuntimeSignals`),this.windowManager=this.windowManager||e.tryGet(`WindowManager`),this.payloadManager=this.payloadManager||e.tryGet(`PayloadManager`),this.runtimeSignals?.on&&!this._removeOpenListener&&(this._removeOpenListener=this.runtimeSignals.on(s,e=>this.open(e))),this.runtimeSignals?.on&&!this._removePayloadListener&&(this._removePayloadListener=this.runtimeSignals.on(a,e=>{String(e?.type||``).toUpperCase()===`IMAGE`&&this._refreshOpenWindow()})),this.runtimeSignals?.on&&!this._removeLockListener&&(this._removeLockListener=this.runtimeSignals.on(o,e=>{String(e?.type||``).toUpperCase()===`IMAGE`&&this._refreshOpenWindow()}))}dispose(){this._removeOpenListener?.(),this._removeOpenListener=null,this._removePayloadListener?.(),this._removePayloadListener=null,this._removeLockListener?.(),this._removeLockListener=null,this.activeWindow=null,this.activeContent=null}open(t={}){this.windowManager=this.windowManager||e.tryGet(`WindowManager`);let r=this.windowManager?.getWindowDOMSystem?.();if(!r?.injectWindow)return null;this.lastMetadata=t;let i=this._buildSnapshot(t),a=r.injectWindow(n,{...t,nodeType:t.nodeType??`app`,appName:t.appName??`Gallery`,parentName:t.parentName??t.appName??`Gallery`,windowClassName:`is-gallery-app-window ${t.windowClassName||``}`.trim(),gallerySnapshot:i,customRender:this._boundRender});return this.activeWindow=a||document.getElementById(this.windowId),a}openFromPayload(e={}){return this.open(e)}getDebugState(){let e=this.payloadManager?.getActivePayload?.(`IMAGE`)??null;return{isOpen:!!document.getElementById(this.windowId),activeImage:e?{url:e.url,label:e.label,galleryId:e.galleryId,isLocked:this.payloadManager?.isPayloadLocked?.(`IMAGE`)??!1}:null,payloadCount:t.length}}_buildSnapshot(e={}){let n=this.payloadManager?.getActivePayload?.(`IMAGE`)??null;return{title:(e.parentName||e.appName||`Gallery`).toUpperCase(),subtitle:`Municion visual del sistema operativo espacial`,activeImage:n,isImageLocked:this.payloadManager?.isPayloadLocked?.(`IMAGE`)??!1,payloads:t}}_renderWindow(e,t={},n=null){let r=t.gallerySnapshot??this._buildSnapshot(t);this.lastMetadata=t,this.activeContent=e,this.activeWindow=n||e.closest(`.glass-window`)||document.getElementById(this.windowId);let a=r.activeImage?.url??null,o=r.activeImage?.label??`Sin payload activo`,s=!!r.isImageLocked,l=r.activeImage?.galleryId?r.payloads.find(e=>e.id===r.activeImage.galleryId)?.tone??`Custom`:`Idle`;e.innerHTML=`
            <div class="module-window module-window-shell gallery-app-window">
                <div class="module-window-hero gallery-window-hero">
                    <span class="module-window-badge">Gallery Payload Deck</span>
                    <div class="module-window-title">${c(r.title)}</div>
                    <div class="module-window-copy">${c(r.subtitle)}</div>
                </div>

                <div class="gallery-payload-status${s?` is-locked`:``}">
                    <div class="gallery-payload-status-copy">
                        <span class="gallery-payload-status-kicker">Payload activo</span>
                        <strong>${c(o)}</strong>
                    </div>
                    <div class="gallery-payload-status-meta">
                        <span>${c(l)}</span>
                        <span>${a?c(a):`Selecciona una imagen para cargar el buffer del OS.`}</span>
                    </div>
                </div>

                ${s?`
                    <div class="gallery-payload-lock-note">
                        SEGURO TACTICO ACTIVO. El kernel rechazara cambios de carga hasta liberar el candado.
                    </div>
                `:``}

                <div class="gallery-payload-grid">
                    ${r.payloads.map(e=>`
                        <button
                            type="button"
                            class="gallery-payload-card${e.url===a?` is-active`:``}"
                            data-payload-id="${c(e.id)}"
                            data-payload-url="${c(e.url)}"
                            data-payload-label="${c(e.label)}"
                            data-payload-thumb="${c(e.thumbnailUrl)}">
                            <span class="gallery-payload-thumb">
                                <img src="${c(e.thumbnailUrl)}" alt="${c(e.label)}">
                            </span>
                            <span class="gallery-payload-copy">
                                <strong>${c(e.label)}</strong>
                                <span>${c(e.caption)}</span>
                            </span>
                            <span class="gallery-payload-chip">${c(e.tone)}</span>
                        </button>
                    `).join(``)}
                </div>

                <div class="gallery-payload-note">
                    Selecciona una imagen aqui, vuelve al espacio 3D y ejecuta <strong>proyecto particulas</strong>. El enjambre leera el payload activo antes de revelar la textura sobre la masa anfitriona.
                </div>
            </div>
        `,e.querySelectorAll(`.gallery-payload-card`).forEach(e=>{e.addEventListener(`click`,()=>{let t={type:`IMAGE`,data:{url:e.dataset.payloadUrl,thumbnailUrl:e.dataset.payloadThumb,label:e.dataset.payloadLabel,galleryId:e.dataset.payloadId,source:`gallery-app-window`}};this.runtimeSignals?.emit?this.runtimeSignals.emit(i,t,{mirrorDom:!1}):this.payloadManager?.setActivePayload?.(`IMAGE`,t.data),this._refreshOpenWindow()})})}_refreshOpenWindow(){if(!this.activeContent||!document.getElementById(this.windowId)){this.activeWindow=null,this.activeContent=null;return}this._renderWindow(this.activeContent,{...this.lastMetadata??{},gallerySnapshot:this._buildSnapshot(this.lastMetadata??{})},this.activeWindow)}};export{l as GalleryAppWindow,l as default};