import{r as e}from"./vendor-hLruerWX.js";import{t}from"./ServiceRegistry-CU0F0t6D.js";var n=class{constructor(e){this.kernel=e,this.runtimeState=e?.runtimeState||t.tryGet(`RuntimeState`),this.container=document.getElementById(`pg-root`),this.element=null,this.active=!1,this.profileLabels=new Map,this._selecting=!1,this.pointerPresentation=t.tryGet(`PointerPresentationController`)||t.tryGet(`pointerPresentation`),this._onESC=e=>{if(e.key===`Escape`&&this.active){e.stopImmediatePropagation(),e.preventDefault();let t=this.element?.querySelector(`#pg-pass-modal`);t&&t.style.display!==`none`&&(t.style.display=`none`,this._selecting=!1,this._clearPasswordPointerIntent(),this._restoreMenuPointer())}}}render(){if(this.active)return;this.active=!0,this.runtimeState?.setLoginActive(!0,{source:`initial-menu:render`}),document.body.classList.add(`init-mode-active`),this._upsertPointerIntent(`initial-menu`,{kind:`ui`,cursor:`default`,priority:320,reticleMode:`hidden`}),this._setRaycast(!1),document.addEventListener(`keydown`,this._onESC,!0),this.element=document.createElement(`div`),this.element.id=`initial-menu-overlay`,this.element.setAttribute(`role`,`dialog`),this.element.setAttribute(`aria-modal`,`true`),this.element.setAttribute(`aria-labelledby`,`pg-menu-title`),this.element.setAttribute(`aria-describedby`,`pg-menu-subtitle`),this.element.style.cssText=`
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 5000; /* Priority Alpha mobile fix */
            opacity: 0;
            pointer-events: auto;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
            padding: max(40px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
        `;let t=[{id:`powdertrue`,title:`POWDERTRUE`,description:`Entrada como Dios`,color:`#dffaff`,featured:!0,locked:!0},{id:`artistas`,title:`ARTISTAS`,description:`Sesion creativa`,color:`#b9e8ff`},{id:`clientes`,title:`CLIENTES`,description:`Acceso guiado`,color:`#d9f3ff`},{id:`publico`,title:`PUBLICO`,description:`Modo exploracion`,color:`#eef9ff`},{id:`wallpaper`,title:`FONDO VIVO`,description:`Visual inmersivo`,color:`#f4fbff`},{id:`salir`,title:`SALIR`,description:`Cerrar portal`,color:`#f7fbff`}];this.profileLabels.clear();for(let e=0;e<t.length;e++)this.profileLabels.set(t[e].id,t[e].title);let n=t.map(e=>`
            <button type="button"
                class="menu-item-glass menu-item-${e.id} ${e.featured?`featured`:``}"
                data-id="${e.id}"
                style="--item-color: ${e.color}">
                <span class="menu-copy">
                    ${e.featured?`<span class="menu-tier">Entrada como Dios</span>`:``}
                    <span class="menu-label">${e.title}</span>
                    <span class="menu-meta">${e.description}${e.locked?` 🔐`:``}</span>
                </span>
            </button>
        `).join(``);this.element.innerHTML=`
            <div class="menu-stage" id="pg-menu-stage" style="margin: auto; max-width: 100%;">
                <div class="menu-container">
                    <div class="menu-header">
                        <h1 class="menu-title" id="pg-menu-title">Seleccionar Perfil</h1>
                        <div class="menu-subtitle" id="pg-menu-subtitle">Entrar al universo</div>
                    </div>
                    <div class="menu-grid" id="pg-menu-grid">
                        ${n}
                    </div>
                </div>
            </div>

            <!-- Password modal — position:fixed covers everything including menu items -->
            <div id="pg-pass-modal" style="
                display:none; position:fixed; inset:0; z-index:10000;
                background:rgba(0,0,0,0.82); backdrop-filter:blur(16px);
                align-items:center; justify-content:center; flex-direction:column;"
                role="dialog" aria-modal="true" aria-labelledby="pg-pass-title" aria-describedby="pg-pass-copy">
                <div id="pg-pass-card" style="
                    background:rgba(0,10,20,0.95); border:1px solid rgba(0,255,200,0.35);
                    border-radius:18px; padding:40px 44px; text-align:center;
                    box-shadow:0 0 60px rgba(0,255,200,0.12); min-width:340px;
                    pointer-events:auto;">
                    <div id="pg-pass-copy" style="color:#00ffcc;font-size:11px;letter-spacing:3px;margin-bottom:6px;opacity:0.8;">ACCESO RESTRINGIDO</div>
                    <div id="pg-pass-title" style="color:#fff;font-size:24px;font-weight:700;margin-bottom:22px;letter-spacing:2px;">POWDERTRUE</div>
                    <input id="pg-pass-input" type="password" name="powdertrue-password" aria-label="Contraseña de Powdertrue" placeholder="Contraseña" autocomplete="current-password" spellcheck="false" style="
                        width:100%; padding:13px 18px; border-radius:10px;
                        border:1px solid rgba(0,255,200,0.4); background:rgba(0,20,30,0.85);
                        color:#fff; font-size:15px; outline:none; letter-spacing:3px;
                        box-sizing:border-box; margin-bottom:10px;" />
                    <div id="pg-pass-error" aria-live="polite" style="color:#ff4466;font-size:12px;min-height:18px;margin-bottom:14px;"></div>
                    <div style="display:flex;gap:10px;">
                        <button id="pg-pass-cancel" type="button" style="
                            flex:1; padding:11px; border-radius:9px;
                            border:1px solid rgba(255,255,255,0.15);
                            background:transparent; color:#aaa; cursor:pointer; font-size:13px;">
                            Cancelar
                        </button>
                        <button id="pg-pass-ok" type="button" style="
                            flex:2; padding:11px; border-radius:9px; border:none;
                            background:linear-gradient(135deg,#00ffcc,#0055ff); color:#000;
                            font-weight:800; cursor:pointer; font-size:13px; letter-spacing:1px;">
                            ENTRAR →
                        </button>
                    </div>
                </div>
            </div>
        `,this.container.appendChild(this.element);let r=Array.from(this.element.querySelectorAll(`.menu-item-glass`));this.element.style.opacity=`1`,e.set(r,{autoAlpha:1,y:0,clearProps:`opacity,visibility,transform`}),e.fromTo(this.element.querySelector(`.menu-container`),{autoAlpha:0,y:14,scale:.992},{autoAlpha:1,y:0,scale:1,duration:.32,ease:`power2.out`,clearProps:`opacity,transform`}),this.kernel.navigationSystem&&this.kernel.navigationSystem.enterWallpaperMode?.(),this._bindEvents()}_bindEvents(){this.element.querySelectorAll(`.menu-item-glass`).forEach(t=>{t.addEventListener(`pointerup`,e=>{if(this._selecting)return;let n=this.element.querySelector(`#pg-pass-modal`);if(n&&n.style.display!==`none`)return;e.preventDefault(),e.stopPropagation();let r=t.dataset.id;r===`powdertrue`?this._showPasswordModal():this._handleSelect(r)}),t.addEventListener(`mousemove`,()=>{e.to(t,{y:-2,duration:.18,ease:`power2.out`})}),t.addEventListener(`mouseleave`,()=>{e.to(t,{y:0,duration:.22,ease:`power2.out`})})})}_showPasswordModal(){let t=this.element.querySelector(`#pg-pass-modal`),n=this.element.querySelector(`#pg-pass-input`),r=this.element.querySelector(`#pg-pass-error`),i=this.element.querySelector(`#pg-pass-ok`),a=this.element.querySelector(`#pg-pass-cancel`);this._lockMenuPointer(),t.style.display=`flex`,r.textContent=``,n.value=``,this._upsertPointerIntent(`initial-menu-password`,{kind:`text`,cursor:`text`,priority:420,reticleMode:`hidden`}),setTimeout(()=>n.focus(),80),t.onpointerdown=e=>e.stopPropagation(),t.onpointerup=e=>e.stopPropagation();let o=()=>{n.value===`milulu`?(t.style.display=`none`,this._clearPasswordPointerIntent(),this._restoreMenuPointer(),this._handleSelect(`powdertrue`)):(r.textContent=`Contraseña incorrecta`,n.value=``,n.focus(),e.fromTo(n,{x:-10},{x:0,duration:.45,ease:`elastic.out(1,0.3)`}))};i.onclick=e=>{e.stopPropagation(),o()},a.onclick=e=>{e.stopPropagation(),t.style.display=`none`,this._selecting=!1,this._clearPasswordPointerIntent(),this._restoreMenuPointer()},n.onkeydown=e=>{e.stopPropagation(),e.key===`Enter`&&o()}}_lockMenuPointer(){let e=this.element?.querySelector(`#pg-menu-grid`);e&&(e.style.pointerEvents=`none`)}_restoreMenuPointer(){let e=this.element?.querySelector(`#pg-menu-grid`);e&&(e.style.pointerEvents=`auto`)}_handleSelect(t){if(this._selecting)return;if(this._selecting=!0,t===`salir`){e.to(document.body,{opacity:0,duration:2});return}console.log(`%c[Menu] Selected Protocol: ${t.toUpperCase()}`,`color:#00ffcc;font-weight:bold`);let n=this.profileLabels.get(t)||t,r=t!==`wallpaper`&&!!this.kernel.navigationSystem;if(this.element.style.pointerEvents=`none`,r){let e=this.kernel.navigationSystem,t=this.kernel.cameraRig;if(t){let n=new t.position.constructor(0,0,0);t.position.set(520,10800,4600),typeof e._computeLookQuaternion==`function`?(e._computeLookQuaternion(e.targetQuaternion,t.position,n),t.quaternion.copy(e.targetQuaternion)):this.kernel.camera&&(this.kernel.camera.position.copy(t.position),this.kernel.camera.lookAt(n),t.quaternion.copy(this.kernel.camera.quaternion))}this.runtimeState?.setLoginActive(!1,{source:`initial-menu:handle-select`}),e.setMode?.(`FREE_FLIGHT`,{requestPointerLock:!1}),e.requestPointerLock?.(),e._setFov?.(42,.8,`power2.out`)}document.dispatchEvent(new CustomEvent(`os:login`,{detail:{role:n}})),document.body.classList.remove(`init-mode-active`);let i=document.createElement(`div`);i.style.cssText=`position:fixed;inset:0;background:rgba(255,255,255,0.22);z-index:99999;pointer-events:none;opacity:0`,document.body.appendChild(i),e.fromTo(i,{opacity:.38},{opacity:0,duration:.45,ease:`power2.out`,onComplete:()=>i.remove()}),this.dismiss(!0)}dismiss(t=!1){if(this.element){if(this.element.style.pointerEvents=`none`,document.body.classList.remove(`init-mode-active`),this._clearPointerIntent(`initial-menu`),this._clearPasswordPointerIntent(),this.runtimeState?.setLoginActive(!1,{source:`initial-menu:dismiss`}),this._setRaycast(!0),document.removeEventListener(`keydown`,this._onESC,!0),t){this.element.remove(),this.element=null,this.active=!1;return}e.to(this.element,{opacity:0,duration:.5,ease:`power2.in`,onComplete:()=>{this.element&&this.element.remove(),this.element=null,this.active=!1}})}}_getPointerPresentationController(){return this.pointerPresentation=this.pointerPresentation||t.tryGet(`PointerPresentationController`)||t.tryGet(`pointerPresentation`),this.pointerPresentation}_upsertPointerIntent(e,t){return this._getPointerPresentationController()?.upsertIntent?.(e,t)??null}_clearPointerIntent(e){return this._getPointerPresentationController()?.clearIntent?.(e)??null}_clearPasswordPointerIntent(){this._clearPointerIntent(`initial-menu-password`)}_setRaycast(e){try{let t=this.kernel?.raycastSelectionSystem;if(!t)return;e?t.enable?.():t.disable?.()}catch{}}};export{n as InitialMenu};