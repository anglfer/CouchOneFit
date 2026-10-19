# HU-009 — Recuperar acceso ante pérdida de sesión/dispositivo

Como cliente o profesional quiero recuperar el acceso para conservar mi cuenta y expediente al perder/cambiar el dispositivo. Recuperación base P1/3 SP según DEC-002; sin SMTP, SMS o alta alternativa. Responsable del backlog: Ferxxo.

## Procedimiento aprobado

La pérdida de sesión/dispositivo se resuelve primero con login normal. Si se olvidó la contraseña: cliente contacta a su profesional; profesional a administración; administrador a otro administrador autorizado. El operador debe corroborar identidad fuera de banda mediante la relación conocida. Saber correo/ID no es prueba. El operador confirma esa corroboración y reintroduce **su propia** contraseña; nunca elige/conoce la nueva clave del titular.

Web `/recuperar` y móvil «Recuperar mi acceso» explican el procedimiento sin consultar ni enumerar cuentas. Permiten introducir el código recibido y una nueva contraseña con confirmación. Errores, carga y éxito/reingreso implementados. El operador usa `/app/recuperacion` o `/admin/recuperacion` con selector restringido de cuentas. El secreto se entrega de forma privada y puede ocultarse; no se guarda en navegador.

## Contratos

| Operación | Entrada/respuesta | Autorización |
| --- | --- | --- |
| `GET /api/accounts/recovery-targets` | `{ accounts: [{ id, username, role }] }` | Sesión. Profesional: clientes propios; admin: profesionales/otros admins activos. Cliente: lista vacía. No es público. |
| `POST /api/accounts/:userId/recovery` | `{ identityVerified: true, verificationMethod: "known_relationship", currentPassword }` → `201 { code, expiresAt }` | Sesión + Origin/CSRF. Profesional solo cliente propio; admin solo profesional/otro admin activo, nunca autorreset por esta ruta. |
| `POST /api/auth/recovery/reset` | `{ code, password, passwordConfirmation }` → `204` | Anónimo; exclusivamente posesión del código entregado tras corroboración. |

Generación CSPRNG 32 bytes/base64url43; tabla separada `private.password_resets`, solo SHA-256, TTL servidor 30 minutos exactos, una vigencia por cuenta. Emitir otro código reemplaza el anterior atómicamente. No se acepta invitación como reset. DTOs estrictos y rate limit por IP.

En una conexión/transacción: bloqueo de cuenta activa, revalidación del hash/TTL, DELETE del reset, UPDATE del hash Argon2id, revocación de **todas** las sesiones y consumo de refresh pendientes, evento `password_reset`, COMMIT. Fallo revierte también consumo/revocación. Replay y dos canjes concurrentes producen como máximo un éxito. No cambia usuario, correo, rol, profesional, cuenta o expediente; no crea vínculos.

Errores: `400 INVALID_INPUT`, `400 RESET_UNAVAILABLE` idéntico para secreto inexistente/vencido/reusado; `403 RECOVERY_FORBIDDEN` sin propiedad/rol; `403 REAUTHENTICATION_FAILED`; `401 SESSION_REQUIRED`; `403 CSRF_INVALID`; `429`; `503` seguro. No hay respuesta pública que confirme existencia de correo/usuario.

## Emergencia del último administrador

`npm run db:recover:admin` es un comando **local de custodia**, sin ruta HTTP. Usa una conexión operadora autorizada, nunca la del runtime. Pide usuario y la frase `IDENTIDAD CORROBORADA` tras verificación fuera de banda. Comprueba privilegio de custodia y que sea exactamente el único admin activo; bloquea cuentas/admins y serializa emergencias. Genera un reset temporal para que el titular fije su contraseña en `/recuperar`. Muestra el código una sola vez para entrega, sin escribir archivo ni bitácora. No redirigir esa salida a logs. Evento `emergency_reset_issued` identifica la cuenta y fecha; la custodia externa debe registrar al operador humano sin guardar el secreto.

No se provisiona custodio, canal de contacto o secreto maestro dentro del código. El responsable del entorno debe custodiar la conexión operadora. La auditoría de emergencia usa `actor_id = NULL` (sin sesión humana autenticada) y `subject_id` del último admin; no atribuye al titular la acción del custodio. El reset referencia esa cuenta en `issued_by` por tratarse de la autorización de emergencia local. Sin corroboración se deniega; el runtime normal no puede ejecutar esta emergencia. Limpieza de vencidos: `npm run db:cleanup:access`, programable diariamente por operaciones.

## Evidencia

HTTP/BD con rol runtime: propietario legítimo y ajeno, falsa corroboración/método email, contraseña de operador errónea, roles, TTL exacto, sustitución, replay, simultaneidad, rollback por auditoría fallida, revocación access/refresh y mismo ID/expediente al reingresar. Comando: runtime rechazado, varios admins rechazados, último admin permitido y código canjeable. Flutter: procedimiento asistido, DTO solo secreto/contraseña/confirmación y reingreso.

[Modelo](../../../database/modelo-ciclo-acceso.md), [OpenAPI](../../../api/identity-lifecycle.openapi.json), [evidencia y límites D0](../evidencia-hu-006-009.md). La corroboración humana es responsabilidad del operador; la casilla no autentica por sí sola la identidad del titular.
