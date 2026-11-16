# CouchOne Fit — guía integral de entrega EP-04 / HU-021

> **Estado vigente: 10-nov-2026 (horas técnicas en UTC).** Documento versionable de transferencia; no acredita publicación ni aceptación D0. Distingue **T** (herramienta/prueba ejecutada), **E** (inspección estática), **R** (reporte humano), decisiones autorizadas y pendientes.
>
> **Integración local completada y verificada técnicamente:** respaldo restaurado en la única base temporal autorizada y temporal eliminada; dos migraciones aplicadas en desarrollo (29 totales), datos anteriores conservados y tres métodos probados por HTTP con QA. Revisión manual reportada por usuario 7/7 aprobada; discrepancias contractuales OAS-01–06 corregidas (ver §O). Revisión independiente y aprobación contractual integral pendientes. No equivale a aceptación D0 ni publicación. Ver evidencia final §M y pendientes §L.

## A. Información general y procedencia

| Dato | Estado confirmado |
| --- | --- |
| Proyecto | CouchOne Fit, monorepositorio SaaS de entrenamiento y nutrición |
| Épica / historia | EP-04 / HU-021 — Registrar una evaluación antropométrica fechada |
| Responsable | Itzel Yutzil Sánchez López, Pukzil |
| Objetivo original | Como profesional, registrar peso, medidas y pliegues utilizados para conservar una evaluación del cliente en una fecha |
| Dependencias | HU-015, HU-017, TT-010 y DEC-006; referencias RDF0501/0502/0503 |
| Dependientes | HU-022 y HU-023, sin implementarlas como parte del cierre original |
| Rama | feature/ep04-antropometria |
| HEAD | 33110ea7e6706842fb7ee7ad9aee76834fa1138e |
| Git | Cambios locales sin commit; índice vacío; no publicación autorizada |
| Implementación | BD/API/Web multimétodo integradas localmente; pruebas aisladas y smoke HTTP QA aprobados; visual R 7/7 aprobada; independiente/contrato pendientes |

Se localizó y leyó completo el original externo `COUCHONEFIT_HU021_HANDOFF.md` del directorio padre (275 líneas, 21592 bytes). Su SHA-256 es `df9c0ab5e5265d142d7dbeff6e349d921be75586a4feb82e36247e6e3324d4e0`. **El original se conserva sin cambios.** Esta copia reorganiza y actualiza su información útil; no vuelve vigentes las instrucciones históricas del 9/nov (diálogo/modal, suite 76/76 y bloqueo inicial de RLS). No hay otra copia versionable adicional.

Fuentes actuales: [README de la HU](README.md), [contrato multimétodo](multimethod.md), [evidencia cronológica](validacion-local.md), [auditoría/manifiesto](revision-final.md), AGENTS.md, DEVELOPMENT.md, CONTRIBUTING.md, docs/database/convenciones.md y README.md, plan/PLAN_TRABAJO_V2.md (HU-021, DEC-006/007/018, D0 §5.2), RDF0501–0503 y contrato HU-019. El código acredita comportamiento implementado; un documento/plan no acredita despliegue. Codebase Memory MCP no disponible: se usaron lecturas y AST local.

## B. Historia oficial, cumplimiento y alcance

### Criterios de aceptación y evidencia

| Criterio original | Implementación | Evidencia real | Estado |
| --- | --- | --- | --- |
| Fecha servidor y asociación correcta | Defaults SQL, identidad de sesión, comprobación de cartera, snapshot ownerId | Pruebas HTTP/SQL de client-read-isolation aprobadas en PG17 temporal | Cumple en entorno aislado y en HTTP QA de desarrollo |
| Opcionales sin valores inventados | DTO legado null; snapshot omite medidas ausentes | Unitarias y HTTP aprobadas; omisiones no se convierten en cero | Cumple en pruebas y R 7/7; contrato OpenAPI requiere corrección |
| Rechazo de medidas/pliegues inválidos | Validators, CHECK originales y migración 29 de snapshot | Fronteras/precisión/mezcla/campos desconocidos, HTTP y SQL bajo runtime | Cumple en entorno aislado |
| Nueva evaluación conserva anteriores | INSERT independiente, FK RESTRICT, sin UPDATE/DELETE runtime | Historial completo idéntico tras edición base e inactivación/reactivación; upgrade conserva fila | Cumple en entorno aislado |
| Otro profesional no escribe/lee clientes ajenos | Middleware, propietario y RLS | Dos carteras y runtime sin BYPASSRLS; 404/403 según contrato | Cumple en entorno aislado |

### Tareas y DoD

- **BD1:** tabla fechada, unidades, precisión, relación no destructiva y evolución incremental implementadas; instalación limpia/actualización verificadas. Aplicadas y verificadas 29 migraciones en desarrollo; datos anteriores conservados.
- **API1:** POST/GET, DTO, validación, fechas, autorización, lectura integrada y compatibilidad implementados y probados con PG temporal y HTTP real en desarrollo.
- **WEB1:** formulario real e historial en la pestaña Evaluación, con suite Web aprobada; guardado multimétodo confirmado por HTTP en desarrollo; revisión visual de esta versión reportada y aprobada por usuario 7/7, sin ejecución automática.
- **QA1:** 39/39 de las dos suites PostgreSQL autorizadas, unitarias 21/21 y Web 94/94. No equivale a suite API completa ni a aceptación humana.
- **D0:** parcial. Revisión humana actual R 7/7 aprobada; faltan corrección contractual y revisión independiente (plan §5.2.8). No basta compilar ni aprobar tests con dobles.

El alcance adicional autorizado incluye Perímetros, Pliegues, Bioimpedancia, snapshot de composición, cálculos aritméticos, guías y visualizaciones. Navy y Jackson-Pollock/Siri siguen deshabilitados por gate documental; **no son necesarios para cerrar el registro original**, pero no deben anunciarse como disponibles. No se implementan HU-022, nutrición ni Flutter.

## C. Arquitectura y recorrido

```text
Web/PWA (React 19, Vite, TS, Tailwind 4; :5000)
  → sesión/cookies HttpOnly + CSRF, servicios comunes
  → /api por proxy Vite a Express (:3000)
  → routes → controllers → services → validators / repositories
  → transacción pg parametrizada, sujeto autenticado y propiedad
  → PostgreSQL 17 (:5433), private.clients / private.client_evaluations + RLS
  ← DTO, resultado definitivo y lectura del expediente

Sin conexión / confirmación incierta
  → outbox existente cifrada y ligada a cuenta, mismo Idempotency-Key
  → sincronización común → misma API → historial confirmado tras aceptación
```

La API usa `pg` directamente. Supabase es la plataforma remota existente; este flujo no introduce Supabase Auth ni SDK. Identidad y sesiones pertenecen a la API. Móvil Flutter solo para cliente final, sin cambios de HU-021.

El expediente conserva un solo cliente: clientId procede de la ruta, no de un campo editable. La identidad profesional procede de la sesión, nunca del body. La API une clients.professional_id con professionals.user_id y usa contexto transaccional confiable; RLS es defensa adicional. La elegibilidad reutiliza training_professional; expediente inactivo no equivale a cuenta dada de baja. Solo se permite alta en expediente activo; historial autorizado sigue consultable en inactivo, sujeto a elegibilidad existente.

## D. Inventario completo de implementación e integración

**M:** modificado respecto a HEAD. **N:** nuevo/sin seguimiento. El estado es local, no evidencia publicación. Rutas abreviadas en la columna de relaciones se resuelven en su feature/app; la primera columna siempre es exacta desde la raíz. Se incluyen cambios compartidos para no publicar un módulo desconectado.

| Ruta exacta | Archivo | Estado | Qué hace | Por qué se creó/modificó | Relación principal |
| --- | --- | --- | --- | --- | --- |
| `.gitignore` | `.gitignore` | M | Ignora únicamente la caché raíz /.vite/ | Evitar publicar artefactos sin borrarlos | Vite; .vite/deps_temp_d6f12e9a/package.json |
| `apps/api/src/app.ts` | `app.ts` | M | Importa y monta evaluationRoutes | Exponer endpoints de la feature sin cambiar middleware ajeno | evaluations/routes/evaluations.ts |
| `apps/api/src/features/evaluations/controllers/evaluation.ts` | `evaluation.ts` | N | Adapta params/body/query a servicio y respuestas HTTP | Implementar capa propia de EP-04 sin duplicar infraestructura | routes/evaluations.ts; services/evaluation.ts |
| `apps/api/src/features/evaluations/domain/assessment.ts` | `assessment.ts` | N | Funciones puras versionadas de edad e ICC/ICE/composición disponible | Implementar capa propia de EP-04 sin duplicar infraestructura | validators/assessment.ts; repositories/evaluation.ts; tests/assessment.test.ts |
| `apps/api/src/features/evaluations/repositories/evaluation.ts` | `evaluation.ts` | N | SQL parametrizado, contexto/propiedad, snapshot, INSERT y páginas | Implementar capa propia de EP-04 sin duplicar infraestructura | auth/repositories/lifecycle.ts; private.client_evaluations |
| `apps/api/src/features/evaluations/routes/evaluations.ts` | `evaluations.ts` | N | Declara GET/POST, autenticación, CSRF e idempotencia | Implementar capa propia de EP-04 sin duplicar infraestructura | apps/api/src/app.ts; controllers/evaluation.ts |
| `apps/api/src/features/evaluations/services/evaluation.ts` | `evaluation.ts` | N | Invoca validadores, selecciona DTO y coordina alta/listado | Implementar capa propia de EP-04 sin duplicar infraestructura | validators/; repositories/evaluation.ts |
| `apps/api/src/features/evaluations/types/evaluation.ts` | `evaluation.ts` | N | Define campos y DTO Evaluation | Implementar capa propia de EP-04 sin duplicar infraestructura | repositories/evaluation.ts; professional/types/record.ts |
| `apps/api/src/features/evaluations/validators/assessment.ts` | `assessment.ts` | N | Valida campos y estructura discriminada por método | Implementar capa propia de EP-04 sin duplicar infraestructura | domain/assessment.ts; services/evaluation.ts |
| `apps/api/src/features/evaluations/validators/evaluation.ts` | `evaluation.ts` | N | Valida UUID y DTO heredado con límites/null/precisión | Implementar capa propia de EP-04 sin duplicar infraestructura | types/evaluation.ts; services/evaluation.ts |
| `apps/api/src/features/professional/services/record.ts` | `record.ts` | M | Compone lector real de evaluaciones y sus errores | Integrar HU-021 al expediente existente | evaluations/services/evaluation.ts; professional/types/record.ts |
| `apps/api/src/features/professional/types/record.ts` | `record.ts` | M | Tipa empty/available/error con evaluaciones | Mantener contrato de composición completo | professional/services/record.ts; OpenAPI |
| `apps/api/tests/assessment.test.ts` | `assessment.test.ts` | N | Verifica aritmética, límites, fechas, null y mezcla de métodos | Probar entradas y cálculos habilitados sin BD | evaluations/domain/assessment.ts; validators/assessment.ts |
| `apps/api/tests/client-read-isolation.test.ts` | `client-read-isolation.test.ts` | M | Integra HTTP/BD y prueba runtime restringido con dos carteras | Demostrar propiedad/RLS/historial y regresión de expediente | schemas/identity_access.sql; API app.ts |
| `apps/api/tests/evaluations.test.ts` | `evaluations.test.ts` | N | Prueba DTO legado, fronteras, vacío y precisión | Conservar compatibilidad y opcionales | evaluations/validators/evaluation.ts |
| `apps/api/tests/migrations.test.ts` | `migrations.test.ts` | M | Compara instalación limpia, snapshot y actualización con historia | Demostrar reproducibilidad, checksums y conservación | scripts/migrate.ts; tres migraciones; esquema integrado |
| `apps/web/src/features/evaluations/components/AnatomicalGuide.tsx` | `AnatomicalGuide.tsx` | N | SVG orientativo interactivo y alternativa textual | Reutilizar una sola experiencia de evaluación en el expediente | AssessmentForm.tsx |
| `apps/web/src/features/evaluations/components/AssessmentForm.tsx` | `AssessmentForm.tsx` | N | Captura amplia, métodos, borradores y estados de guardado | Reutilizar una sola experiencia de evaluación en el expediente | services/evaluations.ts; AnatomicalGuide.tsx; CompositionResults.tsx |
| `apps/web/src/features/evaluations/components/CompositionResults.tsx` | `CompositionResults.tsx` | N | Muestra resultados disponibles y dona sin diagnósticos inventados | Reutilizar una sola experiencia de evaluación en el expediente | AssessmentForm.tsx; EvaluationsSection.tsx |
| `apps/web/src/features/evaluations/components/EvaluationSummary.tsx` | `EvaluationSummary.tsx` | N | Dato informativo compacto de última evaluación | Reutilizar una sola experiencia de evaluación en el expediente | professional/components/ClientRecordSections.tsx |
| `apps/web/src/features/evaluations/components/EvaluationsSection.tsx` | `EvaluationsSection.tsx` | N | Historial confirmado, detalle y operaciones locales separadas | Reutilizar una sola experiencia de evaluación en el expediente | pages/EvaluationsPage.tsx; hooks/useOperations.ts |
| `apps/web/src/features/evaluations/pages/EvaluationsPage.tsx` | `EvaluationsPage.tsx` | N | Área contextual del expediente y captura; redirección de enlaces heredados | Reutilizar una sola experiencia de evaluación en el expediente | professional/pages/ProfessionalPage.tsx; ClientHeader.tsx |
| `apps/web/src/features/evaluations/services/evaluations.ts` | `evaluations.ts` | N | Alta real por sesión con deadline e idempotencia común | Reutilizar una sola experiencia de evaluación en el expediente | services/offline/writes.ts; types/evaluation.ts |
| `apps/web/src/features/evaluations/types/assessment.ts` | `assessment.ts` | N | Tipos discriminados y aritmética preliminar Web | Reutilizar una sola experiencia de evaluación en el expediente | AssessmentForm.tsx; API domain/assessment.ts |
| `apps/web/src/features/evaluations/types/evaluation.ts` | `evaluation.ts` | N | DTO/guard de respuestas y estados del lector | Reutilizar una sola experiencia de evaluación en el expediente | professional/services/record.ts; pages/EvaluationsPage.tsx |
| `apps/web/src/features/professional/components/ClientHeader.tsx` | `ClientHeader.tsx` | M | Añade tercera pestaña Evaluación | Conservar navegación común del cliente | ProfessionalPage.tsx; training/pages/ClientTraining.tsx |
| `apps/web/src/features/professional/components/ClientRecordSections.tsx` | `ClientRecordSections.tsx` | M | Conserva solo indicador informativo de última evaluación | Evitar gestión duplicada dentro de Resumen | evaluations/components/EvaluationSummary.tsx |
| `apps/web/src/features/professional/components/ClientRecordView.tsx` | `ClientRecordView.tsx` | M | Integra tipos/props y separa pendientes de edición base | Evitar que una evaluación bloquee la gestión base | ClientRecordSections.tsx; hooks/useOperations.ts |
| `apps/web/src/features/professional/pages/ProfessionalPage.tsx` | `ProfessionalPage.tsx` | M | Resuelve rutas contextualizadas y alias antiguos; sin menú global | Mantener contexto y transición segura de enlaces | evaluations/pages/EvaluationsPage.tsx; ClientHeader.tsx |
| `apps/web/src/features/professional/services/record.ts` | `record.ts` | M | Valida sección real y asociación del DTO con cliente | No confiar en respuestas externas arbitrarias | evaluations/types/evaluation.ts; professional/types/record.ts |
| `apps/web/src/features/professional/types/record.ts` | `record.ts` | M | Incluye EvaluationSection en ProfessionalRecord | Sincronizar contrato Web/API del expediente | professional/services/record.ts; components/ClientRecordView.tsx |
| `apps/web/src/services/offline/connection.ts` | `connection.ts` | M | Excluye migración pendiente de fallos transitorios | No encolar un bloqueo permanente de esquema | offline/writes.ts; offline/sync.ts |
| `apps/web/src/services/offline/outbox.ts` | `outbox.ts` | M | Añade tipo evaluation.create | Reutilizar cola cifrada existente | evaluations/services/evaluations.ts; offline/sync.ts |
| `apps/web/src/services/offline/readCache.ts` | `readCache.ts` | M | Admite páginas autorizadas de evaluaciones | Reutilizar caché cifrada por cuenta | tests/offline-read.test.mjs; auth/services/session.ts |
| `apps/web/src/services/offline/sync.ts` | `sync.ts` | M | Trata migración pendiente y espera acotada solo en evaluaciones | Conservar operaciones e idempotencia al sincronizar | offline/writes.ts; offline/outbox.ts |
| `apps/web/src/services/offline/writes.ts` | `writes.ts` | M | Acepta ID estable y deadline opcionales | Evitar doble alta y resultados inciertos presentados como éxito | evaluations/services/evaluations.ts; offline/sync.ts |
| `apps/web/tests/offline-read.test.mjs` | `offline-read.test.mjs` | M | Prueba elegibilidad de caché de páginas históricas | Evitar cachear queries no autorizadas | services/offline/readCache.ts |
| `apps/web/tests/offline-write.test.mjs` | `offline-write.test.mjs` | M | Prueba bloqueo de migración y timeout con replay | Demostrar conservación de operación/idempotencia | services/offline/writes.ts; services/offline/sync.ts |
| `apps/web/tests/session-recovery.test.mjs` | `session-recovery.test.mjs` | M | Prueba flujo de expediente, UI, navegación, sesiones y offline | Demostrar integración y regresiones, sin mocks de producto | ProfessionalPage.tsx; evaluations/; session/offline services |
| `docs/api/identity-lifecycle.openapi.json` | `identity-lifecycle.openapi.json` | M | Describe endpoints y DTO legado/multimétodo | Sincronizar contrato público y errores | API/Web evaluation types; professional record |
| `docs/architecture/domain-glossary.md` | `domain-glossary.md` | M | Define snapshot, métodos y fechas | No cambiar significado de campos históricos | multimethod.md; esquema integrado |
| `docs/database/README.md` | `README.md` | M | Documenta migración incremental y evidencia SQL | Preparar despliegue controlado y trazabilidad | migrations/; revision-final.md |
| `docs/database/migrations/202611080001_client_evaluations.sql` | `202611080001_client_evaluations.sql` | N | Crea tabla fechada, límites, grants mínimos y RLS | Persistencia independiente del perfil base | private.clients; private.training_professional |
| `docs/database/migrations/202611090001_multimethod_evaluations.sql` | `202611090001_multimethod_evaluations.sql` | N | Añade snapshot nullable y restricción de propietario | Ampliar métodos preservando filas antiguas | 202611080001_client_evaluations.sql; API repository |
| `docs/database/migrations/202611100001_evaluation_measurement_integrity.sql` | `202611100001_evaluation_measurement_integrity.sql` | N | Endurece invariantes de mediciones JSONB | Impedir elusión de validación mediante SQL runtime | 202611090001_multimethod_evaluations.sql; validators/assessment.ts |
| `docs/database/schemas/identity_access.sql` | `identity_access.sql` | M | Mantiene instantánea del esquema completo | Equivalencia con las 29 migraciones | tests/migrations.test.ts |
| `docs/epicas/ep-03-cartera-y-expediente/estado-e-integracion.md` | `estado-e-integracion.md` | M | Actualiza referencia a EvaluationSection real | Documentar integración sin cambiar alcance de EP-03 | HU-019; HU-021 |
| `docs/epicas/ep-03-cartera-y-expediente/hu-019/README.md` | `README.md` | M | Añade nota fechada y enlace a HU-021 | Conservar evidencia histórica y señalar nuevo lector | hu-021/README.md |
| `docs/epicas/ep-03-cartera-y-expediente/seguimiento-auditoria.md` | `seguimiento-auditoria.md` | M | Actualiza descripción del caso vertical al lector real | No presentar evaluación integrada como not_integrated | tests/client-read-isolation.test.ts |
| `docs/epicas/ep-04-antropometria/hu-021/COUCHONEFIT_HU021_HANDOFF.md` | `COUCHONEFIT_HU021_HANDOFF.md` | N | Guía integral actualizada de transferencia | Facilitar revisión, operación y continuidad sin contradicciones ocultas | Resto de documentos HU-021; código y pruebas citados |
| `docs/epicas/ep-04-antropometria/hu-021/README.md` | `README.md` | N | Entrada de la HU y alcance original histórico | Facilitar revisión, operación y continuidad sin contradicciones ocultas | Resto de documentos HU-021; código y pruebas citados |
| `docs/epicas/ep-04-antropometria/hu-021/multimethod.md` | `multimethod.md` | N | Contrato vigente de ampliación y gates | Facilitar revisión, operación y continuidad sin contradicciones ocultas | Resto de documentos HU-021; código y pruebas citados |
| `docs/epicas/ep-04-antropometria/hu-021/revision-final.md` | `revision-final.md` | N | Auditoría y manifiesto candidato | Facilitar revisión, operación y continuidad sin contradicciones ocultas | Resto de documentos HU-021; código y pruebas citados |
| `docs/epicas/ep-04-antropometria/hu-021/validacion-local.md` | `validacion-local.md` | N | Evidencia T/R/E cronológica | Facilitar revisión, operación y continuidad sin contradicciones ocultas | Resto de documentos HU-021; código y pruebas citados |
| `plan/PLAN_TRABAJO_V2.md` | `PLAN_TRABAJO_V2.md` | M | Registra ampliación autorizada y tercera pestaña | Conservar criterios originales y trazabilidad de decisiones | hu-021/multimethod.md |

## E. PostgreSQL, migraciones, historia y respaldo

### Modelo y migraciones

| Orden | Archivo | Función |
| --- | --- | --- |
| 27 | 202611080001_client_evaluations.sql | Crea private.client_evaluations, índices, rangos/precisión, permisos y RLS |
| 28 | 202611090001_multimethod_evaluations.sql | Añade assessment JSONB nullable y política restrictiva de propietario |
| 29 | 202611100001_evaluation_measurement_integrity.sql | Alinea campos/rangos/precisión/coherencia JSONB y columnas originales |

No se editan archivos aplicados. El migrador oficial apps/api/scripts/migrate.ts recorre YYYYMMDDHHMM_nombre.sql ordenados, verifica historial/checksum (incluidas variantes LF/CRLF), advisory lock y transacción. Se actualiza el esquema integrado y se prueban instalación limpia y actualización. No ejecutar el esquema integrado sobre una base existente. Hay 29 migraciones y 28 tablas en el esquema final.

private.client_evaluations tiene id UUID automático, client_id FK a clients con ON DELETE RESTRICT, evaluation_date DATE UTC y created_at TIMESTAMPTZ generados por PostgreSQL. Campos originales numéricos nullable, sin truncado automático de decimales: CHECK de rangos y valor igual a round(valor,1). Un índice por cliente/fecha/creación/id sirve consultas históricas. Cada evaluación es una fila independiente; no hay actualización/eliminación funcional.

| Campo(s) | Unidad / límite vigente |
| --- | --- |
| weightKg | kg 30–300, paso 0.1 |
| heightCm (solo snapshot ampliado) | cm 100–250, paso 0.1 |
| waistCm / hipCm | cm 40–250 / 50–250, paso 0.1 |
| measuredBodyFatPercentage | % 2–60, paso 0.1 |
| Cada pliegue | mm 1–80, paso 0.1 |
| neckCm / abdomenUmbilicalCm | cm positivos, finitos, un decimal; sin límite clínico superior inventado |
| muscleMassKg / waterLitres / visceralFatIndex | kg / L / índice del dispositivo; positivos, finitos, un decimal; coherencia con peso cuando existe |
| Segmentos | masas homogéneas kg, tipo explícito muscle_mass/fat_mass, cinco sitios opcionales |

Snapshot assessment guarda método, protocolo, ownerId de cuenta autenticada, fechas/edad/nacimiento de referencia, mediciones, resultados, versión, estado y procedencia. DTO en español por instrucción (`perimetros`, `pliegues`, `bioimpedancia`), valores persistidos ingleses (`circumference`, `skinfolds`, `bioimpedance`) mapeados en repositorio. Legacy assessment NULL significa método desconocido: no inventar procedencia ni recalcular.

La precisión de presentación se separa del cálculo; no redondear intermedios. Los snapshots son históricos y no cambian al editar perfil. Valores ausentes se omiten en measurements, los campos legados de respuesta son null: nunca cero por defecto. Peso/altura de evaluación son captura explícita, no copias silenciosas del perfil. La entrada heredada acepta una medición válida cualquiera; la multimétodo requiere una propia del método, además de peso/altura opcionales.

RLS: lectura por cartera autorizada; alta requiere cliente activo; snapshot ownerId coincide con app.subject_id. Runtime recibe SELECT e INSERT solo de columnas autorizadas; sin INSERT de fechas técnicas, UPDATE, DELETE, DDL ni BYPASSRLS. La tercera migración añade CHECK, sin nuevas funciones de negocio/grants/políticas ni reescritura de datos. Una fila previa incompatible bloquea la migración para revisión, nunca se normaliza automáticamente. Resultados son autoritativos de la API; SQL no replica el motor matemático.

### Preflight anterior a aplicar las migraciones (histórico verificable)

**T:** SQL READ ONLY confirmó PostgreSQL 17.11 (170011), host 127.0.0.1, puerto 5433, base CouchOneFit_dev, migrador existente yutzilsanchez, diferente de couchone_api. Se validaron los 27 checksums aplicados y ausencia de migraciones desconocidas. En ese preflight estaban pendientes **202611090001 y 202611100001**; la 202611080001 ya estaba aplicada. Ambas pendientes se aplicaron después mediante el migrador oficial (ver §M); no se reaplicó la inicial.

Se registraron huellas de conservación de las tablas privadas; conteos iniciales: **2 clientes y 3 evaluaciones**. Las huellas y los datos del respaldo permanecen fuera de Git. Los pendientes contienen solo cambios locales de la tabla; no requieren modificar roles compartidos ni otras bases existentes.

### Respaldo y puerta de recuperación

- Archivo privado fuera del repositorio: `<directorio_privado_de_respaldos>/CouchOneFit_dev.before-hu021.dump`. La ubicación real está en el registro local privado, no se publica la ruta personal.
- Formato custom de pg_dump 17.11; snapshot consistente exportado desde transacción READ ONLY REPEATABLE READ.
- Carpeta modo 0700, archivos 0600; tamaño 183873 bytes. SHA-256 registrado en verification.json local; no contiene contraseñas de conexión en comandos/logs.
- **T:** pg_restore --list reconoció tablas/datos/historial y pg_restore --file=/dev/null recorrió el archivo completo sin error.
- **T — COMPLETADO:** autorización adicional recibida; restauración efectiva en la única base nueva `cof_hu021_restore_6dcaeb29a803`, con datos/historial/esquema/RLS/permisos contrastados. Se eliminó solo esa temporal después de verificarla. Dump original conserva SHA-256.
- **T — COMPLETADO:** superada la recuperación, se aplicaron únicamente 202611090001 y 202611100001 a desarrollo. Login y escrituras QA posteriores comprobaron tres métodos, sin editar datos anteriores. Ninguna aplicación remota autorizada.

Este respaldo local no acredita cifrado/offsite, retención o RPO/RTO de producción. docs/database/README y docs/architecture/despliegue §5 exigen respaldo verificado y promoción controlada. No copiar dump, manifest con datos ni archivos de QA a Git. Para recuperación no restaurar encima de una base existente ni usar --clean; probar primero en destino nuevo autorizado. Conservar roles existentes y cotejarlos; pg_dump no sustituye un respaldo/restauración integral de roles del clúster.

## F. API y contratos

| Método / ruta | Contrato |
| --- | --- |
| POST /api/clients/{clientId}/evaluations | 201 con {evaluation}; autenticación profesional, CSRF e Idempotency-Key opcional |
| GET /api/clients/{clientId}/evaluations?offset=N | 200 con {evaluations:[]}, páginas de hasta 20; asociación autorizada |
| GET /api/clients/{clientId}/record | sections.evaluations empty / available con filas / error QUERY_FAILED |

Ejemplo de entrada ilustrativo, no usuario ni registro existente:

```json
{"method":"bioimpedancia","equation":"not_applicable","effectiveDate":null,"measurements":{"weightKg":80,"measuredBodyFatPercentage":25,"waterLitres":40}}
```

También se admite el DTO antiguo plano sin method, por compatibilidad. No aceptar resultados calculados, propietario, edad ni asociación del body. Tipos/contratos están en types/evaluation.ts, domain/assessment.ts y docs/api/identity-lifecycle.openapi.json. Cada controller adapta HTTP; el service llama al validator; el repository usa una conexión transaccional y SQL parametrizado, con liberación/rollback comunes.

Errores: 400 INVALID_EVALUATION/INVALID_INPUT; 401 sesión inválida; 403 EVALUATION_FORBIDDEN o CSRF_INVALID; 404 CLIENT_NOT_FOUND para inexistente/ajeno; 409 IDEMPOTENCY_IN_PROGRESS; 422 IDEMPOTENCY_KEY_REUSED; 503 EVALUATION_UPGRADE_REQUIRED cuando falta la columna del snapshot; otros fallos coherentes con handler global. No exponer SQL ni datos sensibles en UI.

createdAt/evaluationDate son técnicos y servidor; effectiveDate es fecha efectiva independiente, retroactiva válida/no futura/no anterior al nacimiento conocido. Si se omite se toma día UTC al aceptar, también al sincronizar offline. Una captura offline no promete conservar el día local de captura como fecha oficial. Edad derivada de nacimiento y fecha efectiva, o null si no consta; no modificar perfil.

Cálculos habilitados composition-arithmetic-v1:

- ICC = cintura/cadera; ICE = cintura/estatura, solo con ambas entradas.
- Bioimpedancia: grasa informada, masa grasa = peso × %/100; masa libre = peso − masa grasa.
- Agua aproximada = litros/peso × 100, explicitando 1 L ≈ 1 kg.
- No confundir músculo con masa libre, índice visceral con porcentaje, ni sumar segmentos incompatibles.
- Casos patrón: 80 kg/25%/40 L → 20 kg grasa, 60 kg libres, 50% agua; cintura 80/cadera 100/altura 200 → ICC 0.8, ICE 0.4.
- Navy y Jackson-Pollock/Siri DESHABILITADOS. Las referencias primarias/protocolos no están cotejados completamente; no declarar validación científica. No hay semáforos clínicos.

## G. Web, navegación, historial y guardado

Ruta canónica: Clientes → Expediente → **Resumen | Entrenamiento | Evaluación**. No hay entrada Evaluaciones en menú principal ni selector de cliente duplicado. ClientHeader es compartido, clientId procede de la ruta y se revalida en backend.

- Historial: /app/clientes/{clientId}/evaluacion.
- Captura amplia: /app/clientes/{clientId}/evaluacion/nueva.
- Volver/cancelar conserva el cliente y pestaña. Resumen solo muestra última evaluación informativa; no duplica formulario o botones.
- Rutas antiguas /app/evaluaciones/{UUID} y /nueva redirigen a equivalentes; ruta global o identidad inválida conduce a Clientes. Sin parámetros de retorno arbitrarios ni bucles; autorización sigue aplicándose.

Perímetros: cuello, cintura, abdomen umbilical y cadera, además de generales opcionales. Pliegues: siete sitios existentes (tríceps, bíceps, subescapular, suprailiaco, pectoral, abdominal, muslo). Bioimpedancia: resultados del dispositivo, agua, visceral como índice y segmentos opcionales. Solo se muestran campos del método; borradores separados sobreviven al alternar. Cambiar tipo de tejido segmental pide confirmación antes de descartar valores incompatibles.

AssessmentForm reutiliza componentes/estilo profesional. Guía SVG original con foco y alternativa textual es **orientativa**, no protocolo anatómico clínico verificado. CompositionResults muestra preliminares y luego resultados definitivos del servidor, dona solo con porcentaje válido; segmentos solo homogéneos. En escritorio usa área amplia y columna secundaria, en móvil una columna; no se acredita prueba visual en dispositivos por tener CSS responsivo.

Historial: fecha efectiva (o fecha técnica heredada), método sin inventarlo, detalle desplegable, mediciones no nulas y resultados disponibles; 20 por página con carga anterior. Orden estable por fecha/creación/ID, deduplicación de IDs. Offset no garantiza instantánea ante altas concurrentes. No limita lo almacenado a 20.

Guardado distingue validando, guardando, confirmado, pendiente local, error y resultado incierto. Conserva entradas ante rechazo, bloquea doble envío y usa ID estable. StrictMode restablece mounted en cada montaje. Espera de 20 s opt-in conforme a la decisión provisional DEC-013: timeout no demuestra rollback ni autoriza reenviar con otra clave. No cerrar ni mostrar éxito antes de confirmación.

Offline reutiliza caché/outbox cifradas y ligadas a cuenta; sin tokens en localStorage. Misma clave y payload se sincronizan sin duplicar. Cambio de cuenta no mezcla datos. Sesión revocada no permite escrituras nuevas; operaciones pendientes no se borran para ocultar un fallo. EVALUATION_UPGRADE_REQUIRED no es conectividad: directo muestra migración pendiente; en cola pasa a failed conservando ID/payload, sin reintento automático infinito. Pendiente no se mezcla con historial confirmado.

## H. Pruebas, comandos y resultados

### Evidencia ejecutada

| Conjunto | Resultado / alcance |
| --- | --- |
| Dos suites PostgreSQL autorizadas | **39/39**: aislamiento/integración 38; migraciones 1; recursos temporales en 17.11:5433, roles globales sin cambios |
| Unitarias API seguras | **21/21**, repetidas en este encargo; validación/arimética y regresión base/edición/planes |
| Web completa | **94/94**, repetida en este encargo; JSDOM y transporte simulado, no navegador real |
| Builds API/Web y lint Web | Aprobados en este encargo |
| API /api/health y Web /app/clientes | HTTP local correcto; health development y Web 200; no login ni escritura |
| Prettier de archivos afectados | Aprobado en auditoría previa; sin cambios de código Web desde entonces |
| OpenAPI | JSON, 102 referencias locales y 25 operationId comprobados; validación semántica completa pendiente |
| git diff --check | Limpio al cierre de esta integración y actualización documental |

Primera ejecución PG: 36/38 (dos fixtures incorrectas). Se corrigieron expediente sintético base completo y prefijo del hash sintético, sin relajar reglas. Segunda: 38/38. Nueva restricción/regresión JSONB: 39/39. Limpieza verificada de seis bases y dos roles por ejecución, sin eliminar recursos preexistentes. El primer preflight rechazó representación IP /32 y se corrigió a host(inet_server_addr()), antes de escribir.

Las pruebas PG demostraron fechas, propietario de sesión, opcionales, límites/precisión, historial intacto ante edición/inactivación/reactivación, roles/CSRF, foreign-client, snapshots de tres métodos, idempotencia y SQL runtime restringido. La prueba de migraciones recorre instalación limpia, equivalencia integrada, checksums y actualización con evaluación heredada.

Los cinco diagnósticos del typecheck adicional de tests ajenos se reprodujeron con el archivo de HEAD y mismos módulos. El build oficial excluye tests y pasa; no se ocultaron esos diagnósticos modificando otras épicas. Vite presenta avisos HMR/PWA en pruebas y bundle ~507 kB, sin impedir resultados aprobados.

### Comandos reales

Desde raíz, sin escritura de BD:

```bash
npm --prefix apps/api run build
npm --prefix apps/web run build
npm --prefix apps/web run lint
```

Desde apps/api, unitarias seguras ejecutadas:

```bash
node --import tsx --test tests/assessment.test.ts tests/evaluations.test.ts tests/client-edit.test.ts tests/client-initial-record.test.ts tests/saas-validation.test.ts
```

Desde apps/web, suite completa ejecutada en serie:

```bash
node --test --test-concurrency=1 tests/*.test.mjs
```

Desde apps/api, **solo con conexión temporal y preflight autorizados**:

```bash
node --import tsx --test --test-concurrency=1 tests/migrations.test.ts tests/client-read-isolation.test.ts
```

No copiar la última orden con el .env de desarrollo ni dirigirla a CouchOneFit_test. El arnés crea/elimina recursos y los roles son globales al clúster: los guardas de host/nombre no bastan para fijar puerto/versión/ausencia de efectos compartidos. El envoltorio local /tmp/cof-hu021-pg-check.cjs verificó estos requisitos, creó una base de preparación nueva y comparó roles antes/después; no es un archivo distribuido. Al pasar a otro equipo se necesita equivalente revisado/autorizado.

La suite API completa npm test NO se ejecutó ni se autoriza aquí: algunas pruebas escriben directamente en TEST_DATABASE_URL. Sin elevar couchone_api. Las pruebas con fixtures en temporales no justifican escrituras en datos reales.

### Reporte humano y pruebas pendientes

**R:** Pukzil comprobó login, expediente, historial, alta y validaciones del flujo original antes de las últimas ampliaciones UX. No presentarlo como revisión visual de la pestaña actual. **T actual:** backend de desarrollo migrado y guardado multimétodo confirmado por HTTP. La revisión visual fue reportada después como R 7/7 aprobada; faltan revisión independiente y coherencia/validación semántica OpenAPI.

## I. Ejecución local, QA y otra computadora

Entorno comprobado: macOS Intel, Node v24.18.0/npm 11.19.1, PostgreSQL 17.11 Homebrew. El repositorio requiere Node 24, PostgreSQL >=17; API y Web tienen lockfile propio. No instalar/actualizar dependencias globales ni lockfiles por conveniencia.

Preparación de un checkout nuevo (comandos documentados, no reinstalados en este encargo):

```bash
npm --prefix apps/api ci
npm --prefix apps/web ci
```

Inspección local antes de iniciar procesos:

```bash
brew services list
/usr/local/opt/postgresql@17/bin/pg_isready -h 127.0.0.1 -p 5433
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5000 -sTCP:LISTEN
```

PostgreSQL 17 ya está started. Su configuración efectiva en /usr/local/var/postgresql@17 indica 5433. Solo si está detenido y se confirmó la misma configuración, el comando documentado de arranque es `brew services start postgresql@17` (no se ejecutó porque ya funcionaba). No iniciar/modificar postgresql@16 ni cambiar puertos. Reverificar SQL host/puerto/base/rol; pg_isready solo informa disponibilidad.

API y Web ya escuchaban en 3000/5000 al inspeccionar. No matar procesos indiscriminadamente. Si no están activos, desde raíz, terminales separadas:

```bash
npm --prefix apps/api run dev
```

```bash
npm --prefix apps/web run dev
```

API http://127.0.0.1:3000; Web http://127.0.0.1:5000. Vite proxy /api→3000; dejar VITE_API_URL vacío, CORS_ORIGIN permite hosts de 5000. apps/api/.env local ignorado usa DATABASE_URL runtime couchone_api y AUTH_JWT_SECRET seguro. Nunca enviar credenciales de BD al bundle. No modificar el .env para guardar la conexión privilegiada de migración.

**Credenciales QA (login real comprobado en esta integración):** se comprobó que apps/api/.env contiene las variables QA_PROFESSIONAL_USERNAME y QA_PROFESSIONAL_PASSWORD. Pukzil puede consultar sus valores privadamente en VS Code y pegarlos en el login; los nombres literales de las variables NO son el usuario/contraseña. No mostrar valores en logs/chat/documentos. No se restablecieron credenciales. El script prepare-client-record-e2e.ts inspeccionado está fijado a 5432/CouchOneFit_test: NO usarlo en este entorno ni modificarlo para sortear su guarda. Si las credenciales locales faltan en otro equipo, solicitar provisión sintética por el custodio, sin usar usuarios reales ni contraseñas compartidas.

Login en /acceso; luego /app/clientes, abrir cliente QA autorizado y tercera pestaña Evaluación. La identidad del cliente no se introduce manualmente en un selector. Solo clientes sintéticos QA pueden recibir nuevas evaluaciones de comprobación.

**Guía para repetir revisión manual si cambia la versión (ya aprobada R 7/7):** abrir historial y anotar registros anteriores; probar campos inválidos sin guardar; registrar dos evaluaciones válidas con al menos una medición propia del método, comprobar confirmación y fecha del servidor, volver al historial y recargar. Verificar ambas junto a las antiguas. Dejar opcionales vacíos y comprobar ausencia/null, nunca cero. Repetir en otro método si procede, probar borradores/cancelación/teclado y viewport móvil. Offline: distinguir pendiente, conservar ID, volver a red y confirmar una sola evaluación. No borrar operaciones ni datos para limpiar. Pruebas de inactivación/edición solo sobre QA y con estado restaurado por flujo autorizado, no SQL manual. No tocar otro profesional real para probar aislamiento: usar arnés sintético.

**Desde otra computadora:** el código actual aún no está publicado; clonar la rama remota NO incluye los cambios locales. Transferir de forma autorizada el trabajo completo o esperar su publicación. No transferir .env, contraseñas, backups, node_modules ni .vite con el código. Instalar con ci, configurar secretos locales propios, provisionar PostgreSQL >=17 con runtime restringido/preparador separado, verificar destinos y generar fixtures sintéticas autorizadas. No usar Supabase como atajo. Una ruta /tmp del equipo anterior no es un requisito disponible en el nuevo equipo.

## J. Evolución de decisiones y trabajo

1. HU original: persistencia manual fechada, cinco pliegues opcionales y contrato legado; perfil base separado del historial.
2. Primera implementación local de tabla/validator/repository/service; se completaron endpoints, composición del expediente y Web/offline.
3. Pukzil reportó el recorrido principal manual correcto. La tarjeta estrecha originó historial compacto y diálogo amplio; el handoff externo de 9/nov refleja esa etapa, ya superada.
4. Ampliación formal autorizada: tres métodos, snapshot, aritmética, guías/resultados. Se propuso y construyó un módulo de menú independiente con selección de cliente. No confundir esa decisión intermedia con la navegación definitiva.
5. Se autorizó abdomenUmbilicalCm independiente de cintura; preservar significados históricos y mantener Navy/JP3/Siri deshabilitados hasta cotejo. Datos nuevos no autorizan reinterpretar filas antiguas.
6. Se sustituyó el modal por captura amplia y se corrigieron StrictMode, clasificación del 503 de migración y deadline/idempotencia.
7. Decisión posterior del supervisor, comunicada por Pukzil: gestión completa en tercera pestaña del expediente. Se quitó menú global/picker; rutas antiguas redirigen. Se conservó captura amplia, una sola implementación y resumen meramente informativo.
8. Auditoría original: documentación de decisiones, cinco criterios, D0 y tres métodos separados de las fórmulas pendientes. No ocultar propuestas como aprobación PO.
9. PG autorizado: preflight de 17.11:5433; dos fixtures corregidas, 38/38; nueva restricción SQL de snapshot, 39/39. Sin cambios de roles compartidos ni bases existentes.
10. Auditoría de 54 archivos aceptada: tres notas EP-03 legítimas, 17 módulos nuevos con consumidores, pruebas pertinentes. Cache .vite ignorada sin borrarla; 715 líneas añadidas/13 eliminadas en session-recovery, no 728 añadidas.
11. Instrucción previa de integración: preflight encontró 27 aplicadas/2 pendientes y respaldo generado/legible; todavía faltaba autorización de restauración. Esa situación histórica quedó superada por el punto siguiente.
12. Autorización final posterior: una sola temporal restaurada y eliminada, dos pendientes aplicados y 15 comprobaciones HTTP/SQL QA aprobadas. Desarrollo tiene 29 migraciones y 6 evaluaciones, con los datos originales intactos. Ver evidencia §M.

Las fechas precisas solo se atribuyen cuando constan en la evidencia. La secuencia anterior resume mensajes de Pukzil y documentos; no inventa aprobación formal del PO, aceptación independiente ni publicación.

## K. Instrucciones y prompts de implementación

Los prompts completos están en la conversación de Pukzil con Codex; no hay un archivo de prompts independiente verificado en el repositorio. Este apartado es un **resumen fiel, no transcripción literal**. El original externo preservado describe restricciones/evidencia histórica y queda identificado en §A.

- Leer reglas reales vigentes de AGENTS/DEVELOPMENT/CONTRIBUTING, HU y decisiones antes de modificar; usar grafo MCP si está disponible, informar fallback si no.
- Conservar todo el trabajo local, archivos sin seguimiento e índice; no reconstruir HU-021 ni reducir archivos por estética.
- Proteger EP-01/02/03/06, auth, cartera, suscripciones, entrenamiento y Flutter. Cambios compartidos mínimos, justificados y probados; coordinación del equipo por Pukzil, nunca mensajes enviados por el agente sin instrucción.
- Usar ui-ux-pro-max instalada para fases visuales, leer su SKILL.md y respetar identidad/componentes/accesibilidad. No afirmar uso si no se leyó. En esta fase documental/BD no se rediseñó UI.
- PostgreSQL permitido: 17 en 127.0.0.1:5433. No Supabase, PG16:5432, cambios de roles globales, elevación runtime ni escrituras de pruebas sobre bases existentes no autorizadas.
- Migraciones incrementales YYYYMMDDHHMM_nombre.sql; no editar hashes aplicados, no borrar/recrear bases ni reinterpretar historia. Mantener esquema integrado, contratos, pruebas y documentación coordinados.
- SQL parametrizado, identidad de sesión, CSRF, RLS, transacciones y asociación por cartera; sin UPDATE/DELETE de evaluaciones para runtime. NULL no equivale a cero.
- Offline/idempotencia comunes, sin infraestructura paralela, sin éxito antes de confirmación. Mantener borradores, doble envío y migración pendiente bien clasificados.
- Publicación: autorización para programar/probar NO autoriza git add/commit/push/PR ni cambios de rama. Pukzil debe validar funcionalmente y autorizar publicación después.
- Evidencia precisa: T/R/E, prueba ejecutada frente a preparada, local frente a remoto, build frente a navegador, código frente a aceptación D0.

### Prompt previo: integración local final y documento de entrega

**Fuente:** mensaje de Pukzil titulado «COUCHONE FIT — EP-04 / HU-021 — INTEGRACIÓN LOCAL FINAL Y ACTUALIZACIÓN DEL DOCUMENTO DE ENTREGA», en esta conversación. **Instrucción operativa resumida:** autoriza aplicar solo pendientes HU-021 en CouchOneFit_dev/PG17:5433 mediante migrador oficial y rol distinto del runtime, después de identidad SQL READ ONLY, revisión completa de historial/checksums y respaldo externo legible/recuperable. Ante incompatibilidad, detener sin forzar. No modificar test, PG16/Supabase ni roles compartidos. Probar solo QA sintético y documentar resultados reales. Leer/conservar original externo y preparar una única copia versionable integral aquí, con arquitectura, criterios, inventario, BD/API/Web, pruebas, ejecución, evolución/prompts, pendientes y manifiesto. Mantener referencias coherentes. Sin Git de escritura/publicación.

### Prompt vigente: restauración del respaldo y preparación sin publicación

La autorización temporal solicitada inicialmente fue concedida expresamente en el mensaje posterior «Integración local final, restauración del respaldo y preparación para publicación». Este mensaje autoriza una sola base cof_hu021_restore_<aleatorio>, restauración sin --clean/--create, comparación de huellas y eliminación solo de esa temporal; condiciona la aplicación de dos pendientes a esa recuperación, permite únicamente QA sintético y mantiene prohibidos Git de escritura, Supabase/PG16/test y cambios de roles. Es resumen fiel, no transcripción literal. Ambas operaciones se ejecutaron con evidencia §M.

## L. Pendientes, riesgos, entrega y continuidad

1. Revisión visual/funcional de la versión actual **cumplida por reporte del usuario R 7/7**, incluido móvil y recuperación offline. No ejecutada por Codex; no se solicita repetir sin cambios que lo justifiquen.
2. Revisión independiente D0 y aceptación funcional de decisiones todavía provisionales. Navy/JP3 permanecen deshabilitados, sin bloquear por sí mismos el registro original.
3. Validación semántica OpenAPI completa pendiente; conservar alcance y cinco diagnósticos preexistentes del typecheck adicional de tests, sin arreglar otras épicas silenciosamente.
4. Confirmar coordinación de archivos compartidos, aceptación del nombre de rama y configuración de auto-deploy antes de autorizar push/PR. Render puede desplegar desde Git; rama/comandos reales de panel no verificados. Vercel rewrite apunta a API productiva: una preview no implica datos aislados.
5. Antes de producción: operador designado por supervisor, historial/checksums reales del destino, respaldo/restore propios, orden de pendientes y corte coordinado. La recuperación local no acredita recuperación ni aplicación en Supabase. No volver a ejecutar el esquema integrado sobre una base existente.
6. Publicación sigue sin autorización: no staging, commit, push, PR ni sincronización de ramas. Mantener todo el trabajo local y el manifiesto completo.

**Manifiesto candidato:** todas las rutas de §D, incluido este HANDOFF. Excluir .vite/deps_temp_d6f12e9a/package.json y /.vite/ (conservados), .env, credenciales QA, dumps/backups, node_modules, builds y logs. El respaldo queda fuera del repositorio. No usar staging global. Propuesta de commit vertical cuando se autorice: `feat(ep04): integrate dated client evaluations`; revisor según CONTRIBUTING: anglfer. No se ejecutó.

**Impacto:** sin regresiones detectadas en suites Web/unitarias y dos suites PG ejecutadas. No equivale a suite API completa ni garantiza módulos no cubiertos. No hubo cambios funcionales de otras épicas, Flutter o estilos globales en esta integración/documentación. La auditoría de archivos mantuvo cambios necesarios de expediente/enrutamiento/offline y solo referencias legítimas EP-03.

**Estado formal:** integración técnica local completada, lista para solicitar revisión; no HU formalmente aceptada ni publicación autorizada. La revisión visual está aprobada como R 7/7; la independiente y las observaciones OpenAPI permanecen pendientes. No repetir restauración, migraciones o altas QA ya comprobadas; verificar estado antes de cualquier operación. El handoff externo es histórico.


## M. Evidencia de integración local final — 11-nov-2026 UTC / 10-nov local

### Autorización y restauración

La instrucción posterior autorizó expresamente una única temporal y los dos pendientes locales condicionados al respaldo recuperable. Preflight reiterado: PostgreSQL **17.11/170011**, **127.0.0.1:5433**, **CouchOneFit_dev**, migrador existente **yutzilsanchez**, separado de runtime. Checksums/historial 27 coincidentes, pendientes exactamente 202611090001 y 202611100001; huellas de clientes/evaluaciones coincidentes con el respaldo. Ninguna operación en test, PG16 ni Supabase.

Se creó únicamente `cof_hu021_restore_6dcaeb29a803`, tras comprobar inexistencia. Se inspeccionó el SQL generado desde el dump para descartar CREATE/ALTER/DROP ROLE/DATABASE y cambios de membresías. pg_restore 17.11 usó `--exit-on-error --single-transaction` con destino explícito ya creado, sin --clean ni --create. Restauración terminó correctamente.

La comparación inicial de CHECK se detuvo por agrupación de paréntesis: al serializar/reparsear, PostgreSQL aplana AND asociativos. Se conservó la misma temporal y se compararon expresiones con EXPLAIN VERBOSE (sin ANALYZE), usando la normalización del propio planificador, sin quitar paréntesis mediante regex ni modificar reglas/datos. El resto de catálogos se comparó directamente. Resultado: columnas, constraints, índices, RLS, ACL/owner, funciones, triggers e historial equivalentes; **huellas de todas las tablas privadas restauradas iguales**, incluidos los 2 clientes y las 3 evaluaciones. No se alteraron roles/membresías.

Se confirmó identidad de la temporal y del servidor administrativo antes de eliminar solo esa base. La comprobación posterior confirma que ya no existe. El archivo .dump original mantiene SHA-256; verification.json privado conserva la prueba de restauración. No se creó una segunda temporal ni se recreó ninguna base existente.

### Aplicación y comprobaciones posteriores

Tras nuevo preflight se invocó **el migrador oficial** `node --import tsx scripts/migrate.ts` desde apps/api con DATABASE_URL privilegiada solo en el proceso hijo; no se cambió .env. El migrador informó exactamente:

```text
Applied: 202611090001_multimethod_evaluations.sql
Applied: 202611100001_evaluation_measurement_integrity.sql
```

Historial final **29**, hashes verificados, cero pendientes. No se reaplicó 202611080001 ni se editó SQL histórico. Inmediatamente después, huellas de **todas las tablas privadas existentes idénticas** a las de antes de migrar. Roles globales, OID/atributos y membresías iguales. client_evaluations: **14 restricciones validadas**, RLS activo, **3 políticas**, SELECT e INSERT de snapshot permitidos; UPDATE/DELETE e INSERT de fechas técnicas prohibidos al runtime.

Las evidencias privadas verification.json e integration.json quedan junto al respaldo fuera del repositorio; no distribuir sus contenidos ni el dump con el código. No se acredita cifrado/offsite/retención o RPO/RTO productivos por esta prueba local.

### Prueba funcional real QA — 15 comprobaciones

Se comprobó el QA real desde variables locales privadas: cuenta qa.*, correo sintético, profesional activo y cliente exacto autorizado Cliente QA EP04, activo y de su cartera. Sin semillas, cambios de contraseña ni usuarios nuevos. Se verificó identidad SQL antes del login/escrituras. Se usó la API existente en 3000, origen Web 5000 y CSRF/cookies reales, sin imprimir secretos.

Resultados: login correcto; anónimo 401; expediente/historial propios legibles; rangos/precisión/vacío/campos técnicos manipulados 400; falta CSRF 403; cliente inexistente 404. Se registró **una evaluación por método**, con fecha técnica/efectiva de aceptación y asociación correctas. Perímetros devolvió ICC 0.8/ICE 0.4; pliegues parciales conservó peso null y resultados vacíos; bioimpedancia devolvió masa grasa 20 kg/libre 60 kg/agua aproximada 50% y conservó segmentos homogéneos. No se habilitaron fórmulas pendientes.

Dos solicitudes concurrentes con igual clave produjeron una sola evaluación; replay devolvió el mismo ID y contenido distinto con la misma clave respondió 422. Listado, expediente y nueva lectura confirmaron las tres nuevas y las anteriores sin duplicados. Se compararon perfiles completos de los 2 clientes y las 3 evaluaciones anteriores: iguales; solo se añadieron las tres QA autorizadas. **Estado final: 2 clientes, 6 evaluaciones (3 heredadas + 1 por método)**. No borrar estas filas para simular limpieza. La sesión creada por el smoke se cerró y el acceso posterior recibió 401; no se revocaron sesiones ajenas.

No había una segunda cartera sintética autorizada en desarrollo: no se ejecutó allí el caso HTTP de otro profesional. Se consultó el runtime con sujeto verificado sin filas ajenas visibles; esto no sustituye una fixture de dos carteras. La prueba de aislamiento con dos profesionales mantiene evidencia **histórica 39/39** en temporales. No se crearon bases/roles de esas suites de nuevo en este encargo.

### Comprobaciones ejecutadas ahora y límites

| Comprobación actual | Resultado |
| --- | --- |
| Build API | Aprobado |
| Unitarias API seguras | **21/21**, ejecutadas nuevamente |
| Build y lint Web | Aprobados |
| Suite Web completa serial | **94/94**, ejecutada nuevamente |
| Prettier del código Web modificado/nuevo | Aprobado |
| OpenAPI | JSON, **102 referencias** resueltas y **25 operationId** únicos; sin validador semántico completo |
| Smoke HTTP/SQL QA local | **15 comprobaciones aprobadas**, exactamente 3 altas autorizadas |
| Restauración + migración + huellas/roles | Aprobadas; una sola temporal eliminada |
| PostgreSQL 39/39 | Histórico, NO reejecutado en este encargo |
| Suite API completa | NO ejecutada ni ampliado su permiso |
| Navegador visual / modo avión real | NO ejecutados: herramienta de navegador no disponible |

Hubo una corrección adicional de importación CJS de pg en el auxiliar de postcheck; ese intento falló antes de conectar y se repitió correctamente. No fue un defecto de producto. No se modificó código funcional, dependencias, roles ni migraciones para hacer pasar resultados. Los cambios de este encargo son documentación y artefactos operativos privados fuera del repositorio.

### Revisión manual final y publicación

Con API/Web existentes, abrir http://127.0.0.1:5000/acceso; usar privadamente QA_PROFESSIONAL_USERNAME/PASSWORD desde apps/api/.env. Abrir Clientes → Cliente QA EP04 → Evaluación. Comprobar las **6 evaluaciones**, tres antiguas sin método inventado y tres nuevas con métodos. Ver detalle y recargar; navegar a Resumen/Entrenamiento y volver al mismo cliente. Nueva evaluación debe abrir captura amplia; comprobar formularios, métodos/borradores, validaciones, teclado/foco, cancelación y vista móvil. Validar campos inválidos no crea altas. Si se prueba offline con un alta adicional QA, anotar su ID pendiente, reconectar y comprobar una única confirmada; no borrar la operación ni usar expedientes reales.

La revisión visual posterior R 7/7 queda aprobada; D0 sigue pendiente de revisión independiente y corrección/validación contractual. **Lista para solicitar revisión, no autorizada para push/PR ni declarada terminada.** ls-remote en esta integración confirmó main y rama remota iguales al HEAD local 33110ea7e6706842fb7ee7ad9aee76834fa1138e; no hubo fetch, integración de ramas, staging, commit, push ni despliegue. El estado remoto puede cambiar después. Mantener gates de despliegue/backup remoto separados.


## N. Prepublicación: revisión humana aprobada y contrato por corregir

### R — revisión manual reportada y aprobada por el usuario: 7/7

**Fuente:** mensaje de Pukzil de esta prepublicación. El usuario declara haber ejecutado personalmente y aprobado los siete puntos siguientes. **No es una prueba visual automática de Codex**, no se aportaron capturas ni fecha/hora exacta de ejecución y no se inventan. Esta aprobación no completa la revisión independiente D0.

1. Evaluación aparece dentro del expediente de Cliente QA EP04.
2. Se muestran las seis evaluaciones y sus fechas.
3. Detalles y recarga conservan el historial.
4. El formulario cambia entre Perímetros, Pliegues y Bioimpedancia.
5. Opcionales, errores y botones funcionan correctamente.
6. Diseño correcto en computadora y vista móvil.
7. Borradores, cancelación y recuperación offline funcionan según lo documentado.

Se obtuvo el inventario real: 55 candidatos (28 modificados/27 nuevos), mismo conjunto que el anterior. Ninguno descartado. Se comprobó exclusión de caché, ausencia de secretos en candidatos con límites del escaneo y preservación del original externo. Se retiró solo la ruta personal del backup de esta guía; el archivo de respaldo no se tocó.

La validación OpenAPI superó JSON/referencias: Ajv existente metavalidó 26 componentes, se verificaron parámetros/seguridad de 25 operaciones y se contrastaron requests/responses contra API/Web sin BD. Se hallaron discrepancias de vacío/null/regla de medición propia y documentación incompleta de GET/snapshot/errores. La combinación Ajv/esquema oficial falló también un control mínimo válido con Schema Object, así que **no hay validación oficial integral aprobada**; tampoco assertions automáticas de formatos. No se corrigieron contratos o funcionalidad sin autorización.

Se centralizan [matriz, hallazgos, inventario clasificado, dos commits exactos y borrador PR en revision-final.md](revision-final.md#prepublicación-final--revisión-del-contrato-inventario-y-propuesta-no-ejecutada). Plan: fix(repo): ignore generated vite cache (solo .gitignore) y feat(ep04): integrate dated client evaluations (otros 54 archivos). Cobertura exacta/unicidad verificada; no staging ni commits. El segundo está condicionado a corregir OpenAPI y superar confirmaciones de coordinación/branch/auto-deploy.

**Estado vigente:** lista para revisión independiente con observaciones, no para autorizar push todavía. Requiere corrección documental de contrato autorizada, aceptación del nombre de rama, coordinación shared, verificación de Render/Vercel y autorización expresa de publicación. Antes de merge además revisión/checks y corte de migraciones remotas. No hubo nuevas suites, SQL, migraciones, installs, roles, Git de escritura ni paneles remotos en esta prepublicación. La evidencia técnica 21/94/39/15 es histórica; la nueva aprobación visual es R 7/7, sin fecha exacta inventada y sin sustituir D0 independiente.


## O. Corrección contractual posterior autorizada — estado vigente

Los hallazgos OpenAPI OAS-01–06 de §N se corrigieron sin modificar la funcionalidad: solicitudes heredadas admiten null pero exigen una medida numérica; cada método exige medida propia distinta de peso/estatura; segmentos null se tratan como ausencia; GET/POST documentan errores y CSRF reales; snapshot tipa/requiere metadatos y Error.fields contempla INVALID_EVALUATION.

**T actual:** 105 contrastes (36 solicitudes válidas/69 inválidas) coinciden con validadores API; cuatro negativos de negocio adicionales verifican reglas que permanecen en servidor; cinco respuestas aceptadas por contrato/guard Web, cinco omisiones requeridas rechazadas y un Error.fields aceptado. 26 componentes, 105 referencias y 25 operaciones revisados; unitarias puras **11/11**. No son una repetición de PostgreSQL 39/39, Web 94/94 ni smoke 15/15 históricos.

Se usó Ajv instalado sin dependencias nuevas. La validación estructural alternativa con enlace explícito a 2020-12 pasó controles positivo/negativos y contrato; el montaje oficial dinámico sigue incompatible. **No afirmar validación oficial integral sin adaptación ni certificación completa de formatos RFC.** Reglas contextuales y entre campos continúan autoritativas en API. Ver [correcciones, límites y evidencia completa](revision-final.md#corrección-contractual-autorizada--evidencia-vigente).

Revisión visual **R 7/7 aprobada por usuario** conservada; no automatizada ni sustituye D0 independiente. Se retira el bloqueo concreto de las seis discrepancias corregidas; la aprobación contractual integral/independiente y coordinación/despliegue/nombre de rama siguen pendientes. Inventario y plan de commits sin cambios: **55 archivos (28 modificados/27 nuevos), 1+54 sin duplicados**. Solo se tocaron OpenAPI y tres documentos de evidencia; ningún archivo funcional, migración, BD, rol o permiso. HANDOFF externo intacto. No hubo staging, commit, push, PR ni cambio de rama.


## P. Preparación final de commits locales — sin ejecución

Comprobaciones nuevas: API build, Web build/lint aprobados; unitarias puras 11/11; Web completa 94/94 (repetición fuera del sandbox por bloqueo de socket también aprobada, con avisos no fatales de HMR/escaneo del arnés); Prettier 24 archivos y diff limpios. Contrastes OpenAPI 105/105 y respuestas/refs/consumidor aprobados en cobertura indicada; validación oficial sin adaptar sigue inconclusa. Sin escrituras SQL, migraciones, roles ni cambios funcionales. PG39/39, smoke15/15 y R7/7 son históricos conservados.

Fetch origin autorizado y completado: HEAD, origin/main y origin/feature/ep04-antropometria iguales a 33110ea7e6706842fb7ee7ad9aee76834fa1138e, sin cambios a integrar al consultar. Inventario 55 (28M/27N), mismo plan de dos commits 1+54, sin staging ni commit. Se solicita primero autorización de esos commits locales; el push requiere una segunda autorización y confirmación de riesgos externos Render/Vercel, coordinación y nombre de rama. D0 independiente pendiente. Evidencia/avisos y comandos en [validacion-local.md](validacion-local.md#t--última-comprobación-previa-a-commits-sin-publicación). No publicación, PR ni despliegue.
