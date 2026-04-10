// frontend/src/engine/rendering/PlanetShaderSystem.js
import { Registry } from '../core/ServiceRegistry.js';
import * as THREE from 'three';

export class PlanetShaderSystem {
    constructor() {
        this.baseUniforms = {
            uCameraPos: { value: new THREE.Vector3() },
            // Simulamos sol constante por ahora
            uSunPosition: { value: new THREE.Vector3(1000, 200, 1000).normalize() },
            uExposure: { value: 0.9 }
        };

        this.atmosphereProfiles = {
            TERRAN: {
                rayleigh: new THREE.Vector3(0.13, 0.35, 0.85),
                mie: 0.005,
                mieAsymmetry: 0.76,
                atmosphereDensity: 0.72
            },
            MARTIAN: {
                rayleigh: new THREE.Vector3(0.65, 0.25, 0.10),
                mie: 0.015,
                mieAsymmetry: 0.85,
                atmosphereDensity: 0.48
            },
            JOVIAN: {
                rayleigh: new THREE.Vector3(0.05, 0.60, 0.85),
                mie: 0.002,
                mieAsymmetry: 0.90,
                atmosphereDensity: 3.5
            }
        };
        
        // Caché de shaders precompilados
        this.atmosphereMaterialBase = null;
    }

    init() {
        Registry.get('scheduler').register(this, 'render');
        this._compileShaders();

        console.log("🌌 [PlanetShaderSystem] Atmospheric Core Online.");
    }

    update() {
        // Zero-GC Update: Solo movemos los vectores por referencia en el FrameScheduler
        const camera = Registry.get('camera');
        if (camera) {
            this.baseUniforms.uCameraPos.value.copy(camera.position);
        }
        
        // El sol se actualizaría aquí consultando el CelestialRegistry en el futuro
    }

    _compileShaders() {
        // Definimos el Shader Base de Dispersión
        const vertexShader = `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `;

        const fragmentShader = `
            uniform vec3 uSunPosition;
            uniform vec3 uCameraPos;
            uniform float uPlanetRadius;
            uniform float uAtmoRadius;
            uniform vec3 uRayleigh;
            uniform float uMie;
            uniform float uRayleighScale;
            uniform float uMieScale;
            uniform float uMieAsymmetry;
            uniform float uAtmosphereDensity;
            uniform float uExposure;

            varying vec3 vWorldPosition;
            varying vec3 vNormal;

            #define STEPS 8
            #define PI 3.14159265359

            vec2 raySphereIntersect(vec3 r0, vec3 rd, float sr) {
                float a = dot(rd, rd);
                float b = 2.0 * dot(rd, r0);
                float c = dot(r0, r0) - (sr * sr);
                float d = (b*b) - 4.0*a*c;
                if (d < 0.0) return vec2(1e5, -1e5);
                return vec2((-b - sqrt(d))/(2.0*a), (-b + sqrt(d))/(2.0*a));
            }

            void main() {
                vec3 rayDir = normalize(vWorldPosition - uCameraPos);
                vec2 atmoHit  = raySphereIntersect(uCameraPos, rayDir, uAtmoRadius);
                vec2 planetHit = raySphereIntersect(uCameraPos, rayDir, uPlanetRadius);

                float tmin = max(0.0, atmoHit.x);
                // FIX CRIT: tmax era min(atmoHit.y, atmoHit.y) — siempre igual, sin límite real
                float tmax = atmoHit.y;
                if (planetHit.x >= 0.0 && planetHit.x < 1e5) {
                    tmax = min(tmax, planetHit.x);
                }

                if(tmin >= tmax) discard;

                float stepSize = (tmax - tmin) / float(STEPS);
                vec3 rayPos = uCameraPos + rayDir * (tmin + stepSize * 0.5);

                float rayleighDepth = 0.0;
                float mieDepth = 0.0;
                vec3 totalRayleigh = vec3(0.0);
                vec3 totalMie = vec3(0.0);

                float cosTheta = dot(rayDir, uSunPosition);
                float phaseR = 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
                float g2 = uMieAsymmetry * uMieAsymmetry;
                float phaseM = 1.0 / (4.0 * PI) * ((1.0 - g2) / pow(1.0 + g2 - 2.0 * uMieAsymmetry * cosTheta, 1.5));

                for(int i=0; i<STEPS; i++) {
                    float height = length(rayPos) - uPlanetRadius;
                    if (height < 0.0) break; // no integrar dentro del sólido
                    float hr = exp(-height / uRayleighScale) * stepSize;
                    float hm = exp(-height / uMieScale) * stepSize;
                    
                    rayleighDepth += hr;
                    mieDepth += hm;

                    vec2 sunAtmoHit = raySphereIntersect(rayPos, uSunPosition, uAtmoRadius);
                    float sunStepSize = max(sunAtmoHit.y, 0.0) / 8.0;
                    vec3 sunPos = rayPos;
                    
                    float lightRayleighDepth = 0.0;
                    float lightMieDepth = 0.0;

                    for(int j=0; j<4; j++) {
                        float sHeight = length(sunPos) - uPlanetRadius;
                        if(sHeight < 0.0) break; 
                        lightRayleighDepth += exp(-sHeight / uRayleighScale) * sunStepSize;
                        lightMieDepth += exp(-sHeight / uMieScale) * sunStepSize;
                        sunPos += uSunPosition * sunStepSize;
                    }

                    // Multiplicador de densidad global afecta todo el esparcimiento
                    vec3 tau = uAtmosphereDensity * (uRayleigh * (rayleighDepth + lightRayleighDepth) + 
                               vec3(uMie) * 1.1 * (mieDepth + lightMieDepth));
                    vec3 attenuation = exp(-tau);

                    totalRayleigh += hr * attenuation;
                    totalMie += hm * attenuation;
                    rayPos += rayDir * stepSize;
                }

                vec3 color = uAtmosphereDensity * ((phaseR * uRayleigh * totalRayleigh) + (phaseM * uMie * totalMie));
                color *= 0.36;

                // ToneMapping Exponencial HDR (Evitar Supernovas)
                color = 1.0 - exp(-color * uExposure);

                // Alpha = densidad óptica visible:
                // limbo tangente (rayo largo)  → alpha  alto → corona azul opaca
                // vista cenital (rayo corto)   → alpha bajo → terreno visible
                // espacio profundo (fuera SOI) → alpha = 0  → Bloom intacto
                float intensity = max(max(color.r, color.g), color.b);
                float horizonFade = clamp(1.0 - abs(dot(rayDir, vNormal)), 0.0, 1.0);
                float alpha = clamp(intensity * horizonFade, 0.0, 1.0);

                // Salida SIEMPRE en [0,1] — imposible inyectar HDR al G-Buffer
                gl_FragColor = vec4(color, alpha);
            }
        `;

        this.atmosphereMaterialBase = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.FrontSide, // Default: cara frontal = Z-Buffer descarta interior
            transparent: true,
            depthWrite: false,     // No contaminar Z-buffer de los QuadTrees
            // NormalBlending + pre-multiplied inverse trick:
            // Comportamiento físico correcto sin corromper el canal Alpha del G-Buffer
            blending: THREE.NormalBlending,
        });
    }

    /**
     * Genera un ecosistema de materiales para un planeta específico.
     * El ShaderMaterial de atmósfera opera en BackSide (Raymarching).
     * El MeshStandardMaterial de superficie usa onBeforeCompile para inyectar
     * Triplanar Mapping + Biomas sin perder el pipeline PBR de Three.js (Zero-GC).
     */
    createPlanetaryMaterials(radius, type = 'TERRAN') {
        const atmoMat = this.atmosphereMaterialBase.clone();
        
        const profile = this.atmosphereProfiles[type] ?? this.atmosphereProfiles.TERRAN;
        const rBeta = profile.rayleigh.clone();
        const mBeta = profile.mie;
        const gPhase = profile.mieAsymmetry;
        const pDensity = profile.atmosphereDensity;

        atmoMat.uniforms = {
            ...this.baseUniforms,
            uPlanetRadius: { value: radius },
            uAtmoRadius:   { value: radius * 1.05 },
            uRayleigh:     { value: rBeta },
            uMie:          { value: mBeta },
            uRayleighScale:{ value: radius * 0.08 },
            uMieScale:     { value: radius * 0.012 },
            uMieAsymmetry: { value: gPhase },
            uAtmosphereDensity: { value: pDensity }
        };

        // ── NÚCLEO GEOLÓGICO: Triplanar + Biomas ──────────────────────────────
        // Usamos onBeforeCompile para penetrar el pipeline PBR de Three.js sin
        // perder iluminación, sombras ni ambient occlusion (Zero-GC, cero texturas).
        const surfaceMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.85,
            metalness: 0.05
        });

        surfaceMat.onBeforeCompile = (shader) => {
            // 1. Uniforms geológicos
            shader.uniforms.uPlanetCenter = { value: new THREE.Vector3(0, 0, 0) };
            shader.uniforms.uPlanetRadius = { value: radius };

            // Paleta bioma Clase-M (Tierra)
            shader.uniforms.uColorDeep  = { value: new THREE.Color(0x1a4559) };
            shader.uniforms.uColorSand  = { value: new THREE.Color(0xddc494) };
            shader.uniforms.uColorGrass = { value: new THREE.Color(0x3a5e2f) };
            shader.uniforms.uColorRock  = { value: new THREE.Color(0x4a4a4a) };
            shader.uniforms.uColorSnow  = { value: new THREE.Color(0xffffff) };

            if (type === 'JOVIAN') {
                shader.uniforms.uColorDeep.value.set(0x2a1060);
                shader.uniforms.uColorSand.value.set(0x8040a0);
                shader.uniforms.uColorGrass.value.set(0x204080);
                shader.uniforms.uColorRock.value.set(0x303050);
                shader.uniforms.uColorSnow.value.set(0xaaddff);
            } else if (type === 'MARTIAN') {
                shader.uniforms.uColorDeep.value.set(0x4a1a00);
                shader.uniforms.uColorSand.value.set(0xc8602a);
                shader.uniforms.uColorGrass.value.set(0x8a4020);
                shader.uniforms.uColorRock.value.set(0x5a3018);
                shader.uniforms.uColorSnow.value.set(0xffe0c0);
            }

            // 2. Vertex: exportar WorldPos y WorldNormal al fragment
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldPos;
                varying vec3 vNormalWorld;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vWorldPos    = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vNormalWorld = normalize(mat3(modelMatrix) * objectNormal);`
            );

            // 3. Fragment: Declaraciones de uniforms y varyings
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform vec3  uPlanetCenter;
                uniform float uPlanetRadius;
                uniform vec3  uColorDeep;
                uniform vec3  uColorSand;
                uniform vec3  uColorGrass;
                uniform vec3  uColorRock;
                uniform vec3  uColorSnow;
                varying vec3  vWorldPos;
                varying vec3  vNormalWorld;`
            );

            // 4. Fragment: Triplanar + Bioma, inyectado en el slot color_fragment
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>

                // ── A. Cálculos Topológicos ──────────────────────────────────
                float elevation  = length(vWorldPos - uPlanetCenter) - uPlanetRadius;
                vec3  localUp    = normalize(vWorldPos - uPlanetCenter);
                float slope      = clamp(dot(vNormalWorld, localUp), 0.0, 1.0);

                // ── B. Pesos Triplanares ──────────────────────────────────────
                // (Para texturas futuras: sample x3 y combinar con estos pesos)
                vec3 blendW = abs(vNormalWorld);
                blendW = max(blendW - 0.2, 0.0);         // Afilado de transición
                blendW /= dot(blendW, vec3(1.0));         // Normalización a suma=1

                // ── C. Bioma por Altitud (Smoothstep escalonado) ─────────────
                vec3 biomeColor;

                // Piso: Arena/Valle
                float sandThresh  = uPlanetRadius * 0.005;
                float grassThresh = uPlanetRadius * 0.015;
                float snowThresh  = uPlanetRadius * 0.040;

                biomeColor = uColorSand;
                biomeColor = mix(biomeColor, uColorGrass,
                    smoothstep(sandThresh,  grassThresh, elevation));
                biomeColor = mix(biomeColor, uColorSnow,
                    smoothstep(snowThresh * 0.8, snowThresh * 1.2, elevation));

                // ── D. Invasión de Roca por Pendiente ────────────────────────
                // slope ≈ 0 → acantilado vertical → roca pura
                // slope ≈ 1 → terreno plano → bioma normal
                float rockBlend = 1.0 - smoothstep(0.45, 0.70, slope);
                vec3  finalColor = mix(biomeColor, uColorRock, rockBlend);

                // ── E. Sobrescribir color difuso PBR ─────────────────────────
                diffuseColor = vec4(finalColor, opacity);
                `
            );
        };

        // Marcar como 'customProgramCacheKey' para que Three no comparta la caché
        // con otros MeshStandardMaterials (crítico cuando tenemos múltiples planetas)
        surfaceMat.customProgramCacheKey = () => `planet_geo_${type}_${radius}`;

        return { atmosphere: atmoMat, surface: surfaceMat };
    }
}
