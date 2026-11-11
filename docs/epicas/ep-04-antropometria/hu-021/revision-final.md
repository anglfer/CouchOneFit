# HU-021 — auditoría de preparación para publicación, 10-nov-2026

## Dictamen

**CONTRATO HU-021 CORREGIDO EN LAS DISCREPANCIAS COMPROBADAS; LISTA PARA REVISIÓN INDEPENDIENTE.** Los hallazgos OAS-01–06 se corrigieron exclusivamente en OpenAPI, sin cambiar API/Web/BD. La validación estructural adaptada y los contrastes con validadores/consumidores pasan; no se afirma aprobación del esquema oficial sin adaptar. Revisión humana R 7/7 conservada; D0 independiente, coordinación, excepción de rama y confirmaciones Render/Vercel pendientes. Ver la sección final de corrección contractual para la evidencia vigente.

## Fuentes contrastadas

AGENTS.md, DEVELOPMENT.md, CONTRIBUTING.md, plan/PLAN_TRABAJO_V2.md (HU-021, DEC-006/007, D0 §5.2), docs/requirements/sistema-interno.md RDF0501–0503, docs/database/convenciones.md, README.md y modelos de identidad/ciclo de acceso; contrato del expediente HU-019; implementación API/Web, SQL, OpenAPI y pruebas actuales. Codebase Memory no está disponible: inspección estática, sin afirmar consulta del grafo.

## Evidencia de la auditoría anterior a ejecutar PostgreSQL

- **T:** Web suite serial 94/94, build, lint aprobados. Incluye autenticación/recuperación, cartera, pestañas del expediente, guardado, historial, idempotencia/doble envío, errores, migración pendiente y offline con dobles de transporte. No acredita una base real ni revisión visual.
- **T:** Unitarias API seguras 21/21: assessment (6), evaluations (5), client-edit (1), client-initial-record (5), saas-validation (4). Build API aprobado.
- **T:** Comprobación estricta adicional de los archivos de tests: inicialmente señaló cuatro errores en helpers HU-021 (dos casts de cookies y dos cuerpos unknown), corregidos. Permanecen cinco diagnósticos en casos previos de cartera/edición/estado. El compilador, sustituyendo solo el test por su contenido HEAD en memoria y manteniendo los mismos módulos actuales, reproduce exactamente esos cinco diagnósticos; no se modificaron casos ajenos. El build oficial excluye tests y pasa. Esta comprobación adicional NO se reporta como aprobada.
- **T:** Prettier de los archivos Web afectados aprobado tras corregir únicamente formato en ClientRecordView.tsx y services/record.ts. El primer chequeo detectó esos dos archivos; no se oculta el fallo inicial.
- **T:** JSON OpenAPI legible, 102 referencias locales resueltas y 25 operationId únicos. No hay validador semántico OpenAPI instalado; no se instaló ninguno. No equivale a validación OpenAPI completa ni a contrato contrastado con PostgreSQL.
- **T:** git diff --check limpio. Escaneo acotado de cambios no detectó patrones de claves privadas ni conexiones externas con credenciales; no sustituye auditoría independiente de secretos. .env local ignorado; sin archivos de credenciales en el manifiesto.
- **T:** git ls-remote confirmó main y feature/ep04-antropometria en 33110ea7e6706842fb7ee7ad9aee76834fa1138e, igual al HEAD local. Sin fetch/integración. Índice vacío.
- **E:** DATABASE_URL: host 127.0.0.1, puerto 5433, base CouchOneFit_dev, rol couchone_api. TEST_DATABASE_URL ausente. Solo se inspeccionó configuración; no se abrió conexión PostgreSQL.
- **R:** Pukzil había probado registro, historial y validaciones antes de los últimos cambios de navegación/UX. Esa evidencia no sustituye revisión humana de la interfaz actual ni guardado multimétodo sobre una base migrada.

## Matriz de aceptación

| Criterio | Implementación | Prueba | Resultado actual |
| --- | --- | --- | --- |
| Fecha servidor/asociación | repositories/evaluation.ts: contexto, cartera bloqueada y INSERT sin fecha técnica; defaults SQL UTC; snapshot ownerId desde sesión | client-read-isolation: alta HTTP, fecha, propietario, los tres métodos | Parcial: código inspeccionado; integración NO ejecutada |
| Opcionales sin inventar valores | validators/evaluation.ts y assessment.ts; DTO null legado, claves ausentes snapshot | evaluations.test.ts y assessment.test.ts | Unitarias aprobadas; SQL/HTTP pendientes |
| Rechazar inválidos | límites/precisión/unknown en validators; CHECK de columnas originales en SQL | unitarias fronteras/precisión; restricciones SQL en client-read-isolation | Parcial: unitarias aprobadas, SQL pendiente |
| Conservar historia | INSERT independiente, sin UPDATE/DELETE runtime, FK RESTRICT; consulta por páginas | HTTP compara snapshots completos antes/después de edición e inactivación/reactivación; migration upgrade conserva fila heredada | Parcial: Web/unitarias aprobadas; conservación PostgreSQL pendiente |
| Prohibir clientes ajenos | requireProfessional, assertPortfolio, training_professional, RLS por sujeto | client-read-isolation: dos profesionales, rol ordinario, INSERT/SELECT ajenos | Parcial: inspección y Web; HTTP/RLS reales NO ejecutados |

BD1/API1/WEB1: implementadas localmente, con integración PostgreSQL pendiente. QA1: parcial. D0: no cumplido aún (permisos e integración reales, migraciones reproducibles, revisión de otro integrante y recorrido humano actual pendientes). No presentar pendientes como pruebas verdes.

## Correcciones de esta auditoría

- OpenAPI distingue fecha técnica del servidor y fecha efectiva retroactiva validada; documenta 503 EVALUATION_UPGRADE_REQUIRED y null de peso/altura conforme al validator multimétodo.
- Las pruebas de conservación ahora comparan el historial completo, no solo el conteo.
- Nueva integración HTTP para cada método con identidad del servidor, null, fecha efectiva, replay, payload distinto, cliente ajeno/inexistente, CSRF y roles no autorizados. **Pendiente de ejecución PostgreSQL**, no se cuenta entre las 21 unitarias.
- Nuevas unitarias de null/omisión, límites de todos los pliegues y campos técnicos/asociaciones manipulados (aprobadas).
- Helpers HTTP HU-021 tipados sin casts incompatibles ni cuerpo unknown para Supertest. Las nuevas aserciones de seguridad usan el CSRF real del arnés.
- Formato de dos archivos compartidos con integración HU-021 previa, sin cambios semánticos.

## Migraciones y límites de comprobación

Hay 28 archivos en orden. 202611080001 depende de clients, professionals, roles y training_professional ya definidos por incrementos previos; 202611090001 añade assessment sobre la tabla anterior. No hay migraciones históricas versionadas modificadas. Ambas migraciones nuevas aparecen completas en el esquema integrado (comparación textual), pero equivalencia de catálogos exige ejecutar migrations.test.ts.

SHA-256 local (no contrastado con migrations.history de ninguna base):

- 202611080001_client_evaluations.sql: d087d203a4de4402b2ad2dba9c648a02b726a9bcb3ac99f9ebeea412df37924a
- 202611090001_multimethod_evaluations.sql: c40a00ad6e04c3a9bb1b478a281dea3afc334c9022bee123b159fd8d567e43f5

No se modificaron estos archivos. El migrador verifica hashes, admite únicamente variantes LF/CRLF y aplica pendientes en transacción con advisory lock. La migración extendida conserva filas antiguas con assessment NULL y no infiere método. La prueba de upgrade prepara una evaluación heredada y compara columnas originales.

Hallazgo previo al endurecimiento: la precisión y rangos de columnas originales tienen CHECK SQL; el snapshot JSONB inicial tenía controles estructurales/positividad/fecha/owner, pero NO replicaba todos los rangos/precisión por cada clave de método ni toda coherencia de resultados. La nueva migración 202611100001 corrige los invariantes de mediciones; los resultados siguen siendo autoritativos de la API, sin duplicar el motor de cálculo en SQL. La API sí los valida. No afirmar que SQL JSON equivale al validador; requiere contraste de pruebas directas y revisión antes de declarar defensa SQL completa. No modificar checksums anteriores para endurecerlo: cualquier corrección SQL posterior requiere nueva migración.

El propietario histórico legado se resuelve mediante client_id → clients.professional_id, no existe columna professional_id de evaluación original. Las filas nuevas multimétodo guardan además ownerId de cuenta autenticada en snapshot. No atribuir a las filas antiguas un snapshot inexistente.

## Bloqueo PostgreSQL anterior (resuelto para las dos suites autorizadas)

Solicitud de autorización enviada para ejecutar SOLO migrations.test.ts y client-read-isolation.test.ts con conexión local de preparación existente, verificada en PG >=17/UTF8/pg_c_utf8, 127.0.0.1:5433. No se ejecutó el arnés ni se provisionó un rol.

Recursos temporales de esos dos arneses:

- Cuatro bases CouchOneFit_{migration,schema,legacy,evaluation_upgrade}_test_<12 hex>.
- Una base cof_read_<12 hex>.
- Roles cof_migration_<12 hex> y cof_read_<12 hex>; este último runtime NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE.
- Finalmente cierra pools y elimina solo los nombres que creó. Los roles couchone_registration/authentication son globales y el esquema puede crearlos si faltan: no confundir aislamiento de base con aislamiento absoluto de clúster.

La preparación requiere CREATE DATABASE/CREATEROLE y permisos suficientes para esquema/grants/SET ROLE; NO concederlos a couchone_api. Las guardas de los tests comprueban host local, pero no fijan 5433/version por sí solas. Un preflight autorizado debe verificar host, puerto, base, rol, versión, encoding y collation; si no coinciden, no ejecutar.

No ejecutar la suite API completa bajo esta autorización limitada: registration/login/admin escriben directamente en TEST_DATABASE_URL (y admin crea roles). Necesita autorización separada para esa base exclusiva o adaptar el procedimiento con aprobación. Nunca usar dev como base desechable.

## Impacto y alcance

No hay cambios funcionales nuevos en API/Web durante esta auditoría: solo pruebas/documentación y formato. Los diffs acumulados incluyen app.ts, composición/tipos del expediente, pestañas/enrutamiento y motor offline común. Deben publicarse coordinadamente; no excluir esos consumidores ni las migraciones por ser archivos compartidos. No se cambió lógica auth/planes/entrenamiento ni Flutter en esta auditoría. Sin regresiones detectadas en cobertura Web/unitarias ejecutada; API/RLS completos NO verificados.

Perímetros/pliegues/bioimpedancia y aritmética de resultados son alcance adicional existente. Falta migración multimétodo para persistencia real en desarrollo. La UI informa migración pendiente sin éxito falso ni encolado indefinido. Fórmulas deshabilitadas/protocolos anatómicos pendientes no deben presentarse como cálculo clínico validado.

## Preparación Git

No staging, commit, push, PR, cambios de rama ni publicaciones. Propuesta al completar bloqueos y prueba humana: un commit vertical `feat(ep04): integrate dated client evaluations`, con contratos/SQL/API/Web/pruebas/documentación juntos. Revisor según CONTRIBUTING: anglfer; coordinación de archivos compartidos mediante Pukzil. No enviar mensajes al equipo automáticamente.

Excluir .vite/deps_temp_d6f12e9a/package.json (generado); conservarlo local sin borrarlo. .env, dist, node_modules, credenciales y datos locales no se incluyen. No usar git add global.

## Manifiesto candidato (revisar otra vez antes de staging)

Estado actual: **55 rutas candidatas, 28 modificadas y 27 nuevas**, tras añadir el HANDOFF versionable solicitado. La auditoría anterior de 54 queda conservada como evidencia histórica. .vite está excluida y conservada; sin staging ni autorización de publicación.

- **M** `.gitignore`
- **M** `apps/api/src/app.ts`
- **N** `apps/api/src/features/evaluations/controllers/evaluation.ts`
- **N** `apps/api/src/features/evaluations/domain/assessment.ts`
- **N** `apps/api/src/features/evaluations/repositories/evaluation.ts`
- **N** `apps/api/src/features/evaluations/routes/evaluations.ts`
- **N** `apps/api/src/features/evaluations/services/evaluation.ts`
- **N** `apps/api/src/features/evaluations/types/evaluation.ts`
- **N** `apps/api/src/features/evaluations/validators/assessment.ts`
- **N** `apps/api/src/features/evaluations/validators/evaluation.ts`
- **M** `apps/api/src/features/professional/services/record.ts`
- **M** `apps/api/src/features/professional/types/record.ts`
- **N** `apps/api/tests/assessment.test.ts`
- **M** `apps/api/tests/client-read-isolation.test.ts`
- **N** `apps/api/tests/evaluations.test.ts`
- **M** `apps/api/tests/migrations.test.ts`
- **N** `apps/web/src/features/evaluations/components/AnatomicalGuide.tsx`
- **N** `apps/web/src/features/evaluations/components/AssessmentForm.tsx`
- **N** `apps/web/src/features/evaluations/components/CompositionResults.tsx`
- **N** `apps/web/src/features/evaluations/components/EvaluationSummary.tsx`
- **N** `apps/web/src/features/evaluations/components/EvaluationsSection.tsx`
- **N** `apps/web/src/features/evaluations/pages/EvaluationsPage.tsx`
- **N** `apps/web/src/features/evaluations/services/evaluations.ts`
- **N** `apps/web/src/features/evaluations/types/assessment.ts`
- **N** `apps/web/src/features/evaluations/types/evaluation.ts`
- **M** `apps/web/src/features/professional/components/ClientHeader.tsx`
- **M** `apps/web/src/features/professional/components/ClientRecordSections.tsx`
- **M** `apps/web/src/features/professional/components/ClientRecordView.tsx`
- **M** `apps/web/src/features/professional/pages/ProfessionalPage.tsx`
- **M** `apps/web/src/features/professional/services/record.ts`
- **M** `apps/web/src/features/professional/types/record.ts`
- **M** `apps/web/src/services/offline/connection.ts`
- **M** `apps/web/src/services/offline/outbox.ts`
- **M** `apps/web/src/services/offline/readCache.ts`
- **M** `apps/web/src/services/offline/sync.ts`
- **M** `apps/web/src/services/offline/writes.ts`
- **M** `apps/web/tests/offline-read.test.mjs`
- **M** `apps/web/tests/offline-write.test.mjs`
- **M** `apps/web/tests/session-recovery.test.mjs`
- **M** `docs/api/identity-lifecycle.openapi.json`
- **M** `docs/architecture/domain-glossary.md`
- **M** `docs/database/README.md`
- **N** `docs/database/migrations/202611080001_client_evaluations.sql`
- **N** `docs/database/migrations/202611090001_multimethod_evaluations.sql`
- **N** `docs/database/migrations/202611100001_evaluation_measurement_integrity.sql`
- **M** `docs/database/schemas/identity_access.sql`
- **M** `docs/epicas/ep-03-cartera-y-expediente/estado-e-integracion.md`
- **M** `docs/epicas/ep-03-cartera-y-expediente/hu-019/README.md`
- **M** `docs/epicas/ep-03-cartera-y-expediente/seguimiento-auditoria.md`
- **N** `docs/epicas/ep-04-antropometria/hu-021/COUCHONEFIT_HU021_HANDOFF.md`
- **N** `docs/epicas/ep-04-antropometria/hu-021/README.md`
- **N** `docs/epicas/ep-04-antropometria/hu-021/multimethod.md`
- **N** `docs/epicas/ep-04-antropometria/hu-021/revision-final.md`
- **N** `docs/epicas/ep-04-antropometria/hu-021/validacion-local.md`
- **M** `plan/PLAN_TRABAJO_V2.md`

## Ejecución PostgreSQL autorizada — resultado vigente, 10-nov-2026

**T:** conexión SQL de solo lectura a la base administrativa postgres, host 127.0.0.1, puerto 5433, versión 170011 (17.11), UTF8 y collation pg_c_utf8. Rol de preparación existente yutzilsanchez con SUPERUSER/CREATEDB/CREATEROLE; no se creó ni se elevó ese rol. postgres no contiene tablas de usuario/proyecto. No se conectó a CouchOneFit_dev ni CouchOneFit_test.

Los cinco roles globales inglés/históricos/provisión ya existían, todos NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS. Solo existían las membresías registro→autenticación de cada idioma y autenticación→couchone_api, con grantor de preparación, sin ADMIN y con INHERIT/SET. Los CREATE ROLE repetidos se capturan como duplicados; los GRANT globales ya estaban concedidos con las mismas opciones y no cambiaron el catálogo. No se ejecutaron las ramas de renombrado ni transferencia a miembros adicionales. Comparación exacta de OID/atributos/membresías antes/después aprobada en cada ejecución.

Se usó un envoltorio local fuera del repositorio, /tmp/cof-hu021-pg-check.cjs, que valida servidor/base/rol, ausencia de tablas del proyecto, existencia y atributos/membresías exactas de los roles compartidos, y ausencia de recursos temporales. Crea una base de preparación única cof_hu021_setup_<12 hex>_test para satisfacer la guarda del arnés de aislamiento sin usar la base test existente; solo lanza las dos suites autorizadas, con DATABASE_URL y TEST_DATABASE_URL del proceso hijo dirigidas a esa base vacía. No cambia .env. Antes de CREATE DATABASE/ROLE cada arnés comprueba que su nombre no existe. Solo se eliminan recursos cuya creación fue exitosa.

Resultados reales:

1. El primer preflight del envoltorio rechazó la representación textual 127.0.0.1/32; se corrigió a host(inet_server_addr()). No había ejecutado escrituras.
2. Primera ejecución de suites: **36/38 aprobadas, 2 fallidas**. Fixture HU-021 de edición tenía conjunto base incompleto y produjo 400 correcto; fixture de actualización tenía hash sintético que no cumplía el prefijo Argon2id. Se corrigieron las fixtures, sin cambiar reglas de producto ni restricciones.
3. Repetición tras correcciones: **38/38 aprobadas**.
4. Después del endurecimiento JSONB y nueva regresión SQL: **39/39 aprobadas** = client-read-isolation **38/38**, migrations **1/1**. Cero fallos/cancelaciones/omitidas. Build API y git diff --check posteriores aprobados.

La instalación limpia aplica 29 migraciones; segundo migrate no aplica nada. Se comprobaron equivalencia de catálogos contra esquema integrado, hashes/variantes LF-CRLF, rechazo de contenido modificado/archivo ausente y actualización con evaluación heredada conservada sin inventar método. El índice no limita la historia: API pagina 20 filas y el expediente resume 20.

La integración HTTP crea y relee los tres métodos con fecha técnica UTC y snapshot de profesional desde sesión. Fecha efectiva retroactiva se conserva; opcionales no inventan valores; replay devuelve el mismo registro. El historial completo permanece idéntico después de editar peso base e inactivar/reactivar. Dos profesionales, roles no permitidos, falta de CSRF y cliente inexistente/ajeno reciben rechazos. Lectura e INSERT SQL bajo runtime ordinario prueban RLS, ausencia de UPDATE/DELETE y de INSERT de fechas técnicas.

La nueva prueba SQL rechaza pliegues fuera de rango, exceso de decimales, NULL/texto en snapshot normalizado, claves cruzadas de método, datos generales solos, masas/segmentos incompatibles, discrepancias con columnas originales y ownerId ajeno; acepta snapshots parciales válidos. El snapshot persistido previo no se modifica. Las excepciones de fallo sintético en logs son casos esperados de rollback y pasaron.

Nueva migración **202611100001_evaluation_measurement_integrity.sql**, SHA-256 9aa4883442947f7d51382517b7570f21c9fbac38cd42f9063fc1e7ab7b170272: CHECK de campos por método, límites y decimal, medición propia requerida, coherencia de masas/segmentos kg y correspondencia con columnas históricas. No agrega funciones de negocio, grants ni políticas; no reescribe datos. Legacy assessment NULL sigue válido. Ante un snapshot previo incompatible, la migración falla/rollback para revisión, nunca lo normaliza.

### Recursos y limpieza

Cada ejecución de suites creó/eliminó **6 bases temporales y 2 roles temporales**: una base de preparación + cuatro de migrations + una de aislamiento, y cof_read/cof_migration. Hubo tres ejecuciones de suites (18 bases/6 roles en total), todas con limpieza comprobada y catálogo global de roles sin cambios. Las bases de preparación fueron:

- cof_hu021_setup_886728d64b01_test (primera ejecución, dos fallos).
- cof_hu021_setup_0e2914bb2e04_test (38/38).
- cof_hu021_setup_372ab5825d29_test (39/39).

Las otras bases/roles usan los sufijos aleatorios internos del arnés; no se registraron sus identificadores completos en esta ejecución. La comprobación final del catálogo de cada ejecución devuelve listas vacías para todos sus patrones. No se eliminaron recursos preexistentes; no se tocaron Supabase, PG16:5432, roles compartidos ni couchone_api.

### Criterios y siguiente autorización

Los cinco criterios originales quedan demostrados en el entorno aislado autorizado (API/BD y Web con transporte simulado). BD1/API1 están verificadas allí; WEB1 conserva sus pruebas previas; QA1 cubre las dos suites autorizadas. D0 sigue parcial por revisión independiente y validación de la versión desplegada localmente. La suite API completa NO se ejecutó por restricción expresa. Web 94/94, unitarias seguras 21/21 y lint/build Web son evidencia anterior, no repetida en este encargo sin cambios Web. Continúan cinco diagnósticos de typecheck adicional de tests preexistentes y validación semántica OpenAPI completa pendiente.

Solicitar autorización antes de aplicar pendientes a desarrollo con rol de migración separado, previa lectura del historial y checksum del destino. No ejecutar el esquema integrado sobre bases existentes. Después probar desde el navegador y remitir a revisión independiente; commit/push siguen sin autorización.

El manifiesto candidato incluye `docs/database/migrations/202611100001_evaluation_measurement_integrity.sql`. Los dos archivos SQL anteriores mantienen sus SHA-256 intactos.


## Auditoría de los archivos candidatos — 10-nov-2026

- **T:** Inventario completo inicial 54 (27 M + 27 N), final 54 (28 M + 26 N). Solo se añadió `/.vite/` al .gitignore raíz y se actualizaron evidencias en documentos HU-021 existentes. `git check-ignore -v` confirma la regla; la caché sigue físicamente presente y no estaba versionada. No se tocaron configuraciones Vite, lockfiles ni dependencias.
- **E:** Los tres diffs de EP-03 son referencias legítimas: estado-e-integracion distingue secciones sin lector y EvaluationSection real; hu-019/README añade aviso fechado y enlace a HU-021 conservando evidencia histórica; seguimiento-auditoria adapta la descripción de la prueba vertical a evaluations empty. Sin cambios de asignación ni reglas de EP-03.
- **T/E:** session-recovery.test.mjs tiene 715 líneas añadidas y 13 eliminadas (728 líneas cambiadas), no 728 añadidas. Análisis AST: 31 llamadas test en HEAD, 48 actuales; 18 nombres nuevos, uno corresponde al reemplazo/ampliación del caso de errores del lector HU-019. No hay cuerpos idénticos tras normalizar espacios. Revisión de las aserciones: alta/consulta, vacío/error, validación, offline, borradores, resultados preliminares, segmentos, contexto y pestañas, migración pendiente, doble envío, abandono, StrictMode, redirecciones, cliente ajeno e inactivo. Las pruebas de offline-write verifican transporte/cola/idempotencia, mientras las de sesión verifican UI y navegación: solapamiento deliberado entre capas, sin duplicación que justifique borrar pruebas.
- **T/E:** Los 17 archivos nuevos de código son alcanzables desde server.ts/main.tsx mediante imports (también imports de tipos). API: app→routes→controller→service→validator/repository/domain. Web: ProfessionalPage→EvaluationsPage→AssessmentForm/EvaluationsSection; AnatomicalGuide/CompositionResults dentro del formulario y EvaluationSummary desde ClientRecordSections. Las dos pruebas nuevas se descubren por el patrón npm; las migraciones por el runner; documentación enlazada. No se detectaron archivos nuevos huérfanos.
- **T:** Tres migraciones presentes exactamente una vez y en el mismo orden en el esquema integrado; hashes anteriores intactos, 29 archivos. La ejecución PostgreSQL 39/39 descrita arriba sigue siendo la última evidencia, no se repitió en una auditoría que solo cambió ignore/documentación.
- **T:** Escaneo de las 54 rutas: sin patrones detectados de claves privadas, URLs con usuario/contraseña, JWT completos o claves de proveedor; sin archivos de entorno/compilación/caché/dumps entre candidatos. Los valores sintéticos de fixtures no son credenciales reales. El escaneo por patrones no demuestra ausencia absoluta de secretos. Enlaces locales Markdown de candidatos verificados sin faltantes; git diff --check limpio.
- **E:** Codebase Memory MCP no disponible; se utilizó inspección estática y AST local, sin afirmar consulta del grafo MCP. No hubo nuevas consultas SQL ni copias de datos en esta auditoría.
- **Pendiente:** cualquier aplicación a una base existente requiere autorización concreta, revisión del historial/checksums y respaldo verificado según docs/database/README y docs/architecture/despliegue §5. Esta auditoría no acredita backup/restauración ni autoriza migrar desarrollo. Revisión independiente y prueba humana actual siguen pendientes. Sin staging, commit, push, cambios de rama ni eliminación de trabajo ajeno.


## Integración local final y guía versionable — estado más reciente

- **T:** Preflight READ ONLY desarrollo: PG17.11/UTF8, 127.0.0.1:5433/CouchOneFit_dev, rol de preparación distinto del runtime. Los 27 checksums existentes son compatibles, sin archivos extra/divergencias. Solo faltan 202611090001 y 202611100001; no reaplicar 202611080001. Huellas locales de tablas privadas registradas; 2 clientes y 3 evaluaciones anteriores.
- **T:** Respaldo custom fuera del repo, permisos 0700/0600, 183873 bytes, dump con snapshot consistente exportado; TOC y lectura íntegra pg_restore comprobadas. **No se verificó restauración efectiva todavía:** autorización del destino temporal solicitada, sin presumir respuesta. Por esa condición NO se migró desarrollo ni se hicieron logins/altas QA. No se modificó test ni roles globales.
- **T:** Builds API/Web y lint Web aprobados; unitarias seguras API 21/21 y Web completa 94/94 repetidas. Health API y documento Web respondieron correctamente en 3000/5000; no equivale a login ni guardado ni revisión visual. La evidencia PG 39/39 anterior permanece, sin repetir escrituras de pruebas.
- **E:** Original externo HANDOFF leído completo (275 líneas), conservado con hash df9c0ab5e5265d142d7dbeff6e349d921be75586a4feb82e36247e6e3324d4e0. Nueva guía integral única dentro de [COUCHONEFIT_HU021_HANDOFF.md](COUCHONEFIT_HU021_HANDOFF.md), que actualiza su contenido útil sin convertir el modal/76 tests/bloqueo de RLS históricos en estado actual.
- El manifiesto añade esta guía: **55 candidatos** (28 modificados, 27 nuevos); no se prepararon en Git. .vite sigue ignorado y conservado. Solo documentación en esta etapa; no cambios de UI/API/SQL histórico, credenciales, roles o producción. D0 y publicación siguen pendientes de las puertas descritas.


## Integración local final completada — evidencia vigente

- **T:** Respaldo original restaurado con pg_restore en la única temporal nueva cof_hu021_restore_6dcaeb29a803, sin --clean/--create ni roles nuevos. Todas las huellas privadas, historia y catálogos coinciden. Una diferencia de paréntesis en CHECK se resolvió comparando normalización del planificador (sin alterar SQL/datos). Temporal eliminada tras identidad/verificación; backup conserva hash.
- **T:** Revalidado destino/historia/checksums y migrador separado, se aplicaron exactamente 202611090001 y 202611100001. Desarrollo tiene 29 migraciones, 14 restricciones de evaluación validadas, RLS y tres políticas. Huellas originales intactas y roles/membresías globales idénticos. No se reaplicó la inicial ni se tocó test/PG16/Supabase.
- **T:** Smoke HTTP/SQL QA **15 comprobaciones**: identidad sintética/propiedad verificadas; login, CSRF, rechazos, altas de tres métodos, opcionales, fecha, idempotencia, doble envío concurrente, historial y expediente, perfil intacto y logout. Solo 3 altas nuevas QA; los 2 clientes y 3 evaluaciones originales se conservaron, total final 6. No hay segunda cartera QA en desarrollo: caso HTTP ajeno allí no ejecutado; mantiene evidencia aislada anterior.
- **T:** En este encargo API unitarias **21/21**, Web completa **94/94**, builds API/Web, lint y Prettier de Web aprobados. OpenAPI JSON/102 referencias/25 operationId comprobados, no validación semántica completa. PG **39/39 histórico**, no reejecutado; suite API completa no ejecutada. Sin herramienta de navegador ni prueba visual/modo avión real.
- **E:** Ninguna corrección funcional de producto fue necesaria; solo auxiliares operativos fuera del repo y documentación. ls-remote confirmó main/rama remota iguales a HEAD; sin fetch ni cambios Git. Lista para revisión, no cierre formal ni publicación. Evidencia detallada en [HANDOFF](COUCHONEFIT_HU021_HANDOFF.md).


## Prepublicación final — revisión del contrato, inventario y propuesta NO ejecutada

> Esta auditoría conserva los hallazgos originales. La sección final «Corrección contractual autorizada» registra su resolución posterior y prevalece para el estado actual; no invalida la evidencia histórica.

**Estado vigente:** revisión visual manual aprobada por usuario 7/7. Lista para revisión independiente **con observaciones contractuales bloqueantes**; no lista para autorizar push sin resolverlas y confirmar gates de despliegue. No se modificó funcionalidad, OpenAPI, SQL, bases, roles, dependencias ni configuración en esta auditoría. Solo se actualizaron los cuatro documentos HU-021 autorizados.

### R — revisión manual reportada y aprobada por el usuario: 7/7

**Fuente:** mensaje de Pukzil de esta prepublicación. El usuario declara haber ejecutado personalmente y aprobado los siete puntos siguientes. **No es una prueba visual automática de Codex**, no se aportaron capturas ni fecha/hora exacta de ejecución y no se inventan. Esta aprobación no completa la revisión independiente D0.

1. Evaluación aparece dentro del expediente de Cliente QA EP04.
2. Se muestran las seis evaluaciones y sus fechas.
3. Detalles y recarga conservan el historial.
4. El formulario cambia entre Perímetros, Pliegues y Bioimpedancia.
5. Opcionales, errores y botones funcionan correctamente.
6. Diseño correcto en computadora y vista móvil.
7. Borradores, cancelación y recuperación offline funcionan según lo documentado.

### Matriz de trazabilidad de aceptación y alcance

| Criterio / alcance | Implementación | Prueba o evidencia existente | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Original: cliente/profesional correctos y fecha de servidor | API repository/evaluation.ts, contexto confiable, defaults SQL 202611080001 | HTTP/SQL aislamiento 39/39 histórico; smoke real 15/15; R 7/7 | Cumplida en cobertura indicada | effectiveDate retroactiva es distinta de createdAt/evaluationDate; identidad nunca viene del body |
| Original: opcionales sin valores inventados | validators/evaluation.ts y assessment.ts; NULL/omisión; DTO y formulario | API 21/21, HTTP 15/15 y aprobación manual de opcionales | Cumplida funcionalmente | OpenAPI OAS-02 necesita corrección documental; no cambiar comportamiento correcto |
| Original: inválidos rechazados | Validadores + CHECK de columnas/snapshot, 202611100001 | Unitarias fronteras/precisión; SQL runtime y smoke; R errores aprobados | Cumplida funcionalmente | Contrato sobre entradas vacías no refleja toda validación (OAS-01/03/04) |
| Original: alta conserva anteriores | INSERT independiente; sin UPDATE/DELETE, FK RESTRICT | Huellas de 2 clientes/3 evaluaciones intactas; 3 nuevas; edición/inactivación/reactivación en 39/39 | Cumplida | Total confirmado 6; revisión humana recarga/detalle aprobada |
| Original: profesional ajeno no registra/consulta | requireProfessional, propiedad, training_professional, RLS | Dos carteras en 39/39 histórico; rol runtime restringido | Cumplida en entorno aislado | Sin segunda cartera QA para repetir HTTP ajeno en desarrollo; no se inventó |
| Tareas API1/WEB1: alta/listado/expediente real | app.ts, record service/types, EvaluationsPage y formulario | Smoke real y Web 94/94; usuario aprueba pestaña/historial/métodos | Cumplida funcionalmente | Revisión independiente D0 pendiente; OpenAPI debe alinearse |
| D0 PWA: offline/idempotencia | submitWrite, outbox/sync/caché; ID estable, 20 s, estados | Web 94/94, replay/doble envío real y R offline aprobado | Cumplida en cobertura indicada | Pendiente no es confirmación; no borrar cola ni inventar fecha local autoritativa |
| Adicional autorizado: tres métodos y aritmética disponible | DTO discriminado, domain/assessment y preview/results | API 21/21; tres métodos en smoke; usuario 7/7 | Cumplida en cobertura indicada | No es normalidad clínica ni diagnóstico |
| Futuro: Navy/JP3/Siri, evolución HU-022 y HU-023 | Gates documentales y funciones deshabilitadas | Inspección; casos prueban ausencia de cálculo no verificado | Fuera del cierre original | No convertirlos en obligación para cerrar registro HU-021 |
| DoD: contrato consistente y revisión independiente | OpenAPI + proceso de revisión | Hallazgos actuales; sin aprobación independiente aportada | Bloqueante / Pendiente | La revisión visual R no sustituye D0.8 ni corrige D0.9 |

### T/E — validación semántica OpenAPI realmente realizada

Se encontró **Ajv 8.20.0** ya instalado transitivamente en apps/web/node_modules, con soporte draft 2020-12. No se instaló ni actualizó nada. Se consultó en memoria el [esquema oficial OpenAPI 3.1](https://spec.openapis.org/oas/3.1/schema/2025-09-15); el documento declara **3.1.0**. Ajv con ese esquema dio errores también para un control mínimo conocido válido que contiene `schema: {type: string}` (control sin Schema Object sí pasó). Por tanto, esa salida no demuestra invalidez general del contrato: hay limitación de la combinación/montaje con referencias dinámicas. No se sustituyó el esquema oficial ni se cambiaron reglas para declararlo aprobado.

Las comprobaciones adicionales, locales y sin BD, fueron:

- **26 componentes Schema Object** metavalidados con draft 2020-12, `strict:false`, sin assertion de formatos; referencias reubicadas solo en memoria a `$defs` para los contrastes de ejemplos. No se modificó OpenAPI.
- **25 operaciones** revisadas: coherencia de todos los placeholders de ruta con parámetros `in:path`, `required:true`, ausencia de parámetros de ruta sobrantes, nombres de seguridad definidos, códigos de respuesta con forma válida y descriptions presentes. Cero errores en esos chequeos.
- **102 referencias locales** resueltas y **25 operationId** únicos, verificados anteriormente y conservados; no confundirlo con aprobación semántica completa.
- Sesión por cookie o Bearer y CSRF del POST coinciden con routes/evaluations.ts. Origin/token/cookie CSRF se contrastaron con el middleware; el contrato no modela toda su lógica contextual.
- GET/POST, DTO, limits/unidades y estados EvaluationSection se contrastaron con servicios, validators y Web. Los tres ejemplos de respuesta/guard Web coinciden: legado válido acepta/acepta; snapshot válido acepta/acepta; respuesta incompleta rechaza/rechaza.
- **Siete contrastes de entrada** con Ajv y los validadores reales, sin persistencia: tres coinciden y cuatro exponen las discrepancias de abajo. No son nuevas pruebas HTTP ni una suite de producto repetida.

**No validado completamente:** conformidad integral del documento con el esquema oficial, assertions RFC de formatos (no hay ajv-formats instalado), todas las reglas dependientes de BD/fecha actual/masa y regresión exhaustiva de contratos de otras épicas. No declarar «OpenAPI semánticamente aprobado».

| Hallazgo | Contrato actual | API real | Estado / acción |
| --- | --- | --- | --- |
| OAS-01: cuerpo heredado vacío `{}` | Lo acepta LegacyEvaluationInput (sin condición de no vacío) | Lo rechaza INVALID_EVALUATION | **Bloqueante para entrega contractual:** ajustar esquema con autorización, conservando API |
| OAS-02: legado con `weightKg:null, waistCm:80` | Rechaza null en LegacyEvaluationInput | Acepta y conserva ausencia | **Bloqueante:** documentar null compatible y exigir alguna medida no nula |
| OAS-03: método con measurements vacío | Esquema lo acepta; solo description menciona regla | API lo rechaza | **Bloqueante:** expresar al menos una medición propia no nula |
| OAS-04: método con solo weightKg | Esquema lo acepta | API lo rechaza por faltar medida propia del método | **Bloqueante:** misma corrección de OAS-03, sin inventar obligatoriedad clínica |
| OAS-05: respuestas GET | Solo 200/401/403/404 | Offset inválido da 400; fallo inesperado puede dar 503 | Pendiente de completar respuestas documentadas |
| OAS-06: snapshot y errores por campo | ownerId/birthDate/ageYears/equation/provenance no están explícitamente tipados en AssessmentSnapshot; Error.fields dice solo INVALID_INPUT | API devuelve esos metadatos y también fields con INVALID_EVALUATION | Pendiente de precisar documentación; objetos actuales no se vuelven inválidos por los extras permitidos |

Ubicaciones: docs/api/identity-lifecycle.openapi.json (EvaluationInput, LegacyEvaluationInput, AssessmentSnapshot, Error y GET evaluaciones); apps/api/src/features/evaluations/validators/evaluation.ts, validators/assessment.ts, services/evaluation.ts y controllers/evaluation.ts; apps/web/src/features/evaluations/types/evaluation.ts y professional/services/record.ts. No se modificó ese contrato ni funcionalidad: se necesita autorización para preparar su corrección mínima y las verificaciones correspondientes. No se atribuyen estos hallazgos a otras épicas ni se editan sus reglas.

### Inventario actual y clasificación por archivo

Inventario obtenido de Git, sin staging: **55 candidatos = 28 modificados + 27 nuevos**. Coincide con el inventario anterior. Rutas exactas relativas a la raíz del checkout CouchOneFit; no se publican rutas absolutas del equipo. M=modificado/N=nuevo. Todas se incluyen en el plan futuro, condicionado a resolver observaciones; ninguna se añade ahora. Relación: código propio EP-04 o integración/contrato/prueba/documentación necesaria de HU-021, según la función individual. No se detectó trabajo ajeno que deba descartarse.

| Ruta exacta | Estado | Clasificación | Propósito y relación HU-021 | Incluir | Coordinación | Riesgo/dependencia |
| --- | --- | --- | --- | --- | --- | --- |
| `.gitignore` | M | Configuración | Ignora únicamente la caché raíz /.vite/ | Sí, tras gates | Sí: configuración compartida | Excluir caché; no borrar archivos |
| `apps/api/src/app.ts` | M | Integración compartida | Importa y monta evaluationRoutes | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/api/src/features/evaluations/controllers/evaluation.ts` | N | Código funcional API | Adapta params/body/query a servicio y respuestas HTTP | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/domain/assessment.ts` | N | Código funcional API | Funciones puras versionadas de edad e ICC/ICE/composición disponible | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/repositories/evaluation.ts` | N | Código funcional API | SQL parametrizado, contexto/propiedad, snapshot, INSERT y páginas | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/routes/evaluations.ts` | N | Código funcional API | Declara GET/POST, autenticación, CSRF e idempotencia | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/services/evaluation.ts` | N | Código funcional API | Invoca validadores, selecciona DTO y coordina alta/listado | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/types/evaluation.ts` | N | Código funcional API | Define campos y DTO Evaluation | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/validators/assessment.ts` | N | Código funcional API | Valida campos y estructura discriminada por método | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/evaluations/validators/evaluation.ts` | N | Código funcional API | Valida UUID y DTO heredado con límites/null/precisión | Sí, tras gates | No transversal; revisión EP-04 | DTO/validación/persistencia propios |
| `apps/api/src/features/professional/services/record.ts` | M | Integración compartida | Compone lector real de evaluaciones y sus errores | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/api/src/features/professional/types/record.ts` | M | Integración compartida | Tipa empty/available/error con evaluaciones | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/api/tests/assessment.test.ts` | N | Pruebas | Verifica aritmética, límites, fechas, null y mezcla de métodos | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/api/tests/client-read-isolation.test.ts` | M | Pruebas | Integra HTTP/BD y prueba runtime restringido con dos carteras | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/api/tests/evaluations.test.ts` | N | Pruebas | Prueba DTO legado, fronteras, vacío y precisión | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/api/tests/migrations.test.ts` | M | Pruebas | Compara instalación limpia, snapshot y actualización con historia | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/web/src/features/evaluations/components/AnatomicalGuide.tsx` | N | Código funcional Web | SVG orientativo interactivo y alternativa textual | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/components/AssessmentForm.tsx` | N | Código funcional Web | Captura amplia, métodos, borradores y estados de guardado | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/components/CompositionResults.tsx` | N | Código funcional Web | Muestra resultados disponibles y dona sin diagnósticos inventados | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/components/EvaluationSummary.tsx` | N | Código funcional Web | Dato informativo compacto de última evaluación | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/components/EvaluationsSection.tsx` | N | Código funcional Web | Historial confirmado, detalle y operaciones locales separadas | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/pages/EvaluationsPage.tsx` | N | Código funcional Web | Área contextual del expediente y captura; redirección de enlaces heredados | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/services/evaluations.ts` | N | Código funcional Web | Alta real por sesión con deadline e idempotencia común | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/types/assessment.ts` | N | Código funcional Web | Tipos discriminados y aritmética preliminar Web | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/evaluations/types/evaluation.ts` | N | Código funcional Web | DTO/guard de respuestas y estados del lector | Sí, tras gates | No transversal; revisión EP-04 | Consumidores del expediente y offline |
| `apps/web/src/features/professional/components/ClientHeader.tsx` | M | Integración compartida | Añade tercera pestaña Evaluación | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/features/professional/components/ClientRecordSections.tsx` | M | Integración compartida | Conserva solo indicador informativo de última evaluación | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/features/professional/components/ClientRecordView.tsx` | M | Integración compartida | Integra tipos/props y separa pendientes de edición base | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/features/professional/pages/ProfessionalPage.tsx` | M | Integración compartida | Resuelve rutas contextualizadas y alias antiguos; sin menú global | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/features/professional/services/record.ts` | M | Integración compartida | Valida sección real y asociación del DTO con cliente | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/features/professional/types/record.ts` | M | Integración compartida | Incluye EvaluationSection en ProfessionalRecord | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/services/offline/connection.ts` | M | Integración compartida | Excluye migración pendiente de fallos transitorios | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/services/offline/outbox.ts` | M | Integración compartida | Añade tipo evaluation.create | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/services/offline/readCache.ts` | M | Integración compartida | Admite páginas autorizadas de evaluaciones | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/services/offline/sync.ts` | M | Integración compartida | Trata migración pendiente y espera acotada solo en evaluaciones | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/src/services/offline/writes.ts` | M | Integración compartida | Acepta ID estable y deadline opcionales | Sí, tras gates | Sí: auth/expediente/offline, según ruta | Compatibilidad y coordinación de archivos comunes |
| `apps/web/tests/offline-read.test.mjs` | M | Pruebas | Prueba elegibilidad de caché de páginas históricas | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/web/tests/offline-write.test.mjs` | M | Pruebas | Prueba bloqueo de migración y timeout con replay | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `apps/web/tests/session-recovery.test.mjs` | M | Pruebas | Prueba flujo de expediente, UI, navegación, sesiones y offline | Sí, tras gates | Sí para aislamiento/migraciones/sesión compartidos; resto EP-04 | Fixtures/regresiones; no ejecutar fuera de aislamiento autorizado |
| `docs/api/identity-lifecycle.openapi.json` | M | Contrato OpenAPI | Describe endpoints y DTO legado/multimétodo | Sí, tras gates | Sí: Franela/consumidores API-Web | Bloqueante: discrepancias documentadas por corregir previa autorización |
| `docs/architecture/domain-glossary.md` | M | Documentación | Define snapshot, métodos y fechas | Sí, tras gates | Sí: modelo/contratos compartidos | Distinguir aplicación local e historial remoto |
| `docs/database/README.md` | M | Documentación | Documenta migración incremental y evidencia SQL | Sí, tras gates | Sí: modelo/contratos compartidos | Distinguir aplicación local e historial remoto |
| `docs/database/migrations/202611080001_client_evaluations.sql` | N | Migración SQL | Crea tabla fechada, límites, grants mínimos y RLS | Sí, tras gates | Sí: Franela/custodio y revisión RLS Omar | Orden/checksums; remoto solo con autorización y backup |
| `docs/database/migrations/202611090001_multimethod_evaluations.sql` | N | Migración SQL | Añade snapshot nullable y restricción de propietario | Sí, tras gates | Sí: Franela/custodio y revisión RLS Omar | Orden/checksums; remoto solo con autorización y backup |
| `docs/database/migrations/202611100001_evaluation_measurement_integrity.sql` | N | Migración SQL | Endurece invariantes de mediciones JSONB | Sí, tras gates | Sí: Franela/custodio y revisión RLS Omar | Orden/checksums; remoto solo con autorización y backup |
| `docs/database/schemas/identity_access.sql` | M | Esquema integrado | Mantiene instantánea del esquema completo | Sí, tras gates | Sí: Franela/custodio | No ejecutar instantánea sobre base existente |
| `docs/epicas/ep-03-cartera-y-expediente/estado-e-integracion.md` | M | Documentación | Actualiza referencia a EvaluationSection real | Sí, tras gates | Sí: Franela, referencia a su integración | Solo notas HU-021; preservar evidencia de EP-03 |
| `docs/epicas/ep-03-cartera-y-expediente/hu-019/README.md` | M | Documentación | Añade nota fechada y enlace a HU-021 | Sí, tras gates | Sí: Franela, referencia a su integración | Solo notas HU-021; preservar evidencia de EP-03 |
| `docs/epicas/ep-03-cartera-y-expediente/seguimiento-auditoria.md` | M | Documentación | Actualiza descripción del caso vertical al lector real | Sí, tras gates | Sí: Franela, referencia a su integración | Solo notas HU-021; preservar evidencia de EP-03 |
| `docs/epicas/ep-04-antropometria/hu-021/COUCHONEFIT_HU021_HANDOFF.md` | N | Documentación | Guía integral actualizada de transferencia | Sí, tras gates | Revisión EP-04/anglfer | Evidencia y estado reales; sin secretos ni aprobaciones supuestas |
| `docs/epicas/ep-04-antropometria/hu-021/README.md` | N | Documentación | Entrada de la HU y alcance original histórico | Sí, tras gates | Revisión EP-04/anglfer | Evidencia y estado reales; sin secretos ni aprobaciones supuestas |
| `docs/epicas/ep-04-antropometria/hu-021/multimethod.md` | N | Documentación | Contrato vigente de ampliación y gates | Sí, tras gates | Revisión EP-04/anglfer | Evidencia y estado reales; sin secretos ni aprobaciones supuestas |
| `docs/epicas/ep-04-antropometria/hu-021/revision-final.md` | N | Documentación | Auditoría y manifiesto candidato | Sí, tras gates | Revisión EP-04/anglfer | Evidencia y estado reales; sin secretos ni aprobaciones supuestas |
| `docs/epicas/ep-04-antropometria/hu-021/validacion-local.md` | N | Documentación | Evidencia T/R/E cronológica | Sí, tras gates | Revisión EP-04/anglfer | Evidencia y estado reales; sin secretos ni aprobaciones supuestas |
| `plan/PLAN_TRABAJO_V2.md` | M | Documentación | Registra ampliación autorizada y tercera pestaña | Sí, tras gates | Sí: responsables del plan/supervisor | Solo nota de alcance y navegación de HU-021 |

### Seguridad y privacidad

Se revisaron los candidatos por patrones de claves privadas/JWT/URLs con credenciales y se compararon con secretos locales sin imprimirlos. Ningún dump, .env, respaldo, archivo QA local, base, log, compilado, dependencia o caché forma parte del inventario. .vite sigue ignorada y conservada. Las fixtures sintéticas dentro de tests no son credenciales reales. El escaneo no garantiza ausencia absoluta de secretos ni sustituye revisión independiente.

Se detectó en HANDOFF una ruta absoluta del directorio personal al respaldo. Se reemplazó por `<directorio_privado_de_respaldos>/CouchOneFit_dev.before-hu021.dump`; la localización exacta sigue en el registro privado externo y no se mueve ni modifica el backup. No se eliminaron archivos. Original HANDOFF externo intacto. No se maquillan ni borran evidencias históricas: las secciones finales indican el estado vigente.

### Propuesta exacta de commits — sin staging ni ejecución

**Commit 1:** `fix(repo): ignore generated vite cache`

Archivo único:

```text
.gitignore
```

Justificación: exclusión independiente de artefactos, sin eliminar la caché ni tocar Vite. Coordinar configuración compartida. No depende del commit 2; no desplegar por él sin comprobar las integraciones remotas.

**Commit 2:** `feat(ep04): integrate dated client evaluations`

Lista completa de 54 archivos:

```text
apps/api/src/app.ts
apps/api/src/features/evaluations/controllers/evaluation.ts
apps/api/src/features/evaluations/domain/assessment.ts
apps/api/src/features/evaluations/repositories/evaluation.ts
apps/api/src/features/evaluations/routes/evaluations.ts
apps/api/src/features/evaluations/services/evaluation.ts
apps/api/src/features/evaluations/types/evaluation.ts
apps/api/src/features/evaluations/validators/assessment.ts
apps/api/src/features/evaluations/validators/evaluation.ts
apps/api/src/features/professional/services/record.ts
apps/api/src/features/professional/types/record.ts
apps/api/tests/assessment.test.ts
apps/api/tests/client-read-isolation.test.ts
apps/api/tests/evaluations.test.ts
apps/api/tests/migrations.test.ts
apps/web/src/features/evaluations/components/AnatomicalGuide.tsx
apps/web/src/features/evaluations/components/AssessmentForm.tsx
apps/web/src/features/evaluations/components/CompositionResults.tsx
apps/web/src/features/evaluations/components/EvaluationSummary.tsx
apps/web/src/features/evaluations/components/EvaluationsSection.tsx
apps/web/src/features/evaluations/pages/EvaluationsPage.tsx
apps/web/src/features/evaluations/services/evaluations.ts
apps/web/src/features/evaluations/types/assessment.ts
apps/web/src/features/evaluations/types/evaluation.ts
apps/web/src/features/professional/components/ClientHeader.tsx
apps/web/src/features/professional/components/ClientRecordSections.tsx
apps/web/src/features/professional/components/ClientRecordView.tsx
apps/web/src/features/professional/pages/ProfessionalPage.tsx
apps/web/src/features/professional/services/record.ts
apps/web/src/features/professional/types/record.ts
apps/web/src/services/offline/connection.ts
apps/web/src/services/offline/outbox.ts
apps/web/src/services/offline/readCache.ts
apps/web/src/services/offline/sync.ts
apps/web/src/services/offline/writes.ts
apps/web/tests/offline-read.test.mjs
apps/web/tests/offline-write.test.mjs
apps/web/tests/session-recovery.test.mjs
docs/api/identity-lifecycle.openapi.json
docs/architecture/domain-glossary.md
docs/database/README.md
docs/database/migrations/202611080001_client_evaluations.sql
docs/database/migrations/202611090001_multimethod_evaluations.sql
docs/database/migrations/202611100001_evaluation_measurement_integrity.sql
docs/database/schemas/identity_access.sql
docs/epicas/ep-03-cartera-y-expediente/estado-e-integracion.md
docs/epicas/ep-03-cartera-y-expediente/hu-019/README.md
docs/epicas/ep-03-cartera-y-expediente/seguimiento-auditoria.md
docs/epicas/ep-04-antropometria/hu-021/COUCHONEFIT_HU021_HANDOFF.md
docs/epicas/ep-04-antropometria/hu-021/README.md
docs/epicas/ep-04-antropometria/hu-021/multimethod.md
docs/epicas/ep-04-antropometria/hu-021/revision-final.md
docs/epicas/ep-04-antropometria/hu-021/validacion-local.md
plan/PLAN_TRABAJO_V2.md
```

Justificación: incremento vertical coherente con SQL, API/Web, tipos, contrato, pruebas y documentación juntos (DEVELOPMENT §7/AGENTS §2). Orden propuesto después del commit 1. El código no depende lógicamente de la exclusión de caché, pero mantener ese orden evita incluirla accidentalmente. No separar consumidores o migraciones del contrato dejando commits incompatibles. Este commit está **pendiente de corregir OpenAPI con autorización** y de verificar los gates. No se crean commits separados de pruebas/docs para aparentar piezas independientes. Cada candidato aparece exactamente una vez entre los dos commits: comprobación programática de cobertura/unicidad aprobada (1+54=55).

### Borrador de Pull Request — NO creado

**Título:** `feat(ep04): integrate dated client evaluations`

**Base:** main. **Rama:** feature/ep04-antropometria. **Épica/HU:** EP-04 / HU-021. **Responsable:** Pukzil. **Revisor requerido:** anglfer.

> Borrador para revisión. No declara cierre D0 ni aplicación en Supabase; contrato y gates pendientes se mantienen visibles.

#### Problema y comportamiento resultante

HU-021 permite registrar y consultar evaluaciones fechadas reales dentro de Clientes → Expediente → Resumen | Entrenamiento | Evaluación. Conserva el perfil base y todo el historial anterior. Una única captura amplia ofrece Perímetros, Pliegues y Bioimpedancia, sin selector de cliente duplicado ni módulo global independiente.

#### Cambios

- BD: tres migraciones incrementales, esquema integrado, fechas de servidor, snapshot multimétodo compatible con filas heredadas, límites/precisión/coherencia, RLS y permisos mínimos; sin UPDATE/DELETE runtime.
- API: POST/GET /api/clients/{clientId}/evaluations e integración GET del expediente; identidad derivada de sesión, cartera autorizada, CSRF, SQL parametrizado y transacciones. Preserva DTO antiguo y datos opcionales null/omitidos.
- Web: tercera pestaña, formulario por método, guías SVG orientativas, resultados disponibles, historial/detalle/páginas, validación por campo, borradores y estados claros. Reutiliza componentes y servicios existentes; conserva Resumen y Entrenamiento.
- Offline: caché/outbox cifradas por cuenta, misma clave idempotente en reintentos, protección de doble envío y deadline de confirmación; migración pendiente no se disfraza de éxito ni conectividad.
- Cálculos: ICC/ICE y aritmética de datos informados por dispositivo. Navy y Jackson-Pollock/Siri continúan deshabilitados; no se incluyen HU-022/HU-023 ni Flutter.
- Documentación: HU, HANDOFF versionable, evidencia T/R/E, glosario, contrato y notas mínimas EP-03. .vite ignorada sin borrar archivos.

#### Evidencia técnica existente (no repetida en esta prepublicación)

| Conjunto | Resultado |
| --- | --- |
| API unitarias | 21/21 |
| Web completa | 94/94 |
| PostgreSQL aislado, ejecución anterior | 39/39 |
| Smoke HTTP/SQL real QA | 15/15 |
| Builds API/Web, lint Web y Prettier | Aprobados en integración anterior |
| Revisión manual reportada por usuario | 7/7 aprobada, sin fecha exacta/capturas aportadas; no automática |

Recuperación real del respaldo en una única temporal y limpieza verificadas. Desarrollo local PG17.11/127.0.0.1:5433 tiene 29 migraciones. Los 2 clientes y 3 evaluaciones previas mantienen huellas; se añadieron 3 QA, total 6. Roles compartidos/runtime sin elevación. Idempotencia/replay/doble envío y conservación histórica comprobados.

#### Migraciones y despliegue

Publica 202611080001, 202611090001 y 202611100001 junto al esquema integrado. En desarrollo solo se aplicaron las dos últimas porque la inicial ya estaba registrada. **No se aplicó ninguna en Supabase**. El coordinador/custodio debe revisar el historial remoto, verificar respaldo/restore, aplicar pendientes con credencial separada y coordinar API/Web compatibles. No ejecutar la instantánea sobre bases existentes.

#### Pendientes y riesgos de revisión

- Corregir con autorización las discrepancias OpenAPI OAS-01–06 de esta auditoría y completar validación semántica confiable. Este borrador no declara contrato aprobado.
- Revisión independiente D0 por otro integrante, con anglfer como revisor del PR; aprobación visual no sustituye revisión de código.
- Confirmar excepción de nombre de rama y coordinación de archivos compartidos.
- Verificar rama conectada, comandos y modo de auto-deploy de Render antes del push; preview de Vercel puede usar API productiva. No se revisaron paneles ni se desplegó.
- No se ejecutó suite API completa ni se repitió HTTP ajeno en desarrollo por falta de segunda cartera QA; la cobertura de dos carteras es aislada e histórica. Persisten cinco diagnósticos de typecheck adicional de tests preexistentes; build oficial aprobado.
- No se incluyen secretos, .env, backups, datos locales, logs, compilados ni caché.

**Estado solicitado:** revisión independiente con observaciones explícitas; no merge/despliegue ni publicación autorizados por este borrador.


### Condiciones finales de autorización

| Condición | Estado | Acción |
| --- | --- | --- |
| Código integrado, persistencia local y conservación | Cumplida en evidencia técnica previa | Conservar resultados y datos; no repetir implementación |
| Revisión visual funcional | Cumplida: R 7/7 | Registrar como reporte humano, no automatización ni D0 independiente |
| Inventario/secretos/caché/diff | Cumplida en auditoría actual, con límites del escaneo | Volver a revisar si cambian archivos |
| Coherencia OpenAPI con API | Bloqueante | Autorizar y realizar corrección documental mínima OAS-01–06; comprobar esquemas y casos |
| Validación oficial integral OpenAPI | Pendiente | Usar montaje/herramienta compatible sin falso aprobado; formatos no verificados automáticamente |
| Revisión independiente D0 | Pendiente; bloqueante antes de merge | anglfer/revisor independiente, resolver observaciones |
| Nombre feature/ep04-antropometria | Requiere confirmación del supervisor | No renombrar; no coincide literalmente con <tipo>/<aplicación>-... |
| Aviso/coordinar archivos compartidos | Requiere confirmación del supervisor/equipo | Pukzil coordina; agente no envía mensajes |
| Render/Vercel antes del push | Requiere confirmación del supervisor; bloqueante para asegurar seguridad | Rama conectada, build/start/pre-deploy, credenciales y previews |
| Merge a main | Bloqueante hasta aprobación/checks/coordinación de despliegue | No interpretar revisión como autorización de integrar |
| Migraciones compartidas | Requiere confirmación y autorización del supervisor/custodio | Historial remoto, backup/restore y corte controlado; nunca por haber migrado local |
| Permiso de staging/commit/push/PR | Bloqueante: no otorgado | Esperar autorización expresa; no ejecutar comandos de escritura Git |

No hay .github/workflows en el checkout, ni render.yaml ni migración automática en build/start versionados. Esto descarta un pipeline de migraciones **versionado**, no una automatización externa. Render auto-deploy está documentado con rama/mode no confirmados (despliegue.md:14–20); vercel.json reescribe /api hacia Render productivo. Antes de push confirmar que no promueve feature ni ejecuta SQL; antes de merge required checks/revisión y corte compatible; antes de migración compartida custodio/backup/permisos/pendientes. No se accedió a paneles ni se hizo despliegue.

CONTRIBUTING exige aviso shared, Conventional Commits y sincronización con origin/main antes del push. AGENTS prohíbe staging global; el ejemplo genérico git add . no autoriza hacerlo. Revisor PR: anglfer; D0.8 exige otro integrante. La excepción de rama de EP-03 no se extrapola automáticamente a EP-04. No se renombró ni sincronizó la rama. No se repitieron suites de producto ni se abrió conexión SQL en esta auditoría.


## Corrección contractual autorizada — evidencia vigente

**Alcance:** modificación exclusiva de `docs/api/identity-lifecycle.openapi.json` y evidencia en este documento, `validacion-local.md` y `COUCHONEFIT_HU021_HANDOFF.md`. Sin cambios funcionales API/Web, SQL, roles, dependencias ni bases. Inventario conservado: **55 candidatos (28 modificados y 27 nuevos)**. Revisión visual **R 7/7 reportada y aprobada por usuario**, no automática, conservada; no sustituye revisión independiente D0.

### Resolución de hallazgos

| Hallazgo original | Corrección contractual | Resultado actual |
| --- | --- | --- |
| OAS-01: legado vacío aceptado | `LegacyEvaluationInput.anyOf` exige presencia de alguna propiedad numérica no nula | `{}` y todas-null rechazados; una medición válida aceptada |
| OAS-02: null rechazado junto a una medida válida | Cada propiedad heredada admite `number` o `null`, con rangos/precisión conservados | `weightKg:null, waistCm:80` aceptado como API; null no satisface la condición de evaluación no vacía |
| OAS-03/04: método vacío o solo peso/altura | Cada objeto `measurements` exige al menos una medición propia no nula mediante `anyOf` + `required` + tipo numérico | Vacío, todas-null y solo datos generales rechazados para los tres métodos |
| OAS-05: errores GET incompletos | Documentados 400 y 503; offset limitado a entero seguro; POST precisa errores 400/403/503 y añade 413 | Estados y cuerpos contrastados con controller/service, middleware y manejador global |
| OAS-06: metadatos/fields incompletos | Snapshot requiere/tipa ownerId, birthDate, ageYears, equation y provenance; documenta segmental; Error.fields incluye INVALID_EVALUATION | Cinco respuestas válidas aceptadas por esquema y guard Web; cinco omisiones de metadatos requeridos rechazadas por esquema |

Se documentó también `segmental:null` como ausencia conforme al validador (incluido fuera de bioimpedancia), segmentos homogéneos en kg, CSRF real tanto en sesión cookie como Bearer (Origin permitido + header igual a cookie), replay 201 y Retry-After del 409. Los resultados y el propietario nunca se aceptan como autoridad del cliente. No se ampliaron entradas de API.

### T — comprobaciones ejecutadas sin BD

- Ajv **8.20.0** existente; sin instalaciones. **105 contrastes de solicitudes: 36 válidas y 69 inválidas**, todos coincidentes entre JSON Schema y funciones reales `evaluationMeasurements`/`assessmentInput`. Incluyen los cuatro casos originales, fronteras DEC-006, null, precisión, tipos incorrectos, propiedades desconocidas, fechas calendario inválidas, tres métodos y segmentos.
- **4 casos negativos adicionales exclusivos del servidor:** fecha futura, masa muscular mayor al peso, agua mayor al peso y segmento mayor al peso. El esquema permite la estructura; la API rechaza el negocio, conforme a descriptions explícitas. No se informa esto como incoherencia del esquema ni como validación suficiente del cliente.
- **5 respuestas válidas** (legado, tres métodos y snapshot con nacimiento/edad null) compatibles con `Evaluation` y `isEvaluation` Web; **5 omisiones de metadatos** rechazadas por esquema; **1 cuerpo Error.fields** aceptado.
- **26 componentes** metavalidados con draft 2020-12 y vocabulario OAS; **105 referencias locales** resueltas, **25 operationId únicos** y coherencia de parámetros de ruta/seguridad. El incremento de referencias desde 102 se debe a respuestas de error añadidas, no a operaciones nuevas.
- Conexión `ProfessionalRecord.sections.evaluations` a EvaluationSection comprobada. No se modificaron consumidores. Comparación profunda contra el contrato anterior: ningún subárbol ajeno a los cuatro componentes y la ruta GET/POST de evaluaciones cambió; formato JSON normalizado con Prettier.
- **Unitarias puras API: 11/11**, cero fallos, mediante `node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts`. No importan app/config/pool ni escriben en bases. Son dos archivos específicos; no confundir con el resultado histórico 21/21 de otro conjunto.
- Prettier del JSON y `git diff --check` comprobados al finalizar. Suites Web/HTTP/PostgreSQL/migraciones y builds no repetidos por tratarse de corrección documental de contrato.

### Validador estructural: alternativa y límites

Se descargaron los esquemas públicos oficiales en un archivo temporal fuera del repositorio. El montaje oficial `schema-base` + dialecto completo con Ajv siguió rechazando un control mínimo válido por `unevaluatedProperties` dentro de Schema Object. No se acepta ese resultado como prueba de invalidez ni se lo declara aprobado.

Como alternativa se compiló **solo en memoria** el esquema estructural oficial sustituyendo su enlace dinámico `$dynamicRef:#meta` por el enlace explícito al metaschema JSON Schema 2020-12. Después se comprobó el vocabulario OAS de los componentes por separado. Esta separación evita la resolución dinámica problemática: **control válido aprobado y dos controles negativos rechazados** (tipo JSON Schema inexistente y respuesta sin description); contrato estructural aprobado. No se cambió el archivo de OpenAPI para sortear validaciones, ni se deshabilitó `unevaluatedProperties`.

**Límite explícito:** esto acredita validación estructural adaptada, metavalidación de los esquemas y contraste semántico de HU-021; **no una aprobación del esquema oficial sin adaptar ni una certificación exhaustiva OpenAPI/RFC**. La comprobación estructural usa formatos como anotación; los casos de instancias registran comprobadores locales de date/date-time/uuid, sin afirmar conformidad RFC exhaustiva ni instalar ajv-formats. `multipleOf:0.1` expresa precisión decimal matemática; el servidor sigue aplicando finitud y `Number.isInteger(n*10)` sobre números JavaScript. Las comparaciones con hoy/nacimiento, relaciones entre masas, identidad, propiedad, RLS, idempotencia y disponibilidad de migración siguen siendo validación autoritativa del servidor.

El script diagnóstico temporal puede repetirse durante esta sesión con `node --import ./apps/api/node_modules/tsx/dist/loader.mjs /private/tmp/cof-hu021-contract-check.mjs`; requiere las copias temporales de esquemas públicos y no es un archivo de entrega ni una dependencia nueva. Los casos/resultados se conservan aquí aunque esos temporales desaparezcan.

### Estado para entrega

Las discrepancias contractuales concretas **OAS-01–06 están corregidas y comprobadas en la cobertura indicada**; no se detectaron diferencias en los 105 contrastes. Se retira ese bloqueo específico del plan anterior. No se declara cerrada la HU ni completado D0: faltan revisión independiente, coordinación de archivos compartidos, aceptación del nombre de rama, comprobaciones remotas de despliegue y autorización de publicación. La validación oficial sin adaptación sigue pendiente de una herramienta/montaje compatible; debe revisarse su exigencia antes de dar aprobación contractual integral.

El plan de commits mantiene los mismos 55 archivos una sola vez (1 + 54), sin staging ni ejecución; el borrador PR debe citar esta corrección posterior en lugar de presentar OAS-01–06 como pendientes. No se consultaron ni modificaron bases de datos ni paneles remotos. No hubo publicaciones ni cambios de rama.


## Plan definitivo pendiente de autorización de commits

Se conserva la lista exacta anterior **1+54=55**, comprobada contra el inventario actual. Commit 1: `fix(repo): ignore generated vite cache` solo .gitignore; commit 2: `feat(ep04): integrate dated client evaluations` integra juntos SQL/API/Web/contrato/tests/docs. Esta agrupación evita estados intermedios con consumidores incompatibles. Staging futuro por rutas explícitas, no global. No se ha ejecutado staging ni commit.

Última evidencia en [validacion-local.md](validacion-local.md#t--última-comprobación-previa-a-commits-sin-publicación): API unitarias 11/11, Web 94/94 (repetida por bloqueo de socket sandbox, también aprobada con avisos del arnés), builds API/Web, lint, Prettier 24 archivos y diff aprobados; contrato 105 contrastes. Validación oficial sin adaptar sigue inconclusa; la alternativa y sus límites permiten proponer la rama para revisión, no afirmar aceptación formal o merge.

Fetch origin completado por autorización del usuario: HEAD y ambas referencias remotas coinciden en 33110ea7e6706842fb7ee7ad9aee76834fa1138e. No integración necesaria a ese instante; volver a comprobar antes de push. Migraciones, RLS y datos se inspeccionaron por código/evidencia histórica, sin SQL nuevo. D0 independiente, aviso de archivos compartidos, excepción del nombre de rama y configuración Render/Vercel requieren confirmación según corresponda. **Autorización de commits y segunda autorización de push son pasos separados.** No hubo publicaciones ni cambios de rama.
