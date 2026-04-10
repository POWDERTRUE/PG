// frontend/src/engine/planet/QuadTreeSphere.js
import * as THREE from 'three';

// Constantes estéticas y mecánicas (Aisladas para tunear LOD)
const MAX_LOD = 8;
const LOD_MULTIPLIER = 1.35;
const CULLING_HORIZON_OFFSET = 1.1;

// ── Buffers estáticos compartidos (Zero-GC) ─────────────────────────────────
// Alocados una sola vez en carga del módulo. Nunca instanciados en update/split.
const _tmpAxisA   = new THREE.Vector3();
const _tmpAxisB   = new THREE.Vector3();
const _tmpCubePos = new THREE.Vector3();
const _tmpOffsets = [
    new THREE.Vector2(), new THREE.Vector2(),
    new THREE.Vector2(), new THREE.Vector2()
];

const _tmpSphere  = new THREE.Sphere();

/**
 * QuadTreeNode — Estructura recursiva Zero-GC
 */
class QuadTreeNode {
    constructor(pool, sceneGroup, faceNormal, lodLevel, offset, quadSize, planetRadius, surfaceMaterial) {
        this.pool = pool;
        this.sceneGroup = sceneGroup;
        
        // Geometría del nodo
        this.faceNormal = faceNormal;
        this.lodLevel = lodLevel;
        this.offset = offset;
        this.quadSize = quadSize;
        this.planetRadius = planetRadius;
        this.surfaceMaterial = surfaceMaterial;

        // Estado
        this.children = [];
        this.isSplit = false;
        
        // Petición al Pool
        this.chunk = this.pool.requestChunk({
            faceNormal: this.faceNormal,
            offset: this.offset,
            quadSize: this.quadSize,
            lodLevel: this.lodLevel,
            planetRadius: this.planetRadius,
            vertexCount: (pool.segments + 1) * (pool.segments + 1)
        }, this.sceneGroup, this.surfaceMaterial);

        // Pre-calcular centro esférico aproximado para chequeos de distancia rápidos
        this.centerCube = new THREE.Vector3(
            this.faceNormal.x + this.offset.x * (this.faceNormal.y === 0 ? 1 : 0) + this.offset.y * (this.faceNormal.z === 0 && this.faceNormal.y !== 0 ? 1 : 0), // Simplificado matemáticamente
            // La función real requeriría los axisA y axisB evaluados, aquí haremos la conversión purista:
            0, 0
        );
        this._computeTrueCenter();
    }

    _computeTrueCenter() {
        // Reutilizamos los buffers estáticos del módulo (Zero-GC)
        _tmpAxisA.set(this.faceNormal.y, this.faceNormal.z, this.faceNormal.x);
        _tmpAxisB.set(this.faceNormal.z, this.faceNormal.x, this.faceNormal.y);
        
        const cx = this.faceNormal.x + (this.offset.x * _tmpAxisA.x) + (this.offset.y * _tmpAxisB.x);
        const cy = this.faceNormal.y + (this.offset.x * _tmpAxisA.y) + (this.offset.y * _tmpAxisB.y);
        const cz = this.faceNormal.z + (this.offset.x * _tmpAxisA.z) + (this.offset.y * _tmpAxisB.z);

        const x2 = cx*cx, y2 = cy*cy, z2 = cz*cz;
        const sx = cx * Math.sqrt(1.0 - y2*0.5 - z2*0.5 + (y2*z2)/3.0);
        const sy = cy * Math.sqrt(1.0 - x2*0.5 - z2*0.5 + (x2*z2)/3.0);
        const sz = cz * Math.sqrt(1.0 - x2*0.5 - y2*0.5 + (x2*y2)/3.0);

        // worldCenter es el único Vector3 propio del nodo — necesario para distanceTo()
        this.worldCenter = new THREE.Vector3(sx, sy, sz).multiplyScalar(this.planetRadius);
    }

    /**
     * Motor Principal - Evaluador Dinámico del QuadTree.
     */
    evaluate(cameraPosition, frustum, planetPosition) {
        // Distancia euclideana de la nave al parche
        const dist = cameraPosition.distanceTo(this.worldCenter);
        
        // OMEGA RULE: Limitación de VRAM. No pasamos el LOD máximo.
        const canSplit = this.lodLevel < MAX_LOD;

        // Ecuación Mágica: d < radio * C / 2^N
        // Determina si estamos lo suficientemente cerca para pedir LOD
        const threshold = this.planetRadius * LOD_MULTIPLIER / Math.pow(2, this.lodLevel);

        let didMutate = false;

        if (dist < threshold && canSplit && !this.isSplit) {
            this.split();
            didMutate = true;
        } else if (dist > threshold && this.isSplit) {
            this.merge();
            didMutate = true;
        }

        if (this.isSplit) {
            for (let i = 0; i < this.children.length; i++) {
                // Fix P2: or-bit a or lógico explícito para evitar coerciones numéricas
                if (this.children[i].evaluate(cameraPosition, frustum, planetPosition)) didMutate = true;
            }
        }

        // ── Frustum Culling OMEGA V31 ──────────────────────────────
        // Evaluamos si el nodo actual está dentro del frustum de la cámara.
        // Solo operamos sobre los nodos 'hojas' que actualmente tengan render activo (isSplit=false).
        if (!this.isSplit) {
            // Reutilizamos buffers globales
            _tmpCubePos.addVectors(planetPosition, this.worldCenter);
            
            // Radio de influencia (ajustado empíricamente al tamaño diagonal del parche quad local)
            const nodeRadius = (this.planetRadius * 2.0) / Math.pow(2, this.lodLevel);
            _tmpSphere.set(_tmpCubePos, nodeRadius);

            if (!frustum.intersectsSphere(_tmpSphere)) {
                // 🛑 Fuera del Frustum: Liberamos el chunk de memoria VRAM (se hace invisible)
                if (this.chunk && this.chunk.locked) {
                    this.pool.releaseChunk(this.chunk);
                }
            } else {
                // 🟢 Dentro del Frustum: Si lo habíamos liberado, pedirlo de nuevo al Pool
                if (this.chunk && !this.chunk.locked) {
                    this.chunk = this.pool.requestChunk({
                        faceNormal: this.faceNormal,
                        offset: this.offset,
                        quadSize: this.quadSize,
                        lodLevel: this.lodLevel,
                        planetRadius: this.planetRadius,
                        vertexCount: (this.pool.segments + 1) * (this.pool.segments + 1)
                    }, this.sceneGroup, this.surfaceMaterial);
                }
            }
        }

        return didMutate;
    }

    split() {
        if (this.isSplit) return;
        this.isSplit = true;

        if (this.chunk) {
            this.chunk.mesh.visible = false; // Ocultamos el Padre
        }

        const childSize = this.quadSize / 2.0;
        const halfChild = childSize / 2.0;
        // Offsets relativos para los 4 cuadrantes — Zero-GC: reutilizamos _tmpOffsets
        const quadrantSign = [[-1,-1],[1,-1],[-1,1],[1,1]];

        for (let q = 0; q < 4; q++) {
            _tmpOffsets[q].set(
                this.offset.x + (quadrantSign[q][0] * halfChild),
                this.offset.y + (quadrantSign[q][1] * halfChild)
            );
            
            this.children.push(new QuadTreeNode(
                this.pool,
                this.sceneGroup,
                this.faceNormal,
                this.lodLevel + 1,
                _tmpOffsets[q].clone(), // clone solo aqui — el constructor lo guarda
                childSize,
                this.planetRadius,
                this.surfaceMaterial
            ));
        }
    }

    merge() {
        if (!this.isSplit) return;
        this.isSplit = false;

        // Destrucción recursiva profunda si el hijo estaba divido
        for (let i = 0; i < this.children.length; i++) {
            this.children[i].disposeDeep();
        }
        
        // Limpiamos los punteros para el Garbage Collector local del array children
        this.children = [];

        // Ahora des-ocultamos al nodo Padre (Nosotros)
        if (this.chunk && this.chunk.mesh) {
            this.chunk.mesh.visible = true;
        }
    }

    disposeDeep() {
        // En caso de purgado fuerte, todo el ramal suelta memoria hacia el pool
        if (this.isSplit) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].disposeDeep();
            }
            this.children = [];
        }
        if (this.chunk) {
            this.pool.releaseChunk(this.chunk);
            this.chunk = null;
        }
    }
}

/**
 * Orquestador Hexaédrico
 */
export class QuadTreeSphere {
    constructor(pool, sceneGroup, planetRadius = 6000, surfaceMaterial) {
        this.pool = pool;
        this.sceneGroup = sceneGroup;
        this.planetRadius = planetRadius;
        this.surfaceMaterial = surfaceMaterial;
        this.faces = [];

        this.initFaces();
    }

    initFaces() {
        // Inicialización de las seis caras origen (+X, -X, +Y, -Y, +Z, -Z)
        const normals = [
            new THREE.Vector3( 1,  0,  0),
            new THREE.Vector3(-1,  0,  0),
            new THREE.Vector3( 0,  1,  0),
            new THREE.Vector3( 0, -1,  0),
            new THREE.Vector3( 0,  0,  1),
            new THREE.Vector3( 0,  0, -1)
        ];

        for (let i = 0; i < normals.length; i++) {
            // El quad base ocupa todo el mapeo [-1, 1], es decir quadSize de 2. offset 0,0
            this.faces.push(new QuadTreeNode(
                this.pool,
                this.sceneGroup,
                normals[i],
                0, // Level
                new THREE.Vector2(0, 0), // Offset X/Y central
                2.0, // Scale (1.0 = Unitario local, pero el Quad va de -1 a 1, size = 2)
                this.planetRadius,
                this.surfaceMaterial
            ));
        }
    }

    update(cameraPosition, frustum, planetPosition) {
        // Evaluamos todas las caras topográficas pasando directamente las referencias al Frustum
        for (let i = 0; i < this.faces.length; i++) {
            this.faces[i].evaluate(cameraPosition, frustum, planetPosition);
        }
    }

    destroyTree() {
        // Cuando saltamos al Warp a otro sistema, purgar todo el Planeta
        for (let i = 0; i < this.faces.length; i++) {
            this.faces[i].disposeDeep();
        }
        this.faces = [];
    }
}
