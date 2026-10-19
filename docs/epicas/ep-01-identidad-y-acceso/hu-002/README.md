# HU-002 — Iniciar sesión como profesional

**Épica:** EP-01. **Responsable:** Ferxxo. **Capas:** Web, API y BD. **Referencias:** RF01, RDF0101/0102, RS01/04/05/06/07/15. **Depende de:** HU-001, TT-004/010 y DEC-004. **Habilita:** cartera, editores profesionales y dashboard; no los implementa por sí misma.

El usuario o correo identifica una sola cuenta normalizada. La API verifica Argon2id, estado activo y rol permitido. HU-003 amplía este login común a administradores, que acceden exclusivamente a su área; cliente no puede usar el login Web. Usuario inexistente, contraseña incorrecta, cuenta inactiva y rol no permitido reciben el mismo 401/mensaje. Se calcula un hash de comparación también para identificadores inexistentes. No se registran credenciales ni se devuelven hashes/tokens en JSON.

## Contrato Web / API

Web llama `/api` por proxy del mismo origen; se mantiene la configuración Vite/Vercel de HU-001. Cookies host-only (sin Domain), HttpOnly, SameSite Strict, Secure en producción; excepción HTTP solo para desarrollo local. API y cliente usan `no-store`; el SW no cachea respuestas de API. El shell público de la SPA puede cargar, pero no muestra información privada sin comprobar sesión en servidor.

| Método/ruta | Uso / respuesta |
| --- | --- |
| `GET /api/auth/csrf` | Cookie CSRF HttpOnly y `{csrfToken}` en respuesta; cliente lo conserva solo en memoria. |
| `POST /api/auth/login` | JSON `{identifier,password}`; 200 `{account}` and session cookies. Role/status fields are rejected. |
| `GET /api/auth/session` | Identidad vigente desde sesión + cuenta + perfil en BD; 401 si no es válida. |
| `POST /api/auth/refresh` | Cookie refresh, rota token y access; 200 `{account}`. Replay revoca la sesión/familia. |
| `POST /api/auth/logout` | Revoca sesión en BD y borra cookies; 204. No confirma éxito ante fallo de red/BD. |
| `GET /api/professional/profile` | Consulta perfil usando exclusivamente la identidad de sesión; ignora IDs ajenos de query. Todas las rutas `/api/professional/*` pasan por el guard. |

Login/refresh/logout requieren `Origin` exacto de `CORS_ORIGIN` y cabecera `X-CSRF-Token` coincidente con cookie. No hay CORS cross-origin ni tokens de sesión en `localStorage`/`sessionStorage`. El formulario de registro conserva su contrato anónimo HU-001.

Access JWT HS256: `iss=couchonefit-api`, `aud=couchonefit-web`, `sub=account UUID`, `sid=session UUID`, `iat`, `exp` a 15 minutos. Algoritmo y claims obligatorios verificados; el JWT no decide rol ni autorización por sí solo. Cada petición privada consulta cuenta activa, rol persistido, sesión no revocada y vencimiento BD. El profesional requiere perfil vinculado; el administrador no tiene perfil profesional. El perfil vuelve a filtrar por cuenta y sesión, demostrando identidad usada en la consulta.

`cof_access`: HttpOnly, path `/api`, máximo 15 minutos. `cof_refresh`: HttpOnly, path `/api/auth`, vence al límite absoluto de sesión a 30 días desde login. Refresh CSPRNG de 32 bytes/base64url; solo SHA-256 en BD. Los tokens anteriores conservan `usado_en` para detectar replay; la renovación bloquea sesión/token en una sola transacción. Un replay invalida también los access aún vigentes. Dos renovaciones simultáneas con el mismo token producen una renovación y una detección de replay, revocando la familia; Web serializa por promesa y Web Locks entre pestañas cuando están disponibles.

La autorización se evalúa con los datos vigentes en cada consulta. Si se detecta una cuenta inactiva o una sesión no válida, la sesión queda revocada y no revive al reactivar la cuenta. Los futuros handlers de baja/cambio de credenciales deben revocar sus sesiones en su propia transacción, según HU-005/006/011; HU-002 no implementa administración.

## Web

`/acceso`: formulario usuario/correo + contraseña, carga, fallos españoles y enlace de registro. `/app/*` verifica sesión antes de mostrar contenido; sin acceso redirige a `/acceso?motivo=sesion&retorno=...`. El retorno solo permite rutas locales del área del rol (`/app` o `/admin` desde HU-003), rechazando URLs externas, barras invertidas y controles. Una ruta privada desconocida pasa igualmente por el guard y muestra sección no disponible después de autenticar.

`/app/` y `/app/perfil` muestran identidad y perfil consultados en API, más el estado sin plan definido por DEC-004. No hay métricas ni cartera de ejemplo. `subscription:null` refleja que aún no existe asignación de suscripciones, no una consulta a un módulo SaaS implementado. El botón de salida confirma revocación antes de navegar; si falla la conexión lo comunica. La sesión se vuelve a comprobar al regresar al foco/restaurar la página.

Tras 401 en una lectura privada, el cliente intenta renovar una vez y repite únicamente esa lectura. No reintenta escrituras ciegamente. Fallo BD/red no concede acceso ni borra credenciales válidas como si logout hubiera ocurrido. HU-005 conserva la integración de ciclo de sesión con móvil y los demás módulos.

## Persistencia y despliegue

La migración inicial aplicada [`202610150001_inicial_identidad_acceso.sql`](../../../database/migrations/202610150001_inicial_identidad_acceso.sql) creó las tablas originales de sesión. La nueva migración renombra esas tablas como `private.sessions` y `private.refresh_tokens` y conserva sus UUID, marcas de tiempo y hashes.

El rol objetivo `couchone_authentication`, con atributo `NOLOGIN`, hereda permisos de `couchone_registration`. Un usuario dedicado de ejecución recibe `GRANT couchone_authentication TO couchone_api;`. Puede leer cuentas y perfiles y administrar sesiones y tokens de renovación, pero no puede modificar cuentas o roles ni ejecutar DDL. El esquema `private` no se expone mediante Data API. Aplica el cambio coordinado de base de datos, API y Web antes de actualizar el entorno compartido.

`AUTH_JWT_SECRET` obligatorio: secreto aleatorio de al menos 32 bytes, exclusivo de servidor, fuera de Git y de variables VITE. La API rechaza arrancar sin configuración válida; el ejemplo no contiene un secreto. Rotarlo invalida las firmas anteriores y debe coordinarse con revocación de sesiones/refresh. Variables existentes: `DATABASE_URL`, `NODE_ENV`, `CORS_ORIGIN`, `PORT`. En producción configurar Origin Web exacto, HTTPS y cookie forwarding del proxy. No basta con una clave publicable o la URL del proyecto Supabase.

Las migraciones usan la base indicada por `DATABASE_URL`. Nombres locales: `CouchOneFit_dev` para desarrollo y `CouchOneFit_test` para pruebas; proyecto Supabase `CouchOneFit`, conservando el nombre SQL real de su cadena de conexión. Usuario de migraciones separado del runtime. Ver [proceso de BD](../../../database/README.md).

## Protección y límites

Login: 20 intentos/IP/15 min antes de Argon2; CSRF y refresh: 100/IP/15 min. Limitadores por memoria/instancia, sin confiar indiscriminadamente en X-Forwarded-For: tras proxy los clientes pueden compartir límite. Antes de múltiples réplicas, verificar proxies/IP y usar almacén compartido. No se declara protección distribuida ni benchmark de hosting por estas pruebas locales.

Los errores de validación son 400; fallo de identidad/sesión 401; Origin/CSRF 403; límite 429 con Retry-After; infraestructura 503 sin SQL, host o credenciales. Respuestas privadas y errores `no-store`. El bootstrap admin está implementado en [HU-003](../hu-003/README.md). La política de privacidad completa, recuperación, cartera, suscripciones/pagos y despliegue mantienen sus propias tareas.

## Validación

`npm test` en API requiere `TEST_DATABASE_URL` local exclusiva ya migrada. Se ejecutan archivos en serie porque las pruebas de rollback instalan triggers temporales. Tests de registro y sesión incluyen login por ambos identificadores, roles/estados/fallos genéricos, claims manipulados/vencidos, identidad en consulta, baja/revocación, límite absoluto, carreras/replay de refresh, logout, CSRF, rollback y conexión restringida. API `npm run build`; Web `npm run build` y `npm run lint`. La ejecución local no certifica Supabase remoto, cookies en Vercel/Render ni D0/revisión independiente.


### Evidencia de esta entrega

15-oct-2026: 24 tests API/PostgreSQL correctos, ambos builds y lint Web correctos. Navegador Edge verificó entrada directa protegida, acceso por usuario/correo, perfil propio, renovación, dos pestañas, logout incluso con error de red, baja y retorno externo rechazado. Sin errores JS ni overflow en los tamaños comprobados; capturas de acceso/espacio inspeccionadas. Migración aplicada solo a PostgreSQL local temporal; la prueba de persistencia aplica la inicial en una base vacía y compara su catálogo contra el esquema integrado en otra base temporal. No se certifica despliegue ni aplicación remota por estas verificaciones.


## Modelo vigente y mapeo

El esquema original y el objetivo actual están documentados en la [guía del esquema integrado](../../../database/schemas/README.md). Las tablas objetivo son `private.users`, `private.professionals`, `private.notice_acceptances`, `private.sessions` y `private.refresh_tokens`; cada una tiene su propia llave primaria `id`. El historial de migraciones es `migrations.history`. Las llaves foráneas usan `user_id` o `session_id`; el perfil profesional tiene su propio ID y un `user_id` único.

[Modelo de datos](../../../database/modelo-identidad-acceso.md), [convenciones de base de datos](../../../database/convenciones.md) y [glosario](../../../architecture/domain-glossary.md). Los campos SQL y de la aplicación usan el mismo término en inglés, con la convención de escritura propia de cada capa y sin alias de traducción. Las respuestas de perfil distinguen `profile.id` (perfil) de `profile.userId` (cuenta); la API obtiene el ID de la cuenta de la sesión verificada.

Respuesta de sesión/login/refresh:

```json
{"account":{"id":"UUID_DEL_USUARIO","username":"persona","email":"persona@example.com","fullName":"Persona de Ejemplo","role":"professional","status":"active","subscription":null}}
```

Respuesta de perfil:

```json
{"profile":{"id":"UUID_DEL_PERFIL","userId":"UUID_DEL_USUARIO","fullName":"Persona de Ejemplo","phone":null,"username":"persona","email":"persona@example.com"}}
```

Funciones principales: `findLoginAccount` busca credencial; `loginAccount` valida y crea sesión/hash refresh; `authenticate`/`currentSession` comprueban vigencia; `professionalProfile` consulta por identidad; `refreshAccount` rota con bloqueo/replay; `logoutAccount` revoca. Sus parámetros, resultados, consultas y límites transaccionales están detallados en el modelo compartido; no existen funciones SQL/RPC de negocio adicionales.

## Aceptación y tareas

| Tarea | Resultado |
| --- | --- |
| HU-002-API1 | Login por usuario/correo, identidad de sesión y POST /api/auth/login. |
| HU-002-API2 | Rol/estado vigentes y límite de intentos, sin registrar contraseña. |
| HU-002-WEB1 | Formulario, guard /app/*, retorno autorizado y mensajes de caducidad/fallo en español. |
| HU-002-QA1 | Login correcto/incorrecto/inexistente/inactivo, rol cliente/admin, llamada directa privada y sesión usada en consulta. |

Credenciales válidas y cuenta habilitada conceden sesión inequívoca; los negativos no revelan secretos ni conceden acceso. La ruta privada devuelve error seguro sin sesión y el rol cliente no se transforma en profesional. DoD D0: la identidad se utiliza en SQL, no basta con almacenar un token. [Plan de implementación](plan-implementacion.md). La aplicación remota/revisión independiente siguen sin acreditarse por pruebas locales.
