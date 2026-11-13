# HU-022 — Consultar la evolución antropométrica y peso histórico

> **Estado vigente — etapa 5, solo preparación:** inventario de 32 archivos confirmado, cuatro commits y comandos explícitos preparados sin staging/commit/push. Consulta GitHub de solo lectura confirma rama EP-04 en 7ba0fb7 y main en 33110ea. QA técnica segura repetida: 27/27 puras, 9/9 HTTP dobles, 134/134 Web; evidencia física 8/8 histórica conservada. Revisión visual parcial aprobada, restantes y D0 independiente pendientes. Destino futuro exclusivo: feature/ep04-antropometria; main no se modifica.

## Estado real y alcance de etapa 1

Responsable: **Pukzil**. Como profesional, quiero comparar evaluaciones en el tiempo para observar cambios de peso y medidas. Referencias: RDF0505, RDF0802 y RDF0807. Dependencias: HU-021, DEC-006 y DEC-009. DoD: D0 más API1/WEB1/QA1 y conexión real al expediente.

**Solo contrato, modelos, validación y funciones puras preparados.** No hay endpoint funcional, SQL, repositorio nuevo, integración runtime del expediente ni gráfica. La declaración OpenAPI lleva `x-implementation-status: planned-stage-2`; no debe confundirse con disponibilidad del servidor. HU-022-API1 y QA1 están parciales; WEB1 pendiente. No se declara cierre ni revisión independiente D0.

Por instrucción explícita de Pukzil se continúa en `feature/ep04-antropometria`, sin crear otra rama. HU-021 permanece en los commits publicados `16ddfa4` y `7ba0fb7`; no se modifica su implementación ni evidencia. No hay commit/push autorizado para esta etapa.

## Fuentes y reglas

- [Plan: HU-022, DEC-006/009 y D0](../../../../plan/PLAN_TRABAJO_V2.md).
- [Requisitos internos](../../../requirements/sistema-interno.md).
- [Reglas API/capas](../../../../DEVELOPMENT.md), [Git/coordinación](../../../../CONTRIBUTING.md) y [convenciones](../../../database/convenciones.md).
- [HU-021 multimétodo](../hu-021/multimethod.md) y [HANDOFF](../hu-021/COUCHONEFIT_HU021_HANDOFF.md).
- [Contrato de integración del expediente](../../ep-03-cartera-y-expediente/hu-019/integracion.md).

Los documentos y sus secciones históricas no equivalen a decisiones clínicas nuevas. Navy/JP3/Siri siguen fuera de esta historia. Codebase Memory MCP no está disponible; se utilizó inspección estática.

## Archivos de esta etapa

| Ruta desde raíz                                             | Función                                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/api/src/features/evaluations/types/evolution.ts`      | DTO, periodo, posición, muestra, sección futura y catálogo de 17 métricas                                 |
| `apps/api/src/features/evaluations/validators/evolution.ts` | Query estricta y cursores HMAC ligados a contexto                                                         |
| `apps/api/src/features/evaluations/domain/evolution.ts`     | Proyección pura, comparación cronológica, pertenencia inclusiva al periodo y cantidad por métrica cargada |
| `apps/api/tests/evolution.test.ts`                          | Pruebas puras HU-022 y concordancia del catálogo con HU-021/OpenAPI                                       |
| `docs/api/identity-lifecycle.openapi.json`                  | Ruta futura y siete esquemas nuevos; contratos anteriores conservados                                     |
| `docs/epicas/ep-04-antropometria/hu-022/README.md`          | Alcance, decisiones y evidencia propia                                                                    |

No se registraron rutas ni se modificaron controladores, servicios, repositorios, SQL, Web o Flutter. El helper de proyección recibe una evaluación ya leída/autorizada: **no autoriza por sí mismo** ni sustituye validación del repositorio.

## Endpoint preparado para etapa 2

`GET /api/clients/{clientId}/evaluation-history`

Parámetros HTTP opcionales (strings en req.query):

| Parámetro    | Regla                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `from`, `to` | YYYY-MM-DD real, años 0001–9999, extremos inclusivos; si ambos existen, from <= to                                                       |
| `method`     | `perimetros`, `pliegues`, `bioimpedancia`, `legacy`; omitir incluye todos                                                                |
| `pageSize`   | Decimal canónico 1–100, predeterminado 20; no acepta espacios, signo, fracciones, ceros iniciales ni números JS en lugar del string HTTP |
| `cursor`     | Opaco HMAC, máximo 4096 caracteres, ligado al contexto y filtros                                                                         |

Valores vacíos, null explícito, arrays, objetos y parámetros desconocidos se rechazan con **400 INVALID_INPUT**. Un filtro temporal futuro no es una captura futura: puede consultar un rango sin datos; no se inventa una prohibición adicional. Las fechas de captura de HU-021 conservan sus reglas.

Ejemplo de consulta futura: `/api/clients/{clientId}/evaluation-history?from=2026-01-01&to=2026-11-12&method=legacy&pageSize=20`. La etapa 1 no hace que esta URL sea operativa.

### Modelos y respuesta

`EvolutionPage` contiene clientId, periodo normalizado (`from`/`to` null si se omiten), filtro method o null, orden `asc`, catálogo, muestras y pageInfo. Cada muestra tiene:

- `id` de evaluación y `clientId`.
- `date`, `dateBasis`, `createdAt`.
- `source: professional_evaluation` (tipo de origen, no identidad editable).
- `method`: método conocido o null para heredadas.
- `provenance`: declaración del snapshot o null; no prueba que cada campo venga del dispositivo.
- `protocol`: snapshot conocido o null.
- `measurements`: solo claves disponibles; nunca ceros ni valores de perfil para completar ausentes.

Una evaluación equivale a una muestra. Snapshot y columnas de compatibilidad **no se concatenan** como fuentes independientes. Se toman entradas originales del snapshot si existe; para heredadas, las columnas. No se leen results, perfil actual, peso base ni planes; no se recalcula ni escribe nada. Snapshot con fecha efectiva ausente/inválida falla explícitamente en lugar de atribuirle una fecha heredada. El mapeo no modifica el objeto recibido.

### Métricas y unidades

Catálogo derivado de los campos efectivamente capturados por HU-021; todas tienen `decimalPlaces: 1` (paso de captura/presentación 0.1, no precisión clínica). No redondear al proyectar.

| Métricas                                                                                                                                   | Unidad                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| weightKg, muscleMassKg                                                                                                                     | kg (peso corporal y masa muscular informada separados)     |
| heightCm, neckCm, waistCm, abdomenUmbilicalCm, hipCm                                                                                       | cm; cintura y abdomen umbilical distintos                  |
| pectoralSkinfoldMm, abdominalSkinfoldMm, tricepsSkinfoldMm, bicepsSkinfoldMm, subscapularSkinfoldMm, suprailiacSkinfoldMm, thighSkinfoldMm | mm, sitios distintos                                       |
| measuredBodyFatPercentage                                                                                                                  | % medido, nunca grasa calculada                            |
| waterLitres                                                                                                                                | L informado                                                |
| visceralFatIndex                                                                                                                           | índice del dispositivo, no porcentaje ni categoría clínica |

No incluye resultados calculados, sumas segmentales, diagnósticos, tendencias estadísticas o predicciones. Un índice de distintos equipos o protocolos no es automáticamente comparable. El catálogo usa los nombres existentes, sin cambiar unidades ni límites de HU-021.

## Fechas, orden y cursor

- Multimétodo: `date = assessment.effectiveDate`, `dateBasis = effective_date`.
- Heredada: `date = evaluationDate`, `dateBasis = legacy_evaluation_date`; no se supone fecha de captura física distinta de la guardada.
- createdAt sigue siendo creación técnica del servidor; **no es hora de medición**.
- Orden fijo ascendente `(date, createdAt, id)`. Varios registros del mismo día se conservan, sin promediar ni reemplazar.
- La comparación y cursor preservan hasta **seis decimales UTC** de createdAt. En etapa 2 el lector SQL deberá preservar la precisión PostgreSQL: el mapper actual HU-021 usa Date/ISO milisegundos y no puede recuperar microsegundos ya truncados. No se modifica ese mapper en esta etapa.
- Se sigue el patrón HMAC-SHA256 de `professional/validators/portfolio.ts`, con prefijo separado `evaluation-history:v1:`. El codec recibe una clave Uint8Array por inyección, sin cargar config/pool; etapa 2 utilizará la clave existente vía `jwtKey()`, no una credencial/variable nueva. Pruebas usan material sintético.
- Firma ligada a versión, sujeto autenticado, cliente autorizado, filtros from/to/method y pageSize. Reutilizar cursor con distinto contexto, filtro, tamaño o clave produce 400. Firma verificada con comparación constante; cuerpo y posición estrictos. La firma **no cifra** los identificadores; no registrar cursor/payload en logs.
- Cursor no concede acceso. Siempre repetir sesión/propiedad/RLS. Rotación de clave puede invalidar continuación: reiniciar consulta, no saltar autorización.
- `pageInfo.hasMore=true` exige nextCursor; false exige null. Una página no acredita que toda la serie esté cargada; no hay promesa de snapshot global entre requests ni total inventado. Altas concurrentes/retroactivas pueden requerir refresco.

## Estados y datos incompletos

El contrato admite página autorizada con `samples: []`. La función `evolutionMetricState` distingue `empty`, `single` y `multiple` por la métrica seleccionada **solo entre muestras cargadas**, no entre todas las filas de BD. Diez evaluaciones y un único peso siguen siendo una sola observación de peso. Los huecos se conservan, sin interpolar, arrastrar ni rellenar fechas.

La decisión de dibujar corresponde a Web posterior: cero/una observación no acreditan tendencia. Debe comunicar cobertura parcial cuando existan páginas pendientes.

`EvolutionSection` define el sobre **previsto, no conectado**: empty/available con history explícita y error/QUERY_FAILED para fallo recuperable. No se cambia `ProfessionalRecord` ni se convierte ahora not_integrated en empty. 401/403/404 no deben convertirse en vacío ni error parcial de éxito. Errores HTTP previstos: 400/401/403/404/503, usando el cuerpo Error existente.

## Seguridad e integración posteriores

Etapa 2 reutilizará requireProfessional, contexto RLS por transacción, propiedad de cartera y elegibilidad existentes. GET no introduce CSRF de mutación ni otra cola idempotente. Solo cliente propio; expediente inactivo conserva lectura según contrato actual. No se habilita lectura a clientes/admin ni flags móviles; DEC-009/HU-036 seguirán gobernando proyecciones por destinatario. No se crean roles, grants, tablas ni migraciones.

La evolución deberá conectarse al expediente sin cambiar las tres pestañas aprobadas de HU-021. Coordinar `sections.progress` y tratamiento de `bodyWeightHistory` con Franela/Ferxxo antes de conectar el payload; esta etapa solo define el sobre futuro. Caché de lectura por cuenta/periodo y recuperación offline se implementarán con infraestructura común en una etapa posterior, no están verificadas aquí para HU-022.

HU-037 incorporará después eventos móviles con su origen/calendario/versiones, **sin copiar peso a evaluaciones ni deduplicar por coincidencia de fecha/valor**. No hay lectores de esos eventos ni código anticipado de HU-037 en esta entrega.

## T — evidencia de esta etapa

Comandos locales sin PostgreSQL:

```bash
npm --prefix apps/api run build
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution.test.ts apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts
./apps/web/node_modules/.bin/prettier --check --single-quote --no-semi apps/api/src/features/evaluations/types/evolution.ts apps/api/src/features/evaluations/validators/evolution.ts apps/api/src/features/evaluations/domain/evolution.ts apps/api/tests/evolution.test.ts docs/api/identity-lifecycle.openapi.json docs/epicas/ep-04-antropometria/hu-022/README.md
git diff --check
```

Resultados finales ejecutados: **build API aprobado**, **23/23 pruebas aprobadas, cero fallos finales**; **12 pruebas nuevas HU-022 y 11 de regresión HU-021**. Casos: calendario/leap, límites inclusivos, query inválida, rangos/tamaños/métodos, firma alterada/incompatible, sujetos/clientes distintos, posición inválida, microsegundos/desempate, catálogo, proyección sin duplicados ni cálculos, procedencia heredada y cero/una/varias observaciones.

Durante la comprobación adicional se detectó que el generador rechazaba una muestra completa por tener propiedades extra a la posición; corregido localmente proyectando solo date/createdAt/id antes de firmar, manteniendo decodificación estricta. Se añadió regresión. En una ejecución intermedia, la guarda nueva de fecha tuvo un import faltante (build fallido y 5 pruebas fallidas); corregido y repetidos build, 23 pruebas y contrato con resultado aprobado. No se ocultaron ni atribuyeron fallos al código previo. También se protege la fecha efectiva faltante para no fabricar semántica histórica. No se tocaron validadores HU-021.

Validación de contrato con Ajv instalado y esquemas oficiales públicos cacheados fuera del repositorio: **33 componentes**, **117 referencias resueltas**, **26 operationId únicos**; siete páginas válidas aceptadas y ocho negativas rechazadas. Comparación profunda con HEAD: todos los contratos anteriores idénticos, solo un path y siete componentes añadidos. Controles positivo/negativo del esquema estructural adaptado correctos.

**Límite:** se utiliza el mismo enlace explícito en memoria de Schema Objects a JSON Schema 2020-12, evitando incompatibilidad previa de dynamicRef en el montaje Ajv/esquema oficial. No se declara validación oficial integral sin adaptación ni certificación RFC exhaustiva; formatos de instancias se verifican con comprobadores locales. La firma/contexto de cursor, relaciones temporales y autorizaciones requieren además servidor. Script diagnóstico temporal: `/private/tmp/cof-hu022-contract-check.mjs`, requiere copias temporales públicas; no es dependencia ni archivo de publicación.

No se ejecutan suites de aislamiento/migraciones/BD ni Web visual. RLS y endpoint HU-022 **pendientes de integración**, no acreditados por estas pruebas puras. HU-021 conserva su evidencia histórica, incluida revisión humana 7/7, sin presentarla como nueva verificación de HU-022.

## Pendientes para etapa 2

1. Autorizar implementación de lector/endpoints en esta misma rama.
2. Conectar validador al service y clave confiable; nunca datos de identidad de query.
3. Consulta SQL parametrizada por periodo/método/cursor con precisión y RLS; paginar sin duplicar.
4. Verificar rendimiento antes de justificar un índice nuevo (no propuesto ahora).
5. Implementar respuestas y errores conforme a contrato y pruebas HTTP/SQL aisladas autorizadas.
6. Conectar expediente coordinando DTO/consumidores; después Web/caché/gráfica y revisión humana/independiente D0.

Sin commits, push, PR, migraciones, permisos, bases ni despliegues en esta etapa. Estado contractual preparado no significa endpoint funcional ni HU terminada.

## Etapa 2 — API e integración de lectura

### Alcance implementado

`GET /api/clients/{clientId}/evaluation-history` está registrado en el router existente. Usa sesión profesional real, service que valida query/UUID y clave existente `jwtKey()`, lector parametrizado y normalización de etapa 1. Se retiró `planned-stage-2` después de verificar la ruta por HTTP con dobles; OpenAPI indica `implemented-stage-2`. Esto no acredita ejecución del SQL sobre PostgreSQL real.

Sin captura nueva, tabla gráfica, migración, índice ni eventos HU-037. No se modifica persistencia ni se recalculan snapshots. El listado/alta HU-021 conservan contratos e idempotencia.

### Archivos de etapa 2 (además de la base de etapa 1)

| Ruta desde raíz                                                          | Estado / motivo                                                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/features/evaluations/repositories/evolution.ts`            | Nuevo: consulta histórica filtrada/keyset y proyección sin pérdida de microsegundos                                                             |
| `apps/api/src/features/evaluations/services/evolution.ts`                | Nuevo: valida, consulta, recorta pageSize+1 y firma nextCursor                                                                                  |
| `apps/api/src/features/evaluations/repositories/evaluation.ts`           | Compartido HU-021: extrae el mismo guard de lectura para reutilizarlo; permite timestamp preciso opcional en mapper, manteniendo default previo |
| `apps/api/src/features/evaluations/controllers/evaluation.ts`            | Añade history sin validar reglas ni consultar BD en controller                                                                                  |
| `apps/api/src/features/evaluations/routes/evaluations.ts`                | GET con requireProfessional, sin modificar POST/CSRF/idempotencia                                                                               |
| `apps/api/src/features/professional/services/record.ts`                  | Compone progress por service público y distingue empty/available/error                                                                          |
| `apps/api/src/features/professional/types/record.ts`                     | progress usa EvolutionSection                                                                                                                   |
| `apps/api/src/features/evaluations/types/evolution.ts`                   | Actualiza el comentario del sobre ya conectado, conservando DTO                                                                                 |
| `apps/api/tests/evolution-api.test.ts`                                   | Nuevo: nueve pruebas HTTP con app/middleware/services/repositories reales y Pool sustituido                                                     |
| `apps/api/tests/evolution.test.ts`                                       | Actualiza estado esperado de ruta OpenAPI, conservando pruebas puras                                                                            |
| `apps/web/src/features/evaluations/types/evolution.ts`                   | Nuevo: tipos y guard de respuesta para el contrato del expediente                                                                               |
| `apps/web/src/features/professional/types/record.ts`                     | Acepta nuevo progress y estados anteriores de caché durante actualización                                                                       |
| `apps/web/src/features/professional/services/record.ts`                  | Valida muestras/cliente/unidades/paginación/orden antes de consumir progress                                                                    |
| `apps/web/src/features/professional/components/ClientRecordSections.tsx` | Compatibilidad mínima: reconocer available con texto, sin mostrar falso error; no se implementa tabla/gráfica                                   |
| `apps/web/tests/session-recovery.test.mjs`                               | Cuatro regresiones de contrato/expediente y rechazo de datos inconsistentes                                                                     |
| `docs/api/identity-lifecycle.openapi.json`                               | Estado real de ruta y vínculo ProfessionalRecord.progress; integridad de empty/available                                                        |
| `docs/epicas/ep-04-antropometria/hu-022/README.md`                       | Esta evidencia y límites, sin alterar documentación HU-021                                                                                      |

El diff incluye formato de los archivos tocados con Prettier, sin cambiar reglas de entrenamiento, autenticación, cartera o suscripciones. Avisar/coordinar revisión de archivos compartidos con Franela; la integración sigue la instrucción expresa de Pukzil y el contrato aprobado, sin decidir permisos de Ferxxo/HU-037.

### SQL, fecha y continuación

Consulta exclusivamente `private.client_evaluations e` para las muestras. Expresiones SQL fijas del servidor:

- Fecha: `COALESCE(to_jsonb(e)->'assessment'->>'effectiveDate',e.evaluation_date::text)::date`.
- Método persistido del snapshot; mapper existente traduce circumference/skinfolds/bioimpedance a DTO.
- Filtros inclusivos `>= from` y `<= to`, método o heredadas explícitas.
- Condición keyset nativa `(fecha,e.created_at,e.id) > (cursorDate,cursorCreatedAt,cursorId)` con casts date/timestamptz/uuid.
- Orden nativo ascendente, `LIMIT pageSize+1`, sin OFFSET, interpolación de datos de query ni columnas elegidas por el navegador.
- created_at se selecciona con `to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`. Se entrega al mapper como string preciso, evitando su conversión default a JavaScript Date. La comparación SQL usa el timestamp nativo, no el texto formateado.

Las ocho posiciones parametrizadas son: cliente, from, to, método persistido, fecha/timestamp/UUID de continuación y límite. El service devuelve solo pageSize y crea cursor desde la última muestra devuelta, no la fila adicional. No se promete snapshot entre solicitudes; nuevas altas retroactivas pueden requerir refresco. Rendimiento/plan de ejecución pendientes de medición real; no se añade un índice por suposición.

### Seguridad y expediente

El guard compartido ejecuta professionalOnly → readAsSubject/contexto transaccional → lockActor con bloqueo compartido/revalidación de sesión → assertPortfolio (profesional habilitado y propietario). RLS/grants no se cambian. Heredadas se identifican por ausencia de snapshot/método, no por inferencia anatómica. El cursor sigue ligado a sujeto/cliente/filtros; no reemplaza autorización en cada request.

El expediente primero obtiene perfil obligatorio y después las secciones existentes. progress consulta la misma primera página ascendente (20, sin filtros) por el nuevo service:

- `empty` con history.samples vacío tras consulta autorizada.
- `available` con history y muestras; hasMore/nextCursor distinguen cobertura parcial.
- `error/QUERY_FAILED` sin history si falla recuperablemente el lector.
- AuthError 400/401/403/404 se propaga y aborta expediente, nunca se degrada a empty/error parcial.

`bodyWeightHistory` permanece `not_integrated`: no copia peso ni implementa HU-037. La Web acepta metadatos cacheados anteriores y valida exhaustivamente el payload nuevo (cliente, métodos, fechas, origen, unidades, campos numéricos, orden, IDs únicos, pageInfo). Solo reconoce el estado disponible con mensaje básico; no hay interfaz de consulta por periodo ni gráfico todavía. Caché dedicada de evaluation-history pendiente para etapa Web.

### T — pruebas ejecutadas de etapa 2

```bash
npm --prefix apps/api run build
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution.test.ts apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution-api.test.ts
npm --prefix apps/web run build
npm --prefix apps/web run lint
# Suite Web desde apps/web, serial para evitar competencia entre servidores de test:
node --test --test-concurrency=1 tests/*.test.mjs
```

Resultados comprobados: **API build aprobado**, typecheck estricto adicional de los dos tests HU-022 aprobado, **23/23 puras** (12 HU-022 y 11 HU-021), **9/9 integración HTTP con dobles**, repetidas juntas con resultado **32/32**; **Web build/lint aprobados y 98/98 suite completa** (94 anteriores más cuatro de contrato HU-022). Build Web avisa de bundle >500 kB; arnés Web avisa de escaneo virtual:pwa-register sin plugin en su servidor de test; no hubo tests fallidos por esos avisos. No se alteró configuración para ocultarlos.

Las nueve HTTP verifican: vacío/una muestra; fechas técnicas precisas y efectivas retroactivas; tres páginas sin duplicar/omitir con fechas repetidas, microsegundos e IDs de desempate; límites inclusivos y todos los métodos/heredadas; parámetros/cursor inválidos; cursor entre clientes/profesionales; sesión inválida/revocada, roles cliente/admin, profesional no habilitado y dos carteras; expediente available/empty/error y propagación 403; historial intacto tras cambios de perfil/estado en memoria y listado HU-021; rollback/liberación ante fallo.

**Aislamiento del arnés:** Pool real tiene connect/query sustituidos por funciones que fallan, antes de importar app. La app real recibe un objeto Pool doble y JWT sintéticos; no se inicia sesión ni se crean usuarios en ninguna BD. El doble filtra/ordena fixtures en memoria y comprueba SQL/bindings/contexto. No es parser PostgreSQL ni acredita RLS física. La limpieza de sesión revocada del código existente se simula; no se ejecuta su UPDATE sobre ninguna base.

Incidencias de pruebas: primera ejecución HTTP bloqueada por EPERM del sandbox al abrir socket; se repitió con permiso. Un caso dio 503 porque el doble no incluía pool.query para la limpieza de sesión existente; se completó el doble y se repitieron las nueve con éxito. No se cambió autenticación para hacer pasar la prueba. En revisión final se endureció el consumidor: empty exige history real; solo not_integrated se acepta como metadata antigua. Se añadió una cuarta regresión Web y se repitió la suite: 98/98 aprobadas.

OpenAPI: validación estructural adaptada y metavalidación de **33 componentes**, **117 referencias**, **26 operationId únicos**; siete páginas válidas y ocho inválidas, más estados del sobre, comprobados. Se conserva la limitación del montaje oficial dinámico detallada en etapa 1. Contratos originales HU-021 intactos; cambio compartido intencionado solo en ProfessionalRecord.progress. No se afirma validación oficial integral ni pruebas físicas de PostgreSQL.

### IMPACTO SOBRE OTROS MÓDULOS

Revisados expediente/cartera, sesiones, HU-021, estados de entrenamiento y offline mediante la cobertura Web ejecutada y HTTP con dobles. Compartidos modificados: lector/tipos de expediente, consumidor/tipos/estado Web, router/controller de evaluaciones y helper de lectura/mapeo HU-021. Se mantiene autorización y se evita duplicarla. Nuevos estados no invalidan caché de metadatos anteriores. **Sin regresiones detectadas en las pruebas ejecutadas.** No se acredita que toda la suite PostgreSQL/RLS/auth/entrenamiento real haya pasado: **no verificada en esta etapa**, ni se declara aceptación D0.

### Pendientes para etapa 3 y cierre posterior

- Autorización de Web: tabla/gráfica accesibles, filtros, paginación, cobertura cargada, cero/una observación y estados offline; reutilizar el endpoint sin otra persistencia.
- Pruebas PostgreSQL reales de SQL, permisos/RLS y paginación física con microsegundos requieren autorización adicional y destino aislado verificado. No se ejecutó ni creó BD/rol ni se aplicaron migraciones.
- Medir rendimiento con datos representativos antes de proponer índices.
- Revisión independiente D0 y coordinación compartida; publicación solo con autorización posterior.

Toda la etapa sigue local, en feature/ep04-antropometria. No hubo commit, push, PR, cambio de rama, migración, cambios de permisos ni acceso a Supabase/Render/Vercel. La revisión visual R7/7 de HU-021 se conserva como histórica y no se atribuye a la interfaz futura HU-022.

## Etapa 3 — Interfaz Web, gráfica, tabla, filtros y lectura offline

### Alcance y ubicación

La navegación continúa **Clientes → Expediente → Resumen | Entrenamiento | Evaluación**. En Evaluación aparece **Evolución antropométrica**, seguida del historial/detalle original HU-021. La captura amplia y sus borradores no se rediseñan. En Resumen, Progreso muestra la cantidad de muestras de la primera página, su cobertura parcial y el último peso **de esa página**, nunca el último global si faltan páginas. «Ver evolución» usa la ruta ya existente `/app/clientes/{clientId}/evaluacion#evolucion-antropometrica`; no añade pestañas ni rutas globales.

Documentos revisados: AGENTS.md, DEVELOPMENT.md, CONTRIBUTING.md, plan HU-022/DEC-006/DEC-009/D0, RDF0505/0802/0807, documentación HU-021/HU-022, contratos, diseño Web e infraestructura offline. `ui-ux-pro-max` se leyó y consultó para visualización/accesibilidad; se conserva el sistema visual existente. MCP Codebase Memory no disponible: inspección estática, sin atribuir consultas al grafo.

### Archivos de etapa 3 (rutas desde raíz)

| Ruta                                                                     | Estado en esta etapa y responsabilidad                                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/evaluations/components/EvolutionSection.tsx`      | Nuevo: filtros, estados, cobertura cargada y composición de tabla/gráfica                                            |
| `apps/web/src/features/evaluations/components/EvolutionChart.tsx`        | Nuevo: SVG nativo de puntos por fecha real, foco/teclado y leyenda de métodos                                        |
| `apps/web/src/features/evaluations/components/EvolutionTable.tsx`        | Nuevo: tabla semántica, unidades, origen, procedencia, protocolo y detalle de ID/creación                            |
| `apps/web/src/features/evaluations/components/EvolutionSummary.tsx`      | Nuevo: resumen acotado a primera página y acceso dentro del expediente                                               |
| `apps/web/src/features/evaluations/hooks/useEvolution.ts`                | Nuevo: paginación, exclusión de respuestas obsoletas, cambio de cuenta y recarga tras sync                           |
| `apps/web/src/features/evaluations/services/evolution.ts`                | Nuevo: lector con sesión, validación de respuesta/filtros y caché por cuenta                                         |
| `apps/web/src/features/evaluations/utils/evolution.ts`                   | Nuevo: periodos inclusivos UTC, fechas/unidades, orden preciso y unión por ID                                        |
| `apps/web/tests/evolution-web.test.mjs`                                  | Nuevo: pruebas DOM, gráfica, filtros, carreras y offline con respuestas sintéticas                                   |
| `apps/web/src/features/evaluations/pages/EvaluationsPage.tsx`            | Integración mínima de la sección fuera de captura; recibe cuenta autenticada                                         |
| `apps/web/src/features/professional/pages/ProfessionalPage.tsx`          | Pasa account.id existente a la vista de Evaluación; conserva límites de cuenta/cliente                               |
| `apps/web/src/features/professional/components/ClientRecordSections.tsx` | Sustituye estado básico de progress por resumen; alimentación/bodyWeightHistory se conservan                         |
| `apps/web/src/services/offline/readCache.ts`                             | Lista permitida de lectura histórica, guard opcional de cuenta/consulta e invalidación solo de páginas históricas    |
| `apps/web/src/features/evaluations/services/evaluations.ts`              | Tras alta confirmada y respuesta válida HU-021, invalida lecturas de evolución; no cambia envío, DTO ni idempotencia |
| `apps/web/tests/session-recovery.test.mjs`                               | Regresión integrada Resumen → Evaluación → captura; adapta expectativas de textos/filtros manteniendo protecciones   |
| `docs/epicas/ep-04-antropometria/hu-022/README.md`                       | Esta evidencia, límites y pasos manuales                                                                             |

No se editan archivos API, contratos OpenAPI, migraciones, estilos globales, dependencias ni documentación histórica de HU-021 durante esta etapa. El tipo/guard Web evolution.ts ya era parte de la etapa 2 y se reutiliza.

### Filtros y paginación

- Medición: una de las 17 del catálogo HU-021. Solo afecta la vista; nunca se envía `metric` a API.
- Método: todos, perimetros, pliegues, bioimpedancia o legacy. No se inventa método para heredadas.
- Desde/Hasta personalizados con calendario real y rechazo de rango invertido antes de pedir datos.
- Accesos rápidos: últimos 30/90/365 días **incluyendo hoy UTC** y todo el historial. Por ejemplo, 30 días hasta 2026-03-01 empiezan 2026-01-31.
- Consulta usa únicamente from/to/method/pageSize=20/cursor. Cada respuesta se contrasta con cliente y filtros exactos, además del guard del DTO.
- «Cargar más evolución» usa nextCursor, conserva todas las muestras únicas por ID y orden ascendente `(date, createdAt, id)`, con seis decimales del timestamp para desempate. No convierte creación técnica en hora de medición.
- Se advierte **consulta incompleta** mientras hasMore; el fin solo acredita las páginas consultadas, no un snapshot entre solicitudes. Nuevas altas retroactivas requieren actualizar.
- Generaciones de consulta y contexto impiden mezclar respuestas tras cambiar cliente, cuenta, periodo, método o medición; botones de paginación bloquean envíos simultáneos.

### Gráfica, tabla, estados y accesibilidad

Se dibujan **puntos sin segmentos ni curvas**: no se interpolan ausencias ni se sugieren tendencias con cero/una medición. Varios registros en la misma fecha tienen la misma coordenada temporal, sin inventar horas; cada punto mantiene ID, foco y detalle en tabla. Puntos coincidentes pueden superponerse visualmente: se distinguen por teclado, detalle e identificador de cada fila, sin separación temporal ficticia.

La tabla conserva también filas sin la métrica seleccionada como «Sin medición», nunca cero. Muestra fecha efectiva/heredada, valor con una decimal/unidad, método, origen profesional y procedencia declarada; esta última no garantiza el origen de cada campo. No se mezclan cintura/abdomen ni grasa medida/estimada. El índice visceral se ofrece solo en tabla: no se supone comparabilidad entre equipos. No hay resultados calculados, diagnósticos, predicciones o implementación HU-037.

Tabla con caption/th/scope y región desplazable enfocada; SVG con descripción, unidades, formas por método, controles de puntos por teclado y detalle aria-live. Controles etiquetados, botones de al menos 44 px, filtros adaptables, gráfica ajustada al ancho y tabla con desplazamiento horizontal en móvil. Cero muestras, cero valores de la métrica, un valor, carga, error recuperable y acceso denegado tienen mensajes diferentes. 401/403/404 no se presentan como vacío.

### Offline, cuenta y sincronización

Se reutilizan readCache/store/crypto/session y los eventos onSynced existentes. No hay otra cola ni almacenamiento de tokens. Endpoint completo (cliente + periodo + método + cursor) se usa como clave cifrada/fingerprint por cuenta. No se deriva una consulta de otra ni se completan páginas no visitadas. Se informa fecha de caché y cobertura incompleta; sin página guardada se pide conexión. Almacenamiento no disponible se degrada sin inventar datos.

Cambio de cuenta/cierre de sesión descarta las muestras visibles y bloquea respuestas antiguas. Los guardas opcionales añadidos a rememberRead/recallRead evitan guardar/entregar una respuesta HU-022 bajo otra cuenta, sin cambiar las llamadas existentes de otros módulos.

Tras sincronizar la outbox, se invalidan solo lecturas etiquetadas de evolution-history de la cuenta y se refresca la vista; se conservan cachés de otros módulos y operaciones pendientes. Tras alta online confirmada HU-021 se aplica la misma invalidación para que otros periodos guardados no queden obsoletos. Si falla la invalidación se rehúsa usar esa caché potencialmente obsoleta. Evaluaciones pendientes/fallidas no entran en la serie confirmada.

### T — verificación de etapa 3

Resultados finales de esta ejecución: **Web 122/122, cero fallos/cancelaciones**, incluyendo 23 pruebas nuevas dedicadas y una regresión de navegación integrada. **API puras 23/23** (12 HU-022 + 11 HU-021), sin PostgreSQL. **Build Web, lint sin advertencias, Prettier de archivos tocados y git diff --check aprobados**. Las cifras 98 Web / 32 API de etapa 2 siguen siendo históricas. Build conserva el aviso de bundle >500 kB; el arnés Vite conserva el aviso de escaneo de virtual:pwa-register, sin fallos de pruebas. No se cambiaron dependencias/configuración para ocultarlos.

Comandos desde raíz:

```bash
npm --prefix apps/web run build
npm --prefix apps/web run lint
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution.test.ts apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts
# Desde apps/web:
node --test --test-concurrency=1 tests/*.test.mjs
# Desde raíz: Prettier instalado, solo rutas Web/documentación tocadas.
# git diff --check
```

Pruebas nuevas: calendarios y límites inclusivos, orden microsegundos/IDs, cero/una/múltiples, huecos, unidades, misma fecha, teclado y ancho móvil simulado, métodos/procedencia, filtros, páginas parciales/carga y deduplicación, errores recuperables y 403, respuestas de cliente/filtros obsoletas, logout y cambio de cuenta, caché exacta/no disponible/parcial, sync HU-021 y alta online confirmada invalidando evolución, preservación de otras cachés/outbox. Regresión integrada abre evolución desde Resumen con el mismo cliente y mantiene captura HU-021.

Incidencias observadas: primera prueba Vite informó EPERM de socket dentro del sandbox; se repitió con permiso para sockets locales. Expectativas antiguas contaban progress como placeholder y exigían ausencia de cualquier select en Evaluación: se adaptan a su nuevo resumen y a filtros de métricas/métodos, manteniendo ausencia de selector de clientes y escrituras. Dos ejecuciones intermedias de la suite completa se interrumpieron al revisar esas expectativas antiguas (incluida una aserción que intentaba imprimir un nodo select completo); no se registran como aprobadas. Tras actualizar las expectativas pertinentes, la ejecución final terminó: 122/122, sin fallos ni cancelaciones. No se ajustó lógica de otras épicas para ocultarlos.

### E — contrato y límites de evidencia

Contrato Web reutiliza los tipos/guard de etapa 2 y no cambia OpenAPI. La comprobación adaptada de OpenAPI se repitió: 33 componentes, 117 referencias, 26 operationId únicos, siete páginas válidas y ocho inválidas; HU-021 y secciones ajenas de record conservadas. Continúa la limitación del validador oficial dinámico descrita anteriormente: no es certificación OpenAPI integral.

**No se ejecutó PostgreSQL ni se crearon bases, roles, migraciones o datos.** No se acredita RLS física ni rendimiento SQL. Pruebas DOM/ResizeObserver y ancho simulado no equivalen a revisión visual real ni lector de pantalla. La aprobación visual humana R7/7 previa pertenece a HU-021; no se traslada a esta interfaz nueva.

### IMPACTO SOBRE OTROS MÓDULOS

Compartidos: ProfessionalPage (paso de identidad existente), ClientRecordSections (solo progress), readCache (extensión optativa y eliminación solo de lecturas históricas) y servicio de alta HU-021 (invalidación posterior a confirmación). No se modifica autenticación, CSRF, reglas de cartera, suscripciones, entrenamiento, motor de sync, outbox, Flutter, API ni BD. Regresión Web cubre sesiones/cambio de cuenta, cartera/expediente, estados y captura HU-021, idempotencia/offline y entrenamiento según suite. **Sin regresiones detectadas en las pruebas ejecutadas.** La verificación física de esas capas no está autorizada en esta etapa.

### Revisión manual y etapa 4

1. Iniciar los servicios existentes (`npm --prefix apps/api run dev`, `npm --prefix apps/web run dev`) con configuración local ya autorizada, sin aplicar migraciones.
2. Abrir http://127.0.0.1:5000, iniciar sesión con el mecanismo QA local autorizado y abrir Clientes → expediente sintético.
3. En Resumen, comprobar Progreso y «Ver evolución»; debe abrir Evaluación del mismo cliente, sin una pestaña nueva ni selector de cliente.
4. Revisar métricas, periodos/fechas inclusivas y método; comprobar tabla y puntos reales, también días repetidos. No deberían aparecer ceros por ausencia ni curva con un solo valor.
5. Si hay más de 20, confirmar advertencia de incompleto y cargar más; no crear datos adicionales solo para producirla sin autorización.
6. Consultar un periodo con conexión, simular offline y actualizar; comprobar etiqueta de caché. Otro periodo no visitado debe indicar falta de datos guardados, no historial vacío.
7. Revisar teclado/Tab, foco de puntos y desplazamiento de tabla en ancho móvil; confirmar que captura, borradores e historial HU-021 siguen disponibles.
8. No crear evaluaciones nuevas durante esta revisión sin autorización específica; pruebas sintéticas automatizadas ya cubren invalidación y sync.

Pendiente para etapa 4: autorización del arnés y pruebas físicas PostgreSQL/aislamiento/RLS/paginación microsegundos, rendimiento si procede, revisión visual humana de HU-022/accesibilidad con dispositivos, revisión independiente D0. No se propone migración por suposición ni se implementa HU-037. Sin commits, push, PR o cambio de rama; se detiene al terminar etapa 3.

### Inventario final y preservación de etapas anteriores

Git al cierre: rama `feature/ep04-antropometria`, HEAD `7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6`, índice vacío, **14 archivos rastreados modificados y 17 nuevos sin seguimiento** (31 en total, incluyendo etapas 1–2 conservadas). En esta etapa se añadieron ocho archivos y se editaron seis archivos Web existentes más este README ya local. No se hicieron commits ni publicación.

La comparación SHA-256 contra el inventario tomado al iniciar etapa 3 confirma que **ningún archivo API de etapas 1–2 ni OpenAPI cambió durante etapa 3**. Tampoco hay migraciones nuevas ni archivos SQL afectados. El guard/tipo Web de evolución y los servicios/tipos de expediente de etapa 2 se conservaron. `.vite/`, `.env` y dist siguen ignorados; revisión de rutas candidatas y patrones de secretos (claves privadas, tokens y URLs con contraseña) sin hallazgos. Esto es una comprobación delimitada, no certificación exhaustiva de ausencia de secretos.

Documentación actualizada solo aquí; HANDOFF/evidencia HU-021 permanecen sin cambios. No se ejecutó revisión visual real ni se crearon registros QA adicionales. Se detiene la implementación antes de etapa 4.

## Etapa 4 — Preflight previo a autorización de escrituras (histórico)

> Esta sección conserva la evidencia y los bloqueos previos. La autorización posterior y sus resultados se registran al final; no deben confundirse con los pendientes actuales.

### Alcance y reglas comprobadas

Se volvieron a revisar AGENTS.md, DEVELOPMENT.md, CONTRIBUTING.md, plan HU-022/DEC-006/009/D0, RDF0505/0802/0807, documentación HU-021/HU-022, convenciones y procedimiento de pruebas PostgreSQL. Codebase Memory MCP no disponible; inspección estática. `ui-ux-pro-max` consultada para revisión de teclado/tablas accesibles, sin cambios visuales. No se atribuye una inspección visual a herramientas de DOM.

La autorización de etapa 4 permite lecturas y pruebas seguras; exige permiso específico **antes de escribir fixtures, crear/eliminar bases/roles o cambiar permisos**. No se ejecutaron esas operaciones ni migraciones. No se utilizaron credenciales QA para hacer login, porque ese flujo crea una sesión persistida; tampoco se fabricaron sesiones en la base.

### T — entorno físico comprobado, exclusivamente lectura

- PostgreSQL **17.11 Homebrew**, `server_version_num=170011`, servidor `127.0.0.1:5433`, confirmado mediante SQL. No se contactó el puerto 5432 ni Supabase.
- Rol de inspección local `yutzilsanchez` existente: superuser/CREATEDB/CREATEROLE/BYPASSRLS. Se utilizó solo para catálogos y lectura. No se modificó ni se creó ningún rol.
- Runtime `couchone_api`: sin superuser, BYPASSRLS, CREATEDB ni CREATEROLE. Las lecturas de evolución se comprobaron además conectando realmente con este runtime, no mediante consultas de superusuario presentadas como RLS.
- API `.env` ignorado configura DATABASE_URL hacia `CouchOneFit_dev` local, runtime `couchone_api`, puerto 3000 y CORS de localhost/127.0.0.1:5000. AUTH_JWT_SECRET y credenciales QA presentes sin exponer sus valores. No hay TEST_DATABASE_URL en ese archivo; no se inventó ni se añadió.
- Web sin `.env`; Vite versionado escucha 127.0.0.1:5000 y proxy `/api` a 127.0.0.1:3000. Procesos ya activos con cwd de apps/api y apps/web; no se terminaron ni reiniciaron.
- Bases de aplicación existentes: dev y test. Ningún foreign server registrado en ambas bases; esto no certifica otras conexiones externas ni la procedencia de todas las filas.

| Base local         | Migraciones/checksums                                                                                                                     | Datos observados                                                                     | Consecuencia                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CouchOneFit_test` | **27**, sin divergencias LF/CRLF; faltan `202611090001_multimethod_evaluations.sql` y `202611100001_evaluation_measurement_integrity.sql` | 15 cuentas (10 professional, 2 client, 3 admin), cero expedientes, cero evaluaciones | No permite casos físicos de historia; origen sintético de las cuentas no acreditado, aunque sea local. No se migró ni se escribió   |
| `CouchOneFit_dev`  | **29**, todos los checksums coinciden, sin migraciones pendientes                                                                         | Dos expedientes, seis evaluaciones                                                   | Se seleccionó solo el expediente con etiqueta QA y propietario coincidente con la cuenta QA configurada para consultar la evolución |

Se inspeccionó ENABLE RLS y las políticas SELECT/INSERT de client_evaluations. En dev está también la política restrictiva de propietario del snapshot. Las huellas SHA-256 de IDs de clientes y filas de evaluaciones se conservaron localmente fuera del repositorio y se comparan antes/después; no se publican datos clínicos, credenciales ni filas del respaldo. El esquema integrado y las migraciones HU-021 no se modifican.

### T — consulta PostgreSQL real y RLS de lectura

Se ejecutó el SELECT actual de `repositories/evolution.ts`, conservando sus expresiones SQL fijas y ocho parámetros, contra el cliente QA verificado. Las transacciones usaron `BEGIN READ ONLY` y `default_transaction_read_only=on`. El script de inspección no llama al service de escritura ni a login.

Comprobado físicamente:

- Runtime ordinario propietario obtiene **seis evaluaciones**: **tres heredadas y tres snapshots**, una por cada método.
- Mapper y proyección reales conservan ID/cliente, fecha efectiva o heredada, origen profesional y valores disponibles de cada snapshot; no completan desde perfil.
- Recorrido keyset con pageSize 2 coincide exactamente, por IDs y orden, con la consulta completa: **sin duplicados ni omitidos en estas seis filas**.
- Hay **dos fechas históricas distintas** y evaluaciones repetidas en una fecha. Los seis timestamps existentes incluyen fracciones no nulas posteriores a milisegundos; el SELECT conserva seis decimales.
- `from=to` incluye el día seleccionado. Filtro legacy devuelve tres filas; circumference/skinfolds/bioimpedance una cada uno. Se comprobaron las ramas SQL, no solo un doble del repositorio.
- Los campos opcionales nulos existentes se conservan como ausencia en la proyección; no se recalculan ni completan resultados históricos.
- Un contexto de sujeto inexistente no obtiene filas por RLS.
- Runtime no tiene permisos de tabla UPDATE ni DELETE de evaluaciones.

**Límites importantes:** no existe otra cuenta profesional/cliente/admin en dev para probar una segunda cartera real. No se atribuye esa cobertura al sujeto inexistente. No se crearon fechas retroactivas especiales, límites numéricos, roles ni sesiones para ampliar fixtures. Las lecturas SQL no constituyen una prueba HTTP autenticada completa ni prueban `lockActor`/revalidación de sesión. No se promete snapshot entre solicitudes.

### T — HTTP local real y HTTP con dobles

GET locales reales, sin autenticación ni escrituras:

| Ruta                                                              | Resultado actual     |
| ----------------------------------------------------------------- | -------------------- |
| API `/api/health`                                                 | 200                  |
| API `/api/clients/{uuid-sintetico}/evaluation-history` sin sesión | 401 SESSION_REQUIRED |
| API `/api/clients/{uuid-sintetico}/record` sin sesión             | 401 SESSION_REQUIRED |
| Web `/app/clientes`                                               | 200, HTML servido    |

Estas respuestas no acreditan login ni recorrido visual ni un 200 autenticado de la nueva ruta. La suite `evolution-api.test.ts` ejecutó aparte **9/9** con app/HTTP reales y Pool doble bloqueando cualquier conexión PostgreSQL real: estados vacío/una muestra, fechas/microsegundos/retroactividad y tres páginas, filtros, validación/cursor, cambio de cartera, cliente/admin, sesión revocada/no habilitado, expediente available/empty/error, propagación de denegaciones, historial tras ediciones sintéticas y rollback. Es evidencia simulada en persistencia, no RLS física entre dos profesionales.

No se utilizó login/refresh/logout real ni una sesión expirada: esos flujos pueden escribir sesiones/tokens o limpieza de revocación y necesitan autorización específica. El GET sin sesión se rechaza antes de consultas de limpieza.

### T — pruebas automatizadas y calidad repetidas en etapa 4

| Comprobación                                                                                | Resultado de esta ejecución            | Naturaleza                                                                     |
| ------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `evolution.test.ts`, `assessment.test.ts`, `evaluations.test.ts`, `saas-validation.test.ts` | **27/27**, cero fallos                 | Puras: 12 HU-022, 11 HU-021 y 4 SaaS                                           |
| `evolution-api.test.ts`                                                                     | **9/9**, cero fallos                   | HTTP app real / PostgreSQL doble                                               |
| Suite Web completa serial                                                                   | **122/122**, cero fallos/cancelaciones | DOM/JSDOM, HTTP simulado y almacén cifrado en memoria                          |
| API build                                                                                   | Aprobado                               | TypeScript estricto                                                            |
| Web build                                                                                   | Aprobado                               | TypeScript + Vite                                                              |
| Web lint                                                                                    | Aprobado                               | Oxlint sin advertencias                                                        |
| OpenAPI adaptado                                                                            | Aprobado dentro del alcance indicado   | 33 componentes, 117 referencias, 26 operaciones, 7 páginas válidas/8 inválidas |

No se presenta 39/39 PostgreSQL histórico HU-021 ni R7/7 visual HU-021 como repetidos ni como aceptación de HU-022. Continúa la limitación del validador OpenAPI oficial dinámico: la validación adaptada y los controles negativos no equivalen a certificación integral oficial. Build Web advierte bundle >500 kB y el arnés de test advierte escaneo de virtual:pwa-register; no se ocultaron ni exigieron cambios globales.

Comandos ejecutados desde raíz (suite Web desde apps/web):

```bash
npm --prefix apps/api run build
npm --prefix apps/web run build
npm --prefix apps/web run lint
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution.test.ts apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts apps/api/tests/saas-validation.test.ts
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution-api.test.ts
# Desde apps/web, no npm test de API con PostgreSQL:
node --test --test-concurrency=1 tests/*.test.mjs
```

Las consultas de inspección y comprobación física fueron scripts temporales fuera del repositorio (`/private/tmp/cof-hu022-stage4-readonly.cjs` y `cof-hu022-stage4-sql.mjs`), sin secretos literales. Comprobaron destino en SQL antes de consultar datos, usaron la conexión runtime existente y no constituyen un arnés físico portable todavía. No se autorizó instalar dependencias ni modificar .env.

### Pruebas bloqueadas y autorización solicitada

Se inspeccionaron los arneses de `migrations.test.ts` y `client-read-isolation.test.ts`; **no se ejecutaron**. El primero crea cuatro bases propias y un rol; el segundo una base `cof_read_<aleatorio>` y un rol con el mismo nombre, prepara esquema y fixtures, efectúa DML/DDL de pruebas y elimina únicamente lo creado al terminar. El esquema integrado incluye CREATE de roles globales y `GRANT couchone_registration TO couchone_authentication`; por ello no se ejecutó directamente bajo la autorización de solo lectura.

Se solicitó permiso específico para **un nuevo arnés HU-022, una base y un rol `cof_hu022_<aleatorio>`**, cargando únicamente fixtures sintéticas y limpiando solo esos dos recursos comprobados como inexistentes al inicio. Propuesta: reutilizar roles técnicos existentes, omitir únicamente los bloques de administración global revisados, sin crear/modificar membresías globales, ni tocar dev/test o couchone_api. **No está ejecutado ni autorizado por el mero hecho de documentar la propuesta.**

Fixtures necesarias para la cobertura pendiente: dos profesionales con carteras distintas, profesional no habilitado, cliente vinculado, administrador, sesiones válidas/revocadas, expediente activo/inactivo/inexistente, muestras heredadas y tres métodos, fechas repetidas/retroactivas con timestamps separados por microsegundos e IDs de desempate, más de 20 filas, campos omitidos y límites válidos. Casos inválidos deben rechazarse por API/SQL; cambios de perfil/estado solo dentro de esas fixtures temporales. También se necesita fallo de lector controlado para estado error y propagación de permisos, sin alterar tablas de bases preexistentes.

### R — revisión visual HU-022 pendiente

No hay navegador de inspección disponible en las herramientas de esta ejecución. DOM, SVG y ancho 240 simulado **no** equivalen a prueba visual real ni revisión con lector de pantalla.

Usar servicios ya activos: http://127.0.0.1:3000 y http://127.0.0.1:5000. Entrar con el mecanismo local QA autorizado (sin publicar sus valores). Si se necesita un nuevo login o una captura QA durante esta etapa de solo lectura, autorizar primero esa escritura de sesión/evaluación.

1. Clientes → Cliente QA EP04 → Resumen → Progreso → Ver evolución. Debe permanecer el mismo cliente y abrir Evaluación, sin nueva pestaña principal ni selector de clientes.
2. Comprobar las 17 mediciones y unidades. Peso/cintura/abdomen no deben mezclarse; registros sin valor muestran ausencia, no cero.
3. Aplicar 30/90/365 días, todo el historial y from/to del mismo día; revisar fechas del periodo y validar rango invertido sin consulta.
4. Filtrar heredadas y cada método. Cero valores no dibuja gráfica; un valor muestra fecha/unidad sin curva; múltiples valores conservan cada evaluación.
5. Recorrer tabla y puntos con Tab/Enter/Espacio, revisar detalle/ID de registros coincidentes y foco. En móvil, tabla desplazable sin desbordar el expediente y filtros legibles.
6. Con seis filas no existe siguiente página; no declarar probado el botón con datos reales. La prueba simulada de más de 20 sí pasó, pero el caso físico requiere las fixtures pendientes.
7. Consultar un periodo online y luego offline: debe indicar caché de la cuenta. Periodo/página no visitados no deben presentarse como vacío confirmado. Probar cambio de cuenta requiere autorización de login/logout si escribe sesiones.
8. Abrir captura HU-021, cambiar métodos y volver sin guardar; confirmar conservación de borradores y protección de descarte. No registrar ni editar datos durante la revisión sin permiso.

### IMPACTO SOBRE OTROS MÓDULOS y cierre parcial

**Sin regresiones detectadas en las pruebas ejecutadas**: HU-021, sesiones/cartera/expediente, entrenamiento, offline/outbox, sincronización e idempotencia según cobertura Web y HTTP con dobles. No se afirmó que toda la suite PostgreSQL de autenticación/entrenamiento/SaaS se repitiera: permanece sin ejecutar por sus escrituras. `bodyWeightHistory` y HU-037 se conservan fuera de integración.

No se detectó un defecto funcional que justifique modificar código. En esta etapa solo se actualiza este README; sin cambios en archivos compartidos, migraciones ni evidencia HU-021. Las etapas 1–3 locales se conservan.

| Tarea / criterio                       | Estado etapa 4                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| HU-022-API1                            | Implementada; SQL real de lectura y HTTP con dobles aprobados; HTTP físico autenticado pendiente                           |
| HU-022-WEB1                            | Implementada; 122/122 Web y build/lint aprobados; revisión visual humana HU-022 pendiente                                  |
| HU-022-QA1                             | Parcial: faltan fixtures físicas y aislamiento entre carteras/sesiones reales                                              |
| Fechas/orden/unidades/opcionales       | Verificados con seis muestras reales QA y casos puros/DOM; límites y fixtures extendidas físicas pendientes                |
| Conservación tras edición/inactivación | Simulada HU-022 y evidencia histórica HU-021; no repetida físicamente en esta etapa                                        |
| D0                                     | No completado: faltan integración física ampliada, recorrido app real aprobado y revisión independiente de otro integrante |
| Preparación de commits/publicación     | No autorizada; no lista para cierre ni etapa 5 mientras esos pendientes obligatorios sigan abiertos                        |

No hubo commit, staging, push, PR, merge, cambio de rama, despliegue, creación/eliminación de recursos ni acceso a entornos compartidos. Se mantiene `feature/ep04-antropometria` y HEAD publicado HU-021 `7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6`.

### Cierre de comprobaciones seguras de etapa 4

Prettier comprobó todos los candidatos Web, OpenAPI y este README: aprobado. `git diff --check` limpio; enlaces internos del README sin roturas. Escaneo delimitado de rutas generadas y patrones de claves privadas/tokens/URLs con contraseña sin hallazgos en candidatos. `.vite/`, `.env` API y dist siguen ignorados. No es una auditoría exhaustiva de todos los secretos posibles.

Se repitió la lectura de huellas: IDs de clientes y contenido de evaluaciones **sin cambios en dev y test** respecto al preflight de esta etapa. Dev conserva 2 expedientes/6 evaluaciones; test 0/0. No se imprimieron ni guardaron filas clínicas en el informe; las baselines temporales contienen solo huellas.

Inventario final conserva **14 rastreados modificados y 17 nuevos sin seguimiento**, acumulados de etapas 1–3. Índice vacío, rama y HEAD sin cambios. La única edición versionable de esta etapa es este README, ya sin seguimiento desde etapa 1. Scripts temporales de inspección no se proponen para publicación; ningún .env, respaldo o caché fue incorporado.

Estado: comprobaciones seguras completadas; **etapa 4 parcial/bloqueada para fixtures físicas hasta autorización específica**. No se avanza a etapa 5, no se prepara staging y no se afirma lista para publicación. La solicitud de permiso para el arnés temporal permanece pendiente; el transcurso del tiempo no implica aprobación.

## Etapa 4 — Ejecución física autorizada (evidencia vigente)

### Autorización y alcance

La persona usuaria autorizó expresamente una base y un rol temporales nuevos `cof_hu022_<identificador>`, solo en PostgreSQL 17 `127.0.0.1:5433`, fixtures sintéticas, pruebas SQL/API/RLS y eliminación exclusiva de esos recursos. No autorizó cambiar dev/test, roles técnicos preexistentes, migraciones originales, entornos remotos o publicaciones. Esa autorización sustituye únicamente el bloqueo de fixtures del preflight histórico anterior.

**Archivo nuevo:** `apps/api/tests/evolution-postgres.test.ts`. No se modificaron servicios, validadores, repositorios, Web ni migraciones durante esta continuación. Este README registra la evidencia; no se toca la documentación histórica HU-021.

### Seguridad del arnés revisada antes de ejecutar

- Omisión predeterminada sin `HU022_TEMPORARY_PG_AUTHORIZED=yes`. No consume DATABASE_URL/TEST_DATABASE_URL heredadas para preparar recursos.
- Exige conexión separada HU022_SETUP_DATABASE_URL a **127.0.0.1:5433/postgres**, verifica dirección/puerto/base/versión por SQL y requiere PostgreSQL 17.
- Nombres aleatorios propios de 20 dígitos hexadecimales; verifica previamente que base y rol no existen.
- Comprueba atributos y membresías de los roles técnicos existentes antes de usarlos.
- Carga el esquema integrado en la nueva base, **sin editar el archivo**: omite en memoria exactamente dos bloques de administración global de roles y el GRANT de registration a authentication. Exige cantidades esperadas y rechaza DDL de roles residual en el SQL preparado.
- El rol temporal nuevo se configura como LOGIN/INHERIT y miembro de couchone_authentication, sin superuser/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION. Es una pertenencia del **nuevo miembro temporal**; no se reescriben las pertenencias ni atributos de ningún miembro preexistente. Las compara al terminar.
- Políticas RLS y grants de objetos dentro de la nueva base proceden del esquema integrado, sin relajarlas. Las pruebas HTTP usan una conexión real con el rol temporal ordinario, no el administrador de preparación.
- Crea solo fixtures sintéticas: dos carteras vinculadas, profesionales no habilitado/revocado, cliente y administrador; sesiones; 26 evaluaciones heredadas iniciales, con fechas repetidas, timestamps diferentes por microsegundos e IDs de desempate.
- Las tres altas multimétodo se realizan mediante API real y quedan solo en la base temporal. Se verifica replay idempotente con el mismo ID, opcionales, fechas del servidor y fecha efectiva retroactiva.
- El error de lector se provoca renombrando temporalmente la tabla **solo en la base desechable**, restaurándola en finally; no altera políticas ni tablas preexistentes.
- Limpieza en hook after incluso ante aserciones fallidas: cierra pools, revalida servidor/identificador y OID de base/rol antes de DROP, elimina solo recursos de esa ejecución y verifica ausencia y roles técnicos intactos.
- No incluye contraseñas/JWT literales; credenciales temporales y claves se generan en memoria. Requiere conexión de preparación local autorizada, separada del runtime.

Esto prueba la estructura del **esquema integrado**, no vuelve a ejecutar el migrador ni certifica instalación/actualización de migraciones HU-021. HU-022 no introduce una migración nueva.

### T — resultados físicos finales: 8/8 aprobadas

| Prueba física                 | Evidencia comprobada                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paginación keyset             | 26 registros, cuatro páginas con pageSize 7; IDs y orden coinciden exactamente con SQL; cero duplicados/omitidos; seis decimales preservados, empate de timestamp resuelto por UUID                                                                                                                                       |
| Periodos/metadatos/opcionales | from=to incluye 16 filas del mismo día; heredadas conservan método desconocido/origen/fecha; una muestra solo de pliegue conserva peso ausente y 8.1 mm; fechas/rangos/tamaños/cursor/parámetros inválidos devuelven 400                                                                                                  |
| API y RLS                     | Propietario obtiene sus filas; otro profesional 404, cliente/admin/no habilitado 403, sesión ausente/revocada 401; inexistente y ajeno tienen mismo cuerpo 404; SQL RLS ordinario devuelve cero filas a sujetos ajenos y 26 al propietario; runtime sin grants UPDATE/DELETE                                              |
| Cursor aislado                | Rechazo 400 al cambiar cliente, profesional o filtros, y al alterar cursor; no concede acceso por poseer la continuación                                                                                                                                                                                                  |
| Expediente y errores          | progress available del propietario, empty en cartera sin muestras, error/QUERY_FAILED sin history ante fallo controlado; endpoint dedicado 503; denegaciones no se convierten en vacío; bodyWeightHistory sigue not_integrated                                                                                            |
| Conservación histórica        | Edición de peso base e inactivación/reactivación de fixture no cambian huella de filas históricas; lectura HU-022 y listado HU-021 siguen funcionando                                                                                                                                                                     |
| Alta de tres métodos          | Perímetros, pliegues y bioimpedancia persistidos por POST con CSRF; historial por método coincide con entradas; creación coincide con reloj/fecha PostgreSQL y effectiveDate retroactiva se conserva; misma clave devuelve mismo registro; precisión inválida 70.11 rechazada; total 29 filas, sin duplicación por replay |
| Escritura denegada            | Falta de CSRF devuelve CSRF_INVALID; profesional ajeno no registra; expediente inactivo no registra; huella histórica idéntica tras los rechazos                                                                                                                                                                          |

No se inventa una validación de toda la población clínica, todas las métricas en todos los límites SQL o todos los escenarios concurrentes. Los límites completos de captura se cubren además mediante pruebas puras HU-021. La paginación no ofrece snapshot transaccional entre solicitudes.

### Incidencias del arnés, corregidas y repetidas

1. Primera ejecución: **6/7**, alta de control omitía CSRF y recibió 403 CSRF_INVALID. La protección de producto funcionaba correctamente; se corrigieron únicamente headers/cookie de la prueba.
2. Segunda ejecución: siete pruebas físicas aprobadas; la nueva prueba negativa CSRF quedó fuera del describe por un error de organización del archivo y falló con ReferenceError. También lo detectó TypeScript estricto. Se corrigió su ámbito; no se cambió autenticación ni código funcional.
3. Ejecución final: **8/8**, cero fallos/cancelaciones/omisiones. TypeScript estricto del nuevo archivo aprobado. En cada ejecución se verificó la limpieza, incluidas las fallidas.

El log 42P01 durante la prueba de error es **esperado e inducido** dentro de la base temporal; la prueba acredita 503/error de sección y restauración posterior. No es un fallo pendiente ni se ocultó el log.

Recursos de las tres ejecuciones, ambos base y rol con el mismo nombre, creados y eliminados:

- `cof_hu022_1db26c9a966f3dbc6490` — primera ejecución.
- `cof_hu022_44b1c42ff4602b57adde` — segunda ejecución.
- `cof_hu022_30185ff70b9dcb180cbf` — ejecución final aprobada.

Consulta final de catálogos: **no quedan bases ni roles `cof_hu022_%`**. Huellas de IDs de clientes y filas de evaluaciones de dev/test idénticas al preflight de esta continuación. Dev conserva 2 clientes/6 evaluaciones; test 0/0. No se cambiaron sus migraciones (29/27), permisos ni credenciales.

### T — regresiones y calidad posteriores

- Suite Web repetida: **122/122**, cero fallos/cancelaciones.
- API puras HU-021/HU-022/SaaS: **27/27**. En ejecución sin opt-in, la suite física se omite intencionalmente y no crea recursos.
- HTTP HU-022 con PostgreSQL doble: **9/9**, contabilizado aparte de las físicas.
- Builds API/Web, Oxlint y comprobación TypeScript estricta del arnés: aprobados.
- OpenAPI adaptado: 33 componentes, 117 referencias, 26 operationId únicos, siete páginas válidas/ocho inválidas; limitación oficial dinámica anterior sin cambios. No es certificación oficial integral.
- Prettier de los archivos de esta continuación y git diff --check se comprueban al cierre.

No se ejecutó npm test completo de API: otros arneses escriben en bases existentes o crean recursos fuera del patrón autorizado. No se atribuye aprobación a esas suites. No se instalaron dependencias, modificaron lockfiles ni aplicaron migraciones. Los avisos de bundle Web y escaneo virtual:pwa-register conservan su naturaleza no bloqueante descrita anteriormente.

Reproducción **solo con autorización expresa renovada para esa ejecución y rol de preparación verificado**:

```bash
# Variables en el proceso, sin guardar secretos en archivos versionados:
# HU022_TEMPORARY_PG_AUTHORIZED=yes
# HU022_SETUP_DATABASE_URL=<conexion_autorizada_a_127.0.0.1:5433/postgres>
node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/evolution-postgres.test.ts
# Typecheck del arnés:
./apps/api/node_modules/.bin/tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2023 --esModuleInterop --skipLibCheck apps/api/tests/evolution-postgres.test.ts
```

Las variables comentadas son una plantilla, no credenciales ni un comando listo para copiar contra cualquier destino. El usuario de preparación nunca es couchone_api. La configuración del proceso API de test se cambia solo dentro del proceso hijo para apuntar al runtime temporal; no se edita .env ni el servidor API existente.

### Revisión visual manual preparada; no ejecutada por Codex

Se mantienen los pasos de revisión del preflight: http://127.0.0.1:5000 → Clientes → Cliente QA EP04 → Resumen → Progreso → Ver evolución, conservando Resumen | Entrenamiento | Evaluación. Revisar 17 métricas, periodos inclusivos, métodos, unidades/ausencias, tabla/puntos, foco y móvil; comprobar caché de un periodo visitado y mensaje de periodo no guardado. Abrir captura HU-021 y cancelar sin registrar datos.

Los seis registros de desarrollo no se ampliaron para producir paginación: el caso de más de 20 está probado físicamente en la base temporal ya eliminada. La autorización de esta continuación no permite nuevas escrituras en dev para repetirlo visualmente. Usar una sesión QA existente; un nuevo login/registro en dev requiere autorización correspondiente. No se crean cuentas ni se revelan contraseñas para esa revisión.

### IMPACTO SOBRE OTROS MÓDULOS y estado final de etapa 4

**Sin regresiones detectadas en las pruebas ejecutadas.** Se conservan HU-021, expediente, sesiones/cartera, entrenamiento, offline, idempotencia y sincronización dentro de la cobertura ejecutada. No hay cambios funcionales nuevos ni archivos compartidos editados en esta continuación: solo el nuevo arnés físico y esta documentación. No se edita evidencia histórica HU-021 ni se implementa HU-037.

| Elemento            | Estado vigente                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| HU-022-API1         | Implementada y comprobada mediante HTTP con PostgreSQL real y rol ordinario temporal                         |
| HU-022-WEB1         | Implementada; pruebas DOM/build/lint aprobados; aceptación visual humana HU-022 pendiente                    |
| HU-022-QA1          | Cobertura automatizada pura/HTTP/SQL/RLS aprobada dentro del alcance descrito; revisión visual pendiente     |
| D0                  | **No aprobado**: falta revisión independiente de otro integrante y recorrido visual humano HU-022 confirmado |
| Publicación/etapa 5 | No autorizada; no commits/push/PR/merge; se detiene tras esta evidencia                                      |

La etapa 4 queda con pruebas técnicas aprobadas y revisión visual preparada. La revisión R7/7 histórica de HU-021 no sustituye la aceptación humana de HU-022. No afirmar HU integrada en main, publicada ni desplegada.

### Inventario y comprobaciones finales de esta continuación

Prettier del arnés y README aprobados; git diff --check limpio. Referencias internas del README válidas. Escaneo delimitado de rutas generadas y patrones de secretos sin hallazgos en candidatos; .vite/, .env y dist permanecen ignorados. No se afirma certificación exhaustiva de secretos.

Git: **14 rastreados modificados y 18 archivos nuevos sin seguimiento (32 acumulados)**; índice vacío; rama feature/ep04-antropometria y HEAD 7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6 conservados. La diferencia respecto a los 31 anteriores es el nuevo evolution-postgres.test.ts; los demás cambios locales se conservan. No hubo staging, commit, push, PR, merge, rebase ni cambios de rama. No quedan procesos de pruebas de esta continuación en ejecución. Los servidores API/Web preexistentes se conservaron.

Pendientes actuales: revisión visual HU-022 por la persona usuaria, revisión independiente D0 y autorización explícita para etapa 5. Las pruebas PostgreSQL físicas antes bloqueadas ya no se presentan como pendientes; tampoco se confunden con la suite API completa no autorizada.

## Cierre de validación de etapa 4 — guía visual y paquete para D0

### Estado y capacidades verificadas en este cierre

**Solo edición documental.** Se conservaron los 32 candidatos y todos los cambios funcionales locales. No se ejecutaron nuevas pruebas de producto ni consultas PostgreSQL; los resultados 8/8 físicas, 27/27 puras, 9/9 HTTP con dobles y 122/122 Web pertenecen a la ejecución técnica inmediatamente anterior documentada arriba, no se presentan como repetidos ahora.

**Navegador no disponible:** no hay herramienta de inspección de páginas Web en el catálogo actual; playwright, @playwright/test, puppeteer y puppeteer-core tampoco están instalados en las apps. No se instalaron dependencias, no se lanzó un navegador por mecanismos externos ni se inventaron capturas/mediciones visuales. Figma y los controles de documentos conectados no equivalen a una inspección de esta aplicación local. Codebase Memory MCP tampoco está disponible; se usó lectura estática.

Se volvió a consultar `ui-ux-pro-max` sobre navegación por teclado como apoyo a la lista de revisión; no sustituye pruebas reales de foco, contraste, responsive o lector de pantalla. **La revisión visual de HU-022 sigue pendiente de reporte humano (R)**. La aprobación R7/7 de HU-021 no se traslada a HU-022.

No hay una aprobación ni herramienta conectada de revisión de otro integrante del equipo. La lectura del código hecha por el mismo agente es **autorrevisión (E), no aprobación independiente**. No se creó PR ni se contactó a nadie. CONTRIBUTING.md requiere a anglfer como revisor al abrir el PR posteriormente; la revisión independiente puede prepararse localmente por otro integrante antes de esa publicación, dejando su identidad y observaciones.

### Guía visual exacta sin crear datos

Utilizar una sesión QA ya autorizada y las URLs locales habituales. No compartir contraseñas, cookies, JWT ni archivos .env en el reporte. Si la sesión no está disponible, detener la comprobación y usar el procedimiento de acceso local autorizado, sin crear cuentas ni registros por esta guía.

| Paso | Acción manual                                                                                                    | Resultado esperado / qué reportar                                                                                                                                                                                                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V01  | Abrir `http://127.0.0.1:5000/app/clientes`, entrar al expediente **Cliente QA EP04**                             | Se conserva el cliente y se ven Resumen, Entrenamiento, Evaluación, en ese orden; sin menú global Evaluaciones                                                                                                                                                                             |
| V02  | En Resumen, localizar Progreso → Seguimiento y evolución y pulsar **Ver evolución**                              | Abre `/app/clientes/{id-real}/evaluacion#evolucion-antropometrica`, mismo cliente; encabezado de evolución visible/enfocado. No copiar `{id-real}` literalmente ni seleccionar otro cliente                                                                                                |
| V03  | Abrir selector **Medición**                                                                                      | Exactamente 17 opciones del catálogo descrito debajo, con unidades; no incluye grasa estimada ni carga de ejercicios                                                                                                                                                                       |
| V04  | Elegir **Todo el historial**, todos los métodos y una métrica con datos                                          | Fechas cronológicas, valores originales y unidades coherentes. La consulta es de confirmados; pendientes locales no son puntos de la serie                                                                                                                                                 |
| V05  | Pulsar **Últimos 30/90/365 días**                                                                                | Revisar Desde/Hasta: hoy UTC y los 29/89/364 días anteriores. Son días inclusivos; puede diferir el día UTC del día local de la computadora                                                                                                                                                |
| V06  | Elegir Desde/Hasta iguales a una fecha realmente visible en la tabla y aplicar                                   | Incluye las evaluaciones de ese día, aunque haya varias; cada una conserva ID. Aplicar inicio posterior al fin muestra error y conserva el contexto, sin consulta nueva                                                                                                                    |
| V07  | Probar todos los métodos, Perímetros, Pliegues, Bioimpedancia y Heredadas; pulsar **Aplicar filtros**            | Solo filas del método aplicado; heredadas se muestran como método desconocido, sin atribuir dispositivo/protocolo inventado                                                                                                                                                                |
| V08  | Consultar periodo `2099-01-01` a `2099-01-01`, aplicar                                                           | Caso de consulta sin datos, no una captura futura: mensaje sin evaluaciones y sin gráfica ficticia. Volver después a Todo el historial                                                                                                                                                     |
| V09  | Filtrar un método que tenga una sola evaluación y elegir una medición presente en ella                           | Valor y fecha visibles; aviso de que no hay suficientes registros para comparar. Sin curva. Si los datos actuales no permiten este caso, reportarlo como no comprobado; no crear filas                                                                                                     |
| V10  | Elegir una métrica con varias observaciones; después otra ausente en alguna fila                                 | Puntos reales y tabla cronológica; las filas ausentes dicen Sin medición, nunca 0; no hay líneas de interpolación. Un índice visceral solo aparece en tabla, sin suponer comparabilidad entre equipos                                                                                      |
| V11  | Expandir **Identificador** en filas del mismo día; enfocar sus puntos                                            | IDs distintos y misma coordenada temporal. Puntos superpuestos siguen alcanzables con teclado y sus valores se consultan en tabla; no se inventan horas de medición                                                                                                                        |
| V12  | Revisar pie y avisos de cobertura/paginación                                                                     | Con seis evaluaciones no debe aparecer Cargar más evolución. Si hay más de 20 por trabajo autorizado posterior, debe advertir consulta incompleta y cargar sin duplicados; hoy este caso visual puede quedar no disponible. Cobertura física >20 ya aprobada en entorno temporal eliminado |
| V13  | Usar solo Tab/Shift+Tab/Enter/Espacio en filtros, botones, tabla y puntos SVG                                    | Foco perceptible y orden lógico, sin trampas; controles con etiquetas; detalle del punto disponible sin hover. Verificar que la tabla puede desplazarse con teclado                                                                                                                        |
| V14  | Usar herramientas responsive del navegador a 1280, 768 y 375 px, zoom 200%                                       | Filtros/etiquetas utilizables, gráfica dentro de su contenedor, tabla con desplazamiento horizontal propio; el expediente no se desborda. No requiere un dispositivo físico ni equivale a prueba en él                                                                                     |
| V15  | Con conexión, aplicar un periodo; en DevTools → Network activar Offline y pulsar Actualizar evolución            | Datos de caché con aviso y fecha, sin fingir actualización confirmada. No activar opciones de borrar almacenamiento ni modificar la outbox                                                                                                                                                 |
| V16  | Aún offline, elegir un periodo distinto no visitado y aplicar                                                    | Aviso de periodo/página no guardados, no falso historial vacío. Desactivar Offline al terminar y actualizar                                                                                                                                                                                |
| V17  | Con Network → Slow 3G, actualizar la evolución; opcionalmente bloquear solo `*/evaluation-history*` y actualizar | Carga identificable. El bloqueo se trata como desconexión y puede servir caché: no confundirlo con prueba visual de 403/503. Restaurar No throttling y quitar el bloqueo. Los errores de servidor/denegación se verificaron automáticamente; no forzarlos alterando BD o permisos          |
| V18  | Pulsar Nueva evaluación en la misma pestaña; cambiar métodos y cancelar sin guardar                              | Captura amplia HU-021 conservada. Opcionalmente introducir un valor en un borrador y usar Volver: debe pedir confirmación antes de descartarlo; no pulsar Guardar. Reportar cualquier borrador local alterado por la prueba                                                                |

**Catálogo visual de 17 opciones:** Peso (kg); Estatura (cm); Cintura (cm); Cadera (cm); Cuello (cm); Abdomen umbilical (cm); Grasa corporal medida (%); Masa muscular (kg); Agua corporal (L); Grasa visceral (índice del equipo); Pliegue pectoral, abdominal, tricipital, bicipital, subescapular, suprailiaco y muslo anterior (mm).

No hace falta repetir escritura, login/logout de dos cuentas o sincronización real sobre dev para completar esta guía. El cambio de cuenta y la conservación del almacén tienen cobertura automatizada; la prueba manual de dos cuentas requiere sesiones QA autorizadas y queda no comprobada si no existen. Nunca utilizar un profesional real ajeno ni borrar operaciones pendientes.

**Formato de devolución de la persona usuaria:** navegador/versión, ancho o dispositivo, ID V01–V18 y estado `OK`, `FALLO` o `NO COMPROBADO` con motivo. Para fallos: paso exacto, esperado/observado y error de consola/red sin headers, tokens, credenciales o datos personales. Capturas solo si están disponibles y redactadas; no son obligatorias ni se inventan. Fecha de revisión: la que reporte la persona usuaria, sin asignar una fecha ficticia. Se registrará como R y no como prueba automática.

### Paquete para revisión independiente de código

Revisor esperado: **otro integrante del equipo**; anglfer será revisor del PR cuando exista autorización para crearlo (CONTRIBUTING.md, paso 7). No se asigna su aprobación por anticipado. El paquete está preparado en este README y en los archivos locales, sin publicarlos. Todas las rutas siguientes parten de la raíz.

| Área a revisar                   | Implementación / archivos de entrada                                                                                                                                                  | Evidencia existente y punto crítico                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seguridad y RLS                  | `apps/api/src/features/evaluations/repositories/evaluation.ts`, `routes/evaluations.ts`, autenticación/lifecycle existentes; políticas en `docs/database/schemas/identity_access.sql` | Prueba física de propietario/ajeno/cliente/admin/no habilitado/revocada y SQL RLS; revisar que cursor nunca sustituya sesión/propiedad, permisos runtime ordinarios y lectura de expediente inactivo   |
| SQL y fechas                     | `apps/api/src/features/evaluations/repositories/evolution.ts`                                                                                                                         | Ocho parámetros, expresiones de fecha/método controladas por servidor, orden date/created_at/id; seis decimales UTC; pruebas físicas sin pérdidas. No promete snapshot ni índice nuevo por suposición  |
| Paginación y firma               | `apps/api/src/features/evaluations/validators/evolution.ts`, `services/evolution.ts`                                                                                                  | HMAC-SHA256 ligado a sujeto/cliente/filtros/pageSize, comparación constante, límites estrictos y pageSize+1; probar rechazo de cursor cruzado/alterado. Firma no cifra payload: no registrarlo en logs |
| Integridad histórica             | `apps/api/src/features/evaluations/domain/evolution.ts`, `types/evolution.ts`                                                                                                         | Una muestra por evaluación; solo entradas persistidas, sin completar perfil ni recalcular. Huellas físicas intactas tras edición e inactivación/reactivación; legacy conserva desconocidos             |
| API/expediente                   | `apps/api/src/features/evaluations/controllers/evaluation.ts`, `apps/api/src/features/professional/services/record.ts`, `types/record.ts`, `docs/api/identity-lifecycle.openapi.json` | progress available/empty/error, denegaciones propagadas y bodyWeightHistory sin integrar; validación OpenAPI adaptada con limitación oficial documentada                                               |
| Consumidor Web                   | `apps/web/src/features/evaluations/types/evolution.ts`, `services/evolution.ts`; servicios/tipos de expediente en `features/professional`                                             | Guard de respuestas con cliente/filtros/fechas/unidades/pageInfo; autorización nunca se convierte en vacío ni se sirve caché por denegación                                                            |
| Estado y carreras                | `apps/web/src/features/evaluations/hooks/useEvolution.ts`, `components/EvolutionSection.tsx`                                                                                          | Generaciones de consulta, cambio de cliente/cuenta/metric/filtro, exclusión de respuestas tardías y deduplicación; comprobar mensajes de páginas incompletas                                           |
| Tabla/gráfica/accesibilidad      | `components/EvolutionChart.tsx`, `EvolutionTable.tsx`, `EvolutionSummary.tsx`, `utils/evolution.ts` dentro de la feature Web                                                          | Puntos reales sin líneas, misma fecha/misma x, ausencia distinta de cero, roles/labels/foco/tabla; DOM aprobado, visual/lector de pantalla pendientes                                                  |
| Offline                          | `apps/web/src/services/offline/readCache.ts`, lector/hook de evolución, `services/evaluations.ts` de la feature                                                                       | Cifrado/cuenta/cliente/filtros/cursor, invalidación tras alta confirmada y onSynced; no otra cola, no pendientes como puntos. Compartido: revisar compatibilidad de argumentos opcionales del caché    |
| Integración HU-021 y regresiones | `apps/web/src/features/evaluations/pages/EvaluationsPage.tsx`, `features/professional/pages/ProfessionalPage.tsx`, `components/ClientRecordSections.tsx`; pruebas indicadas debajo    | Sin pestaña principal nueva, sin selector de clientes, captura amplia intacta; evaluar alcance mínimo de cambios compartidos y aviso/coordinación antes de publicar                                    |

**Pruebas para revisar, sin ejecutarlas por defecto:** `apps/api/tests/evolution.test.ts`, `evolution-api.test.ts`, `evolution-postgres.test.ts`; `apps/web/tests/evolution-web.test.mjs`, `session-recovery.test.mjs` y suites offline/entrenamiento existentes. Leer las guardas del test PostgreSQL y su limpieza; no activarlo sin autorización para recursos temporales. No ejecutar npm test API contra dev/test o remotos.

Inventario local completo, sin staging: `git status --short --untracked-files=all`, `git diff --stat`, `git diff --cached --stat`. Leer también archivos sin seguimiento: no aparecen en git diff normal. Revisar especialmente el arnés temporal, caché compartida y el sobre progress. API/migraciones HU-021 no se deben reinterpretar por una revisión de UI. No hay cambios SQL de HU-022.

**Registro de revisión independiente por completar:** nombre/identificador del integrante, fecha real, archivos/versiones revisados (HEAD publicado y cambios locales, pues HU-022 no tiene commit), hallazgos con severidad y ubicación, correcciones y pruebas repetidas, limitaciones aceptadas y decisión explícita. Si el código cambia después, delimitar qué requiere nueva revisión. No copiar credenciales al paquete.

### Matriz concreta D0 vigente

Fuente: plan/PLAN_TRABAJO_V2.md §5.2, líneas 645–659. Las siguientes valoraciones preparan la revisión; no son aprobación D0.

| Punto | Exigencia                                                 | Estado / evidencia para el revisor                                                                                                                                                     |
| ----- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D0.1  | Tareas implementadas y revisadas, sin mocks en flujo real | Implementación real; revisión independiente de las tareas pendiente. Los dobles se limitan a tests                                                                                     |
| D0.2  | Capas aplicables integradas con contrato/entorno          | API/SQL reales y Web automatizada; recorrido visual real de HU-022 pendiente. Flutter no aplica                                                                                        |
| D0.3  | Validación UX/servidor, permisos y propiedad              | Evidencia técnica aprobada: puras, HTTP y PostgreSQL/RLS; revisión humana del código pendiente                                                                                         |
| D0.4  | Errores, estados y caducidad de sesión                    | Automatizado aprobado; revisar visualmente carga, vacío, un valor, parcial, caché y errores disponibles                                                                                |
| D0.5  | Casos positivos/negativos e integración automatizada      | 8 físicas, 27 puras, 9 HTTP dobles, 122 Web aprobadas, con alcance y exclusiones documentados                                                                                          |
| D0.6  | Migración reproducible y conservación                     | HU-022 no añade migración. Conservación histórica física aprobada; nuevas migraciones HU-021 no se editan ni reaplican aquí. Instalación/upgrade del migrador no se repitió en etapa 4 |
| D0.7  | Calidad de componentes afectados verde                    | Builds/typecheck/lint/Prettier/diff aprobados en etapa anterior; no se repiten por esta edición documental. No equivale a suite API completa                                           |
| D0.8  | Otro integrante revisa código y se corrigen observaciones | **PENDIENTE, requisito bloqueante de aprobación D0**. Autorrevisión de Codex y aprobación visual del usuario no lo sustituyen                                                          |
| D0.9  | Documentación/contratos actualizados                      | README/OpenAPI/tipos preparados; limitación oficial de validación OpenAPI sigue explícita para aceptación del revisor                                                                  |
| D0.10 | Validación desde app real, recorrido vertical             | **PENDIENTE reporte visual humano HU-022**. HU-021 R7/7 y DOM no equivalen a esta validación                                                                                           |
| D0.11 | Offline declarado y probado                               | Declaración y automatización aprobadas; revisión offline real preparada, sin otra outbox ni escrituras de evolución                                                                    |

**Defectos:** en esta lectura estática no se confirmó un defecto funcional nuevo. No se modificó producto. Esto no certifica ausencia absoluta de defectos ni sustituye contraste visual o revisión por otro integrante.

**IMPACTO SOBRE OTROS MÓDULOS:** esta continuación solo actualiza este README; no cambia API/Web, auth, cartera, expediente, entrenamiento, offline ni HU-021. Se conservan las pruebas aprobadas de la ejecución anterior como evidencia histórica reciente; no se afirma que se ejecutaran de nuevo. Sin nuevas escrituras en PostgreSQL, roles, permisos o migraciones.

**Condición de paso:** paquete listo para revisión humana; cierre de etapa 4 y avance a etapa 5 pendientes de reporte visual, revisión independiente/observaciones y autorización expresa. No está autorizado commit, push, PR, merge ni cambio de rama. No se declara D0 aprobado ni HU publicada/integrada/desplegada.

## Corrección de gráfica — puntos y segmentos comparables

### R — observación real de la persona usuaria

La persona usuaria reportó que el punto de una nueva evaluación aparecía correctamente, pero los puntos aislados no facilitaban observar la evolución del peso. Se autorizó añadir segmentos entre mediciones comparables. Este reporte acredita esa observación puntual, **no** la aprobación de toda la guía visual ni de D0. La interfaz original evitaba cualquier línea para cumplir conservadoramente la prohibición de interpolar ausencias/atribuir orden intradía; la nueva instrucción autoriza conectores visuales bajo las reglas siguientes.

### E — política visual vigente y límites de comparabilidad

- Cada valor real finito se conserva como punto identificable; cero valores no dibuja gráfica, un solo valor dibuja un punto y ningún segmento.
- Segmentos solo dentro de una serie con el mismo cliente, métrica seleccionada, unidad del catálogo validado, método, origen profesional, procedencia manual, protocolo declarado no vacío y base de fecha efectiva.
- Por tanto, se pueden conectar **Perímetros con Perímetros** y **Pliegues con Pliegues** del mismo protocolo declarado, entre días distintos no ambiguos. Nunca se une un método con otro. Es compatibilidad operativa de captura, no una certificación de equivalencia clínica del protocolo ni aprobación de fórmulas.
- Heredadas con método/procedencia desconocidos permanecen como puntos separados; no se infiere que tengan el protocolo moderno. Aunque un peso esté en kg, eso no inventa método/procedencia faltantes.
- `device_reported` y el protocolo genérico de bioimpedancia no identifican un equipo comparable. Los valores informados por equipo quedan como puntos separados, también el índice visceral, con explicación visible. No se modifica el DTO ni se inventa identificador de dispositivo para permitir líneas.
- Los valores ausentes/null/no finitos **cortan** la serie de su grupo. No se salta una evaluación del mismo grupo sin esa métrica para unir los extremos. La tabla conserva todas esas filas como Sin medición, nunca cero.
- Varias evaluaciones del mismo grupo en una fecha dejan **todo ese día sin segmentos**, ni entre sí ni de entrada/salida: creación técnica/microsegundos/UUID dan orden estable de listado, no prueban hora de medición. Cada punto conserva la misma x de su fecha real y su ID.
- Con páginas pendientes, el último día cargado tampoco recibe segmentos: podría haber más evaluaciones de ese día en la siguiente página. Los puntos siguen visibles y se explica que el historial está incompleto.
- Los segmentos solo unen extremos existentes. No generan muestras, promedios, puntos intermedios, curvas suavizadas, predicciones o diagnósticos. No se escriben/recalculan datos históricos.

La recomendación genérica de ui-ux-pro-max de evitar líneas con menos de cuatro valores no reemplaza la instrucción expresa de permitirlas desde dos comparables. Se conserva SVG nativo, tabla accesible, formas por método y línea discontinua para pliegues/continua para perímetros. Los puntos siguen siendo controles con Tab/Enter/Espacio, etiquetas y detalle aria-live; segmentos decorativos no reciben foco ni reemplazan los valores de la tabla.

**Limitación deliberada:** si el historial actual contiene solo heredadas, dispositivos sin identidad comparable o capturas del mismo día, puede continuar sin líneas. La interfaz explica el motivo; dibujar una línea en esos casos contradiría las reglas de la solicitud. Si se desea habilitar comparabilidad adicional, requiere criterios explícitos y datos suficientes, sin reinterpretar registros antiguos.

### Archivos de esta corrección

| Ruta desde raíz                                                     | Cambio                                                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/features/evaluations/utils/evolution.ts`              | Función pura evolutionSegments y guarda de medición finita; agrupación, orden, cortes por ausencias/días ambiguos y frontera de página; sin mutar entrada          |
| `apps/web/src/features/evaluations/components/EvolutionChart.tsx`   | Dibuja puntos desde un valor y segmentos calculados, estilos por método y explicaciones; recibe hasMore para proteger la frontera                                  |
| `apps/web/src/features/evaluations/components/EvolutionSection.tsx` | Presenta gráfica también con un único valor, mantiene tabla completa y pasa cobertura de páginas; índice visceral como puntos sin segmentos                        |
| `apps/web/tests/evolution-web.test.mjs`                             | Actualiza expectativa de un punto y añade casos de comparabilidad, cortes, orden, inmutabilidad, tabla/teclado, métodos/protocolos/desconocidos y frontera parcial |
| `docs/epicas/ep-04-antropometria/hu-022/README.md`                  | Esta evidencia y reglas vigentes; conserva historia anterior identificada como tal                                                                                 |

No se crean archivos nuevos en esta corrección. Estos archivos ya eran locales sin seguimiento por etapas anteriores, salvo EvolutionSection igualmente nuevo de HU-022; «modificados» aquí describe su edición actual, no su estado respecto a HEAD. No se modifica API, SQL, RLS, migraciones, contrato, caché ni captura HU-021.

### T — comprobaciones de esta corrección

Primera ejecución después del cambio principal: **129/129 Web**, cero fallos. Después se añadió la protección del último día en páginas incompletas y su prueba. **Ejecución final: 130/130 Web, cero fallos/cancelaciones/omisiones**, ocho casos nuevos respecto a 122. **Build Web, lint sin advertencias, Prettier de los cinco archivos editados y git diff --check aprobados** para el estado final. Se mantienen los avisos conocidos de bundle >500 kB y escaneo virtual:pwa-register en el arnés, sin fallos por ellos. No se repiten pruebas PostgreSQL/API porque no se modificaron esas capas y esta autorización no requiere escrituras.

### Revisión visual pendiente de la corrección

Abrir la evolución del mismo expediente QA y seleccionar una medición registrada:

1. Con dos capturas manuales de días distintos, mismo método/protocolo/procedencia, comprobar puntos y segmento. Con tres, dos segmentos consecutivos. Si no existen esos datos, marcar no comprobado y no crear evaluaciones por esta guía.
2. Filtrar heredadas o bioimpedancia: puntos separados y explicación, sin simular comparabilidad.
3. Revisar dos muestras del mismo día: conservan sus puntos/IDs, sin segmento arbitrario entre ellas. Revisar ausencias: tabla completa, sin línea que puentee una evaluación sin valor de ese grupo.
4. Verificar un único valor: un punto, ningún segmento. Periodo vacío: estado sin datos.
5. Revisar Tab/Enter/Espacio, detalle y unidades, escritorio/móvil. Los segmentos no deben tapar puntos ni hacerlos inaccesibles.
6. Si hay páginas pendientes, comprobar aviso y último día sin segmentos hasta completar la consulta; no crear datos en dev para producir ese estado.

No se ha ejecutado navegador real en esta corrección. No se atribuye una nueva aprobación visual al reporte anterior ni se declara D0 independiente aprobado.

### IMPACTO SOBRE OTROS MÓDULOS

Cambio limitado a visualización HU-022, utilidades y pruebas Web; tabla, captura HU-021, historia persistida, idempotencia y offline se conservan. Las regresiones se acreditan únicamente con la suite ejecutada. No hubo accesos PostgreSQL, migraciones, cambios de rama, staging, commits, push, PR o merge. Se detiene dentro de etapa 4; etapa 5 no autorizada.

Cierre de esta corrección: **sin regresiones detectadas en las pruebas ejecutadas**, incluyendo tabla/expediente, captura HU-021, sesiones, cartera, entrenamiento y offline dentro de la cobertura Web. Git conserva rama feature/ep04-antropometria, HEAD 7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6 e índice vacío; inventario acumulado sin nuevos archivos: 14 modificados y 18 sin seguimiento. No se usó navegador real ni se aprobó D0. La nueva lógica visual debe incluirse en la revisión independiente preparada; las cifras 122/122 de etapas anteriores son históricas.

## Corrección funcional de Peso — guía heterogénea con diagnóstico real

### R — instrucción y observación reportadas

La persona usuaria comprobó en navegador que seguían apareciendo puntos aislados y el mensaje Sin segmentos comparables. La regla anterior se estaba aplicando, pero no satisfacía la comparación visual de peso histórico. Se autoriza expresamente una **guía visual entre pesos de contextos heterogéneos**, sin afirmar equivalencia clínica. Esta instrucción sustituye para Peso las restricciones de método/procedencia de la corrección anterior; **no las relaja para otras métricas**. No equivale a aprobar D0 ni la interfaz recién corregida.

### E/T — diagnóstico previo a editar

Se verificaron rama, cambios locales, reglas y skill ui-ux-pro-max. MCP Codebase Memory y navegador de inspección no disponibles: inspección estática y pruebas DOM, sin inventar una sesión visual. No se instalaron dependencias.

Se ejecutó **SQL estrictamente READ ONLY** en PostgreSQL 17.11 `127.0.0.1:5433/CouchOneFit_dev`, sobre el único expediente con etiqueta QA y propietario coincidente con la cuenta QA configurada. Se usó el SELECT actual y mapper/proyección de producción, con cuenta runtime ordinaria y contexto de propietario. No se hizo login ni se crearon sesiones/registros. No se modificaron bases, roles, permisos, migraciones ni archivos .env.

Lectura sin filtros actual: **8 evaluaciones en la primera página, hasMore=false; 6 pesos presentes y 2 ausentes**. La evaluación creada más recientemente aparece en esa consulta y tiene peso, con fecha efectiva 2026-11-13. No se infirió una fecha de medición intradía a partir de createdAt.

| Fecha histórica real | Observaciones QA de peso                        | Contexto recibido                                                                                                   | Por qué no había segmentos con la regla anterior                                                                            |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-09           | 68.7 kg y 56 kg; otra evaluación sin peso       | Heredadas, método/procedencia/protocolo null                                                                        | Se excluían por metadatos desconocidos. Además, los dos pesos distintos del mismo día no tienen un orden de medición fiable |
| 2026-11-11           | Dos registros de 80 kg; una evaluación sin peso | Perímetros/manual/circumference-sites-pending y bioimpedancia/device_reported/device-kg-litre-v1; pliegues sin peso | Se separaban por método y se excluía dispositivo; perímetros no tenía otro día comparable de su propio grupo                |
| 2026-11-13           | Dos registros de 54 kg, incluida la última alta | Bioimpedancia/device_reported/device-kg-litre-v1                                                                    | Se excluían todos los dispositivos; la regla previa también cortaba cualquier día con más de una evaluación                 |

Con los datos anteriores, la función previa devolvía **0 segmentos** antes de llegar al dibujo SVG. No se encontró un defecto de coordenadas que explicara la ausencia de líneas: no existía ningún segmento para dibujar. La consulta actual no tiene páginas pendientes y contiene la última alta; no hay evidencia de que la paginación sea la causa.

**Límite del diagnóstico de caché:** no se accedió a IndexedDB ni a la petición exacta/filtros de la sesión del navegador humano. No se afirma que esa caché se inspeccionara o que todos los filtros visuales estuvieran vacíos. Se comprobó que el lector Web valida cliente/filtros, consulta red e invalida tras alta/sync; las pruebas reprodujeron alta confirmada, refresco y uso posterior de caché. No fue necesario cambiar esa infraestructura.

### Regla vigente para Peso

- Se usan únicamente observaciones reales `weightKg` finitas del cliente, siempre kg. Se ordenan por fecha efectiva/heredada real; createdAt/ID solo mantienen orden estable de listado, no una hora física inventada.
- Los métodos, procedencias y bases de fecha **no impiden** una guía de peso entre días inequívocos. Si difieren o son desconocidos, o el equipo no está identificado como comparable, se marca el segmento `heterogeneous` y se muestra discontinuo con aviso de guía visual, **sin equivalencia clínica**.
- Un día con varios **pesos diferentes** se separa por completo, sin seleccionar el último, promediar ni unir sus valores arbitrariamente.
- Un día con varios registros del **mismo peso exacto** conserva cada punto/ID en la misma coordenada real. El segmento puede llegar a esa posición coincidente sin ordenar intradía esos registros. Los endpoints conservan **todos los IDs** mediante fromIds/toIds y el detalle Registros conectados; no se genera una muestra agregada, no se suman/promedian valores ni se elimina una fila. from/to solo aportan la geometría del valor idéntico ya existente.
- Un día con evaluaciones pero ningún peso disponible corta la guía. Una fila sin peso en un día que también contiene peso real no se convierte en dato ni se conecta: sigue como ausencia en la tabla.
- Con hasMore=true se conserva la protección del último día cargado: no se conecta hasta descartar registros adicionales de ese día. Se mantienen aviso parcial y carga adicional.
- Cero pesos: sin gráfica ficticia. Un peso: un punto sin línea. Tres o más fechas inequívocas: conectores consecutivos. Los segmentos son guías entre extremos existentes, no interpolaciones persistidas, diagnósticos ni predicciones.

**Resultado sobre los mismos registros reales leídos:** ahora se obtiene **1 guía heterogénea**, de la posición 2026-11-11 / 80 kg a 2026-11-13 / 54 kg. Hay dos IDs en cada extremo, incluida la última evaluación. El 9/nov permanece separado por los valores contradictorios. La tabla sigue mostrando las ocho evaluaciones y la gráfica los seis puntos con peso, sin modificar registros.

### Otras métricas, mensajes y accesibilidad

Cintura y abdomen umbilical siguen siendo métricas distintas. Perímetros, pliegues, grasa medida, agua e índices no se convierten en cálculos derivados ni cambian unidades. Conservan series manuales con mismo método/procedencia/protocolo/base de fecha, cortes por ausencias y días ambiguos; heredadas/dispositivos no comparables permanecen separados.

La gráfica presenta mensajes breves y motivos concretos: fechas con pesos contradictorios, días sin medición y cobertura incompleta. Para Peso, línea discontinua significa guía heterogénea; puntos mantienen formas por método y etiquetas. El detalle desplegable **Registros conectados** enumera fechas, valores, unidades e IDs de todos los extremos; permite reconocer qué quedó conectado sin llenar el área principal de texto técnico. Puntos conservan teclado/foco/aria-live; tabla mantiene todas las filas, incluidas ausencias. No se rediseña el expediente ni se modifica captura HU-021.

### Archivos editados en esta continuación

| Ruta                                                              | Propósito                                                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/evaluations/utils/evolution.ts`            | Regla weightGuides separada de comparabilidad estricta, endpoints con todos los IDs y marca heterogénea, motivos de separación                                      |
| `apps/web/src/features/evaluations/components/EvolutionChart.tsx` | Guías reales SVG, estilos/leyenda específicos de Peso, explicación y detalle accesible de extremos                                                                  |
| `apps/web/tests/evolution-web.test.mjs`                           | Casos de distintos métodos, heredadas/desconocidos, días ambiguos/coincidentes, alta reciente/caché y coordenadas SVG; mantiene pruebas estrictas de otras métricas |
| `docs/epicas/ep-04-antropometria/hu-022/README.md`                | Diagnóstico y evidencia actual, diferenciados de las reglas históricas                                                                                              |

No se crean archivos nuevos versionables ni se editan API, SQL, contratos, RLS, caché, router, estilos globales, dependencias o migraciones. El script temporal de diagnóstico quedó fuera del repositorio, sin credenciales literales. No se consultaron otras carteras ni bases remotas.

### T — pruebas y límites de evidencia

- Suite Web completa: **134/134**, cero fallos, cancelaciones u omisiones. Resultado 130/130 de la corrección anterior es histórico.
- Cuatro nuevos casos: dos pesos de distintos métodos con segmento heterogéneo SVG; tres heredadas/procedencia desconocida; reproducción sintética de la combinación real de ocho filas (incluido último peso) sin mutación ni promedio; alta confirmada HU-021 que invalida caché y aparece como guía en red/refresco y luego caché offline.
- Se adaptaron las expectativas antiguas de comparabilidad estricta de Peso a cintura para conservar la cobertura de **otras métricas**, y se hizo explícito el caso de pesos diferentes el mismo día. No se eliminaron escenarios para ocultar fallos.
- Se mantienen pruebas de cero/una observación, nulos, fechas y orden, kg/cm, páginas parciales y frontera, tabla completa, teclado, responsive simulado, cambio de cliente/cuenta y regresiones HU-021/offline.
- SVG comprobado en DOM: segmento existe; x1/x2 y y1/y2 distintos para dos fechas/pesos distintos. En reproducción de ocho filas: un segmento, seis puntos, ocho filas y la última evaluación entre sus IDs finales.
- Build Web (TypeScript/Vite) y lint aprobados. Continúan los avisos conocidos de bundle >500 kB y escaneo virtual:pwa-register del arnés, sin fallos por ellos.
- Prettier de los cuatro archivos editados, enlaces internos y git diff --check: aprobados al cierre. La suite final se repitió tras abreviar el mensaje de guía heterogénea/equipo no identificado: **134/134** nuevamente. No se repiten pruebas físicas de escritura ni suites API por un cambio exclusivamente Web.

No se afirma revisión visual nueva en navegador. La lectura real con mapper no equivale a capturar el request/almacén del navegador: sus filtros/caché concretos siguen sin inspección directa.

### Qué comprobar visualmente ahora

1. En el mismo cliente QA, abrir Evolución → Peso → Todos los métodos → Todo el historial → Actualizar evolución, con conexión. Comprobar fecha de datos y ausencia de aviso de caché antes de evaluar el resultado fresco.
2. Con los ocho registros observados, debe aparecer una guía discontinua **80 kg (11/nov) → 54 kg (13/nov)**; el punto del último registro pertenece al extremo final. No registrar más evaluaciones para conseguir esta línea.
3. El 9/nov debe seguir separado y explicar pesos distintos sin orden intradía. Expandir IDs de filas/puntos coincidentes: las evaluaciones de 80 kg y de 54 kg no se fusionaron ni eliminaron.
4. Abrir Registros conectados y contrastar IDs/fechas/pesos con la tabla. Verificar etiqueta heterogénea y ninguna afirmación clínica.
5. Filtrar Bioimpedancia: si quedan los dos días con 80 y 54, debe seguir existiendo una guía visual, marcada heterogénea/equipo no identificado. Filtrar una métrica diferente: comprobar que no se relajó su comparabilidad ni se mezclan unidades.
6. Probar teclado y ancho móvil, un único peso y periodo vacío; no modificar datos. Si la sesión tiene un filtro distinto o usa caché, reportarlo con el resultado para no confundir una consulta parcial con defecto de dibujo.

### IMPACTO SOBRE OTROS MÓDULOS y estado

**Sin regresiones detectadas en las pruebas ejecutadas.** Se conservan HU-021, tabla/expediente, sesiones, cartera, entrenamiento, offline, idempotencia y sync dentro de cobertura Web. El cambio no altera identidad, permisos, persistencia ni historia. La lectura de diagnóstico fue de solo lectura; no hubo escrituras PostgreSQL, migraciones, cambios de rol/permisos, commits, push, PR o merge. Se conservan los cambios locales y rama feature/ep04-antropometria; etapa 5 no autorizada. Pendientes revisión visual de esta versión y revisión independiente D0.

Cierre de esta continuación: rama feature/ep04-antropometria y HEAD 7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6 conservados, índice vacío, 14 archivos modificados y 18 nuevos sin seguimiento acumulados (sin nuevos archivos versionables en esta corrección). No hay pruebas en ejecución. La última evaluación persistida está incluida en el extremo final de la guía calculada con los datos reales; falta confirmarlo visualmente en la sesión del usuario. No se infiere que el navegador recibió exactamente esa consulta sin filtros ni se certifica su caché.

## Revisión visual parcial aprobada y preparación documental de etapa 5

### R — evidencia humana confirmada, alcance exacto

**Fuente:** mensaje de la persona usuaria en esta conversación. **Revisión visual parcial reportada y aprobada por el usuario**, no prueba visual ejecutada automáticamente por Codex. No se reportaron navegador, dispositivo, capturas ni fecha exacta de ejecución; no se inventan.

Confirmado:

1. La gráfica Peso muestra la línea discontinua de **80 kg del 11/nov a 54 kg del 13/nov**.
2. La interfaz muestra **8 evaluaciones y 6 valores de peso**.
3. Los pesos contradictorios del **9/nov permanecen separados**.
4. La interfaz identifica los segmentos heterogéneos y conserva los registros originales.

Esto confirma la corrección visible del seguimiento de peso para esos datos. **No aprueba** todas las mediciones/unidades, filtros, estados, accesibilidad, móvil, offline ni captura HU-021. No prueba por sí solo cada ID ni el detalle de todas las filas. No completa D0.8 ni la validación integral D0.10.

### QA visual restante — lista concreta para devolver resultados

Usar sesión QA autorizada en `http://127.0.0.1:5000/app/clientes`, expediente Cliente QA EP04. No crear nuevas evaluaciones ni editar datos para esta revisión. Las credenciales son los valores del mecanismo local autorizado, no los nombres literales de variables; no enviarlos en el reporte.

| ID  | Verificación restante                                                                                                     | Resultado esperado                                                                                                                              | Estado                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| M01 | Recorrido Resumen → Progreso → Ver evolución y regreso a Resumen/Entrenamiento                                            | Mismo cliente, pestañas Resumen/Entrenamiento/Evaluación; sin selector de cliente ni menú global nuevo                                          | Pendiente de evidencia específica                                  |
| M02 | 30/90/365 días, todo el historial, Desde=Hasta en una fecha de la tabla y rango invertido                                 | Periodos UTC inclusivos, límites correctos; inválido muestra error sin mezclar resultados anteriores                                            | Pendiente                                                          |
| M03 | Todos los métodos, Perímetros, Pliegues, Bioimpedancia y Heredadas; aplicar filtros                                       | Filas y puntos del método aplicado; peso heterogéneo identificado, otras métricas no mezclan protocolos                                         | Pendiente                                                          |
| M04 | Periodo 2099-01-01 a 2099-01-01 y luego una consulta con una sola medición disponible                                     | Vacío sin gráfica ficticia; un valor muestra un punto sin línea. No crear registros para conseguirlo                                            | Pendiente                                                          |
| M05 | Tabla, identificadores y selector de 17 métricas                                                                          | Fechas/orden/valor real/unidad; kg, cm, mm, %, L e índice correctos; ausencia ≠ cero; cintura ≠ abdomen; sin resultados inventados              | Pendiente; solo conteos y pesos indicados arriba tienen R aprobado |
| M06 | Tab/Shift+Tab, Enter/Espacio, puntos, Registros conectados e Identificador                                                | Foco visible/orden lógico, sin trampas; detalle accesible sin hover; tabla desplazable mediante teclado                                         | Pendiente                                                          |
| M07 | Escritorio, 768 y 375 px, zoom 200%                                                                                       | Controles y etiquetas legibles, gráfica dentro de su ancho y desplazamiento propio de tabla sin desbordar expediente                            | Pendiente                                                          |
| M08 | Consultar un periodo online, activar Offline en DevTools, actualizar y pedir otro periodo no visitado; restaurar conexión | Aviso de caché y antigüedad; periodo no guardado no se disfraza de vacío; recuperar conexión actualiza sin duplicar. No borrar IndexedDB/outbox | Pendiente                                                          |
| M09 | Abrir Nueva evaluación, cambiar métodos, volver/cancelar sin guardar                                                      | Captura amplia HU-021 intacta, borradores y confirmación de descarte; volver al mismo cliente                                                   | Pendiente                                                          |

Paginación visual >20: con ocho filas no hay siguiente página. **No comprobada visualmente con este dataset**; prueba física de 26 filas/cuatro páginas y DOM de carga parcial ya aprobadas. No se amplían datos de desarrollo para producirla. También siguen sin reporte visual específico carga/error, contraste/lector de pantalla y cambio de cuenta; sus pruebas automatizadas no se convierten en aprobaciones humanas. Para cualquier caso imposible con los datos actuales, registrar NO COMPROBADO y motivo.

Devolver M01–M09 como OK/FALLO/NO COMPROBADO, navegador/versión y ancho/dispositivo. Fecha real si se conoce; errores sin contraseñas, cookies, tokens o headers sensibles. No atribuir evidencia adicional por el silencio o por un resultado técnico previo.

### Paquete independiente D0 — alcance, aceptación y evidencia

Se volvieron a consultar AGENTS.md, CONTRIBUTING.md y plan §5.2/HU-022. Este paquete complementa la matriz de 11 puntos D0 y las rutas de revisión ya incluidas arriba. **No es una autorrevisión aprobada ni una revisión independiente ejecutada.** Requiere otro integrante con identidad, fecha, archivos/versiones, observaciones y decisión explícita. Revisor propuesto: **anglfer**, exigido para el futuro PR por CONTRIBUTING.md; su disponibilidad y aprobación no están confirmadas.

**API:** GET `/api/clients/{clientId}/evaluation-history` con sesión profesional, propiedad/contexto RLS, filtros inclusivos, método/legacy, cursor HMAC ligado a sujeto/cliente/filtros/pageSize, orden fecha/creación/ID y microsegundos. `record.sections.progress` available/empty/error; denegaciones propagadas. Sin recalcular ni escribir historial.

**Web:** evolución dentro de Evaluación y resumen Progreso, catálogo de 17 métricas, tabla/SVG accesibles, guías de Peso heterogéneas explícitas, comparabilidad estricta de otras métricas, filtros/paginación/caché cifrada por cuenta y consulta, estados y protección frente a respuestas obsoletas. Captura HU-021 reutilizada.

**BD:** solo lectura de `private.client_evaluations`; ninguna tabla, columna, índice, vista o migración nueva HU-022. Se reutilizan esquema/migraciones HU-021 y permisos/RLS existentes. El arnés físico prepara únicamente recursos temporales autorizados y omite DDL/membresías de roles globales; no modifica dev/test.

| Criterio HU-022                               | Evidencia preparada                                                                                  | Límite / revisión pendiente                                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orden temporal y unidades correctas           | SQL keyset con microsegundos, DTO/catálogo, pruebas puras/DOM y R parcial de Peso                    | R de otras métricas/filtros/tabla completa pendiente                                                                                                         |
| Cero/una observación sin tendencia falsa      | Puras/DOM; cero sin gráfica y una con punto sin línea                                                | Revisión manual M04 pendiente                                                                                                                                |
| Perfil/planes no alteran historial            | Huella física tras edición base/inactivación/reactivación; proyección no consulta perfiles ni planes | No se hizo una edición física específica de planes para ese propósito; esa independencia se respalda por inspección/proyección y queda a valorar por revisor |
| Cliente/profesional ajeno sin acceso          | SQL RLS/API reales con dos carteras; cliente/admin/no habilitado/revocada/ausente; cursor cruzado    | Cobertura física delimitada al arnés, no aprobación de toda autenticación del producto                                                                       |
| Origen/fecha/método/procedencia identificados | Proyección conserva heredados desconocidos; DTO, tabla y pruebas                                     | R confirma aviso heterogéneo de Peso; no todas las etiquetas de procedencia                                                                                  |
| Integración en expediente sin esperar HU-037  | record.progress y navegación comprobados por tests, gráfico de peso confirmado en aplicación por R   | Recorrido manual completo M01 y revisión independiente pendientes                                                                                            |

**Evidencia técnica existente, no repetida ahora:** 8/8 físicas PostgreSQL/API/RLS, 27/27 API puras, 9/9 HTTP con dobles, **134/134 Web finales**, builds API/Web, lint, typecheck del arnés, Prettier y diff aprobados en sus ejecuciones documentadas. La cifra 130/130 corresponde a la corrección anterior y 122/122 a la etapa 3. PostgreSQL físico no se repitió tras ajustes exclusivamente Web. No se ejecutó suite API completa fuera del alcance temporal autorizado.

**OpenAPI:** comprobación adaptada de 33 componentes, 117 referencias y 26 operationId, controles positivos/negativos. Validación oficial integral 3.1 no certificada por la incompatibilidad dinámica documentada; no ocultar esa limitación al revisor.

**Tareas:** API1 implementada y validada técnicamente; WEB1 implementada con R parcial, aceptación visual restante pendiente; QA1 automatizada aprobada en cobertura indicada, QA visual parcial. **D0 no aprobado**, especialmente puntos 8 y 10. Revisión humana visual no sustituye revisión independiente de código.

**Riesgos compartidos:** helper de lectura/mapeo HU-021; composición/tipos/guard del expediente; página profesional; caché compartida; contrato OpenAPI y regresiones. Notificar/coordinar estos archivos con el equipo conforme a CONTRIBUTING antes de publicar, sin enviar mensajes automáticamente. No se cambian reglas de auth/cartera/entrenamiento. HU-037 debe incorporar sus eventos después sin duplicar peso: bodyWeightHistory permanece not_integrated, source actual professional_evaluation no se reinterpreta como móvil. Esa ampliación necesitará contrato y revisión propios, no está incluida aquí.

### Propuesta exacta de commits — preparada, NO ejecutada

Se conserva `feature/ep04-antropometria` por decisión expresa de la persona usuaria, sin renombrarla. Mensajes en inglés, Conventional Commits y rutas explícitas; nunca staging global. **32 archivos: 14 modificados y 18 nuevos; cada uno aparece exactamente una vez** en las cuatro listas siguientes. No se propone commit BD porque HU-022 no añade SQL.

Orden y dependencias: 1 → 2 → 3 → 4. El 3 requiere 1; 4 documenta el conjunto. **API 1 y Web 2 deben entregarse juntas**: el sobre progress disponible exige el consumidor actualizado. No desplegar un commit intermedio ni presentar cada capa como release autónoma; revisar/entregar el estado final completo mediante el mismo PR. No se reescriben los commits HU-021 ya publicados.

#### Commit propuesto 1: `feat(api): add authorized anthropometric evaluation history`

API completa con modelos/validadores/SQL/endpoint y sobre progress, contrato y pruebas puras/HTTP de esa capa. No incluye migraciones. El consumidor Web actualizado del commit 2 debe entregarse junto con esta API.

Archivos (13):

```text
apps/api/src/features/evaluations/controllers/evaluation.ts
apps/api/src/features/evaluations/domain/evolution.ts
apps/api/src/features/evaluations/repositories/evaluation.ts
apps/api/src/features/evaluations/repositories/evolution.ts
apps/api/src/features/evaluations/routes/evaluations.ts
apps/api/src/features/evaluations/services/evolution.ts
apps/api/src/features/evaluations/types/evolution.ts
apps/api/src/features/evaluations/validators/evolution.ts
apps/api/src/features/professional/services/record.ts
apps/api/src/features/professional/types/record.ts
apps/api/tests/evolution-api.test.ts
apps/api/tests/evolution.test.ts
docs/api/identity-lifecycle.openapi.json
```

#### Commit propuesto 2: `feat(web): integrate anthropometric history in client records`

Interfaz completa con tipos/guard del expediente, filtros, tabla/SVG, guías heterogéneas de Peso, paginación, caché y pruebas/regresiones. Depende del contrato del commit 1; no separar los cambios de caché del servicio HU-021 que los invalida.

Archivos (17):

```text
apps/web/src/features/evaluations/components/EvolutionChart.tsx
apps/web/src/features/evaluations/components/EvolutionSection.tsx
apps/web/src/features/evaluations/components/EvolutionSummary.tsx
apps/web/src/features/evaluations/components/EvolutionTable.tsx
apps/web/src/features/evaluations/hooks/useEvolution.ts
apps/web/src/features/evaluations/pages/EvaluationsPage.tsx
apps/web/src/features/evaluations/services/evaluations.ts
apps/web/src/features/evaluations/services/evolution.ts
apps/web/src/features/evaluations/types/evolution.ts
apps/web/src/features/evaluations/utils/evolution.ts
apps/web/src/features/professional/components/ClientRecordSections.tsx
apps/web/src/features/professional/pages/ProfessionalPage.tsx
apps/web/src/features/professional/services/record.ts
apps/web/src/features/professional/types/record.ts
apps/web/src/services/offline/readCache.ts
apps/web/tests/evolution-web.test.mjs
apps/web/tests/session-recovery.test.mjs
```

#### Commit propuesto 3: `test(api): verify evaluation history with isolated postgres`

Arnés físico opt-in, conexión de preparación separada, fixtures, pruebas RLS/API y limpieza. Depende del commit 1 y del esquema HU-021 ya existente; omitido por defecto sin permiso de PostgreSQL.

Archivos (1):

```text
apps/api/tests/evolution-postgres.test.ts
```

#### Commit propuesto 4: `docs(ep04): document hu-022 validation and review readiness`

Evidencia y guía integral, revisión visual parcial R, criterios/D0, limitaciones, inventario, plan de commits y borrador PR. Describe el estado de los commits 1–3; no declara aceptación independiente.

Archivos (1):

```text
docs/epicas/ep-04-antropometria/hu-022/README.md
```

La pertenencia de archivos al plan se verificó programáticamente contra `git diff --name-only` + `git ls-files --others --exclude-standard`: igualdad exacta y sin duplicados. No se incluyen `.env`, `.vite/`, dist, dependencias, respaldos, scripts temporales externos ni datos QA. Revisar de nuevo el inventario y secretos antes de una autorización futura; esta preparación no hace staging.

### Borrador de PR — NO creado

**Título:** `feat(ep04): add anthropometric history to client records (HU-022)`

**Base propuesta:** main. **Head:** feature/ep04-antropometria. **Revisor solicitado:** anglfer. Estado propuesto: revisión, no aprobación para merge/despliegue.

**Objetivo:** permitir al profesional consultar peso y medidas históricos de las evaluaciones HU-021 dentro del expediente, con fechas, origen y unidades, sin modificar las mediciones persistidas. Referencias RDF0505/RDF0802/RDF0807; dependencias HU-021, DEC-006/009.

**Cambios:**

- API de consulta paginada y por periodo/método; orden estable con microsegundos, cursor HMAC ligado a contexto y acceso profesional propietario bajo RLS.
- Evolución real en sections.progress; errores de autorización no se convierten en vacío. bodyWeightHistory sigue sin integrar HU-037.
- Web conserva Resumen | Entrenamiento | Evaluación; resumen Progreso, filtros, tabla completa y gráfica SVG, estados cero/una/múltiples y cobertura parcial explícita.
- Peso muestra guías visuales heterogéneas sin equivalencia clínica, mantiene puntos/IDs, no promedia y separa días con pesos contradictorios. Otras métricas conservan reglas de comparabilidad estrictas.
- Caché cifrada por cuenta/cliente/filtros/página, invalidación tras alta confirmada o sincronización HU-021, sin incorporar pendientes como muestras confirmadas.
- Sin migraciones ni cambios de datos/RLS/roles en bases existentes; se conserva HU-021 y su captura. Incluye arnés PostgreSQL opt-in con recursos temporales y limpieza, contrato y documentación HU-022.

**Validación:** 8/8 PostgreSQL/API/RLS físicas, 27/27 puras API, 9/9 HTTP con PostgreSQL doble y 134/134 Web; builds/lint/typecheck/Prettier/diff aprobados según evidencia. Recursos físicos temporales eliminados y huellas dev/test conservadas en esa ejecución. Validación OpenAPI adaptada aprobada; no se afirma certificación oficial integral.

**Revisión humana:** R parcial aprobado: guía 80 kg 11/nov → 54 kg 13/nov, 8 evaluaciones/6 pesos, separación del 9/nov y aviso heterogéneo/conservación. M01–M09 restantes pendientes; no declarar QA visual integral.

**Pendientes de revisión:** otro integrante debe revisar seguridad, cursores/SQL, contratos compartidos, historial, caché/cambio de cuenta y SVG/tabla, registrar hallazgos y resolverlos. D0 pendiente, especialmente revisión independiente y validación visual integral. No ejecutar tests físicos sin autorización de preparación temporal. No implementar HU-037 ni cálculos HU-023 en este PR.

**Integración/despliegue:** confirmar base HU-021 y cambios remotos antes de abrir el PR; API y Web deben actualizarse juntas. HU-022 no añade migración, pero el entorno destino debe disponer del esquema HU-021 multimétodo compatible. No se afirma aplicación en Supabase. Revisar automatizaciones externas/preview antes del push y cualquier despliegue con el supervisor; no ejecutar migraciones/despliegues desde esta preparación.

### Riesgos y condiciones previas a publicar

1. **R visual parcial:** completar o delimitar formalmente M01–M09 y casos no comprobables con los ocho datos actuales; no declarar aceptación total.
2. **D0 independiente pendiente:** otro integrante debe revisar y registrar decisión/observaciones. La preparación de este paquete por Codex no lo aprueba.
3. **Base Git:** referencia local origin/main=33110ea, HEAD=7ba0fb7; conteo local origin/main...HEAD=0/2, que corresponde a 16ddfa4 y 7ba0fb7 HU-021. En esa referencia HU-021 aún no está integrada. **No se hizo fetch ni consulta remota nueva**: puede estar desactualizada. Si sigue así, un PR a main incluiría también HU-021; no titular su diff como exclusivamente HU-022 sin resolver/explicar esa dependencia con el supervisor. No integrar ni reescribir ramas automáticamente.
4. **Sincronización/coordinación:** CONTRIBUTING exige comprobar main antes del push y avisar cambios compartidos. Es una tarea futura con autorización, no permiso para merge/rebase ahora. Conservar la rama ya acordada.
5. **Entrega coordinada:** cambios de API y consumidor progress deben estar juntos; no desplegar solo commit 1. Confirmar esquema HU-021 en destino con responsables de BD; ninguna migración nueva HU-022.
6. **Automatizaciones externas:** no hay .github/workflows en este checkout. Esto no descarta hooks externos/auto-deploy. Vercel versionado reescribe /api hacia una API productiva; no usar preview para pruebas de escritura sin confirmar destino. Configuración remota Render/Vercel y rama conectada sin verificar; supervisor debe confirmarlas antes de publicar. No se accedió a paneles ni se desplegó.
7. **Publicación no autorizada:** falta aprobación expresa para staging/commits y posteriormente push/PR según el flujo que autorice la persona usuaria. No se crean por este documento. Confirmar inventario/secrets/diff y calidad correspondiente si cambia código después.

### Alcance de esta actualización documental

Se modificó solo este README. No hubo cambios funcionales, consultas/escrituras PostgreSQL, migraciones, roles, permisos, instalaciones, staging, commits, push, PR, merge, rebase ni cambio de rama. La evidencia técnica se conserva sin repetir pruebas innecesarias. Se comprobarán formato, enlaces y git diff --check al cerrar. **Preparado para revisión; no D0 aprobado ni publicación autorizada.** Esperar resultados y autorización de la persona usuaria antes de ejecutar acciones de Git.

**Distinción de puertas:** D0.8 exige revisión independiente antes del merge. D0 pendiente y QA visual parcial impiden declarar la historia cerrada o aprobada para integración; no se inventa una regla que prohíba publicar una rama solo para revisión si después lo autoriza expresamente el supervisor con esos pendientes visibles. En esta tarea no se autorizó ninguna acción Git de escritura. Antes de un eventual push deben resolverse o aceptarse explícitamente los riesgos de destino/automatizaciones y coordinarse la base HU-021.

## Etapa 5 — preparación final verificada, sin ejecutar commits ni push

### E/T — estado Git y comparación remota actuales

Leídos AGENTS.md, CONTRIBUTING.md, DEVELOPMENT.md y la evidencia/plan de HU-022. MCP Codebase Memory no disponible; no se afirmó consulta al grafo. No hubo cambios funcionales ni de entorno.

- Rama local y upstream: **feature/ep04-antropometria → origin/feature/ep04-antropometria**.
- HEAD local y rama EP-04 en GitHub, confirmada mediante `git ls-remote --heads origin`: **7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6**. No hay divergencia de commits con EP-04 remoto; HU-022 sigue sin commit.
- GitHub main y main local: **33110ea7e6706842fb7ee7ad9aee76834fa1138e**. La comparación muestra 0/2: commits HU-021 16ddfa4 y 7ba0fb7, ya publicados en EP-04, aún no presentes en main. Se confirmó ahora mediante hashes remotos, no solo una referencia local antigua.
- No se ejecutó fetch ni se actualizaron referencias. **main es solo comparación/base potencial del PR**, nunca destino de estos commits/push. Es ancestro de la rama en el estado observado; no hace falta integrar nuevos commits de main con esos hashes. Si cambia después, detenerse y coordinar; no merge/rebase automático.
- Un único push URL de origin: repositorio GitHub anglfer/CouchOneFit, sin credenciales incrustadas. remote.origin.mirror y push.followTags no configurados. No hay hooks locales activos pre-commit, prepare-commit-msg, commit-msg, post-commit o pre-push ni hooksPath alternativo.
- Esto no verifica automatizaciones externas de Render/Vercel ni evita revisar su riesgo antes de un push autorizado.

### Inventario definitivo comprobado

**32 candidatos: 14 modificados y 18 nuevos sin seguimiento; índice vacío.** Se conserva exactamente el reparto documentado arriba: 13 API/contrato, 17 Web, 1 test PostgreSQL y 1 README. Igualdad verificada contra git diff --name-only y git ls-files --others --exclude-standard, sin archivos omitidos o duplicados.

Inspección de rutas y patrones de claves/tokens/URLs con contraseña sin hallazgos; no es una certificación exhaustiva de secretos. Ningún .env, respaldo/dump, base local, log, caché, node_modules o compilado aparece entre los candidatos. .vite/, .env API y dist siguen ignorados. Los tests contienen **fixtures sintéticas intencionales**, no credenciales QA reales ni volcados de datos de desarrollo. Los scripts temporales externos no se incluyen.

### T — verificaciones seguras repetidas en esta preparación

| Comprobación                                             | Resultado actual                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Build API                                                | Aprobado, TypeScript                                                                                                                      |
| Build Web                                                | Aprobado, TypeScript/Vite                                                                                                                 |
| API puras HU-021/HU-022/SaaS                             | **27/27**                                                                                                                                 |
| HTTP HU-022 con Pool real bloqueado y persistencia doble | **9/9**                                                                                                                                   |
| Suite Web completa serial                                | **134/134**, cero fallos/cancelaciones                                                                                                    |
| Lint Web                                                 | Aprobado sin advertencias                                                                                                                 |
| TypeScript estricto del arnés físico                     | Aprobado, sin ejecutarlo                                                                                                                  |
| Prettier de los 32 candidatos                            | Aprobado; API sigue estilo sin punto y coma, Web su configuración existente                                                               |
| OpenAPI adaptado                                         | Aprobado: 33 componentes/117 referencias/26 operaciones, 7 válidos y 8 inválidos; contratos HU-021 conservados salvo progress intencional |
| git diff --check                                         | Limpio                                                                                                                                    |

Limitación OpenAPI oficial dinámica conservada: no se declara validación integral oficial. Avisos conocidos de bundle >500 kB y escaneo virtual:pwa-register en el arnés, sin fallos por ellos. **No se ejecutaron pruebas físicas ni escrituras PostgreSQL**: 8/8 físicas son evidencia anterior, no resultado repetido. No se ejecutó npm test API completo ni se instalaron dependencias.

### Comandos futuros de commits — NO ejecutados

Desde la raíz del repositorio y **solo tras autorización expresa**. Corresponden exactamente a las cuatro listas aprobadas. El bloque comprueba rama/HEAD inicial e índice vacío, usa rutas explícitas, comprueba diff y muestra archivos tras cada commit. Debe revisarse otra vez el inventario y los contenidos si cambian antes de ejecutarlo. API/Web son una entrega coordinada; no desplegar commits intermedios.

```bash
(
  set -eu
  test "$(git branch --show-current)" = "feature/ep04-antropometria"
  test "$(git rev-parse HEAD)" = "7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6"
  test -z "$(git diff --cached --name-only)"
  git add -- \
    apps/api/src/features/evaluations/controllers/evaluation.ts \
    apps/api/src/features/evaluations/domain/evolution.ts \
    apps/api/src/features/evaluations/repositories/evaluation.ts \
    apps/api/src/features/evaluations/repositories/evolution.ts \
    apps/api/src/features/evaluations/routes/evaluations.ts \
    apps/api/src/features/evaluations/services/evolution.ts \
    apps/api/src/features/evaluations/types/evolution.ts \
    apps/api/src/features/evaluations/validators/evolution.ts \
    apps/api/src/features/professional/services/record.ts \
    apps/api/src/features/professional/types/record.ts \
    apps/api/tests/evolution-api.test.ts \
    apps/api/tests/evolution.test.ts \
    docs/api/identity-lifecycle.openapi.json
  git diff --cached --check
  git diff --cached --name-status
  git commit -m "feat(api): add authorized anthropometric evaluation history"
  git show --format=short --name-status HEAD
  test -z "$(git diff --cached --name-only)"
  git add -- \
    apps/web/src/features/evaluations/components/EvolutionChart.tsx \
    apps/web/src/features/evaluations/components/EvolutionSection.tsx \
    apps/web/src/features/evaluations/components/EvolutionSummary.tsx \
    apps/web/src/features/evaluations/components/EvolutionTable.tsx \
    apps/web/src/features/evaluations/hooks/useEvolution.ts \
    apps/web/src/features/evaluations/pages/EvaluationsPage.tsx \
    apps/web/src/features/evaluations/services/evaluations.ts \
    apps/web/src/features/evaluations/services/evolution.ts \
    apps/web/src/features/evaluations/types/evolution.ts \
    apps/web/src/features/evaluations/utils/evolution.ts \
    apps/web/src/features/professional/components/ClientRecordSections.tsx \
    apps/web/src/features/professional/pages/ProfessionalPage.tsx \
    apps/web/src/features/professional/services/record.ts \
    apps/web/src/features/professional/types/record.ts \
    apps/web/src/services/offline/readCache.ts \
    apps/web/tests/evolution-web.test.mjs \
    apps/web/tests/session-recovery.test.mjs
  git diff --cached --check
  git diff --cached --name-status
  git commit -m "feat(web): integrate anthropometric history in client records"
  git show --format=short --name-status HEAD
  test -z "$(git diff --cached --name-only)"
  git add -- \
    apps/api/tests/evolution-postgres.test.ts
  git diff --cached --check
  git diff --cached --name-status
  git commit -m "test(api): verify evaluation history with isolated postgres"
  git show --format=short --name-status HEAD
  test -z "$(git diff --cached --name-only)"
  git add -- \
    docs/epicas/ep-04-antropometria/hu-022/README.md
  git diff --cached --check
  git diff --cached --name-status
  git commit -m "docs(ep04): document hu-022 validation and review readiness"
  git show --format=short --name-status HEAD
  test -z "$(git diff --cached --name-only)"
  git status --short
  git log --oneline -4
  test "$(git rev-list --count 7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6..HEAD)" = "4"
)
```

Verificación posterior prevista: árbol limpio, cuatro commits sobre el HEAD HU-021 y archivos exactos de cada grupo, sin duplicados/omisiones/secretos. Si cambia el HEAD o ya hay staging ajeno, la guarda falla: no reset/stash ni forzar para pasarla. Ninguno de esos comandos se ha ejecutado en esta tarea.

### Comando futuro de push — NO ejecutado y autorización separada

Antes: obtener autorización expresa de push, confirmar riesgo externo de despliegue, revisar los cuatro commits y repetir consulta remota. Este bloque verifica árbol limpio, base local de cuatro commits, único destino origin esperado y rama remota aún en el hash revisado. Deshabilita mirror/followTags solo para ese comando y usa un **refspec completo exclusivo de EP-04**, sin force. Si el remoto avanzó, detenerse; no sobrescribirlo.

```bash
(
  set -eu
  test "$(git branch --show-current)" = "feature/ep04-antropometria"
  test -z "$(git status --porcelain)"
  test "$(git rev-parse HEAD~4)" = "7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6"
  test "$(git rev-list --count 7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6..HEAD)" = "4"
  test "$(git remote get-url --push --all origin)" = "https://github.com/anglfer/CouchOneFit.git"
  hu022_remote_before=$(git ls-remote --heads origin refs/heads/feature/ep04-antropometria | cut -f1)
  test "$hu022_remote_before" = "7ba0fb73ba694d21b23f7f393b8c87aedcf35cb6"
  git log --oneline -4
  git -c remote.origin.mirror=false -c push.followTags=false push --no-follow-tags origin refs/heads/feature/ep04-antropometria:refs/heads/feature/ep04-antropometria
  git ls-remote --heads origin refs/heads/feature/ep04-antropometria
  git status --short
)
```

La verificación real posterior deberá comprobar que el hash remoto coincide con HEAD y que ambos componentes API/Web se publicaron juntos; la simple impresión de ls-remote no constituye por sí sola esa comparación. No abrir PR automáticamente. **No hay comando de escritura dirigido a main** en este plan; tampoco checkout, pull, merge, rebase, reset, clean o stash.

### Pendientes y puertas de autorización

- R parcial de Peso aprobada permanece exacta: guía 80 kg 11/nov → 54 kg 13/nov, 8 evaluaciones/6 pesos, 9/nov ambiguo separado y registros/aviso heterogéneo conservados. M01–M09 y QA visual integral no se aprueban automáticamente.
- D0.8 exige otro integrante; D0.10 conserva pendiente el recorrido integral. Revisor futuro **anglfer**, sin solicitud enviada ni aprobación atribuida.
- Resolver con supervisor cómo integrar HU-021 antes de describir un PR como exclusivamente HU-022: actualmente un diff contra main incluiría también los dos commits HU-021 existentes. No se modifican ni se publican nuevamente como commits nuevos.
- Confirmar/aceptar riesgo externo de despliegue y conexiones de preview, coordinación de archivos compartidos y esquema HU-021 del destino. No hay nueva migración HU-022.
- Esta fase autoriza preparación y validación, **no staging, commit, push, PR ni merge**. Falta autorización expresa para ejecutarlos. Publicar una rama para revisión no equivale a D0 aprobado, integración o despliegue.

### IMPACTO SOBRE OTROS MÓDULOS

Solo se actualiza este README para registrar evidencia y comandos, manteniendo el inventario de 32. **Sin regresiones detectadas en las pruebas ejecutadas**, dentro de la cobertura API pura/HTTP doble/Web de HU-021, expediente/cartera, sesiones, entrenamiento y offline. No se alteran API/Web/BD, datos, roles, permisos, migraciones, dependencias ni .env. Sin commits/publicaciones ni modificaciones de main; esperar autorización.
