import * as THREE from 'three';

/**
 * CelestialRegistry.js - OMEGA V28
 * Universe OS Celestial Body Registry
 */
export class CelestialRegistry {
    /** @type {string} */
    static phase = 'simulation';

    constructor(services){
        this.services = services;
        this.registry = services?.get('registry');
        this.events = services?.get('events'); // Bridge to kernel events
        
        // V15: Discovery Log Link
        this.discoveryLog = null;

        /**
         * MASTER BODY STORE
         */
        this.bodies = new Map();

        /**
         * V31: Name index — O(1) lookup via .get(name)
         * Updated by register() / unregister().
         */
        this._byName = new Map();

        /**
         * TYPE INDEX
         */
        this.byType = {
            MEGASUN: new Set(),
            BLUESUN: new Set(),
            PLANET:  new Set(),
            MOON:    new Set()
        };

        /**
         * CATEGORY INDEX
         */
        this.byCategory = new Map();

        /**
         * Reusable query buffers for Zero-GC simulation reads.
         * These arrays are rebuilt in-place and keep stable wrapper objects.
         */
        this._dynamicBodies = [];
        this._dynamicBodyRefs = [];
        this._staticAnchors = [];
        this._staticAnchorRefs = [];
    }

    init(){
        this.discoveryLog = this.registry?.get('DiscoveryLogSystem');
        console.log('[CelestialRegistry] OMEGA V28 Registry Online.');
    }

    /**
     * Creates a spatial group and registers it (optional)
     */
    createGroup(name) {
        const group = new THREE.Group();
        group.name = name;
        
        const sceneGraph = this.registry?.get('SceneGraph');
        if (sceneGraph) {
            sceneGraph.addWorldObject(group);
        }
        
        return group;
    }

    /**
     * V14: Master Factory for Universe OS entities
     */
    createCelestial(type, params) {
        const { name, radius, color, parent, distance = 0 } = params;
        
        const group = new THREE.Group();
        group.name = name;

        // V28 OMEGA Sphere Geometry with segments optimized for L4
        const geo = new THREE.SphereGeometry(radius, 32, 32);
        const mat = new THREE.MeshPhongMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: type === 'SUN' ? 0.5 : 0.05,
            shininess: type === 'SUN' ? 100 : 10
        });

        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        if (distance > 0 && parent) {
            const angle = Math.random() * Math.PI * 2;
            group.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
        }

        if (parent) {
            parent.add(group);
        }

        this.register(group, type, params.category || 'GENERAL');

        return group;
    }

    register(object, type, category = null){
        if(!object){
            console.warn('[CelestialRegistry] Cannot register null object.');
            return;
        }

        const id = object.uuid;
        if(this.bodies.has(id)) return;

        object.updateMatrixWorld(true);
        this.bodies.set(id, object);

        // V31: O(1) name index
        if (object.name) this._byName.set(object.name, id);

        if(this.byType[type]){
            this.byType[type].add(id);
        }

        if(category){
            if(!this.byCategory.has(category)){
                this.byCategory.set(category,new Set());
            }
            this.byCategory.get(category).add(id);
        }

        object.userData.osType = type;
        object.userData.osCategory = category;

        if (this.events) {
            this.events.emit('celestial:registered', object);
        }

        return id;
    }

    unregister(id){
        const object = this.bodies.get(id);
        if(!object) return;

        const type = object.userData.osType;
        const category = object.userData.osCategory;

        if(this.byType[type]) this.byType[type].delete(id);

        // V31: clean name index
        if (object.name) this._byName.delete(object.name);

        if(category && this.byCategory.has(category)){
            const set = this.byCategory.get(category);
            set.delete(id);
            if(set.size === 0) this.byCategory.delete(category);
        }

        this.bodies.delete(id);
        if (this.events) {
            this.events.emit('celestial:unregistered', object);
        }
    }

    _disposeObjectResources(object) {
        object?.traverse?.((child) => {
            child.geometry?.dispose?.();
            const material = child.material;
            if (Array.isArray(material)) {
                for (let i = 0; i < material.length; i++) {
                    material[i]?.dispose?.();
                }
            } else {
                material?.dispose?.();
            }
        });
        object?.parent?.remove?.(object);
    }

    getById(id){
        return this.bodies.get(id);
    }

    getByType(type){
        const ids = this.byType[type] || new Set();
        return Array.from(ids).map(id => this.bodies.get(id)).filter(Boolean);
    }

    getByCategory(category){
        const ids = this.byCategory.get(category) || new Set();
        return Array.from(ids).map(id => this.bodies.get(id)).filter(Boolean);
    }

    getMegaSun(){
        const list = this.getByType('MEGASUN');
        return list.length ? list[0] : null;
    }

    /**
     * V31: O(1) lookup by name via the _byName index.
     * Previously O(n) — iterated all bodies.
     * @param {string} name
     * @returns {THREE.Object3D|null}
     */
    get(name) {
        const id = this._byName.get(name);
        return id ? this.bodies.get(id) ?? null : null;
    }

    getDynamicBodies() {
        const result = this._dynamicBodies;
        result.length = 0;

        let writeIndex = 0;
        for (const body of this.bodies.values()) {
            const position = body?.position ?? null;
            const velocity = body?.velocity ?? body?.userData?.velocity ?? null;
            if (!position || !velocity) continue;

            let entry = this._dynamicBodyRefs[writeIndex];
            if (!entry) {
                entry = {
                    position,
                    velocity,
                    mesh: body,
                    mass: body.userData?.mass ?? 1,
                };
                this._dynamicBodyRefs[writeIndex] = entry;
            } else {
                entry.position = position;
                entry.velocity = velocity;
                entry.mesh = body;
                entry.mass = body.userData?.mass ?? 1;
            }

            result.push(entry);
            writeIndex++;
        }

        return result;
    }

    getStaticAnchors() {
        const result = this._staticAnchors;
        result.length = 0;

        let writeIndex = 0;
        for (const body of this.bodies.values()) {
            const position = body?.position ?? null;
            const type = body?.userData?.osType;
            const nodeType = body?.userData?.nodeType;
            const isAnchor = Boolean(
                position &&
                (
                    body?.userData?.isStaticAnchor ||
                    type === 'SUN' ||
                    type === 'MEGASUN' ||
                    type === 'BLUESUN' ||
                    nodeType === 'star'
                )
            );

            if (!isAnchor) continue;

            let entry = this._staticAnchorRefs[writeIndex];
            if (!entry) {
                entry = {
                    position,
                    mass: body.userData?.mass ?? 100000,
                    mesh: body,
                };
                this._staticAnchorRefs[writeIndex] = entry;
            } else {
                entry.position = position;
                entry.mass = body.userData?.mass ?? 100000;
                entry.mesh = body;
            }

            result.push(entry);
            writeIndex++;
        }

        return result;
    }

    forEach(callback){
        this.bodies.forEach(callback);
    }

    stats(){
        return {
            totalBodies: this.bodies.size,
            megasuns: this.byType.MEGASUN?.size || 0,
            planets: this.byType.PLANET?.size || 0,
            categories: this.byCategory.size
        };
    }

    clear(options = {}){
        const disposeResources = typeof options === 'boolean'
            ? options
            : Boolean(options?.disposeResources);

        if (disposeResources) {
            this.bodies.forEach((object) => this._disposeObjectResources(object));
        }

        this.bodies.clear();
        this._byName.clear(); // V31: clear name index too
        Object.keys(this.byType).forEach(type=>{
            this.byType[type].clear();
        });
        this.byCategory.clear();
        this._dynamicBodies.length = 0;
        this._staticAnchors.length = 0;
        this._dynamicBodyRefs.length = 0;
        this._staticAnchorRefs.length = 0;
    }

    dispose(){
        this.clear({ disposeResources: true });
        this.discoveryLog = null;
        this.events = null;
        this.registry = null;
        this.services = null;
    }
}

export const celestialRegistry = new CelestialRegistry();
