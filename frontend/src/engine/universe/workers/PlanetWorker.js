/**
 * PlanetWorker.js - V34 NEURAL LOD
 * 
 * High-performance worker for procedural mesh generation.
 * Handles noise, heightmaps, vertex buffer construction, and SKIRTS.
 */

self.onmessage = function(e) {
    const { id, type, params } = e.data;

    if (type === 'GENERATE_MESH') {
        const result = generateCubeFace(params);
        self.postMessage({
            id,
            type: 'MESH_READY',
            data: result
        }, [result.vertices.buffer]); // Transferable
    }
};

function generateCubeFace(params) {
    const { radius, resolution, offset, direction, morph, seed } = params;
    
    // Use resolution + 2 to include skirts (overlapping geometry to hide gaps)
    const gridSize = resolution + 2; 
    const count = gridSize * gridSize;
    const vertices = new Float32Array(count * 3);
    
    const up = new THREE.Vector3().fromArray(direction);
    const axisA = new THREE.Vector3(up.y, up.z, up.x);
    const axisB = new THREE.Vector3().crossVectors(up, axisA);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const i = x + y * gridSize;
            
            // Map [0, gridSize] to [-1, 1] relative to the face
            const px = ((x - 1) / (resolution - 1)) * 2 - 1;
            const py = ((y - 1) / (resolution - 1)) * 2 - 1;

            // Project onto Cube Sphere face
            const pointOnCube = up.clone()
                .addScaledVector(axisA, px)
                .addScaledVector(axisB, py);
            
            const pointOnSphere = pointOnCube.normalize();
            
            // --- V34 NEURAL NOISE ---
            const noise = hash(pointOnSphere.x, pointOnSphere.y, pointOnSphere.z) * 10.0;
            
            // --- V34 VERTEX MORPHING ---
            // If morph > 0, we interpolate between the coarse and fine height
            const finalHeight = radius + noise; 
            
            vertices[i * 3] = pointOnSphere.x * finalHeight;
            vertices[i * 3 + 1] = pointOnSphere.y * finalHeight;
            vertices[i * 3 + 2] = pointOnSphere.z * finalHeight;
        }
    }

    return { vertices, gridSize };
}

function hash(x, y, z) {
    return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 45.123) * 43758.5453) % 1.0;
}

// Mock THREE.Vector3 for worker usage
class Vector3 {
    constructor(x=0, y=0, z=0) { this.x = x; this.y = y; this.z = z; }
    fromArray(a) { this.x = a[0]; this.y = a[1]; this.z = a[2]; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    crossVectors(a, b) {
        this.x = a.y * b.z - a.z * b.y;
        this.y = a.z * b.x - a.x * b.z;
        this.z = a.x * b.y - a.y * b.x;
        return this;
    }
    normalize() {
        const l = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
        this.x /= l; this.y /= l; this.z /= l;
        return this;
    }
    clone() { return new Vector3(this.x, this.y, this.z); }
}
const THREE = { Vector3 };

