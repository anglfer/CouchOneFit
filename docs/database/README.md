# Base de datos — CouchOneFit

La base crece por funcionalidad mediante migraciones. Cada cambio debe explicar tablas, relaciones, restricciones, permisos, funciones consumidoras y pruebas. El responsable de integración centraliza la aplicación remota. La migración inicial ya se aplicó en CouchOneFit con autorización del usuario; el estado verificado se registra abajo.

## Documentación vigente

- [Convenciones de BD y código](convenciones.md): español/snake_case en PostgreSQL, camelCase en TypeScript/JSON, PascalCase en tipos/componentes.
- [Modelo de identidad y acceso](modelo-identidad-acceso.md): creación y evolución de tablas, diccionario, relaciones, índices, RLS, funciones, transacciones y despliegue.
- [EP-01 — Identidad y acceso](../epicas/ep-01-identidad-y-acceso/README.md): contratos y evidencia de HU-001/002.
- [Índice de épicas e historias](../epicas/README.md): documentación organizada sin depender de sprints.

## Nombre y entornos

Proyecto Supabase **CouchOneFit**, referencia `pcoyrxdeiigynmmpxtng`; URL de servicio `https://pcoyrxdeiigynmmpxtng.supabase.co`. La URL y una clave publicable no son el nombre de la base ni sustituyen una conexión PostgreSQL.

Decisión vigente del usuario: **un único proyecto Supabase, CouchOneFit, compartido por desarrollo y producción**, sin segundo proyecto ni ramas remotas. Ambos usos comparten tablas y datos: un cambio desde desarrollo afecta también producción. La base SQL del proyecto es `postgres`; no se renombra a partir de la etiqueta CouchOneFit.

Las pruebas automatizadas conservan una base local exclusiva **CouchOneFit_test**; nunca deben apuntar al proyecto compartido. **CouchOneFit_dev** queda como alternativa local opcional, no como otro entorno remoto creado.

Las tablas de negocio están en **privado**; el historial técnico en **migraciones.historial**. Estos son esquemas dentro de la base seleccionada por `DATABASE_URL`, no bases separadas. Ninguno debe exponerse en Data API.

## Migración inicial y esquema completo

Única migración: [202610150001_inicial_identidad_acceso.sql](migrations/202610150001_inicial_identidad_acceso.sql). Crea directamente el modelo español de HU-001/002: usuarios, profesionales, aceptaciones, sesiones y tokens de renovación, con sus claves, índices, roles y políticas. Se consolidó antes de la primera aplicación del proyecto; no requiere renombrar tablas ni convertir datos anteriores.

La carpeta [schemas](schemas/README.md) conserva [el SQL completo integrado](schemas/identidad_acceso.sql). Hoy coincide con la inicial. Al incorporar módulos se añadirá una migración y se actualizará el esquema integrado para reflejar el resultado acumulado. Una migración aplicada queda inmutable.

Aplicar **solo las migraciones** al preparar un entorno; no ejecutar además el SQL de `schemas` sobre la misma base. El esquema integrado es referencia y se prueba por separado en una base vacía. El historial técnico `migraciones.historial` lo crea y mantiene el ejecutor, no el snapshot de negocio.

## Aplicación local

1. Crear una base vacía dedicada al entorno. Nunca ejecutar pruebas sobre una base de otro proyecto o producción.
2. En `apps/api`, instalar dependencias y configurar `DATABASE_URL` con un usuario de migraciones con permisos de DDL y aprovisionamiento de roles. Ejecutar `npm run db:migrate`.
3. El ejecutor toma un bloqueo, valida checksums y aplica SQL pendiente ordenado dentro de una transacción. Repetir no reaplica. Si un archivo registrado fue modificado, se detiene: corregir con otra migración.
4. El historial guarda UUID, nombre único, SHA-256 y fecha de aplicación. Si contiene archivos ausentes de esta versión, el ejecutor se detiene; no borrar historial para eludir errores.
5. Usar un usuario de conexión dedicado, sin superusuario/BYPASSRLS/DDL, con `GRANT couchone_autenticacion TO couchone_api;`. Ese rol hereda `couchone_registro`.
6. Configurar la conexión runtime, `AUTH_JWT_SECRET` aleatorio de al menos 32 bytes, Origin Web permitido y TLS verificado en remoto. Nunca poner secretos en Git ni en variables VITE.

Los roles son globales al clúster: el SQL reutiliza roles seguros al migrar dev y test, comprobando atributos/membresías. La API no aplica migraciones al arrancar.

## Pruebas y producción

Configurar `TEST_DATABASE_URL` con una base **local exclusiva ya migrada** y ejecutar `npm test` en `apps/api`. La suite crea datos únicos y triggers temporales de fallo; el test de migraciones crea/elimina exclusivamente dos bases temporales propias y compara migración contra esquema integrado. Requiere permisos locales para esos triggers, SET ROLE y creación de bases. Los archivos se ejecutan en serie. Validar también API `npm run build`, Web build/lint y navegador.


Producción exige respaldo verificado, revisión central de migraciones/permisos, aplicación controlada y smoke del runtime restringido. Ante error antes del COMMIT, rollback automático; después, nueva migración inversa revisada o restauración del respaldo. No eliminar cuentas ni historial para revertir una entrega. Más campos de perfil o tablas de otro módulo se añaden mediante otra migración.

## Aplicación remota verificada — 15 de octubre de 2026

- Proyecto único: `pcoyrxdeiigynmmpxtng` (**CouchOneFit**), región `us-east-2`, PostgreSQL 17.6; organización `anglfer's Org`.
- Migración local aplicada: `202610150001_inicial_identidad_acceso.sql`.
- SHA-256 registrado: `ab9ae39d70a31b144fcc12c302a1f6b95e3668792c919c7ce9dab5dfc4f2630a`.
- Historial del proyecto: versión Supabase `20261015165150`, nombre `inicial_identidad_acceso`; aplicación `2026-10-15T16:51:50.067856Z`.
- Cinco tablas en `privado`, todas con RLS, nueve políticas; sin USAGE del esquema para `anon`/`authenticated`. Los roles técnicos no permiten al runtime actualizar el rol de una cuenta. El asesor de seguridad de Supabase no reportó avisos.
- La aplicación mediante el conector incluyó el bloqueo y la creación/registro de `migraciones.historial` en la misma operación que el DDL. Así nuestro ejecutor reconoce el archivo aplicado por su nombre y SHA-256 y no intenta recrear tablas. El historial de Supabase registra además la operación del conector; no representa una segunda migración de negocio en el repositorio.
- La inicial ya está aplicada: no editarla ni consolidarla de nuevo. Las siguientes funcionalidades añaden una migración y actualizan `schemas/`.

Esta verificación acredita la estructura remota y sus permisos, no el despliegue de API/Web. Falta configurar la conexión PostgreSQL runtime (`DATABASE_URL`, usuario dedicado con membresía `couchone_autenticacion`, TLS verificado) y los secretos de sesión en el servidor. La URL HTTPS y la clave publicable no sustituyen esas credenciales. No se generaron cuentas de usuario de prueba en la base compartida.

## Comprobación directa de BD remota — registro y sesión

El 15 de octubre de 2026 se ejecutaron aserciones SQL sobre CouchOneFit con datos temporales dentro de un bloque transaccional revertido. Pasaron: alta de usuario/perfil/aceptación; rechazo de usuario y correo duplicados; rechazo de correo/perfil inválidos; rollback sin usuario parcial; persistencia de sesión/token; consulta de sesión habilitada; exclusión por revocación y por cuenta inactiva. Los conteos finales de las cinco tablas quedaron en cero. Los permisos consultados impiden UPDATE de rol y DELETE de usuarios para `couchone_autenticacion`.

Estas comprobaciones no equivalen a pruebas HTTP de registro/login ni validan contraseñas, cookies o JWT contra remoto. El conector no permite SET ROLE a los roles de la aplicación; las aserciones se ejecutaron con su usuario de administración. La verificación completa está pendiente de configurar `DATABASE_URL` en la API: la URL HTTPS y la clave publicable del cliente Supabase no son una conexión PostgreSQL. No se cambió ningún permiso para sortear esa limitación ni se modificaron migraciones.

## Pruebas HTTP de API contra Supabase — 15 de octubre de 2026

Se configuró únicamente el archivo local ignorado `apps/api/.env`, con la conexión Session pooler de CouchOneFit y un secreto de sesión aleatorio. El host directo solo resuelve IPv6 y esta máquina no tiene ruta IPv6; por eso se utilizó `aws-0-us-east-2.pooler.supabase.com:5432`. La conexión cliente–pooler usa `sslmode=verify-full` y el certificado CA de Supabase descargado por HTTPS en `apps/api/.env.certs/`, también ignorado por Git. Se verificaron `encrypted=true` y `authorized=true` en el socket TLS del cliente. El enlace interno pooler–PostgreSQL figura como no SSL en `pg_stat_ssl`; esa vista no describe el TLS del cliente hacia el pooler.

Pasaron **16 comprobaciones**, ejecutando los handlers HTTP reales de Express con Supertest y persistencia real en CouchOneFit:

1. Conexión cliente–pooler cifrada con certificado y hostname verificados.
2. Registro consistente de usuario/perfil/aceptación, normalización y hash Argon2id verificable; sin sesión ni suscripción concedida.
3. Usuario duplicado responde 409.
4. Correo duplicado responde 409.
5. Dos registros concurrentes producen un 201 y un 409, sin dos cuentas.
6. Confirmaciones inválidas y rol manipulado responden 400 y no crean altas parciales.
7. Contraseña incorrecta e identificador inexistente responden 401 con el mismo error y sin cookies de sesión.
8. Consulta privada sin sesión responde 401.
9. Login por usuario normalizado crea sesión y cookies HttpOnly/SameSite=Strict.
10. Login por correo normalizado resuelve la misma identidad.
11. Sesión y perfil consultan la cuenta autenticada e ignoran otro identificador en query.
12. Renovación rota refresh y conserva identidad.
13. Reutilizar el refresh anterior responde 401 y revoca también el access de esa familia.
14. Logout responde 204 e invalida acceso posterior.
15. Cuenta inactiva no inicia sesión y pierde acceso con una sesión existente.
16. Login sin CSRF responde 403.

La limpieza eliminó únicamente las cuentas temporales de esta ejecución y sus perfiles, aceptaciones, sesiones y hashes de renovación. Los conteos finales de las cinco tablas volvieron a cero. No se ejecutó la suite destructiva local contra remoto ni se cambiaron migraciones o permisos.

Límites: esta prueba usa la conexión administrativa `postgres` para diagnóstico y limpieza; sigue pendiente provisionar y probar el usuario runtime restringido. Se probaron requests HTTP contra Express local y Supabase remoto, no el navegador ni un despliegue publicado. La marca Secure de cookies de producción conserva la evidencia de las pruebas locales anteriores, no se comprobó nuevamente en este smoke. La URL/certificado guardados son de esta máquina; el servidor desplegado requiere su configuración propia y secretos independientes. Ninguna contraseña, URL con credenciales o token se incluye en esta documentación.

## Verificación desde navegador local — 15 de octubre de 2026

Después del smoke HTTP se reprodujo el fallo de la web: Vite estaba activo en 5000, Express no estaba encendido, `VITE_API_URL` apuntaba directamente a 3000 y `CORS_ORIGIN` seguía en 5173. Se corrigieron únicamente los archivos locales ignorados y se inició la API. La web usa ahora el proxy `/api` y la API admite los hosts locales del puerto 5000.

Edge comprobó contra Supabase real: registro y confirmación, duplicado visible, login/perfil, persistencia al recargar, logout, guardia de rutas privadas y acceso tanto en localhost como en 127.0.0.1. No hubo peticiones de red fallidas en ese recorrido. Se eliminó la cuenta temporal con sus perfiles, aceptaciones, sesiones y tokens. Esta evidencia amplía la prueba HTTP anterior; no acredita un despliegue publicado ni una conexión runtime con usuario restringido. [Arranque de los dos procesos locales](../../apps/web/README.md#arranque-local-de-registro-y-acceso).
