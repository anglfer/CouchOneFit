# Esquemas integrados de base de datos

[identity_access.sql](identity_access.sql) muestra el esquema actual de identidad, cartera y suscripciones después de todas las migraciones: el esquema `private`, catorce tablas, restricciones, índices, políticas, roles, permisos y seguridad por filas. Incluye el expediente inicial de HU-015 en `private.clients`; no incorpora otros módulos planeados ni tablas de Supabase Auth.

## Migraciones e instantáneas

- `../migrations/` contiene los cambios ordenados e inmutables aplicados en cada entorno. La migración inicial y la de provisión administrativa se aplicaron antes de esta refactorización de nombres; `202610190001_english_identifiers.sql` actualiza el esquema y los datos existentes.
- Este directorio contiene el resultado integrado de todas las migraciones. Actualiza la instantánea cuando una migración cambie el esquema.
- `migrations.history` lo administra `apps/api/scripts/migrate.ts`; registra los nombres de archivo, las sumas SHA-256 y las fechas de aplicación. No ejecutes esta instantánea en una base que ya administre el ejecutor de migraciones.

La prueba de migraciones aplica los archivos ordenados a una base limpia, crea otra base desde la instantánea y compara los catálogos del esquema y sus permisos. También verifica la actualización desde la tabla anterior del historial de migraciones.
## Ampliación HU-006–009

La instantánea incluye `202610190003_account_lifecycle.sql`: suscripciones mínimas para validar invitaciones, temporales de invitación/reset, auditoría segura y permisos/contexto RLS. [Diccionario y operación](../modelo-ciclo-acceso.md). Nunca aplicar la instantánea sobre una base existente.

## Expediente inicial — HU-015

La instantánea incluye `202610270001_client_initial_record.sql`: fecha de nacimiento, estatura, peso y medidas base opcionales en `private.clients`. Las columnas se conservan anulables para expedientes anteriores; los rangos y la precisión de valores presentes se validan en SQL y el contrato de alta completo se valida en la API.

También integra `202610280001_client_read_isolation.sql` y `202610280002_invitation_professional_lock.sql`: SELECT de clientes por sujeto activo y propiedad, enlace por invitación sin UPDATE general de `user_id`, agregados administrativos y bloqueo de limpieza limitado. Las funciones especiales tienen search_path fijo y EXECUTE revocado a PUBLIC. [Inventario y frontera de confianza](../../epicas/ep-03-cartera-y-expediente/hu-015/tt-010-client-read-isolation.md).

La rama HU-016 integra además 202610280003_client_portfolio_order.sql: índice B-tree por profesional y orden de cursor. La instantánea equivale a catorce migraciones sin modificar datos ni grants/RLS. Ver [HU-016](../../epicas/ep-03-cartera-y-expediente/hu-016/README.md).

HU-017 añade `202610280004_client_record_version.sql`: versión por trigger y UPDATE limitado a datos base bajo RLS existente. El estado actual equivale a quince migraciones y catorce tablas; no modifica SQL histórico ni inventa tablas de evaluaciones o planes de cliente. [Contrato y evidencia](../../epicas/ep-03-cartera-y-expediente/hu-017/README.md).
