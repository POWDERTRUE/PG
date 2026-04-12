import * as THREE from 'three';

/**
 * SupraconsciousnessMass — La Masa de Supraconciencia
 *
 * El origen absoluto del universo. Inmóvil. Eterno.
 * ÚNICA masa central de la que nace todo el cosmos.
 * Todo sistema, estrella y cuerpo celeste orbita SÓLO alrededor de ella.
 *
 * Posición: (0, 0, 0) — permanente, inamovible.
 *
 * Arquitectura física:
 *   - GRAVITATIONAL_MASS: masa gravitacional en unidades del motor
 *     equivalente a un agujero negro supermasivo (tipo Sagitario A*).
 *     Toda llamada a registerOrbit que tenga que orbitar el centro
 *     debe leer este valor en lugar de derivar una masa virtual local.
 */
export class SupraconsciousnessMass {
    /**
     * Masa gravitacional de la Supraconciencia en unidades del motor.
     * G del motor = 0.1  →  para que un nodo a r=800u tenga T≈orbital estable
     * usamos M tal que v² = G·M/r  →  M = v²·r/G.
     * Con speed=0.004 y r=800: v=3.2, M = 3.2²·800/0.1 = 81 920.
     * Redondeamos a 1 000 000 para simular un agujero negro supermasivo real.
     */
    static GRAVITATIONAL_MASS = 1_000_000;
    constructor(scene) {
        this.scene  = scene;
        this._time  = 0;
        this._group = null;
        this._core  = null;
        this._rings = [];
        this._field = null;

        this._build();
        console.log('[SupraconsciousnessMass] ✦ Singularidad primordial anclada en el origen del universo.');
    }

    _build() {
        this._group = new THREE.Group();
        this._group.name = 'SupraconsciousnessMass';
        this._group.position.set(0, 0, 0); // Origen absoluto — nunca se mueve

        // ── 1. Singularidad interior — esfera ultra-densa casi negra ──────────
        const coreMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
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
                uniform float uTime;
                varying vec3 vNormal;
                varying vec3 vWorldPos;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1); p *= 17.0;
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
                    // Fresnel para el aura en los bordes
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.5);

                    // Ruido de plasma consciente — patrones que mutan lentamente
                    float n1 = noise(vWorldPos * 0.08 + uTime * 0.04);
                    float n2 = noise(vWorldPos * 0.20 - uTime * 0.02) * 0.5;
                    float n  = (n1 + n2) / 1.5;

                    // Color: violeta-blanco profundo → casi negro en el centro
                    vec3 edgeColor  = vec3(0.55, 0.25, 1.0);   // violeta
                    vec3 coreColor  = vec3(0.02, 0.01, 0.05);   // casi vacío
                    vec3 col = mix(coreColor, edgeColor, n * fresnel * 1.4);

                    // Pulso muy lento — como la respiración del universo
                    float pulse = 0.85 + 0.15 * sin(uTime * 0.18);
                    col *= pulse;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        this._core = new THREE.Mesh(new THREE.SphereGeometry(28, 64, 64), coreMat);
        this._core.name = 'SingulaCore';
        this._group.add(this._core);

        // ── 2. Halo de evento — accretion disk de energía pura ───────────────
        const diskMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: /* glsl */`
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    float angle  = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float radius = length(vUv - 0.5) * 2.0;
                    float ring   = smoothstep(0.38, 0.42, radius) * smoothstep(0.62, 0.58, radius);
                    float sweep  = 0.5 + 0.5 * sin(angle * 3.0 + uTime * 0.5);
                    vec3 col     = mix(vec3(0.3, 0.0, 0.8), vec3(1.0, 0.6, 1.0), sweep);
                    gl_FragColor = vec4(col, ring * sweep * 0.6);
                }
            `,
        });

        const disk = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1), diskMat);
        disk.rotation.x = Math.PI * 0.5;
        disk.name = 'AccretionDisk';
        this._group.add(disk);
        this._rings.push({ mesh: disk, mat: diskMat });

        // ── 3. Anillos de gravedad — 3 toros concéntricos inclinados ─────────
        const ringConfigs = [
            { r: 55,  tube: 0.6,  color: 0x8822ff, speed: 0.12, tiltX: 0.3,  tiltZ: 0.0  },
            { r: 90,  tube: 0.4,  color: 0x4400cc, speed: 0.08, tiltX: -0.5, tiltZ: 0.2  },
            { r: 130, tube: 0.25, color: 0x220088, speed: 0.05, tiltX: 0.1,  tiltZ: -0.4 },
        ];

        for (const cfg of ringConfigs) {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uTime:  { value: 0 },
                    uColor: { value: new THREE.Color(cfg.color) },
                    uSpeed: { value: cfg.speed },
                },
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                vertexShader: /* glsl */`
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
                `,
                fragmentShader: /* glsl */`
                    uniform float uTime; uniform vec3 uColor; uniform float uSpeed;
                    varying vec2 vUv;
                    void main() {
                        float fade  = sin(vUv.x * 3.14159);
                        float pulse = 0.4 + 0.6 * sin(uTime * uSpeed * 6.28);
                        gl_FragColor = vec4(uColor, fade * pulse * 0.5);
                    }
                `,
            });

            const mesh = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, cfg.tube, 16, 128), mat);
            mesh.rotation.x = Math.PI * 0.5 + cfg.tiltX;
            mesh.rotation.z = cfg.tiltZ;
            mesh.name = `GravitationalRing_${cfg.r}`;
            this._group.add(mesh);
            this._rings.push({ mesh, mat, cfg });
        }

        // ── 4. Campo de partículas — energía consciente irradiando ───────────
        const PARTICLES = 2400;
        const pPositions = new Float32Array(PARTICLES * 3);
        const pColors    = new Float32Array(PARTICLES * 3);
        for (let i = 0; i < PARTICLES; i++) {
            const r     = 60 + Math.pow(Math.random(), 2.0) * 220;
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            pPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            pPositions[i * 3 + 1] = r * Math.cos(phi) * 0.25; // disco aplanado
            pPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            // Violeta a blanco
            const t = Math.random();
            pColors[i * 3]     = 0.4 + t * 0.6;
            pColors[i * 3 + 1] = 0.1 + t * 0.3;
            pColors[i * 3 + 2] = 0.8 + t * 0.2;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
        pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));
        this._field = new THREE.Points(pGeo, new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.55,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }));
        this._field.name = 'ConsciousnessField';
        this._field.renderOrder = -5;
        this._group.add(this._field);

        // ── 5. Hitbox invisible — navegación ─────────────────────────────────
        const hitbox = new THREE.Mesh(
            new THREE.SphereGeometry(300, 8, 8),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hitbox.name = 'Hitbox_SupraconsciousnessMass';
        hitbox.userData = {
            isApp: true, isNode: true, isMass: true,
            nodeType: 'supraconsciousness',
            appId: 'supraconsciousness',
            appName: 'Masa de Supraconciencia',
            label: 'Masa de Supraconciencia — Origen del Universo',
        };
        this._group.add(hitbox);

        this.scene.add(this._group);

        // Luz puntual sagrada — ilumina el universo desde el centro
        const sacredLight = new THREE.PointLight(0xbb88ff, 3.5, 8000, 1.6);
        sacredLight.name = 'SupraconsciousnessLight';
        this._group.add(sacredLight);
    }

    /** Llamado cada frame por el scheduler */
    update(delta) {
        this._time += delta;
        const t = this._time;

        // Animar shaders
        if (this._core?.material?.uniforms)
            this._core.material.uniforms.uTime.value = t;

        for (const { mat, mesh, cfg } of this._rings) {
            if (mat?.uniforms?.uTime)
                mat.uniforms.uTime.value = t;
            // Rotación muy lenta de los anillos — gravedad silenciosa
            if (cfg) mesh.rotation.y = t * cfg.speed;
        }

        // El campo de partículas rota lentísimo — como la rotación cosmica
        if (this._field)
            this._field.rotation.y = t * 0.006;
    }

    get group()              { return this._group; }
    get gravitationalMass()  { return SupraconsciousnessMass.GRAVITATIONAL_MASS; }
    get position()           { return this._group.position; } // siempre (0,0,0)

    dispose() {
        if (!this._group) return;
        const geometries = new Set();
        const materials = new Set();
        this._group.traverse((object) => {
            if (object.geometry) geometries.add(object.geometry);
            if (Array.isArray(object.material)) {
                object.material.forEach((material) => material && materials.add(material));
            } else if (object.material) {
                materials.add(object.material);
            }
        });
        this._group.parent?.remove(this._group);
        geometries.forEach((geometry) => geometry.dispose?.());
        materials.forEach((material) => material.dispose?.());
        this._rings = [];
        this._core = null;
        this._field = null;
        this._group = null;
    }
}
