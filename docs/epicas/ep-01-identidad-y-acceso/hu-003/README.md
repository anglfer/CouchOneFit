# HU-003 — Acceso administrativo separado

**Responsable:** Omar. **Capas:** API, Web, BD. **Referencias:** RF10, RDF1004, RS24; DEC-001/002. Implementada y verificada el 16-oct-2026. La revisión independiente y el despliegue de API/Web siguen pendientes para D0.

## Contrato y alcance

Se reutilizan `/api/auth/login`, `/session`, `/refresh`, `/logout` y `/csrf`. Usuario/correo y contraseña son los únicos campos de login; `role`/`rol` se rechazan con 400. La API verifica Argon2id, estado y rol persistidos; no utiliza claims de rol para autorizar. El administrador no necesita ni recibe un perfil profesional. Su `fullName` público usa el usuario como nombre de presentación; no se añade otra tabla de perfiles.

El valor actual `admin` en PostgreSQL se devuelve como `account.role: "admin"`; el profesional conserva `"professional"`. Ambos conservan cookies HttpOnly, SameSite/CSRF, expiración, rotación y revocación existentes. El cliente no puede iniciar sesión Web; su flujo móvil corresponde a HU-004/008.

| Identidad | Sesión común | `/api/admin/*` | `/api/professional/*` |
| --- | --- | --- | --- |
| Sin sesión válida | 401 | 401 | 401 |
| Administrador activo | 200 | Autorizado | 403 |
| Profesional activo | 200 | 403 | Autorizado a su perfil |
| Cliente | Login Web 401 | 401 sin sesión Web | 401 sin sesión Web |

`requireSession` autentica; `requireAdmin` y `requireProfessional` comprueban rol antes de ejecutar handlers. Toda ruta bajo `/api/admin` está protegida, incluso al solicitar una ruta todavía inexistente. `GET /api/admin/session` confirma el acceso y devuelve solo la cuenta actual con `Cache-Control: no-store`. Una sesión autenticada de rol incorrecto recibe 403; la denegación no revoca una sesión válida.

Web comparte `/acceso` y elige el destino a partir del rol devuelto por API. `retorno` solo admite rutas del área correspondiente y del mismo origen; no se acepta un destino de otra área. `/admin/*` tiene layout y navegación propios, revalidación al enfocar/restaurar la página y logout. Profesional en `/admin/*` vuelve a `/app/`; admin en `/app/*` vuelve a `/admin/`, antes de consultar perfil profesional. Rutas administrativas desconocidas muestran sección no disponible dentro del área protegida.

La portada administrativa informa el acceso activo. HU-010/012/014 implementarán la gestión real de profesionales, planes y suscripciones; no se simulan listados ni operaciones en esta HU.

## Provisión controlada y seed

Migración incremental: [`202610160001_provision_administrador.sql`](../../../database/migrations/202610160001_provision_administrador.sql). No modifica la inicial aplicada ni añade tablas. Crea `couchone_provision` NOLOGIN, sin DDL, BYPASSRLS, membresías heredadas, UPDATE o DELETE. Solo puede leer identificadores/rol/estado e insertar las columnas necesarias de usuarios. RLS limita lectura e inserción a administradores activos. No puede consultar hashes, crear perfiles profesionales ni conceder suscripciones. Nunca conceder este rol a la API, a registro, a roles públicos ni al navegador.

Seed versionada: [`scripts/seed-admin.ts`](../../../../apps/api/scripts/seed-admin.ts). Ejecutar desde `apps/api`:

1. Aplicar migraciones con el operador mediante `npm run db:migrate`.
2. Usar `DATABASE_URL` de operador ya configurada. El script pide usuario y correo por consola y los normaliza. No usa variables `ADMIN_*` ni lee `.env.admin`.
3. El operador debe poder asumir `couchone_provision`. En PostgreSQL con membresía sin `SET`, un administrador autorizado habilita temporalmente `GRANT couchone_provision TO nombre_operador WITH SET TRUE`, y restaura `SET FALSE` al finalizar si ese era el estado previo. No se concede a un usuario runtime ni se ejecuta este GRANT desde la seed.
4. Ejecutar manualmente `npm run db:seed:admin` y responder usuario/correo. Genera una contraseña aleatoria de 32 bytes, usa una transacción, bloqueo de provisión y `SET LOCAL ROLE couchone_provision`; la BD guarda únicamente el hash Argon2id. Tras COMMIT muestra la contraseña una vez en consola: guardarla en el gestor de contraseñas. No crea archivos de credenciales.
5. Es una seed de creación de un solo uso por cuenta. Repetir con los mismos identificadores falla por unicidad sin modificar la cuenta ni revelar otra contraseña. Identificadores ocupados por otro rol también fallan sin elevar cuentas. Cambiar contraseña o reactivar cuentas requiere un procedimiento separado.

La seed no corre al iniciar API ni con el registro público. No existe endpoint de autoalta admin, contraseña versionada o cuenta maestra en el código. Tras la migración coordinada, el runtime conserva solo `couchone_authentication` y no puede insertar admins ni actualizar roles.

## Evidencia

- Entrega inicial: 28 pruebas API/PostgreSQL local correctas, incluyendo registro/login, permisos y comparación entre migraciones y esquema integrado. Tras el ajuste a ejecución manual se reejecutaron las cuatro pruebas de administración: matriz de roles, payload/JWT manipulado, ciclo de sesión y seed manual con contraseña verificable, rechazo de repetición sin cambio de hash, conflicto con profesional, datos faltantes y denegación al runtime. Todas pasaron. Cluster temporal local; suite destructiva nunca ejecutada contra Supabase.
- API y Web compilan; lint Web sin errores. El asesor de seguridad de Supabase no reportó avisos.
- Evidencia remota histórica: la migración administrativa se aplicó en `pcoyrxdeiigynmmpxtng` y se registró en la tabla anterior `migraciones.historial`. La migración de refactorización renombra el esquema actual como `private` y traslada el historial a `migrations.history`; todavía no se ha aplicado en remoto. La migración inicial permanece inmutable.
- Provisión inicial con la versión anterior de la seed: se ejecutó dos veces y creó un solo `admin.couchone`, activo, correo técnico `admin@couchonefit.invalid`, sin perfil profesional; la segunda ejecución conservó credenciales. La contraseña inicial sigue en el archivo local previo `apps/api/.env.admin`, ignorado por Git, para no perder acceso a la cuenta ya creada. El script actual no lo lee ni lo genera. El permiso temporal SET del operador se restauró a FALSE.
- Smoke HTTP local con PostgreSQL remoto: login y sesión admin 200, ruta profesional 403, anónimo 401, renovación conservando rol y logout invalidando acceso; checksum remoto idéntico y runtime sin membresía de provisión ni UPDATE de rol. Se preservó la cuenta profesional preexistente.
- Navegador local contra Supabase real: `/admin/` anónimo solicita login, login entra a administración y `/app/perfil` redirige al área admin; retorno de login hacia `/app/perfil` también entra a `/admin/` y logout vuelve a acceso con confirmación.

La evidencia remota usa la conexión de operador configurada para diagnóstico, no certifica un despliegue con usuario runtime dedicado. El aislamiento con usuario ordinario se verificó en la base local. El correo `.invalid` es técnico y no recibe mensajes.

### Ajuste a ejecución manual

Por indicación del usuario, la seed actual se ejecuta manualmente, recibe usuario/correo por consola y muestra una contraseña aleatoria una única vez tras la creación. Se eliminaron las variables `ADMIN_*` del ejemplo de entorno. Cuatro pruebas focalizadas de administración pasan con esta versión. No se volvió a ejecutar sobre Supabase ni se cambió la cuenta provisionada.
