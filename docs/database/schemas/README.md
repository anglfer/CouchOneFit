# Esquemas integrados — CouchOneFit

[identidad_acceso.sql](identidad_acceso.sql) contiene la definición completa vigente de la base de negocio: esquema `privado`, cinco tablas, columnas, UUID, relaciones, restricciones, índices, roles, permisos y RLS de HU-001/002/003. Incluye la provisión administrativa incremental. No incluye tablas de módulos pendientes ni utiliza Supabase Auth.

## Diferencia con las migraciones

- **`migrations/`** conserva los cambios ordenados que se aplican a cada entorno. Hoy existe una sola migración inicial, consolidada antes de su primera aplicación en el proyecto.
- **`schemas/`** muestra cómo queda la base integrada después de todos esos cambios. Al añadir un módulo, actualizar este SQL y agregar su nueva migración; conservar intactas las migraciones que ya se hayan aplicado.
- **`migraciones.historial`** es control técnico creado por el ejecutor: UUID, nombre único del archivo, SHA-256 y fecha. No forma parte del SQL de negocio ni se rellena ejecutando el snapshot.

La instalación habitual utiliza únicamente `npm run db:migrate` desde `apps/api`, con `DATABASE_URL` apuntando a la base correcta. **No ejecutar también `schemas/identidad_acceso.sql` sobre esa misma base:** intentaría crear objetos existentes. Este archivo sirve para consultar/revisar el modelo y reconstruirlo en una base vacía exclusiva de pruebas; no sustituye el historial del migrador.

El test de migraciones crea dos bases temporales independientes, aplica migraciones en una y este esquema en otra, y compara columnas, restricciones, índices, RLS, políticas y permisos. Así se detecta que la definición integrada quedó desactualizada. Los roles son globales al clúster: el SQL reutiliza los tres roles técnicos solo si sus atributos y membresías son seguros.

Diccionario de cada tabla, funciones de API y transacciones: [modelo de identidad y acceso](../modelo-identidad-acceso.md). Operación y entornos: [README de base de datos](../README.md).
