export const SectorGridSpec = Object.freeze({
    WIDTH: 2000,
    HEIGHT: 600,
    DEPTH: 2000,
    LOAD_RADIUS: 2,
});

export class SectorAddress {
    static worldToSector(worldPos, targetVector, gridSpec = SectorGridSpec) {
        targetVector.x = Math.floor(worldPos.x / gridSpec.WIDTH);
        targetVector.y = Math.floor(worldPos.y / gridSpec.HEIGHT);
        targetVector.z = Math.floor(worldPos.z / gridSpec.DEPTH);
        return targetVector;
    }

    static getSectorKey(ix, iy, iz) {
        return `S[${ix},${iy},${iz}]`;
    }

    static parseSectorKey(key, targetVector) {
        if (typeof key !== 'string') {
            return null;
        }

        const match = /^S\[(-?\d+),(-?\d+),(-?\d+)\]$/.exec(key.trim());
        if (!match) {
            return null;
        }

        targetVector.x = Number(match[1]);
        targetVector.y = Number(match[2]);
        targetVector.z = Number(match[3]);
        return targetVector;
    }

    static sectorToWorldCenter(ix, iy, iz, targetVector, gridSpec = SectorGridSpec) {
        targetVector.x = (ix * gridSpec.WIDTH) + (gridSpec.WIDTH * 0.5);
        targetVector.y = (iy * gridSpec.HEIGHT) + (gridSpec.HEIGHT * 0.5);
        targetVector.z = (iz * gridSpec.DEPTH) + (gridSpec.DEPTH * 0.5);
        return targetVector;
    }
}

export default SectorAddress;
