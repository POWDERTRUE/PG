/**
 * SpatialWindowPhysicsEngine.js
 * OMEGA V28 Master Edition — Workspace & UI
 */
import gsap from 'gsap';

export class SpatialWindowPhysicsEngine {
    static phase = 'workspace';
    constructor(services) {
        this.services = services;
        this.bodies = new Map();
    }

    init() {
        console.log('[WindowPhysics] OMEGA Inertial Engine Online.');
    }

    register(id, element, mass = 1.0) {
        this.bodies.set(id, { 
            element, 
            mass, 
            dragging: false,
            velocity: { x: 0, y: 0 },
            lastPos: { x: 0, y: 0 },
            friction: 0.95
        });
    }

    unregister(id) {
        this.bodies.delete(id);
    }

    setDragging(id, state) {
        const body = this.bodies.get(id);
        if (body) body.dragging = state;
    }

    update(delta, time) {
        const physicsController = this.services?.get('PhysicsController');
        if (!physicsController) return;

        this.bodies.forEach((body, id) => {
            // Get current transform from GSAP/style
            const x = gsap.getProperty(body.element, "x");
            const y = gsap.getProperty(body.element, "y");

            if (body.dragging) {
                // Tracking velocity during drag (Guard against delta=0)
                const safeDelta = Math.max(0.001, delta);
                body.velocity.x = (x - body.lastPos.x) / safeDelta;
                body.velocity.y = (y - body.lastPos.y) / safeDelta;
                body.lastPos.x = x;
                body.lastPos.y = y;

                // --- Elastic Boundary Resistance ---
                const bounds = {
                    left: 0,
                    right: window.innerWidth - body.element.offsetWidth,
                    top: 0,
                    bottom: window.innerHeight - body.element.offsetHeight
                };

                let targetX = x;
                let targetY = y;

                if (x < bounds.left) targetX = physicsController.applyRubberBand(x - bounds.left, window.innerWidth) + bounds.left;
                if (x > bounds.right) targetX = physicsController.applyRubberBand(x - bounds.right, window.innerWidth) + bounds.right;
                if (y < bounds.top) targetY = physicsController.applyRubberBand(y - bounds.top, window.innerHeight) + bounds.top;
                if (y > bounds.bottom) targetY = physicsController.applyRubberBand(y - bounds.bottom, window.innerHeight) + bounds.bottom;

                if (targetX !== x || targetY !== y) {
                    gsap.set(body.element, { x: targetX, y: targetY });
                }

            } else {
                // Applying inertia and spring-back
                const bounds = {
                    left: 0,
                    right: window.innerWidth - body.element.offsetWidth,
                    top: 0,
                    bottom: window.innerHeight - body.element.offsetHeight
                };

                let forceX = 0;
                let forceY = 0;

                // 1. Calculate Spring-back if out of bounds
                if (x < bounds.left) forceX = physicsController.getSpringForce(x, bounds.left, body.velocity.x);
                else if (x > bounds.right) forceX = physicsController.getSpringForce(x, bounds.right, body.velocity.x);

                if (y < bounds.top) forceY = physicsController.getSpringForce(y, bounds.top, body.velocity.y);
                else if (y > bounds.bottom) forceY = physicsController.getSpringForce(y, bounds.bottom, body.velocity.y);

                if (forceX !== 0 || forceY !== 0) {
                    body.velocity.x += forceX * delta;
                    body.velocity.y += forceY * delta;
                }

                // 2. Apply velocities
                if (Math.abs(body.velocity.x) > 0.1 || Math.abs(body.velocity.y) > 0.1 || forceX !== 0 || forceY !== 0) {
                    const newX = x + body.velocity.x * delta;
                    const newY = y + body.velocity.y * delta;

                    // Soft friction decay
                    body.velocity.x *= body.friction;
                    body.velocity.y *= body.friction;

                    // BUG 10 FIX: Clamp velocity to prevent NaN explosions (OMEGA Hardening)
                    body.velocity.x = Math.max(-5000, Math.min(5000, body.velocity.x));
                    body.velocity.y = Math.max(-5000, Math.min(5000, body.velocity.y));

                    gsap.set(body.element, { x: newX, y: newY });
                }
            }
        });
    }
}
