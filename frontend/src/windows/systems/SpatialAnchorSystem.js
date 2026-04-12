// frontend/src/windows/systems/SpatialAnchorSystem.js
import * as THREE from 'three';

export class SpatialAnchorSystem {
    constructor(camera, rendererDOMElement = document.body) {
        this.camera = camera;
        this.canvas = rendererDOMElement;
        this.anchoredWindows = new Map(); // Guarda { element, targetPosition, targetObject }
        this._raf = null;
        this._projectedPosition = new THREE.Vector3();
        this.update = this.update.bind(this);
    }

    // Registra una ventana colapsada a una posición 3D
    anchorWindow(winId, domElement, worldPositionX, worldPositionY, worldPositionZ, object3D = null) {
        domElement.classList.add('is-spatially-anchored');
        this.anchoredWindows.set(winId, {
            element: domElement,
            targetPosition: new THREE.Vector3(worldPositionX, worldPositionY, worldPositionZ),
            targetObject: object3D // Track directly if object moves
        });

        // Aseguramos que el bucle esté corriendo
        if (!this._raf) {
            this._raf = requestAnimationFrame(this.update);
        }
    }

    // Libera la ventana cuando se expande
    releaseWindow(winId) {
        const win = this.anchoredWindows.get(winId);
        if (win) {
            win.element.classList.remove('is-spatially-anchored');
            win.element.style.transform = ''; // Limpiamos la transformación
            win.element.style.display = '';
            this.anchoredWindows.delete(winId);
        }

        if (this.anchoredWindows.size === 0 && this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
    }

    // Esto DEBE llamarse dentro de tu requestAnimationFrame (render loop)
    update() {
        if (!this.camera || this.anchoredWindows.size === 0) return;

        const widthHalf = this.canvas.clientWidth / 2;
        const heightHalf = this.canvas.clientHeight / 2;

        for (const [winId, { element, targetPosition, targetObject }] of this.anchoredWindows) {
            if (targetObject) {
                targetObject.getWorldPosition(targetPosition);
            }
            
            // Clonamos para no mutar la posición original del objeto
            const pos = this._projectedPosition.copy(targetPosition);
            
            // Proyectamos el punto 3D a coordenadas normalizadas del dispositivo (NDC: -1 a +1)
            pos.project(this.camera);

            // Verificamos si el objeto está detrás de la cámara
            if (pos.z > 1) {
                element.style.display = 'none';
                continue;
            }

            // Mapeamos NDC a píxeles de la pantalla
            const x = (pos.x * widthHalf) + widthHalf;
            const y = -(pos.y * heightHalf) + heightHalf;

            element.style.display = 'block';
            
            // Centramos el botón de 56x56 restando 28px (la mitad de su ancho/alto)
            // y aplicamos la posición.
            element.style.transform = `translate3d(calc(${x}px - 28px), calc(${y}px - 28px), 0)`;
        }

        // Bucle autónomo continuo mientras haya clases registradas
        if (this.anchoredWindows.size > 0) {
            this._raf = requestAnimationFrame(this.update);
        }
    }
}
