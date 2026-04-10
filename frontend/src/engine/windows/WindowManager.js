/**
 * WindowManager.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';

import { Window3DSystem } from './systems/Window3DSystem.js';
import { WindowDOMSystem } from './systems/WindowDOMSystem.js';
import { WindowBridgeSystem } from './systems/WindowBridgeSystem.js';
import { SolarDockSystem, PlanetDockSystem, MoonDockSystem } from './systems/DockSystems.js';
import { SpatialWindowPhysicsEngine } from './physics/SpatialWindowPhysicsEngine.js';
import { TransformComponent, WindowComponent, VelocityComponent } from '../core/EntityManager.js';
import { Registry } from '../core/ServiceRegistry.js';

gsap.registerPlugin(Draggable);

export class WindowManager {
    static phase = 'workspace';
    constructor(domLayer, scene) {
        if (WindowManager.instance) return WindowManager.instance;
        this.domLayer = domLayer;
        this.scene = scene;
        this.windows = new Map();
        this._pool = []; // Pool for window object/DOM reuse
        
        // Subsystems are now OMEGA Systems managed by the manifest
        this.domSystem = null;
        this.threeSystem = null;
        this.bridgeSystem = null;
        this.physics = null;
        this.dockSystems = null;
        
        WindowManager.instance = this;
    }

    init() {
        console.log('[WindowManager] OMEGA Window Pipeline Online.');
        
        // Retrieve subsystems from registry (they are guaranteed by manifest dependencies)
        this.domSystem   = Registry.tryGet?.('WindowDOMSystem')   ?? null;
        this.threeSystem  = Registry.tryGet?.('Window3DSystem')    ?? null;
        this.bridgeSystem = Registry.tryGet?.('WindowBridgeSystem') ?? null;
        this.physics      = Registry.tryGet?.('SpatialWindowPhysicsEngine') ?? Registry.tryGet?.('WindowPhysics') ?? null;
        this.dockSystems  = Registry.tryGet?.('DockSystems') ?? null;

        const events = Registry.get('events') || window.__OMEGA_EVENTS__;

        if (events) {
            events.on('window:launch', (data) => this.openWindow(data));
            events.on('window:close', (data) => this.closeWindow(data.id));
            events.on('window:focus', (data) => this.focusWindow(data.id));
        }

        console.log('[WindowManager] Subsystems linked via Registry.');
    }

    openWindow(config) {
        const id = config.id || `win-` + Date.now();
        if (this.windows.has(id)) {
            this.focusWindow(id);
            return;
        }

        // Ensure groupId exists to sincronizar 2D / 3D de tarjet
        config.groupId = config.groupId || config.source || config.type || 'default';
        config.groupLabel = config.groupLabel || (config.groupId === 'default' ? 'Grupo Universal' : `Grupo ` + config.groupId);

        let win;
        if (this._pool.length > 0) {
            win = this._pool.pop();
            win.id = id;
            win.config = config;
            // Reset state (position, visibility, etc.)
            if (win.domElement) win.domElement.style.display = 'block';
            if (win.mesh) win.mesh.visible = true;
            if (win.projection) win.projection.visible = true;
        } else {
            const entityManager = Registry.get('EntityManager');
            const entity = entityManager.create();
            entityManager.addComponent(entity, "WindowComponent", new WindowComponent(config.url));
            entityManager.addComponent(entity, "TransformComponent", new TransformComponent());
            entityManager.addComponent(entity, "VelocityComponent", new VelocityComponent());

            const domElement = this.domSystem?.createDOMWindow(entity, id, config);
            const mesh = this.threeSystem?.create3DWindow(entity, id, config);
            win = { entity, id, domElement, mesh, config };
        }

        // V36: Glass Silicon Style Injection
        if (domElement) {
            domElement.classList.add('glass-capsule-premium');
            const refraction = document.createElement('div');
            refraction.className = 'glass-refraction-overlay';
            domElement.prepend(refraction);
            
            if (this.physics) {
               this.physics.register(id, domElement, config.mass || 1.0);
            }
        }

        win = { entity: win.entity, id, domElement: win.domElement, mesh: win.mesh, config };
        
        // V28 OOMEGA: Method Injection for Docking
        win.updateDockPosition = (x, y) => {
            if (win.domElement) {
                gsap.to(win.domElement, { 
                    x: x - win.domElement.offsetWidth / 2, 
                    y: y - win.domElement.offsetHeight / 2,
                    duration: 0.1,
                    overwrite: "auto"
                });
            }
        };

        this.windows.set(id, win);
        
        if (config.groupId && this.bridgeSystem?.registerTarjetGroup) {
            this.bridgeSystem.registerTarjetGroup(config.groupId, [id], { label: config.groupLabel||`Grupo ` + config.groupId, color: config.groupColor });
        }

        if (this.bridgeSystem) {
            const projection = this.bridgeSystem.createProjection(id, win.domElement);
            if (projection) {
                projection.position.set(0, 5, -10); 
                win.projection = projection;
            }
        }

        this.makeDraggable(id);
        this.focusWindow(id);
        return id;
    }

    makeDraggable(id) {
        const win = this.windows.get(id);
        if (!win || !win.domElement) return;

        const self = this;
        Draggable.create(win.domElement, {
            trigger: win.domElement.querySelector('.os-window-header, .modular-window-header'),
            onPress: function() {
                self.focusWindow(id);
                if (self.physics) self.physics.setDragging(id, true);
                win.domElement.classList.add('dragging');
            },
            onRelease: function() {
                if (self.physics) self.physics.setDragging(id, false);
                win.domElement.classList.remove('dragging');
            },
            onClick: function() {
                self.focusWindow(id);
            }
        });
    }

    focusWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        
        const animationEngine = Registry.tryGet?.('AnimationEngine') ?? null;

        this.windows.forEach(w => {
            if (w.id !== id && w.domElement.classList.contains('active')) {
                w.domElement.classList.remove('active');
                if (animationEngine) animationEngine.blurSoft(w.domElement);
            }
            if (w.domElement) w.domElement.style.zIndex = 100;
        });

        if (win.domElement) {
            win.domElement.classList.add('active');
            win.domElement.style.zIndex = 1000;
            if (animationEngine) animationEngine.focusSoft(win.domElement);
        }
    }

    getWindowsByTag(tag) {
        const results = [];
        this.windows.forEach(win => {
            if (win.config && win.config.tags && win.config.tags.includes(tag)) {
                results.push(win);
            }
        });
        return results;
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;

        gsap.to(win.domElement, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                win.domElement.style.display = 'none';
                if (win.mesh) win.mesh.visible = false;
                if (win.projection) win.projection.visible = false;
                
                this.physics?.unregister(id);
                this.windows.delete(id);
                this._pool.push(win);
            }
        });
    }

    update(delta, time) {
        // No manual updates needed here if they are separate Systems in the Registry,
        // but since WindowManager orchestrates the logic loop for windows:
        if (this.physics) this.physics.update(delta, time);
        if (this.bridgeSystem) this.bridgeSystem.sync();
        if (this.dockSystems) this.dockSystems.update(delta, time);
    }
}


