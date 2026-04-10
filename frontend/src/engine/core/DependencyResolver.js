/**
 * DependencyResolver.js
 * OMEGA V28 Master Edition — Core Foundation
 */
export class DependencyResolver {

    /**
     * Resolves a manifest of system descriptors into a deterministic initialization order.
     *
     * @param {Object} manifest - Keyed by system name { dependencies: string[], priority: number }
     * @returns {string[]} Ordered system names
     * @throws {Error} On structural failure or circular dependencies
     */
    static resolve(manifest) {
        const names = Object.keys(manifest);
        const nameSet = new Set(names);

        // 1. Detection of high-level duplicates (Object key collisions handled by JS, but protects against merged manifests)
        if (nameSet.size !== names.length) {
            throw new Error(
                `[DependencyResolver] DUPLICATE SYSTEM NAMES detected in manifest.`
            );
        }

        const inDegree = new Map();
        const adjList  = new Map();
        const priorities = new Map();

        // 2. Structural Validation Pass
        for (const name of names) {
            const entry = manifest[name];

            if (!entry) {
                throw new Error(`[DependencyResolver] Invalid descriptor for "${name}"`);
            }

            if (entry.dependencies && !Array.isArray(entry.dependencies)) {
                throw new Error(
                    `[DependencyResolver] "${name}" dependencies must be an array.`
                );
            }

            if (entry.priority && typeof entry.priority !== "number") {
                throw new Error(
                    `[DependencyResolver] "${name}" priority must be a number.`
                );
            }

            inDegree.set(name, 0);
            adjList.set(name, []);
            priorities.set(name, entry.priority ?? 50);
        }

        // 3. Graph Construction
        for (const name of names) {
            const deps = manifest[name].dependencies || manifest[name].deps || [];

            for (const dep of deps) {
                if (!nameSet.has(dep)) {
                    throw new Error(
                        `[DependencyResolver] FATAL: "${name}" depends on "${dep}", ` +
                        `but "${dep}" is not declared in the manifest.`
                    );
                }

                adjList.get(dep).push(name);
                inDegree.set(name, inDegree.get(name) + 1);
            }
        }

        // 4. Initial Queue (Topological Start Nodes)
        let queue = names
            .filter(name => inDegree.get(name) === 0)
            .sort((a, b) => priorities.get(a) - priorities.get(b));

        const result = [];

        // 5. Resolution Loop (Kahn's)
        while (queue.length > 0) {
            const current = queue.shift();
            result.push(current);

            for (const dependent of adjList.get(current)) {
                const newDeg = inDegree.get(dependent) - 1;
                inDegree.set(dependent, newDeg);

                if (newDeg === 0) {
                    queue.push(dependent);
                    // Re-sort queue to maintain priority-based initialization
                    queue.sort((a, b) => priorities.get(a) - priorities.get(b));
                }
            }
        }

        // 6. Diagnostics on Failure
        if (result.length !== names.length) {
            const resolvedSet = new Set(result);
            const stuck = names.filter(n => !resolvedSet.has(n));

            throw new Error(
                `[DependencyResolver] CIRCULAR DEPENDENCY DETECTED. ` +
                `Affected systems: [${stuck.join(', ')}]`
            );
        }

        return result;
    }

    /**
     * Alias for resolve().
     */
    static sort(manifest) {
        return this.resolve(manifest);
    }

    /**
     * Resolve and audit the full boot graph.
     *
     * @param {Object} manifest
     * @returns {string[]} Ordered system names
     */
    static audit(manifest) {
        const order = this.resolve(manifest);

        console.group('%c 🌌 OMEGA V28 Boot Graph ', 'background:#111;color:#00f2ff;font-weight:bold');
        console.table(order.map((name, i) => {
            const entry = manifest[name];
            return {
                Step: i + 1,
                System: name,
                Priority: entry?.priority ?? 50,
                Deps: (entry?.dependencies || entry?.deps || []).join(', ') || '—',
                Status: '✓ READY'
            };
        }));
        console.groupEnd();

        return order;
    }
}
