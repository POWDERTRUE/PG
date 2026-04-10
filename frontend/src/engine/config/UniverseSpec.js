const freeze = (value) => Object.freeze(value);
const degToRad = (degrees) => (degrees * Math.PI) / 180;

export const COSMIC_REALISM_REFERENCE = freeze({
    milkyWay: freeze({
        diameterLightYears: 105700,
        stellarPopulationEstimate: '100B-400B',
        baryonicMassSolarMasses: '6.0e10',
        solarOrbitPeriodMillionYears: 225
    }),
    localBubble: freeze({
        radiusLightYears: 150,
        averageStarDensityPerCubicParsec: 0.14
    }),
    observerScale: '1 unidad ~= 1 parsec abstracto optimizado para render en tiempo real'
});

export const ASTRONOMY_BODY_PROFILES = freeze({
    star: freeze({
        classification: 'G2V',
        analog: 'Sol',
        trackingSignature: 'HELIO CORE',
        hazard: 'FLARE FIELD',
        temperatureK: 5778,
        gravityG: 27.9,
        massSolar: 1,
        atmosphere: 'Plasma fotosferico'
    }),
    moon: freeze({
        classification: 'Luna orbital',
        analog: 'Europa / Luna',
        trackingSignature: 'TIDAL ECHO',
        hazard: 'TIDAL SHEAR',
        temperatureK: 120,
        gravityG: 0.16,
        massEarths: 0.0123,
        atmosphere: 'Exosfera tenue'
    }),
    satellite: freeze({
        classification: 'Satelite EVA',
        analog: 'Relay orbital',
        trackingSignature: 'SERVICE RELAY',
        hazard: 'LOW',
        temperatureK: 285,
        gravityG: 0,
        massTons: 18,
        atmosphere: 'Cabina presurizada'
    }),
    drone: freeze({
        classification: 'Dron asistente',
        analog: 'Unidad de campo',
        trackingSignature: 'ASSIST LINK',
        hazard: 'LOW',
        temperatureK: 295,
        gravityG: 0,
        massTons: 4,
        atmosphere: 'Microcabina'
    }),
    volcanic: freeze({
        classification: 'Mundo volcanico',
        analog: 'Mercurio / Io',
        trackingSignature: 'THERMAL',
        hazard: 'MAGMA',
        temperatureK: 720,
        gravityG: 0.38,
        massEarths: 0.34,
        atmosphere: 'Exosfera mineral'
    }),
    desert: freeze({
        classification: 'Mundo desertico',
        analog: 'Marte',
        trackingSignature: 'DUST',
        hazard: 'AEOLIAN',
        temperatureK: 248,
        gravityG: 0.39,
        massEarths: 0.64,
        atmosphere: 'CO2 seco'
    }),
    ocean: freeze({
        classification: 'Mundo oceanico',
        analog: 'Tierra',
        trackingSignature: 'HYDRO',
        hazard: 'STORM',
        temperatureK: 288,
        gravityG: 1,
        massEarths: 1,
        atmosphere: 'N2/O2 humedo'
    }),
    ice: freeze({
        classification: 'Mundo criogenico',
        analog: 'Europa / Encelado',
        trackingSignature: 'CRYO',
        hazard: 'ICE FRACTURE',
        temperatureK: 110,
        gravityG: 0.14,
        massEarths: 0.18,
        atmosphere: 'Vapor tenue'
    }),
    gas_giant: freeze({
        classification: 'Gigante gaseoso',
        analog: 'Saturno / Jupiter',
        trackingSignature: 'HYDROGEN',
        hazard: 'RADIATION',
        temperatureK: 140,
        gravityG: 2.4,
        massEarths: 95,
        atmosphere: 'H2 / He turbulento'
    }),
    jungle: freeze({
        classification: 'Mundo biosferico',
        analog: 'Supertierra tropical',
        trackingSignature: 'BIO',
        hazard: 'SPORE',
        temperatureK: 301,
        gravityG: 0.93,
        massEarths: 1.16,
        atmosphere: 'N2/O2 denso'
    })
});

const SOLAR_PLANETS = freeze([
    freeze({
        name: 'Terminal',
        appId: 'terminal',
        orbitRadius: 150,
        class: 'volcanic',
        moonCount: 1,
        orbitSpeed: 0.88,
        color: 0xff5522,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.volcanic,
            analog: 'Mercurio / Io',
            orbitalPeriodDays: 88
        })
    }),
    freeze({
        name: 'Explorer',
        appId: 'explorer',
        orbitRadius: 195,
        class: 'desert',
        moonCount: 2,
        orbitSpeed: 1.04,
        color: 0xcc8844,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.desert,
            analog: 'Marte',
            orbitalPeriodDays: 687
        })
    }),
    freeze({
        name: 'Gallery',
        appId: 'gallery',
        orbitRadius: 240,
        class: 'ocean',
        moonCount: 2,
        orbitSpeed: 1.18,
        color: 0x3388ff,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.ocean,
            analog: 'Tierra / Kepler-22b',
            orbitalPeriodDays: 365
        })
    }),
    freeze({
        name: 'Database',
        appId: 'database',
        orbitRadius: 285,
        class: 'ice',
        moonCount: 3,
        orbitSpeed: 1.34,
        color: 0xaaddff,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.ice,
            analog: 'Europa / Encelado',
            orbitalPeriodDays: 1200
        })
    }),
    freeze({
        name: 'Hologram',
        appId: 'hologram',
        orbitRadius: 330,
        class: 'gas_giant',
        moonCount: 5,
        orbitSpeed: 1.52,
        color: 0xffaa55,
        hasRings: true,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.gas_giant,
            analog: 'Saturno / Jupiter',
            orbitalPeriodDays: 4332
        })
    }),
    freeze({
        name: 'Settings',
        appId: 'settings',
        orbitRadius: 375,
        class: 'jungle',
        moonCount: 2,
        orbitSpeed: 1.68,
        color: 0x44bb66,
        bodyProfile: freeze({
            ...ASTRONOMY_BODY_PROFILES.jungle,
            analog: 'Supertierra tropical',
            orbitalPeriodDays: 780
        })
    })
]);

export const PHYSICS_CONSTANTS = freeze({
    G: 0.1,
    CULL_DISTANCE: 180,
    MAX_DT: 0.1
});

export const GALAXY_SPEC = freeze({
    seed: 30031993,
    unitScale: 1,
    coreRadius: 280,
    coreHeight: 40,
    bulgeRadius: 1200,
    bulgeHeight: 600,
    diskRadius: 5000,
    haloInnerRadius: 3000,
    haloRadius: 11000,
    totalDiameter: 22000,
    realReference: COSMIC_REALISM_REFERENCE,
    barLength: 1800,
    barWidth: 400,
    barAngleDeg: 25,
    barAngleRad: degToRad(25),
    armCount: 5,
    armOffsetsDeg: freeze([0, 72, 144, 216, 288]),
    armOffsetsRad: freeze([0, 72, 144, 216, 288].map(degToRad)),
    armA: 350,
    armB: 0.28,
    armThickness: 120,
    rotationSpeed: 0.000035,
    totalMainStars: 120000,
    coreStars: 12000,
    bulgeStars: 18000,
    barStars: 9000,
    armStars: 63000,
    interArmStars: 6000,
    haloStars: 12000,
    globularClusterCount: 25,
    globularStarsPerCluster: 280,
    openClusterCount: 45,
    openClusterStarsPerCluster: 120,
    nebulaCounts: freeze({
        emission: 18,
        reflection: 12,
        planetary: 8
    }),
    blackHole: freeze({
        radius: 26,
        haloRadius: 140,
        haloColor: 0xffcc88
    }),
    visibleScenario: freeze({
        namedSystems: freeze({
            count: 40,
            systemRadiusMin: 42,
            systemRadiusMax: 100,
            orbitLaneMin: 1,
            orbitLaneMax: 3,
            hitboxPadding: 54,
            verticalSpread: 14,
            armSpread: 60,
            starScaleMin: 0.6,
            starScaleMax: 1.4,
            lod: freeze({
                localEnterDistance: 1600,
                localExitDistance: 2050,
                proxyFadeStartDistance: 5200,
                proxyFadeEndDistance: 15000,
                fadeSpeed: 5.4,
            }),
        }),
        observerSystem: freeze({
            position: freeze({ x: 1600, y: 0, z: -260 }),
            planeRadius: 430,
            boundaryRadius: 470,
            haloRadius: 520,
        }),
    }),
    solarSystem: freeze({
        sun: freeze({
            radius: 40,
            color: 0xffdd88,
            emissive: 0.38,
            hitboxRadius: 300,
            bodyProfile: freeze({
                ...ASTRONOMY_BODY_PROFILES.star,
                orbitalPeriodDays: 0
            })
        }),
        planets: SOLAR_PLANETS,
        asteroidBelt: freeze({
            innerRadius: 307,
            outerRadius: 323,
            count: 2000
        })
    })
});
