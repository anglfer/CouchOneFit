# HU-017 — Editar perfil, objetivo y medidas base

Responsable: Franela Whaite. Referencias RDF0304/0306 y RDF0401–0403; aceptación y tareas API1/WEB1/QA1 en `plan/PLAN_TRABAJO_V2.md` §HU-017. Depende de HU-015/HU-016 y DEC-006. El [acuerdo vigente de EP-03](../README.md#acuerdo-de-integración-vigente) mantiene una sola rama, `feature/api-client-portfolio`, commits por HU y próximo PR al completar la épica. HU-015 y PR #22 no cambian. R: la persona usuaria confirmó el aviso previo al equipo para los cambios compartidos de HU-017; el agente no verificó ni envió ese aviso.

## Elegibilidad, permisos y alcance

DEC-004 §3.4 establece literalmente: profesional activo sin plan, «Solo perfil/suscripción y panel vacío sin datos de ejemplo; sin operaciones de negocio/invitaciones»; profesional activo con suscripción suspendida, «Solo perfil/suscripción; sin operaciones de negocio». Por ello editar exige profesional activo, sesión válida, propiedad y suscripción vigente. No se deduce del cupo de alta/reactivación: `requireCapacity(..., false)` verifica elegibilidad sin consumir ni exigir plazas. Se puede editar una ficha propia activa o inactiva incluso con exceso de activos. La suscripción vencida conserva el tratamiento existente de suscripción no vigente. Los tests HU-017 de cupo/suscripción prueban cada condición y el conteo invariable.

El endpoint no cambia cuenta, estado, propietario, suscripción ni historial. El esquema vigente no contiene evaluaciones, planes de cliente ni eventos de medidas históricas: no se acredita conservación de tablas inexistentes. Se prueba conservación de los campos no editados, vínculo de cuenta, invitaciones y eventos de acceso existentes, y rollback de toda la fila/versión ante fallo.

## Contrato parcial

`PATCH /api/clients/:clientId`, sesión profesional, Origin permitido y CSRF; respuesta no-store. JSON estricto: `version` entera positiva (máximo 2147483647) y al menos un campo editable. `version` es precondición, nunca valor a asignar. Se devuelve `{ client }` con la misma proyección de ficha de HU-016 más `version`. El GET de ficha también entrega esa versión; listado/cursor conservan contrato y orden.

| Campo | Regla de HU-015/DEC-006 vigente |
| --- | --- |
| `fullName` | Texto recortado, 2–150 puntos de código Unicode. |
| `goal` | Texto recortado 1–500 o NULL. |
| `birthDate` | YYYY-MM-DD, calendario 0001–9999; adulto ≥18 según America/Mexico_City. |
| `heightCm` | Número finito 100–250 cm, 0,1. |
| `baseWeightKg` | Número finito 30–300 kg, 0,1. |
| `baseBodyFatPercentage` | Opcional, número finito 2–60 %, 0,1. |
| `waistCm` / `hipCm` | Opcionales, 40–250 / 50–250 cm, 0,1. |

Omitido conserva. NULL solo borra objetivo/opcionales. Vacío no se convierte en cero: API rechaza texto vacío y números como texto/booleanos; Web convierte opcionales vacíos a NULL. Payload vacío, solo versión, versión inválida o campos desconocidos/manipulados: 400. Al menos un campo presente con valores normalizados iguales: 200 sin UPDATE ni incremento de versión, siempre que la precondición sea vigente.

## Compatibilidad de expedientes anteriores

Las columnas anulables y `ck_clients_initial_measurements_complete` de HU-015 conservan el conjunto nacimiento/estatura/peso enteramente NULL o enteramente presente. El texto general de DEC-006 «birth_date requerida en SQL» no describe esa excepción implementada de conservación. La edición no fabrica valores: nombre, objetivo u opcionales pueden cambiar manteniendo la ausencia real del conjunto heredado. Al suministrar cualquiera de sus tres campos, el resultado combinado exige los tres válidos. Un conjunto ya completo no puede vaciarse. Web avisa de la condición incompleta; no la declara satisfecha por editar otro campo.

Las reglas resueltas de DEC-006 §3.4 prevalecen sobre las propuestas archivadas de §3.5. No se reabren edad/rangos ni se introducen fórmulas o nuevas entradas de captura.

## Versión y concurrencia

La migración nueva `202610280004_client_record_version.sql` agrega versión inicial 1 y un trigger invoker BEFORE INSERT/UPDATE. Compara la fila excluyendo versión: cambio efectivo incrementa; UPDATE sin cambio conserva; INSERT fuerza 1. No hay comparación basada en timestamps o `xmin`. El runtime no recibe UPDATE de versión/propietario/cuenta; solo las ocho columnas de edición, además del permiso de estado existente. RLS de propiedad y SELECT restringido continúan vigentes. El contador entero falla ante agotamiento, nunca vuelve a una versión anterior por wraparound.

El trigger también cubre estado y enlace de activación bajo la función restringida existente. Emitir/revocar invitaciones no cambia la versión si no modifica `clients`. Cambios de cuenta/suscripción se revalidan como elegibilidad en la transacción; no son campos del editor.

La transacción revalida actor/sesión, bloquea profesional, bloquea expediente propio, comprueba elegibilidad sin consumir cupo y compara versión. UPDATE parametrizado exige ID, profesional y versión. No bloquea suscripción antes del expediente: conserva compatibilidad con invitación/activación, que bloquean expediente antes de suscripción. El calendario SQL se fija solo en la transacción. COMMIT precede al éxito; cualquier fallo revierte datos y versión y libera el contexto/conexión.

## Errores y editor

- 400 `INVALID_INPUT`, con `error.fields` cuando corresponde; mismo contrato de errores de HU-015.
- 401 sesión no válida; 403 `ROLE_FORBIDDEN`/`CSRF_INVALID`/`PLAN_REQUIRED`/`SUBSCRIPTION_SUSPENDED`, distinguidos por código.
- 404 `CLIENT_NOT_FOUND`, igual para ajeno e inexistente, sin datos de otro propietario.
- 409 `CLIENT_RECORD_CONFLICT`: no escribe; borrador intacto y Guardar bloqueado hasta consultar y aceptar explícitamente una versión actual.
- 503/red/respuesta perdida: resultado incierto, sin confirmación falsa ni reenvío. Consultar estado actual no modifica borrador ni guarda.

El editor muestra datos existentes y errores por campo. «Consultar estado actual» permite comparar; «Usar esta versión para reaplicar mi borrador» conserva solo los campos editados y actualiza los no editados desde la consulta. Todavía exige otro clic en Guardar. Una nueva carrera vuelve a producir conflicto. Si el estado consultado ya coincide, no hay otro PATCH.

`sessionMutationOnce` reutiliza CSRF y autenticación sin replay. Tras 401 puede renovar sesión, pero pide un nuevo clic; si renovación revela otra cuenta/rol, descarta el estado anterior. Rechazo definitivo, logout/cambio de cuenta destruyen el editor. Fallo transitorio de comprobación mantiene el componente oculto/inert hasta validar la misma cuenta. Los 403 de negocio/CSRF conservan el borrador y no equivalen a sesión revocada. No se almacena información personal/física en localStorage/sessionStorage, cachés o captura offline; no hay autosave ni envío al volver Online.

## Verificación y pendientes

Ver [evidencia local](validacion-local.md) y [recorrido manual](prueba-web-manual.md). El trabajo no acredita observaciones humanas nuevas ni cierre de D0/TT-010 transversal. La revisión independiente y el recorrido HU-017 desde app real siguen pendientes. No hay push autorizado en esta entrega, PR nuevo, merge, despliegue ni operación en Supabase compartido.
