import * as THREE from 'three';
import { resourceManager } from '../../core/ResourceManager.js';

export const DEFAULT_PROJECTION_TEXTURE_KEY = 'lulu:particle-projector:default';
export const IMAGE_PAYLOAD_TYPE = 'IMAGE';

const _bounds = new THREE.Box3();
const _boundsSize = new THREE.Vector3();

let _fallbackTexture = null;

function createProjectorCalibrationTexture() {
    const width = 256;
    const height = 128;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        const v = y / (height - 1);
        const horizon = 1 - Math.abs(v - 0.5) * 2;

        for (let x = 0; x < width; x++) {
            const u = x / (width - 1);
            const index = (y * width + x) * 4;

            const red = Math.max(0, Math.sin((u * Math.PI * 2.0) + 0.0)) * 255;
            const green = Math.max(0, Math.sin((u * Math.PI * 2.0) + 2.094)) * 255;
            const blue = Math.max(0, Math.sin((u * Math.PI * 2.0) + 4.188)) * 255;
            const scanline = 0.55 + 0.45 * Math.sin((v * Math.PI * 14.0) + (u * Math.PI * 6.0));
            const glow = 0.45 + horizon * 0.55;

            data[index] = Math.min(255, Math.round(red * scanline * glow));
            data[index + 1] = Math.min(255, Math.round(green * scanline * glow));
            data[index + 2] = Math.min(255, Math.round(blue * scanline * glow));
            data[index + 3] = Math.min(255, Math.round((80 + horizon * 175) * scanline));
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.name = 'LULU::ParticleProjectorCalibration';
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function getProjectionFallbackTexture() {
    if (_fallbackTexture) {
        return _fallbackTexture;
    }

    _fallbackTexture = resourceManager.getTexture(
        DEFAULT_PROJECTION_TEXTURE_KEY,
        () => createProjectorCalibrationTexture()
    );
    return _fallbackTexture;
}

export function normalizeProjectionImagePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const url = typeof payload.url === 'string' && payload.url.trim()
        ? payload.url.trim()
        : null;
    if (!url) {
        return null;
    }

    return {
        type: IMAGE_PAYLOAD_TYPE,
        url,
        thumbnailUrl: typeof payload.thumbnailUrl === 'string' && payload.thumbnailUrl.trim()
            ? payload.thumbnailUrl.trim()
            : url,
        label: typeof payload.label === 'string' && payload.label.trim()
            ? payload.label.trim()
            : 'Image Payload',
        source: typeof payload.source === 'string' && payload.source.trim()
            ? payload.source.trim()
            : 'runtime',
        galleryId: typeof payload.galleryId === 'string' && payload.galleryId.trim()
            ? payload.galleryId.trim()
            : null,
        meta: payload.meta && typeof payload.meta === 'object'
            ? { ...payload.meta }
            : null,
    };
}

export function resolveProjectionMesh(object) {
    if (!object) {
        return null;
    }

    let candidate = object;
    while (candidate && (candidate.userData?.isHitbox || /^Hitbox_/i.test(candidate.name || ''))) {
        candidate = candidate.parent;
    }

    if (candidate?.isMesh && !candidate.userData?.isPlanetShaderDecoration) {
        return candidate;
    }

    let resolved = null;
    candidate?.traverse?.((child) => {
        if (resolved || !child?.isMesh) {
            return;
        }
        if (
            child.userData?.isPlanetShaderDecoration ||
            child.userData?.isAtmosphere ||
            child.userData?.isCloudLayer ||
            child.userData?.isHitbox ||
            /^Hitbox_/i.test(child.name || '')
        ) {
            return;
        }
        resolved = child;
    });

    return resolved;
}

export function measureProjectionRadius(object) {
    _bounds.setFromObject(object);
    if (_bounds.isEmpty()) {
        return 4;
    }
    _bounds.getSize(_boundsSize);
    return Math.max(_boundsSize.x, _boundsSize.y, _boundsSize.z) * 0.5;
}

export function attachProjectionShell(object, {
    defaultTexture = getProjectionFallbackTexture(),
    hostMassName = null,
} = {}) {
    const mesh = resolveProjectionMesh(object);
    if (!mesh) {
        return null;
    }

    const existing = mesh.userData?.particleProjectionShell ?? null;
    if (existing) {
        existing.visible = true;
        if (hostMassName) {
            existing.userData.hostMassName = hostMassName;
        }
        return existing;
    }

    const geometry = mesh.geometry;
    const hasUv = !!geometry?.attributes?.uv;
    let shell = null;

    if (geometry && hasUv) {
        shell = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
                map: defaultTexture,
                color: 0xffffff,
                transparent: true,
                opacity: 0.78,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        shell.position.set(0, 0, 0);
        shell.quaternion.identity();
        shell.scale.setScalar(1.008);
        shell.renderOrder = 24;
        shell.frustumCulled = false;
        shell.name = `${mesh.name || 'Mass'}_particle_projection`;
        shell.userData = {
            isParticleProjectionShell: true,
            ownGeometry: false,
        };
        mesh.add(shell);
    } else {
        const radius = measureProjectionRadius(mesh);
        const fallbackGeometry = new THREE.SphereGeometry(Math.max(1, radius * 1.02), 48, 48);
        shell = new THREE.Mesh(
            fallbackGeometry,
            new THREE.MeshBasicMaterial({
                map: defaultTexture,
                transparent: true,
                opacity: 0.74,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        shell.name = `${mesh.name || 'Mass'}_particle_projection`;
        shell.userData = {
            isParticleProjectionShell: true,
            ownGeometry: true,
        };
        mesh.add(shell);
    }

    shell.userData.hostMassName = hostMassName ?? null;
    shell.userData.payloadKey = DEFAULT_PROJECTION_TEXTURE_KEY;
    shell.userData.payloadLabel = 'Calibration';
    mesh.userData = {
        ...(mesh.userData ?? {}),
        particleProjectionShell: shell,
        canProjectImage: true,
        imageProjectionCapable: true,
    };

    return shell;
}

export async function applyProjectionPayload(shell, payload, {
    defaultTexture = getProjectionFallbackTexture(),
} = {}) {
    if (!shell?.material) {
        return {
            payloadKey: DEFAULT_PROJECTION_TEXTURE_KEY,
            payloadLabel: 'Calibration',
        };
    }

    const normalizedPayload = normalizeProjectionImagePayload(payload);
    const previousKey = shell.userData?.payloadKey ?? DEFAULT_PROJECTION_TEXTURE_KEY;
    let payloadKey = DEFAULT_PROJECTION_TEXTURE_KEY;
    let texture = defaultTexture;

    if (normalizedPayload?.url && previousKey === normalizedPayload.url && shell.material.map) {
        shell.visible = true;
        return {
            payloadKey: previousKey,
            payloadLabel: shell.userData?.payloadLabel ?? normalizedPayload.label ?? 'Image Payload',
        };
    }

    if (normalizedPayload?.url) {
        payloadKey = normalizedPayload.url;
        try {
            texture = await resourceManager.load(payloadKey, 'texture');
            texture.colorSpace = THREE.SRGBColorSpace;
        } catch (error) {
            console.warn('[ProjectionShellRuntime] Failed to load payload texture, using calibration fallback.', error);
            payloadKey = DEFAULT_PROJECTION_TEXTURE_KEY;
            texture = defaultTexture;
        }
    }

    if (!shell.parent) {
        if (payloadKey !== DEFAULT_PROJECTION_TEXTURE_KEY) {
            resourceManager.release(payloadKey);
        }
        return {
            payloadKey: DEFAULT_PROJECTION_TEXTURE_KEY,
            payloadLabel: 'Calibration',
        };
    }

    if (previousKey !== DEFAULT_PROJECTION_TEXTURE_KEY && previousKey !== payloadKey) {
        resourceManager.release(previousKey);
    }

    shell.material.map = texture;
    shell.material.color.setHex(0xffffff);
    shell.material.opacity = payloadKey === DEFAULT_PROJECTION_TEXTURE_KEY ? 0.74 : 0.82;
    shell.material.needsUpdate = true;
    shell.userData.payloadKey = payloadKey;
    shell.userData.payloadLabel = normalizedPayload?.label ?? 'Calibration';
    shell.visible = true;

    return {
        payloadKey,
        payloadLabel: shell.userData.payloadLabel,
    };
}

export function disposeProjectionShell(shell) {
    if (!shell) {
        return;
    }

    const payloadKey = shell.userData?.payloadKey ?? null;
    if (shell.parent) {
        if (shell.parent.userData?.particleProjectionShell === shell) {
            delete shell.parent.userData.particleProjectionShell;
        }
        shell.parent.remove(shell);
    }

    if (shell.userData?.ownGeometry) {
        shell.geometry?.dispose?.();
    }

    shell.material?.dispose?.();
    if (payloadKey && payloadKey !== DEFAULT_PROJECTION_TEXTURE_KEY) {
        resourceManager.release(payloadKey);
    }
}
