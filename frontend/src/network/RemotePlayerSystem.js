import * as THREE from 'three';
import { Registry } from '../engine/core/ServiceRegistry.js';

/**
 * RemotePlayerSystem
 * Renders remote player proxies from NETWORK_TRANSFORM_UPDATE packets.
 */
export class RemotePlayerSystem {
    constructor(sceneGraph) {
        this.sceneGraph = sceneGraph;
        this.players = new Map();
        this.events = Registry.get('events');
        this.socketSystem = Registry.tryGet('socket');
        this.localClientId = this.socketSystem?.clientId ?? null;
        this.onSocketMessage = this.onSocketMessage.bind(this);
        this.unsubscribeMessage = null;

        this._tmpHermiteA = new THREE.Vector3();
        this._tmpHermiteB = new THREE.Vector3();
        this._tmpHermiteC = new THREE.Vector3();
        this._tmpDelta = new THREE.Vector3();

        if (this.socketSystem?.addMessageListener) {
            this.unsubscribeMessage = this.socketSystem.addMessageListener(this.onSocketMessage);
        }
        this.events?.on('network:remote_transform', this.onSocketMessage);
    }

    onSocketMessage(data) {
        if (!data || data.type !== 'NETWORK_TRANSFORM_UPDATE') return;
        if (!data.clientId || data.clientId === this.localClientId) return;
        this.handleRemoteTransform(data.clientId, data.payload || {});
    }

    handleRemoteTransform(clientId, payload) {
        if (!Array.isArray(payload.position) || !Array.isArray(payload.quaternion)) {
            return;
        }

        const now = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now();

        if (!this.players.has(clientId)) {
            const geometry = new THREE.CylinderGeometry(0, 10, 30, 4, 1);
            geometry.rotateX(Math.PI / 2);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
            const mesh = new THREE.Mesh(geometry, material);

            const light = new THREE.PointLight(0x00ffcc, 10, 500);
            mesh.add(light);

            const entityLayer = this.sceneGraph?.layers?.entities ?? this.sceneGraph?.scene ?? null;
            if (!entityLayer?.add) {
                console.warn('[MMO] Remote player spawn skipped: entity layer unavailable.');
                return;
            }
            entityLayer.add(mesh);

            const initialPos = new THREE.Vector3().fromArray(payload.position);
            const initialQuat = new THREE.Quaternion().fromArray(payload.quaternion);

            this.players.set(clientId, {
                mesh,
                prevPos: initialPos.clone(),
                currPos: initialPos.clone(),
                prevQuat: initialQuat.clone(),
                currQuat: initialQuat.clone(),
                prevVelocity: new THREE.Vector3(0, 0, 0),
                currVelocity: new THREE.Vector3(0, 0, 0),
                prevTime: now,
                currTime: now,
                predictedPos: initialPos.clone(),
            });
            console.log(`[MMO] Spawned remote pilot: ${clientId}`);
        }

        const playerData = this.players.get(clientId);
        if (!playerData) return;

        if (playerData.currTime && playerData.currTime !== playerData.prevTime) {
            playerData.prevPos.copy(playerData.currPos);
            playerData.prevQuat.copy(playerData.currQuat);
            playerData.prevVelocity.copy(playerData.currVelocity);
            playerData.prevTime = playerData.currTime;
        } else {
            playerData.prevPos.copy(playerData.currPos);
            playerData.prevQuat.copy(playerData.currQuat);
            playerData.prevVelocity.set(0, 0, 0);
            playerData.prevTime = now;
        }

        playerData.currPos.fromArray(payload.position);
        playerData.currQuat.fromArray(payload.quaternion);
        playerData.currTime = now;

        if (Array.isArray(payload.velocity) && payload.velocity.length === 3) {
            playerData.currVelocity.fromArray(payload.velocity);
        } else if (playerData.currTime !== playerData.prevTime) {
            const elapsedSeconds = Math.max((playerData.currTime - playerData.prevTime) * 0.001, 0.001);
            playerData.currVelocity.copy(playerData.currPos)
                .sub(playerData.prevPos)
                .divideScalar(elapsedSeconds);
        } else {
            playerData.currVelocity.set(0, 0, 0);
        }
    }

    update(delta) {
        const now = Date.now();

        this.players.forEach((playerData) => {
            if (!playerData.mesh) return;

            const dtMs = Math.max(playerData.currTime - playerData.prevTime, 0);
            if (dtMs < 1) {
                playerData.mesh.position.lerp(playerData.currPos, Math.min(delta * 15, 1));
                playerData.mesh.quaternion.slerp(playerData.currQuat, Math.min(delta * 15, 1));
                return;
            }

            const elapsedMs = now - playerData.prevTime;
            const tRaw = elapsedMs / dtMs;
            const t = Math.min(Math.max(tRaw, 0), 1.4);
            const dtSec = Math.max(dtMs * 0.001, 0.001);

            this._tmpHermiteA.copy(playerData.prevVelocity).multiplyScalar(dtSec);
            this._tmpHermiteB.copy(playerData.currVelocity).multiplyScalar(dtSec);

            this._applyHermitePosition(
                playerData.prevPos,
                playerData.currPos,
                this._tmpHermiteA,
                this._tmpHermiteB,
                t,
                playerData.predictedPos
            );

            playerData.mesh.position.copy(playerData.predictedPos);

            const rotationBlend = Math.min(delta * 15, 1);
            playerData.mesh.quaternion.slerp(playerData.currQuat, rotationBlend);
        });
    }

    _applyHermitePosition(p0, p1, m0, m1, t, out) {
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        out.copy(p0).multiplyScalar(h00)
            .add(this._tmpDelta.copy(p1).multiplyScalar(h01))
            .add(this._tmpHermiteA.copy(m0).multiplyScalar(h10))
            .add(this._tmpHermiteB.copy(m1).multiplyScalar(h11));
        return out;
    }

    dispose() {
        if (this.unsubscribeMessage) {
            this.unsubscribeMessage();
            this.unsubscribeMessage = null;
        }
        this.events?.removeListener?.('network:remote_transform', this.onSocketMessage);
        this.players.forEach((playerData) => {
            playerData.mesh?.removeFromParent?.();
            playerData.mesh?.geometry?.dispose?.();
            playerData.mesh?.material?.dispose?.();
        });
        this.players.clear();
    }
}
