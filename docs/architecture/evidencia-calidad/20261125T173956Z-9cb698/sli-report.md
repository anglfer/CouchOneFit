# Informe de SLI/SLO

Periodo: 2026-11-25T17:42:31.581Z a 2026-11-25T17:43:38.838Z

Muestras: 20811 peticiones HTTP, 60 sondeos sintéticos, 3 escenarios de carga. Líneas mal formadas: 0.

## Objetivos (SLO)

| SLO | SLI | Objetivo | Valor | Muestras | Resultado |
| --- | --- | --- | --- | --- | --- |
| availability | synthetic_availability_pct | >= 99 % | 100 | 60 | cumple |
| error-rate | server_error_rate_pct | <= 0.5 % | 0 | 20811 | cumple |
| operation-success | operation_success_rate_pct | >= 99.5 % | n/d | 0 | sin datos suficientes |
| latency-p50 | latency_p50_ms | <= 300 ms | 6.8 | 20811 | cumple |
| latency-p95 | latency_p95_ms | <= 1000 ms | 13.3 | 20811 | cumple |
| latency-p99 | latency_p99_ms | <= 2000 ms | 18.7 | 20811 | cumple |
| load-throughput | load_throughput_rps | >= 5 rps | 1039.67 | 3 | cumple |
| recovery-time | recovery_time_s | <= 65 s | 5.03 | 1 | cumple |

## Por servicio

| Servicio | Peticiones | Errores 5xx % | Éxito operaciones % | p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- | --- | --- | --- |
| Catálogo de planes (plans) | 20811 | 0 | n/d | 6.8 | 13.3 | 18.7 |

## Disponibilidad sintética

| Destino | Sondeos | Disponibilidad % | Interrupciones recuperadas | Media s | Máx s | Abierta |
| --- | --- | --- | --- | --- | --- | --- |
| http://127.0.0.1:59631/api/health/ready | 60 | 100 | 1 | 5.03 | 5.03 | no |

## Carga

| Escenario | Concurrencia | Peticiones | Errores % | rps | p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| health | 15 | 24509 | 0 | 1225.23 | 9.12 | 28.25 | 54.74 |
| ready | 15 | 22732 | 0 | 1136.11 | 11.8 | 22.03 | 36.85 |
| plans | 15 | 20811 | 0 | 1039.67 | 13.16 | 24.74 | 38.63 |

La disponibilidad se observa y reporta; no constituye un SLA contractual.
