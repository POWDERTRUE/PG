// frontend/src/engine/planet/workers/TerrainWorker.js
// Workers de tipo 'module' soportan import estático en Vite/ESBuild
import { hash3D, fade, lerp, noise3D, fbm3D, mapCubeToSphere, evaluateTerrain } from '../PlanetMathUtils.js';

// --- COMUNICACIÓN CON EL MAIN THREAD ---
self.onmessage = function(e) {
    if (e.data && e.data.recycledArray) {
        // El hilo principal devuelve arrays reciclados al worker.
        // No hay nada más que procesar en este mensaje.
        return;
    }

    const {
        chunkId,
        positions,
        normals,
        faceNormal,
        offset,
        quadSize,
        planetRadius,
        vertexCount
    } = e.data || {};

    if (!faceNormal || !offset || !quadSize || !planetRadius || !vertexCount || !positions) {
        console.error('[TerrainWorker] Invalid message payload', e.data);
        return;
    }

    // Parámetros de la cara (eje local)
    const axisA0 = faceNormal.y;
    const axisA1 = faceNormal.z;
    const axisA2 = faceNormal.x;
    const axisB0 = faceNormal.z;
    const axisB1 = faceNormal.x;
    const axisB2 = faceNormal.y;

    // Asumimos un grid de 64x64 segmentos pre-alocado (65x65 vértices)
    // Ajusta esto si cambias la resolución en TerrainChunkPool
    const segments = Math.sqrt(vertexCount) - 1; 

    // Profundidad de la falda: usar un valor de proporción pequeña y fija relativa al radio
    // CRITICAL FIX: La fórmula anterior (quadSize * planetRadius * 0.15) en LOD 0
    // genera skirtDepth = 2.0 * 1000 * 0.15 = 300 unidades, demasiado agresivo.
    // Usamos una fracción pequeña del radio dividida entre el nivel LOD para escalar bien.
    const skirtDepth = planetRadius * 0.003;

    for (let i = 0; i < vertexCount; i++) {
        const pIdx = i * 3;
        
        // Coordenadas topológicas en la matriz
        const col = i % (segments + 1);
        const row = Math.floor(i / (segments + 1));

        // ¿Es este vértice el anillo exterior perimetral?
        const isSkirt = (col === 0 || col === segments || row === 0 || row === segments);

        // Clampear para que el borde (falda) comparta UVs con la superficie
        const clampedCol = Math.max(1, Math.min(segments - 1, col));
        const clampedRow = Math.max(1, Math.min(segments - 1, row));

        // Normalizar de 1...(segments-1) a un rango de 0.0 a 1.0
        const u_norm = (clampedCol - 1) / (segments - 2);
        const v_norm = (clampedRow - 1) / (segments - 2);

        // Mapear al dominio local del QuadTree [-1, 1]
        const u = (u_norm * 2.0) - 1.0;
        const v = (v_norm * 2.0) - 1.0;

        // Posición real en el plano de la cara (u, v van de -1 a 1, así que el multiplicador es el half-size)
        const localX = offset.x + (u * (quadSize / 2.0));
        const localY = offset.y + (v * (quadSize / 2.0));

        // Convertir a posición cúbica 3D (-1 a 1)
        const cx = faceNormal.x + (localX * axisA0) + (localY * axisB0);
        const cy = faceNormal.y + (localX * axisA1) + (localY * axisB1);
        const cz = faceNormal.z + (localX * axisA2) + (localY * axisB2);

        // Proyección a Esfera Tangente (Nowell)
        // CRITICAL FIX: Clampar al rango [-1, 1] ANTES de la proyección.
        // Si los valores de cx/cy/cz superan 1.0  por errores de offset acumulados,
        // la fórmula sqrt(1.0 - y2*0.5 - z2*0.5 + ...) produce un valor negativo
        // bajo la raíz cuadrada, generando NaN en toda la malla.
        const ccx = Math.max(-1.0, Math.min(1.0, cx));
        const ccy = Math.max(-1.0, Math.min(1.0, cy));
        const ccz = Math.max(-1.0, Math.min(1.0, cz));
        const spherePoint = mapCubeToSphere(ccx, ccy, ccz);
        
        // Calcular elevación base
        let elevation = evaluateTerrain(spherePoint.x, spherePoint.y, spherePoint.z, planetRadius);
        
        // ¡Magia Topológica! Si es el borde, hundimos el vértice hacia el núcleo
        if (isSkirt) {
            elevation -= skirtDepth;
        }

        // Guard NaN: si la elevación resultó corrupta, usar el radio base
        if (!isFinite(elevation)) elevation = planetRadius;

        // Asignar nuevas coordenadas al ArrayBuffer
        positions[pIdx]   = spherePoint.x * elevation;
        positions[pIdx+1] = spherePoint.y * elevation;
        positions[pIdx+2] = spherePoint.z * elevation;
    }
    // Calcular Normales por Diferencia Finita (Flat Shading rápido)
    if (normals) {
        for (let i = 0; i < vertexCount; i += 3) {
            const p1 = i * 3; const p2 = (i+1) * 3; const p3 = (i+2) * 3;
            
            // Vector U = P2 - P1
            const ux = positions[p2] - positions[p1];
            const uy = positions[p2+1] - positions[p1+1];
            const uz = positions[p2+2] - positions[p1+2];
            
            // Vector V = P3 - P1
            const vx = positions[p3] - positions[p1];
            const vy = positions[p3+1] - positions[p1+1];
            const vz = positions[p3+2] - positions[p1+2];
            
            // Cross Product (Nx, Ny, Nz)
            let nx = uy * vz - uz * vy;
            let ny = uz * vx - ux * vz;
            let nz = ux * vy - uy * vx;
            
            // Normalizar
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) {
                nx /= len; ny /= len; nz /= len;
            } else {
                nx = 0; ny = 1; nz = 0;
            }
            
            // Asignar normal a los 3 vértices del triángulo (Si asume draw no indexado)
            // IMPORTANTE: PlaneGeometry por defecto usa BufferGeometry Indexado
            // Si es indexado esta computación de normales es aproximada a per-vertex, necesitamos 'computeVertexNormals'
            normals[p1] = nx; normals[p1+1] = ny; normals[p1+2] = nz;
            if (p2 < vertexCount * 3) { normals[p2] = nx; normals[p2+1] = ny; normals[p2+2] = nz; }
            if (p3 < vertexCount * 3) { normals[p3] = nx; normals[p3+1] = ny; normals[p3+2] = nz; }
        }
    }

    // TRANSFERIR de vuelta sin copiar memoria (Zero-GC)
    self.postMessage({ chunkId, positions, normals }, [positions.buffer, normals ? normals.buffer : null].filter(Boolean));
};
