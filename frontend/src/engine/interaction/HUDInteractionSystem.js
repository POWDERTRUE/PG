import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { gsap } from 'gsap';

export class HUDInteractionSystem {
    constructor(camera) {
        this.camera = camera;
        this.events = Registry.get('events');
        this.windowDOMSystem = null;
        
        this.hoveredNode = null;
        this.isInnerHoverActive = false;
        this.isLegacyReticleActive = false;
        this._highlightColor = new THREE.Color();

        this._initCrosshair();
        
        this.events.on('INTERACTION:HOVER_START', this.onHoverStart.bind(this));
        this.events.on('INTERACTION:HOVER_UPDATE', this.onHoverUpdate.bind(this));
        this.events.on('INTERACTION:HOVER_END', this.onHoverEnd.bind(this));
        this.events.on('INTERACTION:GRAVITY_GUN_FIRED', this.onGravityGunFired.bind(this));
    }

    setWindowDOMSystem(domSystem) {
        this.windowDOMSystem = domSystem;
    }

    _initCrosshair() {
        if (!document.getElementById('pg-crosshair')) {
            const crosshair = document.createElement('div');
            crosshair.id = 'pg-crosshair';
            crosshair.style.cssText = `position: absolute; top: 50%; left: 50%; width: 14px; height: 14px; border: 2px solid rgba(0, 255, 200, 0.7); border-radius: 50%; transform: translate(-50%, -50%) scale(1); pointer-events: none; z-index: 10000; transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.15s ease, opacity 0.3s ease; mix-blend-mode: screen; opacity: 0;`;
            document.body.appendChild(crosshair);
            this.crosshairDom = crosshair;
        } else {
            this.crosshairDom = document.getElementById('pg-crosshair');
        }
        this._initTargetReticle();
    }

    _initTargetReticle() {
        if (!document.getElementById('pg-target-reticle')) {
            this.targetReticle = document.createElement('div');
            this.targetReticle.id = 'pg-target-reticle';
            this.targetReticle.style.cssText = `position: absolute; pointer-events: none; z-index: 1040; width: 60px; height: 60px; border-radius: 50%; border: 1px solid rgba(0, 255, 200, 0.2); transform: translate(-50%, -50%) scale(0.3); opacity: 0; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s; display: flex; align-items: center; justify-content: center; box-sizing: border-box;`;
            
            const crossH = document.createElement('div');
            crossH.style.cssText = `position: absolute; width: 140%; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,255,200,0.8), transparent);`;
            const crossV = document.createElement('div');
            crossV.style.cssText = `position: absolute; width: 1px; height: 140%; background: linear-gradient(0deg, transparent, rgba(0,255,200,0.8), transparent);`;
            
            this.targetReticle.appendChild(crossH);
            this.targetReticle.appendChild(crossV);

            const innerCircle = document.createElement('div');
            innerCircle.id = 'pg-target-inner';
            innerCircle.style.cssText = `width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0, 255, 200, 0.9); background: rgba(0, 255, 200, 0.2); box-shadow: 0 0 10px rgba(0, 255, 200, 0.6); transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.15s; box-sizing: border-box; z-index: 2;`;
            this.targetReticle.appendChild(innerCircle);
            document.body.appendChild(this.targetReticle);

            const tetherSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            tetherSvg.id = 'pg-tether-svg';
            tetherSvg.style.cssText = `position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 1039;`;
            
            const tetherLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tetherLine.id = 'pg-tether-line';
            tetherLine.setAttribute('stroke', '#00ffc8');
            tetherLine.setAttribute('stroke-width', '1.2');
            tetherLine.setAttribute('stroke-dasharray', '6 6');
            tetherLine.style.opacity = '0';
            tetherSvg.appendChild(tetherLine);
            document.body.appendChild(tetherSvg);

            const tetherDot = document.createElement('div');
            tetherDot.id = 'pg-tether-dot';
            tetherDot.style.cssText = `position: fixed; top: 0; left: 0; pointer-events: none; z-index: 1041; width: 6px; height: 6px; border-radius: 50%; background: #00ffc8; box-shadow: 0 0 8px #00ffc8; transform: translate(-50%, -50%); opacity: 0;`;
            document.body.appendChild(tetherDot);
        } else {
            this.targetReticle = document.getElementById('pg-target-reticle');
        }
    }

    onHoverStart(data) {
        this.hoveredNode = data.node;
        this._cacheNodeVisualState(this.hoveredNode);
        this.isLegacyReticleActive = !!data.isFps;

        if (this.crosshairDom && data.isFps) {
            this.crosshairDom.style.opacity = '1';
            if (!this.hoveredNode.userData?.isDrone && !this.hoveredNode.userData?.isApp) {
                this.crosshairDom.style.transform = 'translate(-50%, -50%) scale(0.5)';
                this.crosshairDom.style.borderColor = 'rgba(255, 60, 60, 1)';
            } else {
                this.crosshairDom.style.transform = 'translate(-50%, -50%) scale(1)';
                this.crosshairDom.style.borderColor = 'rgba(0, 255, 200, 0.7)';
            }
        } else if (this.crosshairDom) {
            this.crosshairDom.style.opacity = '0';
        }

        if (!this.isLegacyReticleActive) {
            this._hideLegacyTargetReticle();
        }

        this.onHoverUpdate(data);
    }

    onHoverUpdate(data) {
        if (!this.hoveredNode) return;
        
        const screenPos = new THREE.Vector3();
        this.hoveredNode.getWorldPosition(screenPos);

        const handSystem = window.Registry?.get('handSystem');
        if (handSystem) handSystem.setIKTarget(screenPos);

        if (!this.isLegacyReticleActive) {
            this._hideLegacyTargetReticle();
            return;
        }

        if (screenPos.z < 0 || screenPos.z > 1) { 
            screenPos.project(this.camera);
            if (screenPos.z < 1) {
                const xOffset = (screenPos.x *  0.5 + 0.5) * window.innerWidth;
                const yOffset = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
                
                if (this.targetReticle) {
                    this.targetReticle.style.left = `${xOffset}px`;
                    this.targetReticle.style.top = `${yOffset}px`;
                    this.targetReticle.style.opacity = '1';
                    this.targetReticle.style.transform = 'translate(-50%, -50%) scale(1)';
                }
                
                const mouseX = (data.mouse.x *  0.5 + 0.5) * window.innerWidth;
                const mouseY = (data.mouse.y * -0.5 + 0.5) * window.innerHeight;
                const dist = Math.hypot(mouseX - xOffset, mouseY - yOffset);
                
                const tetherLine = document.getElementById('pg-tether-line');
                const tetherDot = document.getElementById('pg-tether-dot');

                if (dist < 40) {
                    if (!this.isInnerHoverActive) {
                        this.isInnerHoverActive = true;
                        this._playInnerHoverOn();
                    }
                    if (tetherLine && tetherDot) {
                        tetherLine.setAttribute('x1', String(xOffset));
                        tetherLine.setAttribute('y1', String(yOffset));
                        tetherLine.setAttribute('x2', String(mouseX));
                        tetherLine.setAttribute('y2', String(mouseY));
                        tetherLine.style.opacity = '0.7';
                        
                        tetherDot.style.left = `${mouseX}px`;
                        tetherDot.style.top = `${mouseY}px`;
                        tetherDot.style.opacity = '1';
                    }
                } else {
                    if (this.isInnerHoverActive) {
                        this.isInnerHoverActive = false;
                        this._playInnerHoverOff();
                    }
                    if (tetherLine) tetherLine.style.opacity = '0';
                    if (tetherDot) tetherDot.style.opacity = '0';
                }
            }
        }
    }

    onHoverEnd() {
        if (!this.hoveredNode) return;
        
        const handSystem = window.Registry?.get('handSystem');
        if (handSystem) handSystem.clearIKTarget();

        if (this.isInnerHoverActive) {
            this._playInnerHoverOff();
            this.isInnerHoverActive = false;
        }

        this._hideLegacyTargetReticle();

        this.hoveredNode = null;
        this.isLegacyReticleActive = false;
    }

    onGravityGunFired() {
        if (this.crosshairDom) {
            gsap.fromTo(this.crosshairDom, 
                { scale: 0.2, borderColor: '#fff' },
                { scale: 0.5, borderColor: 'rgba(255, 60, 60, 1)', duration: 0.3, ease: 'back.out' }
            );
        }
    }

    _cacheNodeVisualState(node) {
        node.userData.__hoverBaseScale = { x: node.scale.x, y: node.scale.y, z: node.scale.z };
        const emissiveEntries = [];
        this._forEachNodeMaterial(node, (material) => {
            if (material?.emissive) {
                emissiveEntries.push({ material, r: material.emissive.r, g: material.emissive.g, b: material.emissive.b });
            }
        });
        node.userData.__hoverBaseEmissives = emissiveEntries;
    }

    _playInnerHoverOn() {
        const node = this.hoveredNode;
        if (!node) return;
        
        const inner = this.targetReticle?.querySelector('#pg-target-inner');
        if (inner) {
            inner.style.transform = 'scale(1.35)';
            inner.style.backgroundColor = 'rgba(0, 255, 200, 0.15)';
        }

        const baseScale = node.userData?.__hoverBaseScale || { x: 1, y: 1, z: 1 };
        const scaleBoost = 1.05;
        gsap.to(node.scale, { x: baseScale.x * scaleBoost, y: baseScale.y * scaleBoost, z: baseScale.z * scaleBoost, duration: 0.32, ease: 'back.out(1.45)' });

        const highlight = this._getHighlightEmissive(node);
        this._forEachNodeMaterial(node, (material) => {
            if (!material?.emissive) return;
            gsap.to(material.emissive, { r: highlight.r, g: highlight.g, b: highlight.b, duration: 0.28, ease: 'power2.out' });
        });

    }

    _playInnerHoverOff() {
        const node = this.hoveredNode;
        if (!node) return;
        
        const inner = this.targetReticle?.querySelector('#pg-target-inner');
        if (inner) {
            inner.style.transform = 'scale(1)';
            inner.style.backgroundColor = 'transparent';
        }

        const baseScale = node.userData?.__hoverBaseScale;
        if (baseScale) {
            gsap.to(node.scale, { x: baseScale.x, y: baseScale.y, z: baseScale.z, duration: 0.35, ease: 'back.in(1.2)' });
        }

        const baseEmissives = node.userData?.__hoverBaseEmissives || [];
        for (let i = 0; i < baseEmissives.length; i++) {
            const entry = baseEmissives[i];
            gsap.to(entry.material.emissive, { r: entry.r, g: entry.g, b: entry.b, duration: 0.35, ease: 'power2.out' });
        }

    }

    _getHighlightEmissive(node) {
        const base = node.material?.color || this._highlightColor.setRGB(0.2, 0.86, 0.94);
        return { r: Math.min(1, base.r * 0.55 + 0.18), g: Math.min(1, base.g * 0.55 + 0.28), b: Math.min(1, base.b * 0.55 + 0.42) };
    }

    _forEachNodeMaterial(node, callback) {
        node.traverse((child) => {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (let i = 0; i < materials.length; i++) {
                if (materials[i]) {
                    callback(materials[i], child);
                }
            }
        });
    }

    _hideLegacyTargetReticle() {
        if (this.targetReticle) {
            this.targetReticle.style.opacity = '0';
            this.targetReticle.style.transform = 'translate(-50%, -50%) scale(0.4)';
        }

        const tetherLine = document.getElementById('pg-tether-line');
        const tetherDot = document.getElementById('pg-tether-dot');
        if (tetherLine) tetherLine.style.opacity = '0';
        if (tetherDot) tetherDot.style.opacity = '0';
    }
}
