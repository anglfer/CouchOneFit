# Plan de implementación — HU-005

## Objetivo

Completar el control seguro del ciclo de sesión en Web, móvil, API y PostgreSQL (`HU-005`), garantizando revocación inmediata en servidor al cerrar sesión o inactivar cuentas, rotación de refresh tokens de un solo uso con detección de replay, vencimiento absoluto a los 30 días desde el login y limpieza de estado/almacenamiento sensible en clientes únicamente cuando el servidor confirma el cierre o la invalidación.

## Tareas y entregables

| Tarea | Resultado implementado |
| --- | --- |
| `HU-005-BD1` | Gestión de estado, revocación (`revoked_at`, `used_at`) y TTL absoluto de 30 días en `private.sessions` y `private.refresh_tokens`; helpers transaccionales `revokeUserSessions` y `updateAccountStatus` con protección del último `admin` activo (`DEC-004`) y sin desactivación en cascada de clientes vinculados al inactivar un profesional (`TT-004-5`). |
| `HU-005-API1` | Validación de firma `HS256`, `iss`, `aud`, `sub`, `sid` y `exp` (acotado a `min(15m, session.expiresAt)`) y verificación en BD de `sid` + `users.status = 'active'` en cada operación JWT; revocación combinada de `refresh` y `access` en `logoutAccount`; limpieza de cookies en `401` y soporte de reloj inyectable (`now`) en `createApp`. |
| `HU-005-WEB1` | Acción de cierre con espera de refresh en curso, protección CSRF + `Origin`, `clearSessionState()` (memoria, `sessionStorage`, `localStorage` sensible, caché privada `/api/` en `window.caches` y sincronización entre pestañas con `BroadcastChannel`) y preservación de sesión activa si el logout falla por red. |
| `HU-005-MOV1` | `logoutSession()` en `ApiClient` que espera `_refreshInFlight`, envía `Bearer` + `refreshToken` a `POST /api/auth/client/logout`, valida `expiresAt` local y evita borrar `SessionStorage` o acreditar logout cuando hay fallo de red, mostrando alerta en `ClientProfileScreen`. |
| `HU-005-QA1` | Suite `apps/api/tests/session-lifecycle.test.ts` (reloj controlado a 15m y 30d, replay tras logout y tras rotación, inactivación de cuentas, protección del último `admin`, concurrencia) y pruebas en `apps/mobile/test/client_login_test.dart` (fallo de red en logout, confirmación posterior, serialización de 401 concurrentes y caducidad absoluta de 30 días). |

## Verificación

- `npm --prefix apps/api run build` y `npm --prefix apps/api test`
- `npm --prefix apps/web run lint` y `npm --prefix apps/web run build`
- `flutter analyze` y `flutter test` en `apps/mobile`

