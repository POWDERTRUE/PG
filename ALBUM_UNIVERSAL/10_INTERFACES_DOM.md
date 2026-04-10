# 📚 INTERFACES DOM Y RUTAS (UI)

```json
{
  "module": "DOMInterfaces",
  "version": "V31_DEPTH_OCCLUSION",
  "dependencies": ["DOMOcclusionSystem.js", "WindowManager.js", "ServiceRegistry.js", "gsap"],
  "upgrade_from": "HTML siempre encima del canvas — z-index fijo",
  "upgrade_to": "Occlusion Culling DOM + Glass Silicon windows con depth 3D real",
  "ai_directive": "Las ventanas Glass Silicon actualmente siempre aparecen sobre el canvas 3D. La integración con DOMOcclusionSystem (07_LOGICA_INTERACCION.md) permite que un planeta oculte visualmente una ventana flotante. Para activarlo: en WindowDOMSystem, al crear una ventana, llamar a occlusionSystem.register(domElement, worldPosition, windowId). Al cerrar, llamar occlusionSystem.unregister(windowId).",
  "files": 11,
  "status": "DEPTH_OCCLUSION_INTEGRATION_PENDING"
}
```

> **Estado actual:** Menús 2D inmersivos en DOM, siempre visibles sobre WebGL.
> **Estado objetivo:** Ventanas Glass Silicon con profundidad real — quedan ocultas por geometría 3D cuando orbitan detrás de planetas.

## 💠 Esquema Conceptual

```mermaid
graph TD
  WM[WindowManager] --> WDOM[WindowDOMSystem]
  WDOM --> Create[createElement 'glass-window']
  WDOM --> OccReg[DOMOcclusionSystem.register()]
  OccReg --> WorldAnchor[THREE.Vector3 orbit position]
  OccReg --> ZCheck[Z-Buffer depth check @ 10fps]
  ZCheck --> Visible[opacity: 1 — window in front]
  ZCheck --> Hidden[opacity: 0 — window behind planet]
  InitMenu[InitialMenu] --> Profile[Profile selection]
  Profile --> GameLoop[Free Flight Mode]
```

## 📑 Tabla de Contenidos

- [ui/InitialMenu.js](#uiinitialmenujs) (225 líneas | 7.90 KB)
- [ui/FocusRingUI.js](#uifocusringuijs) (190 líneas | 7.29 KB)
- [ui/URLLauncher.js](#uiurllauncherjs) (150 líneas | 4.90 KB)
- [ui/GameMenuSystem.js](#uigamemenusystemjs) (139 líneas | 5.82 KB)
- [ui/StatusWidgets.js](#uistatuswidgetsjs) (134 líneas | 4.96 KB)
- [ui/Dashboard.js](#uidashboardjs) (128 líneas | 6.65 KB)
- [ui/KernelBarSystem.js](#uikernelbarsystemjs) (112 líneas | 4.25 KB)
- [ui/LoginPanel.js](#uiloginpaneljs) (103 líneas | 3.35 KB)
- [ui/HUDController.js](#uihudcontrollerjs) (62 líneas | 1.91 KB)
- [ui/KernelRouter.js](#uikernelrouterjs) (45 líneas | 1.65 KB)
- [ui/KernelButtonSystem.js](#uikernelbuttonsystemjs) (28 líneas | 0.87 KB)

---

## 🔬 Contrato: Integración DOM ↔ Occlusion System

> **AI TASK:** En `WindowDOMSystem.js` (o `WindowManager.js`), localizar el método que crea ventanas y agregar el registro en `DOMOcclusionSystem` justo después de insertar el elemento al DOM.

**Patrón de integración:**
```js
// En WindowDOMSystem.js — método _createWindowDOM() o equivalente

// [CÓDIGO ACTUAL]
const windowEl = document.createElement('div');
windowEl.className = 'glass-window';
windowLayer.appendChild(windowEl);

// [IA-TODO: AGREGAR DESPUÉS DEL appendChild]
const occlusionSystem = Registry.get('DOMOcclusionSystem');
if (occlusionSystem && windowData.worldPosition) {
    occlusionSystem.register(windowEl, windowData.worldPosition, windowData.id);
}

// [IA-TODO: En el método de cierre de ventana, agregar:]
const occlusionSystem = Registry.get('DOMOcclusionSystem');
if (occlusionSystem) {
    occlusionSystem.unregister(windowData.id);
}
```

**Para ventanas en órbita (que se mueven con el universo):**
```js
// [IA-TODO: En el game loop de WindowDOMSystem.update()]
for (const [id, windowData] of this.windows) {
    if (windowData.orbiting3DObject) {
        // Actualizar posición del anchor cuando el objeto 3D se mueve
        const worldPos = new THREE.Vector3();
        windowData.orbiting3DObject.getWorldPosition(worldPos);
        occlusionSystem.updatePosition(id, worldPos);
    }
}
```

---

## 📜 Código Fuente (Desplegable)

<h3 id="uiinitialmenujs">📄 <code>ui/InitialMenu.js</code></h3>

*Estadísticas: 225 líneas de código, Tamaño: 7.90 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
// frontend/src/ui/InitialMenu.js
import gsap from 'gsap';

/**
 * InitialMenu — V30 OMEGA Entry Interface
 * Provides 6 tactical options for universe interaction.
 */
export class InitialMenu {
    constructor(kernel) {
        this.kernel = kernel;
        this.container = document.getElementById('pg-root');
        this.element = null;
        this.active = false;
        this.profileLabels = new Map();
    }

    render() {
        if (this.active) return;
        this.active = true;
        
        document.body.classList.add('init-mode-active');

        this.element = document.createElement('div');
        this.element.id = 'initial-menu-overlay';
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            z-index: 5000;
            opacity: 0;
            pointer-events: auto;
            overflow-y: auto;
            padding: 40px 10px;
        `;

        const items = [
            { id: 'powdertrue', title: 'POWDERTRUE', description: 'Entrada como Dios', color: '#dffaff', featured: true },
            { id: 'artistas',   title: 'ARTISTAS', description: 'Sesion creativa', color: '#b9e8ff' },
            { id: 'clientes',   title: 'CLIENTES', description: 'Acceso guiado', color: '#d9f3ff' },
            { id: 'publico',    title: 'PUBLICO', description: 'Modo exploracion', color: '#eef9ff' },
            { id: 'wallpaper',  title: 'FONDO VIVO', description: 'Visual inmersivo', color: '#f4fbff' },
            { id: 'salir',      title: 'SALIR', description: 'Cerrar portal', color: '#f7fbff' }
        ];
        this.profileLabels = new Map(items.map((item) => [item.id, item.title]));

        const itemsHTML = items.map((item) => `
            <button type="button"
                class="menu-item-glass menu-item-${item.id} ${item.featured ? 'featured' : ''}"
                data-id="${item.id}"
                style="--item-color: ${item.color}">
                <span class="menu-copy">
                    ${item.featured ? '<span class="menu-tier">Entrada como Dios</span>' : ''}
                    <span class="menu-label">${item.title}</span>
                    <span class="menu-meta">${item.description}</span>
                </span>
            </button>
        `).join('');

        this.element.innerHTML = `
            <div class="menu-stage" style="margin: auto; max-width: 100%;">
                <div class="menu-container">
                    <div class="menu-header">
                        <h1 class="menu-title">Seleccionar Perfil</h1>
                        <div class="menu-subtitle">Entrar al universo</div>
                    </div>
                    <div class="menu-grid">
                        ${itemsHTML}
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Animations
        gsap.to(this.element, { opacity: 1, duration: 1, ease: 'power2.out' });
        
        // Efecto holográfico Apple/SciFi B+C
        gsap.from(this.element.querySelector('.menu-container'), {
            opacity: 0,
            z: -100, // En lugar de y, viene del fondo en 3D
            rotationX: 10,
            scale: 0.95,
            duration: 1.5,
            ease: 'expo.out'
        });
        
        gsap.from(this.element.querySelectorAll('.menu-item-glass'), {
            z: -50,
            opacity: 0,
            rotationX: -15,
            duration: 1.0,
            stagger: 0.1,
            ease: 'power3.out'
        });
        
        // Activar el drifting cinematográfico de fondo
        if (this.kernel.navigationSystem) {
            this.kernel.navigationSystem.enterWallpaperMode();
        }

        this._bindEvents();
    }

    _bindEvents() {
        const items = this.element.querySelectorAll('.menu-item-glass');
        items.forEach(item => {
            item.onclick = () => {
                const id = item.dataset.id;
                this._handleSelect(id);
            };
            
            // Fusión B+C: Parallax 3D Holográfico interactivo
            item.addEventListener('mousemove', (e) => {
                const rect = item.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const cx = rect.width / 2;
                const cy = rect.height / 2;
                
                // Tilt de hasta 12 grados según la distancia al centro
                const tiltX = ((y - cy) / cy) * -12; 
                const tiltY = ((x - cx) / cx) * 12;
                
                gsap.to(item, {
                    rotationX: tiltX,
                    rotationY: tiltY,
                    ease: 'power2.out',
                    transformPerspective: 800,
                    duration: 0.4
                });
            });

            item.addEventListener('mouseleave', () => {
                gsap.to(item, {
                    rotationX: 0,
                    rotationY: 0,
                    ease: 'power3.out',
                    duration: 0.6
                });
            });
        });
    }

    _handleSelect(id) {
        if (id === 'salir') {
            gsap.to(document.body, { opacity: 0, duration: 2 });
            return;
        }

        console.log(`%c[Menu] Selected Protocol: ${id.toUpperCase()}`, 'color:#00ffcc;font-weight:bold');
        const role = this.profileLabels.get(id) || id;

        // Fusión B+C: Transición de Flash Blanco Cegador (Apple) a Inmersión Espacial
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.inset = '0';
        flash.style.background = '#ffffff';
        flash.style.zIndex = '99999';
        flash.style.pointerEvents = 'none';
        flash.style.opacity = '0';
        document.body.appendChild(flash);
        
        // Esconder menú rápido mientras sube el flash
        this.element.style.pointerEvents = 'none';
        gsap.to(this.element, { opacity: 0, scale: 1.1, duration: 0.6, ease: 'power2.in' });

        // Sonido de sistema / Whoosh (Opcional, simulado visualmente con el flash)
        gsap.to(flash, {
            opacity: 1,
            duration: 0.8,
            ease: 'expo.in',
            onComplete: () => {
                // Al estar 100% blancos/cegados, inyectamos al usuario al juego
                document.dispatchEvent(new CustomEvent('os:login', {
                    detail: { role }
                }));
                
                document.body.classList.remove('init-mode-active');
                
                if (id !== 'wallpaper' && this.kernel.navigationSystem) {
                    // Forzar el fin del cinematics drift a FREE_FLIGHT para que pueda interactuar de inmediato
                    this.kernel.navigationSystem.setMode('FREE_FLIGHT', { force: true, requestPointerLock: true });
                }
                
                this.dismiss(true); // Ocultar DOM real rápido

                // Desvanece el blanco como despertar en el paraíso
                gsap.to(flash, {
                    opacity: 0,
                    duration: 2.0, // Muy suave
                    ease: 'power2.out',
                    delay: 0.3,
                    onComplete: () => flash.remove()
                });
            }
        });
    }

    dismiss(immediate = false) {
        if (!this.element) return;
        this.element.style.pointerEvents = 'none';
        
        document.body.classList.remove('init-mode-active');
        
        if (immediate) {
            this.element.remove();
            this.element = null;
            this.active = false;
            return;
        }

        gsap.to(this.element, { 
            opacity: 0, 
            duration: 0.6, 
            ease: 'power2.in',
            onComplete: () => {
                if (this.element) this.element.remove();
                this.element = null;
                this.active = false;
            }
        });
    }
}

```

</details>

---

<h3 id="uifocusringuijs">📄 <code>ui/FocusRingUI.js</code></h3>

*Estadísticas: 190 líneas de código, Tamaño: 7.29 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import gsap from 'gsap';
import * as THREE from 'https://unpkg.com/three@0.132.2/build/three.module.js?v=V28_OMEGA_FINAL';
import { Registry } from '../engine/core/ServiceRegistry.js?v=V28_OMEGA_FINAL';
import { events } from '../core/EventBus.js?v=V28_OMEGA_FINAL';

export class FocusRingUI {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'focus-ring-hud';
        this.el.innerHTML = `
            <div class="ring-circle"></div>
            <div class="ring-bracket top-left"></div>
            <div class="ring-bracket top-right"></div>
            <div class="ring-bracket bottom-left"></div>
            <div class="ring-bracket bottom-right"></div>
            <div class="ring-label"></div>
        `;
        const hudLayer = document.getElementById('hud-layer') || document.body;
        hudLayer.appendChild(this.el);
        
        this.targetObject = null;
        this.visible = false;
        
        this.setupStyles();
    }

    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .focus-ring-hud {
                position: fixed;
                pointer-events: none;
                z-index: 999999;
                display: none;
                width: 140px;
                height: 140px;
                transform: translate(-50%, -50%);
            }
            .ring-circle {
                position: absolute;
                inset: 0px;
                border: 1px solid rgba(0, 255, 255, 0.2);
                border-radius: 50%;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.1);
                animation: ring-pulse 3s infinite ease-in-out;
            }
            .ring-bracket {
                position: absolute;
                width: 20px;
                height: 20px;
                border: 3px solid #00ffff;
                filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.8));
            }
            .top-left { top: -10px; left: -10px; border-right: none; border-bottom: none; }
            .top-right { top: -10px; right: -10px; border-left: none; border-bottom: none; }
            .bottom-left { bottom: -10px; left: -10px; border-right: none; border-top: none; }
            .bottom-right { bottom: -10px; right: -10px; border-left: none; border-top: none; }
            
            .ring-label {
                position: absolute;
                top: -50px;
                left: 50%;
                transform: translateX(-50%);
                color: #ffffff;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(8px);
                padding: 4px 16px;
                border-radius: 20px;
                border: 1px solid rgba(0, 255, 255, 0.3);
                font-family: 'Outfit', sans-serif;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 3px;
                font-size: 16px;
                text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
                white-space: nowrap;
                box-shadow: 0 5px 15px rgba(0,0,0,0.4);
            }
            
            @keyframes ring-pulse {
                0%, 100% { transform: scale(1); opacity: 0.2; }
                50% { transform: scale(1.1); opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }

    init() {
        events.on('camera:focus:target', (data) => {
            if (data.target) {
                this.targetObject = data.target;
                this.show(data.target.name || 'Object');
            }
        });

        events.on('camera:exit:focus', () => {
            this.hide();
        });
    }

    show(name) {
        this.visible = true;
        this.el.style.display = 'block';
        this.el.querySelector('.ring-label').textContent = name;
        
        gsap.fromTo(this.el, 
            { scale: 3, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.6, ease: "expo.out" }
        );
    }

    hide() {
        if (!this.visible) return;
        this.visible = false;
        gsap.to(this.el, { 
            scale: 0.5, 
            opacity: 0, 
            duration: 0.4, 
            onComplete: () => { this.el.style.display = 'none'; }
        });
        this.targetObject = null;
    }

    update() {
        if (!this.visible || !this.targetObject) return;

        const cameraSystem = Registry.get('CameraSystem');
        if (!cameraSystem) return;
        
        const camera = cameraSystem.getCamera();
        const worldPos = new THREE.Vector3();
        this.targetObject.getWorldPosition(worldPos);

        const screenPos = worldPos.clone().project(camera);
        
        if (screenPos.z > 1) {
            this.el.style.opacity = '0';
        } else {
            this.el.style.opacity = '1';
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
            
            // Calculate Dynamic Pixel Size based on distance and object radius
            const dist = camera.position.distanceTo(worldPos);
            // Default radius if not specified (Standard Planet = 20, Moon = 4)
            const objRadiusRaw = this.targetObject.userData.boundingRadius || 25;
            
            // Project a point at the radius to find pixel scale
            const rightPoint = new THREE.Vector3().setFromMatrixPosition(this.targetObject.matrixWorld);
            rightPoint.addScaledVector(camera.up.clone().cross(camera.position.clone().sub(worldPos).normalize()).normalize(), objRadiusRaw);
            const projectedRight = rightPoint.project(camera);
            
            const dx = (projectedRight.x - screenPos.x) * window.innerWidth * 0.5;
            const dy = (projectedRight.y - screenPos.y) * window.innerHeight * 0.5;
            const pixelRadius = Math.sqrt(dx*dx + dy*dy);
            
            // Adaptive Framing: Squeeze to object size but cap at a minimum Square
            // The arista size is now purely responsive to the projected pixel radius
            const targetSize = Math.max(80, pixelRadius * 2.2);
            
            const isFar = pixelRadius < 30; // If too small/far, lock to square mode
            
            gsap.set(this.el, {
                x: x,
                y: y,
                width: targetSize,
                height: targetSize,
                overwrite: "auto"
            });

            // Visual State: Far Away Square Lock
            if (isFar) {
                this.el.querySelector('.ring-circle').style.opacity = '0';
                this.el.querySelectorAll('.ring-bracket').forEach(b => {
                    b.style.borderColor = 'rgba(255, 0, 100, 0.8)'; // Red alert square
                    b.style.width = '10px';
                    b.style.height = '10px';
                });
            } else {
                this.el.querySelector('.ring-circle').style.opacity = '0.4';
                this.el.querySelectorAll('.ring-bracket').forEach(b => {
                    b.style.borderColor = '#00ffff';
                    b.style.width = '20px';
                    b.style.height = '20px';
                });
            }
        }
    }
}

```

</details>

---

<h3 id="uiurllauncherjs">📄 <code>ui/URLLauncher.js</code></h3>

*Estadísticas: 150 líneas de código, Tamaño: 4.90 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * URLLauncher — Top-mounted spatial URL bar.
 *
 * Behavior:
 *   - Mounts a lean input bar at the top center of the screen.
 *   - Execution blocked until a user profile is active.
 *   - On submit, emits `system:spawn-protostar` with the URL.
 *   - Shows visual feedback: "locked" state before login, "ready" after.
 */
import { events } from '../core/EventBus.js?v=V28_OMEGA_FINAL';
import { Registry } from '../engine/core/ServiceRegistry.js?v=V28_OMEGA_FINAL';
import gsap from 'gsap';

export class URLLauncher {
    constructor() {
        this.activeProfile = null;
        this.el = null;
        this.input = null;
        this.statusDot = null;
    }

    init() {
        this._build();
        this._bind();
        console.log('[URLLauncher] Top-bar URL launcher online.');
    }

    _build() {
        this.el = document.createElement('div');
        this.el.id = 'url-launcher-bar';
        this.el.style.cssText = `
            position: fixed;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: min(640px, 80vw);
            height: 44px;
            background: rgba(10, 10, 20, 0.75);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 22px;
            display: flex;
            align-items: center;
            padding: 0 18px;
            gap: 10px;
            z-index: 8000;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
            pointer-events: auto;
            opacity: 0;
        `;

        // Status dot — red = locked, cyan = ready
        this.statusDot = document.createElement('div');
        this.statusDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff4757;
            flex-shrink: 0;
            transition: background 0.4s ease;
            box-shadow: 0 0 8px currentColor;
        `;

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Selecciona un perfil para navegar…';
        this.input.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: rgba(255,255,255,0.8);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            letter-spacing: 0.3px;
        `;
        this.input.disabled = true;

        const launchBtn = document.createElement('button');
        launchBtn.id = 'url-launch-btn';
        launchBtn.textContent = '⌁';
        launchBtn.style.cssText = `
            background: rgba(0, 240, 255, 0.1);
            border: 1px solid rgba(0, 240, 255, 0.3);
            color: #00f0ff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        `;

        launchBtn.addEventListener('click', () => this._launch());
        this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._launch(); });

        this.el.appendChild(this.statusDot);
        this.el.appendChild(this.input);
        this.el.appendChild(launchBtn);
        document.body.appendChild(this.el);
    }

    _bind() {
        // Become active after login
        document.addEventListener('os:login', (e) => {
            this.activeProfile = e.detail.role;
            this._unlock();
        });
    }

    _unlock() {
        this.input.disabled = false;
        this.input.placeholder = `Explorar universe como ${this.activeProfile}…`;
        this.statusDot.style.background = '#00f0ff';
        gsap.to(this.input, { color: 'rgba(255,255,255,0.95)', duration: 0.3 });
        console.log('[URLLauncher] Unlocked for profile:', this.activeProfile);
    }

    _launch() {
        if (!this.activeProfile) {
            // Shake — visual "locked" feedback
            gsap.to(this.el, { x: '+= 8', duration: 0.05, repeat: 5, yoyo: true,
                onComplete: () => gsap.set(this.el, { x: 0 }) });
            return;
        }

        let url = this.input.value.trim();
        if (!url) return;

        if (!url.startsWith('http')) url = 'https://' + url;

        // Emit spawn event to SpaceHierarchySystem
        events.emit('system:spawn-protostar', {
            url,
            screenX: window.innerWidth / 2,
            screenY: 44
        });

        this.input.value = '';
        gsap.fromTo(this.statusDot, { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
    }

    show() {
        gsap.to(this.el, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    }
}

export const urlLauncher = new URLLauncher();

```

</details>

---

<h3 id="uigamemenusystemjs">📄 <code>ui/GameMenuSystem.js</code></h3>

*Estadísticas: 139 líneas de código, Tamaño: 5.82 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import { gsap } from 'gsap';

export class GameMenuSystem {
    constructor(kernel) {
        this.kernel = kernel;
        this.isOpen = false;
        this.menuUI = null;

        // Custom Event listener para poder invocarlo globalmente desde el UniverseNavigationSystem
        window.addEventListener('PG:TOGGLE_GAME_MENU', () => {
            this.toggle();
        });
    }

    _buildMenu() {
        if (this.menuUI) return;

        this.menuUI = document.createElement('div');
        this.menuUI.id = 'pg-game-menu';
        
        // Estilización de Full-Screen Sci-Fi Glassmorphism
        this.menuUI.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(5, 8, 15, 0.75); backdrop-filter: blur(12px);
            z-index: 99999; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            opacity: 0; pointer-events: none;
            font-family: 'Courier New', monospace; color: #fff;
        `;

        this.menuUI.innerHTML = `
            <div style="text-align: center; margin-bottom: 60px;">
                <h1 style="font-size: 54px; letter-spacing: 4px; color: #00e5ff; text-shadow: 0 0 20px #00e5ff, 0 0 40px #00e5ff; margin: 0; text-transform: uppercase;">
                    Powder Galaxy
                </h1>
                <p style="color: #66b3cc; font-size: 14px; letter-spacing: 2px; margin-top: 10px;">OMEGA V30 KERNEL OFFLINE OVERRIDE</p>
            </div>
            
            <div id="gm-btn-container" style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
                <button id="btn-gm-continue" class="gm-btn">Continuar Explorando</button>
                <button id="btn-gm-settings" class="gm-btn">Ajustes del Sistema</button>
                <button id="btn-gm-exit" class="gm-btn" style="margin-top: 30px; border-color: #ff3366; color: #ff3366; text-shadow: 0 0 10px rgba(255,51,102,0.5);">Salir al Escritorio</button>
            </div>
        `;

        document.body.appendChild(this.menuUI);

        const style = document.createElement('style');
        style.innerText = `
            .gm-btn {
                background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.4);
                color: #00e5ff; font-size: 16px; padding: 16px 40px;
                border-radius: 4px; cursor: pointer; text-transform: uppercase;
                letter-spacing: 3px; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); width: 380px;
                font-family: 'Courier New', monospace; font-weight: bold;
                position: relative; overflow: hidden;
            }
            .gm-btn::before {
                content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.2), transparent);
                transition: left 0.4s ease;
            }
            .gm-btn:hover::before { left: 100%; }
            .gm-btn:hover {
                background: rgba(0, 229, 255, 0.15); box-shadow: 0 0 20px rgba(0, 229, 255, 0.4); transform: scale(1.02);
                border-color: #00e5ff;
            }
            .gm-btn:active { transform: scale(0.98); }
            
            #btn-gm-exit {
                background: rgba(255, 51, 102, 0.05); border-color: rgba(255, 51, 102, 0.4);
            }
            #btn-gm-exit::before {
                background: linear-gradient(90deg, transparent, rgba(255, 51, 102, 0.2), transparent);
            }
            #btn-gm-exit:hover {
                background: rgba(255, 51, 102, 0.15); box-shadow: 0 0 20px rgba(255, 51, 102, 0.4); border-color: #ff3366;
            }
        `;
        document.head.appendChild(style);

        document.getElementById('btn-gm-continue').addEventListener('click', () => this.close());
        document.getElementById('btn-gm-settings').addEventListener('click', () => {
            alert('Ajustes en desarrollo...');
        });
        document.getElementById('btn-gm-exit').addEventListener('click', () => {
            alert("Protocolo de apagado iniciado. El simulador se cerrará.");
            window.location.reload(); // Simple reload para salir visual
        });
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this._buildMenu();
        this.isOpen = true;
        this.menuUI.style.pointerEvents = 'auto';

        // Desbloquear ratón si estaba bloqueado por el FPS Free Flight
        if (document.pointerLockElement) {
            document.exitPointerLock?.();
        }

        // Bloquear cámara tridimensional para interactuar con la UI del menú
        if (this.kernel.navigationSystem) {
            this.kernel.navigationSystem.setMode('MOUSE_UI', { clearFocus: false });
        }

        // Animaciones GSAP
        gsap.to(this.menuUI, { opacity: 1, duration: 0.4, ease: 'power2.out' });
        
        const btns = this.menuUI.querySelectorAll('.gm-btn');
        gsap.fromTo(btns, 
            { y: 30, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.2)' }
        );
        
        const title = this.menuUI.querySelector('h1');
        gsap.fromTo(title, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.menuUI.style.pointerEvents = 'none';

        gsap.to(this.menuUI, { opacity: 0, duration: 0.25, ease: 'power2.in' });

        // Volver al vuelo si estábamos pausados en el menú
        // NOTA: ESC volverá a activar pointer lock automáticamente desde el UniverseNavigationSystem
        if (this.kernel.navigationSystem && this.kernel.navigationSystem.state === 'MOUSE_UI') {
            this.kernel.navigationSystem.resumeFreeFlight();
        }
    }
}

```

</details>

---

<h3 id="uistatuswidgetsjs">📄 <code>ui/StatusWidgets.js</code></h3>

*Estadísticas: 134 líneas de código, Tamaño: 4.96 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import gsap from 'https://unpkg.com/gsap@3.12.5/index.js?v=V28_OMEGA_FINAL';
import { Registry } from '../engine/core/ServiceRegistry.js';


/**
 * ==========================================================
 * Powder Galaxy Engine - StatusWidgets V28 (OMEGA)
 * ==========================================================
 * @file StatusWidgets.js?v=V28_OMEGA_FINAL
 * @description V38 Quantum Status Monitors
 */
export class StatusWidgets {
    constructor() {
        this.container = document.getElementById('hud-layer');
        this.widgets = {};
        this.kernel = null;
    }

    render(kernel) {
        if (!this.container) return;
        this.kernel = kernel;

        // Create Widget Container
        const wrapper = document.createElement('div');
        wrapper.id = 'status-widgets-wrapper';
        wrapper.style.cssText = `
            position: fixed;
            top: 25px;
            right: 25px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            pointer-events: none;
            z-index: 2000;
        `;
        this.container.appendChild(wrapper);

        this.createWidget(wrapper, 'engine', 'CORE HEARTBEAT', 'STABLE');
        this.createWidget(wrapper, 'fps', 'ENGINE SPEED', '0 FPS');
        this.createWidget(wrapper, 'coords', 'SPATIAL COORDINATES', '0.00, 0.00, 0.00');
        this.createWidget(wrapper, 'drawcalls', 'DRAW CALLS', '0');
        this.createWidget(wrapper, 'triangles', 'TRIANGLES', '0');
        this.createWidget(wrapper, 'population', 'STAR POPULATION', '1,000,000');

        this.startUpdating();
    }

    createWidget(parent, id, label, defaultValue) {
        const widget = document.createElement('div');
        widget.className = 'glass-capsule-premium';
        widget.style.cssText = `
            padding: 12px 20px;
            width: 220px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            opacity: 0;
            transform: translateX(50px);
            pointer-events: auto;
            cursor: pointer;
        `;

        widget.innerHTML = `
            <div class="glass-refraction-overlay"></div>
            <span style="font-size: 8px; font-weight: 800; color: rgba(0, 240, 255, 0.6); letter-spacing: 1px;">${label}</span>
            <span id="widget-val-${id}" style="font-family: 'Inter', sans-serif; font-size: 13px; color: #fff; font-weight: 500; letter-spacing: 0.5px;">${defaultValue}</span>
            <div style="position: absolute; bottom: 0; left: 0; height: 1px; width: 0%; background: #00f0ff; opacity: 0.3;" id="widget-progress-${id}"></div>
        `;

        parent.appendChild(widget);
        this.widgets[id] = widget;

        gsap.to(widget, { 
            opacity: 1, 
            x: 0, 
            duration: 1, 
            ease: "expo.out", 
            delay: Object.keys(this.widgets).length * 0.1 
        });

        widget.onmouseenter = () => {
            gsap.to(widget, { scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.08)', duration: 0.4 });
        };
        widget.onmouseleave = () => {
            gsap.to(widget, { scale: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', duration: 0.4 });
        };
    }

    startUpdating() {
        setInterval(() => this.update(), 100);
    }

    update() {
        if (!this.kernel) return;

        // 1. Update Spatial Coordinates & FPS
        const camera = Registry.get('camera');
        if (camera) {
            const p = camera.position;
            const el = document.getElementById('widget-val-coords');
            if (el) el.innerText = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
        }

        const scheduler = Registry.get('scheduler');
        if (scheduler) {
            const fpsEl = document.getElementById('widget-val-fps');
            if (fpsEl) fpsEl.innerText = `${Math.round(scheduler.fps || 0)} FPS`;
        }

        // 2. Pulse Heartbeat & Renderer Info
        const heartbeat = document.getElementById('widget-progress-engine');
        if (heartbeat) {
            gsap.to(heartbeat, { width: '100%', duration: 0.1, onComplete: () => {
                gsap.set(heartbeat, { width: '0%' });
            }});
        }

        const renderer = Registry.get('renderer');
        if (renderer && renderer.info) {
            const dcEl = document.getElementById('widget-val-drawcalls');
            const triEl = document.getElementById('widget-val-triangles');
            if (dcEl) dcEl.innerText = renderer.info.render.calls.toLocaleString();
            if (triEl) triEl.innerText = renderer.info.render.triangles.toLocaleString();
        }

        // 3. Population Density (Synthetic but reactive)
        const pop = document.getElementById('widget-val-population');
        if (pop) {
            const val = 1000000 + Math.floor(Math.random() * 100);
            pop.innerText = val.toLocaleString();
        }
    }
}

```

</details>

---

<h3 id="uidashboardjs">📄 <code>ui/Dashboard.js</code></h3>

*Estadísticas: 128 líneas de código, Tamaño: 6.65 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import gsap from 'https://unpkg.com/gsap@3.12.5/index.js?v=V28_OMEGA_FINAL';

/**
 * ==========================================================
 * Powder Galaxy Engine - Dashboard V28 (OMEGA)
 * ==========================================================
 * @file Dashboard.js?v=V28_OMEGA_FINAL
 * @description V38 System OS Command Center
 */
export class Dashboard {
    constructor() {
        this.container = document.getElementById('hud-layer');
        this.element = null;
        this.isActive = false;
        this.kernel = null;
    }

    render(kernel) {
        if (!this.container) return;
        this.kernel = kernel;

        this.element = document.createElement('div');
        this.element.id = 'system-dashboard';
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(50px) saturate(200%);
            -webkit-backdrop-filter: blur(50px) saturate(200%);
            z-index: 5000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        this.element.innerHTML = `
            <div class="glass-capsule-premium" style="width: 80vw; height: 70vh; display: flex; flex-direction: column; padding: 40px; transform: scale(0.95);">
                <div class="glass-refraction-overlay"></div>
                
                <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                    <div>
                        <h1 style="margin: 0; font-family: 'Inter', sans-serif; font-weight: 200; letter-spacing: 12px; font-size: 32px; color: #fff;">OS DASHBOARD</h1>
                        <p style="margin: 8px 0 0; color: rgba(0, 240, 255, 0.6); font-size: 10px; font-weight: 800; text-transform: uppercase;">Powder Galaxy V28 OMEGA</p>
                    </div>
                    <button id="close-dash" class="window-btn close" style="width: 24px; height: 24px;"></button>
                </header>

                <div style="flex-grow: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px;">
                    <!-- Module 1: Universe -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02);">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">UNIVERSE STATUS</h3>
                        <div style="display: flex; flex-direction: column; gap: 15px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">LOD MESHES</span>
                                <span style="font-size: 11px; color: #fff;">ACTIVE (V28)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">STAR KERNEL</span>
                                <span style="font-size: 11px; color: #00f0ff;">RUNNING (1M)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.4);">FLOATING ORIGIN</span>
                                <span style="font-size: 11px; color: #fff;">STABLE (64-BIT)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Module 2: Hardware -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02);">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">ENGINE TELEMETRY</h3>
                        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
                            <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                <div style="width: 45%; height: 100%; background: #00f0ff;"></div>
                            </div>
                            <span style="font-size: 9px; color: rgba(255,255,255,0.3);">GPU MEMORY: OPTIMIZED</span>
                        </div>
                    </div>

                    <!-- Module 3: System Logs -->
                    <div class="glass-capsule-premium" style="padding: 25px; background: rgba(255, 255, 255, 0.02); display: flex; flex-direction: column;">
                        <h3 style="margin: 0 0 20px; font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 1px;">SYSTEM LOGS</h3>
                        <div id="dash-logs" style="flex-grow: 1; font-family: monospace; font-size: 10px; color: rgba(0, 240, 255, 0.4); overflow: hidden;">
                            [01:10] OMEGA V28 Heartbeat Stable.<br/>
                            [01:10] Identity Verified.<br/>
                            [01:10] Spatial Index Active.<br/>
                            [01:11] 1M Stars Allocated to GPU.
                        </div>
                    </div>
                </div>

                <footer style="margin-top: 40px; display: flex; justify-content: center;">
                    <button class="glass-btn-premium" style="padding: 10px 40px;" id="reboot-btn">OS REBOOT</button>
                </footer>
            </div>
        `;

        this.container.appendChild(this.element);
        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelector('#close-dash').onclick = () => this.toggle(false);
        this.element.querySelector('#reboot-btn').onclick = () => window.location.reload();
        
        if (this.kernel && this.kernel.events) {
            this.kernel.events.on('os:toggle_dashboard', () => this.toggle());
        }
    }

    toggle(state = !this.isActive) {
        this.isActive = state;
        if (this.isActive) {
            this.element.style.opacity = '1';
            this.element.style.pointerEvents = 'auto';
            gsap.fromTo(this.element.querySelector('.glass-capsule-premium'), 
                { scale: 0.95, y: 20 }, 
                { scale: 1, y: 0, duration: 0.8, ease: "expo.out" }
            );
        } else {
            this.element.style.opacity = '0';
            this.element.style.pointerEvents = 'none';
        }
    }
}

```

</details>

---

<h3 id="uikernelbarsystemjs">📄 <code>ui/KernelBarSystem.js</code></h3>

*Estadísticas: 112 líneas de código, Tamaño: 4.25 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
// frontend/src/ui/KernelBarSystem.js

/**
 * KernelBarSystem
 * Renders the macOS / visionOS-style app dock into #kernel-bar.
 * Each button fires a WARP_FLIGHT_COMPLETE CustomEvent so:
 *   WindowManager → opens the corresponding glass window.
 *   WorldInteractionSystem → clears hover state.
 */
export class KernelBarSystem {
    constructor() {
        this.container     = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        // Resolve or create the host element
        this.container = document.getElementById('kernel-bar');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id         = 'kernel-bar';
            this.container.className  = 'ui-layer';
            this.container.style.cssText =
                'position:fixed;inset:0;pointer-events:none;z-index:2000;';
            document.body.appendChild(this.container);
        }

        this.container.style.pointerEvents = 'none';

        // Glass dock pill
        const dock = document.createElement('div');
        dock.className = 'glass-panel kernel-dock';

        const APPS = [
            { id: 'terminal',  label: 'Terminal',  icon: '⌨' },
            { id: 'explorer',  label: 'Explorador',  icon: '🗂' },
            { id: 'gallery',   label: 'Galeria',   icon: '🖼' },
            { id: 'database',  label: 'Base de datos',  icon: '🗄' },
            { id: 'hologram',  label: 'Holograma',  icon: '🔮' },
            { id: 'settings',  label: 'Ajustes',  icon: '⚙' },
        ];

        APPS.forEach(app => {
            const btn = document.createElement('div');
            btn.className         = 'kernel-btn';
            btn.dataset.appId     = app.id;
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('role', 'button');
            btn.setAttribute('aria-label', app.label);
            btn.innerHTML         = `<span class="kb-icon">${app.icon}</span><span class="kb-label">${app.label}</span>`;

            // Keyboard accessibility
            btn.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._launch(app.id);
                }
            });

            btn.addEventListener('click', () => this._launch(app.id));

            // Magnetic hover spring
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(0,255,204,0.12)';
                btn.style.transform  = 'translateY(-4px) scale(1.08)';
                btn.style.boxShadow  = '0 0 22px rgba(0,255,204,0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '';
                btn.style.transform  = '';
                btn.style.boxShadow  = '';
            });
            btn.addEventListener('mousedown', () => {
                btn.style.transform = 'translateY(0) scale(0.95)';
            });
            btn.addEventListener('mouseup', () => {
                btn.style.transform = 'translateY(-4px) scale(1.08)';
            });

            dock.appendChild(btn);
        });

        // Inject extra style for icon/label layout (scoped to avoid global collisions)
        if (!document.getElementById('_kb_style')) {
            const s = document.createElement('style');
            s.id = '_kb_style';
            s.textContent = `
                .kernel-btn { display:flex; flex-direction:column; align-items:center; gap:3px; }
                .kb-icon  { font-size:20px; line-height:1; pointer-events:none; }
                .kb-label { font-size:10px; font-weight:700; letter-spacing:0.07em;
                            color:rgba(236,248,255,0.88); pointer-events:none; }
            `;
            document.head.appendChild(s);
        }

        this.container.appendChild(dock);
        this.isInitialized = true;
        console.log('%c[KernelBar] OS Dock initialized — 5 apps mounted.', 'color:#00ffcc;font-weight:bold');
    }

    _launch(appId) {
        window.dispatchEvent(new CustomEvent('WARP_FLIGHT_COMPLETE', {
            bubbles:  true,
            detail:   { appId }
        }));
        console.log(`%c[KernelBar] Launch: ${appId}`, 'color:#00ffcc');
    }
}


```

</details>

---

<h3 id="uiloginpaneljs">📄 <code>ui/LoginPanel.js</code></h3>

*Estadísticas: 103 líneas de código, Tamaño: 3.35 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import gsap from 'gsap';

/**
 * ==========================================================
 * Powder Galaxy Engine - LoginPanel V28 (OMEGA)
 * ==========================================================
 * @file LoginPanel.js?v=V28_OMEGA_FINAL
 * @description V36 Glass Silicon Login Interface
 */
export class LoginPanel {
    constructor(kernel) {
        this.kernel = kernel;
        this.container = document.getElementById('hud-layer');
        this.element = null;
    }

    render() {
        if (!this.container) return;

        this.element = document.createElement('div');
        this.element.id = 'login-screen';
        this.element.style.cssText = `
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            opacity: 0;
            pointer-events: auto;
        `;

        this.element.innerHTML = `
            <div class="login-ice-shell" style="transform: scale(0.9);">
                <div class="login-ice-header">
                    <p class="login-ice-badge">Glass Silicon Ice</p>
                    <h1 class="login-ice-title">Seleccionar Perfil</h1>
                    <p class="login-ice-subtitle">Login para entrar al universo</p>
                </div>

                <div class="login-ice-fields">
                    <label class="login-ice-field">
                        Perfil
                        <input type="text" placeholder="@perfil" class="glass-input login-ice-input" />
                    </label>
                    <label class="login-ice-field">
                        Access Key
                        <input type="password" placeholder="********" class="glass-input login-ice-input" />
                    </label>
                </div>

                <button id="login-btn" class="glass-btn-premium login-ice-button">Entrar al Universo</button>
            </div>
        `;

        this.container.appendChild(this.element);

        // Entry Animation
        gsap.to(this.element, { opacity: 1, duration: 1.5, ease: "power2.out" });
        gsap.to(this.element.querySelector('.login-ice-shell'), { scale: 1, duration: 1.5, ease: "expo.out" });

        this.bindEvents();
    }

    bindEvents() {
        const btn = this.element.querySelector('#login-btn');
        btn.onclick = () => this.handleLogin();
        
        this.element.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    handleLogin() {
        const btn = this.element.querySelector('#login-btn');
        btn.innerHTML = "ENLAZANDO...";
        btn.style.pointerEvents = "none";

        // Dispatch Success via Kernel
        setTimeout(() => {
            if (this.kernel && this.kernel.events) {
                this.kernel.events.emit('os:login_success');
            }
            this.dismiss();
        }, 800);
    }

    dismiss() {
        gsap.to(this.element.querySelector('.login-ice-shell'), {
            scale: 1.1,
            opacity: 0,
            duration: 1,
            ease: "expo.in",
            onComplete: () => {
                this.element.remove();
                this.element = null;
            }
        });
        
        gsap.to(this.element, { opacity: 0, duration: 1 });
    }
}

```

</details>

---

<h3 id="uihudcontrollerjs">📄 <code>ui/HUDController.js</code></h3>

*Estadísticas: 62 líneas de código, Tamaño: 1.91 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
import { StatusWidgets } from './StatusWidgets.js?v=V28_OMEGA_FINAL';
import { Dashboard } from './Dashboard.js?v=V28_OMEGA_FINAL';

/**
 * ==========================================================
 * Powder Galaxy Engine - HUDController V28 (OMEGA)
 * ==========================================================
 * @file HUDController.js?v=V28_OMEGA_FINAL
 * @description V38 HUD & Dashboard Orchestrator
 */
export class HUDController {
    constructor() {
        this.statusWidgets = new StatusWidgets();
        this.dashboard = new Dashboard();
        this.kernel = null;
    }

    init(kernel) {
        console.log('[HUDController] Initializing OMEGA V28 Interactive HUD Layers.');
        this.kernel = kernel;
        
        this.createSystemBar();
        this.statusWidgets.render(kernel);
        this.dashboard.render(kernel);

        this.bindGlobalKeys();
    }

    createSystemBar() {
        const bar = document.createElement('div');
        bar.id = 'system-bar';
        bar.className = 'glass-capsule-premium';
        
        // Add Dashboard Trigger Button
        const dashBtn = document.createElement('button');
        dashBtn.className = 'glass-btn-premium';
        dashBtn.innerHTML = 'DASH';
        dashBtn.style.cssText = `
            padding: 8px 24px;
            font-size: 10px;
            border-radius: 12px;
        `;
        dashBtn.onclick = () => {
            if (this.kernel) this.kernel.events.emit('os:toggle_dashboard');
        };
        
        bar.appendChild(dashBtn);
        document.body.appendChild(bar);
    }

    bindGlobalKeys() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                if (this.kernel) this.kernel.events.emit('os:toggle_dashboard');
            }
        });
    }
}

export const hudController = new HUDController();

```

</details>

---

<h3 id="uikernelrouterjs">📄 <code>ui/KernelRouter.js</code></h3>

*Estadísticas: 45 líneas de código, Tamaño: 1.65 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * KernelRouter.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import { events } from '../core/EventBus.js?v=V28_OMEGA_FINAL';

export class KernelRouter {
    static phase = 'workspace';
    
    init() {
        events.on('kernel:command', (command) => {
            this.route(command);
        });
        console.log('[KernelRouter] OMEGA Command Router Online.');
    }

    route(command) {
        console.log('[KernelRouter] Routing command:', command);
        switch(command) {
            case '/browser':
                events.emit('window:open', { app: 'browser', title: 'Cosmic Browser', url: 'https://bing.com' });
                break;
            case '/gallery':
                events.emit('window:open', { app: 'gallery', title: 'Nebula Gallery' });
                break;
            case '/terminal':
                events.emit('window:open', { app: 'terminal', title: 'Universe Terminal' });
                break;
            case '/system':
                events.emit('window:open', { app: 'settings', title: 'System Settings' });
                break;
            default:
                // Support direct URLs as well
                if (command.startsWith('http') || command.includes('.')) {
                    let formattedUrl = command;
                    if (!command.startsWith('http')) formattedUrl = 'https://' + command;
                    events.emit('window:open', { app: 'browser', url: formattedUrl, title: formattedUrl });
                } else {
                    console.warn('[KernelRouter] Unknown command:', command);
                }
                break;
        }
    }
}

```

</details>

---

<h3 id="uikernelbuttonsystemjs">📄 <code>ui/KernelButtonSystem.js</code></h3>

*Estadísticas: 28 líneas de código, Tamaño: 0.87 KB*

<details>
<summary><strong>🔭 [ Clic para expandir el código fuente ]</strong></summary>

```js
/**
 * KernelButtonSystem.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import { events } from '../core/EventBus.js?v=V28_OMEGA_FINAL';

export class KernelButtonSystem {
    static phase = 'workspace';
    init() {
        const input = document.querySelector('#kernel-input');
        if (!input) {
            console.warn('[KernelButtonSystem] #kernel-input not found in DOM.');
            return;
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = input.value.trim();
                console.log('[KernelButtonSystem] Command emitted:', command);
                events.emit('kernel:command', command);
                input.value = ''; // Clear input after command
            }
        });

        console.log('[KernelButton] OMEGA Command Interface Online.');
    }
}

```

</details>

---

