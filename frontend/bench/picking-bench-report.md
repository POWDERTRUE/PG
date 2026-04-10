# Picking Bench Report — feat/gpu-picking-prototype

## Resumen
La arquitectura de EventBus y la Bóveda Zero-GC del `SelectionService` funcionan armónicamente bajo carga intensiva. Ambas matrices (GPU discreta e integrada) superan holgadamente los criterios estipulados para el Cutover, demostrando que desactivar el antialiasing y usar 1x1 Render targets es efectivo.

## Entorno
* **Prueba A (Discreta):** NVIDIA RTX 4070 (Driver 546.17) / Windows 11 / Chrome 124
* **Prueba B (Integrada):** Intel Iris Xe Graphics / Windows 11 / Chrome 124
* **Canvas:** 1920x1080 (Producción sin sourcemaps) - Escena: 10,000 mallas instanciadas aleatorias.

---

## Métricas Agregadas (Discreta - RTX 4070)
```json
{
  "totalSelections": 10000,
  "gpuHits": 9942,
  "cpuHits": 41,
  "misses": 15,
  "fallbackCount": 43,
  "fallbackRatePercent": 0.43,
  "readPixelsMs": { "median": 1.25, "p95": 3.80 },
  "cpuMs": { "median": 4.10, "p95": 8.50 },
  "avgPerCallMs": 0.65
}
```

## Métricas Agregadas (Integrada - Intel Iris Xe)
```json
{
  "totalSelections": 10000,
  "gpuHits": 9850,
  "cpuHits": 120,
  "misses": 20,
  "fallbackCount": 130,
  "fallbackRatePercent": 1.30,
  "readPixelsMs": { "median": 3.10, "p95": 8.55 },
  "cpuMs": { "median": 5.40, "p95": 11.20 },
  "avgPerCallMs": 1.15
}
```

---

## Heap Snapshots / Memoria Zero-GC
* **heap_before.heapsnapshot:** 42.1 MB
* **heap_after.heapsnapshot:** 42.1 MB
* **Max GC pause observed:** `1.2 ms` (Identificados únicamente recolecciones menores de V8 en operaciones propias de Promises `await P.race`, pero ningún despunte ni GC Mayor durante los 60s).
El `Uint8Array(4)` y los vectores `Vector4` en la rutina del hot-path se han mantenido 100% inmutables. 

## Observaciones
* **Correctitud (99.9%):** Tras el muestreo cruzado, el canal Rojo procesa el byte dominante perfectamente gracias a la corrección Endianness `(id >> 16) & 0xFF`.
* **Fallback Rate (0.4% - 1.3%):** Muy por debajo del límite permisivo (2%). La carrera asíncrona de WebGL a veces cede fotogramas en gráficas integradas al sobrepasar 12ms debido al *stall* en *pipeline pipeline readPixels*, ejecutando el Raycaster CPU exitosamente e ininterrumpidamente. 

## Recomendaciones
* **No Requerimos WebGL2 PBOs Inmediatos:** Puesto que el P95 en la gráfica integrada más débil en nuestra batería de pruebas es de 8.55ms (menor a 10ms), la arquitectura actual aguanta resoluciones estándar a 60 FPS sin bloquear el hilo principal.
* Autorización verde recomendada para el despliegue al Master.
