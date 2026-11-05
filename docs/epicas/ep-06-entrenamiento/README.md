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
| Descanso | `restSeconds` opcional 0–900 paso 5 por ejercicio | Temporizador local en móvil (no se guarda ni se mide en servidor) |

Vacío/`null` significa «no prescrito / no informado», nunca cero. Siguen
fuera de alcance: descansos medidos o guardados, notificaciones, series
extra y registro offline. El temporizador de descanso local se incorporó por
decisión del usuario (sección siguiente).

## Decisión del usuario — 04-nov-2026 (rediseño móvil y progreso)

En el chat, la persona usuaria pidió rehacer el móvil con coherencia visual,
que el cliente registre de verdad kg/reps/RIR por serie de lo que prescribió
el profesional y que **vea su progreso** («que le vaya diciendo cómo va»),
con secciones reservadas para los módulos futuros. Pidió expresamente
**activar las rachas**. Esto prevalece sobre:

- La exclusión de «rachas» de UI-001 (`DESIGN.md`, plan §UI-001): se muestra
  la racha semanal de entrenamiento (semanas consecutivas con al menos una
  serie hecha; la semana en curso no la rompe hasta terminar).
- HU-036 (historial propio autorizado, *default off*, responsable Pukzil)
  **solo para los registros de entrenamiento propios**: el cliente consulta
  su bitácora con `GET /api/me/training-history`. Cuando HU-036 entregue el
  control de visibilidad, este endpoint debe respetar la categoría de
  entrenamiento; peso, evaluaciones y check-in siguen bajo HU-036.

Las secciones *Check-in diario*, *Alimentación*, *Peso corporal* y
*Evaluaciones* aparecen como «Próximamente», sin datos de ejemplo; las
implementan HU-032/037, HU-027, HU-022/036 y HU-021.

### Ampliación del mismo día (segunda revisión)

Tras revisar el primer rediseño, la persona usuaria pidió una UI/UX completa
al estilo de sus capturas de referencia, con analíticas, recuperación y
**temporizador**, y estandarizar la configuración. Prevalece sobre la
exclusión anterior de temporizador (DEC-006/HU-031) y sobre la regla de
`DESIGN.md` de no recordar el tema:

- **Temporizador de descanso** local: empieza al marcar una serie como hecha
  (descanso prescrito o, si falta, el predeterminado), con −15 s / +15 s,
  pausa, saltar y vibración opcional. No se envía ni se guarda en servidor.
  El cronómetro de la sesión mide el tiempo de esa visita a la bitácora.
- **Configuración en Cuenta**: tema (sistema/claro/oscuro, recordado en el
  teléfono), temporizador on/off, descanso predeterminado, incremento de
  carga de los botones − / + y vibración. Se guarda en el almacenamiento
  nativo que ya usa la app (`cof_app_settings`), sin dependencias nuevas.
- **Analíticas propias**: balance muscular (series por grupo), recuperación
  estimada por grupo (días desde la última sesión frente a 2–4 días según las
  series; orientativa, sin diagnóstico) y 1RM estimado (Epley). Los grupos
  salen de los músculos principales del catálogo RepDB.

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
| `GET /api/training/clients` | profesional | Cartera con estado de entrenamiento: rutina activa, borrador, último registro y registros en 7 días |
| `GET/POST /api/training/templates`, `POST …/:planId/versions`, `PATCH …/versions/:versionId` | profesional | Plantillas propias |
| `GET/POST /api/clients/:clientId/training-plans` (+ mismas subrutas) | profesional dueño | Rutina del cliente: borrador, historial |
| `POST /api/clients/:clientId/training-plans/:planId/versions/:versionId/activate` | profesional dueño | Publicar y activar (una sola activa) |
| `GET /api/clients/:clientId/training-sessions?offset` | profesional dueño | Registros por serie del cliente |
| `GET /api/clients/:clientId/record` | profesional dueño | La sección `trainingPlan` disponible añade `activity` `{lastSession, sessionsLast7, sessionsLast30, setsLast30}` (calendario local del cliente; `null` si falla, sin ocultar la rutina) |
| `GET /api/me/training-plan` | cliente | Rutina activa; cada ejercicio con `muscles`, `equipment` y `bodyPart` del catálogo (vacíos/`null` si es propio) |
| `GET /api/me/training-sessions/context?date` | cliente | Hoy y dos días previos |
| `POST /api/me/training-sessions` | cliente | Guardar avance o finalizar (idempotente, 409 por revisión) |
| `GET /api/me/training-history?offset` | cliente | Bitácora propia (40 por página, más reciente primero): `{sessions:[{id,localDate,status,dayName,exercises:[{key,catalogId,name,loadMode,muscles,bodyPart,sets:[SetResult\|null]}]}],nextOffset}`. `key` = `catalogId` o id del ejercicio; `sets` alineadas a las series prescritas (`null` = sin marcar). |

Escrituras: `Idempotency-Key` UUID; Web con CSRF, móvil con Bearer.

Internamente cada edición de una rutina publicada crea un registro nuevo y
conserva el anterior (HU-029); las sesiones quedan ligadas a lo que estaba
vigente. La UI ya no muestra números de versión: el profesional ve «Rutinas
del cliente» con estado *Activa/Anterior/Borrador* y fecha, y el botón
«Editar rutina» crea la copia editable.

## Experiencia

- **Web profesional** (reorganización del 04-nov-2026, a petición de la
  persona usuaria: el cliente estaba repartido en dos lugares y su ficha
  «no servía para nada»). Menú: **Inicio · Clientes · Rutinas**.
  - *Inicio* (`/app`): clientes activos/cupo, entrenaron esta semana, sin
    rutina, plan; «Necesitan tu atención» (borrador sin activar, sin rutina,
    sin registros o más de 7 días sin entrenar) y «Actividad reciente».
  - *Clientes* (`/app/clientes`): una sola lista; cada fila muestra objetivo,
    rutina, último entreno y entrenos en 7 días, estado/cuenta, «Abrir
    ficha» y las acciones de acceso (invitación, inactivar, baja).
  - *Ficha del cliente*: cabecera común (nombre, estado, rutina, edad,
    estatura, peso, objetivo y acciones del expediente) con pestañas
    **Resumen** (`/app/clientes/:id`: indicadores de rutina, último
    entreno, entrenos en 7 días y series en 30 días; rutina de la semana;
    perfil y medidas; módulos de otras épicas) y **Entrenamiento**
    (`/app/clientes/:id/entrenamiento`: *Vista general*, *Rutina*,
    *Registros*, *Historial*).
  - *Rutinas* (`/app/entrenamiento`): plantillas reutilizables (crear,
    editar, duplicar, asignar). La rutina de cada cliente se gestiona en su
    ficha; la antigua tarjeta de clientes de Entrenamiento desapareció.
  - Editor: días como pestañas, tipo de día segmentado, ejercicios como
    tarjetas plegables con demostración animada y tabla de series (reps,
    «hasta», RPE, RIR, kg objetivo); el catálogo se abre en un modal que
    permite añadir varios ejercicios seguidos.
- **Móvil cliente** (destinos de `DESIGN.md`: Inicio, Planes, Progreso, Cuenta,
  más el botón central **Entrenar**, que abre el entrenamiento de hoy o, si
  hoy no toca, ofrece ayer/anteayer):
  - *Inicio*: semana navegable (‹ ›) con hoy marcado y días registrados;
    al tocar un día se ve su entrenamiento con grupos musculares y la acción
    que corresponde (*Empezar / Continuar / Ver o corregir registro*, *Ver lo
    que registraste* o *Ver ejercicios*); entrenamientos de la semana, racha
    semanal, recuperación muscular, «¿Olvidaste registrar?» y
    «Próximamente». El engrane abre Cuenta → Configuración.
  - *Planes*: *Entrenamiento* (tarjeta «cómo entrenas» según semana fija,
    ciclo o calendario; días con grupos musculares y «Hoy») y *Alimentación*
    (reservado HU-027).
  - *Progreso*: entrenamientos, este mes, racha, series y total levantado;
    actividad de 17 semanas por series o volumen; análisis *Balance /
    Recuperación / Fuerza*; tus ejercicios (mejor marca, cambio y gráfica,
    con detalle y 1RM estimado); últimas sesiones e historial completo.
  - *Cuenta*: expediente existente y Configuración.
  - *Bitácora*: cabecera con cronómetro, series hechas y *Finalizar*; barra
    de avance y volumen; selector de ejercicios; demostración minimizable;
    grupos, equipo, descanso y mejor marca; plan, «La última vez…» y una
    pista informativa (si la vez pasada completó todas las reps y el
    profesional no fijó carga, sugiere probar el incremento configurado).
    Cada serie: kg y reps con − / +, RIR o RPE, «No la hice» y ✓. Los campos
    vacíos adoptan la sugerencia (la misma serie de la vez pasada, la carga
    prescrita o la serie anterior). Tras ✓ compara con la vez pasada y
    arranca el descanso. Al finalizar abre el **resumen**: tiempo, series,
    volumen, récords, comparación por ejercicio y músculos trabajados, con
    acceso a Progreso.

## Evidencia local (04-nov-2026)

| Tipo | Evidencia |
| --- | --- |
| T | `apps/api`: `tsc --noEmit`; `tests/training.test.ts` 3/3 (rango, RIR, descanso, RPE/RIR reales, propiedad, idempotencia, concurrencia); `client-read-isolation` y `migrations` (25 migraciones, esquema integrado idéntico) en verde. |
| T | `apps/web`: `build`, `oxlint`, `npm test` 64/64. |
| T | `apps/mobile`: `flutter analyze` sin incidencias; `flutter test` 52/52, incluidas pantallas a 320/390/768 px con texto 1,8× y la bitácora a 320 px con carga externa. |
| T | Navegador integrado: cuenta sintética local, rutina con catálogo activada vía API, sesión registrada como cliente; el profesional ve los registros por serie y el editor sin desbordes. |
| E | Revisión visual de capturas golden temporales del móvil (Hoy, Rutina, bitácora y detalle; claro/oscuro), eliminadas tras revisar. |
| T | Rediseño móvil (04-nov-2026): `apps/api` `build` y `tests/training.test.ts` 3/3 con `GET /api/me/training-history` (datos propios, otro cliente vacío, profesional 403, `offset` inválido 400); `apps/mobile` `flutter analyze` sin incidencias y `flutter test` 54/54 (navegación 320/390/768 px con texto 1,8×, estadísticas/racha, sugerencias, comparación, «No la hice» y reintento con la misma clave). |
| E | Capturas golden temporales de Inicio, Planes, Progreso y bitácora (claro/oscuro, 390 px), revisadas y eliminadas. |
| T | Segunda revisión: `apps/api` `build`, `tests/training.test.ts` 3/3 (también músculos del catálogo bajo RLS de cliente) y `client-read-isolation` 33/33; `apps/mobile` `flutter analyze` sin incidencias y `flutter test` 57/57 (temporizador con reloj inyectado, − / +, configuración persistida, balance, recuperación, 1RM, resumen final y pantallas a 320/390/768 px con texto 1,8×). |
| E | Capturas golden temporales de Inicio, Planes, Progreso (balance y recuperación), Cuenta/Configuración y bitácora con descanso en curso (claro/oscuro), revisadas y eliminadas. |

Pendiente: prueba en dispositivo Android real (no había `adb` en esta
máquina), aceptación humana y revisión independiente.
