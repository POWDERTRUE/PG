import{J as e,L as t,P as n,S as r,_t as i,at as a,ct as o,g as s,gt as c,h as l}from"./vendor-hLruerWX.js";import{t as u}from"./ServiceRegistry-CU0F0t6D.js";import{t as d}from"./LCG-DLuXNe6y.js";var f=class{constructor(){this.phase=`render`,this.isActive=!1,this.cosmosScene=new c,this.cosmosScene.fog=new n(`#000002`,5e-5),this.cosmosCamera=new a(60,window.innerWidth/window.innerHeight,50,2e5),this.cosmosCamera.position.set(0,1500,1e4),this.cosmosCamera.lookAt(0,0,0),this.cosmicWebContainer=new t,this.cosmosScene.add(this.cosmicWebContainer),this._orbitAngleX=0,this._orbitAngleY=0,this._buildCosmicWeb(),this._initSignalListeners()}_buildCosmicWeb(){let t=1e4,n=new s,a=new Float32Array(t*3),c=new Float32Array(t*3),u=new Float32Array(t),f=new d(9999),p=5e4;for(let n=0;n<t;n++){let t=f.nextFloat()**1.5*p,i=f.nextFloat()*Math.PI*2,o=Math.acos(2*f.nextFloat()-1),s=t*Math.sin(o)*Math.cos(i),l=t*Math.cos(o),d=t*Math.sin(o)*Math.sin(i);a[n*3+0]=s,a[n*3+1]=l,a[n*3+2]=d;let m=t/p,h=e.lerp(.65,0,m),g=new r().setHSL(h,.9,.6);c[n*3+0]=g.r,c[n*3+1]=g.g,c[n*3+2]=g.b,u[n]=f.nextRange(10,50)}n.setAttribute(`position`,new l(a,3)),n.setAttribute(`color`,new l(c,3)),n.setAttribute(`size`,new l(u,1)),this.cosmicWeb=new o(n,new i({uniforms:{time:{value:0}},vertexShader:`
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // Scaling inverso con límite para preservar visibilidad lejana
                    gl_PointSize = size * max((5000.0 / -mvPosition.z), 0.5);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,fragmentShader:`
                varying vec3 vColor;
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    // Suave difuminación tipo elíptica/espiral distante
                    float alpha = pow(1.0 - (dist * 2.0), 1.5);
                    gl_FragColor = vec4(vColor, alpha * 0.9);
                }
            `,transparent:!0,blending:2,depthWrite:!1})),this.cosmicWebContainer.add(this.cosmicWeb)}_initSignalListeners(){}setMapState(e){if(this.isActive===e)return;this.isActive=e;let t=u.tryGet(`InputStateSystem`),n=u.tryGet(`RuntimeSignals`);this.isActive?(console.log(`%c[CosmosMap] COSMOS Scene Activated.`,`color:#a78bfa; font-weight:bold`),t?.currentContext&&(this._previousContext=t.currentContext),t&&(t.currentContext=`COSMOS_MAP`),n?.emit?.(`PG:RENDER:SWITCH_SCENE`,{scene:`COSMOS`})):(console.log(`%c[CosmosMap] Exiting COSMOS.`,`color:#4c1d95; font-weight:bold`),t&&this._previousContext&&(t.currentContext=this._previousContext),n?.emit?.(`PG:RENDER:SWITCH_SCENE`,{scene:`MACRO`}))}update(t){if(!this.isActive)return;this.cosmicWebContainer.rotation.y+=t*.005,this.cosmicWeb.material.uniforms.time.value+=t;let n=u.tryGet(`InputStateSystem`);if(n&&n.isGestureDragActive()){let t=n.getGestureDragDX(),r=n.getGestureDragDY();this._orbitAngleY-=t*.005,this._orbitAngleX-=r*.005,this._orbitAngleX=e.clamp(this._orbitAngleX,-Math.PI/2+.1,Math.PI/2-.1)}let r=1e4;this.cosmosCamera.position.x=r*Math.cos(this._orbitAngleX)*Math.sin(this._orbitAngleY),this.cosmosCamera.position.y=r*Math.sin(this._orbitAngleX),this.cosmosCamera.position.z=r*Math.cos(this._orbitAngleX)*Math.cos(this._orbitAngleY),this.cosmosCamera.lookAt(0,0,0)}dispose(){this.isActive=!1,this.cosmicWeb&&=(this.cosmicWebContainer?.remove(this.cosmicWeb),this.cosmicWeb.geometry?.dispose?.(),this.cosmicWeb.material?.dispose?.(),null),this.cosmicWebContainer&&=(this.cosmosScene?.remove(this.cosmicWebContainer),this.cosmicWebContainer.clear?.(),null),this.cosmosScene?.clear?.(),this.cosmosScene=null,this.cosmosCamera=null}};export{f as CosmosMapSystem};