import * as THREE from 'three';

/**
 * PlanetPointRenderer.js - L1
 * Renders a planet as a tiny, persistent GL point for extreme distances.
 */
export class PlanetPointRenderer {
    create(color = 0xffffff) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        const mat = new THREE.PointsMaterial({
            color: color,
            size: 2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.8
        });
        return new THREE.Points(geo, mat);
    }
}


