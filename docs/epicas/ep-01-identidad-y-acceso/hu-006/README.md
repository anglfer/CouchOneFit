# HU-006 — Modificar las credenciales del cliente

Como cliente quiero cambiar usuario y contraseña para administrar mi acceso de forma segura. Referencias: RDC0105, RS06/07/11, DEC-001/002, HU-004/005. Responsable del backlog: Ferxxo.

## Alcance y contrato

`PATCH /api/me/credentials`, autenticación `Authorization: Bearer`, solo rol persistido `client`. JSON estricto: `username`, `currentPassword`, `password`, `passwordConfirmation`. No acepta `userId`, `clientId`, correo, rol ni datos del expediente. Respuesta `204` vacía y `Cache-Control: no-store`.

Usuario ASCII `[a-z0-9._]`, 3–30 caracteres, lower/trim. Contraseña nueva de 15–128 puntos de código Unicode, sin trim ni normalización; confirmación exacta. Argon2id 19 MiB/t2/p1 con salt. La contraseña actual se verifica contra el hash bajo bloqueo de cuenta; no basta una sesión abierta. El formulario cambia usuario y contraseña juntos; para conservar el usuario se introduce el mismo.

La concreción de reautenticación de este incremento exige contraseña actual y revoca **todas** las sesiones, incluida la actual, al modificar credenciales. También cancela recuperaciones pendientes. Reingreso obligatorio con las nuevas credenciales. El acceso y el refresh anteriores dejan de servir inmediatamente. La actualización, la revocación y el evento `credentials_changed` comparten transacción.

## Recorrido móvil

Desde el expediente propio, «Cambiar mis credenciales» abre el formulario con contraseña actual, usuario y nueva clave con confirmación. Valida campos, impide doble envío y presenta errores. Tras `204`, borra almacenamiento seguro y vuelve al login con guía de reingreso. Errores de validación, duplicados, reautenticación o red conservan las credenciales y permiten corregir/reintentar; un rechazo de reautenticación no borra una sesión válida.

## Implementación y persistencia

API: `validators/lifecycle.ts` → `services/lifecycle.changeCredentials` → `repositories/credentials.updateCredentials` y helpers `transaction`, `lockActor`, `context`, `revokeAll`, `audit`. Los servicios validan/coordinan; SQL y transacciones viven en repositorios. Móvil: `AccountAccessScreen`, `AuthService.changeCredentials`, `ClientSessionGate`. SQL: migración `202610190003_account_lifecycle.sql` y esquema integrado.

Se actualizan exclusivamente `users.username` y `users.password_hash`; no cambian email, rol, profesional, datos base, ID de cuenta ni expediente. Los grants limitan el UPDATE a esas dos columnas y RLS requiere el sujeto establecido por la API dentro de la transacción. La unicidad normalizada en BD resuelve también carreras. Auditoría almacena acción, actor, sujeto, expediente y fecha; nunca contraseñas o hashes.

| Error | Resultado |
| --- | --- |
| `400 INVALID_INPUT` | Campos/confirmación inválidos o identidad manipulada; sin cambios. |
| `401 SESSION_REQUIRED` | Sesión ausente, vencida o revocada. |
| `403 ROLE_FORBIDDEN` / `REAUTHENTICATION_FAILED` | Rol incorrecto o contraseña actual incorrecta. |
| `409 IDENTIFIER_UNAVAILABLE` | Usuario ocupado; rollback completo. |
| `429 TOO_MANY_REQUESTS` | Límite por IP antes del hash. |
| `503 SERVICE_UNAVAILABLE` | Error interno seguro; no revela parámetros ni credenciales. |

## Aceptación y evidencia

`apps/api/tests/account-lifecycle.test.ts`: usuario ocupado, clave corta, confirmación incorrecta, contraseña actual errónea, identidad/rol manipulados, acceso con usuario/clave nuevos y rechazo de anteriores; comparación íntegra del expediente antes/después; access/refresh revocados. `apps/mobile/test/account_access_test.dart`: rechazo conserva sesión y éxito la limpia. La suite previa de acceso y ciclo de sesión se mantiene.

Estado: implementación y verificación local; resultados reproducibles en [evidencia conjunta](../evidencia-hu-006-009.md). D0 exige revisión de otro integrante antes de merge; no se atribuye revisión humana ni despliegue remoto a las pruebas locales.
