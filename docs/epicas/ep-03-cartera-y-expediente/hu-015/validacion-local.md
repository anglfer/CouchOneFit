# Referencia y corrección de pruebas — HU-015

Actualización posterior: tras corregir el desmontaje ante fallo transitorio de sesión, **la persona usuaria confirmó** que Offline → Online conserva los campos llenados (opcionales vacíos) y cerrar sesión/iniciar nuevamente muestra el formulario vacío. No se acreditan opcionales con valores ni reintento de guardado manual. **7/7 pruebas Web nuevas** pasan con build/typecheck, lint y formato aplicable; el chequeo global conserva **55 archivos ajenos** (58 antes de normalizar página profesional, package y lockfile ahora modificados). [Diagnóstico y alcance exacto de la evidencia manual](prueba-web-manual.md#corrección-del-fallo-de-sesión-transitorio-y-repetición-exclusiva). Los párrafos siguientes conservan los resultados históricos de sus respectivos pasos.

La revisión posterior del diff completo añadió correcciones del validador y pruebas propias de HU-015 (87/87). Tras corregir la exposición de lectura TT-010, el resultado más reciente es **91/91 aprobadas**, sin fallos ni omisiones; consultar [diseño y evidencia TT-010](tt-010-client-read-isolation.md) y [la matriz final](revision-final.md). Los resultados 80/80 de abajo corresponden al paso anterior de corrección de los 22 fallos previos.

Actualización de evidencia: los casos Web confirmados se atribuyen exclusivamente a la persona usuaria en [el registro manual](prueba-web-manual.md); mensaje de error y conservación de campos ante fallo de conexión no están confirmados. Los dos archivos Web modificados pasan Prettier después de normalizar LF en `api.ts`; el chequeo global conserva 58 avisos de archivos ajenos (56 solo CRLF y dos de formato previo). El diagnóstico original TT-010 demostró lectura SQL ajena de las seis columnas nuevas y revirtió su transacción. Las migraciones nuevas y cuatro pruebas negativas corrigen y comprueban ahora esa exposición específica; el diagnóstico anterior no se presenta como resultado vigente ni como prueba de aislamiento. El cierre transversal de TT-010 y la revisión independiente siguen pendientes.

## Entorno y aislamiento

28 de octubre de 2026, Windows, Node 24.22.0, npm 11.19.1, PostgreSQL 18.6. La referencia es `origin/main` local, commit `27a7df7d8d90bbed4643c5380d1201e7f0631ea7`; no se consultó ni actualizó el remoto. Se creó el checkout separado `../CouchOneFit-hu015-baseline` mediante `git worktree add --detach`, sin cambiar de rama ni descartar modificaciones del checkout de HU-015.

Se instalaron las dependencias del checkout separado con `npm ci`. Se cargaron explícitamente las credenciales locales ignoradas, se verificó por URL y consulta SQL la identidad del servidor `127.0.0.1:5432` y se creó la base temporal exclusiva `CouchOneFit_hu015_baseline_test_855338c0b8`. La referencia aplicó sus diez migraciones y ejecutó `npm test`; sus suites crearon sus propias bases temporales en el mismo servidor local. Al terminar se eliminó solo la base temporal de referencia. El checkout de referencia quedó sin cambios. No se usó Supabase compartido ni se modificó la autenticación del servidor.

Resultado de referencia: **76 pruebas, 54 aprobadas y 22 fallidas**, ninguna omitida, 159854 ms. Los mismos 22 nombres y causas aparecieron antes en la rama HU-015 (80 pruebas, 58 aprobadas y 22 fallidas). Esta ejecución acredita su existencia previa; no se infiere solo de comparar archivos.

## Causas de los 22 fallos

| Grupo | Cantidad | Pruebas afectadas | Error observado en la referencia |
| --- | --- | --- | --- |
| A: autenticación de fixture | 18 | Todos los casos de `apps/api/tests/account-lifecycle.test.ts`, enumerados abajo | `beforeEach` esperaba HTTP 200 en `webLogin` y recibió `503 SERVICE_UNAVAILABLE`. La fixture crea un rol SQL `LOGIN` sin contraseña y vacía `target.password`, incompatible con autenticación local por contraseña. |
| B: texto traducido | 3 | `manual seed reveals its password once and runtime cannot provision accounts` (`admin.test.ts`); `runtime without DDL can authenticate but cannot create an admin` (`login.test.ts`); `registration role works while row-level security blocks admin inserts` (`registration.test.ts`) | Regex `/permission denied/` o `/row-level security/` frente a `permiso denegado a la tabla users` o `el nuevo registro viola la política de seguridad de registros…`. |
| C: diagnóstico RESTRICT | 1 | `downgrade preserves clients, permits reserved invitations and atomically redeems without extra quota` (`saas.test.ts`) | Esperaba SQLSTATE `23503`; PostgreSQL 18 devuelve `23001` por `subscriptions_plan_id_fkey` al intentar borrar un plan todavía referenciado. |

Casos del grupo A, todos bloqueados por la misma preparación:

1. `credentials require current password, reject identity manipulation and duplicates, revoke all sessions and preserve record`
2. `invitation ownership, active state, CSRF, replacement, revoke and minimal prevalidation`
3. `invitation and activation enforce server expiration and current professional, subscription and record states`
4. `anonymous activation at the reserved last place is atomic, authenticated, notice-versioned and deletes the hash; replay fails`
5. `invalid activation, occupied username/email and forged fields preserve the original invitation`
6. `two simultaneous redemptions produce exactly one account and one link`
7. `reserved clients remain invitable after downgrade over capacity and concurrent issue does not deadlock across records`
8. `missing/expired subscription blocks invitation issuance and hides the professional portfolio`
9. `invitation replacement racing redemption yields only committed valid outcomes`
10. `failure at each activation stage rolls account, linkage, notice, deletion and audit back together`
11. `session failure after activation commit preserves account and offers ordinary login`
12. `assisted recovery requires ownership, corroboration and operator reauthentication; replaces and consumes reset and revokes every old session`
13. `reset expiry at server boundary, replay, concurrent consumption and invitation separation`
14. `reset failure rolls back consumption, password and revocation`
15. `admin may authorize professional and other admin recovery, never self; public reset does not enumerate accounts`
16. `custodian command requires privileged connection and only the last active admin`
17. `runtime context resets after transactions and cannot change arbitrary credentials, role or delete users`
18. `daily cleanup removes only expired codes with runtime permissions and preserves live invitations and resets`

## Correcciones y equivalencia

Las fixtures de ciclo de acceso y provisión administrativa generan contraseñas SQL aleatorias con `randomBytes`, solo en memoria, y las usan en sus roles temporales. No se imprimen ni se guardan archivos de credenciales de esos roles. Se mantienen las comprobaciones de rol restringido y la limpieza de roles existentes. No se habilitó `trust` ni se cambió `pg_hba.conf`.

Las aserciones de autorización usan SQLSTATE `42501`. Los errores RLS observados no proporcionan campos estructurados `table` ni `constraint`; exigirlos falló aun con el rechazo correcto. Para comprobar el mismo comportamiento se verifica el permiso INSERT de la columna `role`, que RLS esté activa y que la fila prohibida no exista después del rechazo. Se conservan los casos permitidos y las comprobaciones de pertenencia a roles; no se acepta cualquier excepción.

El [cambio oficial de PostgreSQL `086c84b23`](https://github.com/postgres/postgres/commit/086c84b23) diferencia `restrict_violation` de `foreign_key_violation`. La prueba espera exactamente `23001` desde PostgreSQL 18 y `23503` en versiones anteriores, junto con `constraint: subscriptions_plan_id_fkey` y `table: subscriptions`. Además compara íntegramente el plan y todas sus suscripciones antes y después: deben ser idénticos y debe existir al menos una referencia. Así se acredita que, para este caso de negocio, el borrado sigue rechazándose y no altera datos. No se afirma equivalencia global de RESTRICT y NO ACTION ni ejecución en PostgreSQL 17 en esta computadora.

No se modificaron migraciones históricas, permisos de aplicación ni alcance funcional. La migración y el esquema de HU-015 conservaron los cambios trasladados; esta corrección adicional se limita a pruebas y documentación.

## Formato y recorrido manual

Comprobaciones finales después de corregir las fixtures y aserciones:

| Comprobación | Resultado |
| --- | --- |
| Suite API actual, `.env.test.local` cargado explícitamente y destino verificado | **80/80 aprobadas**, 0 fallidas, 0 omitidas; 112260 ms. |
| Migraciones limpia, paridad y actualización de expediente anterior | Aprobadas dentro de la suite API. |
| Compilación API | Aprobada. |
| Compilación Web y lint Web | Aprobados. |
| `git diff --check` | Sin errores. |
| Prettier del formulario modificado de HU-015 | Aprobado. |
| `format:check` global | Falla por deuda previa y saltos de línea del checkout, detallados abajo. |
| Recorrido Web humano | Pendiente; guía preparada. |
| Asistente de arranque manual, comprobación HTTP local | Login y cartera `200` con rol SQL restringido; fixture y rol limpiados. No sustituye la prueba de navegador. |

Se ejecutó `npm --prefix apps/web run format:check` tanto en el checkout de referencia como en el actual. Referencia: 60 archivos; rama actual: 59. Al analizar el contenido con LF, 57 avisos actuales desaparecen; los otros dos corresponden a `apps/web/README.md` y `src/features/admin/pages/AdminPage.tsx`, también mal formateados en `origin/main`. `core.autocrlf=true` y Prettier exige `endOfLine=lf`. El formulario modificado de HU-015 pasa Prettier. No se reformatearon archivos ajenos para ocultar esta deuda previa.

El recorrido humano está descrito en [prueba-web-manual.md](prueba-web-manual.md), con comandos locales, acceso sintético de contraseña introducida mediante entrada oculta, casos concretos y limpieza limitada a su fixture. No se volvió a controlar Chrome. La exposición de lectura de clientes TT-010 se corrigió y probó según la actualización inicial de este documento; conserva pendientes la revisión independiente y su alcance transversal restante. No se cierra D0 ni se publica la rama.
