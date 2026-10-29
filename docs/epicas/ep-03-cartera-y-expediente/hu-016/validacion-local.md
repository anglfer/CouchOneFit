# Evidencia local — HU-016

28/10/2026, America/Mexico_City. Node 24.22.0, npm 11.19.1 y PostgreSQL 18.6 de esta computadora. T = herramienta/prueba; E = revisión estática; R = reporte de la persona usuaria. No hay recorrido humano de HU-016 acreditado.

| Comprobación | Evidencia y resultado |
| --- | --- |
| Suite API | T: **97/97 aprobadas**, 0 fallidas/omitidas; 56487 ms. Seis casos nuevos sobre los 91 de la dependencia. |
| Propiedad HTTP/SQL | T: LOGIN real ordinario, sin superusuario/BYPASSRLS/CREATEDB/CREATEROLE. Cada profesional solo lee su cartera; contexto inválido no habilita lectura general. Búsqueda, listado y ficha no exponen otros propietarios. |
| Búsqueda/estado | T: `%`, `_`, barra, apóstrofo, apariencia de inyección, emoji y acento; nombres iguales en otra cartera; activos/inactivos y cero coincidencias. |
| Cursores/límites | T: tamaños 1/20/100, cartera vacía, firma alterada, otra cuenta/filtros/tamaño, parámetros inválidos/repetidos/desconocidos, empates UUID y diferencia de un microsegundo. Inserción por delante del cursor no desplaza las páginas restantes. |
| Ficha mínima | T: propia, ajena/inexistente con el mismo 404, UUID inválido 400, cliente/admin 403, medidas numéricas/fecha/NULL históricos y suscripción suspendida sin exposición. |
| Índice | T: EXPLAIN bajo rol ordinario con 5000 filas sintéticas usa `idx_clients_portfolio_order` en lectura limitada por profesional, sin forzar al optimizador. No es una medición de producción ni promesa de acelerar toda búsqueda de subcadena. |
| Migraciones | T: instalación limpia/idempotencia, actualización con registros anteriores, paridad de tablas/restricciones/índices/RLS/permisos/funciones y checksums: catorce migraciones. E: solo un índice nuevo, trece migraciones previas intactas. |
| Regresiones API | T: alta, cupo, estados, concurrencia, atomicidad, invitación, activación, autenticación, recuperación y limpieza incluidas en la suite completa. |
| Suite Web | T: **11/11 aprobadas**, 0 fallidas/omitidas; 4006 ms. Componentes React reales con JSDOM y HTTP simulado; siete casos de sesión anteriores y cuatro nuevos. No sustituye un navegador real. |
| UX Web | T: vacía/carga/cero coincidencias/error/reintento, respuestas antiguas ignoradas, Anterior/Siguiente, reinicio de cursor al filtrar y borrador de alta intacto entre páginas. Ficha de lectura con NULL y error/reintento, sin edición. |
| Invitación Web | T: destinatario/código/revocación, filtros y páginas bloqueados durante emisión. Guardado fallido/reintento explícito y recuperación/cierre/cambio de cuenta conservan sus regresiones. |
| Builds/lint | T: API TypeScript y Web TypeScript/Vite compilan; Oxlint Web sin avisos nuevos. |
| Formato aplicable | T: Prettier de archivos Web modificados y `git diff --check` aprobados. API/SQL/Markdown/JSON siguen sus convenciones; OpenAPI parseable y referencias locales comprobadas. |
| Formato global previo | T: `format:check` sigue fallando en los mismos **55 archivos ajenos**; no se presenta como verde ni se modifica esa deuda. |
| D0/dependencias | Pendientes: revisión independiente, recorrido humano, aceptación de HU-015 y alcance transversal restante de TT-010. |

## Destino y conservación

Antes de migrar y en cada ejecución se cargó explícitamente `.env.test.local`; el asistente comprobó ambas URLs e identidad SQL: exclusivamente `127.0.0.1:5432/CouchOneFit_test`. Se aplicó localmente `202610280003_client_portfolio_order.sql`. Las suites crearon/eliminaron únicamente sus bases/roles temporales. No se usó Supabase compartido ni se limpió la fixture manual. No se imprimieron credenciales.

## Incidencias resueltas

La primera suite detectó una aserción antigua de respuesta exacta que no contemplaba metadatos y dos casos que reutilizaban una sesión cliente revocada/superficie incorrecta. Se actualizó el contrato esperado y se usó un cliente válido por Bearer para exigir 403, sin modificar autenticación. Un caso de límite contaba una inserción cuyo nombre coincidía accidentalmente con la búsqueda; se separó el nombre y conservó la aserción exacta. El selector de pruebas Web se amplió para incluir selects. No quedan esos fallos en la versión final ni se atribuyen a main.

## Rama

`feature/api-client-portfolio` nace de HU-015 `6b2c0a0` por excepción explícita. El aviso compartido consta como R previo de la persona usuaria. La referencia HU-015 y PR #22 no se modificaron; no se publica la rama nueva. Acuerdo posterior: commits por historia y próximo PR al completar EP-03; no abrir PR de HU-016. El PR #22 se conserva tal como está. La base del futuro PR de épica se resolverá cuando corresponda, tras revisar las dependencias reales, sin modificarla automáticamente. Tras su integración se revisará primero el método real y se elegirá cómo preservar commits/revisión; no hay rebase, cherry-pick, force-push o cambio de base automáticos. [Contrato y alcance](README.md).

## Preparación manual posterior, sin resultados humanos nuevos

Se recompilaron API/Web desde esta rama y se reinició solo la API antigua identificada como asistente que conserva datos. Vite se reutilizó y se comprobaron su módulo HU-016, mismo origen/proxy y la conexión runtime exclusiva local. Se crearon 24 clientes sintéticos propios `HU016 QA` (2 activos/22 inactivos) y una fixture ajena; las tres filas previas se conservaron y verificaron por hash. No se cambió contraseña de acceso, plan ni suscripción; activos usados 5/10. Los asistentes y marcadores siguen ignorados.

Una comprobación HTTP local a través de Vite confirmó páginas 20+4 sin duplicados/ajenos y ficha propia 200/ajena 404; su sesión sintética temporal se eliminó por ID exacto sin afectar sesiones previas. No es recorrido humano ni repetición de la suite. El [recorrido actualizado](prueba-web-manual.md) distingue pasos humanos de aislamiento/respuestas antiguas ya automatizados. Las fixtures y servicios se conservan, sin limpieza, push, PR nuevo ni cambios al PR #22.

## Commits por bloque

- 4490e45: API, cursor firmado, lectura autorizada, índice, OpenAPI y regresiones SQL/API.
- b6cdb33: listado/filtros/páginas/ficha Web y regresiones de sesión/alta/invitación.
- La documentación de dependencia, evidencia y recorrido queda en un commit documental separado.

El escaneo de archivos publicables no encontró secretos locales conocidos, URLs con credenciales ni temporales. Los asistentes .env.* y credenciales locales continúan ignorados por Git; no se incluyen builds ni node_modules.
