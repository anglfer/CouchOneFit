# EP-03 — Seguimiento de auditoría, 31/oct/2026

Rama: `feature/api-client-portfolio`. Parte de la [auditoría inicial](auditoria-2026-10-31.md), sobre el commit `3739ab4ae7caadaa00bc2470e162a8b8adc5afd8`. La persona usuaria autorizó corregir lo propio de EP-03 y dejar las dependencias de otras HU en sus sprints, sin implementar esas épicas aquí. No se cambia el alcance V2, los responsables ni los SP, y no se acredita revisión independiente.

## Correcciones del incremento actual

- [x] Reproducir la búsqueda fallida `😀 ána` → `Literal 😀 Ána` en PostgreSQL 17.6, locale C: falla antes de la corrección.
- [x] Aplicar `lower(... COLLATE pg_catalog.pg_c_utf8)` a ambos operandos en `professional/repositories/portfolio.ts`. Solo cambia la comparación de nombres: no modifica esquema, datos, índices, cursores, permisos o cupo. Requiere PostgreSQL 17+ / UTF8, compatible con la plataforma documentada. No depende de ICU ni del locale de la base. `á` y `a` siguen siendo distintos; no se agrega búsqueda sin acentos, por correo ni normalización Unicode adicional.
- [x] Agregar regresión que fuerza columna C y prueba mayúsculas acentuadas, emoji, acentos distintos y dos propietarios. Suite de aislamiento posterior: **33/33** en locale C; incluye las pruebas de paginación, propiedad, edición, estados y perfil propio existentes.
- [x] Normalizar finales de línea de nueve archivos Web de expediente y pruebas; su contenido versionado ya tenía el formato esperado. Añadir reglas LF exactas en `apps/web/.gitattributes` para conservar el resultado en futuros checkouts Windows. No se reformatean archivos de otras features ni se cambia el comportamiento React.
- [x] Actualizar contrato de búsqueda en OpenAPI, HU-016 y guía BD con requisito PostgreSQL/UTF8 y consulta de comprobación. No se cambian migraciones aplicadas ni se crea una migración de datos innecesaria.
- [x] Actualizar plan, referencias de HU afectadas y relevo con entregables, responsables, sprints y condiciones de aceptación.
- [x] Reparar enlaces locales del plan que apuntaban a rutas de la raíz como si estuvieran dentro de `plan/`; se mantienen las fuentes y el texto histórico.

## Redistribución vigente por instrucción de la persona usuaria

La [matriz del plan §10](../../../plan/PLAN_TRABAJO_V2.md#seguimiento-ep03) sustituye la asignación anterior a S3–S5/Franela. El orden es EP-04 → EP-05 → EP-06 → EP-07 → EP-08. Cada HU fuente entrega su conexión y pruebas como parte de esa misma épica; no deja un servicio pendiente de integración en EP-03.

| Pendiente de producto trasladado | Destino y ejecutor de módulo + conexión | Criterio de entrega |
| --- | --- | --- |
| Evaluaciones/evolución del expediente | EP-04, HU-021/022, Pukzil | API/contrato/UI conectados, datos/vacío/error, origen/fechas/unidades y conservación; sin depender aún de peso móvil. |
| Alimentación del expediente | EP-05, HU-026, Pukzil | Plan activo/versionado visible en expediente, V1/V2 y permisos probados. |
| Entrenamiento del expediente | EP-06, HU-030, Ferxxo | Rutina activa/versionada visible en expediente y móvil, descanso, aislamiento e historia intacta. |
| Seguimiento y peso del expediente | EP-07, HU-033/037, Ferxxo | Fuentes reales conectadas, peso/carga separados y peso móvil incorporado a los consumidores de evolución existentes. |
| Progreso autorizado del perfil móvil, RDC0204 | EP-07, HU-036, Pukzil | Conexión al perfil existente, permisos default off, categoría/periodo y revocación efectiva; API/móvil/contrato/tests juntos. |
| Históricos reales y fixture integral | QA de cada HU fuente; HU-033-QA1 coordina regresión con secciones previas en EP-07 | Edición/inactivación/reactivación/cambio de versión conserva registros no vacíos; no basta probar el lector aislado. |
| Deuda global de formato | TT-013/019 y dueños de archivos | Coordinación y comprobación global; 60 avisos documentados fuera de los nueve archivos atendidos. |

**Qué queda propio de EP-03:** la auditoría no identificó otro defecto funcional base pendiente tras corregir Unicode. HU-015–018 y la base implementada de HU-019/020 conservan sus pruebas/evidencia y requieren revisión independiente/aceptación D0 aplicable. No se acredita esa revisión por mover tareas. TT-010 transversal y DEC-011/015 mantienen sus responsables y condiciones; no se presentan como funcionalidades faltantes del expediente base.

**Cambio de alcance de entrega:** HU-019 queda acotada a base del expediente/disponibilidad de secciones y HU-020 a perfil base propio; las conexiones futuras antes incluidas en su cierre pasan explícitamente a las HU de la tabla. RDF0404/RDC0204 siguen pendientes como requisitos del producto hasta sus entregas fuente. No se afirma que estén implementados ni se eliminan del backlog; EP-03 ya no espera su implementación para aceptar su alcance base. Franela puede revisar puntos compartidos sin ser ejecutora obligatoria de una etapa posterior.

Hasta cada entrega se conserva el estado no integrado; no se inventan datos, tablas, vacíos consultados ni permisos anticipados. Cada módulo modifica los archivos compartidos necesarios en su propia entrega coordinada. No se altera D0 general: se redistribuyen criterios/tareas concretos y se conserva trazabilidad, sin duplicar HU/SP; el esfuerzo se revisa al comprometer cada épica.

## Verificación posterior a la corrección

La redistribución posterior solo modifica documentación: se comprobaron siete documentos, 97 enlaces locales sin destinos faltantes y siete notas de integración con IDs de tareas válidos. No se repiten suites de producto por este cambio documental; los resultados siguientes pertenecen a la corrección funcional anterior.

| Comprobación | Resultado |
| --- | --- |
| API build | Aprobado. |
| API aislamiento, base C y regresión columna C | 33/33 aprobadas. |
| API suite completa en base C | 121/121 aprobadas (113.6 s), incluida migración limpia/actualización, aislamiento, cupo, concurrencia, atomicidad y sesiones. |
| Web build + PWA | Aprobado. |
| Web tests | 36/36 aprobadas. |
| Web lint | Aprobado. |
| Formato de los nueve archivos EP-03 | Aprobado; reglas Git LF comprobadas. |
| Formato global Web | 60 avisos fuera de los nueve archivos atendidos; asignados a S6. |
| OpenAPI/referencias y enlaces documentales | 56 referencias OpenAPI y 107 enlaces locales de los ocho documentos revisados, sin destinos faltantes; ancla de seguimiento comprobada. No equivale a validar semánticamente todas las respuestas HTTP futuras. |

Solo se usan bases temporales locales en loopback. Una ejecución de la suite completa se interrumpió por `ECONNRESET`: faltaban archivos auxiliares del paquete PostgreSQL temporal (`share/timezonesets`). Se restauraron archivos locales faltantes del paquete ya disponible y se repite la suite; esa ejecución interrumpida no se acredita como regresión funcional ni como prueba aprobada.

Móvil no cambia en este incremento: la auditoría previa registró 41/41 y análisis sin incidencias; no son ejecuciones nuevas. No se repite recorrido humano de navegador/Android, no se modifican datos compartidos ni se realizan commit/push/PR/merge/despliegue. La aceptación de cada HU fuente exige su conexión y pruebas futuras; la aceptación de la base EP-03 exige su propia revisión independiente, sin esperar a implementar las fuentes trasladadas.

## Revisión 02/nov/2026 — recuento HU-014 y suite completa

Revisión de la persona usuaria sobre la rama común, sin commit/push/PR.

- [x] El plan añadió a HU-015-QA1 y HU-018-QA1 comprobar el recuento HU-014. Nueva prueba en `apps/api/tests/saas.test.ts` («admin directory counts follow record creation, inactivation and reactivation»): `/api/admin/professionals` devuelve `clientsUsed`/`inactiveClients` 0/0 → dos altas 2/0 → inactivar 1/1 → reactivar 2/0, con runtime restringido.
- [x] Plan §8/§10: HU-019/020 pasan a `Impl local` base y se retira «HU-019/020 completo» de S5, conforme a la redistribución del 31/oct.

| Comprobación | Resultado |
| --- | --- |
| API build | Aprobado. |
| API suite completa (PostgreSQL 18.1 local, `CouchOneFit_test` migrada con las 18 migraciones) | **126/126** (107 s). |
| Web tests / lint / build + PWA | 38/38, aprobado, aprobado. |

Requisitos de entorno observados: `TEST_DATABASE_URL` debe exportarse en el shell (varios tests la leen antes de cargar `.env`), apuntar a `127.0.0.1` (no `localhost`, exigido por `client-read-isolation.test.ts`) y a una base `_test` local ya migrada (`DATABASE_URL=<url de prueba> npm run db:migrate`). Nunca con la `DATABASE_URL` compartida. Móvil y recorridos humanos no se repitieron. D0.8 (revisión de otro integrante) sigue sin acreditarse.

## Revisión integral 02/nov/2026 — EP-03 de extremo a extremo

Revisión por el asistente a petición de la persona usuaria (HU-015, HU-007, HU-008, HU-016–020) contra criterios, tareas, DoD, DEC-003/004/005/006/017 y OpenAPI. Sin commit/push/PR. No acredita revisión independiente (D0.8).

- [x] **Defecto corregido (HU-015-WEB1 / HU-013–014):** tras un alta exitosa la Web no volvía a consultar `/api/me/subscription`, así que el resumen de cupo del inicio seguía mostrando el uso anterior hasta recargar (HU-018 sí lo refrescaba). `ClientAccessPanel.tsx` llama ahora al mismo `onStatusChanged()` que usa el cambio de estado. Prueba Web ampliada: «a failed manual save keeps every field…» exige una lectura de suscripción adicional tras el guardado; falló antes de la corrección (2≠3) y pasa después.
- [x] **Flujo encadenado de la épica (T; actualización HU-021, 9/nov):** la prueba vertical «HU-020 vertical registration invitation activation…» (`apps/api/tests/client-read-isolation.test.ts`) continúa sobre el mismo expediente activado: HU-016 lo lista con `userId`/`accountStatus` y sin invitación residual; HU-019 compone el perfil editado; HU-021 devuelve `evaluations: empty` cuando no hay filas y prueba por separado los datos reales del módulo; HU-018 lo inactiva (aparece en filtro inactivo, el cliente sigue leyendo), una nueva invitación se rechaza, la baja de la cuenta revoca la sesión (401) y bloquea el login; el expediente sigue existiendo (sin DELETE).
- [x] Sin cambios: API/BD de HU-015/007/008/016–020 (cupo con bloqueo del profesional, invitación DEC-003, canje anónimo atómico, concurrencia, replay, auditoría sin token/hash, cartera con cursor, versión/conflicto, baja lógica y perfil propio DEC-017) y móvil (activación con aviso versionado y prevalidación no consumidora → perfil propio). Ya estaban cubiertos por pruebas que se volvieron a ejecutar.
- [ ] Fuera del alcance ejecutable: invitación por correo (DEC-017) espera proveedor de correo y campo de correo del cliente, con preguntas abiertas y sin HU asignada; progreso RDC0204 (HU-036) y secciones RDF0404 (EP-04–07) siguen trasladados.

| Comprobación | Resultado |
| --- | --- |
| API build | Aprobado. |
| API suite completa (PostgreSQL 18 local `127.0.0.1/CouchOneFit_test`, 18 migraciones) | **127/127**. |
| Web tests / lint / build + PWA | **38/38**, aprobado, aprobado. |
| Prettier de los archivos tocados | `ClientAccessPanel.tsx` aprobado. `session-recovery.test.mjs` solo conserva dos avisos previos (líneas ~228/246) y CRLF del checkout; el fragmento nuevo cumple. |
| Móvil `flutter analyze` / `flutter test` | Sin incidencias / **41/41** (sin cambios móviles). |
| `git diff --check` | Limpio. |
| Recorrido en navegador | No completado: la sesión abierta en el navegador integrado pertenecía a una cuenta QA previa (`qa.audit.pro`) y no se cerró ni se modificó su cartera. El recorrido HTTP se acredita con la prueba vertical (T), no como reporte humano. |

### Recorrido visual 02/nov/2026 (asistente, no sustituye revisión humana)

Web (navegador integrado, 1280 px y 375 px) y app móvil en emulador Android (Medium_Phone, API 37) contra API local y `CouchOneFit_test`, con datos sintéticos (cuenta de pruebas `qa.audit.pro`, cliente «Valeria Ñúñez QA Visual»). **T/E**, no **R**.

- [x] Web: alta → cupo 0/10→1/10 sin recargar (corrección anterior) → cartera → invitación → ficha → edición (63.1 kg) → inactivar/reactivar con modal → ancho 375 px.
- [x] Móvil: bienvenida → activar cuenta → código falso («El código no está disponible…») → código real («El código está disponible. Comprobarlo no lo consume.») → campos → aviso sin marcar. La activación vinculó la cuenta (cartera: `userId` presente, cuenta activa, sin invitación residual).
- [ ] **No visto en este recorrido:** el perfil del cliente tras activar ni el login móvil. La app debug quedó en «no responde» (ANR); la carga del equipo se consideró una posible causa, sin diagnóstico suficiente para atribuirle ese ANR. Pendiente de recorrido humano en un teléfono físico (ver guía de HU-020).

Ajustes de presentación derivados (sin cambiar contratos ni lógica):
- Web: enlace del nombre en la cartera con color y subrayado; botones agrupados; código de invitación dentro de la tarjeta de su cliente (antes quedaba al final de la página); avisos de éxito en verde con ✓ y visibles tras guardar; ficha con datos en cuadrícula, fecha legible («14 de marzo de 1998») y secciones en tarjetas; diálogos de estado/cuenta centrados, con fondo oscurecido y botones con estilo.
- Móvil: el resultado de «Comprobar código» aparece bajo su botón (antes al final del formulario, fuera de vista); un error posterior de envío lo reemplaza junto a «Activar mi cuenta». Prueba nueva en `account_access_test.dart`.

Verificación: Web 38/38, lint y build OK, Prettier OK en los 6 archivos tocados; móvil `flutter analyze` sin incidencias y 41/41.

### Continuación 02/nov/2026 — login y perfil Android (Codex)

Se retoman los dos puntos que no se pudieron ver en el recorrido anterior.
Prueba del asistente **T/E**, no aceptación humana **R** ni revisión independiente
D0.8. Se conservan los cambios de presentación anteriores; no hizo falta cambiar
código funcional de login/perfil.

- **Entorno comprobado:** API en `127.0.0.1:3000`, conexión efectiva a
  `CouchOneFit_test` local. Sin acceso ni escritura en producción.
- **Diagnóstico del AVD anterior:** `Medium_Phone` API 37 registró ANR de teléfono,
  System UI, teclado, launcher y servicios Google antes de abrir CouchOneFit. Se
  inspeccionó en pantalla «Pixel Launcher isn't responding». `/data` estaba al
  93 %, con 459 MB disponibles; Android registró fallos al intentar liberar
  espacio. Esto acredita problemas del entorno, pero no establece la causa
  exacta del ANR de la app del recorrido anterior ni descarta cualquier problema
  de rendimiento de la app.
- **Recorrido completado:** AVD nuevo `CouchOneFit_QA_Codex`, API 37/x86_64,
  720×1600, disco de datos 12 GB (11 GB disponibles al iniciar), renderizador
  software, dos núcleos solicitados y 4096 MB de RAM efectiva impuesta por el
  emulador. Se usó `--no-enable-impeller` en la prueba, sin modificar configuración
  de producto. El primer arranque también registró ANR de servicios Google;
  hubo una actualización simultánea de Play Store durante la instalación. No se
  presenta este AVD como una reparación general del emulador original.
- **Fixture aditiva:** preparador existente `prepare-client-record-e2e.ts`,
  profesional nuevo `qa.hu020.mvziw5uz`, expedientes sintéticos A/B; A se activó
  mediante API como `mobile.mvziw5uz`. No se restablecieron cuentas anteriores.
  Lectura SQL posterior confirma a Valeria con el mismo vínculo, objetivo
  «Definición», peso 63.1 kg y cuenta activa. Credenciales solo en archivos
  `.env.*` locales ignorados.
- **Prueba nueva:** `apps/mobile/integration_test/client_login_profile_test.dart`
  ejecuta la UI Flutter en Android con la API real, sin mocks: bienvenida → login
  → expediente propio con nombre/usuario/correo/objetivo → actualizar → datos base
  (15/06/1990, 170.5 cm, 70.2 kg) → recrear la app y restaurar desde el almacén
  nativo → cerrar sesión → bienvenida/login, sin datos del cliente ni sesión en
  el almacén activo o en una lectura nativa nueva. Las credenciales se introducen
  con el tester porque la entrada de teclado mediante ADB perdió caracteres.
- **Inspección visual:** capturas del perfil y de las medidas tomadas durante el
  desarrollo de la prueba y revisadas por el
  asistente; textos y acciones legibles, nombre largo en varias líneas, objetivo
  y unidades visibles, progreso descrito como todavía no disponible. Copias
  locales ignoradas en `apps/mobile/.env.codex-evidence/client-login-profile.png`
  y `client-base-measurements.png`; no son capturas humanas.
- **Ajustes de la prueba durante su desarrollo:** una ejecución esperaba login
  directo después de cerrar una sesión restaurada, pero el comportamiento
  existente vuelve a bienvenida; otra leía el fallback de la instancia descartada.
  Se corrigió la prueba para comprobar la navegación real y el almacenamiento
  de la instancia vigente, más una instancia nueva. Ambos fallos correspondían
  a expectativas incorrectas de la prueba; la ejecución final pasó completa.

| Comprobación nueva | Resultado |
| --- | --- |
| `flutter analyze` | Sin incidencias. |
| Suite móvil de widgets/unidad `flutter test` | **41/41**. |
| Análisis y formato del nuevo test de integración | Sin incidencias; formato correcto. |
| Recorrido Android de login/perfil | **1/1**, ejecución final 36 s; login, medidas, actualización, restauración y logout aprobados. |
| APK debug x86_64 de la app | Compilado con `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\pipetmp`. |

Se reprodujo el fallo Gradle «Unable to establish loopback connection» con una
carpeta bajo `%TEMP%`; la ruta corta `C:\pipetmp` permitió compilar. Procedimiento
y reproducción del recorrido añadidos a `apps/mobile/README.md`. No se borra esa
carpeta mientras haya procesos Java que puedan usarla. La activación UI inmediata
→ perfil con la cuenta Valeria no se repitió; la activación API nueva y el login
móvil posterior sí se comprobaron. No se acredita teléfono físico, iOS, release,
aceptación humana ni diagnóstico causal completo del ANR original. Sin
commit/push/PR/despliegue. Web y API no se modificaron en esta continuación ni se
atribuyen como nuevas sus suites previas.

Cierre de esta continuación: APK normal de `lib/main.dart` recompilado después
del test (debug x86_64, 33.5 s, sin defines QA de integración). API propia detenida
tras verificar el proceso propietario del puerto; AVD `CouchOneFit_QA_Codex`
apagado mediante su consola ADB. Se conservan fixtures, AVD aislado y capturas
locales para reproducir. `git diff --check` sin errores de espacios.

## Implementación DEC-017 pendiente de EP-01/02/03 — 02/nov/2026

A petición de la persona usuaria («haz lo que falta»), el asistente implementó lo pendiente de DEC-017 que no depende de un proveedor externo. **T/E**, sin revisión independiente (D0.8) ni recorrido humano **R**. Detalle de contratos y decisiones en [EP-02](../ep-02-saas-y-administracion/README.md#ciclo-de-vida-dec-017) y en la [guía de BD](../../database/README.md).

- [x] Renovación automática simulada (perezosa), 7 días de gracia, cancelar al final del periodo, bajar de plan eligiendo clientes a inactivar (migración `202611020001`; API `PATCH /api/me/subscription`, `POST /api/me/subscription/downgrade`; Web `SubscriptionLifecycle`).
- [x] Soporte del administrador: directorio, consulta de datos básicos con motivo, reset de cliente con motivo y bitácora admin (migraciones `202611020002`–`3`; API `/api/admin/support/*`; Web `SupportPanel`).
- [x] OpenAPI (`/api/me/subscription*`, `/api/admin/support/*`, `reason` en la recuperación) y plan DEC-017 actualizados.
- [ ] **Sigue pendiente y no implementable sin decisión/proveedor:** envío real de correos y push, invitación por correo (falta correo del cliente en el expediente y proveedor), aviso de privacidad/consentimiento para 16–17 años (DEC-015).
- [ ] Decisión a ratificar por el equipo: la bajada de plan aplica de inmediato, sin devolución, y el precio menor rige desde la siguiente renovación.
- Limitación conocida: la renovación solo se evalúa cuando el profesional (o su cartera) se consulta; sin un cron externo, un cliente de un profesional ausente ve el plan vencido hasta que este vuelva a entrar.

| Comprobación | Resultado |
| --- | --- |
| API build | Aprobado. |
| API suite completa (PostgreSQL 18 local `127.0.0.1/CouchOneFit_test`, 21 migraciones) | **132/132** (incluye 5 pruebas nuevas). |
| Web build + PWA / lint | Aprobado / sin avisos. |
| Web tests | 38/38. |
