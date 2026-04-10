/**
 * BootGraphVisualizer.js — OMEGA Engine Tooling
 *
 * Visualizes system dependency graphs directly in DevTools.
 * Compatible with DependencyResolver manifest format.
 *
 * Features:
 *   - Boot order visualization
 *   - Dependency tree rendering
 *   - Cycle highlighting
 *   - DevTools console graph
 */

import { DependencyResolver } from './DependencyResolver.js';

export class BootGraphVisualizer {

    /**
     * Render a dependency tree starting from root systems
     */
    static drawTree(manifest) {
        const names = Object.keys(manifest);
        const depsMap = {};
        const reverse = {};

        for (const name of names) {
            depsMap[name] = manifest[name].dependencies || manifest[name].deps || [];
            reverse[name] = [];
        }

        // Build reverse graph
        for (const sys of names) {
            for (const dep of depsMap[sys]) {
                if (reverse[dep]) {
                    reverse[dep].push(sys);
                }
            }
        }

        const roots = names.filter(n => depsMap[n].length === 0);

        console.group('%c🌌 OMEGA Boot Dependency Tree', 'color:#00eaff;font-weight:bold');
        for (const root of roots) {
            this._printNode(root, reverse, "", new Set());
        }
        console.groupEnd();
    }

    static _printNode(node, reverse, prefix, visited) {
        const branch = prefix ? "└─ " : "";
        console.log(prefix + branch + node);

        if (visited.has(node)) {
            console.warn(prefix + "   ↺ cycle detected");
            return;
        }

        visited.add(node);
        const children = reverse[node] || [];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const nextPrefix = prefix + "   ";
            this._printNode(child, reverse, nextPrefix, new Set(visited));
        }
    }

    /**
     * Render linear boot order
     */
    static showBootOrder(manifest) {
        const order = DependencyResolver.resolve(manifest);

        console.group('%c🚀 OMEGA Boot Order', 'color:#8aff00;font-weight:bold');
        order.forEach((name, i) => {
            console.log(
                `%c${String(i + 1).padStart(2,"0")} → ${name}`,
                "color:#8aff00"
            );
        });
        console.groupEnd();

        return order;
    }

    /**
     * Detect cycles with visual output
     */
    static detectCycles(manifest) {
        const names = Object.keys(manifest);
        const graph = {};

        for (const name of names) {
            graph[name] = manifest[name].dependencies || manifest[name].deps || [];
        }

        const visited = new Set();
        const stack = new Set();
        const cycles = [];

        const dfs = (node, path) => {
            if (stack.has(node)) {
                const cycle = path.slice(path.indexOf(node));
                cycles.push([...cycle, node]);
                return;
            }

            if (visited.has(node)) return;

            visited.add(node);
            stack.add(node);

            for (const dep of graph[node]) {
                dfs(dep, [...path, node]);
            }

            stack.delete(node);
        };

        for (const name of names) {
            dfs(name, []);
        }

        if (cycles.length === 0) {
            console.log(
                "%c✓ No circular dependencies detected",
                "color:#00ff9c;font-weight:bold"
            );
        } else {
            console.group(
                "%c⚠ OMEGA Cycle Detection",
                "color:#ff3c3c;font-weight:bold"
            );
            cycles.forEach(cycle => {
                console.log(
                    "%c" + cycle.join(" → "),
                    "color:#ff3c3c;font-weight:bold"
                );
            });
            console.groupEnd();
        }

        return cycles;
    }

    /**
     * Full engine graph audit
     */
    static audit(manifest) {
        console.group(
            "%c🌌 OMEGA ENGINE GRAPH AUDIT",
            "background:#111;color:#00eaff;font-weight:bold"
        );
        this.showBootOrder(manifest);
        console.log("");
        this.drawTree(manifest);
        console.log("");
        this.detectCycles(manifest);
        console.groupEnd();
    }
}
