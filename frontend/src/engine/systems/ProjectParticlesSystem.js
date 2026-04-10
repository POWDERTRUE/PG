import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import {
    IMAGE_PAYLOAD_TYPE,
    applyProjectionPayload,
    attachProjectionShell,
    disposeProjectionShell,
    getProjectionFallbackTexture,
    normalizeProjectionImagePayload,
    resolveProjectionMesh,
    measureProjectionRadius,
} from '../rendering/ProjectionShellRuntime.js';

const PARTICLE_PROJECTOR_SIGNAL = 'PG:LULU:REQUEST_PARTICLE_PROJECTOR';
const PARTICLE_PROJECTOR_STATE_SIGNAL = 'PG:FX:PARTICLE_PROJECTOR_STATE';
const PARTICLE_PROJECTOR_DOCKED_SIGNAL = 'PG:FX:PARTICLE_PROJECTOR_DOCKED';
const IMAGE_REVEAL_COMPLETE_SIGNAL = 'PG:FX:IMAGE_REVEAL_COMPLETE';
const ORIGIN_SHIFT_SIGNAL = 'PG:NAV:ORIGIN_SHIFT';
const ACTIVE_PAYLOAD_CHANGED_SIGNAL = 'PG:OS:ACTIVE_PAYLOAD_CHANGED';

const PROJECTOR_PHASE = Object.freeze({
    IDLE: 'IDLE',
    SEEK_POINTER: 'SEEK_POINTER',
    DOCKING: 'DOCKING',
    COLLAPSING: 'COLLAPSING',
    DOCKED: 'DOCKED',
});

const DOCKING_THRESHOLD_RATIO = 0.95;
const DOCKING_SURFACE_MARGIN = 1.05;
const MIN_DISTANCE_SQ = 0.0001;
const SEEK_FALLBACK_DISTANCE = 260;
const SEEK_NOISE_SCALE = 0.18;
const SEEK_SPRING = 9.5;
const SEEK_DAMPING = 0.88;
const SEEK_POSITION_SCALE = 11.0;
const DOCKING_DAMPING = 0.92;
const DOCKING_ACCELERATION_SCALE = 0.75;
const DOCKING_POSITION_SCALE = 8.5;
const BASE_POINT_SIZE = 15.5;
const BASE_OPACITY = 0.84;
const BASE_HOTSPOT = 0.58;
const COLLAPSE_TARGET_POINT_SIZE = 3.4;

const PROJECT_PARTICLES_VERTEX_SHADER = `
    uniform float uTime;
    uniform float uPointSize;
    uniform float uOpacity;

    attribute vec3 color;
    attribute float aPhase;

    varying vec3 vColor;
    varying float vOpacity;
    varying float vPulse;

    void main() {
        vColor = color;
        vOpacity = uOpacity;

        float pulse = 0.92 + 0.08 * sin(uTime * 3.0 + aPhase * 1.7);
        vPulse = pulse;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float depth = max(1.0, -mvPosition.z);
        gl_PointSize = clamp(uPointSize * pulse * (320.0 / depth), 2.0, 26.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const PROJECT_PARTICLES_FRAGMENT_SHADER = `
    uniform float uHotspotBoost;

    varying vec3 vColor;
    varying float vOpacity;
    varying float vPulse;

    void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float dist = length(centered) * 2.0;

        if (dist > 1.0) {
            discard;
        }

        float halo = smoothstep(1.0, 0.0, dist);
        float core = smoothstep(0.42, 0.0, dist);
        float rim = smoothstep(0.95, 0.28, dist);

        vec3 rgb = vColor * (0.35 + rim * 0.85);
        vec3 hotspot = vec3(core * (0.5 + uHotspotBoost * 1.2));
        vec3 finalColor = (rgb + hotspot) * (0.85 + vPulse * 0.35);
        float alpha = halo * vOpacity;

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

export class ProjectParticlesSystem {
    constructor(kernel) {
        this.kernel = kernel;
        this.renderPhase = 'render';

        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.payloadManager = Registry.tryGet('PayloadManager');
        this.sceneGraph = Registry.tryGet('SceneGraph');
        this.camera = Registry.tryGet('camera');
        this.cameraRig = Registry.tryGet('cameraRig');
        this.raycast = Registry.tryGet('RaycastSelectionSystem') ?? kernel?.raycastSelectionSystem ?? null;

        this.scene = this.sceneGraph?.scene ?? kernel?.scene ?? null;

        this.particleCount = 4096;
        this.revealThresholdCount = Math.floor(this.particleCount * DOCKING_THRESHOLD_RATIO);
        this.baseSpeed = 120.0;
        this.turbulence = 45.0;
        this.collapseDuration = 0.28;

        this.positions = new Float32Array(this.particleCount * 3);
        this.baseOffsets = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.phases = new Float32Array(this.particleCount);
        this.dockedStates = new Uint8Array(this.particleCount);

        this.geometry = null;
        this.material = null;
        this.points = null;
        this.defaultProjectionTexture = null;
        this.activeImagePayload = null;

        this.active = false;
        this.phase = PROJECTOR_PHASE.IDLE;
        this.hostMass = null;
        this.hostMesh = null;
        this.currentShell = null;
        this.dockedCount = 0;
        this.transmutationTriggered = false;
        this._isCompletingReveal = false;
        this.collapseProgress = 0;
        this._timeAcc = 0;
        this.overrideTargetId = null;

        this._removeProjectorSignalListener = null;
        this._removeOriginShiftListener = null;
        this._removePayloadChangedListener = null;
        this._boundWindowRequest = null;
        this._boundOriginShift = null;

        this.anchorVelocity = new THREE.Vector3();
        this.anchorTarget = new THREE.Vector3();
        this.dockingPoint = new THREE.Vector3();
        this.dockingNormal = new THREE.Vector3(0, 1, 0);
        this.forward = new THREE.Vector3(0, 0, -1);
        this._scratchPosition = new THREE.Vector3();
        this._scratchQuaternion = new THREE.Quaternion();
        this._scratchScale = new THREE.Vector3();
        this._hostWorldCenter = new THREE.Vector3();
        this._hostCenterLocal = new THREE.Vector3();

        this._currentDockingRadius = 0;
        this._currentDockingRadiusSq = 0;
    }

    init() {
        this.raycast = this.raycast || Registry.tryGet('RaycastSelectionSystem') || this.kernel?.raycastSelectionSystem || null;
        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');
        this.defaultProjectionTexture = getProjectionFallbackTexture();
        this.activeImagePayload = this._resolveActiveImagePayload();

        if (this.runtimeSignals?.on) {
            this._removeProjectorSignalListener = this.runtimeSignals.on(
                PARTICLE_PROJECTOR_SIGNAL,
                (detail) => this.activate(detail)
            );
            this._removeOriginShiftListener = this.runtimeSignals.on(
                ORIGIN_SHIFT_SIGNAL,
                (detail) => this._onOriginShift(detail)
            );
            this._removePayloadChangedListener = this.runtimeSignals.on(
                ACTIVE_PAYLOAD_CHANGED_SIGNAL,
                (detail) => this._onActivePayloadChanged(detail)
            );
            return;
        }

        this._boundWindowRequest = () => this.activate();
        window.addEventListener(PARTICLE_PROJECTOR_SIGNAL, this._boundWindowRequest);
        this._boundOriginShift = (event) => this._onOriginShift(event?.detail ?? event);
        window.addEventListener(ORIGIN_SHIFT_SIGNAL, this._boundOriginShift);
    }

    activate(detail = {}) {
        if (!this.scene) {
            return false;
        }

        this.overrideTargetId = typeof detail?.overrideTargetId === 'string'
            ? detail.overrideTargetId.trim()
            : null;
        this._ensurePoints();
        this._resetSwarm();
        this._emitState(PARTICLE_PROJECTOR_STATE_SIGNAL, {
            requestedBy: detail?.source ?? 'lulu',
            overrideTargetId: this.overrideTargetId,
        });
        this._emitTransmission(
            this.overrideTargetId
                ? 'Proyecto particulas activo. Objetivo tactico fijado por el OS.'
                : 'Proyecto particulas activo. Apunta a una masa para iniciar el docking RGB.'
        );
        return true;
    }

    update(deltaTime) {
        if (!this.active || !this.points || !this.material) {
            return;
        }

        const dt = Math.max(0.001, Math.min(0.05, deltaTime || 0.016));
        this._timeAcc += dt;
        this.material.uniforms.uTime.value = this._timeAcc;

        this.raycast = this.raycast || Registry.tryGet('RaycastSelectionSystem') || this.kernel?.raycastSelectionSystem || null;

        if (this.phase === PROJECTOR_PHASE.COLLAPSING) {
            this._trackHostMass();
            this._updateAnchor(dt, true);
            this._updateCollapse(dt);
            return;
        }

        this._updateTargetFromAim();
        this._updateAnchor(dt, false);

        const needsUpdate = this._updateParticles(dt);
        if (needsUpdate) {
            this.geometry.attributes.position.needsUpdate = true;
        }

        const dockedRatio = this.dockedCount / Math.max(1, this.particleCount);
        this.material.uniforms.uHotspotBoost.value = BASE_HOTSPOT + (dockedRatio * 0.95);

        if (
            this.phase === PROJECTOR_PHASE.DOCKING &&
            !this.transmutationTriggered &&
            this.dockedCount >= this.revealThresholdCount
        ) {
            this._startCollapse();
        }
    }

    _ensurePoints() {
        if (this.points) {
            if (!this.points.parent) {
                this.scene.add(this.points);
            }
            return;
        }

        this._seedParticleCloud();

        this.geometry = new THREE.BufferGeometry();
        const positionAttribute = new THREE.BufferAttribute(this.positions, 3);
        positionAttribute.setUsage(THREE.DynamicDrawUsage);
        this.geometry.setAttribute('position', positionAttribute);
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: BASE_OPACITY },
                uPointSize: { value: BASE_POINT_SIZE },
                uHotspotBoost: { value: BASE_HOTSPOT },
            },
            vertexShader: PROJECT_PARTICLES_VERTEX_SHADER,
            fragmentShader: PROJECT_PARTICLES_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.name = 'LULU_ProjectParticlesSwarm';
        this.points.frustumCulled = false;
        this.points.renderOrder = 30;
        this.points.visible = false;
        this.scene.add(this.points);
    }

    _seedParticleCloud() {
        for (let i = 0; i < this.particleCount; i++) {
            const index = i * 3;
            const colorSlot = i % 3;
            const seed = i / Math.max(1, this.particleCount - 1);
            const angle = seed * Math.PI * 20.0;
            const radius = 16 + ((i % 29) * 0.62);
            const height = ((i % 23) - 11) * 1.08;

            this.baseOffsets[index] = Math.cos(angle) * radius;
            this.baseOffsets[index + 1] = height;
            this.baseOffsets[index + 2] = Math.sin(angle) * radius;

            this.positions[index] = this.baseOffsets[index];
            this.positions[index + 1] = this.baseOffsets[index + 1];
            this.positions[index + 2] = this.baseOffsets[index + 2];

            this.velocities[index] = 0;
            this.velocities[index + 1] = 0;
            this.velocities[index + 2] = 0;

            this.colors[index] = colorSlot === 0 ? 1 : 0;
            this.colors[index + 1] = colorSlot === 1 ? 1 : 0;
            this.colors[index + 2] = colorSlot === 2 ? 1 : 0;

            this.phases[i] = 0.7 + seed * 13.7;
        }
    }

    _resetSwarm() {
        this.active = true;
        this.phase = PROJECTOR_PHASE.SEEK_POINTER;
        this.hostMass = null;
        this.hostMesh = null;
        this.dockedCount = 0;
        this.transmutationTriggered = false;
        this._isCompletingReveal = false;
        this.collapseProgress = 0;
        this._timeAcc = 0;
        this._currentDockingRadius = 0;
        this._currentDockingRadiusSq = 0;
        this.dockedStates.fill(0);
        this.anchorVelocity.set(0, 0, 0);
        this.anchorTarget.set(0, 0, 0);
        this.dockingPoint.set(0, 0, 0);
        this.dockingNormal.set(0, 1, 0);

        const origin = this.cameraRig?.position ?? this.camera?.position ?? this._scratchPosition.set(0, 0, 0);
        const sourceQuaternion = this.cameraRig?.quaternion ?? this.camera?.quaternion ?? this._scratchQuaternion.identity();
        this.forward.set(0, 0, -1).applyQuaternion(sourceQuaternion).normalize();

        this.points.visible = true;
        this.points.position.copy(origin).addScaledVector(this.forward, 110);

        for (let i = 0; i < this.particleCount; i++) {
            const index = i * 3;
            this.positions[index] = this.baseOffsets[index];
            this.positions[index + 1] = this.baseOffsets[index + 1];
            this.positions[index + 2] = this.baseOffsets[index + 2];
            this.velocities[index] = 0;
            this.velocities[index + 1] = 0;
            this.velocities[index + 2] = 0;
        }

        this.material.uniforms.uTime.value = 0;
        this.material.uniforms.uOpacity.value = BASE_OPACITY;
        this.material.uniforms.uPointSize.value = BASE_POINT_SIZE;
        this.material.uniforms.uHotspotBoost.value = BASE_HOTSPOT;
        this.geometry.attributes.position.needsUpdate = true;
    }

    _updateTargetFromAim() {
        if ((this.phase === PROJECTOR_PHASE.DOCKING || this.phase === PROJECTOR_PHASE.COLLAPSING) && this.hostMass) {
            this._trackHostMass();
            return;
        }

        const overrideMass = this._resolveOverrideTarget();
        if (overrideMass) {
            const hostChanged = overrideMass !== this.hostMass;
            this.hostMass = overrideMass;
            this.hostMesh = resolveProjectionMesh(overrideMass);
            this.phase = PROJECTOR_PHASE.DOCKING;
            this._trackHostMass();

            if (hostChanged) {
                this._emitTransmission(`Objetivo tactico fijado: ${overrideMass.name || 'Masa sin nombre'}. Iniciando docking fotonico.`);
                this._emitState(PARTICLE_PROJECTOR_STATE_SIGNAL, { targetId: overrideMass.uuid });
            }
            return;
        }

        const target = this.raycast?.getNavigationTarget?.({ fallbackDistance: SEEK_FALLBACK_DISTANCE }) ?? null;
        if (!target?.point) {
            return;
        }

        const mass = this._resolveMassNode(target.object);
        if (mass) {
            const hostChanged = mass !== this.hostMass;
            this.hostMass = mass;
            this.hostMesh = resolveProjectionMesh(mass);
            this.dockingNormal.copy(target.normal ?? this.dockingNormal).normalize();
            this.phase = PROJECTOR_PHASE.DOCKING;
            this._trackHostMass();

            if (hostChanged) {
                this._emitTransmission(`Masa detectada: ${mass.name || 'Sin nombre'}. Iniciando docking fotonico.`);
                this._emitState(PARTICLE_PROJECTOR_STATE_SIGNAL, { targetId: mass.uuid });
            }
            return;
        }

        const ray = this.raycast?.raycaster?.ray ?? null;
        const origin = this.cameraRig?.position ?? this.camera?.position ?? ray?.origin ?? this._scratchPosition.set(0, 0, 0);
        if (ray?.direction) {
            this.anchorTarget
                .copy(origin)
                .addScaledVector(ray.direction, 150);
        } else {
            this.forward.set(0, 0, -1).applyQuaternion(this.cameraRig?.quaternion ?? this.camera?.quaternion ?? this._scratchQuaternion.identity()).normalize();
            this.anchorTarget
                .copy(origin)
                .addScaledVector(this.forward, 150);
        }

        this.phase = PROJECTOR_PHASE.SEEK_POINTER;
    }

    _trackHostMass() {
        if (!this.hostMass || !this.points) {
            return false;
        }

        const hostObject = this.hostMesh || resolveProjectionMesh(this.hostMass) || this.hostMass;
        this.hostMesh = hostObject;

        hostObject.getWorldPosition(this._hostWorldCenter);
        this.anchorTarget.copy(this._hostWorldCenter);
        this.dockingPoint.copy(this._hostWorldCenter);

        hostObject.getWorldScale(this._scratchScale);
        const worldScale = Math.max(
            Math.abs(this._scratchScale.x),
            Math.abs(this._scratchScale.y),
            Math.abs(this._scratchScale.z),
            1
        );

        this._currentDockingRadius = this._resolveDockingRadius(hostObject, worldScale);
        this._currentDockingRadiusSq = this._currentDockingRadius * this._currentDockingRadius * DOCKING_SURFACE_MARGIN * DOCKING_SURFACE_MARGIN;

        this._hostCenterLocal.copy(this._hostWorldCenter);
        this.points.worldToLocal(this._hostCenterLocal);
        return true;
    }

    _resolveDockingRadius(hostObject, worldScale) {
        const radiusMeta = Number(this.hostMass?.userData?.radius);
        if (Number.isFinite(radiusMeta) && radiusMeta > 0) {
            return Math.max(1, radiusMeta * worldScale);
        }

        const geometry = hostObject?.geometry ?? null;
        const sphereRadius = geometry?.boundingSphere?.radius ?? null;
        if (Number.isFinite(sphereRadius) && sphereRadius > 0) {
            return Math.max(1, sphereRadius * worldScale);
        }

        return Math.max(1, measureProjectionRadius(hostObject));
    }

    _updateAnchor(deltaTime, collapsing) {
        const attraction =
            this.phase === PROJECTOR_PHASE.DOCKING ? 34 :
            this.phase === PROJECTOR_PHASE.COLLAPSING ? 42 :
            14;

        const damping =
            this.phase === PROJECTOR_PHASE.DOCKING ? 0.82 :
            this.phase === PROJECTOR_PHASE.COLLAPSING ? 0.78 :
            0.86;

        this._scratchPosition.copy(this.anchorTarget).sub(this.points.position);
        this.anchorVelocity.addScaledVector(this._scratchPosition, attraction * deltaTime);
        this.anchorVelocity.multiplyScalar(damping);
        this.points.position.addScaledVector(this.anchorVelocity, deltaTime * (collapsing ? 4.2 : 3.4));
    }

    _updateParticles(deltaTime) {
        const positionAttribute = this.geometry?.attributes?.position;
        if (!positionAttribute) {
            return false;
        }

        const hasHost = this.phase === PROJECTOR_PHASE.DOCKING;
        const centerX = this._hostCenterLocal.x;
        const centerY = this._hostCenterLocal.y;
        const centerZ = this._hostCenterLocal.z;
        const dockingRadius = this._currentDockingRadius;
        const dockingRadiusSq = this._currentDockingRadiusSq;

        let needsUpdate = false;

        for (let i = 0; i < this.particleCount; i++) {
            if (this.dockedStates[i] === 1) {
                continue;
            }

            const index = i * 3;
            const px = this.positions[index];
            const py = this.positions[index + 1];
            const pz = this.positions[index + 2];
            const phase = this.phases[i];

            const noiseX = Math.sin(this._timeAcc * 2.1 + phase) * this.turbulence;
            const noiseY = Math.cos(this._timeAcc * 1.7 + phase * 1.13) * this.turbulence * 0.82;
            const noiseZ = Math.sin(this._timeAcc * 2.4 - phase * 0.73) * this.turbulence;

            if (hasHost) {
                const dx = centerX - px;
                const dy = centerY - py;
                const dz = centerZ - pz;
                const distSq = (dx * dx) + (dy * dy) + (dz * dz);

                if (distSq <= dockingRadiusSq) {
                    let nx;
                    let ny;
                    let nz;

                    if (distSq > MIN_DISTANCE_SQ) {
                        const invDist = 1 / Math.sqrt(distSq);
                        nx = -dx * invDist;
                        ny = -dy * invDist;
                        nz = -dz * invDist;
                    } else {
                        const ox = this.baseOffsets[index];
                        const oy = this.baseOffsets[index + 1];
                        const oz = this.baseOffsets[index + 2];
                        const baseLenSq = Math.max(MIN_DISTANCE_SQ, (ox * ox) + (oy * oy) + (oz * oz));
                        const invBaseLen = 1 / Math.sqrt(baseLenSq);
                        nx = ox * invBaseLen;
                        ny = oy * invBaseLen;
                        nz = oz * invBaseLen;
                    }

                    this.positions[index] = centerX + (nx * dockingRadius);
                    this.positions[index + 1] = centerY + (ny * dockingRadius);
                    this.positions[index + 2] = centerZ + (nz * dockingRadius);
                    this.velocities[index] = 0;
                    this.velocities[index + 1] = 0;
                    this.velocities[index + 2] = 0;
                    this.dockedStates[i] = 1;
                    this.dockedCount++;
                    needsUpdate = true;
                    continue;
                }

                const invDist = 1 / Math.sqrt(Math.max(distSq, MIN_DISTANCE_SQ));
                const vx = (dx * invDist * this.baseSpeed) + noiseX;
                const vy = (dy * invDist * this.baseSpeed) + noiseY;
                const vz = (dz * invDist * this.baseSpeed) + noiseZ;

                this.velocities[index] = (this.velocities[index] * DOCKING_DAMPING) + (vx * deltaTime * DOCKING_ACCELERATION_SCALE);
                this.velocities[index + 1] = (this.velocities[index + 1] * DOCKING_DAMPING) + (vy * deltaTime * DOCKING_ACCELERATION_SCALE);
                this.velocities[index + 2] = (this.velocities[index + 2] * DOCKING_DAMPING) + (vz * deltaTime * DOCKING_ACCELERATION_SCALE);

                this.positions[index] += this.velocities[index] * DOCKING_POSITION_SCALE * deltaTime;
                this.positions[index + 1] += this.velocities[index + 1] * DOCKING_POSITION_SCALE * deltaTime;
                this.positions[index + 2] += this.velocities[index + 2] * DOCKING_POSITION_SCALE * deltaTime;
                needsUpdate = true;
                continue;
            }

            const targetX = this.baseOffsets[index] + (noiseX * SEEK_NOISE_SCALE);
            const targetY = this.baseOffsets[index + 1] + (noiseY * SEEK_NOISE_SCALE);
            const targetZ = this.baseOffsets[index + 2] + (noiseZ * SEEK_NOISE_SCALE);

            this.velocities[index] = (this.velocities[index] * SEEK_DAMPING) + ((targetX - px) * SEEK_SPRING * deltaTime);
            this.velocities[index + 1] = (this.velocities[index + 1] * SEEK_DAMPING) + ((targetY - py) * SEEK_SPRING * deltaTime);
            this.velocities[index + 2] = (this.velocities[index + 2] * SEEK_DAMPING) + ((targetZ - pz) * SEEK_SPRING * deltaTime);

            this.positions[index] += this.velocities[index] * SEEK_POSITION_SCALE * deltaTime;
            this.positions[index + 1] += this.velocities[index + 1] * SEEK_POSITION_SCALE * deltaTime;
            this.positions[index + 2] += this.velocities[index + 2] * SEEK_POSITION_SCALE * deltaTime;
            needsUpdate = true;
        }

        return needsUpdate;
    }

    _startCollapse() {
        if (this.transmutationTriggered) {
            return;
        }

        this.transmutationTriggered = true;
        this.phase = PROJECTOR_PHASE.COLLAPSING;
        this.collapseProgress = 0;
        this.anchorVelocity.multiplyScalar(0.4);
        this._emitState(PARTICLE_PROJECTOR_STATE_SIGNAL, {
            threshold: this.revealThresholdCount,
        });
    }

    _updateCollapse(deltaTime) {
        this.collapseProgress += deltaTime;
        const progress = Math.min(1, this.collapseProgress / this.collapseDuration);

        this.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(BASE_OPACITY, 0.0, progress);
        this.material.uniforms.uPointSize.value = THREE.MathUtils.lerp(BASE_POINT_SIZE, COLLAPSE_TARGET_POINT_SIZE, progress);
        this.material.uniforms.uHotspotBoost.value = THREE.MathUtils.lerp(BASE_HOTSPOT + 0.8, 1.85, progress);

        if (progress >= 1 && !this._isCompletingReveal) {
            this._isCompletingReveal = true;
            void this._completeReveal();
        }
    }

    async _completeReveal() {
        if (!this.hostMass) {
            this._deactivate();
            return;
        }

        const projectionMesh = this.hostMesh || resolveProjectionMesh(this.hostMass);
        const activePayload = this._resolveActiveImagePayload();
        this.hostMass.userData = {
            ...(this.hostMass.userData ?? {}),
            canProjectImage: true,
            imageProjectionCapable: true,
        };

        let shell = null;
        let shellState = null;
        if (projectionMesh) {
            shell = attachProjectionShell(projectionMesh, {
                defaultTexture: this.defaultProjectionTexture,
                hostMassName: this.hostMass?.name ?? null,
            });
            this.currentShell = shell;
            shellState = await applyProjectionPayload(shell, activePayload, {
                defaultTexture: this.defaultProjectionTexture,
            });
        }

        this.phase = PROJECTOR_PHASE.DOCKED;
        const revealPayload = {
            targetId: this.hostMass.uuid,
            deterministicKey: this.hostMass.userData?.deterministicKey ?? null,
            hostName: this.hostMass.name ?? null,
            injectedPayload: activePayload?.url ?? null,
            payloadLabel: activePayload?.label ?? null,
            particleCount: this.particleCount,
            dockedCount: this.dockedCount,
            threshold: this.revealThresholdCount,
            shellAttached: !!shell,
            shellPayloadKey: shellState?.payloadKey ?? shell?.userData?.payloadKey ?? null,
        };

        this._emitState(PARTICLE_PROJECTOR_DOCKED_SIGNAL, {
            hasOverlay: !!shell,
            ...revealPayload,
        });
        this.runtimeSignals?.emit?.(IMAGE_REVEAL_COMPLETE_SIGNAL, {
            source: 'project-particles-system',
            ...revealPayload,
        });
        // ── Refresco del Escáner LULU ────────────────────────────────────────────
        // IMAGE_REVEAL_COMPLETE va a PersistenceSystem que escribe la cicatriz.
        // Esa escritura es síncrona, así que al emitir LULU_SCAN_REFRESH en el frame
        // siguiente el escáner ya la encontrará en _planetaryScars.
        if (revealPayload.targetId) {
            this.runtimeSignals?.emit?.('PG:UI:LULU_SCAN_REFRESH_REQUESTED', {
                targetId:        revealPayload.targetId,
                deterministicKey: revealPayload.deterministicKey,
            });
        }
        this._emitTransmission(
            `Acople exitoso en ${this.hostMass.name || 'masa objetivo'}. ` +
            `Payload ${activePayload?.label || 'calibracion base'} inyectado en la carcasa de proyeccion.`
        );
        this._deactivate(false);

    }

    _onOriginShift(detail) {
        const offset = detail?.offset ?? detail;
        if (!offset || !this.points) {
            return;
        }

        this.anchorTarget.sub(offset);
        this.dockingPoint.sub(offset);
    }

    _onActivePayloadChanged(detail) {
        if (String(detail?.type || '').toUpperCase() !== IMAGE_PAYLOAD_TYPE) {
            return;
        }
        this.activeImagePayload = normalizeProjectionImagePayload(detail?.data);
    }

    _resolveOverrideTarget() {
        if (!this.overrideTargetId) {
            return null;
        }

        const celestialRegistry = Registry.tryGet('CelestialRegistry') ?? Registry.tryGet('celestialRegistry');
        const target =
            celestialRegistry?.getById?.(this.overrideTargetId) ??
            this.scene?.getObjectByProperty?.('uuid', this.overrideTargetId) ??
            null;
        const mass = this._resolveMassNode(target);
        if (mass) {
            return mass;
        }

        this.overrideTargetId = null;
        return null;
    }

    _resolveActiveImagePayload() {
        if (this.activeImagePayload?.url) {
            return this.activeImagePayload;
        }

        this.payloadManager = this.payloadManager || Registry.tryGet('PayloadManager');
        const payload = this.payloadManager?.getActivePayload?.(IMAGE_PAYLOAD_TYPE) ?? null;
        this.activeImagePayload = normalizeProjectionImagePayload(payload);
        return this.activeImagePayload;
    }

    _resolveMassNode(object) {
        let current = object;
        while (current) {
            if (current.userData?.isHitbox || /^Hitbox_/i.test(current.name || '')) {
                current = current.parent;
                continue;
            }
            const nodeType = current.userData?.nodeType;
            if (
                current.userData?.isMass ||
                current.userData?.isApp ||
                nodeType === 'planet' ||
                nodeType === 'star' ||
                nodeType === 'moon' ||
                nodeType === 'cluster' ||
                /planet|moon|sun|megasun|cluster|nebula/i.test(current.name || '')
            ) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    _emitState(name, detail = {}) {
        this.runtimeSignals?.emit?.(name, {
            source: 'project-particles-system',
            ...this.getDebugState(),
            ...detail,
        });
    }

    _emitTransmission(message) {
        this.runtimeSignals?.emit?.('PG:HUD_TRANSMISSION', {
            sourceLabel: 'LULU',
            stateLabel: 'Proyecto particulas',
            message,
        });
    }

    _deactivate(clearHost = true) {
        this.active = false;
        this._isCompletingReveal = false;
        this.anchorVelocity.set(0, 0, 0);
        if (this.points) {
            this.points.visible = false;
        }
        if (clearHost) {
            this.hostMass = null;
            this.hostMesh = null;
            this.phase = PROJECTOR_PHASE.IDLE;
            this.overrideTargetId = null;
        }
        this._emitState(PARTICLE_PROJECTOR_STATE_SIGNAL);
    }

    getDebugState() {
        const dockedRatio = this.dockedCount / Math.max(1, this.particleCount);
        const payload = this._resolveActiveImagePayload();
        return {
            active: this.active,
            phase: this.phase,
            host: this.hostMass?.name ?? null,
            particleCount: this.particleCount,
            dockedCount: this.dockedCount,
            dockedRatio: Number(dockedRatio.toFixed(4)),
            transmutationTriggered: this.transmutationTriggered,
            overrideTargetId: this.overrideTargetId,
            payloadLabel: payload?.label ?? null,
            payloadUrl: payload?.url ?? null,
        };
    }

    dispose() {
        this._removeProjectorSignalListener?.();
        this._removeProjectorSignalListener = null;
        this._removeOriginShiftListener?.();
        this._removeOriginShiftListener = null;
        this._removePayloadChangedListener?.();
        this._removePayloadChangedListener = null;

        if (this._boundWindowRequest) {
            window.removeEventListener(PARTICLE_PROJECTOR_SIGNAL, this._boundWindowRequest);
            this._boundWindowRequest = null;
        }
        if (this._boundOriginShift) {
            window.removeEventListener(ORIGIN_SHIFT_SIGNAL, this._boundOriginShift);
            this._boundOriginShift = null;
        }

        if (this.points?.parent) {
            this.points.parent.remove(this.points);
        }
        this.geometry?.dispose?.();
        this.material?.dispose?.();
        this.geometry = null;
        this.material = null;
        this.points = null;

        if (this.currentShell) {
            disposeProjectionShell(this.currentShell);
            this.currentShell = null;
        }
    }
}

export default ProjectParticlesSystem;
