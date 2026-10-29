# Evidencia local — HU-017

28/10/2026, America/Mexico_City. T = ejecución de herramienta/prueba, E = revisión estática, R = reporte de la persona usuaria. Hay resultados manuales parciales reportados por la persona usuaria; se detallan abajo sin atribuir ejecución al agente. Node 24.22.0, npm 11.19.1, PostgreSQL local 18.6. Rama única `feature/api-client-portfolio`, base de esta entrega `d6e7e20`; cambios locales iniciales: ninguno.

## Destino y conservación

T: cada ejecución API cargó explícitamente `.env.test.local` y verificó ambas URLs y la identidad SQL `127.0.0.1:5432/CouchOneFit_test`. Las suites crean/eliminan exclusivamente sus bases y roles temporales locales. No se conecta a Supabase compartido.

T: se aplicó únicamente `202610280004_client_record_version.sql` a la base manual exclusiva. Antes/después se comparó el hash agregado de las 28 filas completas de clientes excluyendo solo la nueva columna version: conteo y datos coinciden, versiones iniciales 28/28 en 1. No se borró ni restableció ninguna fixture. El helper local ignorado de HU-016 excluye ahora esa columna nueva de su comparación de datos anteriores, sin reescribir marcadores. Las tres filas previas siguen coincidiendo con sus hashes; 24 fixtures HU016 QA y su fixture ajena se conservaron, 27 propios totales, 5 activos usados de 10.

T: no había API/Web activas. Se inició API desde el build actual con el asistente que conserva datos y Vite local 5000 con API de mismo origen a 3000. Health directo/proxy, catálogo y conexión runtime ordinaria a la base local: correctos. Comprobación HTTP por Vite: listado 20+4 propios, ficha propia 200/ajena 404; crea y elimina únicamente su sesión temporal sintética por UUID, no sesiones anteriores. No es recorrido humano.

## Matriz de comprobación

| Requisito / fuente | Evidencia | Estado |
| --- | --- | --- |
| Propiedad, autorización y whitelist — HU-017, RDF0304, RS02/RS19 | T: dos profesionales, cliente/admin, sesión/CSRF, campos manipulados, SQL runtime ordinario y ausencia de contexto. E: identidad persistida, SQL parametrizado y UPDATE por columnas bajo RLS existente. | Cumple en este alcance |
| Diccionario / semántica parcial — DEC-006 §3.4, HU-015 | T: rangos, precisiones, tipos, Unicode, cumpleaños, omitidos/NULL/vacío y legado. Texto omitido conserva incluso espacios anteriores. Alta mantiene sus regresiones. | Cumple |
| Suscripción sin consumo de cupo — DEC-004 | T: editar con exceso no cambia activos; sin plan/suspendida/vencida rechaza sin escritura. E: condición exacta y llamada consume=false en README. | Cumple |
| Concurrencia y versión — aceptación HU-017 | T: dos requests con varias conexiones runtime, una gana y otra 409; estado efectivo incrementa, no-op no incrementa; activación restringida incrementa y vuelve obsoleto el editor. Versión forzada en INSERT se ignora y UPDATE runtime de versión se deniega. | Cumple |
| Atomicidad / conservación — HU-017-QA1 | T: trigger de fallo posterior a UPDATE revierte datos/versión; contexto se libera. Edición válida conserva invitación y evento de acceso realmente no vacíos. No se afirma probar tablas históricas inexistentes. | Cumple con límite explícito |
| Conflicto e incertidumbre Web | T: borrador intacto, comparar no guarda, reaplicar exige acción y conserva campos remotos no editados; respuesta perdida no confirma ni repite, consulta del guardado ya realizado evita otra escritura. | Cumple |
| Sesión / red / negocio | T: 403 de negocio y CSRF conservan; fallo de comprobación mantiene editor oculto hasta recuperación; 401 recuperable no repite PATCH; rechazo definitivo/logout/otra cuenta y otra identidad en refresh destruyen editor. | Cumple |
| Regresiones HU-015/016 | T: alta, cupo/concurrencia, invitación/canje/recuperación/autenticación y listado/literales/filtros/páginas/respuestas antiguas. No se exige ni acredita repetir su recorrido humano. | Cumple según suites |
| Migración limpia/actualización | T: quince migraciones, checksums, datos anteriores y versión 1; paridad de columnas, restricciones, índices, permisos, RLS, función y triggers con esquema integrado. E: catorce SQL históricos intactos. | Cumple |
| Contrato y convenciones | E/T: OpenAPI, proyecciones, nombres y referencias; capas API, textos españoles y DTO alineados. Sin tablas históricas, índices o dependencias especulativas. | Cumple |
| Formato previo | T: format:check global conserva 53 archivos previos ajenos; antes eran 55. El archivo de sesión y el README Web, ahora modificados, se formatearon y dejaron de contribuir al conteo. No se presenta el comando global como aprobado. | Pendiente transversal |
| Recorrido real / revisión independiente — D0.8/10 | R: edición/validación/persistencia, conflicto/reaplicación, recuperación de sesión Offline → Online y descarte tras logout confirmados. Fallo durante PATCH y mensaje incierto no comprobados manualmente. [Detalle y caso pendiente](prueba-web-manual.md). HU-015 y TT-010 transversal conservan sus puertas de aceptación. | Pendiente |

## Resultados de suites

### Resultados manuales reportados por la persona usuaria (R)

- Edición válida, rechazo de 70.25, corrección y persistencia tras recargar: correcto.
- Dos editores: conflicto sin sobrescribir, borrador conservado, consulta de versión actual y reaplicación explícita: correcto.
- Offline → Online: el editor se ocultó por la comprobación de sesión y reapareció conservando el borrador.
- Cerrar sesión y volver a abrir la ficha: borrador descartado; permanecieron los cambios guardados anteriormente.

La persona usuaria no alcanzó a pulsar Guardar estando Offline. No se acredita manualmente un PATCH fallido, el mensaje de resultado incierto ni pérdida de respuesta después de COMMIT. Tampoco se infieren campos/opcionales concretos, conservación histórica SQL u otras observaciones no reportadas. No son ejecuciones del agente.

### Cobertura automática del caso no realizado manualmente

La prueba Web `HU-017 lost save response is uncertain, survives session network recovery and never retries automatically` ejecuta el submit real del componente; el transporte PATCH simulado lanza TypeError. Exige mensaje de resultado incierto, una sola escritura, borrador conservado tras comprobación de sesión fallida y recuperación, consulta explícita sin otro PATCH y ausencia de otro envío cuando la respuesta GET simulada ya contiene los cambios. Esa última parte representa el estado compatible con un guardado confirmado cuya respuesta no llegó; no provoca realmente una pérdida de paquetes tras COMMIT en PostgreSQL. Las pruebas API de rollback son independientes y no acreditan ese fallo de transporte extremo a extremo.

El caso automatizado forma parte de la suite Web anterior 22/22; no se volvió a ejecutar por esta actualización exclusivamente documental. Para observar el mensaje desde navegador queda propuesto el [bloqueo selectivo de PATCH](prueba-web-manual.md#comprobación-adicional-aislada-de-patch), sin modificar la aplicación.

T: suite API final **107/107 aprobadas**, 0 fallidas/omitidas, 87487 ms; suite Web **22/22 aprobadas**, 0 fallidas/omitidas, 10976 ms. Compilaciones API y Web, Oxlint y Prettier de todos los archivos Web modificados aprobados; git diff --check sin errores. OpenAPI parseado y 34 referencias resueltas, ficha/version y esquema PATCH comprobados. El format:check global falla en 53 archivos previos ajenos; no se presenta como verde. No se consideran aprobados intentos fallidos anteriores.

## Incidencias propias corregidas durante la preparación

Una prueba nueva de cambio de cuenta esperaba un campo de alta vacío aunque se permanecía en una ficha de lectura: se corrigió para exigir ausencia del editor anterior. La fixture nueva de activación usó inicialmente un hash sintético que incumplía la restricción vigente; después omitía app.client_id, requerido por la capacidad restringida. Se corrigió la preparación usando un hash válido de la fixture temporal y los contextos exigidos, sin relajar autenticación, RLS ni la función. Son fallos de pruebas nuevas HU-017, no deuda atribuida a main.

La revisión detectó y corrigió una normalización de campos omitidos que podría haber recortado textos antiguos. Su regresión exige preservar esos valores exactamente. No se modificó ninguna migración histórica.

## Límites de entrega

Commits locales por bloques HU-017; sin push por instrucción actual, sin nueva rama/PR, merge, despliegue o Supabase. `feature/api-client-initial-record` y PR #22 permanecen intactos. Los asistentes/credenciales/marcadores son ignorados y no se publican. D0 y TT-010 transversal no se cierran por estos resultados; falta revisión independiente y completar la observación manual aislada del fallo durante PATCH. La validación real ya reportada conserva su alcance explícito.

## Commits locales

- 48cd3f8: BD/API, validación reutilizada, PATCH, versión, OpenAPI y pruebas.
- b87fc29: editor Web, conflicto/resultado incierto y regresiones de sesión.
- La evidencia y los contratos documentales se guardan en un bloque documental separado de HU-017, sin publicación.

Escaneo final de archivos publicables: sin coincidencias de secretos locales conocidos, patrones de credenciales ni temporales. Los helpers y marcadores locales continúan ignorados por Git.
