# Glosario de identidad y acceso

Este glosario es la referencia acordada para los nombres de identidad y acceso. Los identificadores de base de datos usan `snake_case` en inglés; los campos de TypeScript, JavaScript, Dart y JSON usan `camelCase` en inglés; los tipos y componentes usan `PascalCase` en inglés. El español se conserva en los textos que ve la persona usuaria.

## Objetos y campos de base de datos

| Nombre histórico retirado | Nombre vigente en inglés |
| --------------------- | -------------------- |
| `privado`             | `private`            |
| `usuarios`            | `users`              |
| `profesionales`       | `professionals`      |
| `aceptaciones_avisos` | `notice_acceptances` |
| `sesiones`            | `sessions`           |
| `tokens_renovacion`   | `refresh_tokens`     |
| `usuario`             | `username`           |
| `correo`              | `email`              |
| `hash_contrasena`     | `password_hash`      |
| `rol`                 | `role`               |
| `estado`              | `status`             |
| `creado_en`           | `created_at`         |
| `usuario_id`          | `user_id`            |
| `rol_usuario`         | `user_role`          |
| `nombre_completo`     | `full_name`          |
| `telefono`            | `phone`              |
| `plan_interes`        | `plan_interest`      |
| `version`             | `version`            |
| `aceptado_en`         | `accepted_at`        |
| `expira_en`           | `expires_at`         |
| `revocado_en`         | `revoked_at`         |
| `hash_token`          | `token_hash`         |
| `sesion_id`           | `session_id`         |
| `usado_en`            | `used_at`            |

Las restricciones, los índices, las políticas, los roles SQL y las funciones SQL usan nombres en inglés `snake_case` que describen el objeto y su propósito. La migración renombra las claves primarias y foráneas, las restricciones únicas y de validación, los índices y las políticas sin cambiar su función.

## Valores

| Valor histórico retirado | Valor vigente en inglés |
| ------------------------ | ------------------------- |
| rol `profesional`        | `professional`            |
| rol `administrador`      | `admin`                   |
| rol `cliente`            | `client`                  |
| estado `activo`          | `active`                  |
| estado `inactivo`        | `inactive`                |
| plan `basico`            | `basic`                   |
| `couchone_registro`      | `couchone_registration`   |
| `couchone_autenticacion` | `couchone_authentication` |
| `couchone_provision`     | `couchone_provision`      |

El rol público `admin` coincide con el contrato de autorización que ya usa API y Web. El campo `user_role` del perfil profesional conserva el valor `professional`. Los planes `pro` y `elite` no cambian.

## Contrato JSON de registro

| Campo histórico retirado | Campo vigente en inglés | Significado                                        |
| ------------------------ | ---------------------- | -------------------------------------------------- |
| `nombreCompleto`         | `fullName`             | Nombre completo de la persona profesional          |
| `usuario`                | `username`             | Nombre de usuario de la cuenta                     |
| `correo`                 | `email`                | Correo de la cuenta                                |
| `confirmacionCorreo`     | `emailConfirmation`    | Confirmación del correo                            |
| `contrasena`             | `password`             | Contraseña                                         |
| `confirmacionContrasena` | `passwordConfirmation` | Confirmación de la contraseña                      |
| `telefono`               | `phone`                | Teléfono opcional                                  |
| `planInteres`            | `planInterest`         | Plan solicitado opcional (`basic`, `pro`, `elite`) |
| `avisoVersion`           | `noticeVersion`        | Versión del aviso aceptado                         |
| `aceptaAviso`            | `acceptsNotice`        | Casilla de aceptación del aviso                    |

Las respuestas de sesión y perfil usan los campos en inglés: `id`, `userId`, `clientId`, `professionalId`, `username`, `email`, `fullName`, `goal`, `role`, `status`, `clientStatus`, `sessionId`, `accessToken`, `refreshToken` y `expiresAt`. En PostgreSQL, el expediente del cliente vive en `private.clients` con `professional_id`, `user_id`, `user_role`, `full_name`, `goal`, `status` y `created_at`. Los roles en JSON son `professional`, `client` y `admin`. Después del despliegue coordinado no se aceptan ni se envían alias en español.
El registro acepta los campos en inglés de esta tabla y `planInterest`/`plan` usan `basic`, `pro` o `elite`. Web devuelve `account` con `id`, `username`, `email`, `fullName`, `role`, `status` y `subscription: null`; la sesión viaja en cookies, no en JSON. Móvil devuelve la cuenta cliente con `clientId` y `clientStatus`, más `session: { accessToken, refreshToken, expiresAt }` al emitir o renovar sesión. `sessionId` es interno (`sid`), no un campo público de `account`. Los perfiles usan los mismos nombres en inglés de cada superficie y los roles `professional`, `client` y `admin`; no se traducen identificadores entre capas.

## Alcance

HU-006–009 añade `subscriptions` (`professional_id`, `plan`, `status`, `expires_at`), `invitations` (`client_id`, `token_hash`), `password_resets` (`user_id`, `issued_by`, `token_hash`) y `access_events` (`actor_id`, `subject_id`, `client_id`, `action`). JSON usa `currentPassword`, `passwordConfirmation`, `code`, `expiresAt`, `invitationExpiresAt`, `identityVerified`, `verificationMethod`, `activated`, `requiresLogin`. Los secretos no son identificadores de expediente ni se conservan tras el canje. [Modelo incremental](../database/modelo-ciclo-acceso.md).

Este glosario cubre el esquema y los contratos de identidad y acceso implementados actualmente. Antes de implementar otros dominios, agrega aquí sus nombres acordados. Las etiquetas, los mensajes, los correos y los textos de accesibilidad que ve la persona usuaria permanecen en español.
