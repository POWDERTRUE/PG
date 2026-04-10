import * as THREE from 'three';

/**
 * AsteroidBeltRenderer.js — OMEGA V30
 * Renders the asteroid belt using native Three.js InstancedMesh.
 * 2 000 asteroids → 1 draw call. Zero dependency on InstancedRenderSystem.
 */
export class AsteroidBeltRenderer {
    constructor(parent, galaxySpec) {
        this.parent      = parent;
        this.count       = galaxySpec.solarSystem.asteroidBelt.count;
        this.innerRadius = galaxySpec.solarSystem.asteroidBelt.innerRadius;
        this.outerRadius = galaxySpec.solarSystem.asteroidBelt.outerRadius;

        this.group    = new THREE.Group();
        this.group.name = 'AsteroidBelt';
        this.asteroids  = null;
        this._dummy     = new THREE.Object3D();

        this._init();
    }

    _init() {
        const geo = new THREE.IcosahedronGeometry(1, 0); // 12 verts per instance
        const mat = new THREE.MeshStandardMaterial({
            color:     0x6a6560,
            roughness: 0.92,
            metalness: 0.08,
        });

        this.asteroids = new THREE.InstancedMesh(geo, mat, this.count);
        this.asteroids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.asteroids.castShadow    = true;
        this.asteroids.receiveShadow = true;
        this.asteroids.name = 'AsteroidInstances';

        for (let i = 0; i < this.count; i++) {
            this._placeAsteroid(i);
        }

        this.asteroids.instanceMatrix.needsUpdate = true;
        this.group.add(this.asteroids);
        this.parent.add(this.group);

        console.log(`[AsteroidBeltRenderer] ${this.count} asteroids spawned via InstancedMesh.`);
    }

    _placeAsteroid(index) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = this.innerRadius + Math.random() * (this.outerRadius - this.innerRadius);
        const yBias  = (Math.random() - 0.5) * 16; // ±8 units vertical spread

        this._dummy.position.set(
            Math.cos(angle) * radius,
            yBias,
            Math.sin(angle) * radius
        );
        this._dummy.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        const s = 0.5 + Math.random() * 1.5;
        this._dummy.scale.set(s, s * (0.6 + Math.random() * 0.8), s);
        this._dummy.updateMatrix();
        this.asteroids.setMatrixAt(index, this._dummy.matrix);
    }

    /** Slow belt rotation — 0.008 rad/s */
    update(delta) {
        this.group.rotation.y += 0.008 * delta;
    }

    dispose() {
        this.asteroids?.geometry?.dispose();
        this.asteroids?.material?.dispose();
        this.parent.remove(this.group);
    }
}
