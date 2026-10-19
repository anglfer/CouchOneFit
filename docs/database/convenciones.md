# Convenciones de base de datos — CouchOneFit

Este documento define los identificadores de PostgreSQL, los cambios de esquema y los contratos entre la base de datos y la API. La [guía de programación](../../DEVELOPMENT.md) resume cómo aplicar estas reglas en API, Web y móvil. El [glosario de identidad y acceso](../architecture/domain-glossary.md) contiene los nombres acordados para la funcionalidad actual.

## Idioma y formato de nombres

Todos los identificadores de la base de datos y los valores persistidos del dominio usan inglés. No mezcles inglés y español ni traduzcas un mismo campo en cada capa.

| Capa | Convención | Ejemplo |
| --- | --- | --- |
| Esquemas, tablas, columnas, restricciones, índices y políticas de PostgreSQL | Inglés `snake_case` | `private.users`, `full_name`, `fk_sessions_user` |
| Campos de TypeScript, JavaScript, Dart y JSON | Inglés `camelCase` | `fullName`, `createdAt`, `sessionId` |
| Clases, tipos, interfaces y componentes | Inglés `PascalCase` | `ProfessionalIdentity`, `RegistrationPage` |
| Roles y estados persistidos o enviados por API | Inglés en minúsculas | `professional`, `admin`, `active` |

El español se reserva para los textos que ve la persona usuaria, como etiquetas, mensajes de validación, correos y textos de accesibilidad. Las funciones integradas conservan sus nombres propios de PostgreSQL.

## Identificadores y relaciones

- Usa palabras en inglés, en minúsculas y separadas por guiones bajos en PostgreSQL. No uses acentos, `ñ` ni identificadores traducidos.
- Usa nombres de tablas en plural: `users`, `professionals`, `sessions`.
- Nombra cada columna según su significado y agrega `_id` a las llaves foráneas (`user_id`, `session_id`).
- Las tablas propias usan `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, salvo que el dominio requiera otra llave.
- La tabla dependiente guarda la llave foránea. Usa `ON DELETE RESTRICT` cuando borrar una cuenta no deba borrar su historial; usa otra acción solo si el dominio lo requiere expresamente.
- Usa una tabla de unión para relaciones de muchos a muchos. Agrega unicidad solo cuando sea una regla real del producto.
- Mantén los objetos de identidad y acceso en el esquema no expuesto `private`. No concedas acceso a este esquema mediante la Data API pública.

## Tipos y credenciales

- Usa `uuid` para identidades, `timestamptz` para instantes y `date` para fechas de calendario sin hora.
- Nombra las marcas de tiempo según el evento: `created_at`, `accepted_at`, `expires_at`, `revoked_at` y `used_at`.
- Usa texto para números telefónicos. Representa los datos opcionales ausentes con `NULL`.
- Guarda únicamente hashes de contraseñas Argon2id en `users.password_hash`; nunca guardes contraseñas en texto plano ni cifradas de forma reversible.
- Guarda únicamente hashes SHA-256 de secretos aleatorios de tokens de renovación en `refresh_tokens.token_hash`. Conserva los tokens usados mientras la sesión pueda ser objeto de repetición.

## Restricciones, índices, roles y políticas

Usa nombres en inglés que indiquen el objeto y su propósito. Los prefijos son `pk_` para llaves primarias, `fk_` para llaves foráneas, `uk_` para restricciones únicas, `ck_` para validaciones e `idx_` para índices. Ejemplos: `pk_users`, `fk_sessions_user`, `uk_professionals_user_id`, `ck_users_role` e `idx_sessions_user_id`.

Agrega índices para consultas reales, no para todas las columnas. Normaliza la unicidad de usuario y correo con índices de expresión sobre `lower(btrim(...))` cuando las comparaciones no distingan mayúsculas.

Los roles de base de datos de la aplicación usan nombres en inglés, tienen el atributo `NOLOGIN` y reciben solo los permisos necesarios para su operación de API. Las conexiones de ejecución no deben tener privilegios DDL ni `BYPASSRLS`. Mantén activa la seguridad por filas y alinea sus políticas con el rol persistido y la operación.

## Migraciones y contratos

1. Agrega los cambios de esquema en una migración nueva y ordenada. Los archivos y hashes de migraciones aplicadas son inmutables.
2. Conserva los datos al renombrar esquemas, tablas, columnas, restricciones, índices, políticas, roles o valores. Verifica de antemano las condiciones que podrían hacer fallar la migración o causar pérdida de datos.
3. Mantén el esquema integrado igual al resultado de todas las migraciones aplicadas.
4. Usa consultas parametrizadas. Los repositorios consultan directamente con los nombres en inglés y no agregan alias SQL cuyo único propósito sea traducir nombres para el código de la aplicación.
5. Actualiza el contrato de API, los consumidores Web y móvil, las pruebas, los datos de prueba, el glosario y la documentación de la funcionalidad en el mismo cambio.
6. Verifica tanto una instalación limpia como una actualización con filas existentes. Los cambios de nombres requieren un despliegue coordinado de base de datos, API, Web y cualquier versión móvil que consuma el contrato; las versiones viejas y nuevas no deben ejecutarse simultáneamente durante el corte.

El [modelo de identidad y acceso](modelo-identidad-acceso.md) documenta el diseño y los permisos actuales. La [guía de base de datos](README.md) describe las operaciones de migración.
