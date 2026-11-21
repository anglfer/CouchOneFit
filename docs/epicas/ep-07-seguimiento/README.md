# EP-07 — Seguimiento integrado (`HU-032` a `HU-037`)

Historias: HU-032 (check-in diario), HU-033 (seguimiento y adherencia en Web),
HU-034 (inicio profesional real), HU-035 (resumen del día en móvil), HU-036
(historial propio autorizado) y HU-037 (peso corporal diario). HU-038 (fotos)
sigue **fuera de V2** (DEC-010): no hay medios, buckets ni cámara.

Estado al 20-nov-2026: **implementado y validado localmente (T/E)** en BD,
API, Web y móvil. Falta la aceptación humana (R), la revisión independiente,
la prueba en dispositivo Android y el resto de D0; ninguna HU se declara
completa. Los responsables originales (Omar en HU-034/035, Pukzil en HU-036)
deben revisar las partes que el plan les asigna.

## Replanteamiento frente al backlog (20-nov-2026, a ratificar por el equipo)

La persona usuaria pidió revisar si EP-07 estaba bien planteada para lo que ya
existe y corregir la dirección donde no lo estuviera, tomando como referencia
el check-in de su app `fitnextfy` (fechas pendientes, sueño con atajos,
escalas 1–5 con etiqueta, comentario), «parecido, no igual». Decisiones
técnicas tomadas; prevalecen sobre el texto de las HU donde lo contradicen:

| Plan original | Implementación | Por qué |
| --- | --- | --- |
| HU-037: «evento» de peso propio relacionado con el check-in y «composición atómica» de dos escrituras. | El peso es una **columna del check-in** (`body_weight_kg`). La lectura lo proyecta como evento `{unit:'kg', source:'check_in'}`. | Una sola fila: el envío conjunto es atómico por construcción, no hay tabla duplicada ni deduplicación, y cada corrección queda en las revisiones del check-in. |
| HU-032: «campos habilitados». | Todos los campos DEC-006 son opcionales; no hay configuración por cliente. El cumplimiento alimenticio solo se pide si había plan alimenticio vigente ese día. | El plan no definía quién habilita qué. Así `not_applicable` no puede ocultar un día con plan (DEC-008). |
| HU-032: «cumplimiento» dentro del check-in para todo. | El check-in solo registra el **cumplimiento alimenticio**. El de entrenamiento sale de las sesiones finalizadas de EP-06 y el check-in solo lo muestra. | Evita dos fuentes del mismo dato. |
| — | Se añade **hambre** (1 poca – 5 mucha), como en `fitnextfy`. | Contexto útil para nutrición; es opcional y amplía DEC-006 solo en ese campo. |
| HU-033: detalle por ejercicio/serie dentro de la nueva vista. | `GET /api/clients/:clientId/follow-up` incluye `sessions[]` con detalle por ejercicio/serie prescrito vs realizado y `versionNumber` en **Seguimiento**, además de mantener el enlace directo a *Entrenamiento*. | Permite revisar check-ins, adherencia, peso y ejecución por serie/versión del periodo en la misma vista sin duplicar la gestión de plantillas/rutinas de EP-06. |
| HU-034: nuevos agregados de dashboard. | `GET /api/training/clients` añade `lastCheckIn`, `lastCheckInAt`, `checkInToday` y `checkInRecent`, y `GET /api/follow-up/summary` expone la adherencia de cartera a 7 días reutilizando `adherenceDays` / `summarize` de HU-033. | Un solo endpoint de cartera para listas/pendientes y un resumen dedicado que reutiliza el cálculo DEC-008 sin duplicarlo. Cupo y activos siguen saliendo de la suscripción. |
| HU-035: `GET /api/me/day`. | **No se crea.** Inicio usa los endpoints existentes (rutina, plan alimenticio) y el contexto de check-in, cada uno con su error y vacío. | El agregador acoplaba los errores; la app ya cargaba cada módulo por separado. |
| HU-036: todo el historial propio *default off*. | El cliente **siempre** ve lo que él registró (check-ins y peso), igual que su bitácora de entrenamiento desde el 04-nov. El profesional decide, *default off*, si comparte **medidas** (evaluaciones) y **adherencia**. | Ocultarle al cliente lo que él mismo escribió no protege nada; DEC-009 se aplica a lo que produce el profesional. |

## Base de datos

Migración `202611200001_daily_check_ins.sql` (también en
`schemas/identity_access.sql`):

- `private.check_ins`: uno por `client_id` + `local_date`, `time_zone`
  fotografiado al crear, `revision`, valores opcionales y
  `nutrition_version_id` (solo con estado explícito). `CHECK` de rangos y
  precisión, «al menos un valor real» (`nutrition_compliance = 'not_applicable'`
  por sí solo no basta; debe acompañar otra métrica/comentario o usar
  `'completed' | 'partial' | 'not_completed'`) y coherencia cumplimiento ↔
  versión. Trigger `guard_check_in` (`SECURITY DEFINER`, solo comprueba):
  identidad inmutable, revisión +1, zona igual a la del cliente al crear y
  versión nutricional publicada del propio cliente.
- `private.check_in_revisions`: instantánea completa de cada revisión.
- `private.client_visibility`: `measurements` y `adherence`; sin fila = todo
  oculto.
- RLS: el cliente lee todos sus check-ins y escribe solo hoy y las dos fechas
  anteriores de su calendario con cuenta/suscripción habilitadas (DEC-004);
  el profesional lee los de su cartera. `client_evaluations_client_read` deja
  al cliente leer sus evaluaciones solo con `measurements` activo, y
  `training_versions_adherence_read` le deja leer la rutina que aplicó cada día
  solo con `adherence` activo.

### Correcciones colaterales en la misma migración

- **EP-06:** la política `training_session_read` solo dejaba al cliente leer
  las sesiones de los últimos 3 días, así que `GET /api/me/training-history`
  (Progreso, racha, actividad de 17 semanas) quedaba recortado en la práctica.
  `training_sessions_own_history` permite leer toda la bitácora propia; la
  escritura sigue limitada a la ventana.
- **EP-05:** `nutrition_activations` tenía política de lectura pero no
  `GRANT SELECT`; se concede (la política sigue limitando las filas).

## API (`apps/api/src/features/follow-up/`)

| Método y ruta | Rol | Uso |
| --- | --- | --- |
| `GET /api/me/check-ins/context?date` | cliente | Ventana (`dates[]` con `recorded`), check-in de la fecha, `nutrition {applicable, planName}`, `training {kind, dayName, sessionStatus}` o `null`, `canWrite`. Fecha fuera de la ventana: 400. |
| `POST /api/me/check-ins` | cliente | `{id, localDate, revision, bodyWeightKg, sleepHours, stress, energy, hunger, nutritionCompliance, comment}`. `revision` 0 crea; la actual corrige. `Idempotency-Key` UUID: misma clave y cuerpo → respuesta original; otro cuerpo → 409 `IDEMPOTENCY_KEY_REUSED`; revisión vieja o segundo id para la fecha → 409 `CHECK_IN_CONFLICT`. Móvil con Bearer; navegador con CSRF. |
| `GET /api/me/check-ins?offset` | cliente | Historial propio, 60 por página. |
| `GET /api/me/progress?days` | cliente | Agregado HU-036 (`days` 1–366, por defecto 28): `visibility` y solo las categorías compartidas (`measurements`, `adherence`). Lo oculto no aparece ni como lista vacía. `SharedMeasurement` conserva `effectiveDate` en `date`, `source: 'professional_evaluation'` y `method` (`perimetros`, `pliegues`, `bioimpedancia`). |
| `GET /api/me/progress/measurements` | cliente | Recurso dedicado de evaluaciones compartidas: 403 `VISIBILITY_DENIED` sin datos si no se comparte. |
| `GET /api/me/progress/adherence?days` | cliente | Recurso dedicado de adherencia compartida: 403 `VISIBILITY_DENIED` sin datos si no se comparte. |
| `GET /api/follow-up/summary` | profesional | Resumen de adherencia de cartera a 7 días (clientes activos únicamente) que reutiliza `adherenceDays`/`summarize` de HU-033. |
| `GET /api/clients/:clientId/follow-up` | profesional dueño | Acepta `?days=1..366` o `?from&to` (mutuamente excluyentes; por defecto 28 días, máx. 366). Devuelve check-ins, `bodyWeight[]` (con `timeZone`, `unit: 'kg'`, `source: 'check_in'`), `sessions[]` (detalle por ejercicio/serie prescrito vs realizado y `versionNumber`), `adherence {training, nutrition}` y `visibility`. |
| `PATCH /api/clients/:clientId/visibility` | profesional dueño | `{measurements, adherence, revision}`; idempotente, 409 por revisión, auditado en `training_audit` (`visibility_changed`). |
| `GET /api/clients/:clientId/record` | profesional dueño | `bodyWeightHistory` pasa de `not_integrated` a `available {entries}` (10 últimos, con `timeZone`) / `empty` / `error`. |
| `GET /api/training/clients` | profesional | Añade `lastCheckIn`, `lastCheckInAt`, `checkInToday` y `checkInRecent` para el inicio profesional. |

Adherencia (`domain/adherence.ts`, DEC-008): por día aplicable según la
versión **vigente ese día** (`training_activations` / `nutrition_activations`).
Entrenamiento: sesión finalizada con todas, algunas o ninguna serie realizada
→ `completed` / `partial` / `not_completed`; borrador o sin sesión = sin dato.
Alimentación: estado explícito del check-in. Observado = (cumplidos + 0,5 ×
parciales) / días con estado; cobertura = días con estado / aplicables;
denominador 0 → `null`. Sin promedio global.

## Experiencia

- **Web profesional:** nueva pestaña **Seguimiento**
  (`/app/clientes/:id/seguimiento`) con periodos `?days=` (7 días / 4 semanas /
  3 meses) y rango personalizado `Desde`/`Hasta` (periodo y `timeZone`
  mostrados desde el servidor), adherencia de entrenamiento y alimentación
  (observada + cobertura; «—» cuando no hay días con plan), peso corporal con
  trazo `--ws-primary`, lectura explícita cuando hay una sola medición, gráfica
  SVG con ticks en Y, puntos enfocables con teclado y texto alternativo, tabla
  accesible de check-ins (marca «Corregido»), tarjeta *Sesiones de
  entrenamiento del periodo* con detalle prescrito vs realizado por ejercicio y
  serie junto a su versión prescrita (además de enlace a *Entrenamiento*) y la
  tarjeta *Información compartida con el cliente* sincronizada por revisión con
  botón *Actualizar configuración* tras conflicto 409. En *Evolución
  antropométrica* (`EvolutionSection.tsx`), se enlaza a *Seguimiento* para el
  peso diario sin mezclarlo con evaluaciones clínicas. En *Resumen*, «Historial
  de peso corporal» muestra los últimos pesos del check-in. *Inicio*
  (`ProfessionalHome`) ordena «Check-ins recientes» por `lastCheckInAt`
  descendente, añade selector *Recientes (≤ 24 h)* / *Sin check-in hoy* (solo
  activos, aclarando que no indica revisión pendiente), reintentos
  independientes y tarjetas de adherencia de cartera a 7 días vía
  `GET /api/follow-up/summary`. No hay estado «revisado» ni mensajes al cliente.
- **Móvil cliente:** *Inicio* desacopla la tarjeta «Check-in de hoy»
  (pendiente/registrado con resumen y «Te faltó: Ayer/Anteayer») y
  «Alimentación de hoy» respecto de la rutina, cada una con error/reintento,
  estado vacío y caché independientes: funciona sin planes ni rutina cargada. La
  pantalla **Check-in diario** es la única captura (peso incluido): cabecera con
  estado, Hoy/Ayer/Anteayer con su marca, el entrenamiento del día, peso en kg
  con validación local finita, sueño con − / +, atajos rápidos (6–9 h) y botón
  *Borrar horas de sueño* con nodo semántico aislado, estrés/energía/hambre 1–5
  con `TonePill` y palabra por nivel, tira resumen antes de guardar estilo
  `fitnextfy`, cumplimiento alimenticio solo con plan vigente y comentario
  (500). Guardar cierra el teclado, reintenta con la misma clave si se perdió la
  conexión y nunca da éxito antes de la respuesta del servidor; un conflicto
  409 recarga la versión más reciente repoblando el formulario vía `_fill()` y
  reiniciando las claves idempotentes. Sin registro offline. *Progreso* muestra
  «Peso corporal» (`Check-in diario · kg`, tendencia propia) + «Últimos
  check-ins» (hasta 5) y «Compartido por tu profesional» (adherencia con
  cobertura y gráfica + historial de hasta 6 evaluaciones con origen
  «Evaluación profesional», o aviso explícito cuando alguna categoría sigue
  privada). *Cuenta → Datos base preparados* (`ClientBaseMeasurements`,
  `ClientProfileScreen`, `ClientSessionGate`) actualiza su texto e incluye el
  botón *Ver mi progreso* hacia la pestaña *Progreso* (tramo RDC0204). Nada de
  lo compartido se guarda en el teléfono: una categoría retirada desaparece en
  la siguiente lectura. Se retiró la tarjeta «Próximamente» y su widget, ya sin
  uso.

## Evidencia local (20-nov-2026)

Detalle completo y separación de hallazgos en [validacion-local.md](validacion-local.md).

| Tipo | Evidencia |
| --- | --- |
| T | `apps/api`: `npm run build` sin errores; migración `202611200001_daily_check_ins.sql` aplicada en `localhost:5432/CouchOneFit_test`; `tests/follow-up.test.ts` **6/6** (rangos y precisión DEC-006, sin coerción, al menos un dato real rechazando `not_applicable` aislado, ejemplos DEC-008 100/80 y 83/86, ventana hoy/−2 y fechas futuras, idempotencia y 409, revisiones con instantánea, peso base intacto, cumplimiento con/sin plan, dos carteras, RLS directa, expediente inactivo solo lectura, visibilidad *default off*, agregado sin categorías ocultas, recursos dedicados `/measurements` y `/adherence` 403, revocación en la siguiente consulta, adherencia de entrenamiento y detalle de sesiones reales, y `/api/follow-up/summary` reutilizado sin inactivos). |
| T | Suite API dirigida (`follow-up`, `migrations`, `training`, `client-read-isolation`, `evolution-api`, `evolution-postgres` en `127.0.0.1/CouchOneFit_test`): **58/58** (1 suite opt-in `# SKIP`: `HU-022 isolated physical PostgreSQL`). Suite API completa: **244/245** (1 fallo previo en `tests/session-lifecycle.test.ts:232` «deactivating a professional…», `401 !== 200`, más 1 suite opt-in `# SKIP`). |
| T | `apps/web`: Prettier en 15 archivos tocados **15/15**, `oxlint` **0 warnings / 0 errors**, `npm run build` correcto; `tests/follow-up-web.test.mjs` **3/3**, `tests/follow-up-page.test.mjs` **4/4** (datos reales, sesiones por serie/versión, «—» sin denominador, un solo peso sin `<svg role="group">`, filtros `?days=` y `?from=&to=`, gráfica accesible `--ws-primary`, compartir con recarga en 409, `ProfessionalHome` por `lastCheckInAt` y `/summary`). Suite completa `npm test`: **161/161**. |
| T | `apps/mobile`: `dart format` (14 archivos, 0 cambios), `flutter analyze` **No issues found!**; `test/check_in_test.dart` **8/8** (contexto, escalas estrictas, agregado sin categorías ocultas, validación de peso y reintento offline a 320 px, recarga `_fill()` ante 409, limpiar sueño a vacío, Progreso oculto/tendencia de evaluaciones/cobertura/revocación y HU-035 Inicio desacoplado); `test/client_record_test.dart` (incluye puente *Ver mi progreso*). Suite móvil completa `flutter test`: **93/95** (solo los 2 fallos previos en `test/client_login_test.dart`, buscador `"Mi expediente"`). |
| E | `codebase-memory-mcp` devolvió `EOF` al iniciar (`list_projects`), por lo que la exploración se hizo por lectura/búsqueda directa. Tampoco se ejecutó recorrido visual autenticado en navegador ni prueba en dispositivo Android físico ni migración en Supabase (solo custodio). |

Pendiente: aceptación humana (**R**), revisión independiente (incluyendo tramos de Omar y Pukzil), recorrido en navegador y en dispositivo Android, ratificación del replanteamiento por el equipo, paso de los cambios locales desde `main` a una rama de PR avisando archivos compartidos (`CONTRIBUTING.md`) y aplicar la migración en Supabase (operación del custodio).
