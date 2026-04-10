import * as THREE from 'three';

/**
 * OrbitalRingSystem.js — OMEGA V30
 * Renders faint circular orbital paths for every planet.
 * One pre-computed unit-circle geometry — scaled per orbit for zero extra allocation.
 */
export class OrbitalRingSystem {
    constructor(parent, galaxySpec) {
        this.parent = parent;
        this.spec   = galaxySpec;
        this.group  = new THREE.Group();
        this.group.name = 'OrbitalRings';

        this._init();
    }

    _init() {
        const unitGeo  = this._buildUnitCircle(96);
        const planets  = this.spec.solarSystem.planets;

        for (const planet of planets) {
            const mat = new THREE.LineBasicMaterial({
                color:       this._colorForClass(planet.class),
                transparent: true,
                opacity:     0.20,
                depthWrite:  false,
            });

            const line = new THREE.Line(unitGeo, mat);
            line.scale.set(planet.orbitRadius, 1, planet.orbitRadius);
            line.rotation.x = Math.PI / 2; // XZ plane
            line.name = `OrbitRing_${planet.name}`;
            this.group.add(line);
        }

        this.parent.add(this.group);
        console.log(`[OrbitalRingSystem] ${planets.length} orbital rings created.`);
    }

    _buildUnitCircle(segments) {
        const pts = new Float32Array((segments + 1) * 3);
        for (let i = 0; i <= segments; i++) {
            const theta  = (i / segments) * Math.PI * 2;
            pts[i * 3]   = Math.cos(theta);
            pts[i * 3 + 1] = 0;
            pts[i * 3 + 2] = Math.sin(theta);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        return geo;
    }

    _colorForClass(cls) {
        const map = {
            volcanic:  0xff5533,
            desert:    0xcc8844,
            ocean:     0x44aaff,
            ice:       0xaaddff,
            gas_giant: 0xffcc44,
            jungle:    0x44cc88,
        };
        return map[cls] ?? 0x556677;
    }

    dispose() {
        this.group.traverse(obj => {
            if (obj.isMesh || obj.isLine) {
                obj.geometry?.dispose();
                obj.material?.dispose();
            }
        });
        this.parent.remove(this.group);
    }
}
