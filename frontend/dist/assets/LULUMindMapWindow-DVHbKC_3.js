import{t as e}from"./ServiceRegistry-CU0F0t6D.js";import{n as t,p as n,s as r,t as i,u as a}from"./LULUCanon-ZNRMW4JC.js";var o=`PG:UI:OPEN_ONTOLOGY_MAP`,s=`PG:UI:LULU_SCAN_REFRESH_REQUESTED`,c=`ontology-map`,l=`os-window-${c}`,u=1e3,d=560,f=Object.freeze([Object.freeze({id:`kernel`,label:`Kernel Plane`,z:-720,depth:.42}),Object.freeze({id:`simulation`,label:`Simulation Plane`,z:-180,depth:.72}),Object.freeze({id:`interface`,label:`Interface Plane`,z:260,depth:1})]);function p(e=``){return String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}function m(e){if(!e||typeof e.values!=`function`)return 0;let t=0;for(let n of e.values())n?.booted&&t++;return t}function h(e,t){let n=e.x/100*u,r=e.y/100*d,i=t.x/100*u,a=t.y/100*d,o=i-n,s=Math.abs((e.depth||0)-(t.depth||0)),c=42+Math.abs(o)*.12+s*120,l=n+o*.22,f=r-c,p=n+o*.78,m=a-c;return`M ${n.toFixed(2)} ${r.toFixed(2)} C ${l.toFixed(2)} ${f.toFixed(2)}, ${p.toFixed(2)} ${m.toFixed(2)}, ${i.toFixed(2)} ${a.toFixed(2)}`}var g=class{constructor(t){this.kernel=t,this.runtimeSignals=e.tryGet(`RuntimeSignals`),this.windowManager=e.tryGet(`WindowManager`),this.inputState=e.tryGet(`InputStateSystem`),this.windowId=l,this.lastSnapshot=null,this.activeWindow=null,this.activeContent=null,this.universeContainer=null,this.inspectorPanel=null,this._spatialGraph=null,this._tiltX=0,this._tiltY=0,this._spotX=50,this._spotY=50,this._parallaxStrength=11,this._hoverNodeId=null,this._pinnedNodeId=null,this._removeOpenListener=null,this._boundRender=this._renderWindow.bind(this)}init(){this.runtimeSignals=this.runtimeSignals||e.tryGet(`RuntimeSignals`),this.windowManager=this.windowManager||e.tryGet(`WindowManager`),this.inputState=this.inputState||e.tryGet(`InputStateSystem`),this._removeOpenListener=this.runtimeSignals?.on?.(o,()=>this.open())??null,this._removeScarRefreshListener=this.runtimeSignals?.on?.(s,()=>{document.getElementById(this.windowId)&&this.open()})??null}dispose(){this._removeOpenListener?.(),this._removeOpenListener=null,this._removeScarRefreshListener?.(),this._removeScarRefreshListener=null,this.activeWindow=null,this.activeContent=null,this.universeContainer=null,this.inspectorPanel=null,this._spatialGraph=null}update(t){if((!this.activeWindow?.isConnected||!this.universeContainer)&&(this.activeWindow=document.getElementById(this.windowId),!this.activeWindow)){this.activeContent=null,this.universeContainer=null,this.inspectorPanel=null;return}this.inputState=this.inputState||e.tryGet(`InputStateSystem`);let n=this.inputState?.getSharedCursorNDC?.()??this.inputState?.sharedCursorNDC??null;if(!n)return;let r=1-Math.exp(-5.8*Math.max(.001,t||.016)),i=n.y*this._parallaxStrength,a=n.x*(this._parallaxStrength+1.5);this._tiltX+=(i-this._tiltX)*r,this._tiltY+=(a-this._tiltY)*r,this._spotX+=((n.x+1)*.5*100-this._spotX)*r,this._spotY+=((1-(n.y+1)*.5)*100-this._spotY)*r,this.universeContainer.style.transform=`rotateX(${this._tiltX.toFixed(2)}deg) rotateY(${this._tiltY.toFixed(2)}deg)`,this.universeContainer.style.setProperty(`--ontology-cursor-x`,`${this._spotX.toFixed(2)}%`),this.universeContainer.style.setProperty(`--ontology-cursor-y`,`${this._spotY.toFixed(2)}%`)}open(){this.windowManager=this.windowManager||e.tryGet(`WindowManager`);let t=this.windowManager?.getWindowDOMSystem?.();if(!t?.injectWindow)return null;let n=this._buildSnapshot();this.lastSnapshot=n,this._spatialGraph=n.spatial;let r=t.injectWindow(c,{nodeType:`ontology-map`,appName:`LULU Ontology`,parentName:`LULU Ontology`,windowClassName:`is-ontology-map-window`,ontologySnapshot:n,customRender:this._boundRender});return r?.classList?.add(`is-ontology-map-window`),this.activeWindow=r||document.getElementById(this.windowId),r}getDebugState(){let e=this.lastSnapshot;return{isOpen:!!document.getElementById(this.windowId),rootCount:e?.tree?.length??0,wisdomDisciplines:e?.metrics?.disciplines??0,services:e?.metrics?.services??0,spatialNodeCount:e?.spatial?.nodes?.length??0,focusedNode:this._hoverNodeId||this._pinnedNodeId||null}}_buildSnapshot(){let i=this.kernel?.bootGraph?.systems,o=a(),s=this.kernel?.galaxyGenSystem?.getNamedSystemDescriptors?.()?.length??n.visibleScenario?.namedSystems?.count??0,c=this.kernel?.sectorStreamingSystem?.activeSectors?.size??this.kernel?.sectorStreamingSystem?.loadedSectorCount??0,l=e._services?.size??0,u=(e.tryGet(`PersistenceSystem`)??e.tryGet(`persistenceSystem`))?._planetaryScars?.size??0,d={kernelState:this.kernel?.state??`OFFLINE`,services:l,booted:m(i),bootNodes:i?.size??0,wisdomEntries:r.length,disciplines:o.length,documents:t.length,namedSystems:s,mainStars:n.totalMainStars,activeSectors:c,scarCount:u},f={title:`LULU OMEGA V31`,subtitle:`Topologia ontologica del sistema operativo espacial`,metrics:d,tree:[this._buildRuntimeBranch(d),this._buildVisibleUniverseBranch(d),this._buildWisdomBranch(o),this._buildDocsBranch()]};return f.spatial=this._buildSpatialGraph(f),f}_buildRuntimeBranch(e){return{label:`Motor y Runtime`,badge:`${e.services} servicios`,meta:`${e.booted}/${e.bootNodes} nodos booted`,open:!0,children:[{label:`Core y Runtime`,services:[{key:`RuntimeState`,label:`RuntimeState`},{key:`RuntimeSignals`,label:`RuntimeSignals`},{key:`RenderPipeline`,label:`RenderPipeline`},{key:`FrameGraph`,label:`FrameGraph`},{key:`SceneGraph`,label:`SceneGraph`},{key:`camera`,label:`MainCamera`},{key:`cameraRig`,bootKey:`CameraRig`,label:`CameraRig`},{key:`scheduler`,label:`FrameScheduler`}]},{label:`Fisica y Espacio`,services:[{key:`CelestialRegistry`,label:`CelestialRegistry`},{key:`orbitalMechanics`,bootKey:`OrbitalMechanicsSystem`,label:`OrbitalMechanicsSystem`},{key:`floatingOrigin`,bootKey:`FloatingOriginSystem`,label:`FloatingOriginSystem`},{key:`StellarLODSystem`,label:`StellarLODSystem`},{key:`ProjectParticlesSystem`,label:`ProjectParticlesSystem`},{key:`PersistenceSystem`,label:`PersistenceSystem`},{key:`SectorStreamingSystem`,label:`UniverseStreamingSystem`}]},{label:`Navegacion e Interaccion`,services:[{key:`navigationSystem`,bootKey:`UniverseNavigationSystem`,label:`UniverseNavigationSystem`},{key:`inputStateSystem`,bootKey:`InputStateSystem`,label:`InputStateSystem`},{key:`raycastSelectionSystem`,bootKey:`RaycastSelectionSystem`,label:`RaycastSelectionSystem`},{key:`PointerPresentationController`,label:`PointerPresentationController`},{key:`aimRaySystem`,bootKey:`AimRaySystem`,label:`AimRaySystem`},{key:`landingSystem`,bootKey:`LandingSystem`,label:`LandingSystem`}]},{label:`UI y LULU`,services:[{key:`HUDManager`,label:`HUDManager`},{key:`WindowManager`,label:`WindowManager`},{key:`WorkspaceManager`,label:`WorkspaceManager`},{key:`GameMenuSystem`,label:`GameMenuSystem`},{key:`LULUContextualHUD`,label:`LULUContextualHUD`},{key:`luluSpawner`,label:`LULUSpatialObjectSpawnerSystem`},{key:`TacticalContextMenuSystem`,label:`TacticalContextMenuSystem`},{key:`LuluScannerSystem`,label:`LuluScannerSystem`}]}].map(e=>{let t=e.services.map(e=>this._makeServiceLeaf(e)),n=t.filter(e=>e.badge===`READY`).length;return{label:e.label,badge:`${n}/${t.length}`,meta:`sistemas anclados`,open:!0,children:t}})}}_buildVisibleUniverseBranch(e){let t=n.visibleScenario?.observerSystem??{},r=n.visibleScenario?.namedSystems??{};return{label:`Escenario Visible`,badge:`${e.namedSystems} sistemas`,meta:`${e.activeSectors} sectores activos`,open:!0,children:[{label:`Topologia galactica`,badge:`${n.armCount} brazos`,meta:`${e.mainStars} estrellas`,open:!0,children:[{label:`Disco principal`,badge:`${n.diskRadius}u`,meta:`halo ${n.haloRadius}u`},{label:`Visible scenario`,badge:`${r.count??0} nodos`,meta:`radio ${r.systemRadiusMin??0}-${r.systemRadiusMax??0}`},{label:`LOD estelar`,badge:`Proxy + detalle`,meta:`enter ${r.lod?.localEnterDistance??0} / fade ${r.lod?.proxyFadeStartDistance??0}`}]},{label:`Sistema del observador`,badge:`${i.solarSystem.planets.length} planetas`,meta:`sun r=${i.solarSystem.sunRadius}`,open:!0,children:[{label:`Envelope orbital`,badge:`${t.boundaryRadius??0}u`,meta:`halo ${t.haloRadius??0}u`},{label:`Posicion de entrada`,badge:`${t.position?.x??0}, ${t.position?.y??0}, ${t.position?.z??0}`,meta:`observer anchor`},...i.solarSystem.planets.slice(0,6).map(e=>({label:e.name,badge:`${e.className}`,meta:`orbita ${e.orbitRadius}u`}))]}]}}_buildWisdomBranch(e){return{label:`Fuente de Sabiduria`,badge:`${r.length} nodos`,meta:`${e.length} disciplinas`,open:!0,children:e.map(e=>({label:e.discipline,badge:`${e.count}`,meta:`nodos canonicos`,open:e.count<=4,children:r.filter(t=>t.discipline===e.discipline).slice(0,4).map(e=>({label:e.title,badge:e.status,meta:e.nature}))}))}}_buildDocsBranch(){return{label:`Canon Documental`,badge:`${t.length} fuentes`,meta:`rutas trazables`,open:!1,children:[{label:`Album Universal`,matcher:e=>e.path.startsWith(`ALBUM_UNIVERSAL/`)},{label:`Biblia LULU`,matcher:e=>e.path.startsWith(`LULU_UNIVERSE_BIBLE`)},{label:`Protocolos y roadmap`,matcher:e=>!e.path.startsWith(`ALBUM_UNIVERSAL/`)&&!e.path.startsWith(`LULU_UNIVERSE_BIBLE`)}].map(e=>{let n=t.filter(e.matcher);return{label:e.label,badge:`${n.length}`,meta:`documentos`,open:!1,children:n.slice(0,8).map(e=>({label:e.title,badge:e.tags?.[0]??`doc`,meta:e.path}))}})}}_buildSpatialGraph(e){let t=e.metrics,n=[{id:`kernel`,layer:`kernel`,x:14,y:28,label:`Kernel`,badge:t.kernelState,meta:`${t.booted}/${t.bootNodes} nodos`,summary:`Secuencia de boot, ownership del runtime y montaje de escena.`,dependencies:[`runtime-signals`,`render-pipeline`,`scene-graph`,`scheduler`]},{id:`runtime-signals`,layer:`kernel`,x:39,y:18,label:`RuntimeSignals`,badge:`bridge`,meta:`EventBus + DOM`,summary:`Canal semantico entre UI, navegacion, LULU y diagnostico.`,dependencies:[`render-pipeline`,`window-os`,`lulu-brain`]},{id:`render-pipeline`,layer:`kernel`,x:67,y:26,label:`RenderPipeline`,badge:`draw`,meta:`FrameGraph / post`,summary:`Ordena render, postproceso y capas visibles del universo.`,dependencies:[`scene-graph`,`stellar-lod`,`window-os`]},{id:`scene-graph`,layer:`kernel`,x:84,y:46,label:`SceneGraph`,badge:`space`,meta:`camera + rig`,summary:`Espina dorsal espacial donde viven masas, proxies y el observer system.`,dependencies:[`visible-scenario`,`observer-system`,`physics-core`]},{id:`scheduler`,layer:`kernel`,x:28,y:54,label:`FrameScheduler`,badge:`ticks`,meta:`input/ui/nav`,summary:`Distribuye fases y orden de actualizacion del OS y la simulacion.`,dependencies:[`navigation-core`,`lulu-brain`]},{id:`physics-core`,layer:`simulation`,x:16,y:34,label:`Physics Core`,badge:`dual`,meta:`RK4 + semi-implicit`,summary:`Fisica orbital y floating origin con constantes inyectadas.`,dependencies:[`visible-scenario`,`observer-system`]},{id:`navigation-core`,layer:`simulation`,x:39,y:48,label:`Navigation`,badge:`6DoF`,meta:`focus / warp`,summary:`Camara, precision travel, cockpit y contextos de vuelo.`,dependencies:[`observer-system`,`window-os`]},{id:`visible-scenario`,layer:`simulation`,x:58,y:22,label:`Visible Scenario`,badge:`${t.namedSystems}`,meta:`named systems`,summary:`GalaxyGenerationSystem teje sistemas visibles y el observer envelope.`,dependencies:[`stellar-lod`,`observer-system`]},{id:`stellar-lod`,layer:`simulation`,x:78,y:38,label:`Stellar LOD`,badge:`proxy`,meta:`instanced mesh`,summary:`Proxy lejanos y detalle local con histeresis y fade limpio.`,dependencies:[`window-os`]},{id:`observer-system`,layer:`simulation`,x:62,y:58,label:`Observer System`,badge:`${i.solarSystem.planets.length} planetas`,meta:`SolarSystem_Core`,summary:`Sistema del observador, ancla local y envelope orbital.`,dependencies:[`window-os`,`wisdom-library`]},{id:`window-os`,layer:`interface`,x:21,y:36,label:`Window OS`,badge:`glass`,meta:`WindowDOMSystem`,summary:`Workspace 2D sobre el universo, docking HUD y apps del sistema.`,dependencies:[`ontology-map`,`docs-canon`]},{id:`lulu-brain`,layer:`interface`,x:48,y:24,label:`LULU Brain`,badge:`adaptive`,meta:`processor`,summary:`Procesa lenguaje natural, rutas documentales y activacion de herramientas.`,dependencies:[`wisdom-library`,`docs-canon`,`ontology-map`]},{id:`wisdom-library`,layer:`interface`,x:73,y:28,label:`Wisdom Library`,badge:`${t.wisdomEntries}`,meta:`${t.disciplines} disciplinas`,summary:`Biblioteca numerica de fisica, biologia, consciencia, logica y etica.`,dependencies:[`ontology-map`]},{id:`docs-canon`,layer:`interface`,x:82,y:54,label:`Canon Docs`,badge:`${t.documents}`,meta:`album + biblia`,summary:`Mapa documental que guia la evolucion arquitectonica del motor.`,dependencies:[`ontology-map`]},{id:`ontology-map`,layer:`interface`,x:45,y:60,label:`Ontology View`,badge:`2.5D`,meta:`parallax`,summary:`Vista espacial del cerebro del OS: capas, enlaces y foco contextual.`,dependencies:[]},{id:`scar-memory`,layer:`simulation`,x:46,y:72,label:`Scar Memory`,badge:t.scarCount>0?`${t.scarCount} cicatrices`:`PRISTINE`,meta:`PersistenceSystem`,summary:`Registro persistente de impactos del enjambre balístico. Cada cicatriz sobrevive recargas y altera la integridad de la masa en el Escáner LULU.`,dependencies:[`observer-system`,`lulu-brain`,`window-os`]}],r=Object.fromEntries(f.map(e=>[e.id,e])),a=n.map(e=>({...e,depth:r[e.layer]?.depth??0,z:r[e.layer]?.z??0})),o=Object.fromEntries(a.map(e=>[e.id,e])),s=[];for(let e of a)for(let t of e.dependencies){let n=o[t];n&&s.push({id:`${e.id}__${t}`,from:e.id,to:t,fromLayer:e.layer,toLayer:n.layer,path:h(e,n)})}return{layers:f.map(e=>({...e,nodes:a.filter(t=>t.layer===e.id)})),nodes:a,links:s}}_makeServiceLeaf({key:t,label:n,bootKey:r=null}){let i=e.tryGet(t)??this.kernel?.[t]??null,a=this.kernel?.bootGraph?.systems?.get?.(r||t)??null;return{label:n,badge:i?a?.booted===!1?`PENDING`:`READY`:`OFFLINE`,meta:i?.constructor?.name??`sin enlace`}}_renderWindow(e,t){let r=t?.ontologySnapshot??this._buildSnapshot();this.lastSnapshot=r,this._spatialGraph=r.spatial,e.innerHTML=`
            <div class="module-window module-window-shell ontology-window">
                <div class="module-window-hero ontology-window-hero">
                    <span class="module-window-badge">Visualizador Ontologico</span>
                    <div class="module-window-title">${p(r.title)}</div>
                    <div class="module-window-copy">${p(r.subtitle)}</div>
                </div>

                <div class="ontology-toolbar">
                    <div class="ontology-toolbar-actions">
                        <button type="button" class="ontology-action" data-action="expand-all">Expandir</button>
                        <button type="button" class="ontology-action" data-action="collapse-all">Contraer</button>
                        <button type="button" class="ontology-action ontology-action-primary" data-action="refresh">Recompilar</button>
                    </div>
                    <div class="ontology-toolbar-caption">Paralaje estricto 2.5D: DOM arriba, universo intacto abajo.</div>
                </div>

                <section class="ontology-panel ontology-panel-spatial">
                    <div class="module-window-section-head">
                        <div>
                            <div class="module-window-section-kicker">Spatial Mode</div>
                            <div class="module-window-section-title">Ontology Spatial Mode</div>
                        </div>
                        <div class="ontology-panel-meta">${r.spatial?.nodes?.length??0} nodos / ${r.spatial?.links?.length??0} enlaces</div>
                    </div>
                    ${this._renderSpatialViewport(r.spatial)}
                </section>

                <div class="ontology-metrics-grid">
                    ${this._renderMetricCard(`Kernel`,r.metrics.kernelState,`${r.metrics.booted}/${r.metrics.bootNodes} boot nodes`)}
                    ${this._renderMetricCard(`Servicios`,r.metrics.services,`registro canonico`)}
                    ${this._renderMetricCard(`Sabiduria`,r.metrics.wisdomEntries,`${r.metrics.disciplines} disciplinas`)}
                    ${this._renderMetricCard(`Galaxia`,r.metrics.namedSystems,`${r.metrics.mainStars} estrellas base`)}
                    ${this._renderMetricCard(`Cicatrices`,r.metrics.scarCount,r.metrics.scarCount>0?`masas comprometidas`:`universo pristine`)}
                </div>

                <div class="ontology-layout">
                    <section class="ontology-panel ontology-panel-tree">
                        <div class="module-window-section-head">
                            <div>
                                <div class="module-window-section-kicker">Topology</div>
                                <div class="module-window-section-title">Arbol colapsable</div>
                            </div>
                            <div class="ontology-panel-meta">${r.tree.length} raices</div>
                        </div>
                        <div class="ontology-tree-shell">
                            <ul class="ontology-tree-root" data-ontology-tree>
                                ${r.tree.map(e=>this._renderTreeNode(e)).join(``)}
                            </ul>
                        </div>
                    </section>

                    <aside class="ontology-panel ontology-panel-side">
                        <div class="module-window-section-head">
                            <div>
                                <div class="module-window-section-kicker">Bridge</div>
                                <div class="module-window-section-title">Lectura viva</div>
                            </div>
                        </div>
                        <div class="ontology-side-list">
                            <div class="ontology-side-item">
                                <span>RuntimeSignals</span>
                                <strong>${p(o)}</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Window appId</span>
                                <strong>${p(c)}</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Observer system</span>
                                <strong>${p(String(n.visibleScenario?.observerSystem?.boundaryRadius??0))}u</strong>
                            </div>
                            <div class="ontology-side-item">
                                <span>Wisdom mode</span>
                                <strong>${p(i.wisdom.referenceMode)}</strong>
                            </div>
                        </div>
                        <div class="ontology-note">
                            Usa <strong>mostrar mapa mental</strong>, <strong>mapa ontologico</strong> o <strong>LULU.system_graph()</strong> para recompilar esta vista desde el chat de LULU.
                        </div>
                        <div class="ontology-inspector" data-ontology-inspector>
                            <div class="ontology-inspector-kicker">Focus</div>
                            <div class="ontology-inspector-title">Esperando nodo</div>
                            <div class="ontology-inspector-copy">Pasa el cursor sobre una capa del cerebro del OS o fija un nodo para seguir sus dependencias.</div>
                            <div class="ontology-inspector-links">Sin conexiones activas.</div>
                        </div>
                    </aside>
                </div>
            </div>
        `,this.activeContent=e,this.activeWindow=e.closest(`.glass-window`)||document.getElementById(this.windowId),this.universeContainer=e.querySelector(`[data-ontology-universe]`),this.inspectorPanel=e.querySelector(`[data-ontology-inspector]`),this._hoverNodeId=null,this._pinnedNodeId=`kernel`,this._tiltX=0,this._tiltY=0,this._spotX=50,this._spotY=50;let a=e.querySelector(`[data-action="expand-all"]`),s=e.querySelector(`[data-action="collapse-all"]`),l=e.querySelector(`[data-action="refresh"]`),u=()=>Array.from(e.querySelectorAll(`.ontology-tree-details`));a?.addEventListener(`click`,()=>{u().forEach(e=>{e.open=!0})}),s?.addEventListener(`click`,()=>{u().forEach((e,t)=>{e.open=t<1})}),l?.addEventListener(`click`,()=>{this.open()}),this.universeContainer&&(this.universeContainer.style.setProperty(`--ontology-cursor-x`,`${this._spotX}%`),this.universeContainer.style.setProperty(`--ontology-cursor-y`,`${this._spotY}%`),this.universeContainer.style.transform=`rotateX(0deg) rotateY(0deg)`),this._bindSpatialInteractions(e),this._applySpatialFocus(this._pinnedNodeId)}_renderMetricCard(e,t,n){return`
            <div class="ontology-metric-card">
                <span class="ontology-metric-label">${p(e)}</span>
                <strong class="ontology-metric-value">${p(String(t))}</strong>
                <span class="ontology-metric-meta">${p(n)}</span>
            </div>
        `}_renderSpatialViewport(e){return`
            <div class="ontology-viewport" data-ontology-viewport>
                <div class="ontology-universe" data-ontology-universe>
                    <div class="ontology-universe-glow"></div>
                    <svg class="ontology-connectors" viewBox="0 0 ${u} ${d}" preserveAspectRatio="none" aria-hidden="true">
                        ${e.links.map(e=>this._renderSpatialLink(e)).join(``)}
                    </svg>
                    ${e.layers.map(e=>this._renderSpatialLayer(e)).join(``)}
                </div>
            </div>
        `}_renderSpatialLayer(e){return`
            <section class="ontology-layer ontology-layer-${p(e.id)}" data-layer-id="${p(e.id)}" style="--ontology-layer-z:${e.z}px;">
                <div class="ontology-layer-label">${p(e.label)}</div>
                ${e.nodes.map(e=>this._renderSpatialNode(e)).join(``)}
            </section>
        `}_renderSpatialNode(e){let t=Array.isArray(e.dependencies)?e.dependencies.join(`,`):``;return`
            <button
                type="button"
                class="ontology-spatial-node"
                data-node-id="${p(e.id)}"
                data-node-label="${p(e.label)}"
                data-node-summary="${p(e.summary||``)}"
                data-node-badge="${p(e.badge||``)}"
                data-node-meta="${p(e.meta||``)}"
                data-dependencies="${p(t)}"
                style="--node-x:${e.x}%; --node-y:${e.y}%;">
                <span class="ontology-spatial-node-label">${p(e.label)}</span>
                <span class="ontology-spatial-node-badge">${p(e.badge||`node`)}</span>
                <span class="ontology-spatial-node-meta">${p(e.meta||``)}</span>
            </button>
        `}_renderSpatialLink(e){return`
            <path
                class="ontology-connector ontology-connector-${p(e.fromLayer)} ontology-connector-${p(e.toLayer)}"
                data-link-id="${p(e.id)}"
                data-from="${p(e.from)}"
                data-to="${p(e.to)}"
                d="${p(e.path)}" />
        `}_bindSpatialInteractions(e){let t=Array.from(e.querySelectorAll(`.ontology-spatial-node`));for(let e of t){let t=e.dataset.nodeId;if(!t)continue;let n=()=>{this._hoverNodeId=t,this._applySpatialFocus(t)},r=()=>{this._hoverNodeId===t&&(this._hoverNodeId=null),this._applySpatialFocus(this._pinnedNodeId)};e.addEventListener(`mouseenter`,n),e.addEventListener(`focus`,n),e.addEventListener(`mouseleave`,r),e.addEventListener(`blur`,r),e.addEventListener(`click`,()=>{this._pinnedNodeId=this._pinnedNodeId===t?null:t,this._applySpatialFocus(this._pinnedNodeId||this._hoverNodeId)})}}_collectRelatedNodeIds(e){let t=new Set;if(!e||!this._spatialGraph?.links?.length)return t;t.add(e);for(let n of this._spatialGraph.links)n.from===e?t.add(n.to):n.to===e&&t.add(n.from);return t}_applySpatialFocus(e=null){if(!this.activeContent||!this._spatialGraph)return;let t=e||this._hoverNodeId||null,n=this._collectRelatedNodeIds(t),r=n.size>0,i=this.activeContent.querySelectorAll(`.ontology-spatial-node`),a=this.activeContent.querySelectorAll(`.ontology-connector`);i.forEach(e=>{let i=e.dataset.nodeId,a=!!t&&i===t,o=!a&&r&&n.has(i);e.classList.toggle(`is-focused`,a),e.classList.toggle(`is-related`,o),e.classList.toggle(`is-dimmed`,r&&!a&&!o)}),a.forEach(e=>{let i=e.dataset.from,a=e.dataset.to,o=!!t&&(i===t||a===t),s=r&&n.has(i)&&n.has(a);e.classList.toggle(`is-active`,o||s),e.classList.toggle(`is-dimmed`,r&&!o&&!s)}),this._updateInspector(t)}_updateInspector(e){if(!this.inspectorPanel||!this._spatialGraph)return;let t=this._spatialGraph.nodes.find(t=>t.id===e)||null;if(!t){this.inspectorPanel.innerHTML=`
                <div class="ontology-inspector-kicker">Focus</div>
                <div class="ontology-inspector-title">Esperando nodo</div>
                <div class="ontology-inspector-copy">Pasa el cursor sobre una capa del cerebro del OS o fija un nodo para seguir sus dependencias.</div>
                <div class="ontology-inspector-links">Sin conexiones activas.</div>
            `;return}let n=[];for(let e of this._spatialGraph.links)if(e.from===t.id){let t=this._spatialGraph.nodes.find(t=>t.id===e.to);t&&n.push(t.label)}else if(e.to===t.id){let t=this._spatialGraph.nodes.find(t=>t.id===e.from);t&&n.push(t.label)}this.inspectorPanel.innerHTML=`
            <div class="ontology-inspector-kicker">${p(t.layer)}</div>
            <div class="ontology-inspector-title">${p(t.label)}</div>
            <div class="ontology-inspector-copy">${p(t.summary||`Sin resumen disponible.`)}</div>
            <div class="ontology-inspector-links">
                <strong>${p(t.badge||`node`)}</strong>
                <span>${p(t.meta||`Sin metadata`)}</span>
                <span>${p(n.length?n.join(` | `):`Sin dependencias directas`)}</span>
            </div>
        `}_renderTreeNode(e){let t=p(e.label),n=e.badge?`<span class="ontology-node-badge">${p(e.badge)}</span>`:``,r=e.meta?`<span class="ontology-node-meta">${p(e.meta)}</span>`:``,i=Array.isArray(e.children)?e.children:[];return i.length?`
            <li class="ontology-tree-item ontology-tree-branch">
                <details class="ontology-tree-details"${e.open===!1?``:` open`}>
                    <summary class="ontology-tree-summary">
                        <span class="ontology-node-dot"></span>
                        <span class="ontology-node-label">${t}</span>
                        ${n}
                        ${r}
                    </summary>
                    <ul class="ontology-tree-children">
                        ${i.map(e=>this._renderTreeNode(e)).join(``)}
                    </ul>
                </details>
            </li>
        `:`
                <li class="ontology-tree-item ontology-tree-leaf">
                    <div class="ontology-tree-node">
                        <span class="ontology-node-dot"></span>
                        <span class="ontology-node-label">${t}</span>
                        ${n}
                        ${r}
                    </div>
                </li>
            `}};export{g as LULUMindMapWindow,g as default};