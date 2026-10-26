# HU-004 — Acceder posteriormente como cliente

**Responsable:** Ferxxo. **Capas:** API, Móvil, BD. **Referencias:** RC01, acuerdos de dominio, RS05/07. **Depende de:** TT-004/010 y cuenta vinculada (fixture para desarrollo; flujo de invitación en HU-008). **Bloquea a:** consultas/registros cliente.

## Propósito y alcance

Permitir que una persona cliente cuya cuenta ya fue activada y vinculada a su expediente (`private.clients.user_id`) inicie sesión posteriormente desde la aplicación móvil con su usuario o correo y contraseña, recupere su sesión de forma segura al reiniciar la app y acceda a su expediente sin reutilizar ni volver a solicitar un código de invitación.

## Persistencia y migración

Migración incremental: [`202610190002_client_records.sql`](../../../database/migrations/202610190002_client_records.sql) y actualización del [esquema integrado](../../../database/schemas/identity_access.sql).

- Tabla `private.clients`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `professional_id uuid NOT NULL REFERENCES private.professionals(id) ON DELETE RESTRICT`
  - `user_id uuid UNIQUE` (nulo mientras la invitación de HU-008 no se haya consumido; único una vez vinculado). Su relación con usuarios se impone mediante la FK compuesta siguiente, no mediante una segunda FK simple.
  - `user_role text NOT NULL DEFAULT 'client'` con restricción `ck_clients_user_role` (`user_role = 'client'`) y llave foránea `fk_clients_user_role` compuesta `(user_id, user_role) -> private.users(id, role) ON DELETE RESTRICT`, impidiendo que una cuenta `professional` o `admin` se vincule a un expediente de cliente
  - `full_name text NOT NULL`, `goal text`, `status text NOT NULL DEFAULT 'active'` (`active` | `inactive`), `created_at timestamptz NOT NULL DEFAULT now()`
- Seguridad en PostgreSQL:
  - RLS activa en `private.clients` (`ENABLE ROW LEVEL SECURITY`)
  - `GRANT SELECT ON private.clients TO couchone_authentication` con política `select_clients USING (true)` para el rol técnico privado. `user_role` y longitud de `full_name` se validan con restricciones de tabla, no con esa política. La API verifica sesión/rol y el repositorio filtra por identidad y vínculo para devolver solo el expediente propio. Esta política no acredita aislamiento frente a quien posea la conexión técnica del servidor.

## Contrato HTTP

Todos los endpoints de autenticación y perfil responden con `Cache-Control: no-store`.

| Método y ruta | Autenticación | Propósito | Respuesta de éxito |
| --- | --- | --- | --- |
| `POST /api/auth/client/login` | Pública (`limiter(20)`) | Autenticar cuenta `client` activa y vinculada a `private.clients` usando `{ identifier, password }`. Rechaza con `400 INVALID_LOGIN` cualquier campo adicional (`code`, `invitationCode`, `role`). | `200 { account, session: { accessToken, refreshToken, expiresAt } }` |
| `POST /api/auth/client/refresh` | Pública (`limiter(100)`) | Rotar `refreshToken` de sesión cliente activa y vinculada. La reutilización de un token ya consumido revoca toda la familia de sesión (`401 SESSION_REQUIRED`). | `200 { account, session: { accessToken, refreshToken, expiresAt } }` |
| `POST /api/auth/client/logout` | `refreshToken` y/o `Bearer` | Revocar sesión móvil de forma inmediata e idempotente. | `204 No Content` |
| `GET /api/auth/session` | Cookie Web o `Bearer` | Revalidar identidad activa (`professional`, `admin` o `client` vinculado). | `200 { account }` |
| `GET /api/client/profile` | `requireClient` (`Bearer` o sesión) | Consultar el expediente vinculado del cliente autenticado. | `200 { profile }` |

### Matriz de aislamiento por rol y superficie

| Identidad / Estado | `POST /api/auth/client/login` | `POST /api/auth/login` (Web) | `GET /api/client/profile` | `GET /api/professional/profile` | `GET /api/admin/session` |
| --- | --- | --- | --- | --- | --- |
| Cliente activo y vinculado | `200` | `401` | `200` | `403 ROLE_FORBIDDEN` (`Bearer`) / `401` (`Cookie`) | `403 ROLE_FORBIDDEN` (`Bearer`) / `401` (`Cookie`) |
| Cliente sin vínculo en `private.clients` | `401 INVALID_CREDENTIALS` | `401` | `401` | `401` | `401` |
| Cliente `inactive` o sesión revocada | `401 INVALID_CREDENTIALS` | `401` | `401 SESSION_REQUIRED` (revoca sesión) | `401` | `401` |
| Profesional activo | `401 INVALID_CREDENTIALS` | `200` | `403 ROLE_FORBIDDEN` | `200` | `403 ROLE_FORBIDDEN` |
| Administrador activo | `401 INVALID_CREDENTIALS` | `200` | `403 ROLE_FORBIDDEN` | `403 ROLE_FORBIDDEN` | `200` |

## Aplicación móvil (`apps/mobile`)

- `lib/features/auth/models/session_models.dart`: modelos `ClientAccount`, `StoredSession`, `ClientLoginResult` y excepción tipada `AuthApiException`.
- `lib/features/auth/services/session_storage.dart`: abstracción `SessionStorage` con implementación `MethodChannelSessionStorage` (`couchonefit/secure_session`) y respaldo en memoria `InMemorySessionStorage`. Guarda exclusivamente `accessToken`, `refreshToken` y `expiresAt`; nunca almacena la contraseña ni códigos de activación.
- `lib/shared/services/api_client.dart`: cliente HTTP con inyección de `Authorization: Bearer <accessToken>` y rotación serializada de un solo vuelo (`_refreshInFlight`) ante `401`. Limpia la sesión ante `401` definitivo o `403 ROLE_FORBIDDEN`; un rechazo de negocio o reautenticación no equivale a sesión inválida. Un error de servidor durante renovación se propaga sin acreditar logout; el cierre confirmado sigue HU-005.
- `lib/features/auth/services/auth_service.dart`, `lib/features/auth/widgets/login_form.dart` y `lib/features/auth/screens/login_screen.dart`: pantalla de acceso para clientes activados sin solicitar código de invitación.
- `lib/features/client/models/client_profile.dart`, `lib/features/client/services/client_profile_service.dart`, `lib/features/client/widgets/client_profile_card.dart` y `lib/features/client/screens/client_profile_screen.dart`: vista del expediente vinculado del cliente con actualización de estado y cierre de sesión.
- `lib/routes/client_session_gate.dart`: restauración automática al iniciar o reiniciar la app, invalidación limpia ante sesiones revocadas o cuentas deshabilitadas y transición hacia el expediente.

## Evidencia de verificación

- **API y Base de Datos (`apps/api`):**
  - `npm run build` sin errores de compilación TypeScript.
  - Suite completa ejecutada contra PostgreSQL 18 local temporal (`tests/migrations.test.ts`, `tests/registration.test.ts`, `tests/login.test.ts`, `tests/admin.test.ts` y `tests/client-login.test.ts`), cubriendo paridad entre migraciones y esquema integrado, flujo post-activación tras vincular un expediente inicialmente sin `user_id`, rechazo `400` de `code`/`invitationCode`/`role` en login, homogeneidad de respuestas `401`, aislamiento cruzado entre roles (`client`, `professional`, `admin`), revocación al desactivar cuenta sin revivir sesión tras reactivar, rotación/replay de `refreshToken`, `logout` y permisos de `couchone_authentication`.
- **Móvil (`apps/mobile`):**
  - `flutter analyze` sin advertencias ni errores.
  - `flutter test` (`test/widget_test.dart` y `test/client_login_test.dart`) verificando inicio de sesión sin pedir código, ausencia de contraseña en almacenamiento persistente, restauración al reiniciar con rotación de `refreshToken`, imposibilidad de recuperar sesiones revocadas al reiniciar y bloqueo de cuentas deshabilitadas o de rol no cliente.

