# Calidad, logs y niveles de servicio (SLI/SLO)

Reporte técnico de los entregables **Proyecto 3.1** (automatización de pruebas
con registro de resultados en logs) y **Proyecto 3.2** (reporte de la
implementación y sus resultados). Mediciones del 25-nov-2026 en la máquina local
del equipo (Windows 11, Node 24.16, Flutter 3.50.1, PostgreSQL 18.6).

Convención de evidencia del repositorio: **T** = prueba o herramienta
ejecutada, **R** = reporte humano, **E** = inspección estática. Todo lo marcado
como resultado en este documento es **T**; no hay reportes humanos (R) y no se
presenta ninguna HU como aceptada: eso sigue requiriendo revisión independiente
y D0 (plan §5.2).

## 1. Resumen

| Pieza | Dónde | Estado |
| --- | --- | --- |
| Ejecución centralizada de todas las suites | `scripts/quality/test-all.mjs` | Implementada y ejecutada (T) |
| Registro individual de cada prueba (JSONL) + resumen + historial | `test-results/` | Implementado y ejecutado (T) |
| Logs operativos estructurados de la API | `apps/api/src/shared/` | Implementado, cubierto por pruebas (T) |
| Readiness con PostgreSQL | `GET /api/health/ready` | Implementado (T) |
| Pruebas de carga y simulacro de recuperación | suite `load` | Implementadas y ejecutadas en local (T) |
| Sondas sintéticas de disponibilidad y latencia | `scripts/quality/synthetic-check.mjs` + `synthetic.yml` | Implementadas; cada 5 min en Actions, **sin activar** hasta definir `SYNTHETIC_TARGETS` |
| Cálculo de SLI y evaluación automática de SLO | `scripts/quality/sli-report.mjs` + `slo.config.json` | Implementado y ejecutado (T) |
| Integración continua | `.github/workflows/ci.yml` | Escrita y validada en sintaxis; **aún no ejecutada en GitHub** |

## 2. Arquitectura de la solución

```text
                    node scripts/quality/test-all.mjs  (único punto de entrada)
                                   │
     ┌──────────────┬──────────────┼───────────────┬────────────────┐
     ▼              ▼              ▼               ▼                ▼
  quality          api            web            mobile            load
 node --test   tsx --test     node --test   flutter test       API real (tsx)
 (scripts)     + Postgres     + jsdom/Vite   --machine         + carga + sondas
     │         local          (SSR)              │             + reinicio
     │              │              │             │                  │
     └──── node-test-reporter.mjs ─┘     flutter-machine.mjs    load-suite.mjs
                     │                           │                  │
                     ▼                           ▼                  ▼
          test-results/runs/<runId>/results.jsonl   (1 línea por prueba, incremental)
          ├── summary.json / summary.md            (totales, por suite, por tipo)
          ├── suites/<suite>.log                   (salida cruda de cada suite)
          ├── api-logs/api-suite/*.jsonl.gz        (logs operativos durante las pruebas)
          ├── api-logs/load/*.jsonl.gz             (logs operativos bajo carga)  ─┐
          ├── synthetic/synthetic-*.jsonl          (sondeos a /api/health/ready)  ├─► sli-report.mjs
          ├── load.jsonl                           (resultado por escenario)     ─┘    + slo.config.json
          └── sli-report.json / sli-report.md      (SLI calculados y veredicto por SLO)
          test-results/history.jsonl               (1 línea por corrida, solo se añade)

  API en ejecución ──► logger.ts (JSONL) ──► stdout (Render)  ó  LOG_DIR/api-AAAA-MM-DD.jsonl
  GitHub Actions ──► ci.yml (en cada cambio)    synthetic.yml (cada 5 min, si hay destinos)
```

Decisiones de diseño:

- **Sin dependencias nuevas.** Todo usa `node:test`, `fetch`, `zlib`, `crypto`
  y `child_process` de Node, el modo `--machine` de Flutter y `supertest`, que
  ya era dependencia de la API. No se tocaron lockfiles.
- **No se reescribieron pruebas existentes.** El registro por prueba se obtiene
  con un *reporter* personalizado de `node:test` (API, Web y herramientas) y
  con el flujo JSON de `flutter test --machine` (móvil).
- **Separación entre calidad del código y nivel de servicio.** El porcentaje de
  pruebas aprobadas se calcula a partir de `results.jsonl`. Los SLI se calculan
  solo a partir de logs operativos, sondas y carga. Los logs de la suite `api`
  se conservan como evidencia pero no alimentan SLI: esas pruebas provocan
  errores a propósito (ver §12.3).

## 3. Herramientas

| Herramienta | Uso |
| --- | --- |
| `node:test` + `node:assert` | Pruebas de API (vía `tsx`), Web y herramientas de calidad |
| `supertest` | Pruebas HTTP de la API sobre la app Express completa |
| PostgreSQL local (≥ 17) | Base exclusiva de pruebas; cada archivo de prueba crea su propia BD |
| `jsdom` + Vite SSR | Pruebas de componentes y servicios Web |
| `flutter_test` | Pruebas de widgets y servicios móviles (`--machine` para el registro) |
| Reporter propio (`node-test-reporter.mjs`) | Convierte eventos de `node:test` en registros JSONL |
| `load-test.mjs` | Carga de bucle cerrado con `fetch` (15 usuarios concurrentes) |
| `synthetic-check.mjs` | Sondeos HTTP periódicos con tiempo límite |
| `sli-report.mjs` | Cálculo de SLI y evaluación de SLO |
| GitHub Actions | CI (`ci.yml`) y sondas programadas (`synthetic.yml`) |

## 4. Tipos de pruebas implementadas

Cada archivo de prueba se clasifica en `scripts/quality/test-catalog.json`
(módulo, tipo y HU o requisito). Unas reglas conservadoras por nombre
reclasifican como `seguridad` o `recuperación` las pruebas cuyo nombre lo
indica (p. ej. `403`, `csrf`, `otra cartera`, `sin conexión`, `reintent`). Cada
prueba se cuenta en un solo tipo aunque cubra varios aspectos.

| Tipo | Qué cubre en CouchOne Fit | Ejemplos |
| --- | --- | --- |
| Unitaria | Cálculos y validadores sin E/S | `body-fat-estimation`, `evolution`, `logger`, parser de Flutter |
| Integración | App Express + repositorios + PostgreSQL real con RLS | `login`, `saas`, `client-read-isolation`, `training` |
| Funcional | Componentes, páginas y servicios Web/móvil contra red simulada | `session-recovery`, `evolution-web`, `training_test.dart` |
| E2E (a nivel API, sin navegador) | Flujos críticos de varios pasos por HTTP | `account-lifecycle` (credenciales, invitación, activación), `session-lifecycle`, `checkout`, `subscription-lifecycle` |
| Regresión | Toda la suite se repite en cada cambio (CI); además, pruebas que fijan defectos corregidos | `catalog.test.mjs`, desbordamiento de `extent`, simulacro excluido de disponibilidad |
| Seguridad y permisos | 401/403, CSRF, otra cartera, rol incorrecto, redacción de logs | `login`, `client-login`, `offline-write`, `observability` (sin contraseñas en logs) |
| Rendimiento y carga | 15 concurrentes contra `/api/health`, `/api/health/ready` y `/api/plans` | suite `load` |
| Recuperación | BD caída → 503 seguro, petición abortada, fallos inyectados con *rollback*, cola sin conexión, reinicio del proceso API | `observability`, `idempotency`, `offline-write`, simulacro de la suite `load` |

**Pruebas nuevas** en este trabajo: `apps/api/tests/logger.test.ts` (6),
`apps/api/tests/observability.test.ts` (6), las 29 de `scripts/quality/tests/`
y los 4 casos de la suite `load`. El resto ya existía y se integra sin cambios.

## 5. Matriz de cobertura (HU y requisitos)

Fuente: `results.jsonl` de la corrida `20261125T173956Z-9cb698` (T). La columna
indica qué pruebas automáticas **ejercitan** la funcionalidad, no que la HU esté
aceptada. El plan §8.3 marca EP-04–EP-07 como pendientes, aunque el repositorio
ya tiene código y pruebas para ellas; esta matriz describe lo que existe, sin
resolver esa discrepancia.

| HU / requisito | Funcionalidad | Archivos de prueba (nº de pruebas) | Tipos |
| --- | --- | --- | --- |
| HU-001 | Registro profesional | api `registration` (10) | integración, seguridad |
| HU-002 | Login profesional | api `login` (15) | integración, seguridad |
| HU-003 | Acceso administrativo | api `admin` (4) | integración |
| HU-004 | Login cliente | api `client-login` (9); móvil `client_login_test` (5) | integración, funcional, seguridad, recuperación |
| HU-005 | Ciclo de sesión / logout | api `session-lifecycle` (3) | e2e |
| HU-006/007/008 | Credenciales, invitación, activación | api `account-lifecycle` (18); móvil `account_access_test` (6) | e2e, funcional |
| HU-009 | Recuperación asistida | api `admin-support` (1) | integración |
| HU-010 | Catálogo de planes | api `saas-validation` (4), `saas` (20); carga `GET /api/plans` | unitaria, integración, rendimiento |
| HU-011/012/013 | Plan, suscripción, cupo | api `checkout` (6), `subscription-lifecycle` (4), `saas` | e2e, integración |
| HU-014 | Uso global de profesionales | api `saas` | integración |
| HU-015 | Alta de expediente | api `client-initial-record` (5), `saas`; web `session-recovery` (61) | unitaria, integración, funcional |
| HU-016–019 | Listado, edición, baja lógica, expediente base | api `client-read-isolation` (39), `client-edit` (1); web `session-recovery`, `client-status-offline` (1) | integración, seguridad, recuperación, funcional |
| HU-020 | Perfil móvil | api `client-read-isolation`; móvil `client_record_test` (8) | integración, funcional |
| HU-021/022 | Evaluaciones y evolución | api `assessment` (6), `evaluations` (5), `evolution` (12), `evolution-api` (9), `evolution-postgres`; web `evolution-web` (37), `offline-read` (11) | unitaria, integración, funcional |
| HU-023 | Grasa estimada | api `body-fat-estimation` (19), `estimation` (18), `pending-estimation-api` (15); web `estimation-web` (9) | unitaria, integración |
| HU-024/025/027 | Nutrición (editor, sugerencia, móvil) | api `nutrition-foods` (3), `nutrition-integration` (3), `nutrition-suggestion` (5); web `food-library` (6), `nutrition-web` (8); móvil `nutrition_test` (11) | integración, unitaria, funcional |
| HU-028–031 | Entrenamiento | api `training` (4) | integración |
| HU-035/036/037 | Check-in, progreso | móvil `check_in_test` (10), `client_record_test`; api `evolution-api` | funcional, recuperación |
| HU-039 | Portal público | web `marketing-plans` (4) | funcional |
| HU-040 | PWA profesional sin conexión | web `offline-read` (11), `offline-write` (27), `client-status-offline` | funcional, recuperación, seguridad |
| HU-041 | Aviso de privacidad | móvil `account_access_test` | funcional |
| RNF09 | Rendimiento | suite `load` (3), `load-test.test.mjs` (4) | rendimiento |
| RNF10 | Disponibilidad | simulacro de reinicio (1), sondas sintéticas | recuperación |
| RNF15 | Manejo de errores | api `observability` (6); móvil `api_transport_test` (1) | recuperación |
| RNF21–RNF24 | Offline y sincronización | web `offline-read`, `offline-write`, `client-status-offline`; móvil `check_in_test` | funcional, recuperación |
| RS16, RS17, RS23 | Eventos de seguridad, errores sin trazas, privacidad | api `logger` (6), `observability` (6) | unitaria, recuperación |
| RS22 | Auditoría | api `admin-support` | integración |
| DEC-018 | Idempotencia de escrituras | api `idempotency` (10) | integración, recuperación |

**Sin trazabilidad declarada** (aparecen en `summary.md` → *Archivos sin
trazabilidad*). Se ejecutan y registran, pero el catálogo no les asigna HU
porque el archivo no la menciona y no se inventó el vínculo: api
`catalog-search`; web `confirm-navigation`, `follow-up-page`, `follow-up-web`,
`training-sets`; móvil `api_config_test`, `mobile_experience_test`,
`notifications_test`, `shared_ui_test`, `training_test`, `widget_test`; y dos
pruebas de herramientas sin requisito de producto (`flutter-parser`,
`node-reporter`). El seguimiento (EP-07) solo enlaza decisiones (`follow-up` →
DEC-006/DEC-008).

## 6. Registro de resultados de prueba

Cada prueba genera una línea en `results.jsonl` **en el momento en que termina**
(`appendFileSync`), de modo que una suite que se cae a mitad conserva lo ya
ejecutado. Esquema:

| Campo | Contenido |
| --- | --- |
| `runId` | Identificador de ejecución `AAAAMMDDTHHMMSSZ-xxxxxx` |
| `suite` | `quality`, `api`, `web`, `mobile` o `load` |
| `testId` | `suite:` + 12 hex de `sha1(archivo::nombre completo)`; estable entre corridas |
| `name` / `fullName` | Nombre de la prueba y ruta `describe > prueba` |
| `file` | Archivo relativo al repositorio |
| `module` / `type` / `requirements` | Módulo evaluado, tipo de prueba y HU/RF/RNF/RS asociados (catálogo) |
| `timestamp` | Fecha y hora ISO de finalización |
| `durationMs` | Duración |
| `expected` / `actual` | Valores de la aserción (`AssertionError`) o «La prueba finaliza sin errores» / mensaje obtenido |
| `status` | `aprobada`, `fallida`, `omitida` o `bloqueada` |
| `errorMessage` | Descripción del error (código + mensaje, hasta 2000 caracteres) o `null` |
| `environment` | `ci` (GitHub Actions) o `local` |
| `commit` | SHA evaluado; sufijo `-dirty` si había cambios sin confirmar |

Reglas que impiden ocultar fallos:

- Una suite que **no puede ejecutarse** (sin `TEST_DATABASE_URL` local, sin
  `node_modules`, sin Flutter o sin `apps/mobile/.env.json`) produce un registro
  `bloqueada` con el motivo.
- Si el proceso de una suite termina con código ≠ 0 y no dejó ningún registro
  `fallida`, se añade uno con las últimas líneas de `stderr`. Un tiempo agotado
  también queda como `fallida`.
- Un fallo de carga de archivo (error de sintaxis, *hook* `before`) se registra
  como prueba fallida.
- Si no se puede generar el informe SLI, se registra un `fallida`.
- `test-all.mjs` sale con **1** si hay alguna prueba fallida o bloqueada, o si
  no se ejecutó ninguna.

Resumen por ejecución (`summary.json` y `summary.md`): totales, por suite (con
duración y código de salida) y por tipo, archivos sin trazabilidad, entorno,
commit y rama. **Porcentaje de aprobación** = aprobadas / (aprobadas + fallidas
+ bloqueadas) × 100; las omitidas no cuentan. El **historial**
`test-results/history.jsonl` recibe una línea por corrida y nunca se reescribe;
cada corrida tiene su propia carpeta.

## 7. Logging operativo de la API

`apps/api/src/shared/utils/logger.ts` escribe un objeto JSON por línea:

```json
{"ts":"2026-11-25T17:27:26.711Z","level":"INFO","service":"api","env":"test","event":"http.request","requestId":"6f0c…","method":"GET","path":"/api/plans","status":200,"durationMs":3.4,"outcome":"success"}
```

| Evento | Nivel | Campos además de `ts/level/service/env/event` |
| --- | --- | --- |
| `http.request` | INFO; WARN si 4xx o lenta (> `LOG_SLOW_MS`, `slow: true`); ERROR si 5xx | `requestId, method, path, status, durationMs, outcome` |
| `http.aborted` | WARN | El cliente cerró antes de la respuesta: `requestId, method, path, durationMs` |
| `http.body_error` | WARN | JSON inválido, cuerpo excesivo o subida abortada (`errorType: request.aborted`) |
| `auth.denied` | WARN | 401/403 de `AuthError` (credenciales, sesión, CSRF, rol): `errorCode` |
| `auth.login_succeeded`, `auth.refresh_succeeded`, `auth.logout` | INFO | `audience` (`web`/`client`), `accountId` y `role` cuando el controlador ya los tiene |
| `db.connection_error` | ERROR | Conexión rechazada, *timeout* de conexión o de consulta, SQLSTATE 08xxx/57P0x/53300 |
| `http.error` | ERROR | Cualquier otro fallo que el cliente recibe como 503: `errorName, errorCode, constraint, table, message, stack` |
| `db.pool_error` | ERROR | Error de un cliente inactivo del pool de `pg` |
| `server.started` / `server.stopping` / `server.stopped` | INFO | `port, nodeEnv` |
| `process.unhandled_rejection` / `process.uncaught_exception` | ERROR | Se registra y el proceso termina con 1, como antes |

- **Correlación.** `requestLogger()` es el primer middleware: toma
  `X-Request-Id` si cumple `^[A-Za-z0-9._-]{8,128}$`, si no genera un UUID, lo
  devuelve en la respuesta y lo incluye en todos los eventos de esa petición.
  Así un `db.connection_error` se une a su `http.request`.
- **Sin datos sensibles.** No se registran cuerpos, *query strings*, cabeceras
  ni cookies. La ruta se normaliza (UUID y números → `:id`). Además, cualquier
  campo cuya clave parezca sensible (`contrasena`, `password`, `token`,
  `cookie`, `csrf`, `email`, `correo`, `teléfono`, `nombre`, códigos de acceso,
  etc.) se sustituye por `[REDACTED]`, y las cadenas se truncan a 2000
  caracteres. La prueba `observability.test.ts` envía un login con contraseña y
  correo y comprueba que no aparecen en el archivo.
- **Sin efecto en el comportamiento.** Las respuestas de error son idénticas a
  las anteriores; el logger nunca lanza excepciones (si falla el destino avisa
  una vez por `stderr` y descarta la línea).
- **Coste.** La escritura a archivo es síncrona (`fs.writeSync`, una línea de
  ~250 bytes) para no perder registros si el proceso cae; está marcada como
  atajo en el código. Bajo carga local se midieron p95 de 3,9–13,3 ms en el
  servidor con el log activo (§12), por lo que no se observó impacto
  significativo; no se midió la misma carga con el log desactivado.

Configuración (`apps/api/.env.example`): `LOG_LEVEL`
(`debug|info|warn|error|silent`, por defecto `info`), `LOG_DIR`, `LOG_RETENTION_DAYS`
(14) y `LOG_SLOW_MS` (1000). Dentro de `node --test` y sin `LOG_DIR`, el
logger queda en silencio para no mezclar líneas con la salida de las pruebas.

## 8. Almacenamiento de logs: decisión

Se eligió **JSONL en archivos** (y salida estándar en producción) en lugar de
una tabla de base de datos:

| Criterio | JSONL | Base de datos |
| --- | --- | --- |
| Persistencia ante fallos | Se añade línea a línea; un fallo de la BD sigue quedando registrado | Un fallo de la BD impediría registrar justo ese fallo |
| Consulta y proceso | `sli-report.mjs`, `jq`, hojas de cálculo; una línea = un evento | SQL, pero añade carga a la BD compartida de Supabase |
| Historial | Archivo diario `api-AAAA-MM-DD.jsonl`; corridas en carpetas propias | Tabla creciente |
| Rotación y retención | Rotación diaria (UTC) y borrado de archivos con más de `LOG_RETENTION_DAYS`; logs de carga comprimidos con gzip | Requeriría tareas de purga |
| Seguridad | Fuera de Git (`/logs/`, `/test-results/`), sin datos sensibles | Mismo riesgo de PII y más superficie |
| Recursos | 69 MB por corrida de carga sin comprimir → 1,9 MB comprimidos | Escrituras extra por cada petición |
| Exportación | Artefactos de GitHub Actions (30 días) o copia de la carpeta | Exportación manual |

La auditoría de negocio ya existente en la BD (`private.access_events`,
RS16/RS22) **no se sustituye ni se duplica**: los logs operativos son otra cosa
(diagnóstico y medición).

En **producción (Render Free)** el disco es efímero: no se define `LOG_DIR` y
los logs salen por stdout hacia el flujo de logs de Render. Para calcular SLI
sobre producción hay que exportar ese flujo a un `.jsonl` y pasarlo a
`sli-report.mjs --logs`. Esa exportación no está automatizada (ver §15).

## 9. Procedimiento de ejecución

Requisitos: Node 24, PostgreSQL local migrado y `TEST_DATABASE_URL` hacia una
base **local** exclusiva (en `apps/api/.env` o en el entorno), dependencias
instaladas (`npm --prefix apps/api ci`, `npm --prefix apps/web ci`), Flutter y
`apps/mobile/.env.json`.

```powershell
node scripts/quality/test-all.mjs
```

```powershell
node scripts/quality/test-all.mjs --suites quality,web,mobile
```

- La suite `load` levanta su propia API en un puerto libre contra la BD de
  pruebas, con un secreto JWT aleatorio por corrida que no se escribe en disco.
  `QUALITY_LOAD_DURATION_S` fija los segundos por escenario (20 por defecto;
  para el objetivo de TT-021-1 de 5 minutos use `300`).
- Las herramientas también funcionan por separado:

```powershell
node scripts/quality/synthetic-check.mjs --target http://127.0.0.1:3000/api/health/ready --interval 60 --duration 3600 --out logs/synthetic
```

```powershell
node scripts/quality/sli-report.mjs --logs logs/api --synthetic logs/synthetic --out test-results/sli/manual
```

`load-test.mjs` se niega a apuntar a un host que no sea local salvo con
`--allow-remote`. **No** debe usarse contra producción.

## 10. SLI definidos

Percentiles por rango más cercano (`rank = ⌈p/100 · n⌉`). Servicios: la API en
conjunto y, por prefijo de ruta, `auth`, `plans`, `me`, `clients`,
`professional`, `client`, `admin` y `other` (`slo.config.json → services`).

**Por qué hacen falta sondas además de los logs.** Los logs de la API solo
existen cuando alguien la usa y el proceso está vivo para escribirlos. Una hora
sin líneas puede significar «nadie entró» o «estaba caída», y los logs no
distinguen una cosa de la otra. Una sonda sintética hace una petición conocida
a intervalos fijos (cada 5 min) desde fuera del sistema y anota el resultado
donde corre (GitHub o el equipo que la lance). Así la disponibilidad tiene
siempre denominador: cada 5 min hay una muestra, haya o no usuarios, y también
cuando el backend no puede escribir logs. Los logs operativos complementan a
las sondas con lo que ellas no ven: errores y latencia de cada operación real.

| Indicador | Fórmula | Fuente | Unidad | Periodo | Inclusión / exclusión |
| --- | --- | --- | --- | --- | --- |
| Disponibilidad | sondeos 2xx / sondeos × 100 | `synthetic.probe` | % | Producción: un sondeo por destino cada 5 min, historial de hasta 35 días. Local/CI: la corrida | Cuenta como fallo cualquier no-2xx, error de red o espera > 65 s. Excluye sondeos con `phase` en `exclusions.syntheticPhases` (el simulacro de reinicio provocado) |
| Latencia externa (P50, P95, P99) | percentiles de `durationMs` de los sondeos exitosos | `synthetic.probe` | ms | Igual que disponibilidad | Solo sondeos 2xx contados para disponibilidad: los fallidos ya penalizan la disponibilidad. Incluye red, TLS, proxy de Vercel (si el destino pasa por él), API y BD; es lo que percibe un cliente |
| Tasa de errores | respuestas 5xx / peticiones × 100 | `http.request` | % | La corrida, o el periodo de los logs leídos | Excluye `^/api/health`. Los 4xx cuentan en el denominador pero no como error |
| Tasa de operaciones exitosas (confiabilidad) | 2xx/3xx / (2xx/3xx + 5xx + abortadas) | `http.request` + `http.aborted` de POST/PUT/PATCH/DELETE | % | Igual | Excluye 4xx (rechazo correcto de una entrada inválida), lecturas y salud |
| Latencia media, P50, P95, P99 | media y percentiles de `durationMs` | `http.request` (tiempo medido en el servidor) | ms | Igual | Excluye `^/api/health`; incluye todos los estados |
| Rendimiento bajo carga | throughput mínimo entre escenarios; p95 y % de errores medidos en el cliente | `load.scenario` | rps, ms, % | 15 concurrentes × N s por escenario | Solo GET de lectura en local; red y TLS de producción no incluidos |
| Tiempo de recuperación | del primer sondeo fallido al siguiente exitoso; el SLO compara el máximo | `synthetic.probe` | s | Igual que disponibilidad | Una interrupción sin recuperación posterior queda «abierta» y no cuenta como recuperada. La resolución es el intervalo de sondeo (1 s en local, 5 min en Actions) |

## 11. SLO propuestos y justificación

Configurables en `scripts/quality/slo.config.json`. Son **objetivos internos
iniciales**, no un SLA: el proyecto no compromete disponibilidad contractual
(plan DEC-013; `despliegue.md`). Cada SLO da `cumple`, `no cumple` o
`sin datos suficientes` (menos muestras que `minSamples`); nunca se declara
cumplimiento sin datos. `sli-report.mjs --strict` sale con 1 si algún SLO no
se cumple.

| SLO | Objetivo | Mín. muestras | Justificación |
| --- | --- | --- | --- |
| Disponibilidad sintética | ≥ 99,0 % | 1 | RNF10 pide disponibilidad «según el nivel definido» y DEC-013 la deja observada. 99 % (~7 h/mes) es alcanzable en Render Free si el arranque en frío responde dentro de 65 s |
| Latencia externa P95 (sondas) | ≤ 1000 ms | 20 | DEC-013: lectura ≤ 1 s, ahora medida desde fuera. 20 muestras son ~1 h 40 min de sondeo cada 5 min. Se revisará tras la primera semana de datos reales |
| Tasa de errores 5xx | ≤ 0,5 % | 1 | No hay umbral documentado; se propone el valor y se ajustará con tráfico real. Medido en local bajo carga: 0 % |
| Éxito de operaciones de escritura | ≥ 99,5 % | 1 | Complemento para escrituras (registro, altas, check-in). Aún **sin datos**: la carga solo hace lecturas |
| Latencia P50 | ≤ 300 ms | 20 | Margen para red y Supabase en producción |
| Latencia P95 | ≤ 1000 ms | 20 | DEC-013: objetivo de lectura ≤ 1 s |
| Latencia P99 | ≤ 2000 ms | 100 | Cola larga acotada a 2 s, por debajo del *timeout* de servidor de 15 s |
| Throughput bajo carga | ≥ 5 rps con 15 concurrentes | 1 | TT-021-1 |
| Tiempo de recuperación | ≤ 65 s | 1 | DEC-013: espera de arranque de 65 s (arranque en frío ≤ 60 s) |

La suite `load` aplica además umbrales propios como pruebas `rendimiento`
(`load` en la configuración: p95 ≤ 1000 ms, errores ≤ 1 %, ≥ 5 rps y
recuperación ≤ 65 s). Si no se cumplen, la corrida falla.

## 12. Resultados reales

### 12.1 Corrida definitiva `20261125T173956Z-9cb698` (T)

Commit `f42a1f3` con los cambios de este trabajo sin confirmar (`-dirty`),
entorno `local`, 223,6 s, resultado **aprobada**.

| Suite | Pruebas | Aprobadas | Fallidas | Omitidas | Bloqueadas | Duración |
| --- | --- | --- | --- | --- | --- | --- |
| quality | 29 | 29 | 0 | 0 | 0 | 2,1 s |
| api | 268 | 268 | 0 | 0 | 0 | 99,2 s |
| web | 178 | 178 | 0 | 0 | 0 | 14,9 s |
| mobile | 123 | 123 | 0 | 0 | 0 | 34,2 s |
| load | 4 | 4 | 0 | 0 | 0 | 69,6 s |
| **Total** | **602** | **602** | **0** | **0** | **0** | **100 % de aprobación** |

Por tipo: funcional 228, integración 148, unitaria 131, recuperación 40, e2e 31,
seguridad 19, rendimiento 3, regresión 2.

Línea base antes de este trabajo (T, misma máquina): API 256/256, Web 178/178 y
móvil 123/123. Las 12 pruebas nuevas de la API y las 29 de herramientas no
rompieron ninguna existente.

### 12.2 SLI y SLO medidos bajo carga local (T)

`sli-report.md` de la corrida definitiva: 20 811 peticiones al servicio
`plans` registradas por la API; las de `/api/health*` se excluyen. Hubo 60
sondeos de disponibilidad, más los del simulacro, que se excluyen de la
disponibilidad pero se usan para medir la recuperación. Periodo:
17:42:31–17:43:38 UTC.

| SLO | Objetivo | Valor medido | Muestras | Resultado |
| --- | --- | --- | --- | --- |
| Disponibilidad sintética | ≥ 99 % | 100 % | 60 | cumple |
| Tasa de errores 5xx | ≤ 0,5 % | 0 % | 20 811 | cumple |
| Éxito de operaciones de escritura | ≥ 99,5 % | n/d | 0 | **sin datos suficientes** |
| Latencia P50 (servidor) | ≤ 300 ms | 6,8 ms | 20 811 | cumple |
| Latencia P95 (servidor) | ≤ 1000 ms | 13,3 ms | 20 811 | cumple |
| Latencia P99 (servidor) | ≤ 2000 ms | 18,7 ms | 20 811 | cumple |
| Throughput bajo carga | ≥ 5 rps | 1039,67 rps | 3 escenarios | cumple |
| Tiempo de recuperación | ≤ 65 s | 5,03 s | 1 interrupción | cumple |

Carga con 15 concurrentes y 20 s por escenario. Los valores se midieron en el
cliente, en las tres corridas completas del día:

| Escenario | Corrida `7321cd` rps / p95 | Corrida `34d734` rps / p95 | Corrida `9cb698` rps / p95 |
| --- | --- | --- | --- |
| `GET /api/health` | 6148,5 / 4,7 ms | 1496,3 / 19,2 ms | 1225,2 / 28,3 ms |
| `GET /api/health/ready` | 4391,3 / 6,2 ms | 1135,6 / 21,8 ms | 1136,1 / 22,0 ms |
| `GET /api/plans` | 3867,2 / 6,9 ms | 1039,8 / 25,4 ms | 1039,7 / 24,7 ms |
| Recuperación tras reinicio | 5,04 s | 4,9 s | 5,1 s |

Ninguna petición falló en ningún escenario. La primera corrida fue unas 3,7
veces más rápida que las otras dos. No se investigó la causa (carga de la
máquina, estado de la caché de PostgreSQL), por eso se reportan las tres
corridas. El P95 del servidor fue de 3,9 ms en la primera y de 13,3 ms en las
otras dos.

### 12.3 El mismo cálculo sobre el tráfico de la suite API (T, informativo)

Al aplicar `sli-report.mjs` a los logs de la suite `api` de la corrida
`7321cd` (1499 peticiones), el evaluador marca **no cumple**: errores 5xx
1,27 % y éxito de operaciones 95,87 % (363 escrituras). Las latencias fueron
P50 5,9 ms, P95 81,5 ms y P99 242,5 ms. Se revisaron los 14 eventos de error:

- 11 fallos `P0001` inyectados por las pruebas (mensajes `injected`, `fixture`,
  `synthetic failure`).
- 2 `ECONNREFUSED` contra un puerto cerrado a propósito (`observability`).
- 1 `42703` que, cruzando su `ts` con `results.jsonl`, pertenece a la prueba
  *«HU-019 failure of the available profile query is a safe error…»*, que
  provoca el fallo deliberadamente.

Ninguno es un defecto. Esto muestra dos cosas: el evaluador detecta
incumplimientos reales, y por eso los SLI **no** se calculan con tráfico de
pruebas. El 100 % de pruebas aprobadas coexiste con un 1,27 % de respuestas
5xx provocadas.

## 13. Evidencias de ejecuciones exitosas y fallidas

`test-results/history.jsonl` de la máquina local (T). Las cuatro primeras
corridas son de la validación parcial durante la implementación:

| Corrida | Suites | Resultado | Total | Aprobadas | Fallidas | Bloqueadas | % aprob. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20261125T171801Z-50591c` | quality, web, mobile | aprobada | 325 | 325 | 0 | 0 | 100 |
| `20261125T171948Z-3f43af` | quality, web | aprobada | 202 | 202 | 0 | 0 | 100 |
| `20261125T172013Z-eb690a` | api, load con URL no local | **fallida** | 2 | 0 | 0 | 2 | 0 |
| `20261125T172101Z-b80e5b` | quality | aprobada | 24 | 24 | 0 | 0 | 100 |
| `20261125T172411Z-7321cd` | todas | aprobada | 598 | 598 | 0 | 0 | 100 |
| `20261125T173314Z-34d734` | todas | aprobada | 600 | 600 | 0 | 0 | 100 |
| `20261125T173734Z-c956b5` | api con PostgreSQL inalcanzable | **fallida** | 276 | 112 | 164 | 0 | 40,58 |
| `20261125T173956Z-9cb698` | todas | aprobada | 602 | 602 | 0 | 0 | 100 |
| `20261125T174553Z-5b9006` | api con PostgreSQL inalcanzable (repetida tras corregir rutas) | **fallida** | 276 | 112 | 164 | 0 | 40,58 |

**Ejecución fallida real** (`c956b5`, repetida como `5b9006`). `TEST_DATABASE_URL` apuntaba a
`127.0.0.1:1`, un puerto cerrado. Pasa el control de host local, así que las
pruebas se ejecutan y fallan de verdad. El runner salió con código 1. Registro
(recortado):

```json
{"runId":"20261125T173734Z-c956b5","suite":"api","testId":"api:7317634e7511","name":"credentials require current password, reject identity manipulation and duplicates, revoke all sessions and preserve record","file":"apps/api/tests/account-lifecycle.test.ts","module":"Ciclo de cuenta (credenciales, invitación y activación)","type":"e2e","requirements":["HU-006","HU-007","HU-008"],"durationMs":9.337,"expected":"La prueba finaliza sin errores","actual":"[ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1","status":"fallida","errorMessage":"[ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:1","environment":"local","commit":"f42a1f3…-dirty"}
```

El total sube a 276 frente a 268 porque, cuando falla un *hook* `before`, Node
informa por separado el fallo del archivo y el de cada prueba.

**Ejecución bloqueada** (`eb690a`). Con un host no local, el runner no se
conecta a nada y deja el motivo:
`TEST_DATABASE_URL no es local (host: db.example.com); solo se permite localhost, 127.0.0.1 o ::1.`

**Fallo de aserción con esperado/obtenido.** `node-reporter.test.mjs` ejecuta
una suite de prueba con un `assert.deepStrictEqual` que falla a propósito, una
prueba omitida, pruebas anidadas y un archivo con error de sintaxis. Comprueba
que se registran `expected`, `actual`, `omitida`, el nombre completo anidado,
el fallo a nivel de archivo y un `testId` estable entre dos corridas.

Copias versionadas de la evidencia (sin datos sensibles):
[`evidencia-calidad/`](evidencia-calidad/). Los artefactos completos (con los
logs operativos comprimidos) quedan en `test-results/`, que Git ignora, y se
regeneran con el comando de §9.

### Defectos encontrados al validar

La propia automatización detectó estos defectos, que se corrigieron antes de la
corrida definitiva:

| Defecto | Cómo se detectó | Corrección |
| --- | --- | --- |
| El informe SLI fallaba con `Maximum call stack size exceeded` | Corrida `7321cd` (T): `Math.min(...)` sobre 288 230 marcas de tiempo | Recorrido lineal `extent()`, más una prueba de regresión con 300 000 valores |
| El simulacro de reinicio contaba como caída real (disponibilidad < 99 %) | Corrida simulada del implementador (T) | Sondeos con `phase: recovery-drill` excluidos por configuración, más una prueba de regresión |
| Las pruebas de `quality` quedaban sin clasificar | Matriz de cobertura (T) | Ruta de la suite corregida, más `catalog.test.mjs` |
| Un fallo del informe SLI solo se imprimía y la corrida seguía verde | Revisión de código (E) | Ahora se registra como `fallida` |
| La depuración del historial sintético usaba `mtime`, que la caché de Actions no conserva | Revisión de código (E) | Depuración por la fecha del nombre de archivo |
| Si fallaba la retención, se perdían todas las líneas siguientes del logger | Revisión de código (E) | La retención ya no interrumpe la escritura |
| 69 MB de logs por corrida de carga | Corrida `7321cd` (T) | Compresión gzip nativa (1,8 MB), con lectura transparente de `.jsonl.gz` |
| Los fallos a nivel de archivo publicaban la ruta absoluta de la máquina, que incluye el usuario local | Corrida `c956b5` (T) | Se usa la ruta relativa al repositorio y una prueba lo comprueba; la corrida se repitió como `5b9006` |

## 14. Integración continua

`.github/workflows/ci.yml` se ejecuta en `push` a `main`, en *pull requests*
que tocan `apps/**`, `docs/database/**`, `scripts/quality/**` o los
*workflows*, y manualmente:

1. Levanta un servicio `postgres:17` desechable (UTF-8, proveedor *builtin*
   `C.UTF-8`) y migra la base de pruebas con `db:migrate`.
2. Instala dependencias con `npm ci`, compila la API (`tsc`), compila y analiza
   la Web (`build`, `lint`), instala Flutter 3.50.1 y ejecuta `flutter analyze`.
3. Ejecuta `node scripts/quality/test-all.mjs`, que incluye las cinco suites.
4. **Siempre**, incluso si algo falló, publica `summary.md` y `sli-report.md`
   en el resumen del job y sube `test-results/` como artefacto durante 30 días.
5. El job falla si `test-all.mjs` sale con ≠ 0: una corrida con pruebas
   fallidas o bloqueadas nunca queda en verde. No hay `continue-on-error`.

`synthetic.yml` sondea **cada 5 minutos** (`*/5 * * * *`, el mínimo de GitHub;
los cron programados pueden retrasarse) las URLs de la variable de repositorio
`SYNTHETIC_TARGETS`. Si la variable está vacía, el *job* no se ejecuta. En cada
ejecución:

- el historial se recupera y se guarda con la caché de Actions, y se depura a
  35 días por la fecha del nombre de archivo;
- `sli-report.md` (disponibilidad, latencia externa, recuperación y veredicto
  de SLO) aparece en el resumen del *job*;
- el *job* falla si el último sondeo falló, y GitHub lo marca en rojo.

El historial completo se sube como artefacto solo al lanzarlo a mano (**Run
workflow**) o cuando falla un sondeo. Con 288 ejecuciones al día, subirlo
siempre crearía cientos de copias.

Destinos recomendados, uno por módulo que se quiera vigilar:

| Destino | Qué comprueba si responde 2xx |
| --- | --- |
| `https://api.ferkxo.tech/api/health/ready` | API en Render viva y conectada a Supabase |
| `https://api.ferkxo.tech/api/plans` | Módulo de planes: lectura real de la BD con su consulta |
| `https://<dominio-web>/api/health/ready` | Cadena completa Vercel (proxy) → Render → Supabase |
| `https://<dominio-web>/` | La Web/PWA publicada en Vercel |

`/api/health/ready` solo existe una vez desplegado este cambio. Antes de eso,
`/api/health` mide únicamente que el proceso responde.

**Cambio de decisión (pendiente de acordar con el equipo).** El plan TT-021 y
`despliegue.md` prohibían un monitor cada 5 minutos porque funciona como
*keep-alive* de Render Free. La asignatura pide sondas cada 5 minutos o menos,
así que se adopta esa frecuencia. Consecuencias:

- Render Free deja de dormirse: desaparece el arranque en frío de ~60 s y el
  servicio consume horas de instancia todo el mes. Render da un cupo mensual
  de horas gratuitas por *workspace*; verifíquelo en su panel. Si hay otros
  servicios gratuitos en el mismo *workspace*, puede agotarse y Render los
  suspendería hasta el mes siguiente.
- La disponibilidad medida corresponde a un servicio que se mantiene
  despierto, no al uso normal de Render Free.

El repositorio es público, así que los minutos de Actions no tienen coste.
Como el sondeo corre fuera de la API, detecta caídas aunque el backend no
pueda escribir logs.

Para una demostración sin GitHub, el mismo sondeo puede correr desde cualquier
equipo durante un periodo acotado:

```powershell
node scripts/quality/synthetic-check.mjs --target https://api.ferkxo.tech/api/health/ready --target https://api.ferkxo.tech/api/plans --interval 300 --duration 3600 --out logs/synthetic
```

```powershell
node scripts/quality/sli-report.mjs --synthetic logs/synthetic --logs logs/none --out test-results/sli/produccion
```

Las credenciales de PostgreSQL del CI son del contenedor desechable y no dan
acceso a nada más. No hay secretos en los *workflows*.

## 15. Limitaciones y pendientes

- **CI no ejecutado en GitHub.** Los *workflows* se validaron como YAML y con
  Prettier, pero no se han ejecutado en Actions: falta el primer *push*. Las
  versiones de las acciones (`checkout@v4`, `setup-node@v4`,
  `upload-artifact@v4`, `cache@v4`, `subosito/flutter-action@v2`) no se
  verificaron en una ejecución real.
- **Sondas de producción sin activar.** Hay que definir `SYNTHETIC_TARGETS`
  (p. ej. `https://api.ferkxo.tech/api/health/ready`, una vez desplegado este
  cambio). Sin eso no existe medición de disponibilidad de producción, y este
  documento no reporta ninguna.
- **Visibilidad pública.** El repositorio es público: los resúmenes de los
  *jobs* son visibles para cualquiera y los artefactos los puede descargar
  cualquier persona con cuenta de GitHub. Contienen datos sintéticos (URLs
  públicas, códigos de estado, latencias y datos ficticios de prueba), sin
  credenciales ni datos de personas reales. Si la asignatura exige que ni eso
  sea público, el repositorio tendría que ser privado. En ese caso las sondas
  cada 5 min consumirían ~8640 minutos de Actions al mes, más que el cupo
  gratuito de un repositorio privado.
- **Mediciones solo locales.** Latencia, throughput y recuperación se midieron
  con API y PostgreSQL en la misma máquina. No representan Render Free +
  Supabase (red, TLS, arranque en frío de ~60 s). La recuperación medida (~5 s)
  es un reinicio del proceso, no un arranque en frío.
- **Variabilidad.** El throughput de `/api/plans` varió de 3867 a 1040 rps
  entre corridas en la misma máquina. Con 20 s por escenario las cifras son
  indicativas; TT-021-1 pide 5 minutos (`QUALITY_LOAD_DURATION_S=300`), que no
  se ejecutó.
- **Éxito de operaciones sin datos.** La carga no ejercita escrituras (el login
  tiene límite de peticiones y crear datos requiere *fixtures*). Ese SLO queda
  «sin datos suficientes» hasta tener logs de tráfico real.
- **Logs de producción.** Render guarda stdout, pero no hay exportación
  automática de ese flujo a JSONL para `sli-report.mjs`.
- **E2E con navegador y dispositivo.** No hay Playwright (no se añadieron
  dependencias). Las pruebas `integration_test` de Flutter
  (`account_lifecycle_test`, `client_login_profile_test`) necesitan un
  dispositivo o emulador y API con *fixtures*: no se integraron en el runner ni
  en CI. Los flujos E2E automáticos de este documento son a nivel de API.
- **Clientes sin logging centralizado.** Web y móvil manejan reintentos y la
  cola sin conexión (cubiertos por pruebas), pero sus fallos de sincronización
  solo llegan a la consola del dispositivo; no se envían al servidor.
- **Clasificación aproximada.** El tipo de prueba sale del archivo y de reglas
  por nombre; una prueba cuenta en un solo tipo. Hay 13 archivos sin
  requisito declarado: 11 de las apps y 2 de herramientas (§5).
- **Readiness parcial.** `/api/health/ready` comprueba la conexión
  (`SELECT 1`), no permisos ni migraciones (resto de TT-016).
- **`auth.logout`** no incluye `accountId`, porque el controlador no lo tiene
  sin una consulta adicional.

## 16. Archivos

| Archivo | Propósito |
| --- | --- |
| `scripts/quality/test-all.mjs` | Runner central: suites, registros, resumen, historial e informe SLI |
| `scripts/quality/node-test-reporter.mjs` | Reporter de `node:test` → JSONL |
| `scripts/quality/lib/flutter-machine.mjs` | Parser de `flutter test --machine` |
| `scripts/quality/lib/load-suite.mjs` | API efímera, carga, sondas y simulacro de reinicio |
| `scripts/quality/load-test.mjs` | Carga de lectura (CLI y módulo) |
| `scripts/quality/synthetic-check.mjs` | Sondas sintéticas (CLI y módulo) |
| `scripts/quality/sli-report.mjs` | SLI, SLO e informe JSON/Markdown |
| `scripts/quality/slo.config.json` | Servicios, exclusiones, umbrales de carga y SLO |
| `scripts/quality/test-catalog.json` | Módulo, tipo y requisitos por archivo de prueba |
| `scripts/quality/tests/` | Pruebas de las herramientas (29) |
| `apps/api/src/shared/utils/logger.ts` | Logger JSONL con niveles, redacción, rotación y retención |
| `apps/api/src/shared/middleware/request-logger.ts` | Correlación, latencia y estado por petición |
| `apps/api/src/shared/errors/database.ts` | Clasificación de errores de conectividad de BD |
| `apps/api/tests/logger.test.ts`, `observability.test.ts` | Pruebas del logging y de la recuperación ante BD caída |
| `.github/workflows/ci.yml`, `synthetic.yml` | CI y sondas programadas |
