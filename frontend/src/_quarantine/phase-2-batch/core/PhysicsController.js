/**
 * PhysicsController.js
 * Implements Apple-style spring dynamics and inertia.
 */
import { PhysicsConfig } from '../engine/config/PhysicsConfig.js';

export class PhysicsController {
    constructor() {
        if (PhysicsController.instance) return PhysicsController.instance;
        this.defaultSpring = PhysicsConfig.spring;
        this.edgeResistance = PhysicsConfig.ui.edgeResistance;
        PhysicsController.instance = this;
    }

    /**
     * Calculates the next value based on spring physics
     * @param {number} current Current position
     * @param {number} target Target position
     * @param {number} velocity Current velocity
     * @param {object} config Spring configuration
     */
    getSpringForce(current, target, velocity, config = this.defaultSpring) {
        const delta = target - current;
        const springForce = config.stiffness * delta;
        const dampingForce = config.damping * velocity;
        const acceleration = (springForce - dampingForce) / config.mass;
        
        return acceleration;
    }

    /**
     * Applies Apple-style rubber-banding when dragging past bounds
     * @param {number} offset Distance past boundary
     * @param {number} dimension Screen dimension (width/height)
     */
    applyRubberBand(offset, dimension) {
        return (offset * dimension) / (offset + dimension);
    }
}

