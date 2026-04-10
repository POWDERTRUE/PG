# PBO Async Readback (WebGL2 Ping-Pong)

La FASE A del Sprint aborda directamente los atascos de hardware en gráficas heredadas mediante la desactivación de bloqueos de tubería WebGL (`readPixels`).

## Feature Flagging en Cliente
Por defecto el orquestador (`SelectionService.js`) detectará internamente el Contexto WebGL. Si el cliente arranca sobre `WebGL1`, el adaptador PBO jamás será provisionado y caerá bajo Gracia Degradada (Graceful Degradation) hacia el `GPUPickingAdapter` asincróno (de bloqueo de RAM).
Puede desactivarse forzosamente seteando: `SelectionService.config.enablePBO = false`.

## Arquitectura de Estado
*   **Double Buffer (Ping-Pong):** Poseemos un array de 2 Buffers `[A, B]` intercambiados cíclicamente `(this._ping + 1) % 2`. Uno es rellenado por WebGL con la data (`render pass`), otro es sub-estraído al Javascript V8 de RAM hacia el Motor OMEGA de colisiones.
*   **Restauración de ThreeJS:** Todas las asignaciones al contexto `gl` (como `PIXEL_PACK_BUFFER`) garantizan una retención de estado antes de la inyección de `fenceSync` y una recomposición después para no despistar a la maquinaria original de WebGLRenderer de Three.

## Tolerancias
> [!CAUTION] Retraso Controlado (Frame Delay)
> La solicitud táctica del Puntero no se entrega en el mismo Fotograma en el que se gatilló. Retornará 16 a 40 milisegundos más tarde y el hilo de la Interfaz *no debe* asumir inmediatez síncrona. Use notificaciones "Predictivas" previas al rebote de confirmación.
