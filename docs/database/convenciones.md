# Convenciones de base de datos — CouchOneFit

Estas convenciones son la fuente de verdad para PostgreSQL con Supabase, contratos SQL ↔ TypeScript ↔ JSON y nuevas migraciones. La [Guía de programación](../../DEVELOPMENT.md), enlazada desde el README raíz, resume cómo aplicarlas desde la API, Web y móvil. Se aplican al esquema final del producto. La inicial consolida HU-001/002 antes de su primera aplicación. Una vez aplicada, conservará su contenido y checksum; los cambios posteriores se incorporan con nuevas migraciones y actualizan el esquema integrado de `schemas/`.

| Capa | Convención | Ejemplo |
| --- | --- | --- |
| Base de datos | Español, `snake_case` | `usuario_id`, `nombre_completo`, `creado_en` |
| TypeScript / JavaScript y JSON propio | `camelCase` | `nombreCompleto`, `confirmacionCorreo`, `expiresAt` |
| Clases, tipos y componentes | `PascalCase` | `Registration`, `ProfessionalIdentity`, `ProfessionalApp` |

El vocabulario de BD es español, sin mezclar `usuarios` con `users` ni `sesiones` con `sessions`. La aplicación ya tiene nombres técnicos en inglés; pueden mantenerse si cumplen camelCase/PascalCase y su mapeo SQL es explícito. Por ejemplo, `usuarios.correo AS email` y `sesiones.expira_en AS "expiresAt"`. No se filtran nombres SQL como `full_name` al contrato TypeScript. Los valores de rol/estado persistidos son españoles; el contrato HTTP existente conserva `professional`/`active` mediante serialización explícita.

## Identificadores

- Minúsculas, palabras separadas por `_`, sin espacios, acentos, `ñ` ni caracteres especiales.
- Usar `anio`, `contrasena`, `numero_telefono`, `fecha_nacimiento`; no `año`, `contraseña` ni `fechaNacimiento` en SQL.
- Tablas en plural: `usuarios`, `profesionales`, `sesiones`. Sin `tbl_`, `tb_` o `tabla_`.
- Columnas generalmente en singular y con significado preciso. Evitar `dato`, `valor`, `tipo2`, `campo1` cuando exista un nombre de dominio concreto.
- Esquemas propios: `privado` para identidad/acceso y `migraciones` para control técnico. No exponerlos en Data API ni conceder acceso a roles públicos.

El nombre del proyecto/base indicado por el usuario, `CouchOneFit`, y los entornos `CouchOneFit_dev`/`CouchOneFit_test` son una excepción de capitalización explícita. Al crearlos con SQL se usan comillas dobles. Esto no cambia el nombre SQL remoto que indique la conexión de Supabase.

## Claves y relaciones

Toda tabla propia actual tiene `id uuid PRIMARY KEY`, con `gen_random_uuid()` generado por PostgreSQL. No usar `id_usuario`, `usuario_pk` ni `usuarioId` como PK propia. Un UUID no sustituye validaciones ni permisos.

Las FK usan `<entidad>_id`: `usuario_id`, `sesion_id`, `profesional_id`. Deben tener tipo compatible con la PK y expresar nulabilidad y comportamiento de eliminación. No usar cascadas que eliminen historial sin una regla funcional aprobada; las relaciones de identidad actuales usan `ON DELETE RESTRICT`.

- **1:N:** la tabla dependiente guarda la FK. Ejemplo implementado: `sesiones.usuario_id → usuarios.id`.
- **1:1:** la tabla dependiente tiene su propio `id` y FK única. Ejemplo implementado: `profesionales.id` más `usuario_id UNIQUE`. La cuenta y el perfil no comparten una PK por accidente.
- **N:M:** tabla intermedia con ambas FK. Si necesita orden, fechas u otros datos de relación, también se documentan esas columnas y las restricciones específicas.

Ejemplo futuro de N:M, ilustrativo y **no creado** por HU-001/002:

```sql
-- Cada fila representa una posición de un ejercicio dentro de una rutina.
-- Las tablas rutinas/ejercicios pertenecen a sus módulos y no existen en este incremento.
rutinas_ejercicios (
  id uuid PRIMARY KEY,
  rutina_id uuid REFERENCES rutinas(id),
  ejercicio_id uuid REFERENCES ejercicios(id),
  orden integer,
  UNIQUE (rutina_id, orden)
)
```

No imponer unicidad de `(rutina_id, ejercicio_id)` sin confirmar si un ejercicio puede repetirse en posiciones distintas.

## Tipos, fechas y credenciales

- Identidades con `uuid`; fechas/instantes con `timestamptz`, fechas sin hora con `date` cuando corresponda al módulo.
- `creado_en`, `aceptado_en`, `expira_en`, `revocado_en`, `usado_en` expresan su evento; solo se crean los campos que utiliza la funcionalidad.
- Teléfono como texto, no número aritmético. `NULL` representa ausencia, no una cadena vacía o cero inventado.
- Contraseñas nunca en claro ni reversiblemente cifradas. El proveedor elegido para CouchOneFit es auth propia de API: `usuarios.hash_contrasena` guarda únicamente Argon2id con salt. No se cambia a Supabase Auth por esta convención.
- Tokens refresh: solo `hash_token` SHA-256 de un secreto aleatorio de 32 bytes; el hash no sustituye la contraseña ni permite iniciar sesión. Tokens usados se conservan para detectar replay durante la vida de sesión.

## Restricciones, índices, roles y funciones

Los nombres incluyen la tabla y propósito: `pk_usuarios`, `fk_sesiones_usuario`, `uk_profesionales_usuario_id`, `ck_usuarios_rol`, `idx_sesiones_usuario_id`. Prefijos técnicos: `pk` primaria, `fk` foránea, `uk` unicidad, `ck` comprobación, `idx` índice. El contenido del nombre es español.

Los índices responden a consultas reales. La unicidad normalizada de usuario/correo usa índices expresionales `lower(btrim(...))`. No escribir `UNIQUE(lower(...))` dentro de `CREATE TABLE`. No añadir índices de cada columna sin una lectura que los justifique.

Roles técnicos actuales: `couchone_registro` y `couchone_autenticacion`, NOLOGIN, sin privilegios DDL ni BYPASSRLS. El usuario de conexión dedicado recibe la membresía vigente; nunca es la cuenta de un profesional.

Si un módulo necesita una función SQL propia, su nombre también será español `snake_case`, con parámetros/resultado/permisos y transacción documentados. No añadir funciones/RPC sin uso. Actualmente el dominio se implementa en funciones TypeScript camelCase y consultas parametrizadas; no hay procedimientos de negocio almacenados. `gen_random_uuid`, `lower`, `btrim`, `now`, `clock_timestamp`, `format` y catálogos del sistema son nombres de PostgreSQL que no se traducen.

## Migraciones y contratos

1. Incorporar tablas por funcionalidad, con DDL, diccionario, relaciones, índices, permisos y pruebas en la HU correspondiente.
2. No editar, renombrar ni borrar migraciones aplicadas. Corregir mediante una nueva que preserve datos o documente una transformación autorizada.
3. El ejecutor envuelve los cambios en transacción, bloquea migraciones concurrentes y registra nombre/checksum/fecha. El esquema integrado debe reflejar el resultado de todas las migraciones.
4. Especificar mapeo BD ↔ TypeScript ↔ JSON. Al cambiar el contrato, actualizar API, Web, pruebas y documentación juntos. Las rutas HTTP, cookies, claims JWT y códigos de error no se renombran solo por cambiar un identificador SQL.
5. Validar instalación limpia y equivalencia del esquema integrado; en futuras migraciones, también actualización con datos existentes. Los despliegues de cambios de nombres requieren detener la versión anterior durante migración y desplegar API/Web compatibles; no ejecutar versiones incompatibles en paralelo.

Modelo actual y funciones: [identidad y acceso](modelo-identidad-acceso.md). Historias: [EP-01](../epicas/ep-01-identidad-y-acceso/README.md). Aplicación local/producción: [README de BD](README.md).
