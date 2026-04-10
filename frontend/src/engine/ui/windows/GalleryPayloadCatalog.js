export const GALLERY_IMAGE_PAYLOADS = Object.freeze([
    Object.freeze({
        id: 'ocean-memory',
        label: 'Ocean Memory',
        caption: 'Marea calmada y reflejo de archivo.',
        url: '/assets/images/payload-ocean-memory.svg',
        thumbnailUrl: '/assets/images/payload-ocean-memory.svg',
        tone: 'Aqua',
    }),
    Object.freeze({
        id: 'thermal-vein',
        label: 'Thermal Vein',
        caption: 'Corriente volcanica para superficies hostiles.',
        url: '/assets/images/payload-thermal-vein.svg',
        thumbnailUrl: '/assets/images/payload-thermal-vein.svg',
        tone: 'Magma',
    }),
    Object.freeze({
        id: 'fractal-iris',
        label: 'Fractal Iris',
        caption: 'Lectura de senal y geometria consciente.',
        url: '/assets/images/payload-fractal-iris.svg',
        thumbnailUrl: '/assets/images/payload-fractal-iris.svg',
        tone: 'Signal',
    }),
    Object.freeze({
        id: 'orbital-fabric',
        label: 'Orbital Fabric',
        caption: 'Trama orbital para mapas de estructura.',
        url: '/assets/images/payload-orbital-fabric.svg',
        thumbnailUrl: '/assets/images/payload-orbital-fabric.svg',
        tone: 'Grid',
    }),
]);

export function findGalleryPayloadIndexByUrl(url) {
    const target = typeof url === 'string' ? url.trim() : '';
    if (!target) {
        return -1;
    }

    return GALLERY_IMAGE_PAYLOADS.findIndex((payload) => payload.url === target);
}

export function getGalleryPayloadByIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= GALLERY_IMAGE_PAYLOADS.length) {
        return null;
    }
    return GALLERY_IMAGE_PAYLOADS[index];
}

