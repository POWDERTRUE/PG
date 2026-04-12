// frontend/src/engine/ui/lulu/LULUSpatialObjectSpawnerSystem.js
import * as THREE from 'three';
import { Registry } from '../../core/ServiceRegistry.js';
import { gsap } from 'gsap';

export class LULUSpatialObjectSpawnerSystem {
    constructor(kernel) {
        this.kernel = kernel;
        this.registry = Registry;
        this.scene = null;
        this.camera = null;
        
        this.bodies = [];
        this.objectTypes = {
            'esfera':   { geo: () => new THREE.SphereGeometry(0.5, 32, 32), mass: 1, radius: 0.5 },
            'cubo':     { geo: () => new THREE.BoxGeometry(1, 1, 1), mass: 2, radius: 0.866 },
            'cilindro': { geo: () => new THREE.CylinderGeometry(0.3, 0.3, 1.2, 32), mass: 1.5, radius: 0.65 },
            'cono':     { geo: () => new THREE.ConeGeometry(0.5, 1.2, 32), mass: 1.2, radius: 0.65 },
            'torus':    { geo: () => new THREE.TorusGeometry(0.4, 0.15, 16, 100), mass: 0.8, radius: 0.55 },
            'default':  { geo: () => new THREE.SphereGeometry(0.4, 32, 32), mass: 1, radius: 0.4 }
        };
        
        this.isEditMode = false;
        this.editingBody = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.previousCameraPosition = new THREE.Vector3();
        this._hasPreviousCameraPosition = false;
        this._cameraDelta = new THREE.Vector3();
        this._worldPos = new THREE.Vector3();
        this._targetOffset = new THREE.Vector3();
        this._fallbackCameraPos = new THREE.Vector3();
    }

    init() {
        console.log('[LULU Spawner] Sistema de objetos espaciales inicializado');
        
        this.scene = Registry.get('kernel').scene;
        this.camera = Registry.get('camera') || Registry.get('kernel').camera;
        
        // Marcador visual de selección
        const markerGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        const markerMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
        this.selectionMarker = new THREE.LineSegments(markerGeo, markerMat);
        this.selectionMarker.visible = false;
        this.scene.add(this.selectionMarker);
        
        window.LULU_SPAWNER = this;
        this._initPhysicsBuffers(); // V31 — zero-GC collision buffers
        this.setupInteractions();
    }

    setupInteractions() {
        window.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return; // Clic izquierdo
            if (this.isWorkspaceInputExclusive() && !this._isUiTarget(e.target)) return;
            
            let isLocked = !!document.pointerLockElement;
            
            // Si no estamos sobre el canvas y no está bloqueado, no seleccionar ni rotar para no interferir con la UI
            if (!isLocked && e.target.tagName !== 'CANVAS') return;
            
            if (this.editingBody && !isLocked) {
                // Iniciar rotación manual en modo mouse
                this.isDragging = true;
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
            }
            
            if (isLocked) {
                this.mouse.x = 0; // Centro de la pantalla (crosshair)
                this.mouse.y = 0;
            } else {
                this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            }
            
            if (!this.camera || !this.scene) return;
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            
            // Ignorar los objetos que ya se han convertido en satélites
            const activeBodies = this.bodies.filter(b => !b.isSatellite);
            const meshes = activeBodies.map(b => b.mesh);
            const intersects = this.raycaster.intersectObjects(meshes);
            
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                const body = activeBodies.find(b => b.mesh === hitMesh);
                if (body && !body.isEditing) {
                    this.enterEditMode(body);
                }
            } else if (this.editingBody) {
                // Si estamos editando y hacemos clic fuera... ¿Hemos hecho clic en un mundo/masa del Universo?
                const allIntersects = this.raycaster.intersectObjects(this.scene.children, true);
                let hitMass = null;
                
                for (let hit of allIntersects) {
                    let obj = hit.object;
                    let isMass = false;
                    while (obj && !isMass) {
                        if (obj.name && (obj.name.includes('Planet') || obj.name.includes('Sun') || obj.name.includes('Moon'))) {
                            hitMass = obj;
                            isMass = true;
                        }
                        obj = obj.parent;
                    }
                    if (hitMass) break;
                }
                
                if (hitMass) {
                    // CÓDIGO NIVEL INGENIERÍA: Mover el cubo a la órbita de este mundo
                    this.attachToOrbit(this.editingBody, hitMass);
                    this.exitEditMode(true); // Soltar suavemente sin gravedad
                } else {
                    // Soltar normalmente en el espacio (física de caída)
                    this.exitEditMode(false);
                }
            }
        });
        
        window.addEventListener('pointermove', (e) => {
            if (this.isDragging && this.editingBody && !document.pointerLockElement) {
                const deltaMove = {
                    x: e.clientX - this.previousMousePosition.x,
                    y: e.clientY - this.previousMousePosition.y
                };

                // Rotar el objeto en su propio eje basándose en el mouse
                this.editingBody.mesh.rotation.y += deltaMove.x * 0.01;
                this.editingBody.mesh.rotation.x += deltaMove.y * 0.01;
                
                // Actualizar los sliders del UI
                const rx = document.getElementById('lm-rot-x');
                const ry = document.getElementById('lm-rot-y');
                if (rx && ry) {
                    let newRx = this.editingBody.mesh.rotation.x % 6.28;
                    if (newRx < 0) newRx += 6.28;
                    let newRy = this.editingBody.mesh.rotation.y % 6.28;
                    if (newRy < 0) newRy += 6.28;
                    rx.value = newRx;
                    ry.value = newRy;
                    document.getElementById('lm-val-rx').innerText = newRx.toFixed(1);
                    document.getElementById('lm-val-ry').innerText = newRy.toFixed(1);
                }

                this.previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });

        window.addEventListener('contextmenu', e => {
            // Prevenir menu predeterminado si editamos
            if(this.mouse) e.preventDefault();
        });
        
        window.addEventListener('wheel', e => {
            if (this.editingBody && !this.isWorkspaceInputExclusive()) {
                this.scrollDelta = Math.sign(e.deltaY); // Direct step direction
            }
        }, { passive: true });
    }

    isWorkspaceInputExclusive() {
        const input = Registry.tryGet('InputStateSystem') ?? null;
        const hudMode = !!(input?.hudMode ?? false);
        return hudMode && !!(this.editingBody || document.getElementById('lulu-modeler-panel'));
    }

    _isUiTarget(target) {
        return !!target?.closest?.(
            [
                '#window-layer',
                '#kernel-bar',
                '#lulu-panel',
                '#lulu-response-wrap',
                '#lulu-response-panel',
                '#lulu-modeler-panel',
                '.glass-window',
                '.glass-panel',
                '.window-shelf',
                '.kernel-dock',
                'button',
                'input',
                'textarea',
                'select',
                '[contenteditable="true"]',
            ].join(', ')
        );
    }

    enterEditMode(body) {
        if (this.editingBody) {
             this.exitEditMode();
        }
        
        body.isEditing = true;
        body.isLevitating = false;
        
        if (body.originalScale && !body.isNewlySpawned) {
             gsap.to(body.mesh.scale, {
                 x: body.originalScale.x,
                 y: body.originalScale.y,
                 z: body.originalScale.z,
                 duration: 0.5,
                 ease: "back.out(1.5)"
             });
        }
        body.isNewlySpawned = false;
        
        this.editingBody = body;
        
        let gauntlets = null;
        try { gauntlets = this.registry.get('HandInteractionSystem'); } catch(e) {}
        if (gauntlets && gauntlets.animateGrab) gauntlets.animateGrab();
        
        // Detener física
        body.velocity.set(0, 0, 0);
        
        // Levitar el objeto frente a la cámara como una "Gravity Gun"
        // Colocándolo ligeramente a la derecha para dejar espacio al UI
        body.targetLocalPos = new THREE.Vector3(1.5, -0.4, -6);
        this.selectionMarker.visible = true;
        
        this.buildModelerUI(body);
    }
    
    attachToOrbit(body, targetMass) {
        console.log(`[LULU] Convirtiendo ${body.id} en Satélite Físico de ${targetMass.name}`);
        body.isSatellite = true;
        
        // Guardar la posición actual en el mundo para la animación de transición
        const startWorldPos = new THREE.Vector3();
        body.mesh.getWorldPosition(startWorldPos);
        
        // Crear Pivot de Rotación en el centro del planeta
        const pivot = new THREE.Object3D();
        targetMass.add(pivot);
        pivot.add(body.mesh);
        
        // Ajustar la escala de forma dinámica
        const worldScale = new THREE.Vector3();
        targetMass.getWorldScale(worldScale);
        body.mesh.scale.divide(worldScale);
        
        // Calcular radio más cercano (1.1 en vez de 1.3)
        if (!targetMass.geometry.boundingSphere) targetMass.geometry.computeBoundingSphere();
        const planetBoundRadius = targetMass.geometry.boundingSphere ? targetMass.geometry.boundingSphere.radius : 1.0;
        const orbitRadius = planetBoundRadius * 1.1; 
        
        // Configurar ángulo inicial en el espacio
        pivot.rotation.y = Math.random() * Math.PI * 2;
        
        // Compensamos localmente el mesh para que visualmente empiece en la misma posición que estaba levitando
        pivot.worldToLocal(startWorldPos);
        body.mesh.position.copy(startWorldPos);
        
        // Animación refinada: Vuelo elíptico curvado hacia su posición orbital estable
        gsap.to(body.mesh.position, {
            x: orbitRadius,
            y: (Math.random() - 0.5) * (planetBoundRadius * 0.3), // Ligera desalineación ecuatorial para variar las órbitas
            z: 0,
            duration: 1.8,
            ease: "power2.inOut"
        });
        
        // Registrando el Pivot (para que orbite) en vez del mesh (que solo rotaría en su eje)
        const physics = Registry.get('kernel').physicsSystem;
        if (physics && physics.registerOrbit) {
            const speed = (Math.random() * 0.3) + 0.15; 
            physics.registerOrbit(pivot, speed);
        }
    }
    
    exitEditMode(attachedToOrbit = false) {
        if (!this.editingBody) return;
        
        const body = this.editingBody;
        body.isEditing = false;

        let gauntlets = null;
        try { gauntlets = this.registry.get('HandInteractionSystem'); } catch(e) {}
        if (gauntlets && gauntlets.animateRelease) gauntlets.animateRelease();
        
        // Solo darle modo levitación si NO lo pegamos a un planeta
        if (!attachedToOrbit) {
            body.isLevitating = true;
            body.originalScale = body.mesh.scale.clone();
            
            // Asignamos una posición ligeramente aleatoria para que floten agrupados sin solaparse (como un enjambre)
            body.levitationOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 1.6,
                (Math.random() - 0.5) * 1.6,
                (Math.random() - 0.5) * 0.6
            );
            
            // Se reduce la escala de manera animada
            const scaleMultiplier = 0.4;
            gsap.to(body.mesh.scale, {
                x: body.originalScale.x * scaleMultiplier,
                y: body.originalScale.y * scaleMultiplier,
                z: body.originalScale.z * scaleMultiplier,
                duration: 0.5,
                ease: "power2.out"
            });
        }
        
        this.editingBody = null;
        this.selectionMarker.visible = false;
        
        const panel = document.getElementById('lulu-modeler-panel');
        if (panel) panel.remove();
    }

    storeInBackpack() {
        if (!this.editingBody) return;
        
        const body = this.editingBody;
        body.isEditing = false;
        this.editingBody = null;
        this.selectionMarker.visible = false;

        const gauntlets = this.registry.get('PlayerGauntlets');
        if (gauntlets) gauntlets.animateRelease();
        
        const panel = document.getElementById('lulu-modeler-panel');
        if (panel) panel.remove();
        
        // Animacion HUD: Se encoge y cae a la "mochila"
        gsap.to(body.mesh.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: "back.in(1.5)" });
        gsap.to(body.mesh.position, {
            y: body.mesh.position.y - 3,
            duration: 0.4,
            ease: "power2.in"
        });
        
        setTimeout(() => {
            if (this.scene) this.scene.remove(body.mesh);
            this.bodies = this.bodies.filter(b => b.id !== body.id);
            console.log(`[LULU] Objeto ${body.id} guardado en la mochila holográfica.`);
            window.dispatchEvent(new CustomEvent('LULU_BACKPACK_STORE', { detail: { id: body.id } }));
        }, 450);
    }

    buildModelerUI(body) {
        const existing = document.getElementById('lulu-modeler-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'lulu-modeler-panel';
        panel.style.cssText = `
            position: absolute; left: 20px; top: 18%;
            width: 300px; padding: 20px;
            background: rgba(10, 20, 30, 0.85); backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 12px;
            color: #fff; font-family: monospace; z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,255,255,0.15);
            pointer-events: auto;
        `;
        
        const scaleX = body.mesh.scale.x;
        const scaleY = body.mesh.scale.y;
        const scaleZ = body.mesh.scale.z;
        const rotX = body.mesh.rotation.x;
        const rotY = body.mesh.rotation.y;
        const rotZ = body.mesh.rotation.z;
        const isWireframe = body.mesh.material.wireframe;
        const emissiveInt = body.mesh.material.emissiveIntensity;
        const currentColor = '#' + body.mesh.material.color.getHexString();
        
        panel.innerHTML = `
            <h3 style="color:#00e5ff; text-transform:uppercase; margin-top:0;">LULU Modeler</h3>
            <p style="font-size:12px; color:#aaa; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">
                Control absoluto del poligono en la dimension virtual.
            </p>
            
            <div style="margin-bottom: 8px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Escala X <span id="lm-val-x">${scaleX.toFixed(1)}</span></label>
                <input id="lm-scale-x" type="range" min="0.1" max="5" step="0.1" value="${scaleX}" style="width:100%">
            </div>
            <div style="margin-bottom: 8px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Escala Y <span id="lm-val-y">${scaleY.toFixed(1)}</span></label>
                <input id="lm-scale-y" type="range" min="0.1" max="5" step="0.1" value="${scaleY}" style="width:100%">
            </div>
            <div style="margin-bottom: 12px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Escala Z <span id="lm-val-z">${scaleZ.toFixed(1)}</span></label>
                <input id="lm-scale-z" type="range" min="0.1" max="5" step="0.1" value="${scaleZ}" style="width:100%">
            </div>

            <div style="margin-bottom: 8px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Rotación X <span id="lm-val-rx">${rotX.toFixed(1)}</span></label>
                <input id="lm-rot-x" type="range" min="0" max="6.28" step="0.1" value="${rotX}" style="width:100%">
            </div>
            <div style="margin-bottom: 8px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Rotación Y <span id="lm-val-ry">${rotY.toFixed(1)}</span></label>
                <input id="lm-rot-y" type="range" min="0" max="6.28" step="0.1" value="${rotY}" style="width:100%">
            </div>
            <div style="margin-bottom: 12px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Rotación Z <span id="lm-val-rz">${rotZ.toFixed(1)}</span></label>
                <input id="lm-rot-z" type="range" min="0" max="6.28" step="0.1" value="${rotZ}" style="width:100%">
            </div>
            
            <div style="margin-bottom: 12px; font-size: 13px; display:flex; justify-content:space-between; align-items:center;">
                <label>Color Base</label>
                <input id="lm-color" type="color" value="${currentColor}" style="border:none; width:30px; height:30px; background:none; cursor:pointer;">
            </div>

            <div style="margin-bottom: 12px; font-size: 13px; display:flex; justify-content:space-between; align-items:center;">
                <label>Modo Wireframe</label>
                <input id="lm-wireframe" type="checkbox" ${isWireframe ? 'checked' : ''} style="width:18px; height:18px;">
            </div>
            
            <div style="margin-bottom: 20px; font-size: 13px;">
                <label style="display:flex; justify-content:space-between;">Radiación <span id="lm-val-glow">${emissiveInt.toFixed(1)}</span></label>
                <input id="lm-glow" type="range" min="0" max="3" step="0.1" value="${emissiveInt}" style="width:100%">
            </div>
            
            <button id="lm-close" style="
                width: 100%; padding: 12px; background: #00e5ff; 
                color: #000; border: none; font-weight: bold; cursor: pointer; border-radius: 6px;
                transition: transform 0.1s;
            ">TERMINAR EDICION</button>
        `;
        
        document.body.appendChild(panel);
        
        const updateScale = () => {
             const sx = parseFloat(document.getElementById('lm-scale-x').value);
             const sy = parseFloat(document.getElementById('lm-scale-y').value);
             const sz = parseFloat(document.getElementById('lm-scale-z').value);
             body.mesh.scale.set(sx, sy, sz);
             document.getElementById('lm-val-x').innerText = sx.toFixed(1);
             document.getElementById('lm-val-y').innerText = sy.toFixed(1);
             document.getElementById('lm-val-z').innerText = sz.toFixed(1);
        };

        const updateRot = () => {
             const rx = parseFloat(document.getElementById('lm-rot-x').value);
             const ry = parseFloat(document.getElementById('lm-rot-y').value);
             const rz = parseFloat(document.getElementById('lm-rot-z').value);
             body.mesh.rotation.set(rx, ry, rz);
             document.getElementById('lm-val-rx').innerText = rx.toFixed(1);
             document.getElementById('lm-val-ry').innerText = ry.toFixed(1);
             document.getElementById('lm-val-rz').innerText = rz.toFixed(1);
        };
        
        document.getElementById('lm-scale-x').addEventListener('input', updateScale);
        document.getElementById('lm-scale-y').addEventListener('input', updateScale);
        document.getElementById('lm-scale-z').addEventListener('input', updateScale);

        document.getElementById('lm-rot-x').addEventListener('input', updateRot);
        document.getElementById('lm-rot-y').addEventListener('input', updateRot);
        document.getElementById('lm-rot-z').addEventListener('input', updateRot);
        
        document.getElementById('lm-color').addEventListener('input', (e) => {
             body.mesh.material.color.set(e.target.value);
             body.mesh.material.emissive.set(e.target.value);
        });

        document.getElementById('lm-wireframe').addEventListener('change', (e) => {
             body.mesh.material.wireframe = e.target.checked;
        });
        
        document.getElementById('lm-glow').addEventListener('input', (e) => {
             const val = parseFloat(e.target.value);
             body.mesh.material.emissiveIntensity = val;
             document.getElementById('lm-val-glow').innerText = val.toFixed(1);
        });
        
        const closeBtn = document.getElementById('lm-close');
        closeBtn.addEventListener('click', () => this.exitEditMode());
        closeBtn.addEventListener('mousedown', () => closeBtn.style.transform = 'scale(0.96)');
        closeBtn.addEventListener('mouseup', () => closeBtn.style.transform = 'scale(1)');
    }

    spawnObject(typeName) {
        return this.spawnBlueprint({ type: typeName, label: typeName });
    }

    spawnBlueprint(blueprint = {}) {
        const normalizedType = (blueprint.type || 'default').toLowerCase();
        const built = this._buildSpawnMesh({ ...blueprint, type: normalizedType });
        if (!built?.mesh) {
            return null;
        }

        const mesh = built.mesh;
        mesh.position.copy(this._buildSpawnPosition());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        this.scene.add(mesh);

        const id = `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        mesh.name = `${built.label || normalizedType}_${id}`;
        mesh.userData = {
            ...(mesh.userData || {}),
            isMass: ['planet', 'star', 'black_hole', 'cluster'].includes(normalizedType),
            nodeType: normalizedType,
            label: built.label || normalizedType,
            createdBy: 'LULU',
            luluBlueprint: blueprint
        };

        const bodyObj = {
            id,
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            mass: built.mass,
            radius: built.radius,
            isNewlySpawned: true,
            originalScale: new THREE.Vector3(1, 1, 1),
            blueprint
        };
        this.bodies.push(bodyObj);

        const celestialRegistry = this.registry.tryGet('celestialRegistry') || this.registry.tryGet('CelestialRegistry');
        if (celestialRegistry?.register && mesh.userData.isMass) {
            const typeTag = normalizedType === 'planet'
                ? 'PLANET'
                : normalizedType === 'satellite'
                    ? 'MOON'
                    : 'BLUESUN';
            celestialRegistry.register(mesh, typeTag, 'LULU');
        }

        mesh.scale.setScalar(0.25);
        gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: "elastic.out(1, 0.3)" });

        console.log(`[LULU Spawner] ${normalizedType} creado. Inicializando modo de edicion...`);
        this.enterEditMode(bodyObj);
        return bodyObj;
    }

    _buildSpawnPosition() {
        const spawnPos = new THREE.Vector3(0, 0.6, -9);
        if (this.camera) {
            spawnPos.applyMatrix4(this.camera.matrixWorld);
            spawnPos.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.5,
                Math.random() * 1.8 + 0.8,
                (Math.random() - 0.5) * 2.0
            ));
        }
        return spawnPos;
    }

    _buildSpawnMesh(blueprint) {
        const type = blueprint.type;
        switch (type) {
        case 'planet':
            return this._createPlanetMesh(blueprint);
        case 'star':
            return this._createStarMesh(blueprint);
        case 'black_hole':
            return this._createBlackHoleMesh(blueprint);
        case 'nebula':
            return this._createNebulaMesh(blueprint);
        case 'cluster':
            return this._createClusterMesh(blueprint);
        case 'satellite':
            return this._createSatelliteMesh(blueprint);
        case 'station':
            return this._createStationMesh(blueprint);
        case 'asteroid':
            return this._createAsteroidMesh(blueprint);
        case 'portal':
            return this._createPortalMesh(blueprint);
        default:
            return this._createPrimitiveMesh(type, blueprint);
        }
    }

    _createPrimitiveMesh(typeName, blueprint) {
        const type = this.objectTypes[typeName] || this.objectTypes.default;
        const material = new THREE.MeshPhysicalMaterial({
            color: blueprint.color || 0xffffff,
            emissive: blueprint.color || 0xffffff,
            emissiveIntensity: 0.45,
            metalness: 0.2,
            roughness: 0.16,
            clearcoat: 1.0,
            transparent: true,
            opacity: 0.95
        });

        return {
            mesh: new THREE.Mesh(type.geo(), material),
            mass: type.mass,
            radius: type.radius,
            label: blueprint.label || typeName
        };
    }

    _planetPalette(planetClass, colorOverride) {
        const palettes = {
            ocean: { base: colorOverride || 0x3388ff, atmosphere: 0x9cc6ff, ring: 0xb8d9ff },
            desert: { base: colorOverride || 0xcc8844, atmosphere: 0xffc68b, ring: 0xe8c08f },
            gas_giant: { base: colorOverride || 0xffaa55, atmosphere: 0xffddaa, ring: 0xd6c09b },
            ice: { base: colorOverride || 0xaaddff, atmosphere: 0xdff5ff, ring: 0xe7fbff },
            volcanic: { base: colorOverride || 0xff5522, atmosphere: 0xffaa55, ring: 0x663300 },
            jungle: { base: colorOverride || 0x44bb66, atmosphere: 0x8ff0b0, ring: 0xb1ffd4 },
        };
        return palettes[planetClass] || palettes.ocean;
    }

    _createPlanetMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.1 * scale;
        const palette = this._planetPalette(blueprint.planetClass, blueprint.color);
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 48, 48),
            new THREE.MeshPhysicalMaterial({
                color: palette.base,
                emissive: palette.base,
                emissiveIntensity: blueprint.planetClass === 'volcanic' ? 0.55 : 0.18,
                metalness: 0.06,
                roughness: blueprint.planetClass === 'ice' ? 0.12 : 0.72,
                clearcoat: 0.5,
            })
        );

        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.14, 32, 32),
            new THREE.MeshBasicMaterial({
                color: palette.atmosphere,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.BackSide
            })
        );
        mesh.add(atmosphere);

        if (blueprint.rings) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(radius * 1.35, radius * 2.1, 64),
                new THREE.MeshBasicMaterial({
                    color: palette.ring,
                    transparent: true,
                    opacity: 0.26,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            ring.rotation.x = Math.PI * 0.5;
            mesh.add(ring);
        }

        return { mesh, mass: 8 * scale, radius, label: `${blueprint.label || 'Planeta'} ${blueprint.planetClass || ''}`.trim() };
    }

    _createStarMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.2 * scale;
        const color = new THREE.Color(blueprint.color || '#ffe8a3');
        const glow = new THREE.Color(blueprint.glowColor || '#ffd05a');
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 40, 40),
            new THREE.MeshPhysicalMaterial({
                color,
                emissive: color,
                emissiveIntensity: 1.8,
                metalness: 0.02,
                roughness: 0.18,
                clearcoat: 0.45,
            })
        );

        const corona = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.9, 32, 32),
            new THREE.MeshBasicMaterial({
                color: glow,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        mesh.add(corona);

        return { mesh, mass: 40 * scale, radius, label: blueprint.label || 'Estrella' };
    }

    _createBlackHoleMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.3 * scale;
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 40, 40),
            new THREE.MeshPhysicalMaterial({
                color: 0x050505,
                emissive: 0x050505,
                emissiveIntensity: 0.12,
                metalness: 0.95,
                roughness: 0.18,
            })
        );

        const accretionRing = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 1.5, radius * 0.26, 16, 80),
            new THREE.MeshBasicMaterial({
                color: blueprint.glowColor || 0xff9955,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        accretionRing.rotation.x = Math.PI * 0.5;
        mesh.add(accretionRing);

        const lensGlow = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 2.3, 24, 24),
            new THREE.MeshBasicMaterial({
                color: blueprint.glowColor || 0xff9955,
                transparent: true,
                opacity: 0.08,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        mesh.add(lensGlow);

        return { mesh, mass: 120 * scale, radius, label: blueprint.label || 'Agujero negro' };
    }

    _createNebulaMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.6 * scale;
        const mesh = new THREE.Mesh(
            new THREE.IcosahedronGeometry(radius, 2),
            new THREE.MeshPhysicalMaterial({
                color: blueprint.color || 0x44ccff,
                emissive: blueprint.glowColor || blueprint.color || 0x44ccff,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.18,
                roughness: 1,
                metalness: 0,
                transmission: 0.12,
                depthWrite: false,
            })
        );

        for (let i = 0; i < 4; i++) {
            const puff = new THREE.Mesh(
                new THREE.SphereGeometry(radius * (0.45 + i * 0.08), 18, 18),
                new THREE.MeshBasicMaterial({
                    color: blueprint.glowColor || 0x9b5cff,
                    transparent: true,
                    opacity: 0.08,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            );
            puff.position.set(
                (Math.random() - 0.5) * radius * 1.4,
                (Math.random() - 0.5) * radius * 1.1,
                (Math.random() - 0.5) * radius * 1.4
            );
            mesh.add(puff);
        }

        return { mesh, mass: 2 * scale, radius, label: blueprint.label || 'Nebulosa' };
    }

    _createClusterMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.25 * scale;
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.18, 12, 12),
            new THREE.MeshPhysicalMaterial({
                color: blueprint.color || 0xfff2bf,
                emissive: blueprint.color || 0xfff2bf,
                emissiveIntensity: 0.35,
                transparent: true,
                opacity: 0.22,
                depthWrite: false
            })
        );

        for (let i = 0; i < 18; i++) {
            const star = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 0.08, 10, 10),
                new THREE.MeshBasicMaterial({
                    color: i % 5 === 0 ? 0x88ccff : blueprint.color || 0xfff2bf,
                    transparent: true,
                    opacity: 0.9,
                })
            );
            star.position.set(
                (Math.random() - 0.5) * radius * 2.2,
                (Math.random() - 0.5) * radius * 1.8,
                (Math.random() - 0.5) * radius * 2.2
            );
            mesh.add(star);
        }

        return { mesh, mass: 12 * scale, radius, label: blueprint.label || 'Cumulo estelar' };
    }

    _createSatelliteMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 0.75 * scale;
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(radius * 1.1, radius * 0.55, radius * 0.55),
            new THREE.MeshPhysicalMaterial({
                color: blueprint.color || 0xcdd7e6,
                emissive: blueprint.glowColor || 0x7dd3fc,
                emissiveIntensity: 0.25,
                metalness: 0.75,
                roughness: 0.28,
            })
        );

        const panelGeo = new THREE.BoxGeometry(radius * 0.85, radius * 0.05, radius * 0.45);
        const panelMat = new THREE.MeshPhysicalMaterial({
            color: 0x4aa8ff,
            emissive: 0x4aa8ff,
            emissiveIntensity: 0.3,
            metalness: 0.45,
            roughness: 0.22,
        });
        const leftPanel = new THREE.Mesh(panelGeo, panelMat);
        const rightPanel = new THREE.Mesh(panelGeo, panelMat);
        leftPanel.position.x = -radius * 1.1;
        rightPanel.position.x = radius * 1.1;
        mesh.add(leftPanel, rightPanel);

        return { mesh, mass: 3 * scale, radius, label: blueprint.label || 'Satelite' };
    }

    _createStationMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.1 * scale;
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, radius * 1.25, 16),
            new THREE.MeshPhysicalMaterial({
                color: blueprint.color || 0xd7dde8,
                emissive: blueprint.glowColor || 0x6ee7f9,
                emissiveIntensity: 0.18,
                metalness: 0.85,
                roughness: 0.24,
            })
        );

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 0.8, radius * 0.08, 12, 48),
            new THREE.MeshBasicMaterial({
                color: blueprint.glowColor || 0x6ee7f9,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        ring.rotation.x = Math.PI * 0.5;
        mesh.add(ring);

        return { mesh, mass: 5 * scale, radius, label: blueprint.label || 'Estacion orbital' };
    }

    _createAsteroidMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 0.9 * scale;
        return {
            mesh: new THREE.Mesh(
                new THREE.DodecahedronGeometry(radius, 1),
                new THREE.MeshPhysicalMaterial({
                    color: blueprint.color || 0x8c735f,
                    emissive: 0x1a0f08,
                    emissiveIntensity: 0.06,
                    metalness: 0.05,
                    roughness: 0.95,
                })
            ),
            mass: 2.5 * scale,
            radius,
            label: blueprint.label || 'Asteroide'
        };
    }

    _createPortalMesh(blueprint) {
        const scale = blueprint.scale || 1;
        const radius = 1.1 * scale;
        return {
            mesh: new THREE.Mesh(
                new THREE.TorusKnotGeometry(radius, radius * 0.22, 120, 16),
                new THREE.MeshPhysicalMaterial({
                    color: blueprint.color || 0x1ec8ff,
                    emissive: blueprint.glowColor || 0x6effd6,
                    emissiveIntensity: 1.2,
                    metalness: 0.35,
                    roughness: 0.18,
                    clearcoat: 1,
                })
            ),
            mass: 1,
            radius,
            label: blueprint.label || 'Portal'
        };
    }

    update(deltaTime) {
        if (!this.bodies.length) return;
        
        const gravity = -18.0;
        let groundY = -20;
        const cameraDelta = this._cameraDelta.set(0, 0, 0);

        if (this.camera) {
             // Forzar la actualización matemática de la cámara para eliminar el input-lag
             this.camera.updateMatrixWorld(true);
             groundY = this.camera.position.y - 12;
             
             if (!this._hasPreviousCameraPosition) {
                 this.previousCameraPosition.copy(this.camera.position);
                 this._hasPreviousCameraPosition = true;
             }
             cameraDelta.subVectors(this.camera.position, this.previousCameraPosition);
             this.previousCameraPosition.copy(this.camera.position);
        }

        for(let body of this.bodies) {
             // Ignorar totalmente si ya es un satélite gobernado por las leyes de Newton del kernel
             if (body.isSatellite) continue;
             
             if (body.isEditing) {
                 // Inercia Cero: Pegado hermético a cámara agregando el salto primero
                  body.mesh.position.add(cameraDelta);

                  if (this.camera && body.targetLocalPos) {
                      this._worldPos.copy(body.targetLocalPos).applyMatrix4(this.camera.matrixWorld);
                      body.mesh.position.lerp(this._worldPos, 0.85);
                     
                     this.selectionMarker.position.copy(body.mesh.position);
                     this.selectionMarker.rotation.copy(body.mesh.rotation);
                     this.selectionMarker.scale.copy(body.mesh.scale).multiplyScalar(1.05); 
                 }
                 continue; 
             }
             
             if (body.isLevitating) {
                 // El enjambre de objetos levitando tampoco debe soltarse jamás
                 body.mesh.position.add(cameraDelta);

                 if (this.camera && body.levitationOffset) {
                      const smoothSpeed = 10.0;
                      const levitationDistance = 2.5;
                      
                      this._targetOffset.set(
                          body.levitationOffset.x,
                          body.levitationOffset.y,
                          -levitationDistance + body.levitationOffset.z
                      );
                      
                      this._worldPos.copy(this._targetOffset).applyMatrix4(this.camera.matrixWorld);
                      body.mesh.position.lerp(this._worldPos, smoothSpeed * deltaTime);
                     body.mesh.lookAt(this.camera.position);
                 }
                 continue; // Salta la física de gravedad porque está levitando
             }
             
             body.velocity.y += gravity * deltaTime;
             body.mesh.position.addScaledVector(body.velocity, deltaTime);
             
             if (body.mesh.position.y - body.radius < groundY) {
                  body.mesh.position.y = groundY + body.radius;
                  body.velocity.y *= -0.75;
                  body.velocity.x *= 0.95;
                  body.velocity.z *= 0.95;
             } else {
                  body.velocity.x *= 0.99;
                  body.velocity.z *= 0.99;
             }
             
             body.mesh.rotation.x += body.velocity.z * deltaTime * 0.5;
             body.mesh.rotation.y += body.velocity.x * deltaTime * 0.5;
        }
        
        // V31 — Zero-GC sphere collision resolution (pre-allocated buffers)
        this._resolveSphereCollisions();

        const cameraPos = this.camera ? this.camera.position : this._fallbackCameraPos;
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            const body = this.bodies[i];
            if (body.mesh.position.distanceTo(cameraPos) > 200 || body.mesh.position.y < groundY - 50) {
                this._disposeMesh(body.mesh);
                this.bodies.splice(i, 1);
            }
        }
    }

    dispose() {
        if (this.selectionMarker) {
            this.scene?.remove(this.selectionMarker);
            this.selectionMarker.geometry?.dispose?.();
            this.selectionMarker.material?.dispose?.();
            this.selectionMarker = null;
        }

        for (const body of this.bodies) {
            this._disposeMesh(body.mesh);
        }
        this.bodies = [];
        this.editingBody = null;
    }

    _disposeMesh(mesh) {
        if (!mesh) return;
        mesh.traverse?.((child) => {
            child.geometry?.dispose?.();
            if (Array.isArray(child.material)) {
                child.material.forEach((material) => material?.dispose?.());
            } else {
                child.material?.dispose?.();
            }
        });
        mesh.parent?.remove(mesh);
    }
    // ═══════════════════════════════════════════════════════════════
    //  V31 — RIGID BODY PHYSICS  (Zero-GC buffers + BVH Spatial Hash)
    // ═══════════════════════════════════════════════════════════════

    _initPhysicsBuffers() {
        this._phys = {
            delta:   new THREE.Vector3(),
            normal:  new THREE.Vector3(),
            impulse: new THREE.Vector3(),
            relVel:  new THREE.Vector3(),
        };

        // ── V31: Uniform Spatial Hash Grid (BVH approximation) ──────────────
        // Replaces O(n²) collision detection with O(n) average using grid cells.
        // Cell size = 2× max object radius → each cell overlaps at most 1 layer.
        this._grid = {
            cellSize: 2.0,          // World units per cell (covers max radius)
            cells: new Map(),       // key: 'cx,cy,cz' → array of body indices
            _key(cx, cy, cz) { return `${cx},${cy},${cz}`; },
        };
        console.log('%c[LULU Spawner] V31 Rigid Body Physics — zero-GC buffers + SpatialHashGrid ready', 'color:#88ffaa;font-weight:bold');
    }

    _resolveSphereCollisions() {
        if (!this._phys || this.bodies.length < 2) return;
        const { delta, normal, impulse, relVel } = this._phys;
        const { cells, cellSize, _key } = this._grid;

        // ── Phase 1: Build Spatial Hash Grid (O(n)) ──────────────────────────
        cells.clear();
        const inv = 1 / cellSize;

        for (let i = 0; i < this.bodies.length; i++) {
            const b = this.bodies[i];
            if (b.isSatellite || b.isEditing || b.isLevitating) continue;
            const p  = b.mesh.position;
            const cx = Math.floor(p.x * inv);
            const cy = Math.floor(p.y * inv);
            const cz = Math.floor(p.z * inv);
            const k  = _key(cx, cy, cz);
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k).push(i);
        }

        // ── Phase 2: Check only neighboring cells (O(n × 27)) ───────────────
        // For each occupied cell, test against itself + 26 neighbors.
        // Pairs are tested once using i < j guard.
        const checked = new Set();

        cells.forEach((indices, k) => {
            const [cx, cy, cz] = k.split(',').map(Number);

            // Collect neighbor indices (27 cells: 3×3×3)
            const neighbors = [];
            for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
            for (let dz = -1; dz <= 1; dz++) {
                const nk = _key(cx + dx, cy + dy, cz + dz);
                const nc = cells.get(nk);
                if (nc) neighbors.push(...nc);
            }

            for (let ii = 0; ii < indices.length; ii++) {
                const i = indices[ii];
                const b1 = this.bodies[i];

                for (let jj = 0; jj < neighbors.length; jj++) {
                    const j = neighbors[jj];
                    if (j <= i) continue; // avoid duplicate pairs
                    const pairKey = `${i}_${j}`;
                    if (checked.has(pairKey)) continue;
                    checked.add(pairKey);

                    const b2 = this.bodies[j];
                    if (b2.isSatellite || b2.isEditing || b2.isLevitating) continue;

                    delta.subVectors(b2.mesh.position, b1.mesh.position);
                    const dist    = delta.length();
                    const minDist = b1.radius + b2.radius;

                    if (dist < minDist && dist > 0.0001) {
                        normal.copy(delta).multiplyScalar(1 / dist);
                        const sep = (minDist - dist) * 0.5;

                        b1.mesh.position.addScaledVector(normal, -sep);
                        b2.mesh.position.addScaledVector(normal,  sep);

                        relVel.subVectors(b2.velocity, b1.velocity);
                        const relSpeed = relVel.dot(normal);

                        if (relSpeed < 0) {
                            const e = 0.8;
                            const invMassSum = (1 / b1.mass) + (1 / b2.mass);
                            const impulseMag = -(1 + e) * relSpeed / invMassSum;
                            impulse.copy(normal).multiplyScalar(impulseMag);
                            b1.velocity.addScaledVector(impulse, -(1 / b1.mass));
                            b2.velocity.addScaledVector(impulse,   1 / b2.mass);
                        }
                    }
                }
            }
        });
    }

    grabObject(handJoint, bodyId) {
        const body = this.bodies.find(b => b.id === bodyId);
        if (!body || body.isGrabbed) return;
        body.isGrabbed      = true;
        body._prevParent    = body.mesh.parent;
        body._savedVelocity = body.velocity.clone();
        body.velocity.set(0, 0, 0);
        handJoint.attach(body.mesh);
        console.log(`[LULU] XR Grab: ${bodyId}`);
    }

    releaseObject(bodyId, throwVel) {
        const body = this.bodies.find(b => b.id === bodyId);
        if (!body || !body.isGrabbed) return;
        body.isGrabbed = false;
        if (this.scene) this.scene.attach(body.mesh);
        body.velocity.copy(throwVel ?? body._savedVelocity ?? new THREE.Vector3());
        console.log(`[LULU] XR Release: ${bodyId}, vel: ${body.velocity.length().toFixed(2)}`);
    }
}
