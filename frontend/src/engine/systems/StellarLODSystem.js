import * as THREE from 'three';
import { Registry } from '../core/ServiceRegistry.js';
import { GALAXY_SPEC } from '../config/UniverseSpec.js';

const SYSTEMS_GENERATED_SIGNAL = 'PG:GALAXY:SYSTEMS_GENERATED';

const PROXY_VERTEX_SHADER = `
    attribute vec3 instanceTint;
    attribute float instanceAlpha;

    varying vec3 vColor;
    varying float vAlpha;
    varying vec3 vNormalView;

    void main() {
        vColor = instanceTint;
        vAlpha = instanceAlpha;
        vNormalView = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);

        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const PROXY_FRAGMENT_SHADER = `
    varying vec3 vColor;
    varying float vAlpha;
    varying vec3 vNormalView;

    void main() {
        float fresnel = pow(1.0 - clamp(abs(vNormalView.z), 0.0, 1.0), 2.4);
        float core = 0.28 + (1.0 - fresnel) * 0.72;
        vec3 glow = vColor * (0.72 + fresnel * 0.95) + vec3(1.0) * fresnel * 0.18;
        float alpha = vAlpha * (0.32 + core * 0.68);

        gl_FragColor = vec4(glow, alpha);
    }
`;

export class StellarLODSystem {
    constructor(kernel) {
        this.kernel = kernel;
        this.renderPhase = 'render';

        this.runtimeSignals = Registry.tryGet('RuntimeSignals');
        this.sceneGraph = Registry.tryGet('SceneGraph');
        this.camera = Registry.tryGet('camera');

        this.systems = [];
        this.proxyMesh = null;
        this.proxyAlpha = new Float32Array(0);
        this.detailAlpha = new Float32Array(0);
        this.detailVisibility = new Uint8Array(0);
        this.proxyAlphaAttribute = null;

        this._camPos = new THREE.Vector3();
        this._sysPos = new THREE.Vector3();
        this._instanceScale = new THREE.Vector3(1, 1, 1);
        this._identityQuaternion = new THREE.Quaternion();
        this._instanceMatrix = new THREE.Matrix4();
        this._removeSystemsListener = null;

        const lodSpec = GALAXY_SPEC.visibleScenario?.namedSystems?.lod ?? {};
        this.localEnterSq = Math.pow(lodSpec.localEnterDistance ?? 1600, 2);
        this.localExitSq = Math.pow(lodSpec.localExitDistance ?? 2050, 2);
        this.proxyFadeStartSq = Math.pow(lodSpec.proxyFadeStartDistance ?? 5200, 2);
        this.proxyFadeEndSq = Math.pow(lodSpec.proxyFadeEndDistance ?? 15000, 2);
        this.fadeSpeed = lodSpec.fadeSpeed ?? 5.4;
    }

    init() {
        this.runtimeSignals = this.runtimeSignals || Registry.tryGet('RuntimeSignals');
        this._removeSystemsListener = this.runtimeSignals?.on?.(
            SYSTEMS_GENERATED_SIGNAL,
            (detail) => this._registerSystems(detail?.systems ?? [], detail?.parent ?? null)
        ) ?? null;

        const existingSystems = this.kernel?.galaxyGenSystem?.getNamedSystemDescriptors?.() ?? [];
        const existingParent = this.kernel?.galaxyGenSystem?.namedStarsGroup ?? null;
        if (existingSystems.length) {
            this._registerSystems(existingSystems, existingParent);
        }
    }

    update(deltaTime) {
        if (!this.proxyMesh || !this.systems.length || !this.camera) {
            return;
        }

        const blend = 1.0 - Math.exp(-this.fadeSpeed * Math.max(0.001, deltaTime || 0.016));
        let proxyAlphaDirty = false;

        this._camPos.copy(this.camera.position);

        for (let i = 0; i < this.systems.length; i++) {
            const system = this.systems[i];
            system.group.getWorldPosition(this._sysPos);
            const distSq = this._camPos.distanceToSquared(this._sysPos);

            const wantsDetail = this.detailVisibility[i]
                ? distSq <= this.localExitSq
                : distSq <= this.localEnterSq;

            this.detailVisibility[i] = wantsDetail ? 1 : 0;

            const desiredDetail = wantsDetail ? 1 : 0;
            const desiredProxy = wantsDetail ? 0 : this._computeProxyAlpha(distSq);

            const nextDetail = this._mix(this.detailAlpha[i], desiredDetail, blend);
            const nextProxy = this._mix(this.proxyAlpha[i], desiredProxy, blend);

            if (Math.abs(nextDetail - this.detailAlpha[i]) > 0.001) {
                this.detailAlpha[i] = nextDetail;
                this._applyDetailAlpha(system, nextDetail);
            }

            if (Math.abs(nextProxy - this.proxyAlpha[i]) > 0.001) {
                this.proxyAlpha[i] = nextProxy;
                this.proxyAlphaAttribute.array[i] = nextProxy;
                proxyAlphaDirty = true;
            }
        }

        if (proxyAlphaDirty) {
            this.proxyAlphaAttribute.needsUpdate = true;
        }
    }

    _registerSystems(systems, parent) {
        this._destroyProxyMesh();

        this.systems = Array.isArray(systems) ? systems : [];
        if (!this.systems.length) {
            this.proxyAlpha = new Float32Array(0);
            this.detailAlpha = new Float32Array(0);
            this.detailVisibility = new Uint8Array(0);
            return;
        }

        const count = this.systems.length;
        this.proxyAlpha = new Float32Array(count);
        this.detailAlpha = new Float32Array(count);
        this.detailVisibility = new Uint8Array(count);

        const geometry = new THREE.IcosahedronGeometry(1, 1);
        this.proxyAlphaAttribute = new THREE.InstancedBufferAttribute(this.proxyAlpha, 1);
        this.proxyAlphaAttribute.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('instanceAlpha', this.proxyAlphaAttribute);
        const proxyTintAttribute = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        geometry.setAttribute('instanceTint', proxyTintAttribute);

        const material = new THREE.ShaderMaterial({
            vertexShader: PROXY_VERTEX_SHADER,
            fragmentShader: PROXY_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });

        this.proxyMesh = new THREE.InstancedMesh(geometry, material, count);
        this.proxyMesh.name = 'StellarLODProxyMesh';
        this.proxyMesh.frustumCulled = false;
        this.proxyMesh.renderOrder = -7;
        this.proxyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < count; i++) {
            const system = this.systems[i];
            this._instanceScale.setScalar(system.proxyScale);
            this._instanceMatrix.compose(system.group.position, this._identityQuaternion, this._instanceScale);
            this.proxyMesh.setMatrixAt(i, this._instanceMatrix);
            proxyTintAttribute.setXYZ(i, system.proxyColor.r, system.proxyColor.g, system.proxyColor.b);

            this.detailAlpha[i] = 1;
            this.proxyAlpha[i] = 0;
            this.detailVisibility[i] = 1;
            this._applyDetailAlpha(system, 1);
        }

        this.proxyMesh.instanceMatrix.needsUpdate = true;
        proxyTintAttribute.needsUpdate = true;
        this.proxyAlphaAttribute.needsUpdate = true;

        (parent || this.sceneGraph?.scene)?.add?.(this.proxyMesh);
        this._applyImmediateState();
    }

    _applyImmediateState() {
        if (!this.proxyMesh || !this.systems.length || !this.camera) {
            return;
        }

        this._camPos.copy(this.camera.position);
        for (let i = 0; i < this.systems.length; i++) {
            const system = this.systems[i];
            system.group.getWorldPosition(this._sysPos);
            const distSq = this._camPos.distanceToSquared(this._sysPos);
            const wantsDetail = distSq <= this.localEnterSq;
            const detailAlpha = wantsDetail ? 1 : 0;
            const proxyAlpha = wantsDetail ? 0 : this._computeProxyAlpha(distSq);

            this.detailVisibility[i] = wantsDetail ? 1 : 0;
            this.detailAlpha[i] = detailAlpha;
            this.proxyAlpha[i] = proxyAlpha;
            this.proxyAlphaAttribute.array[i] = proxyAlpha;
            this._applyDetailAlpha(system, detailAlpha);
        }

        this.proxyAlphaAttribute.needsUpdate = true;
    }

    _applyDetailAlpha(system, alpha) {
        const visible = alpha > 0.015;
        system.group.visible = visible;

        const materials = system.detailMaterials;
        const baseOpacities = system.detailBaseOpacities;
        for (let i = 0; i < materials.length; i++) {
            const material = materials[i];
            material.opacity = baseOpacities[i] * alpha;
            material.transparent = true;
        }
    }

    _computeProxyAlpha(distSq) {
        if (distSq <= this.proxyFadeStartSq) {
            return 0.96;
        }
        if (distSq >= this.proxyFadeEndSq) {
            return 0.34;
        }

        const t = (distSq - this.proxyFadeStartSq) / Math.max(1, this.proxyFadeEndSq - this.proxyFadeStartSq);
        return this._mix(0.96, 0.34, t);
    }

    _mix(from, to, t) {
        return from + (to - from) * t;
    }

    _destroyProxyMesh() {
        if (!this.proxyMesh) {
            return;
        }

        this.proxyMesh.parent?.remove?.(this.proxyMesh);
        this.proxyMesh.geometry?.dispose?.();
        this.proxyMesh.material?.dispose?.();
        this.proxyMesh = null;
        this.proxyAlphaAttribute = null;
    }

    getDebugState() {
        let detailedCount = 0;
        let proxyVisibleCount = 0;

        for (let i = 0; i < this.systems.length; i++) {
            if (this.detailAlpha[i] > 0.5) {
                detailedCount++;
            }
            if (this.proxyAlpha[i] > 0.05) {
                proxyVisibleCount++;
            }
        }

        return {
            registeredSystems: this.systems.length,
            detailedCount,
            proxyVisibleCount,
        };
    }

    dispose() {
        this._removeSystemsListener?.();
        this._removeSystemsListener = null;
        this._destroyProxyMesh();
    }
}

export default StellarLODSystem;
