import gsap from 'gsap';
import * as THREE from 'three';
import { Registry } from '../engine/core/ServiceRegistry.js';
import { events } from '../core/EventBus.js';

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


