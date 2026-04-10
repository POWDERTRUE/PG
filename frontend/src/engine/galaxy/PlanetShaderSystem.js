import * as THREE from 'three';
import { MaterialRegistry } from '../rendering/MaterialRegistry.js';

export class PlanetShaderSystem {
    constructor() {
        this._textureCache = new Map();
        this._normalCache = new Map();
        this._cloudRefs = [];
        this._atmosphereRefs = [];
        this._cityLightRefs = [];
        this._cloudTickId = 0;
        this._sunReference = null;

        // REGLA 8: scratch buffers for radius lookups stay pre-allocated.
        this._radiusBox = new THREE.Box3();
        this._radiusSize = new THREE.Vector3();
        this._ringVec = new THREE.Vector3();
        this._sunVec = new THREE.Vector3();
        this._cameraVec = new THREE.Vector3();
        this._ownerVec = new THREE.Vector3();
    }

    upgradePlanet(mesh, planetClass = 'default', hasRings = false, options = {}) {
        const {
            preserveSurfaceMaterial = false,
            cloudMaterialParams = null,
            cityLightMaterialParams = null,
            ringMaterialParams = null,
            ringTiltX = null,
        } = options;
        const tex = this._getTexture(planetClass);
        const normTex = this._getNormalTexture(planetClass);

        if (!preserveSurfaceMaterial) {
            const materialMeta = MaterialRegistry.getMaterialMeta(mesh.material);
            if (materialMeta) {
                MaterialRegistry.release(materialMeta.type, materialMeta.param);
            } else {
                mesh.material.dispose?.();
            }

            mesh.material = new THREE.MeshStandardMaterial({
                map: tex,
                normalMap: normTex,
                normalScale: new THREE.Vector2(2.0, 2.0),
                roughness: this._roughness(planetClass),
                metalness: this._metalness(planetClass),
                emissiveMap: planetClass === 'volcanic' ? tex : null,
                emissive: planetClass === 'volcanic' ? new THREE.Color(0xff2200) : new THREE.Color(0x000000),
                emissiveIntensity: planetClass === 'volcanic' ? 0.22 : 0,
            });
        }

        const radius = this._getRadius(mesh);

        this._addClouds(mesh, planetClass, radius, cloudMaterialParams);

        const atmosphereGeo = new THREE.SphereGeometry(radius * 1.26, 64, 64);
        const rayleighColor = this._atmosphereColor(planetClass);
        const mieColor = this._horizonColor(planetClass);

        const atmosphereMat = new THREE.ShaderMaterial({
            uniforms: {
                uBaseColor: { value: rayleighColor },
                uMieColor: { value: mieColor },
                uSunDirection: { value: new THREE.Vector3(1, 0.5, 1).normalize() },
                uCameraPos: { value: new THREE.Vector3() },
                uPlanetRadius: { value: radius },
                uAtmoRadius: { value: radius * 1.26 },
                uRayleighPow: { value: 3.5 },
                uMiePow: { value: 7.5 },
                uIntensity: { value: 0.82 },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3 uBaseColor;
                uniform vec3 uMieColor;
                uniform vec3 uSunDirection;
                uniform vec3 uCameraPos;
                uniform float uPlanetRadius;
                uniform float uAtmoRadius;
                uniform float uRayleighPow;
                uniform float uMiePow;
                uniform float uIntensity;
                varying vec3 vNormal;
                varying vec3 vWorldPos;

                void main() {
                    vec3 viewDir = normalize(uCameraPos - vWorldPos);
                    float cosView = max(dot(vNormal, viewDir), 0.0);
                    float cosSun = max(dot(vNormal, uSunDirection), 0.0);

                    float rayleigh = pow(1.0 - cosView, uRayleighPow);
                    float mie = pow(1.0 - cosView, uMiePow) * (0.4 + 0.6 * cosSun);

                    vec3 col = uBaseColor * rayleigh * uIntensity
                             + uMieColor * mie * uIntensity * 0.6;
                    float alpha = clamp(rayleigh * 0.95 + mie * 0.45, 0.0, 1.0);
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
        });
        atmosphereMat.userData.isAtmosphere = true;

        const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
        atmosphere.name = `${mesh.name}_atmosphere`;
        atmosphere.userData = {
            isPlanetShaderDecoration: true,
            isAtmosphere: true,
        };
        mesh.add(atmosphere);
        this._atmosphereRefs.push({
            ownerMesh: mesh,
            atmosphereMesh: atmosphere,
            mat: atmosphereMat,
        });

        if (['ocean', 'jungle', 'ice'].includes(planetClass)) {
            this._addCityLights(mesh, planetClass, radius, cityLightMaterialParams);
        }

        if (hasRings || planetClass === 'gas_giant') {
            this._addRings(mesh, radius, ringMaterialParams, ringTiltX);
        }
    }

    _addClouds(mesh, planetClass, radius, cloudMaterialParams = null) {
        const hasClouds = ['ocean', 'jungle', 'desert', 'ice', 'gas_giant'].includes(planetClass);
        if (!hasClouds) return;

        const cloudParams = cloudMaterialParams ?? {
            cloudColor: this._cloudColorHex(planetClass),
            coverage: this._cloudCoverage(planetClass),
            opacity: 0.70,
        };
        const cloudMat = MaterialRegistry.get('cloud-shader', cloudParams);

        const cloudMesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.05, 64, 64),
            cloudMat
        );
        cloudMesh.name = `${mesh.name}_clouds`;
        cloudMesh.userData = {
            isPlanetShaderDecoration: true,
            isCloudLayer: true,
            cloudRegistryParams: cloudParams,
        };
        mesh.add(cloudMesh);

        this._cloudRefs.push({
            ownerMesh: mesh,
            cloudMesh,
            mat: cloudMat,
            registryParams: cloudParams,
        });
    }

    _addCityLights(mesh, planetClass, radius, cityLightMaterialParams = null) {
        const cityParams = cityLightMaterialParams ?? this._cityLightMaterialParams(planetClass, mesh.name);
        const cityMat = MaterialRegistry.get('city-lights-shader', cityParams);

        const cityMesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.001, 64, 64), cityMat);
        cityMesh.name = `${mesh.name}_citylights`;
        cityMesh.userData = {
            isPlanetShaderDecoration: true,
            isCityLights: true,
            cityLightRegistryParams: cityParams,
        };
        mesh.add(cityMesh);
        this._cityLightRefs.push({
            ownerMesh: mesh,
            cityMesh,
            mat: cityMat,
            registryParams: cityParams,
        });
    }

    setSunReference(sunMesh) {
        this._sunReference = sunMesh ?? null;
    }

    _addRings(mesh, radius, ringMaterialParams = null, ringTiltX = null) {
        const ringGeo = new THREE.RingGeometry(radius * 1.55, radius * 2.85, 128);
        const pos = ringGeo.attributes.position;
        const uv = ringGeo.attributes.uv;

        for (let i = 0; i < pos.count; i++) {
            // REGLA 8: reuse the pre-allocated ring vector instead of creating
            // 128 throwaway THREE.Vector3 instances during ring setup.
            this._ringVec.fromBufferAttribute(pos, i);
            const frac = (this._ringVec.length() - radius * 1.55) / (radius * 1.3);
            uv.setXY(i, frac, 0.5);
        }
        uv.needsUpdate = true;

        const ringParams = ringMaterialParams ?? this._ringMaterialParams();
        const ringMat = MaterialRegistry.get('ring-material', ringParams);

        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = ringTiltX ?? (Math.PI / 2 + 0.12);
        ring.name = `${mesh.name}_ring`;
        ring.userData = {
            isPlanetShaderDecoration: true,
            isPlanetRing: true,
            ringRegistryParams: ringParams,
        };
        mesh.add(ring);
    }

    _getTexture(planetClass) {
        if (this._textureCache.has(planetClass)) return this._textureCache.get(planetClass);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        this._paintPlanet(ctx, planetClass, 512);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        this._textureCache.set(planetClass, tex);
        return tex;
    }

    _getNormalTexture(planetClass) {
        if (this._normalCache.has(planetClass)) return this._normalCache.get(planetClass);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        this._paintNormal(ctx, planetClass, 256);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        this._normalCache.set(planetClass, tex);
        return tex;
    }

    _paintNormal(ctx, cls, size) {
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, size, size);
        const randomBetween = (a, b) => a + Math.random() * (b - a);

        const bumpCount = {
            volcanic: 120,
            desert: 80,
            ocean: 30,
            ice: 60,
            gas_giant: 20,
            jungle: 90,
        }[cls] ?? 50;

        for (let i = 0; i < bumpCount; i++) {
            const x = randomBetween(0, size);
            const y = randomBetween(0, size);
            const radius = randomBetween(4, size * 0.1);
            const angle = randomBetween(0, Math.PI * 2);
            const dx = Math.cos(angle) * 0.3;
            const dy = Math.sin(angle) * 0.3;
            const red = Math.floor(128 + dx * 80);
            const green = Math.floor(128 + dy * 80);

            ctx.fillStyle = `rgba(${red},${green},255,0.12)`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _paintPlanet(ctx, cls, size) {
        const randomBetween = (a, b) => a + Math.random() * (b - a);

        switch (cls) {
            case 'ocean': {
                const gradient = ctx.createLinearGradient(0, 0, 0, size);
                gradient.addColorStop(0, '#001a66');
                gradient.addColorStop(0.3, '#0044cc');
                gradient.addColorStop(0.65, '#006699');
                gradient.addColorStop(1, '#002244');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);

                for (let i = 0; i < 8; i++) {
                    const cx = randomBetween(0, size);
                    const cy = randomBetween(0, size);
                    const radius = randomBetween(20, size * 0.18);
                    ctx.fillStyle = `rgba(${Math.floor(randomBetween(60, 120))},${Math.floor(randomBetween(100, 160))},${Math.floor(randomBetween(40, 80))},0.75)`;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                for (let i = 0; i < 400; i++) {
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(0.5, 2.5), 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(220,240,255,0.6)';
                ctx.fillRect(0, 0, size, size * 0.07);
                ctx.fillRect(0, size * 0.93, size, size * 0.07);
                break;
            }
            case 'desert': {
                const gradient = ctx.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#cc5500');
                gradient.addColorStop(0.4, '#ff8833');
                gradient.addColorStop(0.7, '#dd7722');
                gradient.addColorStop(1, '#aa3300');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);

                for (let i = 0; i < 180; i++) {
                    ctx.fillStyle = `rgba(${Math.floor(randomBetween(160, 200))},${Math.floor(randomBetween(80, 120))},${Math.floor(randomBetween(20, 60))},0.25)`;
                    ctx.beginPath();
                    ctx.ellipse(
                        randomBetween(0, size),
                        randomBetween(0, size),
                        randomBetween(8, 40),
                        randomBetween(2, 10),
                        randomBetween(0, Math.PI),
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }

                for (let i = 0; i < 12; i++) {
                    const cx = randomBetween(0, size);
                    const cy = randomBetween(0, size);
                    const radius = randomBetween(5, 20);
                    ctx.strokeStyle = 'rgba(100,50,10,0.3)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;
            }
            case 'gas_giant': {
                const bands = ['#cc8844', '#aa6622', '#dd9955', '#bb7733', '#ee9966', '#aa5511', '#ffaa55', '#cc7733', '#bb6622', '#ee8844'];
                const bandHeight = size / bands.length;
                bands.forEach((color, index) => {
                    ctx.fillStyle = color;
                    ctx.fillRect(0, index * bandHeight, size, bandHeight + 2);
                });

                ctx.fillStyle = 'rgba(255,220,160,0.15)';
                for (let i = 0; i < 20; i++) {
                    const y = randomBetween(0, size);
                    const height = randomBetween(2, 12);
                    ctx.fillRect(0, y + Math.sin(i * 2.3) * 8, size, height);
                }

                const eyeX = randomBetween(size * 0.2, size * 0.8);
                const eyeY = randomBetween(size * 0.3, size * 0.7);
                const eyeRadius = randomBetween(12, 28);
                const eyeGradient = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, eyeRadius);
                eyeGradient.addColorStop(0, 'rgba(255,100,50,0.7)');
                eyeGradient.addColorStop(0.5, 'rgba(200,80,30,0.3)');
                eyeGradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = eyeGradient;
                ctx.beginPath();
                ctx.ellipse(eyeX, eyeY, eyeRadius, eyeRadius * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'ice': {
                const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
                gradient.addColorStop(0, '#f0f8ff');
                gradient.addColorStop(0.5, '#c8e8ff');
                gradient.addColorStop(0.8, '#aaddff');
                gradient.addColorStop(1, '#8898bb');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);

                ctx.strokeStyle = 'rgba(100,160,220,0.5)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 80; i++) {
                    ctx.beginPath();
                    ctx.moveTo(randomBetween(0, size), randomBetween(0, size));
                    const cx = randomBetween(0, size);
                    const cy = randomBetween(0, size);
                    ctx.lineTo(cx, cy);
                    ctx.lineTo(cx + randomBetween(-30, 30), cy + randomBetween(-30, 30));
                    ctx.stroke();
                }

                ctx.fillStyle = 'rgba(180,220,255,0.2)';
                for (let i = 0; i < 40; i++) {
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(5, 30), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'volcanic': {
                ctx.fillStyle = '#0d0200';
                ctx.fillRect(0, 0, size, size);

                for (let i = 0; i < 120; i++) {
                    const alpha = randomBetween(0.3, 0.7);
                    ctx.fillStyle = `rgba(${Math.floor(randomBetween(180, 255))},${Math.floor(randomBetween(20, 80))},0,${alpha})`;
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(3, 18), 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(255,150,30,0.2)';
                for (let i = 0; i < 50; i++) {
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(1, 7), 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(30,10,0,0.4)';
                for (let i = 0; i < 200; i++) {
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(4, 25), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }
            case 'jungle': {
                const gradient = ctx.createLinearGradient(0, 0, size, size);
                gradient.addColorStop(0, '#001500');
                gradient.addColorStop(0.4, '#004400');
                gradient.addColorStop(0.7, '#006600');
                gradient.addColorStop(1, '#002200');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);

                for (let i = 0; i < 250; i++) {
                    const shade = Math.floor(randomBetween(30, 90));
                    ctx.fillStyle = `rgba(0,${shade},0,0.4)`;
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(3, 22), 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(0,50,80,0.3)';
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    ctx.moveTo(randomBetween(0, size), randomBetween(0, size));
                    ctx.bezierCurveTo(
                        randomBetween(0, size), randomBetween(0, size),
                        randomBetween(0, size), randomBetween(0, size),
                        randomBetween(0, size), randomBetween(0, size)
                    );
                    ctx.lineWidth = randomBetween(2, 10);
                    ctx.stroke();
                }
                break;
            }
            default: {
                const hue = Math.floor(Math.random() * 360);
                ctx.fillStyle = `hsl(${hue},50%,25%)`;
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = `hsla(${hue},60%,45%,0.3)`;
                for (let i = 0; i < 120; i++) {
                    ctx.beginPath();
                    ctx.arc(randomBetween(0, size), randomBetween(0, size), randomBetween(3, 16), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    update(delta, camera) {
        this._cloudTickId += 1;
        const tickId = this._cloudTickId;

        for (const { mat } of this._cloudRefs) {
            if (mat?.userData?._cloudTickId === tickId) continue;
            if (mat?.userData) {
                mat.userData._cloudTickId = tickId;
            }
            if (mat?.uniforms?.time) {
                mat.uniforms.time.value += delta;
            }
        }

        const activeCamera = camera ?? null;
        if (activeCamera?.getWorldPosition) {
            activeCamera.getWorldPosition(this._cameraVec);
        } else if (activeCamera?.position) {
            this._cameraVec.copy(activeCamera.position);
        }

        if (this._sunReference?.getWorldPosition) {
            this._sunReference.getWorldPosition(this._sunVec);
        } else {
            this._sunVec.set(1, 0.5, 1).normalize().multiplyScalar(1000);
        }

        for (const { ownerMesh, mat } of this._atmosphereRefs) {
            this._updateLightVectors(ownerMesh, mat, true, !!activeCamera);
        }

        for (const { ownerMesh, mat } of this._cityLightRefs) {
            this._updateLightVectors(ownerMesh, mat, false, false);
        }
    }

    detachPlanet(mesh) {
        if (!mesh) return;

        const remainingRefs = [];
        for (const ref of this._cloudRefs) {
            if (ref.ownerMesh === mesh) {
                MaterialRegistry.release('cloud-shader', ref.registryParams);
            } else {
                remainingRefs.push(ref);
            }
        }
        this._cloudRefs = remainingRefs;
        this._atmosphereRefs = this._atmosphereRefs.filter((ref) => ref.ownerMesh !== mesh);
        this._cityLightRefs = this._cityLightRefs.filter((ref) => ref.ownerMesh !== mesh);

        for (let i = mesh.children.length - 1; i >= 0; i--) {
            const child = mesh.children[i];
            if (!child.userData?.isPlanetShaderDecoration) continue;

            mesh.remove(child);
            child.geometry?.dispose?.();

            const materialMeta = MaterialRegistry.getMaterialMeta(child.material);
            if (materialMeta) {
                if (materialMeta.type !== 'cloud-shader') {
                    MaterialRegistry.release(materialMeta.type, materialMeta.param);
                }
                continue;
            }
            child.material?.dispose?.();
        }
    }

    _getRadius(mesh) {
        this._radiusBox.setFromObject(mesh);
        return this._radiusBox.getSize(this._radiusSize).length() / 2;
    }

    _roughness(cls) {
        return { ocean: 0.1, ice: 0.05, gas_giant: 0.35, volcanic: 0.92, desert: 0.92, jungle: 0.72 }[cls] ?? 0.65;
    }

    _metalness(cls) {
        return { ocean: 0.08, ice: 0.04, gas_giant: 0.0, volcanic: 0.15, desert: 0.0, jungle: 0.04 }[cls] ?? 0.08;
    }

    _cloudColorHex(cls) {
        const map = {
            ocean: 0xf5f8ff,
            jungle: 0xeef8ee,
            desert: 0xffe8cc,
            ice: 0xffffff,
            gas_giant: 0xffeecc,
        };
        return map[cls] ?? 0xffffff;
    }

    _cloudCoverage(cls) {
        return { ocean: 0.6, jungle: 0.55, desert: 0.25, ice: 0.45, gas_giant: 0.8 }[cls] ?? 0.4;
    }

    _ringMaterialParams() {
        return {
            color1: 0xddcc99,
            color2: 0x886644,
            color3: 0xfff8ee,
        };
    }

    _cityLightMaterialParams(planetClass, registryKey) {
        const presets = {
            ocean: { cityColor: 0xffeeaa, transitionWidth: 0.20, intensity: 0.58 },
            jungle: { cityColor: 0xaaffcc, transitionWidth: 0.23, intensity: 0.50 },
            ice: { cityColor: 0xaaccff, transitionWidth: 0.18, intensity: 0.62 },
        };
        return {
            ...(presets[planetClass] ?? presets.ocean),
            textureId: 'city-lights-mask',
            registryKey,
        };
    }

    _updateLightVectors(ownerMesh, material, updateCameraPos, hasCamera) {
        if (!ownerMesh || !material?.uniforms?.uSunDirection?.value) return;

        ownerMesh.getWorldPosition(this._ownerVec);
        material.uniforms.uSunDirection.value.subVectors(this._sunVec, this._ownerVec);

        if (material.uniforms.uSunDirection.value.lengthSq() < 1e-8) {
            material.uniforms.uSunDirection.value.set(1, 0.5, 1).normalize();
        } else {
            material.uniforms.uSunDirection.value.normalize();
        }

        if (updateCameraPos && hasCamera && material.uniforms.uCameraPos?.value) {
            material.uniforms.uCameraPos.value.copy(this._cameraVec);
        }
    }

    _atmosphereColor(cls) {
        const map = {
            ocean: new THREE.Color(0x4488ff),
            desert: new THREE.Color(0xff9944),
            gas_giant: new THREE.Color(0xffcc88),
            ice: new THREE.Color(0xbbddff),
            volcanic: new THREE.Color(0xff3300),
            jungle: new THREE.Color(0x44ff88),
        };
        return map[cls] ?? new THREE.Color(0x88aaff);
    }

    _horizonColor(cls) {
        const map = {
            ocean: new THREE.Color(0xffffff),
            desert: new THREE.Color(0xff7700),
            gas_giant: new THREE.Color(0xffbb55),
            ice: new THREE.Color(0xeef8ff),
            volcanic: new THREE.Color(0xff7700),
            jungle: new THREE.Color(0xbbffcc),
        };
        return map[cls] ?? new THREE.Color(0xffeedd);
    }

    dispose() {
        for (const { registryParams } of this._cloudRefs) {
            MaterialRegistry.release('cloud-shader', registryParams);
        }
        for (const { registryParams } of this._cityLightRefs) {
            MaterialRegistry.release('city-lights-shader', registryParams);
        }
        for (const [, tex] of this._textureCache) tex.dispose();
        for (const [, tex] of this._normalCache) tex.dispose();
        this._textureCache.clear();
        this._normalCache.clear();
        this._cloudRefs = [];
        this._atmosphereRefs = [];
        this._cityLightRefs = [];
        this._sunReference = null;
    }
}
