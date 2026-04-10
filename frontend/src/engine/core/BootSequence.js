import { DependencyResolver } from './DependencyResolver.js';
import { SYSTEM_MANIFEST } from './SystemManifest.js';
import { BootSequenceDebugger } from './BootSequenceDebugger.js';

/**
 * BootSequence.js
 * OMEGA V15 Deterministic Boot Sequence.
 * Handles the instantiation and initialization of all engine systems
 * based on the dependency graph defined in SYSTEM_MANIFEST.
 */
export class BootSequence {
    constructor(kernel, registry) {
        this.kernel = kernel;
        this.registry = registry;
    }

    /**
     * Orchestrates the complete engine boot process.
     */
    async run() {
        console.log('[BootSequence] Initiating OMEGA V15 protocol...');
        
        try {
            // 1. Resolve deterministic execution order
            const sortedNames = DependencyResolver.resolve(SYSTEM_MANIFEST);
            console.log(`[BootSequence] Resolved boot order for ${sortedNames.length} systems:`, sortedNames);

            // 2. Begin profiling
            BootSequenceDebugger.begin();

            // 3. Sequential instantiation and initialization
            for (const name of sortedNames) {
                const descriptor = SYSTEM_MANIFEST[name];
                
                console.log(`[BootSequence] → [${name}]`);
                
                // Factory-based instantiation
                const instance = await descriptor.factory({ 
                    kernel: this.kernel, 
                    registry: this.registry,
                    services: this.kernel.services 
                });

                // Register in global registry
                this.registry.register(name, instance);

                // Safe initialization with profiling
                if (instance.init) {
                    await BootSequenceDebugger.measure(name, () => instance.init());
                }
            }

            // 4. End profiling
            BootSequenceDebugger.end();

            console.log('🚀 OMEGA protocol complete. System Ready.');
            return true;
        } catch (error) {
            console.error('❌ [BootSequence] FATAL ERROR during protocol execution:', error);
            throw error;
        }
    }
}
