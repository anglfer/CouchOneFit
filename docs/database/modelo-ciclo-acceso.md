# Modelo incremental de credenciales, invitación y recuperación

Complementa [identidad y acceso](modelo-identidad-acceso.md) con HU-006–009. Migración `202610190003_account_lifecycle.sql`; las cuatro anteriores conservan contenido/checksum. No renombra, borra ni vincula filas existentes. El esquema integrado incorpora el mismo SQL incremental.

## Diccionario

PK UUID con `gen_random_uuid()`; instantes `timestamptz`; FKs `ON DELETE RESTRICT`. Esquema `private`, sin grants públicos.

| Tabla | Columnas y reglas | Relación/uso |
| --- | --- | --- |
| `subscriptions` | `id`, `professional_id UNIQUE`, `plan` (`basic/pro/elite`), `status` (`active/suspended/expired`), `expires_at`, `created_at`. | Una suscripción actual por profesional. Contrato mínimo para invitar/canjear; sin contratación automática/cobros. |
| `invitations` | `id`, `client_id UNIQUE`, `token_hash UNIQUE` SHA-256 hexadecimal64, `created_at`, `expires_at > created_at`. | Temporal por expediente, que determina al profesional. TTL7d; DELETE al revocar/canjear/limpiar. |
| `password_resets` | `id`, `user_id UNIQUE`, `issued_by`, `token_hash UNIQUE` hexadecimal64, `created_at`, `expires_at > created_at`. | Temporal independiente de invitaciones; emisor autorizado, una vigencia por cuenta. TTL30min; DELETE al canjear. |
| `access_events` | `id`, `actor_id`, `subject_id`, `client_id` opcionales, `action`, `created_at`. | `credentials_changed`, `invitation_issued`, `invitation_revoked`, `account_activated`, `reset_issued`, `password_reset`, `emergency_reset_issued`; HU-018 añade `client_record_activated`/`client_record_inactivated`. Sin texto libre, token, contraseña ni hash. |

`users.username/password_hash` cambian en HU-006; solo `password_hash` en HU-009. `clients.user_id` pasa de NULL a la cuenta nueva en HU-008; unicidad/FK de rol impiden doble vínculo. `notice_acceptances` guarda versión/fecha en la transacción. Sesiones/refresh conservan la revocación existente.

## Índices y concurrencia

PK e índices únicos soportan búsqueda por hash, invitación por expediente y reset por cuenta; `clients.professional_id` y `sessions.user_id` ya están indexados. Invitar/canjear bloquea expediente → cuenta profesional compartida → suscripción → invitación. Se evita ascender a lock exclusivo de cuenta profesional al emitir códigos para expedientes distintos.

Reset/cambio de clave bloquea cuenta antes de sesiones. Login bloquea cuenta en lectura antes de crear sesión: una contraseña verificada antes del reset no puede crear una sesión vigente después de revocarla. Emisión asistida bloquea emisor/destinatario ordenados por UUID y comprueba sesión/contraseña actuales. Toda transacción mantiene un `PoolClient` hasta COMMIT/ROLLBACK y lo libera en `finally`.

El cupo se reserva al activar/crear el expediente, no al invitar/canjear. Un downgrade con exceso permite utilizar esa reserva (DEC-005). HU-013 debe usar la misma fila/bloqueo de suscripción para altas/reactivaciones y cambios de plan; esta entrega no declara terminada su administración.

## Grants y RLS

`couchone_authentication` hereda registro. Recibe SELECT de suscripciones y UPDATE únicamente de `subscriptions.id` para lock de fila, sin cambiar plan/estado/vencimiento; SELECT/INSERT/UPDATE/DELETE de temporales; INSERT de eventos sin lectura efectiva bajo RLS; En el incremento original, UPDATE de `users.username/password_hash` y `clients.user_id`; posteriormente TT-010 revocó el UPDATE directo de user_id y lo restringió a la función de activación. HU-017 añade únicamente UPDATE de datos base propios bajo RLS y versión administrada por trigger; estado conserva su permiso separado. No recibe DDL, borrado de cuentas ni cambios de rol o propietario. Estado operativo conserva el permiso específico de SaaS, independiente de los datos base. No hay grants a `anon`, `authenticated` ni PUBLIC.

El backend establece contexto con `set_config(..., true)` dentro de la transacción (SET LOCAL), nunca desde claims arbitrarios, headers o campos del formulario:

| Contexto | Fuente y política |
| --- | --- |
| `app.subject_id` | Cuenta de sesión o localizada por hash privado del reset. UPDATE de credenciales/reset limitado al sujeto. Se establece antes de locks, que evalúan también RLS de UPDATE. |
| `app.client_id` | Expediente propio verificado o localizado por hash de invitación. UPDATE del vínculo solo aún sin cuenta; mutaciones de invitación limitadas al expediente. |
| `app.access_operation=activation` | Servicio de canje tras validar invitación/estados; INSERT únicamente de usuario `client/active`. |

Las lecturas internas de hashes permiten el canje anónimo por API; no son acceso público. La conexión runtime es secreta y exclusiva del servidor. No se afirma aislamiento frente a un operador que ya posea esas credenciales técnicas. Las pruebas usan LOGIN sin superusuario/BYPASSRLS/DDL.

## Operación y recuperación

Aplicar `npm run db:migrate` con operador DDL; después desplegar versiones compatibles de API/Web/móvil. La API no migra al iniciar. No ejecutar el esquema integrado en una base existente. Respaldar antes del corte. Las pruebas locales no aplican esta migración al Supabase compartido.

La tabla de suscripciones comienza vacía. HU-013 o un operador autorizado carga el plan/estado/vencimiento real; registrarse no concede cupo. HU-015 prepara expedientes; fixtures QA preparan filas sintéticas solo en PostgreSQL local.

Ejecutar `npm run db:cleanup:access` diariamente: elimina códigos vencidos con contexto/locks y revalida vencimiento al borrar. Salida solo de conteos. Operaciones configura la ejecución en su infraestructura; el script no instala scheduler ni automatización remota. Reemplazados/revocados no conservan hashes. Auditoría/cuentas siguen DEC-011, sin purga inventada.

Emergencia: [runbook HU-009](../epicas/ep-01-identidad-y-acceso/hu-009/README.md). Rollback automático antes de COMMIT. Después, volver a una versión anterior compatible deja tablas nuevas sin uso; no eliminar tablas con datos reales para deshacer la entrega. Cambios incompatibles exigen nueva migración revisada o restauración del respaldo.
