# Evidencia local — HU-006–009

Corte: 19 de octubre de 2026. Rama de trabajo `codex/hu-006-009-identidad`. Se leyó DEVELOPMENT.md, convenciones de BD, glosario, CONTRIBUTING, requerimientos y decisiones vigentes del plan antes de concretar contratos. Se conservaron cambios locales previos de configuración/servidor. Las migraciones aplicadas anteriores son inmutables.

## Entrega y trazabilidad

| HU | Entrega | Aceptación verificable |
| --- | --- | --- |
| [006](hu-006/README.md) | PATCH propio, reautenticación, formulario móvil, cambio transaccional y revocación total. | Usuario/clave nuevos funcionan; los anteriores fallan; duplicado/confirmación/identidad manipulada no cambian nada; expediente preservado. |
| [007](hu-007/README.md) | Invitación privada por expediente, reemplazo/revocación, entrega/copiar en Web y prevalidación. | Propiedad/estados/TTL; código anterior inválido; sin código/hash en listado o auditoría. |
| [008](hu-008/README.md) | Activación anónima, aviso versionado, cuenta+vínculo+aceptación+DELETE en una conexión/transacción y sesión tras commit. | Un éxito concurrente, rollback por etapa, sin huérfanos/segundo expediente ni hash residual; acceso al expediente preparado. |
| [009](hu-009/README.md) | Recuperación asistida, permisos/reautenticación, reset separado, Web/móvil y comando de custodia. | Corroboración obligatoria, rechazo ajeno, TTL/replay/consumo, revocación total y misma cuenta/expediente. |

Las carpetas de cada HU contienen contrato y plan de implementación por tarea. [OpenAPI incremental](../../api/identity-lifecycle.openapi.json), [diccionario/RLS/operación](../../database/modelo-ciclo-acceso.md).

## Automatización

PostgreSQL real local aislado, puerto 55439, sin datos de Supabase compartido. La suite nueva crea su propia base temporal y un LOGIN con membresía `couchone_authentication`, sin DDL, superusuario o BYPASSRLS. Los fallos se inyectan desde la conexión operadora de pruebas; las solicitudes reales se ejecutan con el runtime restringido. Las bases/roles temporales de esa suite se eliminan al terminar.

`apps/api/tests/account-lifecycle.test.ts` cubre credenciales, propiedad/CSRF, estados/TTL, invitación mínima, canje/notice, duplicados, dos canjes simultáneos, downgrade con reserva existente, invitaciones simultáneas en expedientes distintos, carrera reemplazo/canje, fallos en las cinco etapas transaccionales, fallo de sesión tras COMMIT, recuperación legítima/ajena, permisos admin/profesional, corroboración, reautenticación, sustitución, TTL/replay, consumo concurrente, rollback y último administrador.

`apps/api/tests/migrations.test.ts` prueba instalación limpia, esquema integrado idéntico y actualización con cuentas/perfiles/aceptaciones/sesiones/refresh existentes preservados. Historial: cinco migraciones, diez tablas privadas. Los tests anteriores de registro/login/roles/sesiones siguen formando parte del gate.

`apps/mobile/test/account_access_test.dart` verifica formulario completo/confirmaciones/aviso sin datos físicos; error duplicado recuperable; prevalidación sin canje; doble envío bloqueado; procedimiento de recuperación y DTO mínimo; conservación de sesión ante reautenticación errónea y limpieza tras cambio exitoso. Las pruebas anteriores de login/rotación/logout/tema permanecen.

Separación de capas: rutas → controladores → servicios/validadores → repositorios (`credentials`, `invitations`, `access-records` y helpers `lifecycle`). No hay SQL en rutas/controladores/servicios. TTL utiliza un único instante por sentencia para conservar exactamente siete días/30 minutos.

Android incorpora el canal nativo que faltaba: AES-256-GCM con Android Keystore y preferencias privadas cifradas. El recorrido recrea la app para comprobar restauración sin el fallback en memoria. No se acredita iOS desde este entorno Windows.

La prueba `apps/mobile/integration_test/account_lifecycle_test.dart` ejecuta la app contra API/BD reales: invitación autorizada desde operador sintético, activación móvil, persistencia nativa al recrear la app, cambio de credenciales, login nuevo, logout, recuperación asistida y regreso al mismo expediente. Solo admite API loopback/emulador; necesita profesional/suscripción/expediente sintéticos preparados en la base local. No se ejecuta contra producción.

## Comandos reproducibles

En `apps/api`, configurar `DATABASE_URL` y `TEST_DATABASE_URL` con la base local exclusiva, secreto JWT de pruebas y `CORS_ORIGIN`; aplicar `npm run db:migrate`. Ejecutar `npm run build` y `npm test`.

Web: `npm --prefix apps/web run lint` y `npm --prefix apps/web run build`. Móvil: `flutter analyze`, `flutter test`; para Android, `flutter test integration_test/account_lifecycle_test.dart -d <emulador> --dart-define=API_BASE_URL=http://10.0.2.2:35412` con API local en 35412 y origen Web QA `http://127.0.0.1:5412`. Preparar primero la fixture con `npm run test:prepare:access` en API y `TEST_DATABASE_URL` local exclusiva (`CouchOneFit_test` o `cof_e2e_*`). Las credenciales sintéticas se configuran con `QA_PROFESSIONAL_USERNAME`/`QA_PROFESSIONAL_PASSWORD` en entorno del preparador y `--dart-define` de Flutter; no usar cuentas reales. La fixture es repetible y añade un expediente preparado para cada recorrido, sin cuentas maestras en la aplicación.

## Resultados ejecutados

| Comprobación | Resultado final |
| --- | --- |
| API TypeScript `npm run build` | Correcto. |
| API `npm test` | **59/59**, cero fallos/omitidas; 18 pruebas del incremento y regresión completa de registro/login/roles/sesiones/migraciones. |
| Migraciones | Instalación limpia, actualización con datos y esquema integrado idénticos; checksums anteriores preservados. |
| Web Oxlint + TypeScript/Vite | Correctos; sin avisos de lint en los archivos afectados. |
| Prettier en los ocho archivos Web modificados | Correcto. Un chequeo ampliado también señaló formato previo en `RegistrationPage.tsx`, fuera de este cambio; no se modificó esa pantalla. |
| Flutter `analyze` | Sin observaciones. |
| Flutter `test` | **13/13**, cero fallos; incluye cuatro pruebas nuevas de formularios/seguridad. |
| Android real `integration_test` | **1/1**, completado en emulador x86_64 API37 contra API/BD reales; APK debug compilado e instalado. Activación → restauración desde Keystore → cambio de clave → login → logout → recuperación → mismo expediente. |
| Navegador | Login real, cartera propia, generación/reemplazo, copiar/ocultar, revocación y selector de recuperación de la cuenta activada en Android. |
| Documentación/OpenAPI | Diez documentos nuevos con enlaces locales válidos; JSON OpenAPI3.1 y referencias internas de sus ocho rutas verificadas. |

[Captura Web sin secretos](artifacts/web-recuperacion.png). Todos los datos de los recorridos son sintéticos y locales. PostgreSQL de pruebas: 18.4; no se extrapola esta comprobación a un despliegue remoto PostgreSQL17 ni a dispositivos/API24/36 o iOS. No hay cambios automáticos de versión en dependencias existentes; `integration_test` agrega únicamente herramientas de desarrollo del SDK y sus transitivas.

## Límites y gates D0

Implementación local no equivale a merge/publicación. D0 requiere revisión por otro integrante; el contraste de Omar/Pukzil y la revisión humana del equipo no se inventan. El corte remoto requiere respaldo, migración con operador, runtime restringido, versiones compatibles y smoke de entorno. Las migraciones remotas se aplicaron posteriormente por instrucción expresa; véase el corte siguiente. No se desplegaron API/Web publicados.

HU-013 y HU-015 conservan su alcance: aquí solo se añade el contrato mínimo persistido de suscripción y se usa el expediente preexistente. No se completan por extensión administración de planes, altas/reactivaciones de cartera o datos físicos. Una cuenta nueva no obtiene plan automáticamente. Sin suscripción/expediente preparados, la invitación se deniega.

Operaciones debe programar diariamente `npm run db:cleanup:access` y custodiar el comando local de último administrador. No se inventan contacto humano, conexión de custodia o política de privacidad/legal. Rate limit en memoria por instancia: compartir almacén antes de escalar. Android de producción requiere `API_BASE_URL` HTTPS; HTTP está limitado al manifest debug para las pruebas locales.

Las verificaciones anteriores se ejecutaron; la existencia de archivos de pruebas no se usa como sustituto de sus resultados. Revisión humana, merge y despliegue siguen siendo gates externos expresamente pendientes.

## Aplicación en Supabase y conexión local — 19 de octubre, 20:41 UTC

Por instrucción expresa se utilizó el `DATABASE_URL` del `.env` local para aplicar
`202610190002_client_records.sql` y `202610190003_account_lifecycle.sql` al proyecto
compartido `pcoyrxdeiigynmmpxtng`, base `postgres`, PostgreSQL17.6. El ejecutor
versionado adquirió el bloqueo, validó el historial y confirmó ambas en una
transacción. Una segunda ejecución terminó sin migraciones pendientes. Las tres
sumas históricas anteriores no se modificaron.

Antes se guardó y releyó un respaldo lógico local ignorado en
`apps/api/.env.backups/`: contiene todas las filas de las cinco tablas privadas
existentes, historial y fuentes de las tres migraciones aplicadas. Su SHA-256 es
`d1da5793750b73f7c273ac192a491115bfe5a3d41c6c6defac6b99b554cd0ae1`.
Es un respaldo lógico de datos y fuentes, no un dump completo del clúster ni una
prueba de restauración. No contiene claves del `.env` y no se publica en Git;
incluye datos privados y hashes, por lo que debe conservarse localmente.

Después del COMMIT se comparó cada fila con el respaldo: dos cuentas (una admin,
una professional), un perfil, una aceptación, seis sesiones y 18 hashes de
renovación idénticos. Se verificaron cinco entradas del historial, diez tablas
privadas con RLS y ausencia de USAGE para `anon`/`authenticated`. No se crearon
cuentas sintéticas, planes ni expedientes en el proyecto compartido.

El fallo de acceso local era `ENOENT` al buscar la CA en una ruta de otra
computadora. La [CA pública](../../../apps/api/certs/README.md) queda versionada
y el `.env` usa una ruta relativa. La conexión cliente–pooler confirmó
`encrypted=true` y `authorized=true`, manteniendo `verify-full`. Tras recargar el
servidor, tanto API3000 como el proxy Web5000 respondieron salud200, login de
identidad inexistente401 (`INVALID_CREDENTIALS`, sin error de conexión) y código
de invitación inexistente400 (`INVITATION_UNAVAILABLE`, consultado en remoto).
Esto acredita conectividad y contrato, no conocer ni probar la contraseña del
usuario. El sitio habitual es `http://127.0.0.1:5000/acceso`; el puerto5412 era
exclusivo del recorrido sintético anterior.

La prueba de migraciones local ahora también cambia únicamente los saltos de
línea del checksum histórico y verifica que no se reaplique SQL; mantiene el
rechazo de contenido modificado. Se observó el fallo antes de corregir el
ejecutor y el éxito posterior. Las suites automatizadas siguen usando la base
local exclusiva, nunca Supabase compartido.

Verificación posterior del corte: API TypeScript compiló y la suite local
completa pasó **59/59**, sin fallos ni omisiones, con la regresión LF/CRLF incluida.
