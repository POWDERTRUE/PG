import * as THREE from 'three';

/**
 * PlanetSpriteRenderer.js - L2
 * Renders a planet as a high-quality billboard sprite with glow.
 */
export class PlanetSpriteRenderer {
    create(color = 0x00f2ff) {
        const texture = new THREE.TextureLoader().load('/assets/fx/planet_sprite.png');
        const mat = new THREE.SpriteMaterial({
            map: texture,
            color: color,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(100, 100, 1);
        return sprite;
    }
}


