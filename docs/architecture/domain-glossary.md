# Glosario de identidad y acceso

HU-018 exige `status` operativo y `version` en `PATCH /api/clients/{clientId}/status`; devuelve la ficha con versión resultante. `client_record_activated`/`client_record_inactivated` son eventos de expediente, distintos de `account_activated`. No cambia cuenta/suscripción ni revoca sesiones por inactivar. Estado ya actual con versión no futura no genera otra reserva/evento; transición obsoleta devuelve `CLIENT_RECORD_CONFLICT`. [Contrato y matriz](../epicas/ep-03-cartera-y-expediente/hu-018/README.md).

HU-017 agrega `version` entera administrada por BD a `private.clients` y a la ficha `ClientBaseRecord`. `PATCH /api/clients/{clientId}` recibe esa versión como precondición y solo campos base permitidos; no cambia estado/cuenta/propietario ni consume cupo. `CLIENT_RECORD_CONFLICT` indica que se necesita consultar, comparar y reaplicar explícitamente. Listado y cursor no cambian. [Contrato](../epicas/ep-03-cartera-y-expediente/hu-017/README.md).

HU-016 amplía `GET /api/clients` con `search`, `status`, `pageSize`, `cursor` y respuesta `hasClients`, `pageInfo: { pageSize, hasMore, nextCursor }`, conservando `clients`. La búsqueda es literal por `fullName`; el profesional se obtiene de sesión. La ficha auxiliar `GET /api/clients/{clientId}` devuelve `client` con datos base propios, sin propietario/cuenta, edición ni expediente consolidado. `status` filtra el expediente, no el estado de la cuenta. [Contrato y límites de cursor](../epicas/ep-03-cartera-y-expediente/hu-016/README.md).

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

Las respuestas de sesión y perfil usan los campos en inglés: `id`, `userId`, `clientId`, `professionalId`, `username`, `email`, `fullName`, `goal`, `role`, `status`, `clientStatus`, `sessionId`, `accessToken`, `refreshToken` y `expiresAt`. En PostgreSQL, el expediente del cliente vive en `private.clients` con `professional_id`, `user_id`, `user_role`, `full_name`, `goal`, `birth_date`, `height_cm`, `base_weight_kg`, `base_body_fat_percentage`, `waist_cm`, `hip_cm`, `status` y `created_at`. Los roles en JSON son `professional`, `client` y `admin`. Después del despliegue coordinado no se aceptan ni se envían alias en español.
El registro acepta los campos en inglés de esta tabla y `planInterest`/`plan` usan `basic`, `pro` o `elite`. Web devuelve `account` con `id`, `username`, `email`, `fullName`, `role`, `status` y `subscription: null`; la sesión viaja en cookies, no en JSON. Móvil devuelve la cuenta cliente con `clientId` y `clientStatus`, más `session: { accessToken, refreshToken, expiresAt }` al emitir o renovar sesión. `sessionId` es interno (`sid`), no un campo público de `account`. Los perfiles usan los mismos nombres en inglés de cada superficie y los roles `professional`, `client` y `admin`; no se traducen identificadores entre capas.

## Alcance

HU-006–009 añade `subscriptions` (`professional_id`, `plan`, `status`, `expires_at`), `invitations` (`client_id`, `token_hash`), `password_resets` (`user_id`, `issued_by`, `token_hash`) y `access_events` (`actor_id`, `subject_id`, `client_id`, `action`). JSON usa `currentPassword`, `passwordConfirmation`, `code`, `expiresAt`, `invitationExpiresAt`, `identityVerified`, `verificationMethod`, `activated`, `requiresLogin`. Los secretos no son identificadores de expediente ni se conservan tras el canje. [Modelo incremental](../database/modelo-ciclo-acceso.md).

Este glosario cubre el esquema y los contratos de identidad y acceso implementados actualmente. Antes de implementar otros dominios, agrega aquí sus nombres acordados. Las etiquetas, los mensajes, los correos y los textos de accesibilidad que ve la persona usuaria permanecen en español.

## SaaS — HU-010 a HU-014

`saas_plans` conserva `max_clients`, `is_unlimited`, `price_mxn` e `is_active`. `subscriptions.plan_id` referencia el catálogo y sustituye la antigua columna `plan`; `professionals.plan_interest` permanece como interés de registro, independiente de la suscripción contratada. `subscription_history` y `plan_history` conservan actor y estados anteriores/nuevos. JSON usa `planId`, `planName`, `maxClients`, `isUnlimited`, `priceMxn`, `isActive`, `used`, `remaining`, `excess`, `expiresAt`, `clientsUsed`, `inactiveClients` y `subscriptionStatus`. `accountStatus` conserva el estado de la cuenta por separado. Sin suscripción: capacidad 0, nunca ilimitada. [Contrato completo](../epicas/ep-02-saas-y-administracion/README.md).

## Checkout simulado — 25-oct-2026

`simulated_payments`: `professional_id`, `actor_id`, `plan_id`, `idempotency_key`, `plan_snapshot`, `expected_subscription`, `amount_cents`, `status`, `instrument`, `failure_code`, `quote_expires_at`, `processing_after`, `completed_at`, `period_start`, `period_end`. Estados `pending/processing/succeeded/failed/cancelled`. JSON camelCase; `simulated:true` y moneda `MXN`. Se cobra precio completo simulado y se activa mes nuevo; admin solo consulta suscripciones. [Contrato](../epicas/ep-02-saas-y-administracion/README.md).

## Cartera y expediente — HU-015

HU-020 añade `GET /api/me/record`, `{ record }`, proyección propia de perfil base con medidas iniciales y username/email, sin userId/professionalId ni versión de escritura. El vínculo se deriva de sesión y RLS. El endpoint anterior `/api/client/profile` conserva su contrato. DEC-009 mantiene consulta base; grasa medida base/cintura/cadera iniciales no son progreso, evaluación calculada ni eventos históricos. No existe aún una proyección de progreso HU-036; no se serializa como array vacío. [Contrato y límites](../epicas/ep-03-cartera-y-expediente/hu-020/README.md).

`private.clients` es el expediente único de cada cliente dentro de la cartera de su profesional. El alta HTTP usa `fullName`, `goal`, `birthDate`, `heightCm`, `baseWeightKg`, `baseBodyFatPercentage`, `waistCm` y `hipCm`; los nombres SQL correspondientes usan `snake_case`. `birthDate`, `heightCm` y `baseWeightKg` son requeridos para una alta nueva; `goal`, `baseBodyFatPercentage`, `waistCm` y `hipCm` son opcionales. Los prefijos `base` distinguen peso y grasa capturados al alta de futuras evaluaciones o registros históricos. No existe `professionalId` en el contrato de alta: el profesional se deriva de la sesión autenticada. Las filas anteriores a HU-015 pueden conservar los nuevos campos en `NULL` y no se consideran completas por ello.

Catálogo compartido: `professionals.plan_interest_id` / JSON `planInterestId` conserva el UUID del plan de interés, separado de suscripción y del antiguo `plan_interest`. `GET /api/plans` publica solo `id,name,maxClients,isUnlimited,priceMxn` de planes disponibles, sin información de cuentas o suscripciones.
