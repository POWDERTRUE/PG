/**
 * BiomeSystem.js - V22 OMEGA
 * 
 * Defines ecological and geological properties for planetary biomes.
 */
export class BiomeSystem {
    constructor() {
        this.biomes = {
            'FOREST': { primaryColor: 0x228b22, secondaryColor: 0x1a4d1a, roughness: 1.0 },
            'OCEAN':  { primaryColor: 0x0000ff, secondaryColor: 0x000080, roughness: 0.1, metalness: 0.5 },
            'DESERT': { primaryColor: 0xedc9af, secondaryColor: 0xc2b280, roughness: 1.0 },
            'MAGMA':  { primaryColor: 0xff4500, secondaryColor: 0x8b0000, roughness: 0.8 }
        };
    }

    get(name) {
        return this.biomes[name] || this.biomes['FOREST'];
    }
}

