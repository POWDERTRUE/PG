/**
 * TerrainChunkPool.js
 * OMEGA V31 — Pool estático Zero-GC de geometría de terreno
 * 
 * LEY DE HIERRO: Todo acceso debe ser acquire()/release().
 * PROHIBIDO: new Float32Array(), new THREE.BufferGeometry() en hot path.
 */

export class TerrainChunkPool {
    /**
     * @param {number} capacity - Número máximo de chunks simultáneos (default: 600)
     * @param {number} resolution - Dimensión NxN de vértices por chunk (default: 32)
     */
    constructor(capacity = 600, resolution = 32) {
        this.capacity   = capacity;
        this.resolution = resolution;

        const vertsPerChunk  = resolution * resolution;
        const indicesPerChunk = (resolution - 1) * (resolution - 1) * 6;

        // ─── Pre-allocación única en Boot ─────────────────────────────────────
        this._vboPool = new Float32Array(capacity * vertsPerChunk * 3); // XYZ
        this._nboPool = new Float32Array(capacity * vertsPerChunk * 3); // Normals
        this._uboPool = new Float32Array(capacity * vertsPerChunk * 2); // UVs
        this._iboPool = new Uint16Array(capacity * indicesPerChunk);

        // Stack de índices libres (O(1) acquire/release)
        this._stack = new Int32Array(capacity);
        for (let i = 0; i < capacity; i++) this._stack[i] = i;
        this._top = capacity; // Puntero al tope del stack

        // Metadata por chunk (primitivos escalares, sin objetos)
        this._inUse    = new Uint8Array(capacity);  // 0=libre, 1=ocupado
        this._lod      = new Uint8Array(capacity);
        this._faceIndex = new Uint8Array(capacity);
        this._nodeIndex = new Int32Array(capacity).fill(-1);

        // Vertsage y offset pre-calculados para sub-vistas
        this._vertsPerChunk   = vertsPerChunk;
        this._indicesPerChunk = indicesPerChunk;

        console.log(`[TerrainChunkPool] Inicializado: ${capacity} chunks × ${resolution}² verts — VBO: ${(this._vboPool.byteLength / 1024 / 1024).toFixed(1)}MB`);
    }

    /**
     * Adquiere un chunk del pool. O(1).
     * @returns {number} chunkId o -1 si el pool está agotado
     */
    acquire() {
        if (this._top === 0) {
            console.warn('[TerrainChunkPool] Pool AGOTADO. Reducir LOD o aumentar capacidad.');
            return -1;
        }
        const id = this._stack[--this._top];
        this._inUse[id] = 1;
        return id;
    }

    /**
     * Libera un chunk al pool. O(1).
     * @param {number} id
     */
    release(id) {
        if (id < 0 || id >= this.capacity) return;
        this._inUse[id]    = 0;
        this._lod[id]      = 0;
        this._faceIndex[id] = 0;
        this._nodeIndex[id] = -1;
        this._stack[this._top++] = id;
    }

    /**
     * Devuelve una sub-vista del VBO para un chunk dado.
     * Creada una sola vez en boot por THREE.BufferAttribute.
     * @param {number} id
     * @returns {Float32Array} sub-vista (no copia)
     */
    getPositionView(id) {
        const off = id * this._vertsPerChunk * 3;
        return this._vboPool.subarray(off, off + this._vertsPerChunk * 3);
    }

    getNormalView(id) {
        const off = id * this._vertsPerChunk * 3;
        return this._nboPool.subarray(off, off + this._vertsPerChunk * 3);
    }

    getUVView(id) {
        const off = id * this._vertsPerChunk * 2;
        return this._uboPool.subarray(off, off + this._vertsPerChunk * 2);
    }

    getIndexView(id) {
        const off = id * this._indicesPerChunk;
        return this._iboPool.subarray(off, off + this._indicesPerChunk);
    }

    get available() { return this._top; }
    get used()      { return this.capacity - this._top; }
}
