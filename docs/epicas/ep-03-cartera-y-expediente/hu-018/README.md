# HU-018 — Activar o dar de baja lógicamente al cliente

## Responsabilidad, autorización y límites

Fuente: `plan/PLAN_TRABAJO_V2.md` §HU-018. Franela Whaite conserva coordinación, Web, integración y QA; Omar permanece como ejecutor asignado de HU-018-API1 en el plan. La implementación efectiva de esta entrega (API incluida) la realizó el asistente por autorización explícita de la persona usuaria el 29/10/2026. No se atribuye aprobación, implementación, coordinación ni revisión a Omar. No consta el aviso específico al grupo de archivos compartidos exigido por CONTRIBUTING §1.3: se registra esa ausencia y la instrucción expresa de proceder, sin inventar coordinación ni bloquear el trabajo autorizado. La revisión independiente permanece pendiente.

Se trabaja solo en `feature/api-client-portfolio`, con commits HU-018; no se crea rama/PR ni se publica en esta entrega. Se conservan HU-015 y PR #22. El próximo PR será al completar EP-03 conforme al [acuerdo vigente](../README.md#acuerdo-de-integración-vigente).

El alcance es exclusivamente el estado operativo de `private.clients`. No hay DELETE físico, baja/reactivación de cuenta, revocación de sesiones por inactivar expediente, cambios de suscripción, purga de invitaciones ni reescritura de datos base/historial.

## Matriz de efectos y fuentes vigentes

DEC-004 §3.4 distingue profesional, cuenta cliente, expediente y suscripción; HU-013/DEC-005 define cupo; HU-005 define revocación por cuenta/sesión. Las propuestas históricas de §3.5 no reabren estas decisiones.

| Operación / condición | Efecto |
| --- | --- |
| Inactivar expediente propio activo | Cambia solo `clients.status`, incrementa versión y audita en la misma transacción. Libera una plaza activa; conserva datos, vínculo, invitaciones y registros relacionados. |
| Cuenta cliente activa con expediente inactivo | Login/sesión/refresh y lectura propia autorizada se mantienen. DEC-004 prohíbe operaciones de check-in/peso/series y activación en ese estado; no se inventan esos módulos ni se acredita que estén implementados. No se borran/despublican planes. |
| Reactivar expediente | Profesional/cuenta y suscripción vigentes; consumir plaza exige `used < limit`, o plan ilimitado. No reactiva una cuenta inactiva ni revive sesiones revocadas. |
| Sin plan, suscripción suspendida/vencida | Se rechaza la operación de negocio con 403, también una repetición, sin cambiar datos ni auditarlos. Corresponde a DEC-004; no es ausencia de cupo. |
| Exceso por datos históricos/reducción de catálogo | No bloquea inactivar ni repetir estado actual; sí nuevos consumidores. Se reutiliza HU-013 sin duplicar la lógica de cupos. |
| Cuenta dada de baja explícitamente por otro flujo autorizado | No login y sesiones revocadas por HU-005. Esa acción no está en el endpoint ni en la confirmación HU-018; no cambia automáticamente el expediente. |
| Invitaciones existentes | Se conservan. Emisión/canje requieren expediente activo, profesional/suscripción vigentes y demás controles existentes. Reactivar permite usar una invitación anterior solo si sigue vigente, no vinculada y cumple esas condiciones. No se extiende su TTL ni se inventa revocación automática. |

## Contrato y reintentos

`PATCH /api/clients/:clientId/status` conserva sesión profesional, Origin permitido, CSRF y no-store. Ahora exige JSON estricto `{ "status": "active" | "inactive", "version": integer }`. La versión (1–2147483647) procede de la ficha GET ya existente; Web la consulta antes de abrir la confirmación, sin alterar la proyección del listado/cursor HU-016.

Respuesta 200: `{ client: ClientBaseRecord }`, con estado y versión resultantes, datos base propios y sin `userId`/propietario. El resto de campos coincide con la ficha de HU-017.

1. Se valida payload/UUID, identidad persistida, sesión, propiedad y elegibilidad profesional/suscripción.
2. Si la versión es futura, 409 `CLIENT_RECORD_CONFLICT`.
3. Si el estado solicitado ya es el actual y la versión no es futura, 200 sin UPDATE, reserva ni auditoría adicional. Incluye repetición con versión antigua y repetición al límite/exceso; no afirma que la petición original haya sido quien produjo el estado.
4. Si se necesita transición, versión distinta devuelve 409 `CLIENT_RECORD_CONFLICT`, sin efectos. Así una petición antigua no revierte una reactivación/inactivación posterior ni ignora ediciones HU-017/activación.
5. Una reactivación consumidora sin plaza devuelve 409 `CUPO_AGOTADO`. Repeticiones no se confunden con conflictos de edición o cupo.

Campos desconocidos (incluidos cuenta, propietario o suscripción), estado o versión inválidos: 400 `INVALID_INPUT`. Ajeno/inexistente: mismo 404 `NOT_FOUND`; UUID inválido 400; sin sesión 401; rol cliente/admin, CSRF o elegibilidad no válidos 403 según código. Fallo de persistencia/auditoría: 503 seguro, sin detalles SQL. No se acepta un `version` arbitrario como valor a asignar.

## Transacción, auditoría y versión

Se reutilizan `lockActor` (contexto SQL transaccional), bloqueo de profesional de HU-013, RLS de propiedad y el trigger HU-017. La fila cliente se bloquea antes de auditar/actualizar; no se toma un lock de suscripción antes del cliente, conservando compatibilidad con invitación/activación. La elegibilidad/cupo se consulta bajo el bloqueo profesional que comparten los escritores de suscripción. UPDATE exige ID, profesional y versión, y solo asigna estado. La versión la administra el trigger: cambio efectivo incrementa, no-op no incrementa.

La migración nueva `202610290001_client_record_status_audit.sql` amplía únicamente el CHECK de acciones de `access_events`, conservando todas las siete anteriores. Nuevas acciones: `client_record_activated` y `client_record_inactivated`, distintas de activación de cuenta. Guardan actor, cliente, cuenta vinculada si existe y fecha; no datos personales/físicos, credenciales ni códigos. UPDATE, versión y evento se confirman juntos; si falla INSERT de auditoría, ROLLBACK revierte todo. No se añaden tablas, índices o grants de lectura/escritura; se reutiliza INSERT de auditoría existente. Runtime sigue sin DDL/BYPASSRLS, UPDATE de propietario/vínculo/versión ni SELECT general entre carteras.

## Web e integración

La acción está disponible en cartera y ficha de lectura, fuera del editor de datos base. Consulta estado/versión antes de confirmar, abre diálogo nativo modal etiquetado y enfoca Cancelar. Cancelar/Escape no envían; mientras se envía se evita doble clic/cancelación ambigua. El texto explica que se cambia el expediente, no cuenta ni suscripción.

No hay éxito anticipado ni replay: se usa `sessionMutationOnce` de HU-017. Conflicto obliga a consultar de nuevo y confirmar explícitamente. Red/503 indica resultado incierto y bloquea reenvío hasta consultar; se conserva la intención original. Si la consulta demuestra que el estado deseado ya está aplicado, solo permite actualizar vistas sin PATCH, no invierte la operación. Los errores de negocio no equivalen a logout. El diálogo se cierra mientras la sesión es incierta, conserva su estado solo en memoria y reaparece al validarse la misma cuenta; cambio de cuenta/logout destruyen el componente.

Tras respuesta satisfactoria se refrescan cartera/filtros (primera página con búsqueda/estado/tamaño conservados), ficha si corresponde y resumen de cupo. Si falla únicamente la lectura del cupo, se indica que la transición se confirmó pero el resumen puede estar desactualizado; reintentar actualiza solo ese GET. No se añade almacenamiento sensible persistente ni captura offline.

## DEC-011/015, evidencia y pendientes

DEC-011 fija baja lógica y conservación de relaciones/historial, no plazos legales inventados ni purgas por fecha de entrega. DEC-015 conserva el aviso informativo versionado `2026-10-15.1`, sin convertirlo en política de privacidad completa o renuncia de derechos. Responsable/contacto/finalidades/conservación y mecanismos de derechos requieren definición para datos reales. HU-018 dice expresamente que esas condiciones no bloquean toda preparación técnica de baja lógica: esta entrega usa solo fixtures locales sintéticas y no modifica aceptaciones anteriores.

El esquema todavía no tiene evaluaciones, planes de cliente ni mediciones históricas. Se demuestra conservación de las filas/vínculos/invitaciones/eventos existentes y de su actualización; no se acredita una prueba sobre tablas inexistentes. Ver [evidencia](validacion-local.md) y [recorrido manual pendiente](prueba-web-manual.md). D0.8/revisión independiente, D0.10/recorrido real HU-018 y TT-010 transversal siguen abiertos. No hay uso compartido de Supabase ni autorización de despliegue/merge/push en esta entrega.
