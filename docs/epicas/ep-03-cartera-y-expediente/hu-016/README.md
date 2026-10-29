# HU-016 — Listar y buscar la cartera propia

Responsable: Franela Whaite. EP-03; referencias RDF0302/RDF0303. La historia coincide con `plan/PLAN_TRABAJO_V2.md` §HU-016: API con búsqueda/estado/paginación/orden, listado Web navegable y QA con dos carteras/caracteres especiales/estados/páginas límite. Carga y búsqueda sin coincidencias detallan los estados exigidos por D0.4, sin cambiar reglas de negocio.

## Dependencia y ramas

**Flujo vigente:** conforme al [acuerdo de integración de EP-03](../README.md#acuerdo-de-integración-vigente), `feature/api-client-portfolio` es la única rama de trabajo para toda la épica. Contiene HU-015 y HU-016; las historias restantes continúan ahí, con commits descriptivos separados por HU y publicación de avances tras verificar. No se crean ramas ni PR por historia: el próximo PR se abrirá al completar EP-03. `feature/api-client-initial-record` y el PR #22 se conservan intactos. No se reescribe el historial ni se usa force-push.

**Antecedente histórico:** la persona usuaria autorizó crear `feature/api-client-portfolio` desde `feature/api-client-initial-record`, en el commit base `6b2c0a0473402c76ba1eff33dd184adf6c63ce24`, como excepción a CONTRIBUTING.md. HU-015 se publicó en el PR #22 en borrador; HU-016 añadió sus commits en la rama dependiente, que ya fue publicada. El plan inicial de abrir otro PR contra HU-015 fue sustituido por el acuerdo de épica. Esta descripción histórica no autoriza nuevas ramas por HU ni iniciar HU-017 en esta aclaración documental.

Cuando HU-015 se integre, primero se revisará cómo se integró y se elegirá el procedimiento que preserve los commits y la revisión. No hay autorización para rebase, cherry-pick, force-push o cambio de base automáticos. No se declara HU-015 aceptada ni TT-010 transversal completo. La exposición concreta de lectura de clientes fue corregida y probada en la dependencia; requiere revisión independiente y no sustituye toda TT-010.

La persona usuaria reportó haber avisado al equipo del alcance compartido de HU-016 antes de autorizar esta implementación. Se registra como reporte de la persona usuaria; el agente no envió mensajes al equipo ni verificó directamente el grupo. Este aviso es distinto del aviso posterior de HU-015.

## Contrato de listado

`GET /api/clients` requiere sesión profesional activa y conserva la condición existente de suscripción vigente. Devuelve `Cache-Control: no-store`. No acepta propietario ni orden arbitrarios por query. Los campos `userId` y `status` conservan su significado: vínculo a cuenta y estado del expediente, respectivamente.

| Parámetro | Contrato |
| --- | --- |
| `search` | Opcional, vacío por defecto. Subcadena literal de `fullName`, recortada en extremos, máximo 150 puntos de código; NUL rechazado. Se compara con `position(lower($search) in lower(c.full_name))`, sin construir SQL ni patrones LIKE. `%`, `_`, comillas y barras no son comodines; no se eliminan acentos ni se ofrece búsqueda por correo. |
| `status` | Vacío/ausente incluye ambos; `active` o `inactive` filtran el estado del expediente. |
| `pageSize` | Entero decimal entre 1 y 100; predeterminado 20. Web ofrece 20/50/100. |
| `cursor` | `nextCursor` anterior. Token firmado HMAC-SHA256 con separación de dominio respecto a JWT, ligado a cuenta, búsqueda, estado y tamaño. Parámetros repetidos, desconocidos, cursor alterado o reutilizado con otra cuenta/filtros: 400. No se usa como autorización ni cifra sus campos. La rotación de la clave invalida los cursores y requiere iniciar una consulta nueva. |

Respuesta: `{ clients, hasClients, pageInfo: { pageSize, hasMore, nextCursor } }`. `clients` conserva la proyección anterior: `id`, `userId`, `fullName`, `goal`, `status`, `invitationExpiresAt`; no incluye medidas, hashes, códigos ni metadatos internos de cursor. `hasClients` comprueba si existe algún expediente en el ámbito propio visible antes de los filtros, permitiendo distinguir cartera vacía de búsqueda/estado sin coincidencias. Sin suscripción vigente se conserva la respuesta vacía del flujo anterior, ahora con metadatos explícitos.

Orden fijo: `created_at DESC, id DESC`. El UUID desempata marcas iguales. Se solicitan `pageSize + 1` filas y se avanza mediante comparación de tupla `(created_at,id) < (cursorTime,cursorId)`. La fecha del cursor se obtiene como texto PostgreSQL para conservar microsegundos; no pasa por Date de JavaScript. El cambio del desempate anterior `id ASC` a `id DESC` solo afecta empates, documentado para este contrato nuevo.

En un conjunto sin modificaciones, el recorrido no omite ni duplica registros. Las inserciones posteriores por delante del cursor no desplazan las páginas restantes. No se promete una instantánea congelada: altas posteriores pueden requerir volver a primera página; cambios de estado/nombre o borrados pueden cambiar la pertenencia a filtros durante la navegación. La Web conserva una pila de cursores para Anterior/Siguiente y reinicia desde el principio al aplicar búsqueda, estado o tamaño. Al volver desde una ficha se inicia la consulta predeterminada; no se persisten filtros ni datos del expediente en almacenamiento del navegador.

## Contrato auxiliar de lectura mínima

`GET /api/clients/{clientId}` y Web `/app/clientes/{clientId}` muestran exclusivamente datos base del expediente propio: `id`, `fullName`, `status`, `goal`, `birthDate`, `heightCm`, `baseWeightKg`, `baseBodyFatPercentage`, `waistCm`, `hipCm`. Los números son JSON numérico; la fecha es `YYYY-MM-DD`. Los campos antiguos pueden ser NULL y se muestran como «Sin registrar», sin fabricar valores ni alterar registros anteriores.

UUID inválido: 400. Sin sesión válida: 401. Rol no profesional: 403. Ajeno, inexistente o no disponible por suscripción: mismo 404 `CLIENT_NOT_FOUND`, sin revelar propietario. Incluye expedientes propios activos e inactivos. Se conserva la política de suscripción del listado existente; no se concede una excepción nueva de acceso. La vista tiene carga, error/reintento y vuelta a cartera; no contiene formulario de edición.

Este contrato auxiliar fue autorizado explícitamente para HU-016. No implementa HU-017, planes, evaluaciones, prescripciones ni expediente consolidado. OpenAPI se actualiza en `docs/api/identity-lifecycle.openapi.json`.

## Seguridad, concurrencia y regresiones

El propietario procede de la identidad autenticada persistida. Las consultas llevan parámetros posicionales y filtro de profesional, bajo `readAsSubject` transaccional y la política RLS heredada de la corrección TT-010. No hay cambios en grants/RLS ni uso de un rol administrativo para lecturas ordinarias. Las pruebas SQL usan un LOGIN real sin superusuario/BYPASSRLS, creación de bases o roles.

Web asocia cada respuesta a la consulta vigente; descarta respuestas antiguas al cambiar filtros, cursor, cliente o desmontar. Carga se deriva de la identidad de la petición, evitando mostrar resultados o errores de una consulta anterior como si fueran actuales. La ficha sigue el mismo criterio. Se mantienen alta, estado e invitaciones. Durante una mutación se bloquean filtros/páginas para no entregar un código con un destinatario visual diferente. El alta válida restablece búsqueda/estado y primera página para localizar el registro nuevo; el error de alta conserva el formulario. La recuperación de sesión de HU-015 continúa vigente y tiene regresiones.

## Migración e índice

La única migración nueva es `202610280003_client_portfolio_order.sql`: índice B-tree `(professional_id, created_at DESC, id DESC)`. Coincide con el ámbito y orden del cursor, evitando ordenar toda una cartera para una lectura limitada. El índice primario existente resuelve lectura por ID. No se agregan extensiones, trigramas ni índices especulativos de búsqueda por subcadena; este B-tree no se presenta como acelerador de cualquier búsqueda literal o filtro de estado.

La prueba de plan usa 5000 filas sintéticas en una base temporal y un rol runtime ordinario; exige que EXPLAIN del recorrido limitado por profesional use el índice sin forzar `enable_seqscan=off`. No se afirma una medición de rendimiento de producción. Las migraciones históricas permanecen intactas y la instantánea integrada refleja las catorce migraciones. Instalación limpia, actualización con datos previos, paridad de catálogo y checksums se verifican en la suite de migraciones.

## Evidencia y pendientes

Ver [validación local](validacion-local.md) y [recorrido manual breve](prueba-web-manual.md). Las pruebas automatizadas no se atribuyen a la persona usuaria ni acreditan un recorrido humano nuevo. El recorrido desde la app real consta como reporte de la persona usuaria, con alcance explícito. D0 permanece abierto hasta revisión independiente y aceptación de dependencias. La deuda global previa de formato sigue visible. Se autoriza publicar únicamente esta rama; no se hace merge, despliegue ni operación contra Supabase compartido. Ver [revisión final](revision-final.md).
