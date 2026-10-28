# TT-010: aislamiento de lectura de expedientes

## Regla y alcance

TT-010-2 exige roles/grants/RLS bajo el contexto de usuario/tenant elegido; TT-010-4 exige pruebas cruzadas API/BD con roles ordinarios. La aceptación establece «profesional A nunca lee/escribe cartera B». La política heredada `select_clients USING (true)` incumplía esa regla y exponía también las seis columnas físicas de HU-015. La evidencia anterior permanece en la revisión final como diagnóstico histórico, no como resultado vigente de aislamiento.

La nueva migración `202610280001_client_read_isolation.sql` sustituye esa lectura general y el enlace directo de cuenta durante activación. La migración adicional `202610280002_invitation_professional_lock.sql` conserva el bloqueo de la cuenta profesional activa dentro de la función limitada por token: el `FOR SHARE` ordinario de usuarios requiere política de escritura y no debe recuperarse suplantando al propietario. La primera ya estaba aplicada localmente; por eso no se reescribió. No cambian migraciones anteriores, datos, rangos, cupo ni contratos públicos. El esquema integrado reproduce sus políticas, permisos y funciones.

## Consumidores revisados

| Consumidor | Repositorio / script | Acceso después de la corrección |
| --- | --- | --- |
| Cartera profesional | `auth/repositories/access-records.ts` | Transacción con sujeto autenticado; RLS y filtro por profesional propio. |
| Perfil propio del cliente | `client/repositories/profile.ts` | Sujeto autenticado; solo expediente vinculado a su cuenta activa. No se condiciona a suscripción del profesional, conservando lectura legítima. |
| Login y sesión vigente | `auth/repositories/session.ts` | Login establece sujeto después de verificar contraseña; sesión usa identidad validada por firma/sid; consulta del cliente queda bajo RLS. |
| Renovación de sesión | `auth/repositories/session.ts` | Deriva sujeto del hash de refresh y sesión persistidos; luego conserva bloqueos, estado, vencimiento, consumo y detección de repetición. No toma identidad del cuerpo HTTP. |
| Emisión, reemplazo y revocación de invitación | `auth/repositories/invitations.ts`, `lifecycle.ts` | Sujeto del profesional autenticado antes de leer/bloquear expediente; conserva propiedad, suscripción y orden de bloqueos. |
| Prevalidación y activación anónimas | Los mismos repositorios | Función con hash exacto y vencimiento; devuelve solo identificadores y estado de una fila. No adopta el contexto del profesional descubierto. Enlace mediante función específica, sin UPDATE directo de `user_id`. |
| Recuperación asistida y lista de destinatarios | `auth/repositories/credentials.ts`, `access-records.ts` | Contexto del operador autenticado; propiedad corroborada, reautenticación y demás controles existentes. No lectura general para buscar clientes ajenos. |
| Cupo, alta y estado | `saas/repositories/capacity.ts` | `lockActor` ya establece sujeto; conteo e INSERT/UPDATE conservan contexto y transacción. |
| Suscripción propia | `professional/repositories/subscription.ts` | Contexto autenticado para contar cartera propia; no queda un contador cero por ausencia de contexto. |
| Directorio administrativo | `admin/repositories/professionals.ts` | Función de agregados solo para sujeto admin activo persistido. No concede SELECT de expedientes al administrador. |
| Limpieza de códigos vencidos | `scripts/cleanup-access-codes.ts` | Función que bloquea solo identificador con invitación vencida según reloj del servidor; no devuelve contenido del expediente. |
| Preparación QA | `scripts/prepare-access-e2e.ts` | Inserción sintética mediante conexión privilegiada local de preparación; no consumidor de SELECT de expedientes. |

## Frontera de confianza y privilegios especiales

`select_owned_clients` requiere cuenta persistida activa y coincidencia de `app.subject_id`: profesional propietario o cliente vinculado. Contexto vacío, desconocido, malformado o admin no habilita lectura de filas. `app.client_id` y `app.access_operation` no son excepciones de SELECT. El contexto es local a la transacción; se libera también ante errores.

Se conserva el modelo técnico existente: la conexión SQL pertenece exclusivamente a la API confiable, que establece el sujeto después de autenticarlo. Un GUC no acredita identidad por sí mismo frente a quien ya controle arbitrariamente esa conexión. No se expone su configuración como entrada HTTP ni se presenta esta corrección como aislamiento frente a una conexión runtime comprometida con capacidad de suplantar sujetos. Los grants heredados sobre otras tablas no quedan auditados ni resueltos por este cambio acotado.

Las cuatro funciones `SECURITY DEFINER` tienen nombres de objetos calificados, `search_path=pg_catalog,private`, SQL sin interpolación dinámica y EXECUTE revocado a PUBLIC, concedido solo al rol técnico. Sus operaciones están limitadas a:

- `invited_client_record`: hash SHA-256 exacto, vigencia y profesional activo; bloquea expediente y cuenta profesional y devuelve cuatro metadatos, nunca nombre, objetivo o medidas. El reloj recibido solo puede adelantar la caducidad, nunca prolongarla respecto al servidor.
- `link_invited_client`: operación de activación, identificador exacto, invitación vigente y cuenta cliente activa; no enlace genérico ni permiso UPDATE de columna al runtime.
- `admin_client_counts`: agregados por profesional solo para admin activo; sin filas clínicas.
- `lock_expired_invitation_client`: identificador de invitación vencida por reloj del servidor; sin datos clínicos.

Estas funciones ejecutan con el propietario de migraciones, que debe permanecer separado del login runtime. No se concede superusuario, BYPASSRLS ni propiedad de tablas al runtime. La elección no requiere una decisión de negocio nueva: conserva los flujos ya autorizados y restringe sus consultas.

## Verificación y estado

La suite nueva usa un LOGIN temporal real, sin superusuario, BYPASSRLS, creación de bases ni creación de roles, miembro únicamente del rol de aplicación. Prueba aislamiento en ambas direcciones, las seis columnas físicas ajenas, cartera propia HTTP/SQL, perfil propio, cuenta inactiva, contexto inválido, no filtración al devolver la conexión y restricciones de las funciones especiales. Las regresiones existentes cubren invitación, activación concurrente/rollback, autenticación, recuperación, cupo, administración y limpieza.

Resultado ejecutado el 28 de octubre de 2026: **91/91 pruebas aprobadas, 0 fallidas, 0 omitidas**, duración 52525 ms. Incluye las cuatro pruebas nuevas y las regresiones existentes. La prueba de migraciones compara instalación limpia y esquema integrado, actualización con expediente anterior y catálogo de permisos/cuerpos de las funciones; las trece migraciones coinciden con la instantánea. API compila. Antes de migrar/probar se cargó explícitamente `.env.test.local` y se verificó por configuración y consulta de identidad `127.0.0.1:5432/CouchOneFit_test`. Las suites crearon y eliminaron exclusivamente sus bases/roles temporales locales; no se limpió la fixture manual ni se usó Supabase.

Durante la recuperación se corrigió el correo no normalizado de la nueva fixture y se sustituyó el nombre global fijo `migration_runtime` por un rol aleatorio de cada ejecución. Había un rol fijo residual de la sesión interrumpida; no se eliminó ni se reutilizó. La regresión de activación se corrigió sin relajar aserciones ni eliminar la comprobación de vencimiento del servidor. La primera ejecución de 91 casos tuvo 77 aprobados y 14 fallidos; tras corregir preparación quedaron 82 aprobados y nueve regresiones de invitación, resueltas por la segunda migración y el ajuste del bloqueo. Los resultados finales sustituyen esos intentos fallidos para esta versión; el historial de diagnóstico no se confunde con deuda previa de main.

La revisión independiente, los casos manuales dirigidos ya documentados y la deuda previa de formato siguen pendientes. Este arreglo no declara TT-010 completo ni D0 cerrado y no autoriza push, integración o despliegue.
