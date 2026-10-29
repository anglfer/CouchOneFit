# Operación de base de datos — CouchOneFit

Los cambios de esquema se versionan con migraciones. Las migraciones iniciales permanecen inmutables. La migración 202610190001_english_identifiers.sql se aplicó en el proyecto CouchOneFit compartido de Supabase el 19 de octubre de 2026; la verificación confirmó los conteos existentes y las relaciones sin huérfanos.

**Estado del corte:** por instrucción directa, la migración ya se aplicó en Supabase. La compatibilidad del API y Web publicados no quedó verificada: la solicitud HTTP a https://couchonefit-web.vercel.app/api/health devolvió 404. No ejecutes la API anterior contra el esquema nuevo. Publica las versiones correspondientes de API y Web en el mismo corte de mantenimiento. La aplicación móvil del repositorio ya consume identidad/perfil y el ciclo HU-006–009; el despliegue publicado debe verificarse en el corte coordinado.

## Referencias actuales

- [Convenciones de base de datos](convenciones.md)
- [Modelo de datos de identidad y acceso](modelo-identidad-acceso.md)
- [Credenciales, invitaciones, activación y recuperación HU-006–009](modelo-ciclo-acceso.md)
- [Glosario de identidad y acceso](../architecture/domain-glossary.md)
- [Esquema integrado](schemas/identity_access.sql)
- [Épica de identidad y acceso](../epicas/ep-01-identidad-y-acceso/README.md)

## Nombre y entornos

Proyecto Supabase **CouchOneFit**, referencia `pcoyrxdeiigynmmpxtng`; URL de servicio `https://pcoyrxdeiigynmmpxtng.supabase.co`. La URL y una clave publicable no son el nombre de la base ni sustituyen una conexión PostgreSQL.

Decisión vigente del usuario: **un único proyecto Supabase, CouchOneFit, compartido por desarrollo y producción**, sin segundo proyecto ni ramas remotas. Ambos usos comparten tablas y datos: un cambio desde desarrollo afecta también producción. La base SQL del proyecto es `postgres`; no se renombra a partir de la etiqueta CouchOneFit.

Las pruebas automatizadas conservan una base local exclusiva **CouchOneFit_test**; nunca deben apuntar al proyecto compartido. **CouchOneFit_dev** queda como alternativa local opcional, no como otro entorno remoto creado.

Las tablas de negocio objetivo usan el esquema no expuesto `private`. El historial de migraciones usa la tabla interna `migrations.history`. Ambos son esquemas y tablas dentro de la base PostgreSQL seleccionada por `DATABASE_URL`, no bases separadas.

## Orden y aplicación de migraciones

Los archivos aplicados son 202610150001_inicial_identidad_acceso.sql, 202610160001_provision_administrador.sql, 202610190001_english_identifiers.sql, 202610190002_client_records.sql y 202610190003_account_lifecycle.sql. La tercera migración conserva las filas y renombra el esquema de identidad, las restricciones, los índices, las políticas, los roles de aplicación, los valores y los objetos del historial. Las dos últimas se aplicaron al proyecto compartido el 19 de octubre de 2026, a las 20:41 UTC, para expedientes y HU-006–009. Nunca edites ni renombres los archivos ya aplicados.

Aplica **solo las migraciones ordenadas** mediante `npm run db:migrate` en `apps/api`; no ejecutes el esquema integrado sobre esa base. La instantánea sirve para inspeccionar y comparar una base de prueba limpia. El ejecutor valida las sumas de verificación y aplica el SQL pendiente dentro de una transacción.

El ejecutor reconoce las variantes LF/CRLF del mismo SQL para permitir checkouts en distintos sistemas operativos; conserva las sumas históricas y rechaza cambios de contenido. La [CA pública versionada](../../apps/api/certs/README.md) permite usar `sslmode=verify-full&sslrootcert=certs/supabase-root-2021.crt` desde `apps/api` sin rutas absolutas propias de una computadora. Las credenciales siguen únicamente en el `.env` ignorado.

## Aplicación local

1. Usa una base local exclusiva para las pruebas; nunca apuntes las pruebas automatizadas al proyecto compartido.
2. Ejecuta `npm run db:migrate` desde `apps/api` con una conexión de migración que tenga los permisos DDL y de roles necesarios.
3. El ejecutor adquiere un bloqueo consultivo, valida las sumas de verificación y aplica los archivos pendientes en orden dentro de una transacción. Si un archivo aplicado cambió o falta en el historial, detiene la ejecución.
4. Configura por separado la conexión de ejecución. Recibe `couchone_authentication`, que hereda `couchone_registration`; las cuentas de ejecución no deben tener privilegios de superusuario, `BYPASSRLS` ni DDL.
5. Configura `AUTH_JWT_SECRET`, el origen Web permitido y TLS verificado para la API. Mantén los secretos fuera de Git y de las variables de Vite.

Los roles son globales al clúster: el SQL reutiliza roles seguros al migrar dev y test, comprobando atributos/membresías. La API no aplica migraciones al arrancar.

## Pruebas y producción

Configura `TEST_DATABASE_URL` con una base **local exclusiva ya migrada** y ejecuta `npm test` en `apps/api`. La suite crea datos únicos y triggers temporales de fallo; la prueba de migraciones crea y elimina tres bases temporales propias para una migración limpia, una instantánea y una actualización desde el historial anterior. Requiere permisos locales para esos triggers, `SET ROLE` y la creación de bases. Los archivos se ejecutan en serie. Valida también API con `npm run build`, Web con compilación y lint, y el flujo en el navegador.


Producción exige respaldo verificado, revisión central de migraciones/permisos, aplicación controlada y smoke del runtime restringido. Ante error antes del COMMIT, rollback automático; después, nueva migración inversa revisada o restauración del respaldo. No eliminar cuentas ni historial para revertir una entrega. Más campos de perfil o tablas de otro módulo se añaden mediante otra migración.

## Evidencia remota histórica previa a la refactorización — 15 de octubre de 2026

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

## HU-003 — provisión administrativa, 16 de octubre de 2026

Se aplicó `202610160001_provision_administrador.sql` mediante `npm run db:migrate` y se verificó su checksum remoto. La seed versionada `apps/api/scripts/seed-admin.ts` creó un administrador activo sin perfil profesional; una segunda ejecución preservó sus credenciales. El permiso SET temporal del operador se restauró. La provisión inicial dejó sus credenciales en `.env.admin` local ignorado. La seed actual es manual de un solo uso por cuenta, pide usuario/correo y muestra la contraseña aleatoria una vez sin guardar archivos ni usar variables `ADMIN_*`; no se reejecutó en remoto. No se alteró la cuenta profesional existente. [Procedimiento, permisos, matriz y evidencia HTTP/navegador](../epicas/ep-01-identidad-y-acceso/hu-003/README.md). La conexión runtime dedicada y el despliegue API/Web siguen pendientes.

## Incremento SaaS HU-010 a HU-014

La rama incorpora las migraciones de catálogo, relación de suscripciones y corrección incremental `202610260001_saas_integrity.sql`. El esquema integrado refleja las ocho migraciones. Aplicarlas antes de desplegar los consumidores actualizados; no editar hashes históricos. [Contratos, permisos y evidencia de EP-02](../epicas/ep-02-saas-y-administracion/README.md).

## Checkout simulado — HU-012 (acuerdo 25-oct-2026)

Aplicar `202610260002_simulated_checkout.sql` antes de API/Web del autoservicio. El esquema integrado refleja nueve migraciones. Retira escritura ordinaria de suscripciones al runtime; la activación solo ocurre por función restringida tras pago simulado aprobado propio, con auditoría y rollback. Admin solo consulta. No proveedor externo ni datos bancarios reales. [Contrato vigente](../epicas/ep-02-saas-y-administracion/README.md).

## Catálogo compartido — 25-oct-2026

Nueva migración `202610260003_live_plan_catalog.sql` agrega `professionals.plan_interest_id` y lectura de planes activos al rol de registro. Preserva el interés histórico y no activa suscripciones. El esquema integrado refleja diez migraciones; aplicar la nueva antes de desplegar el registro actualizado. Portada/registro/checkout consumen el catálogo persistido y no valores fijos del frontend.

## Expediente inicial — HU-015

La migración incremental `202610270001_client_initial_record.sql` agrega a `private.clients` fecha de nacimiento y medidas base. No modifica ninguna migración aplicada ni rellena filas existentes: las nuevas columnas permanecen anulables para expedientes pre-HU-015. Para nuevas altas, API y restricciones SQL exigen el conjunto base consistente y validan rangos, unidades y precisión; `goal` y las medidas opcionales continúan anulables. No almacena selector de cálculo de grasa, evaluaciones ni mediciones históricas.

El esquema integrado vigente es `schemas/identity_access.sql` y refleja las catorce migraciones en la rama HU-016. Valida instalación limpia y actualización con expedientes existentes únicamente contra `TEST_DATABASE_URL` local; nunca ejecutes las migraciones ni la suite contra el proyecto Supabase compartido.

### TT-010: lectura de expedientes

`202610280001_client_read_isolation.sql` sustituye la lectura general de `private.clients` por RLS de cuenta activa y propiedad. `202610280002_invitation_professional_lock.sql` conserva el bloqueo de la cuenta profesional en la consulta anónima limitada por invitación. La segunda migración corrige la regresión detectada después de aplicar localmente la primera, sin editar SQL ya aplicado. No hay borrado ni transformación de datos.

Los consumidores autenticados establecen contexto local a la transacción. Activación, directorio administrativo y limpieza usan funciones de capacidad limitada, sin lectura general ni privilegios elevados del login runtime. BD y API deben actualizarse de forma coordinada: una API anterior no establece todos los contextos requeridos. [Diseño, consumidores y evidencia](../epicas/ep-03-cartera-y-expediente/hu-015/tt-010-client-read-isolation.md). La revisión independiente y el cierre general de TT-010/D0 siguen pendientes.

## Consulta de cartera — HU-016

La migración 202610280003_client_portfolio_order.sql agrega únicamente el índice compuesto por professional_id, created_at DESC e id DESC para recorrido por propietario/cursor. No cambia datos, grants ni RLS. El repositorio profesional usa readAsSubject, parámetros y propietario además de RLS; la lectura por ID conserva NULL históricos. Ver [contrato y evidencia](../epicas/ep-03-cartera-y-expediente/hu-016/README.md).
