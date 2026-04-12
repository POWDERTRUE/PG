import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class HandInteractionSystem {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        
        // Animadores
        this.mixers = [];
        this.actions = { left: {}, right: {} };
        
        // Contenedores de las manos pegados a la cámara
        this.leftHand = new THREE.Group();
        this.leftHand.scale.set(0, 0, 0); 
        this.rightHand = new THREE.Group();
        this.rightHand.scale.set(0, 0, 0);
        this.camera.add(this.leftHand);
        this.camera.add(this.rightHand);
        
        // Coordenadas del ratón para el efecto Parallax
        this.mouse = new THREE.Vector2();
        this.targetRotation = { x: 0, y: 0 };

        // --- Espacio de variables IK (Cinemática Inversa) ---
        this.pointingBone = null;
        this.ikTargetWorld = null;
        this.ikActive = false;
        
        this.baseBoneRotation = new THREE.Quaternion();
        this.targetBoneRotation = new THREE.Quaternion();
        this._targetScaleLeft = new THREE.Vector3();
        this._targetScaleRight = new THREE.Vector3();
        this._localTarget = new THREE.Vector3();
        this._currentQuat = new THREE.Quaternion();

        // --- Hologram Cybernetics ---
        this.indexFingerBone = null;
        this.holoAuraMaterial = null;
        this.targetHoloOpacity = 0.0;

        this._initHands();
        this._setupInputListeners();
    }

    _initHands() {
        const loader = new GLTFLoader();

        // 1. Cargar Mano Izquierda (Esquina superior izquierda)
        loader.load('assets/models/mano_izquierda.glb', (gltf) => {
            const model = gltf.scene;
            
            // Posicionar arriba a la izquierda, frente a la cámara
            model.position.set(-2.5, 1.5, -4); 
            // Rotar para que apunte hacia la pantalla
            model.rotation.set(0.2, 0.5, -0.3); 
            model.scale.set(1.2, 1.2, 1.2);

            this.leftHand.add(model);
            this._setupAnimations(gltf, 'left');
        });

        // 2. Cargar Mano Derecha (Lado derecho, interactuando con UI)
        loader.load('assets/models/mano_derecha.glb', (gltf) => {
            const model = gltf.scene;
            
            // Posicionar a la derecha, un poco más abajo
            model.position.set(2.5, -0.5, -3.5);
            // Rotar para apuntar al centro
            model.rotation.set(-0.1, -0.4, 0.1);

            // Búsqueda profunda del Hueso Pivote para la IK Next-Gen y Hologramas
            model.traverse((child) => {
                if (child.isBone && child.name === 'Wrist_R') { 
                    this.pointingBone = child;
                    this.baseBoneRotation.copy(child.quaternion);
                }
                if (child.isBone && child.name === 'Index_Tip_R') { 
                    this.indexFingerBone = child;
                    const aura = this._createHolographicAura();
                    this.indexFingerBone.add(aura);
                }
            });

            this.rightHand.add(model);
            this._setupAnimations(gltf, 'right');
        });
    }

    _createHolographicAura() {
        const geometry = new THREE.SphereGeometry(0.05, 16, 16); 
        this.holoAuraMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff, 
            transparent: true,
            opacity: 0.0, 
            blending: THREE.AdditiveBlending, 
            depthWrite: false, 
            wireframe: true 
        });

        const auraMesh = new THREE.Mesh(geometry, this.holoAuraMaterial);
        auraMesh.position.set(0, 0.05, 0); 
        return auraMesh;
    }

    _setupAnimations(gltf, side) {
        if (gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(gltf.scene);
            this.mixers.push(mixer);

            // Mapear animaciones (asumiendo que tus modelos tienen estas animaciones)
            gltf.animations.forEach((clip) => {
                const action = mixer.clipAction(clip);
                this.actions[side][clip.name.toLowerCase()] = action;
            });

            // Reproducir animación de reposo por defecto
            if (this.actions[side]['idle']) {
                this.actions[side]['idle'].play();
            }
        }
    }

    _setupInputListeners() {
        // Rastrear el ratón para que la mano derecha lo siga ligeramente
        window.addEventListener('mousemove', (event) => {
            // Normalizar coordenadas del ratón de -1 a 1
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // La mano derecha seguirá el puntero sutilmente
            this.targetRotation.x = -this.mouse.y * 0.3; 
            this.targetRotation.y = this.mouse.x * 0.5;
        });

        // Animación de Clic
        window.addEventListener('mousedown', () => {
            this.playAnimationOnce('right', 'click');
        });

        // Animación de Tecleo (Keyboard)
        window.addEventListener('keydown', (event) => {
            // Animamos la mano izquierda cuando presionas teclas de control/atajos
            if (event.code === 'Escape' || event.code === 'Tab') {
                this.playAnimationOnce('left', 'tap');
            }
        });
    }

    playAnimationOnce(side, animName) {
        const action = this.actions[side][animName];
        const idleAction = this.actions[side]['idle'];

        if (action) {
            // Transición suave del Idle al Clic
            action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            if (idleAction) {
                action.crossFadeFrom(idleAction, 0.1, true).play();
            } else {
                action.play();
            }

            // Volver al Idle cuando termine el clic
            this.mixers.forEach(m => {
                const listener = (e) => {
                    if (e.action === action && idleAction) {
                        idleAction.reset().play();
                        idleAction.crossFadeFrom(action, 0.2, true);
                        m.removeEventListener('finished', listener);
                    }
                };
                m.addEventListener('finished', listener);
            });
        }
    }

    setIKTarget(worldPosition) {
        if (!worldPosition) {
            this.ikActive = false;
            return;
        }
        if (!this.ikTargetWorld) this.ikTargetWorld = new THREE.Vector3();
        this.ikTargetWorld.copy(worldPosition);
        this.ikActive = true;
        this.targetHoloOpacity = 0.8;
    }

    clearIKTarget() {
        this.ikActive = false;
        this.targetHoloOpacity = 0.0;
    }

    // Llama a este método dentro de tu ciclo requestAnimationFrame
    update(deltaTime) {
        // 0. Control de Visibilidad HUD Dinámico según Estado de Navegación
        if (!this.navigationSystem) {
            const reg = window.Registry;
            this.navigationSystem = reg?.tryGet ? reg.tryGet('navigationSystem') : reg?.get?.('navigationSystem');
        }

        let isVisible = false;
        if (this.navigationSystem) {
            const state = this.navigationSystem.state;
            const inputState = window.Registry?.tryGet ? window.Registry.tryGet('InputStateSystem') : window.Registry?.get?.('InputStateSystem');
            // Ocultar manos durante Intro, Menús o Secuencias de Salto Warp
            isVisible = state !== 'WARP' && state !== 'WARPING' && state !== 'BOOTING' && state !== 'MOUSE_UI' && !inputState?.hudMode;
        }

        const targetScaleLeft = isVisible ? 1.0 : 0.0;
        const targetScaleRight = isVisible ? 1.0 : 0.0;
        
        this._targetScaleLeft.set(targetScaleLeft, targetScaleLeft, targetScaleLeft);
        this._targetScaleRight.set(targetScaleRight, targetScaleRight, targetScaleRight);
        this.leftHand.scale.lerp(this._targetScaleLeft, deltaTime * 8);
        this.rightHand.scale.lerp(this._targetScaleRight, deltaTime * 8);


        // 1. Actualizar animaciones de huesos (Mixers)
        this.mixers.forEach(mixer => mixer.update(deltaTime));

        // 2. Efecto Parallax Suave (Lerp) para la mano derecha apuntando
        if (this.rightHand.children.length > 0) {
            const handModel = this.rightHand.children[0];
            if (this.targetRotation) {
                handModel.rotation.x += ((this.targetRotation.x || 0) - handModel.rotation.x) * 10 * deltaTime;
                handModel.rotation.y += ((this.targetRotation.y || 0) - handModel.rotation.y) * 10 * deltaTime;
            }
        }
        
        // Efecto de "respiración" o flotación para la mano izquierda
        if (this.leftHand.children.length > 0) {
            const time = performance.now() * 0.001;
            this.leftHand.position.y = 1.5 + Math.sin(time) * 0.05;
        }

        // 3. Ejecutar Lógica de IK en el hueso extraído de la mano derecha
        if (this.pointingBone) {
            if (this.ikActive && this.ikTargetWorld) {
                // Traducción de la cordenada Mundial del Sistema Solar al Espacio Local de la muñeca (pegada a la cámara)
                this._localTarget.copy(this.ikTargetWorld);
                const localTarget = this.pointingBone.parent.worldToLocal(this._localTarget);
                
                // Backup orgánico
                this._currentQuat.copy(this.pointingBone.quaternion);

                // Fake LookAt 
                this.pointingBone.lookAt(localTarget);
                
                // OFFSET DE CORRECCIÓN (Descomentar si la mano apunta con un lado raro)
                // this.pointingBone.rotateX(Math.PI / 2); 
                // this.pointingBone.rotateY(-Math.PI / 2); 

                this.targetBoneRotation.copy(this.pointingBone.quaternion);
                this.pointingBone.quaternion.copy(this._currentQuat); // Revert to reality

                // Slerp fluido hacia la meta ideal calculada
                this.pointingBone.quaternion.slerp(this.targetBoneRotation, deltaTime * 8);
            } else {
                // Return to Idle Relaxed State
                this.pointingBone.quaternion.slerp(this.baseBoneRotation, deltaTime * 5);
            }
        }

        // 4. ANIMAR EL HOLOGRAMA
        if (this.holoAuraMaterial) {
            this.holoAuraMaterial.opacity += (this.targetHoloOpacity - this.holoAuraMaterial.opacity) * 10 * deltaTime;

            if (this.targetHoloOpacity > 0) {
                const time = performance.now() * 0.005;
                this.holoAuraMaterial.opacity = 0.5 + Math.sin(time) * 0.3; 
                
                if (this.indexFingerBone && this.indexFingerBone.children.length > 0) {
                    this.indexFingerBone.children[0].rotation.y += deltaTime;
                    this.indexFingerBone.children[0].rotation.x += deltaTime * 0.5;
                }
            }
        }
    }

    dispose() {
        for (const mixer of this.mixers) {
            mixer.stopAllAction?.();
            const root = mixer.getRoot?.();
            if (root) mixer.uncacheRoot?.(root);
        }
        this.mixers = [];

        const disposeObject = (object) => {
            object.traverse?.((child) => {
                child.geometry?.dispose?.();
                if (Array.isArray(child.material)) {
                    child.material.forEach((material) => material?.dispose?.());
                } else {
                    child.material?.dispose?.();
                }
            });
            object.parent?.remove(object);
        };

        disposeObject(this.leftHand);
        disposeObject(this.rightHand);
        this.holoAuraMaterial = null;
        this.pointingBone = null;
        this.indexFingerBone = null;
    }
}
