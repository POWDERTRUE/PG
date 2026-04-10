/**
 * EntityManager.js — V2 REAL ECS
 *
 * Full Entity-Component-System implementation using a Sparse Set architecture.
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────────────
 *
 *  ComponentStore<T>
 *    Sparse set per component type. O(1) add / get / remove / has.
 *    Stores data in a dense array for cache-friendly iteration.
 *    Supports both class-based (new API) and string-keyed (legacy API) types.
 *
 *  Query
 *    Cached multi-component query result.
 *    Invalidates when the component stores change.
 *    Re-iterates the smallest store for minimal work.
 *
 *  ECSWorld
 *    Core engine. Creates entities (integer IDs), manages component stores,
 *    caches queries, recycles destroyed entity IDs.
 *    Exposes both the new type-safe API and the legacy string-based API.
 *
 *  System (abstract base class)
 *    Optional base for ECS systems. Declares `static components = [...]`
 *    and `execute(world, delta)`. BootSequence can auto-register these.
 *
 *  EntityManager (legacy wrapper)
 *    Delegates all old calls to an `ECSWorld` instance.
 *    0 breaking changes for current WindowManager / MeshSyncSystem code.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Vector3 } from './math/Vector3.js';
import { Euler } from './math/Euler.js';


// ═══════════════════════════════════════════════════════════════════
//  TYPED ARRAY COMPONENT POOL — Data-Oriented Design (V31)
//  Zero GC binary storage for numeric components.
//  Uses SharedArrayBuffer when available (requires COOP/COEP headers),
//  falls back to ArrayBuffer transparently.
// ═══════════════════════════════════════════════════════════════════

export class TypedArrayComponentPool {
    /**
     * @param {number} maxEntities     - Max entities supported (default 65536)
     * @param {number} floatsPerEntity - Float32 fields per entity slot
     */
    constructor(maxEntities = 65536, floatsPerEntity = 9) {
        this.maxEntities     = maxEntities;
        this.floatsPerEntity = floatsPerEntity;
        const totalBytes     = maxEntities * floatsPerEntity * 4; // Float32 = 4 bytes

        try {
            if (typeof SharedArrayBuffer === 'undefined') {
                throw new Error('SharedArrayBuffer unavailable');
            }
            this._sab  = new SharedArrayBuffer(totalBytes);
            this._data = new Float32Array(this._sab);
        } catch (err) {
            // COOP/COEP not configured or browser does not support SAB.
            // Fallback to ArrayBuffer for compatibility with non-isolated environments.
            this._sab  = new ArrayBuffer(totalBytes);
            this._data = new Float32Array(this._sab);
        }
    }

    /**
     * Returns a Float32Array VIEW into the buffer for `entityId`.
     * ZERO allocations — just a subarray pointer into the SAB.
     * @param {number} entityId
     * @returns {Float32Array}
     */
    getView(entityId) {
        const offset = entityId * this.floatsPerEntity;
        return this._data.subarray(offset, offset + this.floatsPerEntity);
    }

    /**
     * Write default values for a newly created entity.
     * @param {number}   entityId
     * @param {number[]} defaults
     */
    init(entityId, defaults) {
        const view = this.getView(entityId);
        const len  = Math.min(this.floatsPerEntity, defaults.length);
        for (let i = 0; i < len; i++) view[i] = defaults[i];
    }

    /** @returns {SharedArrayBuffer|ArrayBuffer} — pass to Web Workers */
    get sharedBuffer() { return this._sab; }

    getStats() {
        const bytes = this.maxEntities * this.floatsPerEntity * 4;
        return {
            maxEntities:     this.maxEntities,
            floatsPerEntity: this.floatsPerEntity,
            totalKB:         (bytes / 1024).toFixed(1),
            isShared:        typeof SharedArrayBuffer !== 'undefined' && this._sab instanceof SharedArrayBuffer,
        };
    }
}

/**
 * Pre-allocated singleton pools for the three critical numeric components.
 * Import directly in physics / galaxy systems that need DOD storage.
 *
 * TRANSFORM_POOL layout  : [posX, posY, posZ, rotX, rotY, rotZ, scaleX, scaleY, scaleZ]
 * VELOCITY_POOL  layout  : [velX, velY, velZ, angularSpeed]
 * PHYSICS_POOL   layout  : [mass, radius, isKinematic]
 */
export const TRANSFORM_POOL = new TypedArrayComponentPool(65536, 9);
export const VELOCITY_POOL  = new TypedArrayComponentPool(65536, 4);
export const PHYSICS_POOL   = new TypedArrayComponentPool(65536, 3);

(() => {
    const t = TRANSFORM_POOL.getStats();
    console.log(
        `%c[ECS/DOD] TypedArrayPools online — ${t.totalKB} KB × 3 | SharedArrayBuffer: ${t.isShared}`,
        'color:#00f2ff;font-weight:bold'
    );
})();


// ═══════════════════════════════════════════════════════════════════
//  COMPONENT STORE — Sparse Set
// ═══════════════════════════════════════════════════════════════════

class ComponentStore {
    constructor() {
        /** @type {any[]} Dense array of component instances */
        this.dense = [];
        /** @type {number[]} Dense index → entity ID */
        this.denseEntityIds = [];
        /** @type {Map<number, number>} Entity ID → dense index */
        this.sparse = new Map();
    }

    /**
     * Add or overwrite a component for an entity.
     * @param {number} entityId
     * @param {any} data
     */
    add(entityId, data) {
        if (this.has(entityId)) {
            // Overwrite in place
            this.dense[this.sparse.get(entityId)] = data;
            return;
        }
        const idx = this.dense.length;
        this.sparse.set(entityId, idx);
        this.dense.push(data);
        this.denseEntityIds.push(entityId);
    }

    /**
     * Remove a component from an entity (swap-with-last for O(1)).
     * @param {number} entityId
     */
    remove(entityId) {
        if (!this.has(entityId)) return;

        const idx      = this.sparse.get(entityId);
        const lastIdx  = this.dense.length - 1;
        const lastEnt  = this.denseEntityIds[lastIdx];

        // 1. Hook of professional disposal — BEFORE SWAP
        const component = this.dense[idx];
        if (component && typeof component.dispose === 'function') {
            try {
                component.dispose();
            } catch (e) {
                console.error(`[ECS] Error disposing component`, e);
            }
        }

        // 2. Swapping with last element for O(1) removal
        this.dense[idx]           = this.dense[lastIdx];
        this.denseEntityIds[idx]  = lastEnt;
        this.sparse.set(lastEnt, idx);

        // 3. Shrink
        this.dense.pop();
        this.denseEntityIds.pop();
        this.sparse.delete(entityId);
    }

    /** @returns {any|undefined} */
    get(entityId) {
        return this.dense[this.sparse.get(entityId)];
    }

    /** @returns {boolean} */
    has(entityId) {
        return this.sparse.has(entityId);
    }

    /** Iterate all component instances */
    [Symbol.iterator]() {
        return this.dense[Symbol.iterator]();
    }
}


// ═══════════════════════════════════════════════════════════════════
//  QUERY — cached multi-component entity list
// ═══════════════════════════════════════════════════════════════════

class Query {
    /**
     * @param {ECSWorld} world
     * @param {Array<string|Function>} types
     */
    constructor(world, types) {
        this._world  = world;
        this._types  = types;
        this._cache  = null;
        this._dirty  = true;
        this._mask   = world._getMask(types);
    }

    invalidate() { this._dirty = true; }

    /**
     * Returns a stable array of entity IDs that have ALL required components.
     * Re-computed only when the store changed since last call.
     * @returns {number[]}
     */
    execute() {
        if (!this._dirty && this._cache) return this._cache;

        const stores = this._types.map(t => this._world._store(t));

        // Iterate the smallest store to minimise work
        const smallest = stores.reduce(
            (a, b) => (a && a.dense.length <= (b ? b.dense.length : Infinity)) ? a : b,
            null
        );

        if (!smallest) { this._cache = []; this._dirty = false; return this._cache; }

        // BITMASK OPTIMIZATION: Use bitwise AND for signature matching
        const mask = this._mask;
        const signatures = this._world._signatures;
        
        this._cache = smallest.denseEntityIds.filter(id => {
            const sig = signatures.get(id) || 0;
            return (sig & mask) === mask;
        });

        this._dirty = false;
        return this._cache;
    }
}


// ═══════════════════════════════════════════════════════════════════
//  ECS WORLD
// ═══════════════════════════════════════════════════════════════════

export class ECSWorld {
    constructor() {
        /** @type {number} */
        this._nextId   = 1;
        /** @type {number[]} Recycled entity IDs */
        this._recycled = [];
        /** @type {Set<number>} Currently alive entities */
        this._alive    = new Set();
        /** @type {Map<string|Function, ComponentStore>} */
        this._stores   = new Map();
        /** @type {Map<string, Query>} key→Query cache */
        this._queries  = new Map();
        /** @type {Map<string|Function, Set<Query>>} Component -> Dependent Queries */
        this._componentQueries = new Map();
        /** @type {Map<number, number>} Entity ID → Bitmask signature */
        this._signatures = new Map();
        /** @type {Map<string|Function, number>} Component -> Bit index */
        this._bitIndices = new Map();
        this._nextBit = 0;
    }

    // ── Entity lifecycle ─────────────────────────────────────────

    /**
     * Create a new entity. Returns an integer ID.
     * @returns {number}
     */
    createEntity() {
        const id = this._recycled.length > 0 ? this._recycled.pop() : this._nextId++;
        this._alive.add(id);
        return id;
    }

    /**
     * Destroy an entity and all its component data.
     * @param {number} entityId
     */
    destroyEntity(entityId) {
        if (!this._alive.has(entityId)) return;
        this._alive.delete(entityId);
        
        // Remove components and track which ones were removed to invalidate queries
        for (const [type, store] of this._stores.entries()) {
            if (store.has(entityId)) {
                store.remove(entityId);
                this._invalidateType(type);
            }
        }

        this._signatures.delete(entityId);
        this._recycled.push(entityId);
    }

    /** @returns {boolean} */
    isAlive(entityId) { return this._alive.has(entityId); }

    /** @returns {number} Count of live entities */
    get entityCount() { return this._alive.size; }

    // ── Component management ─────────────────────────────────────

    /**
     * Add a component instance to an entity.
     * @param {number}           entityId
     * @param {string|Function}  type       String key or class reference
     * @param {any}              [data]     Instance; if omitted, `new type()` is called
     * @returns {this}
     */
    addComponent(entityId, type, data) {
        if (!this._stores.has(type)) {
            this._stores.set(type, new ComponentStore());
        }
        const instance = data !== undefined ? data : (typeof type === 'function' ? new type() : {});
        this._stores.get(type).add(entityId, instance);
        
        // Update signature
        const bit = this._getBit(type);
        this._signatures.set(entityId, (this._signatures.get(entityId) || 0) | bit);
        
        this._invalidateType(type);
        return this;
    }

    /**
     * Remove a component from an entity.
     * @param {number}          entityId
     * @param {string|Function} type
     * @returns {this}
     */
    removeComponent(entityId, type) {
        const store = this._store(type);
        if (store?.has(entityId)) {
            store.remove(entityId);
            const bit = this._getBit(type);
            this._signatures.set(entityId, (this._signatures.get(entityId) || 0) & ~bit);
            this._invalidateType(type);
        }
        return this;
    }

    /**
     * Get a component instance.
     * @param {number}          entityId
     * @param {string|Function} type
     * @returns {any|undefined}
     */
    getComponent(entityId, type) {
        return this._store(type)?.get(entityId);
    }

    /**
     * @param {number}          entityId
     * @param {string|Function} type
     * @returns {boolean}
     */
    hasComponent(entityId, type) {
        return this._store(type)?.has(entityId) ?? false;
    }

    // ── Queries ─────────────────────────────────────────────────

    /**
     * Returns an array of entity IDs that have ALL given component types.
     * Result is cached until any store changes.
     * @param {...(string|Function)} types
     * @returns {number[]}
     */
    query(...types) {
        const key = types.map(t => typeof t === 'function' ? t.name : t).join('|');
        if (!this._queries.has(key)) {
            const q = new Query(this, types);
            this._queries.set(key, q);
            
            // Map types to this query for granular invalidation
            for (const type of types) {
                if (!this._componentQueries.has(type)) {
                    this._componentQueries.set(type, new Set());
                }
                this._componentQueries.get(type).add(q);
            }
        }
        return this._queries.get(key).execute();
    }

    /**
     * Iterate entities with components, yielding `[entityId, comp1, comp2, ...]`.
     * @param {...(string|Function)} types
     * @yields {[number, ...any]}
     */
    *each(...types) {
        const ids     = this.query(...types);
        const stores  = types.map(t => this._store(t));
        for (const id of ids) {
            yield [id, ...stores.map(s => s?.get(id))];
        }
    }

    /**
     * Get all component instances attached to an entity.
     * Returns a plain object keyed by type name (for debugging).
     * @param {number} entityId
     * @returns {Object}
     */
    inspect(entityId) {
        const result = {};
        for (const [type, store] of this._stores) {
            if (store.has(entityId)) {
                const key = typeof type === 'function' ? type.name : type;
                result[key] = store.get(entityId);
            }
        }
        return result;
    }

    // ── Array queries (legacy-compatible) ────────────────────────

    /**
     * Legacy: returns array of entity-like objects `{id, components:{}}`.
     * Keeps MeshSyncSystem and WindowManager working without changes.
     * @param {...string} componentNames
     * @returns {Array<{id:number, components:Object}>}
     */
    getEntitiesWith(...componentNames) {
        return this.query(...componentNames).map(id => ({
            id,
            components: Object.fromEntries(
                componentNames.map(n => [n, this.getComponent(id, n)])
            )
        }));
    }

    // ── Internals ────────────────────────────────────────────────

    /** @returns {ComponentStore|undefined} */
    _store(type) { return this._stores.get(type); }

    _getBit(type) {
        if (!this._bitIndices.has(type)) {
            if (this._nextBit >= 31) {
                console.warn('[ECS] Max component types (31) reached for bitmask optimization. Falling back for new types.');
                return 0; // Or implement bitmask groups/BigInt
            }
            this._bitIndices.set(type, 1 << this._nextBit++);
        }
        return this._bitIndices.get(type);
    }

    _getMask(types) {
        return types.reduce((mask, type) => mask | this._getBit(type), 0);
    }

    _invalidateType(type) {
        const queries = this._componentQueries.get(type);
        if (queries) {
            for (const q of queries) q.invalidate();
        }
    }

    _invalidateAll() {
        for (const q of this._queries.values()) q.invalidate();
    }

    /** Debug: print entity / component stats to console */
    debug() {
        console.group('[ECSWorld] Debug');
        console.log(`Alive entities : ${this._alive.size}`);
        console.log(`Recycled IDs   : ${this._recycled.length}`);
        const rows = [...this._stores.entries()].map(([type, store]) => ({
            component: typeof type === 'function' ? type.name : type,
            count:     store.dense.length
        }));
        console.table(rows);
        console.groupEnd();
    }
}


// ═══════════════════════════════════════════════════════════════════
//  SYSTEM BASE CLASS
// ═══════════════════════════════════════════════════════════════════

/**
 * Optional base class for ECS systems.
 *
 * @example
 * class MovementSystem extends System {
 *   static components = [TransformComponent, VelocityComponent];
 *
 *   execute(world, delta) {
 *     for (const [id, transform, velocity] of world.each(...MovementSystem.components)) {
 *       transform.position.addScaledVector(velocity.velocity, delta);
 *     }
 *   }
 * }
 */
export class System {
    /** @type {Array<string|Function>} Override in subclass */
    static components = [];
    
    /** @type {string} Execution phase (input, simulation, physics, navigation, render, post) */
    static phase = 'simulation';

    /** Called once at boot. @param {ECSWorld} world */
    init(world) {}

    /**
     * Called every frame by SystemRegistry._runPhase('update').
     * @param {number} delta
     * @param {number} time
     * @param {ECSWorld} world
     */
    update(delta, time, world) {
        const actualWorld = world || (typeof window !== 'undefined' ? window.__OMEGA_WORLD__ : null);
        this.execute(actualWorld, delta, time);
    }

    /**
     * Your system logic goes here. Override this.
     * @param {ECSWorld}  world
     * @param {number}    delta
     * @param {number}    time
     */
    execute(world, delta, time) {}

    /**
     * Called when the system is removed or the engine shuts down.
     * Use this to remove event listeners or dispose logic resources.
     */
    destroy() {}
}


// ═══════════════════════════════════════════════════════════════════
//  LEGACY EntityManager WRAPPER
//  Delegates to ECSWorld so existing code needs zero changes.
// ═══════════════════════════════════════════════════════════════════

export class EntityManager {
    constructor() {
        /** @type {ECSWorld} */
        this.world = new ECSWorld();
    }

    // ── Legacy API ────────────────────────────────────────────────

    /**
     * Create entity. Returns a legacy-compatible entity object `{id}`.
     */
    create() {
        const id = this.world.createEntity();
        // Return an object with .id so legacy code (WindowManager) still works
        return { id };
    }

    /**
     * Add component. Accepts either an entity object `{id}` or a bare id number.
     */
    addComponent(entity, name, component) {
        const id = typeof entity === 'object' ? entity.id : entity;
        this.world.addComponent(id, name, component);
    }

    removeComponent(entity, name) {
        const id = typeof entity === 'object' ? entity.id : entity;
        this.world.removeComponent(id, name);
    }

    getEntities() {
        return [...this.world._alive].map(id => ({ id, components: this.world.inspect(id) }));
    }

    destroy(entityOrId) {
        const id = typeof entityOrId === 'object' ? entityOrId.id : entityOrId;
        this.world.destroyEntity(id);
    }

    getEntitiesWith(...componentNames) {
        return this.world.getEntitiesWith(...componentNames);
    }

    // ── New API passthrough (for progressive migration) ──────────

    /** @returns {ECSWorld} */
    getWorld() { return this.world; }

    get entityCount() { return this.world.entityCount; }

    debug() { this.world.debug(); }

    // ── O(1) Bridge for Render Culling (Data-Oriented) ───────────

    getMeshByEntityId(entityId) {
        const meshComp = this.world.getComponent(entityId, MeshComponent) || 
                         this.world.getComponent(entityId, 'mesh') || 
                         this.world.getComponent(entityId, 'MeshComponent');
        return meshComp ? meshComp.mesh : null;
    }

    hideAll() {
        for (const [id, meshComp] of this.world.each(MeshComponent)) {
            if (meshComp && meshComp.mesh) meshComp.mesh.visible = false;
        }
        for (const [id, meshComp] of this.world.each('mesh')) {
            if (meshComp && meshComp.mesh) meshComp.mesh.visible = false;
        }
        for (const [id, meshComp] of this.world.each('MeshComponent')) {
            if (meshComp && meshComp.mesh) meshComp.mesh.visible = false;
        }
    }
}


// ═══════════════════════════════════════════════════════════════════
//  BUILT-IN COMPONENTS
// ═══════════════════════════════════════════════════════════════════

export class TransformComponent {
    constructor() {
        this.position = new Vector3();
        this.rotation = new Euler();
        this.scale    = new Vector3(1, 1, 1);
    }
}

export class VelocityComponent {
    constructor() {
        this.velocity     = new Vector3();
        this.angularSpeed = 0;
    }
}

export class WindowComponent {
    constructor(url = '') {
        this.url      = url;
        this.isOpen   = true;
        this.isPinned = false;
    }
}

export class MeshComponent {
    /**
     * @param {THREE.Object3D} mesh
     */
    constructor(mesh = null) {
        this.mesh = mesh;
    }

    dispose() {
        if (this.mesh) {
            // Use the kernel registry to get RenderPipeline instead of dynamic import
            // This is safer and prevents async GC pressure
            const pipeline = this.mesh.__registry?.get('RenderPipeline');
            if (pipeline) {
                pipeline.constructor.disposeObject(this.mesh);
            }
        }
    }
}

export class PhysicsComponent {
    constructor() {
        this.mass        = 1;
        this.radius      = 10;
        this.velocity    = new Vector3();
        this.isKinematic = false;
    }
}

export class CelestialBodyComponent {
    constructor(type = 'PLANET', orbitRadius = 0, orbitSpeed = 0.1) {
        this.type        = type;          // 'MEGASUN' | 'BLUESUN' | 'PLANET' | 'MOON'
        this.orbitRadius = orbitRadius;
        this.orbitSpeed  = orbitSpeed;
        this.orbitAngle  = Math.random() * Math.PI * 2;
    }
}

export class TagComponent {
    /**
     * Lightweight marker component — no data, just presence signals membership.
     * @param {...string} tags
     */
    constructor(...tags) {
        this.tags = new Set(tags);
    }
    has(tag) { return this.tags.has(tag); }
}

export class HierarchyComponent {
    /**
     * @param {number|null} parent
     */
    constructor(parent = null) {
        /** @type {number|null} */
        this.parent = parent;
        /** @type {Set<number>} */
        this.children = new Set();
        /** @type {boolean} Force update of children */
        this.dirty = true;
    }
}

