# HU-008 — Activar la cuenta móvil y vincularla atómicamente

Como cliente invitado quiero registrar credenciales y código para acceder al expediente existente sin recapturar mis datos físicos. Referencias: RC01, RDC0102/0103/0104/0106, RS08, DEC-001/002/003/004/015. Responsable del backlog: Ferxxo; colaboración prevista en el plan: Franela Whaite. Contrastes independientes de Omar/Pukzil aún requieren revisión real.

## Contrato anónimo

`POST /api/auth/activation` sin login previo. JSON estricto: `username`, `email`, `emailConfirmation`, `password`, `passwordConfirmation`, `code`, `noticeVersion`, `acceptsNotice`. Rechaza campos extra como nombre, peso, rol, identidad o segundo expediente. Validaciones de usuario/correo/contraseña idénticas a DEC-001; aviso `2026-10-15.1` y booleano `true` obligatorios.

Respuesta normal: `201 { activated: true, account, session: { accessToken, refreshToken, expiresAt } }`, usando el mismo contrato móvil del login de HU-004. `account.clientId` es el expediente preexistente. No retorna contraseñas ni hashes. Privados y respuestas de activación usan `Cache-Control: no-store`.

Si falla emitir la sesión **después del COMMIT**, responde `201 { activated: true, requiresLogin: true, message }`: la cuenta ya existe correctamente, se informa reingreso y no se repite el canje. La aplicación vuelve al acceso con las credenciales recién creadas. Este caso está probado con fallo de creación de sesión.

## Una conexión, una transacción

1. Valida DTO y calcula Argon2id; consulta el hash SHA-256 del código para localizar el expediente sin exponerlo.
2. En una conexión `PoolClient`, bloquea expediente → cuenta profesional → suscripción → invitación, revalidando estados y expiración de servidor.
3. Inserta un único `users` de rol `client`, vincula con `UPDATE clients ... WHERE user_id IS NULL` y exige exactamente una fila.
4. Inserta la aceptación versionada y su fecha; elimina físicamente la invitación/hash; exige una fila eliminada.
5. Inserta el evento seguro `account_activated`; COMMIT. Cualquier fallo anterior revierte cuenta, vínculo, aceptación y DELETE.
6. Solo tras COMMIT emite sesión mediante el login existente. No reserva segundo cupo ni crea segundo expediente.

Los canjes concurrentes se serializan por expediente. Quien pierde la carrera encuentra el vínculo ocupado/código eliminado; replay falla. El reemplazo y la revocación usan el mismo bloqueo del expediente. La unicidad de usuarios/correos se impone además en BD. Igualdad en TTL invalida; prevalidación nunca evita revalidar al canjear.

## Recorrido móvil

Login → «Activar mi cuenta». Código, usuario, correo/confirmación, clave/confirmación y texto informativo versionado con casilla. «Comprobar código sin consumirlo» consulta el endpoint mínimo de HU-007. Validación local de campos y confirmaciones; servidor autoritativo. Indicador de envío, doble envío bloqueado, errores recuperables. Con sesión válida se guarda en almacenamiento seguro y consulta el expediente propio; no hay recaptura de nombre/peso base. Una activación confirmada sin sesión conduce a login. No se guardan contraseña/código en almacenamiento local.

## Errores y evidencia

`400 INVALID_INPUT`: datos/confirmaciones/aviso/código mal formado; `400 INVITATION_UNAVAILABLE`: vencido, usado, revocado, reemplazado o estados incompatibles; `409 IDENTIFIER_UNAVAILABLE`: usuario/correo ocupado; `429` límite antes de hash; `503` fallo previo al commit. Todos mantienen el código en rollback. La API no devuelve expediente previo a autenticar.

`apps/api/tests/account-lifecycle.test.ts`: dos solicitudes concurrentes reales, duplicados, expiración exacta, estados, última plaza reservada, replay, aceptación persistida, comparación de expediente, cero temporales tras éxito y fallos inyectados en INSERT usuario, UPDATE vínculo, INSERT aceptación, DELETE invitación e INSERT auditoría. Se ejecutan consultas HTTP contra PostgreSQL con rol runtime restringido. Flutter verifica DTO completo, confirmaciones, aviso, prevalidación, bloqueo de envío y reintento.

[Modelo de datos](../../../database/modelo-ciclo-acceso.md), [OpenAPI](../../../api/identity-lifecycle.openapi.json), [estado y evidencia D0](../evidencia-hu-006-009.md). No se acredita revisión de otros integrantes, publicación ni aprobación legal con las pruebas locales.
