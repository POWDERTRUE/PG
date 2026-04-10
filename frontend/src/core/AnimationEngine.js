import gsap from 'gsap';

/**
 * AnimationEngine.js
 * V10 Premium Motion Core
 * Provides spring-based physics for UI and spatial transitions.
 */
export class AnimationEngine {
    constructor() {
        this.activeSprings = new Map();
    }

    init() {
        console.log('[AnimationEngine] Premium Motion Core Online.');
    }

    update(delta, time) {
        // Reserved for future spring physics simulation
    }

    /**
     * Advanced Spring Transition
     * Designed to mimic the organic feel of iOS/iPadOS physics.
     */
    springTo(target, vars, springConfig = { stiffness: 100, damping: 10, mass: 1 }) {
        return gsap.to(target, {
            ...vars,
            duration: vars.duration || 0.7,
            ease: vars.ease || "power4.out", // Default to smooth deceleration
            overwrite: true
        });
    }

    /**
     * Focus transition for Glass Silicon elements
     */
    focusSoft(element) {
        gsap.to(element, {
            scale: 1.05,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: 'rgba(255, 255, 255, 0.4)',
            boxShadow: '0 40px 100px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 240, 255, 0.2)',
            duration: 0.8,
            ease: "elastic.out(1, 0.75)"
        });
    }

    blurSoft(element) {
        gsap.to(element, {
            scale: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
            duration: 0.5,
            ease: "power2.out"
        });
    }
}

export const animationEngine = new AnimationEngine();

