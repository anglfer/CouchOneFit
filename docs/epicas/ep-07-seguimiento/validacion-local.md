# Validación local y auditoría de integración — EP-07 (20-nov-2026)

Registro de evidencia conforme a la convención del repositorio:

- **T**: prueba o herramienta ejecutada y observada en esta sesión.
- **E**: inspección estática de código, contratos o esquemas.
- **R**: aceptación o reporte humano de la persona usuaria (pendiente).

> Ninguna historia (`HU-032` a `HU-037`) se declara completa ni apta para cierre de D0: faltan aceptación humana (**R**), revisión independiente por pares (incluyendo tramos asignados originalmente a Omar en `HU-034`/`HU-035` y Pukzil en `HU-036`), recorrido manual en navegador y dispositivo Android físico, ratificación en equipo del replanteamiento del 20-nov-2026 y aplicación de la migración en Supabase por el custodio.

## 1. Base de trabajo previa (staged) vs correcciones de auditoría (unstaged)

En el árbol local de `main` existían **49 archivos** ya preparados en el índice de Git con una primera entrega completa de EP-07. Se conservaron intactos (sin `git reset`, limpieza ni cambio de rama) y sobre ellos se aplicaron **12 correcciones/refinamientos** tras auditar contratos, SQL, UI y acoplamientos con otras épicas:

| Área | Hallazgo detectado (E) | Ajuste aplicado y verificado |
| --- | --- | --- |
| BD / Validador (`HU-032`) | El `CHECK` SQL de `private.check_ins` y el validador permitían guardar `nutrition_compliance = 'not_applicable'` sin ningún otro campo real. | Ajustado `CHECK` en [202611200001_daily_check_ins.sql](../../database/migrations/202611200001_daily_check_ins.sql), [identity_access.sql](../../database/schemas/identity_access.sql) y [validators/follow-up.ts](../../../apps/api/src/features/follow-up/validators/follow-up.ts) para exigir al menos una métrica/comentario o estado explícito (`completed`/`partial`/`not_completed`). |
| Seguimiento Web (`HU-033`) | `WeightChart` usaba el token inexistente `--ws-accent` (trazo y puntos invisibles), con 1 peso dejaba tarjeta vacía, calculaba `to` con el reloj del navegador y carecía de rango personalizado/detalle de sesiones. | Corregido a `--ws-primary`, lectura explícita con 1 medición, ticks Y y puntos enfocables con teclado, filtro `?days=` / `Desde`–`Hasta`, periodo/zona del servidor y sección *Sesiones de entrenamiento del periodo* alimentada por `sessions[]` en `GET /api/clients/:clientId/follow-up`. Enlazado desde *Evolución antropométrica* (`EvolutionSection.tsx`) sin mezclar evaluaciones clínicas. |
| Visibilidad Web (`HU-033`/`HU-036`) | `SharingCard` podía retener un borrador obsoleto al cambiar de cliente/revisión y ante un 409 no ofrecía recarga sincronizada. | Estado derivado por `revisionKey = "${clientId}:${revision}"` sin `setState` en `useEffect` y botón explícito *Actualizar configuración* tras 409. |
| Evaluaciones compartidas (`HU-036`) | `repositories/follow-up.ts` `measurements()` leía `evaluation_date` ignorando `assessment->>'effectiveDate'` y evaluaciones multimétodo, y omitía `source`. | Usa `COALESCE(assessment->>'effectiveDate', evaluation_date::text)` con respaldo a `assessment->'measurements'`, exponiendo `source: 'professional_evaluation'` y `method`. |
| Adherencia dedicada cliente (`HU-036`) | Faltaba endpoint dedicado para adherencia compartida equivalente a `/api/me/progress/measurements`. | Añadido `GET /api/me/progress/adherence` (403 `VISIBILITY_DENIED` sin cuerpo útil cuando está oculta). |
| Dashboard profesional (`HU-034`) | `ProfessionalHome` ordenaba check-ins recientes alfabéticamente, no mostraba pendientes de hoy activos ni adherencia de cartera de 7 días. | Añadido `lastCheckInAt` en `GET /api/training/clients` (orden descendente), selector *Recientes (≤ 24 h)* / *Sin check-in hoy* (excluye inactivos), reintentos independientes y `GET /api/follow-up/summary` reutilizando `adherenceDays` / `summarize` de HU-033. |
| Check-in móvil (`HU-032`/`HU-037`) | Al chocar con 409 solo recargaba contexto sin repoblar inputs/claves idempotentes, el campo de sueño no se podía limpiar a `null` y faltaban señales visuales claras por escala. | `_fill()` repuebla formulario y reinicia `_key`/`_keyBody` en 409, validación `isFinite` en peso, botón *Borrar horas de sueño* + `Semantics(container: true, excludeSemantics: true)`, y cabecera con estado, escalas con etiqueta/`TonePill` y tira resumen estilo `fitnextfy` manteniendo el patrón propio de CouchOne Fit. |
| Inicio móvil (`HU-035`) | *Alimentación de hoy* solo se mostraba cuando `data != null` (rutina cargada), ocultándola si fallaba entrenamiento o no había planes. | Desacoplada en `ClientShell`/`HomeTab` con estados propios de carga, error/reintento, caché offline, vacío y resumen del día. |
| Progreso y puente RDC0204 (`HU-036`) | *Progreso* mostraba solo la última evaluación sin tendencia ni cobertura y *Cuenta → Datos base preparados* conservaba texto obsoleto («todavía no está disponible») sin enlace. | `FollowUpProgress` muestra origen explícito (`Check-in diario · kg` / `Evaluación profesional`), últimos 5 check-ins, cobertura de adherencia, `TrendChart` + hasta 6 evaluaciones; `ClientBaseMeasurements` + `ClientProfileScreen` + `ClientSessionGate` añaden *Ver mi progreso* hacia la pestaña *Progreso*. |
| Contratos y OpenAPI (`HU-037`) | `BodyWeightEntry` devolvía `timeZone`, pero faltaba reflejarlo en el esquema `bodyWeightHistory` del OpenAPI y en el glosario. | Añadido `timeZone` en `BodyWeightEntry` y en `docs/api/identity-lifecycle.openapi.json` + actualizado `docs/architecture/domain-glossary.md` y docs de EP-07. |

## 2. Evidencia verificada localmente (T y E)

| Tipo | Comprobación | Resultado observado |
| --- | --- | --- |
| E | `codebase-memory-mcp` (`list_projects`) | Falló al iniciar (`connection closed: calling "tools/call": EOF`); exploración ejecutada mediante búsqueda y lectura directa de archivos conforme a `AGENTS.md`. |
| T | Migración local exclusiva: `npm --prefix apps/api run db:migrate` con `DATABASE_URL` fijada en la sesión a `localhost:5432/CouchOneFit_test` | Verificado destino local; aplicó `202611200001_daily_check_ins.sql` sin errores. No se ejecutó contra Supabase. |
| T | `npm --prefix apps/api run build` | Código 0 (`tsc` sin errores). |
| T | Suite API dirigida (`127.0.0.1:5432/CouchOneFit_test`): `npx tsx --test --test-concurrency=1 tests/follow-up.test.ts tests/migrations.test.ts tests/training.test.ts tests/client-read-isolation.test.ts tests/evolution-api.test.ts tests/evolution-postgres.test.ts` | **58/58 pasadas**, 0 fallidas, 1 suite opt-in omitida (`HU-022 isolated physical PostgreSQL`). Incluye `tests/follow-up.test.ts` (**6/6**) y paridad `migrations and the integrated schema produce the same English database` (con actualización desde migraciones previas y filas existentes). |
| T | Suite API completa (`127.0.0.1:5432/CouchOneFit_test`): `npm --prefix apps/api test` | **244/245 pasadas**, **1 fallo** previo no relacionado en `tests/session-lifecycle.test.ts:232` («deactivating a professional revokes all their sessions without deactivating linked client accounts, and protects last admin», `401 !== 200`, reportado también antes de estos cambios) + 1 suite opt-in `# SKIP` (`HU-022 isolated physical PostgreSQL`). |
| T | `npx prettier --check` en los 15 archivos tocados de `apps/web` (tras formatear únicamente 4 de ellos con `--write`) | **15/15** conforme a Prettier. No se ejecutó formato global sobre archivos ajenos. |
| T | `npm --prefix apps/web run lint` | `Found 0 warnings and 0 errors` (141 archivos, 116 reglas). |
| T | `npm --prefix apps/web run build` | Código 0 (`tsc -b && vite build`). |
| T | `npm --prefix apps/web test` | **161/161 pasadas**, 0 fallidas (incluye `tests/follow-up-web.test.mjs`, `tests/follow-up-page.test.mjs` 4/4 y `tests/session-recovery.test.mjs`). |
| T | `dart format` (14 archivos `.dart` tocados) y `flutter analyze` desde `apps/mobile` | `0 changed`, `No issues found!`. |
| T | `flutter test test/check_in_test.dart` desde `apps/mobile` | **8/8 pasadas** (contexto, ventana hoy/−2, escalas, validación/peso/reintento offline con misma clave a 320 px, conflicto 409 con recarga `_fill`, limpiar sueño a vacío, Progreso oculto vs vacío/tendencia de evaluaciones/revocación y HU-035 Inicio desacoplado). |
| T | Suite móvil completa `flutter test` desde `apps/mobile` | **93/95 pasadas**, **2 fallos** previos en `test/client_login_test.dart` (`Found 0 widgets with text "Mi expediente"` en dos casos heredados). Pasan también `test/client_record_test.dart` (incluyendo puente `Ver mi progreso`), `test/training_test.dart` y `test/nutrition_test.dart`. |
| T | Sintaxis JSON OpenAPI (`docs/api/identity-lifecycle.openapi.json`) | `JSON_OK` (`JSON.parse` sin errores). |
| T | Higiene Git: `git diff --check` y `git status --short` | `git diff --check` limpio; se conservan los 49 archivos staged previos junto con los cambios auditados sin commits ni alteraciones de rama. |
| E | Recorrido visual en navegador, prueba en emulador/dispositivo Android físico y migración en Supabase | **No ejecutados**: la automatización visual contra BD local y pruebas en dispositivo Android quedan pendientes antes de aceptar las HU. |

## 3. Archivos compartidos modificados (coordinación `CONTRIBUTING.md`)

Para facilitar la coordinación del equipo antes de pasar los cambios a una rama de PR y hacer merge a `main`, se hace constar que se tocaron archivos transversales o compartidos con otras épicas/responsables:

- API: [apps/api/src/app.ts](../../../apps/api/src/app.ts), [professional/services/record.ts](../../../apps/api/src/features/professional/services/record.ts), [professional/types/record.ts](../../../apps/api/src/features/professional/types/record.ts), [training/{controllers,repositories,services}](../../../apps/api/src/features/training/services/training.ts).
- Web: [ProfessionalHome.tsx](../../../apps/web/src/features/professional/components/ProfessionalHome.tsx), [ClientHeader.tsx](../../../apps/web/src/features/professional/components/ClientHeader.tsx), [ClientRecordSections.tsx](../../../apps/web/src/features/professional/components/ClientRecordSections.tsx), [ClientRecordView.tsx](../../../apps/web/src/features/professional/components/ClientRecordView.tsx), [ProfessionalPage.tsx](../../../apps/web/src/features/professional/pages/ProfessionalPage.tsx), [EvolutionSection.tsx](../../../apps/web/src/features/evaluations/components/EvolutionSection.tsx), [training/services/training.ts](../../../apps/web/src/features/training/services/training.ts).
- Móvil: [routes/client_session_gate.dart](../../../apps/mobile/lib/routes/client_session_gate.dart), [client_shell.dart](../../../apps/mobile/lib/features/training/screens/client_shell.dart), [home_tab.dart](../../../apps/mobile/lib/features/training/screens/home_tab.dart), [progress_tab.dart](../../../apps/mobile/lib/features/training/screens/progress_tab.dart), [client_profile_screen.dart](../../../apps/mobile/lib/features/client/screens/client_profile_screen.dart), [client_base_measurements.dart](../../../apps/mobile/lib/features/client/widgets/client_base_measurements.dart) y eliminación de `shared/widgets/coming_soon_card.dart` (en índice staged).

## 4. Riesgos y pendientes

1. **Ramas y commits**: el trabajo actual (49 archivos staged + cambios unstaged de esta sesión) sigue sin commit sobre la rama local `main`; según `CONTRIBUTING.md`, debe moverse a una rama de trabajo y validarse en PR, nunca empujarse directo a `main`.
2. **Migración en nube**: `202611200001_daily_check_ins.sql` está aplicada solo en `CouchOneFit_test`; aplicarla en Supabase corresponde únicamente al custodio.
3. **Pruebas heredadas**: persisten 1 fallo previo en API (`session-lifecycle.test.ts:232`) y 2 fallos previos en móvil (`client_login_test.dart`, buscador `"Mi expediente"`). Se dejaron sin modificar por quedar fuera del alcance de EP-07, pero conviene revisarlos antes del cierre del sprint.
4. **Aceptación humana (R) e integración física**: falta recorrido visual profesional/cliente autenticado en navegador (3000/5000) y en dispositivo Android físico con API local de pruebas.
