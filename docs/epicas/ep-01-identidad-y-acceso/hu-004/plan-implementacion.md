# HU-004 — Acceder posteriormente como cliente

Implementar el inicio de sesión móvil posterior a la activación para cuentas con rol `client` vinculadas a un expediente en PostgreSQL, conforme a `DEC-001`, `DEC-002`, `DEC-003` y `DEC-004`.

## Alcance y comprobación

- [x] **BD (`HU-004-BD`):** Migración incremental `202610190002_client_records.sql` para `private.clients` con relación al profesional (`professional_id`), cuenta de usuario opcional única (`user_id` `0..1` antes de activar, `1` después), restricción de rol `user_role = 'client'` referenciando `private.users(id, role)`, `full_name`, `goal`, `status` operativo (`active`/`inactive`), RLS y permisos `SELECT` para `couchone_authentication`. Actualizar instantánea `docs/database/schemas/identity_access.sql`.
- [x] **API (`HU-004-API1`):** Reutilizar validación, Argon2id, sesiones de 30 días absolutos y rotación/revocación de refresh tokens para el rol `client` con transporte Bearer móvil (`POST /api/auth/client/login`, `POST /api/auth/client/refresh`, `POST /api/auth/client/logout`, `GET /api/auth/session`) y consulta propia del expediente (`GET /api/client/profile`), manteniendo bloqueado el acceso de `client` en el login Web por cookies.
- [x] **Autorización y aislamiento (`TT-010`):** Middleware `requireClient`, rechazo `403 ROLE_FORBIDDEN` para `professional` y `admin` en rutas de cliente y para `client` en rutas profesionales/administrativas; revocación inmediata en BD si la cuenta pasa a `inactive` o la sesión no es válida.
- [x] **Móvil (`HU-004-MOV1`, `HU-004-MOV2`):** Cliente HTTP con soporte Bearer y renovación serializada ante `401`, almacenamiento seguro de sesión sin guardar contraseñas, guardia de arranque (`ClientSessionGate`), pantalla de login sin solicitar código de activación (`LoginScreen`) y vista de expediente propio de solo lectura (`ClientProfileScreen`).
- [x] **Pruebas (`HU-004-QA1`):** Suite `apps/api/tests/client-login.test.ts` (fixture vinculado, flujo post-activación tras consumir invitación, credenciales inválidas, cuenta sin expediente, cuenta inactiva, aislamiento entre roles, replay de refresh, logout y rol restringido `couchone_authentication`) + pruebas de widgets y flujo en `apps/mobile/test/`.
- [x] **Documentación:** `docs/epicas/ep-01-identidad-y-acceso/hu-004/README.md`, actualización de índice de épica, modelo de identidad y glosario.
