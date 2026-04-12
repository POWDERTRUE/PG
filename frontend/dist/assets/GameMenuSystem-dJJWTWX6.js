import{r as e}from"./vendor-hLruerWX.js";import{t}from"./ServiceRegistry-CU0F0t6D.js";import{i as n,o as r,s as i,t as a,u as o}from"./ControlsManifest-B0cSolkq.js";var s=`pg.pause.settings.v2`,c={gameplay:{fieldOfView:42,lookSensitivity:1,invertY:!1,targetFps:60},audio:{master:100,ambience:82,interface:74,transmission:86},interface:{hudOpacity:1,glassOpacity:.45,reticleGlow:1,compactDock:!1,reduceMotion:!1,showNotifications:!0}},l=class{constructor(e){this.kernel=e,this.runtimeState=e?.runtimeState||t.tryGet(`RuntimeState`),this.runtimeSignals=e?.runtimeSignals||t.tryGet(`RuntimeSignals`),this.isOpen=!1,this.menuUI=null,this.activeSection=`gameplay`,this.previousPointerLock=!1,this.previousHudMode=!1,this.pointerPresentation=t.tryGet(`PointerPresentationController`)||t.tryGet(`pointerPresentation`),this.settings=this._loadSettings(),this._onKeyDown=this._onKeyDown.bind(this),this._toggleMenu=()=>this.toggle(),this.runtimeState?.setSettings(this.settings,{source:`game-menu:constructor`}),this._applySettings(),this._removeToggleRequestListener=this.runtimeSignals?.on?.(`PG:UI:REQUEST_GAME_MENU_TOGGLE`,this._toggleMenu)||null,this._removeLegacyToggleListener=this.runtimeSignals?.on?.(`PG:TOGGLE_GAME_MENU`,this._toggleMenu)||null,!this._removeToggleRequestListener&&!this._removeLegacyToggleListener&&(window.addEventListener(`PG:UI:REQUEST_GAME_MENU_TOGGLE`,this._toggleMenu),window.addEventListener(`PG:TOGGLE_GAME_MENU`,this._toggleMenu))}_buildMenu(){if(this.menuUI)return;this.menuUI=document.createElement(`div`),this.menuUI.id=`pg-game-menu`,this.menuUI.className=`pg-pause-menu`,this.menuUI.hidden=!0,this.menuUI.setAttribute(`role`,`dialog`),this.menuUI.setAttribute(`aria-modal`,`true`),this.menuUI.setAttribute(`aria-labelledby`,`pg-pause-title`),this.menuUI.setAttribute(`aria-hidden`,`true`),this.menuUI.innerHTML=`
            <div class="pg-pause-backdrop"></div>
            <div class="pg-pause-shell">
                <aside class="pg-pause-nav">
                    <div class="pg-pause-kicker">Pausa tactica</div>
                    <h1 class="pg-pause-title" id="pg-pause-title">Omega Vista</h1>
                    <p class="pg-pause-copy">La pausa ahora responde como un juego AAA: detiene la accion, devuelve el cursor y concentra todas las opciones del simulador y del sistema operativo del universo.</p>

                    <div class="pg-pause-tabs">
                        <button type="button" class="pg-pause-tab is-active" data-section="gameplay">Juego</button>
                        <button type="button" class="pg-pause-tab" data-section="audio">Audio</button>
                        <button type="button" class="pg-pause-tab" data-section="interface">Interfaz OS</button>
                        <button type="button" class="pg-pause-tab" data-section="controls">Controles</button>
                        <button type="button" class="pg-pause-tab" data-section="system">Sistema</button>
                    </div>

                    <div class="pg-pause-runtime">
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Camara</span>
                            <span class="pg-runtime-value" data-runtime="camera-state">---</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Puntero</span>
                            <span class="pg-runtime-value" data-runtime="pointer-state">---</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Objetivo</span>
                            <span class="pg-runtime-value" data-runtime="focus-target">Sin objetivo</span>
                        </div>
                        <div class="pg-pause-runtime-card">
                            <span class="pg-runtime-key">Paneles</span>
                            <span class="pg-runtime-value" data-runtime="window-count">0</span>
                        </div>
                    </div>

                    <div class="pg-pause-actions">
                        <button type="button" class="pg-pause-action pg-pause-action-primary" data-action="resume">Reanudar</button>
                        <button type="button" class="pg-pause-action" data-action="preset-cinematic">Preset cinematico</button>
                        <button type="button" class="pg-pause-action" data-action="preset-precision">Preset preciso</button>
                        <button type="button" class="pg-pause-action pg-pause-action-danger" data-action="reload">Salir al selector</button>
                    </div>
                </aside>

                <section class="pg-pause-main">
                    <div class="pg-pause-panel is-active" data-panel="gameplay">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Juego</div>
                                <h2 class="pg-panel-title">Camara, vuelo y ritmo</h2>
                            </div>
                            <p class="pg-panel-copy">Ajustes vivos para la sensacion del visor, el encuadre y la suavidad general del universo.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Campo de vision</span>
                                <span class="pg-control-value" data-value-for="gameplay.fieldOfView" data-format="fov"></span>
                                <input type="range" min="36" max="78" step="1" data-setting="gameplay.fieldOfView">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Sensibilidad del mouse</span>
                                <span class="pg-control-value" data-value-for="gameplay.lookSensitivity" data-format="multiplier"></span>
                                <input type="range" min="0.65" max="1.65" step="0.01" data-setting="gameplay.lookSensitivity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Objetivo de FPS</span>
                                <span class="pg-control-value" data-value-for="gameplay.targetFps" data-format="fps"></span>
                                <select data-setting="gameplay.targetFps">
                                    <option value="30">30</option>
                                    <option value="45">45</option>
                                    <option value="60">60</option>
                                    <option value="90">90</option>
                                    <option value="120">120</option>
                                </select>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="gameplay.invertY">
                                <span>Invertir eje vertical</span>
                                <small>Aplica a vuelo libre y cockpit.</small>
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="audio">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Audio</div>
                                <h2 class="pg-panel-title">Mezcla general del simulador</h2>
                            </div>
                            <p class="pg-panel-copy">Preparado para ambience, interfaz y transmisiones tacticas sin salir de la pausa.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Master</span>
                                <span class="pg-control-value" data-value-for="audio.master" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.master">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Ambiente</span>
                                <span class="pg-control-value" data-value-for="audio.ambience" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.ambience">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Interfaz</span>
                                <span class="pg-control-value" data-value-for="audio.interface" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.interface">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Transmisiones</span>
                                <span class="pg-control-value" data-value-for="audio.transmission" data-format="percent"></span>
                                <input type="range" min="0" max="100" step="1" data-setting="audio.transmission">
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="interface">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Interfaz OS</div>
                                <h2 class="pg-panel-title">HUD, dock y capas del sistema</h2>
                            </div>
                            <p class="pg-panel-copy">Opciones de lectura visual inspiradas en una vista en primera persona, amplia y con horizonte limpio.</p>
                        </div>

                        <div class="pg-pause-grid">
                            <label class="pg-pause-control">
                                <span class="pg-control-label">Opacidad HUD</span>
                                <span class="pg-control-value" data-value-for="interface.hudOpacity" data-format="opacity"></span>
                                <input type="range" min="0.55" max="1" step="0.01" data-setting="interface.hudOpacity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Profundidad glass</span>
                                <span class="pg-control-value" data-value-for="interface.glassOpacity" data-format="opacity"></span>
                                <input type="range" min="0.30" max="0.68" step="0.01" data-setting="interface.glassOpacity">
                            </label>

                            <label class="pg-pause-control">
                                <span class="pg-control-label">Brillo de reticula</span>
                                <span class="pg-control-value" data-value-for="interface.reticleGlow" data-format="multiplier"></span>
                                <input type="range" min="0.70" max="1.40" step="0.01" data-setting="interface.reticleGlow">
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.compactDock">
                                <span>Dock compacto</span>
                                <small>Reduce ancho y peso visual del flight deck.</small>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.reduceMotion">
                                <span>Reducir movimiento</span>
                                <small>Suaviza animaciones y baja transiciones decorativas.</small>
                            </label>

                            <label class="pg-pause-toggle">
                                <input type="checkbox" data-setting="interface.showNotifications">
                                <span>Mostrar transmisiones emergentes</span>
                                <small>Controla avisos tacticos del casco y del sistema.</small>
                            </label>
                        </div>
                    </div>

                    <div class="pg-pause-panel" data-panel="controls">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Controles</div>
                                <h2 class="pg-panel-title">Mapa actual del teclado y raton</h2>
                            </div>
                            <p class="pg-panel-copy">El visor contextual pasa a TAB por alternancia. ESC queda reservado para pausa y regreso de menus.</p>
                        </div>

                        <div class="pg-controls-list" data-controls-manifest></div>
                    </div>

                    <div class="pg-pause-panel" data-panel="system">
                        <div class="pg-pause-panel-head">
                            <div>
                                <div class="pg-panel-kicker">Sistema</div>
                                <h2 class="pg-panel-title">Estado en vivo del kernel</h2>
                            </div>
                            <p class="pg-panel-copy">Lectura rapida del perfil de ejecucion actual y accesos directos para dejar el sistema listo.</p>
                        </div>

                        <div class="pg-system-grid">
                            <div class="pg-system-card">
                                <span class="pg-system-key">Perfil GPU</span>
                                <strong class="pg-system-value" data-runtime="gpu-profile">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">FPS target</span>
                                <strong class="pg-system-value" data-runtime="fps-target">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">HUD</span>
                                <strong class="pg-system-value" data-runtime="hud-state">---</strong>
                            </div>
                            <div class="pg-system-card">
                                <span class="pg-system-key">Ventanas</span>
                                <strong class="pg-system-value" data-runtime="window-count-wide">---</strong>
                            </div>
                        </div>

                        <div class="pg-system-actions">
                            <button type="button" class="pg-pause-action" data-action="reset-settings">Restaurar ajustes</button>
                            <button type="button" class="pg-pause-action" data-action="resume">Volver al universo</button>
                        </div>
                    </div>
                </section>
            </div>

            <div class="pg-pause-rail">
                <div class="pg-pause-rail-copy">
                    <span class="pg-pause-rail-kicker">Borde de observacion</span>
                    <span class="pg-pause-rail-text">La pausa respeta la vista amplia: el mundo queda inmovil y el overlay trabaja como una baranda tactica, sin pelear con la escena.</span>
                </div>
                <div class="pg-pause-rail-hints">
                    <span>ESC cierra la pausa</span>
                    <span>TAB alterna el visor libre</span>
                    <span>M abre el mapa</span>
                </div>
            </div>
        `,document.body.appendChild(this.menuUI),this.menuUI.addEventListener(`click`,e=>{let t=e.target.closest(`[data-section]`);if(t){this._setSection(t.dataset.section);return}let n=e.target.closest(`[data-action]`);if(n)switch(n.dataset.action){case`resume`:this.close();break;case`reload`:window.location.reload();break;case`reset-settings`:this.settings=this._cloneDefaults(),this._saveSettings(),this._applySettings(),this._syncForm();break;case`preset-cinematic`:this._applyPreset({gameplay:{fieldOfView:46,lookSensitivity:.92,invertY:!1,targetFps:60},interface:{hudOpacity:.94,glassOpacity:.52,reticleGlow:1.16,compactDock:!1,reduceMotion:!1,showNotifications:!0}});break;case`preset-precision`:this._applyPreset({gameplay:{fieldOfView:40,lookSensitivity:1.08,invertY:!1,targetFps:90},interface:{hudOpacity:.84,glassOpacity:.4,reticleGlow:.94,compactDock:!0,reduceMotion:!1,showNotifications:!0}});break;default:break}});let e=e=>{let t=e.target.closest(`[data-setting]`);if(!t)return;let n=t.dataset.setting,r=t.type===`checkbox`?t.checked:Number(t.value);this._setValue(n,r),this._saveSettings(),this._applySettings(),this._syncForm()};this.menuUI.addEventListener(`input`,e),this.menuUI.addEventListener(`change`,e),this._renderControlsPanel(),this._syncForm()}_cloneDefaults(){return JSON.parse(JSON.stringify(c))}_loadSettings(){try{let e=localStorage.getItem(s);if(!e)return this._cloneDefaults();let t=JSON.parse(e);return{gameplay:{...c.gameplay,...t.gameplay||{}},audio:{...c.audio,...t.audio||{}},interface:{...c.interface,...t.interface||{}}}}catch{return this._cloneDefaults()}}_saveSettings(){localStorage.setItem(s,JSON.stringify(this.settings))}_setValue(e,t){let[n,r]=e.split(`.`);!n||!r||!this.settings[n]||(this.settings[n][r]=t)}_getValue(e){let[t,n]=e.split(`.`);return this.settings?.[t]?.[n]}_applyPreset(e){this.settings={gameplay:{...this.settings.gameplay,...e.gameplay||{}},audio:{...this.settings.audio,...e.audio||{}},interface:{...this.settings.interface,...e.interface||{}}},this._saveSettings(),this._applySettings(),this._syncForm()}_applySettings(){this.runtimeState?.setSettings(this.settings,{source:`game-menu:apply-settings`});let e=document.documentElement,t=this.settings.interface;e.style.setProperty(`--pg-hud-opacity`,`${t.hudOpacity}`),e.style.setProperty(`--silicon-blue`,`rgba(0, 40, 80, ${t.glassOpacity})`),e.style.setProperty(`--pg-reticle-glow`,`${t.reticleGlow}`),document.body.classList.toggle(`pg-compact-dock`,!!t.compactDock),document.body.classList.toggle(`pg-reduced-motion`,!!t.reduceMotion),document.body.classList.toggle(`pg-notifications-muted`,!t.showNotifications);let n=this.settings.gameplay;this.kernel?.renderPipeline?.setTargetFPS?.(Number(n.targetFps)||60);let r=this.kernel?.navigationSystem;if(r){r.defaultFov=Number(n.fieldOfView)||42,r.targetFov=r.defaultFov,r.lookSensitivity=.0018*(Number(n.lookSensitivity)||1);let e=r.fsm?.states?.get?.(`FREE_FLIGHT`);e&&(e._baseFov=r.defaultFov),r.state!==`WARP`&&r.state!==`WARPING`&&r.state!==`ORBITAL_DESCENT`&&r._setFov?.(r.defaultFov,document.body.classList.contains(`pg-reduced-motion`)?.01:.28,`power2.out`)}let i=(Number(this.settings.audio.master)||0)/100;document.querySelectorAll(`audio, video`).forEach(e=>{let t=e.dataset.audioChannel||`ambience`,n=(Number(this.settings.audio[t])||100)/100;e.volume=Math.max(0,Math.min(1,i*n))})}_syncForm(){this.menuUI&&(this.menuUI.querySelectorAll(`[data-setting]`).forEach(e=>{let t=this._getValue(e.dataset.setting);e.type===`checkbox`?e.checked=!!t:e.value=`${t}`}),this.menuUI.querySelectorAll(`[data-value-for]`).forEach(e=>{let t=e.dataset.valueFor,n=this._getValue(t);e.textContent=this._formatValue(n,e.dataset.format||`raw`)}),this._refreshRuntimeCards())}_renderControlsPanel(){if(!this.menuUI)return;let e=this.menuUI.querySelector(`[data-controls-manifest]`);if(!e)return;let t={[a.SYSTEM]:`Sistema y navegacion global`,[a.FLIGHT]:`Vuelo libre`,[a.COCKPIT]:`Modo cockpit`,[a.INTERACTION]:`Interaccion y contexto`};e.innerHTML=n.filter(e=>e!==a.DEBUG).map(e=>{let n=o(e);if(!n.length)return``;let a=n.map(e=>`
                        <div class="pg-controls-row">
                            <span>${e.label} <small>[${i(e)}]</small></span>
                            <strong>${r(e)}</strong>
                        </div>
                        <div class="pg-controls-row pg-controls-row-copy">
                            <span>${e.description}</span>
                            <strong>${Array.isArray(e.source)?e.source.join(`, `):e.source}</strong>
                        </div>
                    `).join(``);return`
                    <div class="pg-controls-group">
                        <div class="pg-controls-group-title">${t[e]||e}</div>
                        ${a}
                    </div>
                `}).join(``)}_formatValue(e,t){switch(t){case`fov`:return`${Math.round(e)} deg`;case`fps`:return`${Math.round(e)} FPS`;case`percent`:return`${Math.round(e)}%`;case`opacity`:return`${Math.round(Number(e)*100)}%`;case`multiplier`:return`${Number(e).toFixed(2)}x`;default:return`${e}`}}_refreshRuntimeCards(){if(!this.menuUI)return;let e=this.kernel?.navigationSystem,t=this.kernel?.inputStateSystem,n=this.kernel?.hudManager?.windowTelemetry?.open?.size??0,r=this.kernel?.hudManager?.windowTelemetry?.minimized?.size??0,i=Math.max(0,n-r),a=e?.focusTarget?.userData?.label||e?.focusTarget?.userData?.appName||e?.focusTarget?.name||this.kernel?.interactionSystem?.getActiveTarget?.()?.name||`Sin objetivo`,o=this._getPointerPresentationController()?.getSnapshot?.()??null,s=o?.state===`flight-locked`?`LOCK`:o?.state===`flight-pending-lock`?`PEND`:o?.state===`text-visible`?`TEXTO`:o?.state===`drag-visible`?`DRAG`:`CURSOR`,c={"camera-state":e?.getPresentationMode?.()||e?.state||`OFFLINE`,"pointer-state":s,"focus-target":a,"window-count":`${i}/${n}`,"gpu-profile":this.kernel?.engineProfile||`standard`,"fps-target":`${this.kernel?.renderPipeline?.targetFPS||this.settings.gameplay.targetFps} FPS`,"hud-state":t?.hudMode?`TAB activo`:`Visor cerrado`,"window-count-wide":`${i} visibles / ${n} totales`};Object.entries(c).forEach(([e,t])=>{let n=this.menuUI.querySelector(`[data-runtime="${e}"]`);n&&(n.textContent=t)})}_setSection(e){this.activeSection=e,this.menuUI?.querySelectorAll(`[data-section]`).forEach(t=>{t.classList.toggle(`is-active`,t.dataset.section===e)}),this.menuUI?.querySelectorAll(`[data-panel]`).forEach(t=>{t.classList.toggle(`is-active`,t.dataset.panel===e)})}_onKeyDown(e){!this.isOpen||e.code!==`Escape`||(e.preventDefault(),e.stopPropagation(),e.stopImmediatePropagation?.(),e.repeat||this.close())}toggle(){this.isOpen?this.close():this.open()}open(t=`gameplay`){this._buildMenu(),this._setSection(t),this._syncForm(),this.previousPointerLock=!!document.pointerLockElement,this.previousHudMode=!!this.kernel?.inputStateSystem?.hudMode,this.kernel.isPaused=!0,this.isOpen=!0,this.runtimeState?.setGamePaused(!0,{source:`game-menu:open`}),document.body.classList.add(`pg-game-paused`),this.runtimeSignals?.emit?.(`PG:GAME_PAUSE_STATE`,{active:!0,source:`game-menu`}),this._upsertPointerIntent(`game-menu`,{kind:`ui`,cursor:`default`,priority:340,reticleMode:`hidden`}),this._getPointerPresentationController()?.releasePointerLock?.({reason:`game-menu-open`}),this.menuUI.hidden=!1,this.menuUI.setAttribute(`aria-hidden`,`false`),this.menuUI.style.pointerEvents=`auto`,window.addEventListener(`keydown`,this._onKeyDown,!0),e.killTweensOf(this.menuUI),e.set(this.menuUI,{opacity:1}),e.fromTo(this.menuUI.querySelector(`.pg-pause-shell`),{y:24,opacity:0},{y:0,opacity:1,duration:.34,ease:`power3.out`}),e.fromTo(this.menuUI.querySelector(`.pg-pause-rail`),{y:26,opacity:0},{y:0,opacity:1,duration:.38,ease:`power2.out`,delay:.06})}close(){if(!this.isOpen)return;let t=this.previousPointerLock&&!this.previousHudMode&&!(this.runtimeState?.isLoginActive?.()??!!window.__loginActive)&&this.kernel?.navigationSystem?.state!==`MOUSE_UI`;this.kernel.isPaused=!1,this.isOpen=!1,this.runtimeState?.setGamePaused(!1,{source:`game-menu:close`}),document.body.classList.remove(`pg-game-paused`),this.runtimeSignals?.emit?.(`PG:GAME_PAUSE_STATE`,{active:!1,source:`game-menu`}),this._clearPointerIntent(`game-menu`),this.menuUI.style.pointerEvents=`none`,window.removeEventListener(`keydown`,this._onKeyDown,!0),t&&this.kernel?.navigationSystem?.requestPointerLock?.(),e.killTweensOf(this.menuUI),e.to(this.menuUI,{opacity:0,duration:.2,ease:`power2.inOut`,onComplete:()=>{this.menuUI.hidden=!0,this.menuUI.setAttribute(`aria-hidden`,`true`),this.menuUI.style.opacity=`1`}})}_getPointerPresentationController(){return this.pointerPresentation=this.pointerPresentation||t.tryGet(`PointerPresentationController`)||t.tryGet(`pointerPresentation`),this.pointerPresentation}_upsertPointerIntent(e,t){return this._getPointerPresentationController()?.upsertIntent?.(e,t)??null}_clearPointerIntent(e){return this._getPointerPresentationController()?.clearIntent?.(e)??null}};export{l as GameMenuSystem};