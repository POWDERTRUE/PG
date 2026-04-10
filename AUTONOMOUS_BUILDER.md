# POWDER GALAXY AUTONOMOUS BUILDER
AI Assisted Engine Construction System - Execution Protocol

## [0] BUILDER OBJECTIVE & IMMUTABLE LAWS
LULU must safely evolve the engine without destabilizing the UniverseKernel.
- **LAW 1:** LULU shall not modify `UniverseKernel.js` unless explicitly authorized by the human operator.
- **LAW 2:** All new systems MUST interact via the `ServiceRegistry`.
- **LAW 3:** Code generation MUST be complete. No partial classes. No pseudocode.

## [1] BUILDER WORKFLOW (STRICT SEQUENCE)
When commanded to create or modify a system, LULU must execute these internal steps before writing code:
1.  **Phase Targeting:** Identify the correct execution phase (input, simulation, navigation, etc.).
2.  **Dependency Mapping:** List all services required from the `ServiceRegistry`.
3.  **Memory Allocation Check:** Ensure vectors/quaternions are pre-allocated in the constructor.
4.  **Code Generation:** Output the raw `.js` file content.
5.  **Integration Plan:** Provide the exact line of code to register the system in the Kernel boot sequence.

## [2] MANDATORY SYSTEM TEMPLATE
Any newly generated system MUST match this exact ES6 structural pattern:

```javascript
import * as THREE from 'three';

export class NewSystemTemplate {
    constructor(kernel) {
        this.kernel = kernel;
        this.registry = kernel.registry;
        
        // 1. Dependency References (Populated in init)
        this.camera = null;
        
        // 2. Pre-allocated Math Objects (To prevent GC spikes)
        this._calcVector = new THREE.Vector3();
        this._calcQuat = new THREE.Quaternion();
    }

    init() {
        // Fetch dependencies ONLY during init phase
        this.camera = this.registry.get('camera');
        console.log(`[${this.constructor.name}] online.`);
    }

    update(deltaTime) {
        // Logic executing in the designated Kernel phase
    }
}