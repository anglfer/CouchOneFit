# HU-021 — Verificación al retomar el trabajo

## Evidencia ejecutada (T)

- API: `npm run build` aprobado; `node --import tsx --test tests/evaluations.test.ts`: 5/5.
- Web: build y lint aprobados. Suite serial completa: `node --test --test-concurrency=1 tests/*.test.mjs`: 77/77.
- Prettier de EvaluationsSection.tsx y session-recovery.test.mjs aprobado.
- La primera ejecución Web obtuvo 75/77: se corrigieron dos pruebas añadidas antes de la pausa (etiquetas esperadas y espera de persistencia asíncrona offline), sin cambiar lógica de producto.
- OpenAPI: JSON parseable y 99 referencias locales resueltas. No equivale a validación completa del estándar OpenAPI.
- Consulta remota read-only: main y HEAD coinciden en `33110ea7e6706842fb7ee7ad9aee76834fa1138e`.
- Vite emitió avisos HMR EPERM y de escaneo virtual:pwa-register; la ejecución serial terminó sin pruebas fallidas ni canceladas.

## Inspección (E) y limitaciones

- DATABASE_URL local identifica 127.0.0.1:5433/CouchOneFit_dev con rol couchone_api. No se abrió conexión ni se escribió en BD.
- TEST_DATABASE_URL ausente. Integración, migraciones y RLS no ejecutadas: el arnés crea/elimina bases y roles temporales y necesita conexión de preparación separada y autorización. No elevar privilegios del runtime.
- `.vite/deps_temp_d6f12e9a/package.json` contiene únicamente type=module; se conserva el artefacto sin eliminarlo.
- No se cambiaron migraciones históricas, contratos, lógica API, Flutter ni otros módulos en esta reanudación.
- Fecha UTC/offline, cinco pliegues, límite de 20 y elegibilidad de alta en inactivos conservan su carácter provisional según README de esta HU. No se ratificaron como decisiones del Product Owner.

## Validación humana (R) y cierre pendiente

Pukzil reportó login, registro, historial y validaciones correctos antes de la última UX. La nueva UX requiere revisión visual humana en escritorio/móvil, teclado, cierre/retorno de foco y lectura de valores históricos.

No se declara cierre D0: faltan suite API/RLS, revisión independiente y aceptación funcional de decisiones provisionales. No hubo commits, publicación, migraciones ni cambios de permisos.

## Ampliación multimétodo — sesión posterior autorizada

La evidencia anterior corresponde al incremento de registro manual. Para el alcance ampliado se ejecutó:

- **T:** API `npm run build`: aprobado. `node --import tsx --test tests/assessment.test.ts tests/evaluations.test.ts`: 9/9 aprobadas.
- **T:** Web build y lint aprobados. Suite final serial `node --test --test-concurrency=1 tests/*.test.mjs`: 82/82, sin fallos/cancelaciones. Incluye navegación propia, borradores por método, previsualización, referencia anatómica, cambio confirmado de tipo segmental y regresiones previas.
- **T:** Prettier de feature evaluaciones, navegación profesional, caché y pruebas Web tocadas: aprobado. `git diff --check`: limpio.
- **T:** JSON OpenAPI parseable y 101 referencias internas resueltas; no equivale a validación integral de la especificación OpenAPI. Coincidencia textual exacta entre migración nueva y apéndice del esquema integrado.
- **E:** TEST_DATABASE_URL ausente; no se abrió conexión PostgreSQL. Ninguna prueba de migración/RLS/integración PostgreSQL fue ejecutada ni declarada aprobada. El arnés preparado incluye una cuarta base temporal para actualización desde el esquema anterior con una evaluación histórica.
- **E:** No se modificaron migraciones históricas ni archivos Flutter. Cambios transversales de esta ampliación: navegación profesional, allowlist de lectura offline, contratos/documentación y pruebas del expediente. No se cambiaron reglas de autenticación/cupo/entrenamiento.
- **R:** La revisión visual del nuevo módulo no se ha realizado. El reporte humano previo sigue limitado al registro manual anterior.

Advertencias observadas: Vite HMR EPERM/escaneo virtual:pwa-register durante pruebas y chunk principal Web de aproximadamente 504 kB minificado. Build y suite terminaron correctamente; no se relajaron configuraciones para ocultar avisos.

Estado: código local preparado; migración `202611090001_multimethod_evaluations.sql` NO aplicada. Navy/JP3 deshabilitados. Cierre bloqueado por preparación/autorización del entorno PostgreSQL de pruebas, cotejo técnico de fórmulas/protocolos, revisión independiente y revisión visual. No hubo commits, publicaciones, cambios de rama, privilegios ni escrituras en bases.


## Reestructuración UX y diagnóstico de guardado — 10-nov-2026

- **T:** Web build aprobado; lint y formato comprobados sobre archivos afectados. Suite serial final: **89/89 aprobadas**. Incluye expediente compacto, navegación profunda de captura, conservación/confirmación de borradores, bloqueo de migración sin encolado, doble envío, errores, deadline con respuesta tardía y regresión StrictMode.
- **T:** API build aprobado y unitarias relacionadas **9/9 aprobadas**. No se ejecutó integración PostgreSQL/RLS.
- **E:** Causas comprobadas: clasificación de todo 503 como conectividad (encolaba el bloqueo de migración), ausencia de deadline de transporte y mounted=false no restablecido durante replay de efectos de StrictMode. No se midieron tiempos reales de PostgreSQL.
- **E:** El plazo de 20 segundos se habilita solo para altas/sincronización de evaluaciones y sigue DEC-013. No demuestra rollback: conserva idempotencia y contempla respuesta tardía. Otros consumidores de submitWrite conservan la espera anterior por defecto.
- **E:** Sin cambios de esquema/migraciones, autenticación, permisos, Flutter ni operaciones SQL. Operaciones existentes de outbox preservadas: rechazo de migración pasa a failed y no se reintenta automáticamente.
- **R:** Pendiente revisión humana de la nueva vista amplia. No se afirma recorrido visual ni guardado real multimétodo.
- Sin regresiones detectadas dentro de las pruebas Web ejecutadas; API/BD completas siguen no verificadas. Avisos Vite HMR/PWA y chunk principal ~509 kB permanecen documentados.

## Evaluación como tercera pestaña del expediente — 10-nov-2026

- **T:** Suite Web completa serial: **94/94 aprobadas**, cero fallos/cancelaciones. Comprueba orden Resumen/Entrenamiento/Evaluación, ausencia de entrada global y selector, navegación de ida/vuelta al mismo cliente, captura amplia, redirecciones antiguas seguras, identidad inválida/ajena, expediente inactivo y recorrido entre las pestañas compartidas. Se conservan regresiones de métodos/borradores, idempotencia, StrictMode, migración pendiente y offline.
- **T:** Builds Web y API aprobados; unitarias API relacionadas **9/9**. Lint Web, Prettier de archivos afectados y git diff --check aprobados.
- **E:** Reutilización de ClientHeader y del área EvaluationsPage, ahora exclusivamente contextual al expediente. EvaluationSummary conserva solo un dato informativo sin acciones. No se eliminaron archivos ni cambios previos.
- **E:** Sin cambios en API, contratos HTTP, esquema, migraciones, transporte de guardado, autenticación, permisos, Flutter ni estilos globales en esta tarea. Los diffs previos permanecen locales. No hubo conexiones/escrituras PostgreSQL ni cambios Git de historia/publicación.
- **R:** Revisión visual manual del nuevo alojamiento en pestaña pendiente. Se conserva captura de ancho completo con los breakpoints existentes; no se afirma prueba visual en dispositivos.
- Continúan los avisos Vite HMR/escaneo PWA y chunk ~507 kB, sin impedir las comprobaciones.
- La migración multimétodo y las pruebas PostgreSQL/RLS siguen pendientes de entorno y autorización. La reubicación Web no acredita guardado real en la base no migrada ni cierre D0.


## Auditoría de preparación para publicación — 10-nov-2026

- **T:** Suite Web 94/94; unitarias API seguras ampliadas 21/21; builds API/Web y lint Web aprobados. Prettier inicialmente detectó dos archivos con integración HU-021 previa; se corrigió únicamente su formato y el chequeo de archivos afectados quedó aprobado.
- **T:** JSON OpenAPI y 102 referencias locales/25 operationId comprobados; no hay validador semántico completo instalado. git diff --check limpio. Consulta ls-remote: main y rama remota coinciden con HEAD 33110ea7e6706842fb7ee7ad9aee76834fa1138e.
- **T/E:** Typecheck estricto adicional de tests detectó cuatro errores en helpers HU-021, corregidos; quedan cinco diagnósticos ajenos reproducibles con el test de HEAD y los mismos módulos actuales. No se alteraron pruebas de cartera/estado para ocultarlos. El build oficial excluye tests y está aprobado.
- **E:** Migraciones nuevas presentes íntegramente en esquema integrado, hashes locales registrados en revision-final.md, sin modificar SQL. No se contrastaron checksums con bases. TEST_DATABASE_URL ausente; conexión dev inspeccionada solo como configuración local 127.0.0.1:5433/CouchOneFit_dev, sin conexión SQL.
- **E:** Solicitud de autorización pendiente para los dos arneses temporales de migraciones/aislamiento; no se ejecutaron pruebas PostgreSQL, integración API ni RLS. La suite completa también escribe en la base indicada por TEST_DATABASE_URL: requiere autorización diferenciada.
- **E:** Se ampliaron pruebas HTTP por cada método y comparación completa de historial tras edición/inactivación/reactivación. Esas pruebas PostgreSQL siguen SIN EJECUTAR. Se corrigieron descripciones OpenAPI (fechas/503/null) y se distinguió cierre original de cálculos adicionales deshabilitados.
- **R:** Recorrido actual en navegador y revisión independiente pendientes; la validación humana anterior no prueba la última navegación ni guardado multimétodo.
- Dictamen: **NO LISTA PARA PUBLICAR**. Ver matriz, manifiesto candidato, riesgos y condiciones de desbloqueo en [revision-final.md](revision-final.md). Sin commits, publicaciones, cambios de rama, instalaciones, roles, migraciones ni escrituras SQL.


## PostgreSQL 17:5433 — ejecución limitada autorizada, 10-nov-2026

- **T:** Preflight SQL READ ONLY: PostgreSQL 17.11/UTF8/pg_c_utf8, 127.0.0.1:5433/postgres sin tablas del proyecto; rol de preparación existente verificado. Sin conexión a dev/test existentes.
- **T:** Solo migrations.test.ts y client-read-isolation.test.ts: primero 36/38 (dos fixtures HU-021 inválidas, corregidas), luego 38/38; nueva migración/regresión JSONB y ejecución final **39/39** (aislamiento/integración 38, migraciones 1). No se ejecutó la suite API completa.
- **T:** Migraciones limpias, segundo migrate idempotente, checksums, equivalencia con esquema integrado, actualización con registro heredado, tres métodos HTTP, fecha/asociación, NULL, historial, edición base/inactivación/reactivación, idempotencia, CSRF y RLS bajo runtime ordinario aprobados. Regresión SQL adicional cubre límites/precisión/mezcla de método/segmentos/discrepancia entre snapshot y columnas/propietario.
- **T:** Cada ejecución creó/eliminó seis bases y dos roles temporales únicos; listas de temporales vacías al finalizar y atributos/OID/membresías globales idénticos al preflight. Tres ejecuciones: 18 bases y seis roles en total, sin recursos preexistentes eliminados.
- **T:** Build API posterior aprobado y git diff --check limpio. Migraciones 202611080001 y 202611090001 inmutables; nueva 202611100001 probada solo en temporales. Esquema integrado/prueba actualizados para 29 migraciones y 28 tablas.
- **E:** La API ya protegía la entrada pública; se agregó defensa SQL porque INSERT ordinario podía eludir límites de mediciones JSONB. No se duplicaron cálculos en SQL ni se cambiaron RLS/grants. Legacy NULL sigue válido; datos incompatibles bloquean migración sin reescritura.
- **R:** Pendientes autorización para aplicación a desarrollo, revisión visual de esa versión y revisión independiente D0. No confundir 39/39 limitado con suite API completa ni cierre formal. Sin commits/push/cambios de rama; sin acceso a Supabase/PG16 y sin cambios a roles compartidos/runtime. Detalles en revision-final.md.


## Auditoría del manifiesto Git — 10-nov-2026

- **T:** 54 candidatos finales (28 M/26 N). Regla raíz `/.vite/` verificada por git check-ignore; caché original conservada en disco. Sin staging ni eliminación.
- **T/E:** 17 fuentes nuevas alcanzables desde entradas API/Web; pruebas, tres migraciones y documentación con consumidores. AST de session-recovery: 31→48 llamadas test, sin cuerpos idénticos; diff real 715 añadidas/13 eliminadas. Revisión de casos, diffs EP-03 y consumidores: cambios pertinentes a integración HU-021.
- **T:** Migraciones reproducidas exactamente una vez y ordenadas en esquema integrado; hashes inmutables. Escaneo de candidatos sin patrones de secretos/archivos generados; enlaces locales válidos y git diff --check limpio. No es auditoría criptográfica ni revisión independiente.
- **E:** Solo se modificaron .gitignore y documentación HU-021 en esta auditoría; no se repitieron suites de producto sin cambios de comportamiento. Se conserva evidencia anterior de PostgreSQL 39/39 y Web 94/94. Sin acceso SQL ni aplicación a desarrollo; respaldo verificado y autorización siguen siendo requisitos antes de migrar una base existente. Manifiesto exacto en revision-final.md.


## Integración final — respaldo y documentación, antes de migrar desarrollo

- **T:** READ ONLY en PG17.11/127.0.0.1:5433/CouchOneFit_dev; 27 migraciones aplicadas con hashes compatibles. Pendientes únicamente multimétodo 202611090001 e integridad 202611100001; 2 clientes/3 evaluaciones previas, huellas de datos fuera del repositorio.
- **T:** pg_dump custom 17.11 usando snapshot consistente; respaldo externo privado de 183873 bytes, TOC y lectura completa pg_restore aprobadas. No se restauró todavía: destino temporal pendiente de autorización; no se presume respaldo recuperado por solo haber leído el archivo. **Sin migración/escritura en desarrollo**, sin SQL en test/PG16/Supabase ni cambios de roles.
- **T:** Builds API/Web, lint Web aprobados, API segura 21/21, Web completa 94/94 repetidos. API health y Web HTTP200 en procesos existentes; no se inició sesión ni se crearon evaluaciones.
- **E:** HANDOFF externo leído íntegramente y conservado; copia integral actualizada en [COUCHONEFIT_HU021_HANDOFF.md](COUCHONEFIT_HU021_HANDOFF.md), con inventario de 55 rutas, decisiones, evidencia y puerta de recuperación. Credenciales QA existen en variables locales privadas; no se mostraron ni copiaron.
- **R:** Recorrido visual actual y aceptación independiente pendientes. La sesión no acredita publicación ni cierre D0.


## Integración local final completada — evidencia vigente

- **T:** Respaldo original restaurado con pg_restore en la única temporal nueva cof_hu021_restore_6dcaeb29a803, sin --clean/--create ni roles nuevos. Todas las huellas privadas, historia y catálogos coinciden. Una diferencia de paréntesis en CHECK se resolvió comparando normalización del planificador (sin alterar SQL/datos). Temporal eliminada tras identidad/verificación; backup conserva hash.
- **T:** Revalidado destino/historia/checksums y migrador separado, se aplicaron exactamente 202611090001 y 202611100001. Desarrollo tiene 29 migraciones, 14 restricciones de evaluación validadas, RLS y tres políticas. Huellas originales intactas y roles/membresías globales idénticos. No se reaplicó la inicial ni se tocó test/PG16/Supabase.
- **T:** Smoke HTTP/SQL QA **15 comprobaciones**: identidad sintética/propiedad verificadas; login, CSRF, rechazos, altas de tres métodos, opcionales, fecha, idempotencia, doble envío concurrente, historial y expediente, perfil intacto y logout. Solo 3 altas nuevas QA; los 2 clientes y 3 evaluaciones originales se conservaron, total final 6. No hay segunda cartera QA en desarrollo: caso HTTP ajeno allí no ejecutado; mantiene evidencia aislada anterior.
- **T:** En este encargo API unitarias **21/21**, Web completa **94/94**, builds API/Web, lint y Prettier de Web aprobados. OpenAPI JSON/102 referencias/25 operationId comprobados, no validación semántica completa. PG **39/39 histórico**, no reejecutado; suite API completa no ejecutada. Sin herramienta de navegador ni prueba visual/modo avión real.
- **E:** Ninguna corrección funcional de producto fue necesaria; solo auxiliares operativos fuera del repo y documentación. ls-remote confirmó main/rama remota iguales a HEAD; sin fetch ni cambios Git. Lista para revisión, no cierre formal ni publicación. Evidencia detallada en [HANDOFF](COUCHONEFIT_HU021_HANDOFF.md).


## Prepublicación — aprobación visual y auditoría de contrato

### R — revisión manual reportada y aprobada por el usuario: 7/7

**Fuente:** mensaje de Pukzil de esta prepublicación. El usuario declara haber ejecutado personalmente y aprobado los siete puntos siguientes. **No es una prueba visual automática de Codex**, no se aportaron capturas ni fecha/hora exacta de ejecución y no se inventan. Esta aprobación no completa la revisión independiente D0.

1. Evaluación aparece dentro del expediente de Cliente QA EP04.
2. Se muestran las seis evaluaciones y sus fechas.
3. Detalles y recarga conservan el historial.
4. El formulario cambia entre Perímetros, Pliegues y Bioimpedancia.
5. Opcionales, errores y botones funcionan correctamente.
6. Diseño correcto en computadora y vista móvil.
7. Borradores, cancelación y recuperación offline funcionan según lo documentado.

- **T/E actual:** inventario 55 (28 M/27 N), clasificación individual y plan 1+54 verificados sin staging. Se mantuvieron los cambios de otras épicas. No se ejecutaron suites de producto ni escrituras/conexiones SQL.
- **T actual:** Ajv 8.20.0 disponible sin instalación; el montaje con esquema oficial 3.1 no validó el control mínimo con Schema Object, por lo que no se declara aprobado/inválido global por esa salida. Se metavalidaron 26 componentes y se verificaron 25 operaciones/parámetros/seguridad/respuestas. 7 contrastes de request exponen 4 diferencias; 3 de respuesta/guard Web coinciden. Sin assertion de formatos ni validación semántica completa.
- **Hallazgos:** LegacyEvaluationInput permite vacío y rechaza null aceptado por API; métodos permiten vacío o solo generales; GET no documenta 400/503; snapshot y descripción de fields incompletos. No se cambió OpenAPI ni validadores: corrección pendiente de autorización. Esto bloquea considerar D0.9 satisfecho.
- **Seguridad:** se sustituyó una ruta personal del respaldo en el HANDOFF por marcador; backup/original externos intactos. Caché/entornos/generados fuera de candidatos. Escaneo con límites documentados, sin valores secretos impresos.
- **Histórico técnico (no repetido aquí):** API 21/21, Web 94/94, PG 39/39 anterior, smoke 15/15, builds/lint/Prettier y recuperación/migración local verificadas. Revisión manual nueva R 7/7; revisión independiente no aportada.
- Matriz, inventario con coordinación/riesgo, commits y borrador PR centralizados en [revision-final.md](revision-final.md#prepublicación-final--revisión-del-contrato-inventario-y-propuesta-no-ejecutada). Lista para revisión con observaciones; no aprobar push hasta corrección contractual, confirmaciones de supervisor y autorización expresa.


## T/E — corrección contractual autorizada (estado posterior a la prepublicación)

Se corrigieron exclusivamente OpenAPI y la evidencia HU-021. OAS-01–06 resueltos: no-vacío/no-null efectivo, null heredado, medición propia por método, errores GET/POST, metadatos snapshot, Error.fields y condiciones CSRF/idempotencia. Sin cambiar API/Web/SQL ni las reglas de negocio.

**Resultados nuevos:** 105 contrastes de solicitudes (36 válidas/69 inválidas) coinciden con validadores; cuatro negativos adicionales rechazados por reglas de servidor documentadas; cinco respuestas compatibles con guard Web, cinco omisiones de metadatos rechazadas y un Error.fields aceptado. 26 componentes metavalidados, 105 referencias resueltas, 25 operationId únicos. Unitarias puras de assessment/evaluations **11/11**; no confundir con 21/21 histórico. Formato JSON y diff comprobados al final.

**Validación alternativa:** Ajv con esquema estructural oficial y enlace explícito al metaschema 2020-12 en memoria; control válido y dos negativos correctos. El esquema oficial sin adaptar sigue siendo incompatible en este montaje; no se declara su aprobación. Formatos en estructura son anotaciones; date/date-time/uuid de instancias usan comprobadores locales, no certificación RFC exhaustiva. Reglas temporales, entre campos y de seguridad siguen en servidor. Evidencia detallada y comando diagnóstico en [revision-final.md](revision-final.md#corrección-contractual-autorizada--evidencia-vigente).

**R 7/7 se conserva** como reporte manual aprobado por usuario, sin ejecución visual automática ni nueva fecha inventada. No se repitieron migraciones, PostgreSQL, smoke, Web ni builds. D0 independiente y gates de publicación permanecen pendientes. Inventario: 55 (28 M + 27 N), sin staging/commits/push ni escrituras SQL.


## T — última comprobación previa a commits (sin publicación)

- `npm --prefix apps/api run build`: aprobado.
- `npm --prefix apps/web run build`: aprobado; aviso no fatal de bundle >500 kB. No se cambió configuración para ocultarlo.
- `npm --prefix apps/web run lint`: aprobado.
- `node --import ./apps/api/node_modules/tsx/dist/loader.mjs --test apps/api/tests/assessment.test.ts apps/api/tests/evaluations.test.ts`: **11/11**, cero fallos, sin BD.
- `npm --prefix apps/web test`: **94/94**, cero fallos. Primera ejecución dentro del sandbox emitió EPERM para el socket Vite; repetida con permiso fuera del sandbox, también **94/94**. La repetición emitió avisos no fatales de puerto HMR 24678 ocupado y escaneo de `virtual:pwa-register` en servidores de test con `configFile:false`; build productivo PWA aprobado. Se conservan los avisos, sin modificar arneses ajenos ni declararlos pruebas fallidas.
- Prettier sobre **24 archivos** candidatos Web/contrato: aprobado. `git diff --check`: limpio.
- Contrato: **105/105** contrastes (36 válidos/69 inválidos), cuatro negativos contextuales de servidor, cinco respuestas válidas/guard Web, cinco omisiones de metadatos rechazadas, Error.fields aceptado; 26 componentes y 105 refs/25 operationId. OAS-01–06 permanecen corregidos. Validación estructural alternativa aprobada con controles; montaje oficial sin adaptar repetido, sigue rechazando el control válido por unevaluatedProperties, por lo que continúa inconcluso. No nuevas dependencias.
- `git fetch origin` autorizado y completado. HEAD, origin/main y origin/feature/ep04-antropometria coinciden en `33110ea7e6706842fb7ee7ad9aee76834fa1138e`: comparaciones 0/0, sin cambios de main que integrar al consultar. No merge/rebase ni sobrescritura remota.
- Inventario **55 = 28 M + 27 N**. Plan definitivo: `fix(repo): ignore generated vite cache` (.gitignore) y `feat(ep04): integrate dated client evaluations` (otros 54 según lista de revision-final.md), cobertura/unicidad comprobadas. Índice vacío. Sin secretos/cachés/compilados entre candidatos; .vite ignorada. Tres migraciones conservan hashes y una aparición por cuerpo en esquema integrado.

PG **39/39**, smoke **15/15**, restauración/migración local y visual **R 7/7** se conservan como evidencia anterior, **no repetida**. No se abrió conexión SQL. Sin cambios funcionales, instalaciones, migraciones ni roles. Codebase Memory no disponible: inspección estática.

**Estado:** propuesta de dos commits locales preparada; **pendiente autorización expresa antes de staging/commit**. Después habrá una segunda autorización separada de push. Antes del push confirmar con supervisor rama/automatizaciones Render y previews Vercel (rewrite API productiva), coordinación shared y excepción de nombre; no basta que no haya workflows versionados. D0 independiente pendiente antes de merge. No hubo commit/push/PR ni despliegue.
