/**
 * terrain.worker.js
 * OMEGA V31 — Web Worker de generación de Simplex Noise 3D
 * 
 * Recibe coordenadas por postMessage, genera heightmap y devuelve
 * ArrayBuffer via transferencia de titularidad (zero-copy).
 */

// Simplex Noise 3D embebido (sin dependencias externas para el Worker)
// Referencia: Stefan Gustavson (2012) — dominio público
const _p = [];
const _perm = new Uint8Array(512);
const _permMod12 = new Uint8Array(512);

(function initPermTable() {
    const seed = new Uint8Array(256);
    for (let i = 0; i < 256; i++) seed[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.round(Math.random() * i);
        [seed[i], seed[j]] = [seed[j], seed[i]];
    }
    for (let i = 0; i < 512; i++) {
        _perm[i] = seed[i & 255];
        _permMod12[i] = _perm[i] % 12;
    }
})();

const grad3 = new Float32Array([
    1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
    1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
    0,1,1,  0,-1,1, 0,1,-1,  0,-1,-1
]);

function dot3(gi, x, y, z) {
    const i = gi * 3;
    return grad3[i] * x + grad3[i+1] * y + grad3[i+2] * z;
}

function simplex3(xin, yin, zin) {
    const F3 = 1/3, G3 = 1/6;
    const s = (xin+yin+zin)*F3;
    const i = Math.floor(xin+s), j = Math.floor(yin+s), k = Math.floor(zin+s);
    const t = (i+j+k)*G3;
    const X0=i-t, Y0=j-t, Z0=k-t;
    const x0=xin-X0, y0=yin-Y0, z0=zin-Z0;
    let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1}}else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0}}
    const x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
    const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
    const x3=x0-1+3*G3, y3=y0-1+3*G3, z3=z0-1+3*G3;
    const ii=i&255, jj=j&255, kk=k&255;
    let n0,n1,n2,n3;
    let t0=0.6-x0*x0-y0*y0-z0*z0; n0=t0<0?0:(t0*=t0,t0*t0*dot3(_permMod12[ii+_perm[jj+_perm[kk]]],x0,y0,z0));
    let t1=0.6-x1*x1-y1*y1-z1*z1; n1=t1<0?0:(t1*=t1,t1*t1*dot3(_permMod12[ii+i1+_perm[jj+j1+_perm[kk+k1]]],x1,y1,z1));
    let t2=0.6-x2*x2-y2*y2-z2*z2; n2=t2<0?0:(t2*=t2,t2*t2*dot3(_permMod12[ii+i2+_perm[jj+j2+_perm[kk+k2]]],x2,y2,z2));
    let t3=0.6-x3*x3-y3*y3-z3*z3; n3=t3<0?0:(t3*=t3,t3*t3*dot3(_permMod12[ii+1+_perm[jj+1+_perm[kk+1]]],x3,y3,z3));
    return 32*(n0+n1+n2+n3);
}

// ─── Handler de mensajes desde WorkerPool ────────────────────────────────────
self.onmessage = function(e) {
    const { chunkId, positions, resolution, radius, amplitude, octaves, frequency } = e.data;

    // positions es un ArrayBuffer transferido (zero-copy desde el pool)
    const verts = new Float32Array(positions);
    const count = verts.length / 3;

    // Aplicar desplazamiento de altura sobre la esfera (fractal Brownian Motion)
    for (let i = 0; i < count; i++) {
        const vIdx = i * 3;
        const nx = verts[vIdx], ny = verts[vIdx + 1], nz = verts[vIdx + 2];

        // Normalizar posición para coordenadas de ruido
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        const invLen = 1/len;
        const sx = nx * invLen, sy = ny * invLen, sz = nz * invLen;

        // fBm — suma de octavas
        let height = 0, amp = 1, freq = frequency || 1;
        for (let o = 0; o < (octaves || 6); o++) {
            height += simplex3(sx*freq, sy*freq, sz*freq) * amp;
            amp *= 0.5; freq *= 2;
        }

        // Desplazar vértice radialmente
        const displacement = height * (amplitude || 100);
        verts[vIdx]     = nx + sx * displacement;
        verts[vIdx + 1] = ny + sy * displacement;
        verts[vIdx + 2] = nz + sz * displacement;
    }

    // Transferir de vuelta el buffer (zero-copy — el Worker cede titularidad)
    self.postMessage({ chunkId, positions: verts.buffer }, [verts.buffer]);
};
