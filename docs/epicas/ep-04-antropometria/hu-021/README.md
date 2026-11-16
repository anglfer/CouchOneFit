> **Estado de prepublicación:** integración local verificada y revisión visual/funcional **7/7 reportada y aprobada por el usuario** (no automatizada). Lista para revisión independiente con observaciones: hay discrepancias OpenAPI/validador pendientes de corrección autorizada y no se declara validación semántica completa. D0, coordinación y gates Render/Vercel pendientes; sin autorización de publicación. [Guía integral](COUCHONEFIT_HU021_HANDOFF.md) · [Matriz, inventario, commits propuestos y borrador PR](revision-final.md#prepublicación-final--revisión-del-contrato-inventario-y-propuesta-no-ejecutada).

> **Ampliación vigente autorizada por Pukzil:** HU-021 evoluciona a «Registrar y evaluar composición corporal multimétodo fechada». Ver [contrato, compatibilidad, migración y gates](multimethod.md). El texto siguiente conserva el alcance anterior como referencia histórica; no limita la nueva entrega. Navy/JP3 continúan deshabilitados hasta cotejo documental.

# HU-021 — Registro de evaluaciones antropométricas

Implementación local de HU-021 conforme a `plan/PLAN_TRABAJO_V2.md` (HU-021 y tareas BD1/API1/WEB1/QA1), RDF0501–RDF0503 y DEC-006. No incluye cálculo estimado de grasa (HU-023), evolución (HU-022), edición/eliminación ni cambios móviles.

## Estado y decisiones

La entrega habilita persistencia append-only, alta/listado HTTP, composición del expediente profesional y formulario web. La asignación de fecha UTC al aceptar la solicitud, la captura offline con fecha asignada al sincronizar, el límite de 20 elementos enviados por lectura del expediente, los cinco pliegues manuales y la prohibición de alta en expedientes inactivos son decisiones provisionales de implementación indicadas por Pukzil; requieren aceptación funcional del Product Owner. El listado histórico almacena más datos que los que devuelve cada vista.

## Datos

Todos los campos de medición son opcionales individualmente; una evaluación requiere al menos uno. Se omiten del request los campos vacíos y el DTO de respuesta los muestra como `null`:

| Campo | Unidad | Rango | Precisión |
| --- | --- | ---: | ---: |
| `weightKg` | kg | 30–300 | 0.1 |
| `waistCm` | cm | 40–250 | 0.1 |
| `hipCm` | cm | 50–250 | 0.1 |
| `measuredBodyFatPercentage` | % medido | 2–60 | 0.1 |
| `pectoralSkinfoldMm`, `abdominalSkinfoldMm`, `tricepsSkinfoldMm`, `suprailiacSkinfoldMm`, `thighSkinfoldMm` | mm | 1–80 cada uno | 0.1 |

La estatura y toda fecha, identidad de profesional o asociación cliente enviada en el body se rechazan. La BD asigna `evaluation_date` con la fecha UTC del servidor. Varias evaluaciones pueden compartir cliente y fecha. Cada evaluación es una fila independiente; no hay UPDATE/DELETE habilitados para el rol runtime.

## API

- `POST /api/clients/{clientId}/evaluations`: body con uno o más campos de medición; responde `201 { "evaluation": Evaluation }`.
- `GET /api/clients/{clientId}/evaluations`: responde `200 { "evaluations": Evaluation[] }`, máximo 20 recientes.
- `GET /api/clients/{clientId}/record`: integra evaluaciones en `sections.evaluations`, como `empty`, `available` con `evaluations`, o `error` con `QUERY_FAILED`.

Las rutas requieren sesión profesional. El POST además requiere CSRF en sesión Web y acepta `Idempotency-Key` para reintentos de la PWA. La identidad profesional sale de la sesión; se comprueba propiedad y estado activo para alta. El historial puede leerse para el profesional propietario aunque el expediente esté inactivo, de acuerdo con el contrato de cartera. Respuestas con sesión llevan `Cache-Control: no-store` en HTTP; el cliente Web puede conservar el expediente previamente consultado en la caché local cifrada y ligada a la cuenta, según DEC-018.

## Offline

La Web envía primero con una clave idempotente. Si la solicitud no llega, el mismo payload se guarda cifrado en el outbox de la cuenta y se reintenta usando el mismo ID como `Idempotency-Key`. Se presenta como pendiente, no como evaluación confirmada. La fecha oficial y la aparición en el historial llegan después de que el servidor acepte y responda; un 401 conserva la operación según el motor común de sincronización, y otros rechazos del servidor siguen su clasificación existente.

## Verificación

Pruebas relevantes: `apps/api/tests/evaluations.test.ts`, `apps/api/tests/client-read-isolation.test.ts`, `apps/api/tests/migrations.test.ts`, `apps/web/tests/session-recovery.test.mjs` y la suite Web offline. Las suites de API que crean bases y roles temporales necesitan una conexión local de pruebas cuyo rol esté autorizado para esa preparación; no se debe conceder esos permisos al rol runtime de la aplicación. No se afirma revisión visual humana hasta que el equipo pruebe el flujo en navegador.
