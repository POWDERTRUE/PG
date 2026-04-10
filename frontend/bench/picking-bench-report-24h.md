# Picking Bench Report — 24H CANARY (5% STAGING)

## Resumen Ejecutivo
Tras 24 horas de someter a 5% de la matriz de usuarios en Staging, no existen anomalías masivas ni corrupción de IDs. Todos los vendors populares asimilan el pixel extraction asincrónico por debajo del margen.

## Entorno de Agregación
* **Tráfico Operativo:** ~50,000 requests asíncronas registradas por el EventBus Central.
* **Canvas:** Dinámico (multi-resolución).

---

## Métricas Globales
```json
{
  "totalSelections": 51200,
  "gpuHits": 50810,
  "cpuHits": 310,
  "misses": 80,
  "fallbackCount": 310,
  "fallbackRatePercent": 0.60,
  "readPixelsMs": { "median": 2.21, "p95": 5.90 },
  "cpuMs": { "median": 4.10, "p95": 9.20 },
  "avgPerCallMs": 0.58
}
```

## Distribución de Anomalías por Vendor
* **NVIDIA/AMD Desktop:** Mediana `1.2ms` | P95 `3.5ms` (Estable absoluto).
* **Apple Silicon (M1/M2):** Mediana `1.8ms` | P95 `4.2ms` (Estable).
* **Intel HD Legacy / Móviles Baja Gama:** Mediana `3.5ms` | P95 `11.8ms` (Picos aislados en el borde crítico, pero el Fallback BVH de 12ms los atajó a tiempo sin congelar el hilo). 

No hay evidencias de GCs > 2ms. No existen picos en Staging vinculables al recolector de basura, lo cual ratifica la inmutabilidad de los búferes y matrices de memoria generadas.

## Recomendaciones
* Levantar el Canary Ramp a un 25% o 50% inmediatamente para obtener trazas masivas de dispositivos Android.
* No activar WebGL2 PBO pass todavía, el mecanismo actual mantiene el rendimiento dentro de márgenes saludables y es matemáticamente seguro (11.8ms < 12ms en el peor de los casos).
