# EP-06 — Entrenamiento

Historias: HU-028 (programar rutina), HU-029 (modificar conservando
historial), HU-030 (activar y consultar en móvil) y HU-031 (registro real por
serie). Responsable: Ferxxo. Capas: BD, API, Web y móvil.

Estado al 04-nov-2026: **implementado y validado localmente (T/E)**. Falta
la aceptación humana (R), la revisión independiente y el resto de D0; no se
declara ninguna HU como completa.

## Decisión del usuario — 04-nov-2026 (ajuste a DEC-006 y HU-031)

En el chat, la persona usuaria pidió poder «activar todo»: RPE, RIR, series,
rango de repeticiones, y que el cliente registre lo que hizo y el profesional
vea cada serie. Esto **prevalece** sobre el texto anterior de DEC-006 («RPE
obligatorio, RIR pospuesto») y de HU-031 («sin RPE de ejecución»):

| Campo | Prescripción (profesional) | Registro real (cliente) |
| --- | --- | --- |
| Series | 1–20 por ejercicio | Una fila por serie prescrita, sin series extra |
| Repeticiones | `reps` 1–100 obligatorio; `repsMax` opcional (`reps`–100) forma un rango | `reps` 1–1000 si se hizo; 0 si no |
| RPE | Opcional, 1–10 paso 0,5 | Opcional, 1–10 paso 0,5, solo si se hizo |
| RIR | Opcional, entero 0–10 | Opcional, entero 0–10, solo si se hizo |
| Carga | Objetivo opcional (kg 0,1–1000; corporal = 0) | Obligatoria si se hizo: externa > 0, corporal 0 |
| Descanso | `restSeconds` opcional 0–900 paso 5 por ejercicio | — (sin temporizador ni medición) |

Vacío/`null` significa «no prescrito / no informado», nunca cero. Siguen
fuera de alcance: temporizador, descansos medidos, notificaciones, series
extra y registro offline.

## Catálogo de ejercicios

Fuente: [RepDB exercise-dataset](https://github.com/RepDB/exercise-dataset)
(revisión fijada en `apps/api/scripts/import-training-catalog.ts`), con nombres,
músculos, equipo e instrucciones en español. El profesional solo ve los
ejercicios por repeticiones (`selectable`). La edición gratuita trae dos
fotogramas (inicio/pico); Web y móvil los alternan en bucle como demostración
tipo GIF, y muestran una imagen fija con «reducir movimiento». Las animaciones
oficiales de RepDB son de pago y no se usan. Atribución obligatoria
«Exercise data by RepDB (repdb.co)» visible en Web y móvil.

Importación local (el script exige `DATABASE_URL` en localhost): desde
`apps/api`, `npx tsx scripts/import-training-catalog.ts`.

## Contrato

BD: `202611040001_training.sql`, `202611040002_training_guards.sql` y
`202611040003_training_effort.sql` (columnas `reps_max`, `rir`, `rest_seconds`;
`rpe` de prescripción pasa a opcional; `rpe`/`rir` reales en
`training_results`, nulos cuando la serie no se hizo).

| Método y ruta | Rol | Uso |
| --- | --- | --- |
| `GET /api/training/exercises?search&muscle&equipment&offset` | profesional | Catálogo paginado (40) |
| `GET/POST /api/training/templates`, `POST …/:planId/versions`, `PATCH …/versions/:versionId` | profesional | Plantillas propias |
| `GET/POST /api/clients/:clientId/training-plans` (+ mismas subrutas) | profesional dueño | Rutina del cliente: borrador, historial |
| `POST /api/clients/:clientId/training-plans/:planId/versions/:versionId/activate` | profesional dueño | Publicar y activar (una sola activa) |
| `GET /api/clients/:clientId/training-sessions?offset` | profesional dueño | Registros por serie del cliente |
| `GET /api/me/training-plan` | cliente | Rutina activa |
| `GET /api/me/training-sessions/context?date` | cliente | Hoy y dos días previos |
| `POST /api/me/training-sessions` | cliente | Guardar avance o finalizar (idempotente, 409 por revisión) |

Escrituras: `Idempotency-Key` UUID; Web con CSRF, móvil con Bearer.

Internamente cada edición de una rutina publicada crea un registro nuevo y
conserva el anterior (HU-029); las sesiones quedan ligadas a lo que estaba
vigente. La UI ya no muestra números de versión: el profesional ve «Rutinas
del cliente» con estado *Activa/Anterior/Borrador* y fecha, y el botón
«Editar rutina» crea la copia editable.

## Experiencia

- **Web profesional** (`/app/clientes/:id/entrenamiento`): editor por días,
  ejercicios del catálogo con demostración animada, tabla por serie
  (reps, «hasta» para rango, RPE, RIR, carga objetivo), descanso por
  ejercicio, y **Registros del cliente** con prescrito vs realizado por serie.
- **Móvil cliente**: pestañas *Hoy* (entrenamiento del día, ejercicios con
  animación, semana L–D, registrar ayer/anteayer), *Rutina* (días) y
  *Cuenta*. La bitácora muestra el objetivo de cada serie, *Hecha / No la
  hice*, kg, reps, RPE y RIR, progreso y barra fija para guardar o finalizar.

## Evidencia local (04-nov-2026)

| Tipo | Evidencia |
| --- | --- |
| T | `apps/api`: `tsc --noEmit`; `tests/training.test.ts` 3/3 (rango, RIR, descanso, RPE/RIR reales, propiedad, idempotencia, concurrencia); `client-read-isolation` y `migrations` (25 migraciones, esquema integrado idéntico) en verde. |
| T | `apps/web`: `build`, `oxlint`, `npm test` 64/64. |
| T | `apps/mobile`: `flutter analyze` sin incidencias; `flutter test` 52/52, incluidas pantallas a 320/390/768 px con texto 1,8× y la bitácora a 320 px con carga externa. |
| T | Navegador integrado: cuenta sintética local, rutina con catálogo activada vía API, sesión registrada como cliente; el profesional ve los registros por serie y el editor sin desbordes. |
| E | Revisión visual de capturas golden temporales del móvil (Hoy, Rutina, bitácora y detalle; claro/oscuro), eliminadas tras revisar. |

Pendiente: prueba en dispositivo Android real (no había `adb` en esta
máquina), aceptación humana y revisión independiente.
