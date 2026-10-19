# HU-005 — Cerrar sesión, expirar y renovar de forma segura

Control del ciclo completo de sesión común para Web y móvil (`DEC-002`, `DEC-004`, `TT-004`, `RDF0103`, `RS05`, `RS07`). Toda operación autenticada con JWT verifica el estado persistido de la sesión (`sid`) y de la cuenta (`private.users.status = 'active'`); revocar únicamente el refresh token no basta para el cierre inmediato.

## Estado

Implementada y verificada localmente en base de datos, API, Web y Móvil. Revisión independiente y despliegue pendientes.

## Contrato y reglas de seguridad

| Superficie | Operación | Transporte | Reglas de ciclo de sesión |
| --- | --- | --- | --- |
| Web (`professional`, `admin`) | `POST /api/auth/refresh` | Cookie `cof_refresh` (`HttpOnly`, `Path=/api/auth`) + `Origin` + `X-CSRF-Token` | Rota `refresh_tokens` con bloqueo `FOR UPDATE OF s, t`; conserva `expires_at` absoluto de 30 días desde el login; acota `exp` del JWT al menor entre 15 minutos y `expires_at`; si el token ya fue usado (`used_at IS NOT NULL`) o la sesión/cuenta no es válida, revoca toda la familia (`revoked_at` + consumo de tokens pendientes), limpia cookies y devuelve `401 SESSION_REQUIRED`. |
| Web (`professional`, `admin`) | `POST /api/auth/logout` | Cookies `cof_refresh` / `cof_access` + `Origin` + `X-CSRF-Token` | Revoca `private.sessions.revoked_at`, consume los `refresh_tokens` activos de la familia y además revoca `sid` del JWT `cof_access` vigente; limpia cookies `cof_access` y `cof_refresh` y responde `204`. |
| Móvil (`client`) | `POST /api/auth/client/refresh` | JSON `{ "refreshToken" }` | Rota el refresh token de un solo uso conservando `expires_at` de 30 días; ante replay (`used_at IS NOT NULL`) o cuenta inactiva revoca la sesión completa y sus tokens pendientes devolviendo `401 SESSION_REQUIRED`. |
| Móvil (`client`) | `POST /api/auth/client/logout` | `Authorization: Bearer <accessToken>` + JSON `{ "refreshToken" }` | Revoca la sesión por `refreshToken` y por `sid` del `Bearer` token; responde `204`. El cliente móvil solo borra `SessionStorage` tras confirmación del servidor (`204`/`401`); un fallo de red (`503`) conserva la sesión local y muestra alerta para reintentar. |
| Común (Web y Móvil) | `GET /api/auth/session`, `/api/professional/*`, `/api/admin/*`, `/api/client/*` | Cookie `cof_access` o `Authorization: Bearer` | Verifica firma `HS256`, `iss = couchonefit-api`, `aud = couchonefit-web`, `sub`, `sid`, `iat`, `exp` (`maxTokenAge = 15m`) y comprueba en PostgreSQL `s.revoked_at IS NULL`, `s.expires_at > now` y `u.status = 'active'`. Si la sesión o cuenta no es válida, revoca las sesiones abiertas correspondientes y devuelve `401 SESSION_REQUIRED`. |

## Estado de cuenta y revocación en base de datos (`HU-005-BD1`)

- **Vencimiento absoluto de 30 días (`DEC-002`):** `private.sessions.expires_at` se fija en `created_at + interval '30 days'` al iniciar sesión y nunca se extiende al rotar `private.refresh_tokens`.
- **Inactivación de cuentas (`setAccountStatus` / `updateAccountStatus`):**
  - Al pasar `private.users.status` a `'inactive'`, se revocan atómicamente todas las sesiones activas (`revoked_at`) y se marcan consumidos todos los `refresh_tokens` pendientes del usuario.
  - Desactivar una cuenta `professional` revoca sus sesiones sin desactivar en cascada los expedientes `private.clients` ni las cuentas `client` vinculadas (`TT-004-5`).
  - Reactivar una cuenta (`status = 'active'`) nunca revive sesiones ni refresh tokens revocados previamente; requiere nuevo inicio de sesión.
  - Se impide desactivar la última cuenta `admin` activa con `409 LAST_ADMIN_PROTECTED` (`DEC-004`).

## Clientes Web y Móvil (`HU-005-WEB1` y `HU-005-MOV1`)

- **Web (`apps/web/src/features/auth/services/session.ts`, `ProfessionalPage.tsx`, `AdminPage.tsx`):**
  - Serializa la renovación ante `401` mediante `navigator.locks` (`couchonefit-refresh`) y promesa compartida en memoria (`refreshPromise`).
  - Espera cualquier renovación en vuelo antes de ejecutar `POST /api/auth/logout`.
  - Si `logout()` falla por red (`503`/`0`), no limpia estado ni redirige a `/acceso?motivo=salida`, mostrando mensaje de error en el panel.
  - Al confirmarse el cierre o recibir `401`/`403` definitivo, ejecuta `clearSessionState()`: limpia promesas en memoria, `sessionStorage`, claves sensibles de `localStorage` (conservando únicamente `cof-theme`), entradas privadas `/api/` en `window.caches` y notifica a otras pestañas abiertas mediante `BroadcastChannel('couchonefit-session')`.
- **Móvil (`apps/mobile/lib/shared/services/api_client.dart`, `auth_service.dart`, `client_session_gate.dart`, `client_profile_screen.dart`):**
  - Serializa renovaciones concurrentes con `_refreshInFlight` y valida localmente `expiresAt` frente al reloj inyectable antes de usar o guardar la sesión.
  - Espera cualquier renovación en curso antes de invocar `POST /api/auth/client/logout` enviando tanto `Authorization: Bearer` como `refreshToken`.
  - Solo limpia `SessionStorage` y regresa a `LoginScreen` cuando el servidor confirma el cierre (`204` o `401`). Ante fallo de red (`503`), mantiene la vista activa y muestra el aviso `'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.'`.

