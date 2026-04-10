export class SpatialHashGrid {
    constructor(cellSize = 100) {
        this.cellSize = cellSize;
        this.cells = new Map();
        this.objects = new Map();
    }
    _hash(x, y, z) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cy},${cz}`;
    }
    insert(client) {
        const pos = client.position;
        const hash = this._hash(pos.x, pos.y, pos.z);
        if (!this.cells.has(hash)) this.cells.set(hash, new Set());
        this.cells.get(hash).add(client);
        this.objects.set(client.uuid, { client, hash });
    }
    updateClient(client) {
        const data = this.objects.get(client.uuid);
        if (!data) return;
        const newHash = this._hash(client.position.x, client.position.y, client.position.z);
        if (newHash !== data.hash) {
            this.cells.get(data.hash).delete(client);
            if (!this.cells.has(newHash)) this.cells.set(newHash, new Set());
            this.cells.get(newHash).add(client);
            data.hash = newHash;
        }
    }
    queryNearby(position, radius) {
        const nearby = [];
        const minX = position.x - radius, maxX = position.x + radius;
        const minY = position.y - radius, maxY = position.y + radius;
        const minZ = position.z - radius, maxZ = position.z + radius;
        for (let x = minX; x <= maxX; x += this.cellSize) {
            for (let y = minY; y <= maxY; y += this.cellSize) {
                for (let z = minZ; z <= maxZ; z += this.cellSize) {
                    const hash = this._hash(x, y, z);
                    if (this.cells.has(hash)) nearby.push(...this.cells.get(hash));
                }
            }
        }
        return nearby;
    }
}
