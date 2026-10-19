# Esquemas integrados de base de datos

[identity_access.sql](identity_access.sql) muestra el esquema actual de identidad y acceso después de todas las migraciones: el esquema `private`, diez tablas, restricciones, índices, políticas, roles, permisos y seguridad por filas. Incluye el contrato mínimo de suscripción para invitaciones; no incorpora otros módulos planeados ni tablas de Supabase Auth.

## Migraciones e instantáneas

- `../migrations/` contiene los cambios ordenados e inmutables aplicados en cada entorno. La migración inicial y la de provisión administrativa se aplicaron antes de esta refactorización de nombres; `202610190001_english_identifiers.sql` actualiza el esquema y los datos existentes.
- Este directorio contiene el resultado integrado de todas las migraciones. Actualiza la instantánea cuando una migración cambie el esquema.
- `migrations.history` lo administra `apps/api/scripts/migrate.ts`; registra los nombres de archivo, las sumas SHA-256 y las fechas de aplicación. No ejecutes esta instantánea en una base que ya administre el ejecutor de migraciones.

La prueba de migraciones aplica los archivos ordenados a una base limpia, crea otra base desde la instantánea y compara los catálogos del esquema y sus permisos. También verifica la actualización desde la tabla anterior del historial de migraciones.
## Ampliación HU-006–009

La instantánea incluye `202610190003_account_lifecycle.sql`: suscripciones mínimas para validar invitaciones, temporales de invitación/reset, auditoría segura y permisos/contexto RLS. [Diccionario y operación](../modelo-ciclo-acceso.md). Nunca aplicar la instantánea sobre una base existente.
