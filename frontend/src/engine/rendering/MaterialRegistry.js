/**
 * MaterialRegistry.js — Canonical Shader & Material Cache
 * =========================================================
 * Motor OMEGA V31 | Powder Galaxy
 *
 * LEY 15 — UNIVERSE_LAWS.md, REGLA 19:
 *   MaterialRegistry.get() es el ÚNICO punto de entrada para instanciar
 *   materiales compartidos. Llamar a `new GlassSiliconeMaterial()` directamente
 *   viola esta ley y crea compilaciones duplicadas de shader en VRAM.
 *
 * VRAM Impact:
 *   Sin registry: 6 planetas + 15 lunas + 50 named stars con GlassSilicone
 *                 = 71 compilaciones separadas de ShaderMaterial.
 *   Con registry: 1 compilación por combinación (tipo × color). Ahorro masivo.
 *
 * Uso:
 *   import { MaterialRegistry } from '../rendering/MaterialRegistry.js';
 *
 *   // Obtener (o crear si no existe) una instancia compartida:
 *   const mat = MaterialRegistry.get('glass-silicone');
 *   const mat = MaterialRegistry.get('glass-silicone', 0x00f2ff);
 *   const mat = MaterialRegistry.get('standard-emissive', { color: 0xff8844, intensity: 0.3 });
 *
 *   // Destruir un material al descargar un sector:
 *   MaterialRegistry.dispose('glass-silicone');
 *
 *   // Cleanup de emergencia (ao cerrar el engine):
 *   MaterialRegistry.disposeAll();
 *
 * @module MaterialRegistry
 * @version V31.0.0
 */

import * as THREE from 'three';
import { GlassSiliconeMaterial } from './GlassSiliconeMaterial.js';

// ══════════════════════════════════════════════════════════════════════════════
// INTERNAL CACHE
// Key: `${type}:${colorHex}` — una instancia por combinación única
// ══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, THREE.Material>} */
const _cache = new Map();

/** @type {Map<string, number>} — número de consumidores activos por key */
const _refCount = new Map();

/** @type {Map<string, THREE.Texture>} - shared textures reused by complex registry materials */
const _sharedTextureCache = new Map();

function _stableSerialize(value) {
    if (value === null) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(_stableSerialize).join(',')}]`;

    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${_stableSerialize(value[key])}`).join(',')}}`;
}

function _getRegistryKey(type, param) {
    const token = (typeof param === 'number')
        ? param.toString(16).padStart(6, '0')
        : (typeof param === 'undefined' ? 'default' : _stableSerialize(param));
    return `${type}:${token}`;
}

function _tagRegistryMaterial(material, type, param, key) {
    material.userData = {
        ...(material.userData ?? {}),
        materialRegistry: { type, param, key },
    };
    return material;
}

function _fract(value) {
    return value - Math.floor(value);
}

function _pseudoNoise2D(x, y) {
    return _fract(Math.sin((x * 127.1) + (y * 311.7)) * 43758.5453123);
}

function _createCityLightsMaskTexture() {
    const width = 256;
    const height = 128;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        const v = y / (height - 1);
        const latitudeBias = 1 - Math.min(1, Math.abs((v - 0.5) * 2.15));

        for (let x = 0; x < width; x++) {
            const u = x / (width - 1);
            const index = (y * width + x) * 4;

            const continental = (
                Math.sin(u * Math.PI * 4.0) * 0.34 +
                Math.sin((u * 17.0) + (v * 6.0)) * 0.18 +
                Math.sin((u * 29.0) - (v * 11.0)) * 0.12
            );
            const clusters = (
                _pseudoNoise2D(u * 43.0, v * 37.0) * 0.55 +
                _pseudoNoise2D(u * 91.0, v * 73.0) * 0.30 +
                _pseudoNoise2D(u * 177.0, v * 141.0) * 0.15
            );
            const urbanDensity = (clusters * 0.78 + continental * 0.22) * latitudeBias;
            const lit = urbanDensity > 0.47
                ? Math.min(255, Math.floor((urbanDensity - 0.47) * 900))
                : 0;

            data[index] = lit;
            data[index + 1] = lit;
            data[index + 2] = lit;
            data[index + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.name = 'MaterialRegistry::city-lights-mask';
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}

function _getSharedTexture(id) {
    if (_sharedTextureCache.has(id)) {
        return _sharedTextureCache.get(id);
    }

    let texture = null;
    switch (id) {
        case 'city-lights-mask':
        default:
            texture = _createCityLightsMaskTexture();
            break;
    }

    _sharedTextureCache.set(id, texture);
    return texture;
}

const CLOUD_VERTEX_SHADER = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */`
    uniform float time;
    uniform vec3 cloudColor;
    uniform float coverage;
    uniform float opacity;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
            mix(mix(hash(i),             hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
            mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
            f.z
        );
    }

    float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(p);
            p *= 2.1;
            amplitude *= 0.5;
        }

        return value;
    }

    void main() {
        vec3 samplePos = vWorldPos * 0.06 + vec3(time * 0.012, 0.0, time * 0.008);
        float cloudDensity = fbm(samplePos);
        cloudDensity = smoothstep(1.0 - coverage, 1.0, cloudDensity);

        vec3 sunDir = normalize(vec3(1.0, 0.5, 1.0));
        float lit = max(dot(vNormal, sunDir), 0.0);
        float shadow = 0.5 + 0.5 * lit;

        vec3 color = cloudColor * shadow;
        gl_FragColor = vec4(color, cloudDensity * opacity);
    }
`;

const RING_VERTEX_SHADER = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const RING_FRAGMENT_SHADER = /* glsl */`
    uniform vec3 color1;
    uniform vec3 color2;
    uniform vec3 color3;
    varying vec2 vUv;

    float hash(float p) {
        return fract(sin(p * 127.1) * 43758.5453);
    }

    void main() {
        float t = vUv.x;
        float bands = sin(t * 60.0 * 3.14159) * 0.5 + 0.5;
        float gap = step(0.42, t) * step(t, 0.48) * 0.8;
        float noise = hash(floor(t * 180.0)) * 0.3;

        vec3 color = mix(color2, color1, bands + noise);
        color = mix(color, color3, step(0.75, t) * 0.3);

        float alpha = (0.65 + bands * 0.20 + noise * 0.15) * (1.0 - gap);
        alpha *= smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.92, t);

        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
    }
`;

const CITY_LIGHTS_VERTEX_SHADER = /* glsl */`
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const CITY_LIGHTS_FRAGMENT_SHADER = /* glsl */`
    uniform vec3 uSunDirection;
    uniform vec3 uCityColor;
    uniform sampler2D uCityLightsTex;
    uniform float uTransitionWidth;
    uniform float uIntensity;

    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
        float sunDot = dot(normalize(vNormal), normalize(uSunDirection));
        float nightFactor = smoothstep(uTransitionWidth, -uTransitionWidth, sunDot);
        float cityMask = texture2D(uCityLightsTex, vUv).r;
        float glow = cityMask * nightFactor * uIntensity;
        vec3 color = mix(uCityColor * 0.72, uCityColor, cityMask);
        gl_FragColor = vec4(color, glow);
    }
`;


// ══════════════════════════════════════════════════════════════════════════════
// FACTORIES — una función de creación por tipo de material
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @type {Object.<string, function(...*): THREE.Material>}
 */
const FACTORIES = {
    /**
     * Gelatinous glass shader — custom vertex + fragment.
     * 3D Simplex Noise displacement, Fresnel outline, wobble animation.
     * @param {number} [color=0x00f2ff]
     */
    'glass-silicone': (color = 0x00f2ff) => {
        try {
            return new GlassSiliconeMaterial(color);
        } catch (err) {
            console.warn('[MaterialRegistry] ⚠️ GlassSilicone shader failed — using fallback.', err);
            return new THREE.MeshStandardMaterial({
                color,
                roughness:         0.1,
                metalness:         0.5,
                transparent:       true,
                opacity:           0.8,
                emissive:          new THREE.Color(color),
                emissiveIntensity: 0.3,
            });
        }
    },

    /**
     * Emissive MeshStandardMaterial — planetas, satélites, elementos del HUD 3D.
     * @param {{ color?: number, roughness?: number, metalness?: number, emissiveIntensity?: number }} opts
     */
    'standard-emissive': ({ color = 0xffffff, roughness = 0.35, metalness = 0.65, emissiveIntensity = 0.08 } = {}) => {
        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness,
            emissive:          new THREE.Color(color),
            emissiveIntensity,
        });
    },

    /**
     * Hitbox invisible — transparente, sin depthWrite, sin interacción visual.
     * Compartido por todos los hitboxes del sistema solar (no necesitan ser únicos).
     */
    'hitbox-invisible': () => {
        return new THREE.MeshBasicMaterial({
            transparent: true,
            opacity:     0,
            depthWrite:  false,
            side:        THREE.FrontSide,
        });
    },

    /**
     * MeshBasicMaterial plano — fondo de partículas, campos estelares.
     * @param {number} [color=0xffffff]
     */
    'basic-flat': (color = 0xffffff) => {
        return new THREE.MeshBasicMaterial({ color });
    },

    /**
     * Material de luna — tono específico por clase de planeta padre.
     * @param {{ color: number, roughness: number, metalness: number }} opts
     */
    'moon-surface': ({ color = 0xaaaaaa, roughness = 0.75, metalness = 0.05 } = {}) => {
        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness,
            emissive:          new THREE.Color(color),
            emissiveIntensity: 0.04,
        });
    },

    /**
     * Cloud shader — REGLA 19 compliant.
     * The dynamic cloud color is provided as a stable param object, so the
     * THREE.Color allocation happens once per cache key instead of per setup.
     *
     * @param {{ cloudColor?: number, coverage?: number, opacity?: number }} opts
     */
    'cloud-shader': ({ cloudColor = 0xffddaa, coverage = 0.25, opacity = 0.70 } = {}) => {
        return new THREE.ShaderMaterial({
            uniforms: {
                time:       { value: 0 },
                cloudColor: { value: new THREE.Color(cloudColor) },
                coverage:   { value: coverage },
                opacity:    { value: opacity },
            },
            vertexShader: CLOUD_VERTEX_SHADER,
            fragmentShader: CLOUD_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
        });
    },

    /**
     * Ring shader - REGLA 19 compliant.
     * Shared translucent ring gradients are cached in the registry instead of
     * compiling a dedicated ShaderMaterial per gas giant instance.
     *
     * @param {{ color1?: number, color2?: number, color3?: number }} opts
     */
    'ring-material': ({ color1 = 0xddcc99, color2 = 0x886644, color3 = 0xfff8ee } = {}) => {
        return new THREE.ShaderMaterial({
            uniforms: {
                color1: { value: new THREE.Color(color1) },
                color2: { value: new THREE.Color(color2) },
                color3: { value: new THREE.Color(color3) },
            },
            vertexShader: RING_VERTEX_SHADER,
            fragmentShader: RING_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
    },

    /**
     * City lights shader - REGLA 19 compliant.
     * Shared light masks stay in VRAM once, while each body can request its own
     * registry key and sun-facing fade parameters.
     *
     * @param {{ cityColor?: number, transitionWidth?: number, intensity?: number, textureId?: string }} opts
     */
    'city-lights-shader': ({
        cityColor = 0xffeeaa,
        transitionWidth = 0.22,
        intensity = 0.55,
        textureId = 'city-lights-mask',
    } = {}) => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uSunDirection: { value: new THREE.Vector3(1, 0.5, 1).normalize() },
                uCityColor: { value: new THREE.Color(cityColor) },
                uCityLightsTex: { value: _getSharedTexture(textureId) },
                uTransitionWidth: { value: transitionWidth },
                uIntensity: { value: intensity },
            },
            vertexShader: CITY_LIGHTS_VERTEX_SHADER,
            fragmentShader: CITY_LIGHTS_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
    },
};


// ══════════════════════════════════════════════════════════════════════════════
// MATERIALREGISTRY — Public Singleton API
// ══════════════════════════════════════════════════════════════════════════════

export const MaterialRegistry = Object.freeze({

    /**
     * Obtiene (o crea) un material del tipo especificado.
     * Las instancias se cachean por `${type}:${colorHex}`.
     *
     * @param {string}       type    - Clave de tipo ('glass-silicone', 'standard-emissive', etc.)
     * @param {number|object} [param] - Color (number) u opciones (object) para el factory
     * @param {object}       [opts]  - Opciones adicionales para el factory
     * @returns {THREE.Material}
     *
     * @example
     * MaterialRegistry.get('glass-silicone')            // default cyan
     * MaterialRegistry.get('glass-silicone', 0xff6600)  // orange glass
     * MaterialRegistry.get('moon-surface', { color: 0x443322, roughness: 0.95 })
     */
    get(type, param, opts) {
        const factory = FACTORIES[type];
        if (!factory) {
            console.error(`[MaterialRegistry] ❌ Tipo desconocido: "${type}". Tipos registrados: ${Object.keys(FACTORIES).join(', ')}`);
            return new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Magenta de error
        }

        const key = _getRegistryKey(type, param);

        if (!_cache.has(key)) {
            const material = (typeof param === 'undefined')
                ? factory()
                : factory(param, opts);

            _tagRegistryMaterial(material, type, param, key);
            material.name = `MaterialRegistry::${key}`;
            _cache.set(key, material);
            _refCount.set(key, 0);

            console.log(
                `%c[MaterialRegistry] ✅ Compiled: ${key}`,
                'color:#88ffcc;font-size:11px'
            );
        }

        _refCount.set(key, (_refCount.get(key) ?? 0) + 1);
        return _cache.get(key);
    },

    /**
     * Disminuye el contador de referencia y, si llega a 0, destruye el material.
     * Usar al descargar sectores (LEY 6) o disponer objetos que usaron este material.
     *
     * @param {string} type
     * @param {number|object} [param]
     */
    release(type, param) {
        const key = _getRegistryKey(type, param);

        if (!_cache.has(key)) return;

        const count = (_refCount.get(key) ?? 1) - 1;
        _refCount.set(key, count);

        if (count <= 0) {
            this.dispose(type, param);
        }
    },

    /**
     * Destruye inmediatamente un material del registry y lo elimina de la caché.
     * Úsalo con precaución — cualquier mesh que lo esté usando quedará sin material.
     *
     * @param {string} type
     * @param {number|object} [param]
     */
    dispose(type, param) {
        const key = _getRegistryKey(type, param);

        const mat = _cache.get(key);
        if (mat) {
            mat.dispose();
            _cache.delete(key);
            _refCount.delete(key);
            console.log(`[MaterialRegistry] 🗑️ Disposed: ${key}`);
        }
    },

    /**
     * Destruye TODOS los materiales del registry. Solo llamar al cerrar el engine.
     */
    disposeAll() {
        for (const [key, mat] of _cache) {
            mat.dispose();
        }
        _cache.clear();
        _refCount.clear();

        for (const texture of _sharedTextureCache.values()) {
            texture.dispose();
        }
        _sharedTextureCache.clear();
        console.log('[MaterialRegistry] 🗑️ All materials disposed.');
    },

    /**
     * Diagnóstico — número de materiales activos en VRAM.
     * @returns {number}
     */
    getCacheSize() {
        return _cache.size;
    },

    /**
     * Diagnóstico — listado de todos los materiales en caché.
     * @returns {string[]}
     */
    getCacheKeys() {
        return [..._cache.keys()];
    },

    /**
     * Diagnostic helper — callers can detect registry-owned materials and avoid
     * direct dispose() when a shared cache entry should be released instead.
     *
     * @param {THREE.Material | null | undefined} material
     * @returns {boolean}
     */
    isRegistryMaterial(material) {
        return !!material?.userData?.materialRegistry;
    },

    /**
     * Returns the registry metadata attached to a cached material, if any.
     *
     * @param {THREE.Material | null | undefined} material
     * @returns {{ type: string, param: number|object|undefined, key: string } | null}
     */
    getMaterialMeta(material) {
        return material?.userData?.materialRegistry ?? null;
    },

    /**
     * Registra un factory personalizado para un tipo nuevo.
     * Permite extensión sin modificar este archivo (Principio Abierto/Cerrado).
     *
     * @param {string}   type     - Clave del tipo nuevo ('my-custom-mat')
     * @param {Function} factory  - Función que retorna un THREE.Material
     */
    registerFactory(type, factory) {
        if (FACTORIES[type]) {
            console.warn(`[MaterialRegistry] ⚠️ Factory "${type}" ya existe — se sobreescribirá.`);
        }
        FACTORIES[type] = factory;
        console.log(`[MaterialRegistry] 📦 Factory registrado: "${type}"`);
    },
});
