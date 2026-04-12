import * as THREE from 'three';
import { gsap } from 'gsap';

export class PlayerGauntletsSystem {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.gauntletsContainer = new THREE.Group();
        this.gauntletsContainer.name = "Player_Gauntlets_HUD";
        
        // Attach gauntlets directly to the camera so they follow 1:1 without lag
        this.camera.add(this.gauntletsContainer);
        // Ensure camera is added to scene to render children
        if (!this.camera.parent) {
            this.scene.add(this.camera);
        }

        this.leftHand = this._createCyberGauntlet(true);
        this.rightHand = this._createCyberGauntlet(false);

        // Position them prominently in first-person view
        this.leftHand.position.set(-0.75, -0.55, -1.8);
        this.rightHand.position.set(0.75, -0.55, -1.8);

        // Sleek diagonal inward angle
        this.leftHand.rotation.set(0.1, 0.3, 0.15);
        this.rightHand.rotation.set(0.1, -0.3, -0.15);

        this.gauntletsContainer.add(this.leftHand);
        this.gauntletsContainer.add(this.rightHand);
        
        // HUD Internal Space Lighting (Evita siluetas en fondo negro/noche galáctica)
        const personalLight = new THREE.PointLight(0xddeeff, 2.5, 12);
        personalLight.position.set(0, 1.5, -0.5);
        this.gauntletsContainer.add(personalLight);
        
        const personalAmbient = new THREE.AmbientLight(0xffffff, 0.9);
        this.gauntletsContainer.add(personalAmbient);

        // Idle animation state
        this.time = 0;
        this.isInteracting = false;
        
        console.log('[PlayerGauntletsSystem] Online. First-person hands active.');
    }

    _createCyberGauntlet(isLeft) {
        const group = new THREE.Group();
        const sign = isLeft ? 1 : -1;

        // Material Options
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x1d2331,
            metalness: 0.7,
            roughness: 0.3
        });

        const accentMat = new THREE.MeshStandardMaterial({
            color: 0x2f3950,
            metalness: 0.8,
            roughness: 0.4
        });

        const energyMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            emissive: 0x00e5ff,
            emissiveIntensity: 2.5,
            transparent: true,
            opacity: 0.9
        });

        // 1. Wrist Joint (Sleek Connector passing to the main procedural piston arm)
        const wristGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.2, 8);
        const wrist = new THREE.Mesh(wristGeo, metalMat);
        wrist.rotation.x = Math.PI / 2;
        wrist.position.z = 0.35; // Moved cleanly just behind the palm
        wrist.position.y = -0.05;
        group.add(wrist);

        // 2. Main Hand Palm Base
        const palmGeo = new THREE.BoxGeometry(0.55, 0.25, 0.6);
        const palm = new THREE.Mesh(palmGeo, metalMat);
        group.add(palm);

        // 3. Glowing Core / Reactor on back of hand
        const coreGeo = new THREE.TorusGeometry(0.14, 0.04, 8, 16);
        const core = new THREE.Mesh(coreGeo, energyMat);
        core.position.y = 0.13; // Slightly above the palm
        core.rotation.x = Math.PI / 2;
        group.add(core);

        const innerCoreGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const innerCore = new THREE.Mesh(innerCoreGeo, energyMat);
        innerCore.position.y = 0.13;
        innerCore.scale.set(1, 0.4, 1);
        group.add(innerCore);
        
        group.userData.energyCore = innerCore; // Store for pulse animations

        // 4. Fingers (Procedural)
        const fingersGroup = new THREE.Group();
        fingersGroup.position.z = -0.35; // Front of the palm
        group.add(fingersGroup);

        // X positions matching human fingers: Index to Pinky
        const fingerXPositions = isLeft ? [0.18, 0.06, -0.06, -0.18] : [-0.18, -0.06, 0.06, 0.18]; 
        const fingerLengths = [0.38, 0.42, 0.39, 0.28]; // Index, Middle, Ring, Pinky
        
        for (let i = 0; i < 4; i++) {
            const fGroup = new THREE.Group();
            fGroup.position.x = fingerXPositions[i];
            
            // Base joint (Fallback to Cylinder since Capsule is r137+)
            const baseGeo = new THREE.CylinderGeometry(0.045, 0.045, fingerLengths[i] * 0.5, 8);
            const base = new THREE.Mesh(baseGeo, metalMat);
            base.position.z = -fingerLengths[i] * 0.25;
            base.rotation.x = Math.PI / 2;
            fGroup.add(base);

            // Mid joint
            const midGeo = new THREE.CylinderGeometry(0.035, 0.035, fingerLengths[i] * 0.4, 8);
            const mid = new THREE.Mesh(midGeo, accentMat);
            mid.position.z = -fingerLengths[i] * 0.7;
            mid.position.y = -0.06;
            mid.rotation.x = Math.PI / 2 - 0.25;
            fGroup.add(mid);
            
            // Glowing fingertip
            const tipGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const tip = new THREE.Mesh(tipGeo, energyMat);
            tip.position.z = -fingerLengths[i] * 0.95;
            tip.position.y = -0.12;
            fGroup.add(tip);

            // Natural curve relative to hand
            fGroup.rotation.x = -0.1;
            // Slight splay outward
            fGroup.rotation.y = (fingerXPositions[i] * 0.5);

            fingersGroup.add(fGroup);
        }

        // 5. Thumb
        const thumbGroup = new THREE.Group();
        thumbGroup.position.set(sign * 0.32, -0.05, -0.15); 
        thumbGroup.rotation.y = sign * -0.7; // Angle outward
        thumbGroup.rotation.z = sign * -0.4;
        group.add(thumbGroup);

        const tBaseGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.25, 8);
        const tBase = new THREE.Mesh(tBaseGeo, metalMat);
        tBase.position.x = sign * 0.12;
        tBase.rotation.z = Math.PI / 2;
        thumbGroup.add(tBase);

        const tMidGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 8);
        const tMid = new THREE.Mesh(tMidGeo, accentMat);
        tMid.position.x = sign * 0.35;
        tMid.rotation.z = Math.PI / 2;
        thumbGroup.add(tMid);

        const tTipGeo = new THREE.SphereGeometry(0.045, 8, 8);
        const tTip = new THREE.Mesh(tTipGeo, energyMat);
        tTip.position.x = sign * 0.48;
        thumbGroup.add(tTip);

        // 6. Cyber Armor plating
        const armorGeo = new THREE.BoxGeometry(0.65, 0.05, 0.65);
        const armor = new THREE.Mesh(armorGeo, accentMat);
        armor.position.y = 0.16;
        armor.position.z = 0.05;
        armor.rotation.x = -0.05;
        group.add(armor);

        return group;
    }

    update(deltaTime) {
        this.time += deltaTime;

        // Subtle idle breathing animation
        if (!this.isInteracting) {
            const breath = Math.sin(this.time * 2) * 0.015;
            const sway = Math.cos(this.time * 1.2) * 0.01;

            this.leftHand.position.y = -0.55 + breath;
            this.leftHand.position.x = -0.75 + sway;
            this.leftHand.rotation.z = 0.15 + sway * 1.5;

            this.rightHand.position.y = -0.55 + breath;
            this.rightHand.position.x = 0.75 - sway;
            this.rightHand.rotation.z = -0.15 - sway * 1.5;

            // Pulse cores
            const pulse = (Math.sin(this.time * 3) + 1) * 0.5; // 0 to 1
            if(this.leftHand.userData.energyCore) {
                this.leftHand.userData.energyCore.material.emissiveIntensity = 1.8 + pulse * 1.5;
            }
            if(this.rightHand.userData.energyCore) {
                this.rightHand.userData.energyCore.material.emissiveIntensity = 1.8 + pulse * 1.5;
            }
        }
    }

    animateGrab() {
        this.isInteracting = true;

        // Bring hands elegantly inward and upward for Gravity Gun hold
        gsap.to(this.leftHand.position, {
            x: -0.45, y: -0.25, z: -1.3, duration: 0.5, ease: "back.out(1.2)"
        });
        gsap.to(this.leftHand.rotation, {
            x: 0.4, y: 0.6, z: 0.5, duration: 0.5, ease: "back.out(1.2)"
        });

        gsap.to(this.rightHand.position, {
            x: 0.45, y: -0.25, z: -1.3, duration: 0.5, ease: "back.out(1.2)"
        });
        gsap.to(this.rightHand.rotation, {
            x: 0.4, y: -0.6, z: -0.5, duration: 0.5, ease: "back.out(1.2)"
        });

        if(this.leftHand.userData.energyCore) {
            gsap.to(this.leftHand.userData.energyCore.material, { emissiveIntensity: 5.0, duration: 0.3 });
            gsap.to(this.rightHand.userData.energyCore.material, { emissiveIntensity: 5.0, duration: 0.3 });
        }
    }

    animateRelease() {
        gsap.to(this.leftHand.position, {
            x: -0.75, y: -0.55, z: -1.8, duration: 0.7, ease: "power2.out"
        });
        gsap.to(this.leftHand.rotation, {
            x: 0.1, y: 0.3, z: 0.15, duration: 0.7, ease: "power2.out"
        });

        gsap.to(this.rightHand.position, {
            x: 0.75, y: -0.55, z: -1.8, duration: 0.7, ease: "power2.out",
            onComplete: () => { this.isInteracting = false; }
        });

        if(this.leftHand.userData.energyCore) {
            gsap.to(this.leftHand.userData.energyCore.material, { emissiveIntensity: 1.8, duration: 0.7 });
            gsap.to(this.rightHand.userData.energyCore.material, { emissiveIntensity: 1.8, duration: 0.7 });
        }
    }
}
