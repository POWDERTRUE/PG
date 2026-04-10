import * as THREE from 'three';

/**
 * SunCoronaSystem V2 — OMEGA Cinematic Solar Simulation
 *
 * Layers:
 *   1. Inner corona — Fresnel + animated plasma noise (hash-noise 3D)
 *   2. Outer corona — wide diffuse glow with pulsation
 *   3. Photosphere — subtle surface granulation texture
 *   4. Solar prominences — 6 animated plasma loop arcs
 *   5. Solar flare jets — 4 protruding energy beams (animated)
 *   6. Lens flare sprites — 3 god-ray-style billboard discs
 *   7. Energy rings — 4 pulsating equatorial torus rings
 *   8. Point lights — main sun light + warm fill + deep space hemi
 */
export class SunCoronaSystem {
    constructor(scene, sunMesh) {
        this.scene   = scene;
        this.sunMesh = sunMesh;
        this._time   = 0;
        this._rings       = [];
        this._prominences = [];
        this._flares      = [];
        this._lensFlares  = [];
        this._innerCorona = null;
        this._outerCorona = null;
        this._photosphere = null;
        this._coronaVolumetric = null;

        this._buildPhotosphere();
        this._buildCorona();
        this._buildCoronaVolumetric();
        this._buildSolarProminences();
        this._buildSolarFlares();
        this._buildLensFlareSprites();
        this._buildEnergyRings();
        this._buildLights();

        console.log('[SunCoronaSystem V2] Cinematic solar simulation online — plasma loops, flares, lens sprites.');
    }

    // ── Photosphere (animated granulation on sun surface) ────────────────────

    _buildPhotosphere() {
        const R = 40;
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
            },
            vertexShader: /* glsl */`
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                void main() {
                    vNormal   = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform float time;
                varying vec3 vWorldPos;
                varying vec3 vNormal;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 p) {
                    vec3 i = floor(p); vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash(i),             hash(i+vec3(1,0,0)), f.x),
                            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
                }

                void main() {
                    // Granulation cells — convection pattern
                    float gran = noise(vWorldPos * 0.08 + time * 0.08);
                    gran += noise(vWorldPos * 0.20 - time * 0.05) * 0.5;
                    gran += noise(vWorldPos * 0.40 + time * 0.03) * 0.25;
                    gran /= 1.75;

                    // Surface temperature variation
                    vec3 hotColor  = vec3(1.0, 0.98, 0.8);  // white-yellow (hot upwellings)
                    vec3 coolColor = vec3(1.0, 0.55, 0.12);  // orange (cooler downdrafts)
                    vec3 col = mix(coolColor, hotColor, gran);

                    // Limb darkening — realistic stellar physics
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float limb = dot(vNormal, viewDir);
                    float limbDarken = pow(max(limb, 0.0), 0.4);
                    col *= 0.45 + 0.55 * limbDarken;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        this._photosphere = new THREE.Mesh(new THREE.SphereGeometry(R, 80, 80), mat);
        this._photosphere.name = 'SunPhotosphere';
        this.sunMesh.add(this._photosphere);
    }

    // ── Corona spheres ───────────────────────────────────────────────────────

    _buildCorona() {
        const R = 40;

        // Inner corona — Fresnel + animated plasma turbulence
        const innerMat = new THREE.ShaderMaterial({
            uniforms: {
                time:   { value: 0 },
                color1: { value: new THREE.Color(0xff6600) },
                color2: { value: new THREE.Color(0xffdd00) },
                color3: { value: new THREE.Color(0xffffff) },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal   = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform float time;
                uniform vec3  color1;
                uniform vec3  color2;
                uniform vec3  color3;
                varying vec3  vNormal;
                varying vec3  vWorldPos;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise(vec3 p) {
                    vec3 i = floor(p); vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(mix(hash(i),             hash(i+vec3(1,0,0)), f.x),
                            mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                            mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
                }

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.8);

                    float n1 = noise(vWorldPos * 0.035 + time * 0.16);
                    float n2 = noise(vWorldPos * 0.090 - time * 0.08) * 0.5;
                    float n3 = noise(vWorldPos * 0.200 + time * 0.05) * 0.25;
                    float n = (n1 + n2 + n3) / 1.75;

                    vec3 col = mix(color1, color2, n);
                    col = mix(col, color3, pow(n, 4.0) * 0.3);

                    float alpha = fresnel * (0.82 + n * 0.28);
                    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide,
        });

        this._innerCorona = new THREE.Mesh(new THREE.SphereGeometry(R * 1.42, 80, 80), innerMat);
        this._innerCorona.name = 'SunCorona_Inner';
        this.sunMesh.add(this._innerCorona);

        // Outer corona — wide diffuse Fresnel glow
        const outerMat = new THREE.ShaderMaterial({
            uniforms: {
                time:  { value: 0 },
                color: { value: new THREE.Color(0xff4400) },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal   = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform float time;
                uniform vec3  color;
                varying vec3  vNormal;
                varying vec3  vWorldPos;
                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 4.5);
                    float pulse   = 0.72 + 0.28 * sin(time * 1.05);
                    gl_FragColor  = vec4(color, fresnel * 0.48 * pulse);
                }
            `,
            transparent: true,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            side:        THREE.BackSide,
        });

        this._outerCorona = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 64, 64), outerMat);
        this._outerCorona.name = 'SunCorona_Outer';
        this.sunMesh.add(this._outerCorona);
    }

    // ── Volumetric corona (extra wide soft haze) ─────────────────────────────

    _buildCoronaVolumetric() {
        const R = 40;
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal   = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 6.0);
                    float slow    = 0.6 + 0.4 * sin(time * 0.35);
                    vec3  col     = vec3(1.0, 0.6, 0.2);
                    gl_FragColor  = vec4(col, fresnel * 0.22 * slow);
                }
            `,
            transparent: true,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            side:        THREE.BackSide,
        });
        this._coronaVolumetric = new THREE.Mesh(new THREE.SphereGeometry(R * 3.5, 32, 32), mat);
        this._coronaVolumetric.name = 'SunCorona_Volumetric';
        this.sunMesh.add(this._coronaVolumetric);
    }

    // ── Solar prominences — plasma loops on limb ─────────────────────────────

    _buildSolarProminences() {
        const R = 40;
        const prominenceConfigs = [
            { angle: 0.0,   tilt: 0.1,  height: 28, color: 0xff5500 },
            { angle: 1.05,  tilt: 0.3,  height: 22, color: 0xff3300 },
            { angle: 2.09,  tilt: -0.2, height: 32, color: 0xff6600 },
            { angle: 3.14,  tilt: 0.4,  height: 25, color: 0xff4400 },
            { angle: 4.19,  tilt: -0.1, height: 20, color: 0xff7700 },
            { angle: 5.24,  tilt: 0.2,  height: 35, color: 0xff2200 },
        ];

        for (const cfg of prominenceConfigs) {
            // Build a tube-curve that forms a plasma "arch" above the surface
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time:  { value: 0 },
                    color: { value: new THREE.Color(cfg.color) },
                    phase: { value: cfg.angle * 2.0 },
                },
                vertexShader: /* glsl */`
                    attribute float lineT;
                    varying float vT;
                    void main() {
                        vT = lineT;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: /* glsl */`
                    uniform float time;
                    uniform vec3  color;
                    uniform float phase;
                    varying float vT;
                    void main() {
                        // Fade toward loop tips
                        float fade = sin(vT * 3.14159);
                        // Pulse
                        float pulse = 0.6 + 0.4 * sin(time * 1.8 + phase);
                        gl_FragColor = vec4(color, fade * pulse * 0.75);
                    }
                `,
                transparent: true,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
            });

            // Create arch points along a curved path
            const archPoints = [];
            const tLineArr  = [];
            const N = 32;

            for (let i = 0; i <= N; i++) {
                const t     = i / N;
                const angle = cfg.angle;
                const h     = cfg.height;

                // Arch: rises from surface, peaks at height, returns
                const archAngle = t * Math.PI;
                const radial    = R + h * Math.sin(archAngle);
                const lateral   = h * 0.5 * Math.sin(archAngle * 2.0) * Math.cos(cfg.tilt);
                const baseAngle = angle + t * 0.8;

                archPoints.push(
                    new THREE.Vector3(
                        Math.cos(baseAngle) * radial + lateral * Math.sin(baseAngle),
                        Math.sin(baseAngle + cfg.tilt) * radial * 0.4 + h * Math.sin(archAngle) * 0.5,
                        Math.sin(baseAngle) * radial - lateral * Math.cos(baseAngle)
                    )
                );
                tLineArr.push(t);
            }

            const geo = new THREE.BufferGeometry().setFromPoints(archPoints);
            geo.setAttribute('lineT', new THREE.Float32BufferAttribute(tLineArr, 1));

            const line = new THREE.Line(geo, mat);
            line.name = `SunProminence_${this._prominences.length}`;
            this.sunMesh.add(line);
            this._prominences.push({ line, mat, cfg });
        }
    }

    // ── Solar flare jets ─────────────────────────────────────────────────────

    _buildSolarFlares() {
        const R   = 40;
        const configs = [
            { theta: 0.5,  phi: 0.3, len: 45, color: 0xff8800, speed: 0.6 },
            { theta: 2.0,  phi: -0.2, len: 38, color: 0xffaa00, speed: 0.9 },
            { theta: 3.8,  phi: 0.5, len: 52, color: 0xff6600, speed: 0.7 },
            { theta: 5.1,  phi: -0.4, len: 40, color: 0xff5500, speed: 1.1 },
        ];

        for (const cfg of configs) {
            // Direction from sun center
            const dir = new THREE.Vector3(
                Math.cos(cfg.theta) * Math.cos(cfg.phi),
                Math.sin(cfg.phi),
                Math.sin(cfg.theta) * Math.cos(cfg.phi)
            ).normalize();

            const flareGeo = new THREE.ConeGeometry(2.5, cfg.len, 8, 1, true);
            flareGeo.translate(0, cfg.len * 0.5, 0);
            flareGeo.rotateX(Math.PI * 0.5);

            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time:  { value: 0 },
                    color: { value: new THREE.Color(cfg.color) },
                    speed: { value: cfg.speed },
                    phase: { value: cfg.theta },
                },
                vertexShader: /* glsl */`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: /* glsl */`
                    uniform float time;
                    uniform vec3  color;
                    uniform float speed;
                    uniform float phase;
                    varying vec2  vUv;
                    void main() {
                        float dist = 1.0 - vUv.y; // 0 at start, 1 at tip
                        float fade = pow(dist, 0.6) * (1.0 - dist);
                        float pulse = 0.4 + 0.6 * abs(sin(time * speed + phase));
                        gl_FragColor = vec4(color, fade * pulse * 0.65);
                    }
                `,
                transparent: true,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
                side:        THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(flareGeo, mat);
            // Orient flare cone along outward direction
            const up   = new THREE.Vector3(0, 0, 1);
            mesh.quaternion.setFromUnitVectors(up, dir);
            mesh.position.copy(dir.clone().multiplyScalar(R));
            mesh.name = `SunFlare_${this._flares.length}`;
            this.sunMesh.add(mesh);
            this._flares.push({ mesh, mat, cfg });
        }
    }

    // ── Lens flare sprites (billboard discs around sun) ───────────────────────

    _buildLensFlareSprites() {
        // Simple canvas-based soft disc texture
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0.0, 'rgba(255,240,200,1.0)');
        grad.addColorStop(0.2, 'rgba(255,200,100,0.6)');
        grad.addColorStop(0.5, 'rgba(255,140,50,0.2)');
        grad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(canvas);

        const configs = [
            { scale: 180, opacity: 0.10 },
            { scale: 340, opacity: 0.05 },
            { scale: 520, opacity: 0.02 },
        ];

        for (const cfg of configs) {
            const mat   = new THREE.SpriteMaterial({
                map: tex,
                color: 0xffcc88,
                transparent: true,
                opacity: cfg.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.setScalar(cfg.scale);
            sprite.name = `SunLensFlare_${this._lensFlares.length}`;
            this.sunMesh.add(sprite);
            this._lensFlares.push({ sprite, mat, cfg });
        }
    }

    // ── Energy Rings ─────────────────────────────────────────────────────────

    _buildEnergyRings() {
        const configs = [
            { radius: 56, tube: 0.65, color: 0xffaa00, speed: 0.80, phase: 0.0  },
            { radius: 70, tube: 0.45, color: 0xff6600, speed: 1.25, phase: 1.2  },
            { radius: 86, tube: 0.30, color: 0xff3300, speed: 0.65, phase: 2.4  },
            { radius: 102,tube: 0.22, color: 0xffcc44, speed: 1.60, phase: 3.6  },
            { radius: 120,tube: 0.16, color: 0xffd870, speed: 0.45, phase: 1.8  },
        ];

        for (const cfg of configs) {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time:  { value: 0 },
                    color: { value: new THREE.Color(cfg.color) },
                    phase: { value: cfg.phase },
                    speed: { value: cfg.speed },
                },
                vertexShader: /* glsl */`
                    varying vec2 vUV;
                    void main() { vUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `,
                fragmentShader: /* glsl */`
                    uniform float time; uniform vec3 color; uniform float phase; uniform float speed;
                    varying vec2 vUV;
                    void main() {
                        float edgeFade = sin(vUV.x * 3.14159);
                        float pulse    = 0.45 + 0.55 * sin(time * speed + phase);
                        gl_FragColor   = vec4(color, edgeFade * pulse * 0.75);
                    }
                `,
                transparent: true,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
                side:        THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(new THREE.TorusGeometry(cfg.radius, cfg.tube, 16, 100), mat);
            mesh.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
            mesh.rotation.z = (Math.random() - 0.5) * 0.4;
            mesh.name = `SunEnergyRing_${this._rings.length}`;
            this.sunMesh.add(mesh);
            this._rings.push({ mesh, mat, cfg });
        }
    }

    // ── Lights ───────────────────────────────────────────────────────────────

    _buildLights() {
        // Main sun point light — warm, moderate (real sun at distance is not a stadium light)
        const main   = new THREE.PointLight(0xffcc88, 2.5, 3000, 1.0);
        main.name    = 'SunPointLight_Main';
        this.sunMesh.add(main);

        // Secondary warm fill
        const fill   = new THREE.PointLight(0xff9944, 0.8, 1500, 1.5);
        fill.name    = 'SunPointLight_Fill';
        this.sunMesh.add(fill);

        // Rim light from opposite side (planet back-scattering)
        const rim    = new THREE.PointLight(0x4488ff, 0.2, 800, 2.0);
        rim.position.set(-80, 0, 0);
        rim.name     = 'SunPointLight_Rim';
        this.sunMesh.add(rim);

        // Hemisphere — deep space is nearly black, very faint ambient
        const hemi   = new THREE.HemisphereLight(0x112244, 0x221100, 0.08);
        hemi.name    = 'SpaceHemisphereLight';
        this.scene.add(hemi);
    }

    // ── Per-frame update ─────────────────────────────────────────────────────

    update(delta) {
        this._time += delta;
        const t = this._time;

        // Photosphere
        if (this._photosphere?.material?.uniforms)
            this._photosphere.material.uniforms.time.value = t;

        // Inner / outer corona
        if (this._innerCorona?.material?.uniforms)
            this._innerCorona.material.uniforms.time.value = t;
        if (this._outerCorona?.material?.uniforms)
            this._outerCorona.material.uniforms.time.value = t;
        if (this._coronaVolumetric?.material?.uniforms)
            this._coronaVolumetric.material.uniforms.time.value = t;

        // Energy rings — scale pulsation
        for (const { mesh, mat, cfg } of this._rings) {
            if (mat?.uniforms) mat.uniforms.time.value = t;
            const s = 1.0 + 0.05 * Math.sin(t * cfg.speed + cfg.phase);
            mesh.scale.set(s, s, 1);
        }

        // Prominences
        for (const { mat } of this._prominences) {
            if (mat?.uniforms) mat.uniforms.time.value = t;
        }

        // Flares — vary opacity
        for (const { mat, cfg } of this._flares) {
            if (mat?.uniforms) mat.uniforms.time.value = t;
        }

        // Lens flares — subtle pulse
        for (let i = 0; i < this._lensFlares.length; i++) {
            const { mat, cfg } = this._lensFlares[i];
            mat.opacity = cfg.opacity * (0.7 + 0.3 * Math.sin(t * 0.7 + i * 1.2));
        }
    }

    dispose() {
        [this._innerCorona, this._outerCorona, this._photosphere, this._coronaVolumetric].forEach(m => {
            m?.geometry?.dispose();
            m?.material?.dispose();
        });
        for (const { mesh } of this._rings) {
            mesh.geometry?.dispose(); mesh.material?.dispose();
        }
        for (const { line } of this._prominences) {
            line.geometry?.dispose(); line.material?.dispose();
        }
        for (const { mesh } of this._flares) {
            mesh.geometry?.dispose(); mesh.material?.dispose();
        }
        for (const { sprite } of this._lensFlares) {
            sprite.material?.map?.dispose();
            sprite.material?.dispose();
        }
    }
}
