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
| Sondas sintéticas de disponibilidad y latencia | `scripts/quality/synthetic-check.mjs` + `synthetic.yml` | Corte histórico de cuatro destinos en §12.4. El monitor integral y su configuración están en §17 |
| Cálculo de SLI y evaluación automática de SLO | `scripts/quality/sli-report.mjs` + `slo.config.json` | Implementado y ejecutado (T) |
| Integración continua | `.github/workflows/ci.yml` | Escrita y validada en sintaxis; **aún no ejecutada en GitHub** |
| Cumplimiento del SLA v3.0 (67 SLI, bitácora, CSV mensuales) | `sla-v3.ts`, pestaña «SLA v3.0», `operations.yml` | Implementado y probado en local (T); ver §18 |

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
| `http.error` | ERROR | Fallo que el cliente recibe como 503. Incluye `errorName`, `errorCode` y un mensaje operativo sanitizado |
| `db.pool_error` | ERROR | Error de un cliente inactivo del pool de `pg` |
| `server.started` / `server.stopping` / `server.stopped` | INFO | `port, nodeEnv` |
| `process.unhandled_rejection` / `process.uncaught_exception` | ERROR | Se registra y el proceso termina con 1, como antes |

- **Correlación.** Cada entrada de stdout recibe un UUID. El middleware
  propaga el `X-Request-Id` de la petición cuando es un UUID v4 o el ID hexadecimal
  generado por la app móvil. En los demás casos devuelve un UUID nuevo. El mismo
  identificador une `db.connection_error` con `http.request`.
- **Campos sanitizados.** El registro usa la plantilla de ruta de Express con
  `:id` para parámetros y una ruta genérica para peticiones sin coincidencia.
  Los errores inesperados incluyen categoría y código técnico con un mensaje
  controlado. Se omiten cuerpos, parámetros de consulta y valores de cabeceras.
  `observability.test.ts` comprueba la redacción de credenciales, rutas y errores.
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
| Disponibilidad sintética | ≥ 98,0 % | 1 | SLA v3.0 D-01…D-03 (antes 99 % interno). 98 % admite ~14,4 h/mes de indisponibilidad (SLA §8.4) |
| Latencia externa P95 (sondas) | ≤ 1000 ms | 20 | DEC-013: lectura ≤ 1 s, ahora medida desde fuera. 20 muestras son ~1 h 40 min de sondeo cada 5 min. Se revisará tras la primera semana de datos reales |
| Tasa de errores 5xx | ≤ 2 % | 1 | SLA v3.0 G-01 (antes 0,5 % interno). Medido en local bajo carga: 0 % |
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

### 12.4 Primera medición de producción (T)

Primera ejecución de `synthetic.yml` en GitHub Actions (run `45672924883`,
lanzada a mano el 25-nov-2026 a las 18:13 UTC, artefacto
`synthetic-45672924883`). Desde ese momento corre sola cada 5 minutos.

| Destino | Estado | Latencia desde GitHub |
| --- | --- | --- |
| `https://api.ferkxo.tech/api/health/ready` | 200 | 966,9 ms |
| `https://api.ferkxo.tech/api/plans` | 200 | 849,8 ms |
| `https://couchonefit-web.vercel.app/api/health/ready` | 200 | 1173,4 ms |
| `https://couchonefit-web.vercel.app/` | 200 | 641,2 ms |

Disponibilidad 100 % (4 de 4). La latencia externa P95 (1173,4 ms) supera el
objetivo de 1000 ms, pero con 4 muestras el SLO queda «sin datos
suficientes»: se requieren 20. Cada sondeo abre una conexión nueva (DNS + TLS)
desde los servidores de GitHub, por lo que mide el peor caso de un cliente
que llega por primera vez. Si con más muestras se mantiene por encima de 1 s,
el informe marcará «no cumple»; es un resultado válido, que habrá que revisar
antes de mover el objetivo.

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
5. El job falla cuando `test-all.mjs` registra pruebas fallidas o bloqueadas.

El paso opcional de ingesta de CI se ejecuta en la rama predeterminada, en
`push` y ejecuciones manuales. Envía todos los casos en lotes de hasta 500 y
conserva su correlación por corrida. Los resultados se etiquetan como `ci`.
Los detalles de aserciones y las salidas originales quedan en el artefacto de
CI. Un fallo de sincronización se indica en el paso opcional y el artefacto
permite reintentar con el mismo identificador de corrida.

`synthetic.yml` usa el monitor integral descrito en §17.2. El flujo heredado
con `SYNTHETIC_TARGETS` sigue disponible para sondeos HTTP básicos cuando se
omiten las URLs individuales del nuevo monitor. En ese modo, los resultados
alimentan el informe CLI de SLI y SLO.

Destinos recomendados, uno por módulo que se quiera vigilar:

| Destino | Qué comprueba si responde 2xx |
| --- | --- |
| `https://api.ferkxo.tech/api/health/ready` | API en Render viva y conectada a Supabase |
| `https://api.ferkxo.tech/api/plans` | Módulo de planes: lectura real de la BD con su consulta |
| `https://<dominio-web>/api/health/ready` | Cadena completa Vercel (proxy) → Render → Supabase |
| `https://<dominio-web>/` | La Web/PWA publicada en Vercel |

`/api/health/ready` solo existe una vez desplegado este cambio. Antes de eso,
`/api/health` mide únicamente que el proceso responde.

**Alcance histórico.** El sondeo de §12.4 usó el flujo original y el intervalo de
cinco minutos. Ese intervalo mantiene activa la instancia de Render Free y afecta
la interpretación de latencias y arranques en frío. Consulta la configuración
actual, la activación y las cuotas en §17.2.

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

- **Primera ejecución del CI en GitHub** (run `45672276163`, commit
  `aa4d40f`, T): falló en «Análisis estático móvil». `flutter analyze` sale
  con 1 por 56 avisos `info` preexistentes: Flutter 3.50 declara obsoleto
  `package:flutter/material.dart`. Pasaron la instalación, la migración de
  PostgreSQL 17, la compilación de API y Web, el lint, Flutter 3.50.1 y
  `pub get`. El CI quedó en rojo y no ejecutó las pruebas, tal como se
  diseñó. Corrección: `flutter analyze --no-fatal-infos`, que sigue fallando
  ante *warnings* y errores; migrar a `material_ui` queda como tarea aparte.
  Las acciones `@v4` funcionan, aunque GitHub avisa que fuerzan Node 24.
- **Corrida completa en GitHub pendiente** de un nuevo *push* con esa
  corrección.
- **Historial de producción corto.** §12.4 conserva el primer resultado del
  sondeo anterior, con cuatro destinos en `SYNTHETIC_TARGETS`. Los objetivos
  del módulo integral necesitan evidencia acumulada tras la activación.
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
- **Telemetría de clientes.** La PWA comunica a la API eventos técnicos de
  sincronización cuando recupera conectividad y dispone de sesión. Flutter
  aporta correlación a sus peticiones HTTP.
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
| `scripts/quality/tests/` | Pruebas de las herramientas (31) |
| `apps/api/src/shared/utils/logger.ts` | Logger JSONL con niveles, redacción, rotación y retención |
| `apps/api/src/shared/middleware/request-logger.ts` | Correlación, latencia y estado por petición |
| `apps/api/src/shared/errors/database.ts` | Clasificación de errores de conectividad de BD |
| `apps/api/tests/logger.test.ts`, `observability.test.ts`, `observability-module.test.ts` | Pruebas de logging, recuperación ante BD caída, SLI/SLO/SLA e ingesta |
| `.github/workflows/ci.yml`, `synthetic.yml` | CI y sondas programadas + ingesta en observabilidad |
| `docs/database/migrations/202611250001_observability_sla.sql` | 14 tablas `private.observability_*`, RLS admin, funciones y semillas SLI/SLO |
| `apps/api/src/features/observability/` | Sink PostgreSQL sin recursividad, motor SLI/SLO, incidentes, ingesta y API admin |
| `apps/web/src/features/observability/` | Módulo admin «Observabilidad y niveles de servicio» |
| `scripts/quality/external-monitor.mjs`, `ingest-test-run.mjs` | Monitor sintético/funcional externo, buffer local y sincronización CI |
| `docs/api/observability.openapi.json` | Especificación OpenAPI de observabilidad, ingesta y telemetría |

---

## 17. Módulo integral de observabilidad, SLI/SLO/SLA y monitoreo externo (Proyectos 3.1 y 3.2)

### 17.1 Arquitectura y persistencia en producción (Render + Vercel + Supabase)

```text
PWA administrativa ── sesión/CORS/CSRF ──► API Express ──► PostgreSQL privado
PWA y Flutter ──────── HTTP correlacionado ─► logger ┬──► stdout JSONL
                                                     └──► lotes PostgreSQL
GitHub Actions ──► monitor Node ──► Web, API y readiness de PostgreSQL
                        └──► cola en Actions ──► ingesta idempotente ──► PostgreSQL
```

- **Registros operativos.** `DatabaseLogSink` envía lotes de 25 registros cada
  dos segundos o cuando se llena el lote. La cola en memoria tiene 500 lugares
  y el reintento ante una BD caída aumenta hasta 60 segundos. Un aviso fijo en
  stderr identifica el fallo del destino y el lote exitoso registra la
  recuperación. stdout conserva evidencia complementaria. Un reinicio o una
  interrupción prolongada puede perder registros operativos que seguían en
  memoria.
- **Permisos.** La PWA usa la sesión administrativa existente y las escrituras
  con cookies requieren CSRF. El backend consulta con su rol ordinario y RLS
  en `private`. Las funciones de ingesta y mantenimiento tienen permisos
  acotados. El tráfico autenticado del monitor lleva la marca `synthetic` y
  queda fuera de los SLI HTTP operativos. [Contrato de observabilidad](../api/observability.openapi.json).
- **Crecimiento.** Observabilidad tiene políticas configurables de retención
  para logs, comprobaciones y evaluaciones. El custodio las aplica con
  «Ejecutar retención» en la sección de pruebas. Los registros recientes
  sostienen los filtros detallados y los históricos evaluados quedan en sus
  cortes. Un percentil de todo un periodo requiere sus muestras; promediar
  percentiles horarios produciría otro valor. [Operación de PostgreSQL](../database/README.md).

### 17.2 Monitor sintético y funcional independiente (`external-monitor.mjs`)

El ejecutor usa `fetch` de Node 24. Comprueba HTML en la Web, JSON en el
liveness de la API y `SELECT 1` mediante el endpoint de readiness. Valida
autenticación, cartera, versiones de entrenamiento y nutrición, seguimiento y
perfil con cuentas sintéticas dedicadas. Comprueba códigos y estructura de
respuesta. Cada resultado guarda tiempos, estado y causa controlada. Si falla
un prerrequisito, sus comprobaciones dependientes quedan como `not_executed`.

| Alternativa | Evaluación |
| --- | --- |
| GitHub Actions + Node, elegida | El repositorio es público según `gh repo view`. Los runners Linux estándar están incluidos. El mínimo programable es cinco minutos y los eventos programados pueden retrasarse o perderse. [Programación](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [facturación](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| Render Cron Jobs | Añade un mínimo de USD 1 por trabajo al mes, comparte proveedor con la API y carece de disco persistente. [Render Cron Jobs](https://render.com/docs/cronjobs) |
| Vercel Cron Jobs | En Hobby el intervalo mínimo es de un día. Además, presta el servicio Web que se está midiendo. [Límites de Cron Jobs](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) |
| Postman/Newman | Ejecuta colecciones exportadas y puede añadirse a CI. Este proyecto ya expresa las verificaciones de respuesta con Node y compartirlas con un ejecutor local evita mantener otra colección. [Newman](https://learning.postman.com/docs/reference/newman-cli/command-line-integration-with-newman/) |

El intervalo predeterminado del panel es 30 minutos (SLA v3.0, §18) y admite
5, 10, 15 y 60. La activación periódica también requiere `SYNTHETIC_MONITOR_ENABLED=true`
en el repositorio. Con cinco minutos un solo servicio Render Free puede
consumir hasta 744 de las 750 horas compartidas en un mes de 31 días y altera
la medición de arranque en frío. Mientras siga vigente DEC-013, usa una ventana
de revisión autorizada o selecciona 30 o 60 minutos para permitir el reposo
de la instancia. El cupo libre real del workspace se comprueba en Render
antes de habilitar ese intervalo. Si Supabase usa Free, el límite publicado
de base de datos es de 500 MB. Ambos cupos se revisan en las cuentas del
proyecto antes de activar. [Render Free](https://render.com/docs/free), [Supabase](https://supabase.com/pricing).

**Configuración de activación**

| Ubicación | Valor esperado |
| --- | --- |
| Render | `OBSERVABILITY_INGEST_SECRET` aleatorio de al menos 32 bytes, `OBSERVABILITY_ENV=production`, `OBSERVABILITY_WEB_URL` con el origen público de la Web. El runtime usa `DATABASE_URL` de rol ordinario por TLS |
| GitHub Actions, variables | `SYNTHETIC_API_URL` y `SYNTHETIC_WEB_URL` con los orígenes públicos y `SYNTHETIC_ORIGIN` permitido por la API. `OBSERVABILITY_INGEST_URL` puede fijarse a la URL absoluta de `/api/observability/ingest` |
| GitHub Actions, secretos | `OBSERVABILITY_INGEST_TOKEN` igual al secreto de Render. `SYNTHETIC_PRO_IDENTIFIER`, `SYNTHETIC_PRO_PASSWORD`, `SYNTHETIC_CLIENT_IDENTIFIER`, `SYNTHETIC_CLIENT_PASSWORD` y `SYNTHETIC_CLIENT_ID` corresponden a cuentas y expediente QA dedicados |
| Panel de administración | Ajustar frecuencia, retención y umbrales. Usar `Run workflow` desde la rama predeterminada para verificar una muestra antes de habilitar la programación |

El monitor conserva `pending-ingest.jsonl` fuera del backend y reintenta hasta
20 lotes por ejecución. El estado UTC detecta hasta siete días de slots
perdidos y los registra como `SCHEDULE_SLOT_MISSED`. La caché de Actions
recupera el estado al programar la siguiente corrida. Si quedan pendientes,
el workflow conserva un artefacto sanitizado durante 30 días. Si expira o
falla la caché, descarga el artefacto `synthetic-<run_id>-<run_attempt>` y
reenvía su cola con `OBSERVABILITY_INGEST_URL` y `OBSERVABILITY_INGEST_TOKEN`
definidos en el entorno del operador. Un lote rechazado definitivamente queda
en `rejected-ingest.jsonl` para revisar el contrato sin detener los demás.

```powershell
node scripts/quality/external-monitor.mjs --replay-only --out <directorio-con-pending-ingest.jsonl> --env production
node scripts/quality/ingest-test-run.mjs <directorio-de-corrida-CI>
```

El replay conserva `externalRunId` y `externalEventId`. El control de agenda
distingue los slots perdidos de las sondas ejecutadas que encontraron caídas.
Si se pierden tanto la caché como los artefactos, la cobertura desde el
último estado recuperado queda incompleta. [Artefactos y caché de GitHub](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts).

### 17.3 Gestión dinámica de SLI, SLO (versionados), SLA, incidentes y pruebas

- **SLI.** El catálogo admite `operational_http`, `synthetic_availability`,
  `synthetic_functional`, `automated_tests` y `client_telemetry`. Los filtros
  de método, ruta, módulo y códigos HTTP acotan las operaciones elegibles. La
  disponibilidad y el éxito son `100 × aprobadas / elegibles`, la tasa de
  error es `100 × fallidas / elegibles` según el método configurado y la
  latencia media divide la suma de duraciones entre su número de muestras.
  P50, P95 y P99 eligen el rango `ceil(p × n / 100)` de la serie ordenada.
  Para un objetivo de consultas de entrenamiento se puede medir el porcentaje
  de `GET` elegibles bajo un umbral de milisegundos y asociarle un SLO.
- **SLO.** La comparación usa el operador y umbral configurados. El corte
  conserva el ambiente, límites de la ventana y versión del SLO. La fecha
  del corte identifica la versión aplicable del SLI vinculado. La evaluación
  se acota al periodo solicitado y a la vigencia de la configuración.
  La diferencia es `observado − objetivo`, la tendencia compara ventanas
  con muestras suficientes y el presupuesto para porcentajes de éxito usa
  `100 − objetivo`. El historial automático limita cada ambiente a un lote
  de evaluaciones por hora UTC. Los cortes previos mantienen su interpretación.
- **Cobertura.** Un denominador vacío, menos de `minSamples`, una ventana
  truncada o una sonda periódica obsoleta pueden dejar el SLO en
  `insufficient_data`. Para porcentajes con comprobaciones omitidas se
  comparan los extremos plausibles. El veredicto requiere que ambos coincidan.
  La disponibilidad observada se publica junto a la cobertura de sondeos.
- **SLA.** Cada registro conserva vigencia, responsabilidades, exclusiones,
  compromisos y sus SLO vinculados. `draft`, `internal_reference`,
  `formally_approved` y `expired` distinguen su aprobación. Los objetivos
  sembrados son internos. Los compromisos y consecuencias formales se
  registran únicamente si el proyecto los aprobó.
- **Incidentes.** Los fallos de disponibilidad, las comprobaciones
  consecutivas, la latencia, la tasa de errores y el incumplimiento de SLO
  generan señales. La clave por ambiente y condición evita incidentes abiertos
  duplicados. La recuperación observada permite calcular el tiempo entre la
  primera detección y la recuperación. La interfaz muestra incidentes activos
  e históricos y el workflow señala fallos de sondeo.
- **Pruebas manuales.** El catálogo fijo del servidor permite comprobar API,
  PostgreSQL, planes, persistencia de observabilidad y el HTML de la Web.
  Se ejecuta sólo contra el ambiente conectado. El panel pagina los resultados
  y carga el detalle de cada corrida desde PostgreSQL.

### 17.4 Resultados reproducibles del 25 de noviembre de 2026

**T, PostgreSQL local exclusivo `CouchOneFit_test`.** El runner generó los
JSONL, resúmenes y logs de cada suite en `test-results/runs/<runId>/`. La
corrida `20261125T193517Z-24042d` ejecutó las cinco suites y registró 622 casos
aprobados. Un fixture retroactivo asoció dos fallos de Web que tuvieron una
recuperación real de prueba entre ellos. La regresión corregida emite las
sondas en orden y verifica el conteo por paso, el reenvío y la recuperación.

| Comprobación | Resultado local |
| --- | --- |
| API | 275/275, cero fallidas ni bloqueadas en la repetición `20261125T194253Z-1c2c4e`. La suite física opcional de HU-022 requiere su propio clúster de pruebas |
| Calidad, Web, móvil y carga controlada | 38/38, 182/182, 124/124 y 4/4 en `20261125T193517Z-24042d` |
| Regresión de observabilidad | 3/3, dos veces consecutivas tras corregir el fixture de incidentes |
| Migraciones | Instalación limpia y actualización con filas de la primera migración de observabilidad. Coincidencia con el esquema integrado |
| Comprobaciones estáticas | `tsc` en API y Web, build Vite con Workbox, Oxlint, Prettier de archivos modificados, formato Dart, análisis Flutter y sintaxis YAML/Bash. Flutter conserva 56 avisos informativos de deprecación |
| Navegador integrado | Sesión admin, tablero, detalle correlacionado, cinco comprobaciones autorizadas, historial tras reiniciar la API y reportes con totales. El ambiente distinto del runtime bloqueó la ejecución |
| Android `emulator-5556` | Ciclo de activación, sesión nativa, cambio de credenciales, recuperación asistida y reingreso |

**T, monitor externo local.** Con cuentas QA y un expediente dedicado,
14 verificaciones aprobadas. Cuando se dejó sin servidor la dirección local
de Web y API, el monitor registró dos fallos y 12 comprobaciones no
ejecutadas. Conservó un lote fuera de la API, lo importó en PostgreSQL al
restablecer el destino y un reenvío insertó cero resultados adicionales.
El historial y la cola se verificaron en `test-results/monitor-local-7be45694/`.

**T, carga.** 15 solicitudes concurrentes durante 20 segundos por ruta en
loopback. P95 de 50,94 ms en liveness, 36,91 ms en readiness y 42,34 ms en
planes. Se verificó el reinicio controlado de la API con el mismo runner.
Estos datos describen la máquina de pruebas. El ensayo de cinco minutos de
TT-021 y las mediciones del entorno desplegado quedan pendientes.

**Repetición local.** Aplica las migraciones con `DATABASE_URL` apuntando a
la base exclusiva de pruebas. Ejecuta `node scripts/quality/test-all.mjs`
con `TEST_DATABASE_URL` local. Configura API y Web de desarrollo con el mismo
origen para CSRF y la Web con el proxy local. Exporta el token de ingesta en
el entorno del ejecutor y usa los identificadores de una cartera QA
dedicada según la tabla de §17.2.

```powershell
node scripts/quality/external-monitor.mjs --api-url http://127.0.0.1:3000 --web-url http://127.0.0.1:5000 --env development --out logs/qa-monitor --force
node scripts/quality/external-monitor.mjs --api-url http://127.0.0.1:3000 --env development --out logs/qa-monitor --replay-only
```

### 17.5 Límites y activación

- El cálculo en vivo lee hasta 50 000 logs y 25 000 comprobaciones por
  ventana de adquisición. El panel indica cuando se alcanza ese límite. El
  explorador exporta hasta 100 registros recientes por filtro.
- La comprobación de PostgreSQL pasa por readiness de la API. Si la API
  queda inaccesible, la comprobación de PostgreSQL queda como no ejecutada.
- El build Web advierte por el bundle principal de 912 kB. En Windows a 320 px
  el ancho mínimo global de la aplicación deja 15 px de desplazamiento
  horizontal con la barra vertical. Se comprobó el dashboard a 390, 768 y
  1280 px sin desplazamiento horizontal de la página.
- La validación queda en el entorno local. La activación requiere el flujo
  autorizado de migraciones de Supabase y despliegue de API/Web, configuración
  del monitor en la rama predeterminada y validación de los primeros
  resultados programados. El equipo conserva la revisión independiente y D0.

---

## 18. Cumplimiento del SLA v3.0 (Proyecto 2.1)

El documento «Acuerdo de Nivel de Servicio (SLA) v3.0» (8-nov-2026) define 67
SLI: 52 por función de negocio (F-01…F-26, éxito y latencia) y 15 de
plataforma, capacidad, continuidad y operación. El catálogo dinámico de §17.3
no podía expresarlos: sus ventanas son rodantes (1h–30d), cuenta los 4xx fuera
del denominador, no excluye 429, no filtra por `uptime_s`, no tiene ventanas de
mantenimiento ni valor atribuible y solo admite un prefijo de ruta por SLI. Por
eso el SLA se calcula con un catálogo **fijo y versionado** en código
(`sla-v3.ts`): sus SLI solo cambian con un anexo firmado (SLA §15), no desde
el panel. El catálogo dinámico sigue disponible para objetivos internos.

### 18.1 Matriz documento ↔ implementación

| SLA | Requisito | Antes (25-nov) | Ahora |
| --- | --- | --- | --- |
| P-1, §8.2 | Registro por petición con `ts, method, route, status, duration_ms, uptime_s` y exportación | Log sin `uptime_s`; CSV de 100 filas | `uptimeS` en cada `http.request`; `requests-AAAA-MM.csv` completo con `in_maintenance` |
| P-2 | `GET /api/ready` con consulta a la BD | Solo `/api/health/ready` | `/api/ready` (mismo handler) |
| P-3, D-01…D-03 | Sondeo externo cada 30 min | Monitor cada 5 min; D-01 en `/api/health/ready`; D-03 en readiness vía Web | Intervalo 30 min; D-01 `/api/ready`; D-03 `/api/health` vía Web; D-02 ≤ 20 s en el cálculo; disparo externo opcional |
| D-04 | Arranque en frío ≤ 60 s, 5 muestras | No se medía | El monitor marca `phase=cold_start` cuando `uptimeS` muestra que su petición despertó el proceso |
| §7.1, F-01…F-26 | 52 SLI con reglas comunes | No existían | Calculadora `sla-v3.ts` |
| G-01 | 5xx / total ≤ 2 % | Objetivo interno 0,5 % sin 429 excluido | En la calculadora |
| C-01 | Almacenamiento ≤ 80 % | No existía | Botón «Medir almacenamiento» (`pg_database_size`) |
| C-02 | 15 concurrentes, 5 rps, 5 min, ≥ 500 por tipo | Solo GET en lazo cerrado | Escenario `c02` lectura/escritura a ritmo fijo |
| P-4, R-01, R-02 | Respaldo diario cifrado y simulacro | Sin evidencia | `operations.yml` (opcional) + bitácora + procedimiento §18.5 |
| R-03 | `db:cleanup:access` en días hábiles | Manual sin registro | Bitácora + trabajo opcional en `operations.yml` |
| P-5, O-01, O-02 | Bitácora de incidentes con acuse/resolución en horario hábil | Solo incidentes automáticos | Bitácora con severidad alta/media/baja y plazos hábiles |
| §10, O-03 | Ventanas de mantenimiento avisadas ≥ 48 h | No existía | Bitácora; solo se descuentan ventanas en sábado 01:00–04:00 avisadas a tiempo |
| O-04 | Reporte en ≤ 5 días hábiles | No existía | Registro del envío |
| O-05 | Despliegues verificados | No existía | Trabajo `deploy-verify` (opcional) o registro manual |
| §8.5 | Valor observado y atribuible | No existía | Ambos; los SLO se evalúan con el atribuible |
| §13 | Compensación | No existía | Señal automática (D-01 atribuible < 95 % o incidente alta > 8 h hábiles) |
| §12 | Reporte mensual PDF + anexos | Reporte de periodo rodante | Pestaña «SLA v3.0»: mes calendario, 4 CSV y «Imprimir / PDF» |

### 18.2 Cálculo

`apps/api/src/features/observability/services/sla-v3.ts` es una función pura
(`computeSlaV3`) que recibe las peticiones, los sondeos y la bitácora de un mes
y devuelve los 67 SLI en el orden del SLA, con valor observado, atribuible,
muestras y estado (`met`, `unmet`, `insufficient_sample`, `no_data` o
`unverified`). Aplica las reglas de §7.1 tal como están escritas:

- Mes calendario en `America/Mexico_City`, UTC-6 fijo (SLA §5).
- Válida = petición a una transacción de la tabla 7.2, sin 429 y fuera de una
  ventana contable. Buena = status < 500. Se incluye todo el tráfico, también
  el del monitor: el SLA no excluye ninguna fuente.
- Latencia: p95 por rango más cercano sobre status < 500 y `uptime_s ≥ 60`.
  Las filas sin `uptime_s` (anteriores a este cambio) no entran en latencia.
- Menos de 50 válidas ⇒ «muestra insuficiente».
- Ventana contable: avisada con ≥ 48 h y dentro del sábado 01:00–04:00 (§10).
- Atribuible: sin las fallas dentro de un incidente de proveedor registrado.
- Plazos de O-01/O-02 en horario hábil (lunes a viernes 09:00–18:00, sin los
  días de descanso del art. 74 de la LFT).

El log guarda los parámetros de ruta como `:id`; el CSV los devuelve en la
notación del SLA (`/api/clients/:clientId`) para que la fórmula de §8.3 funcione
sin cambios. Las pruebas `sla-v3.test.ts` reproducen los tres ejemplos de §8.4
(F-02-E 98,47 %, F-22-L 640 ms, D-01 98,59 %).

### 18.3 Reporte mensual y archivos de evidencia

En Administración → Observabilidad → **SLA v3.0** se elige ambiente y mes. La
pestaña muestra los 67 SLI agrupados, la señal de compensación, los incidentes
caso por caso y las ventanas de mantenimiento. «Imprimir / PDF» genera el
entregable del §12. Los anexos del §8.1 se descargan desde la misma pestaña:

| Archivo | Columnas |
| --- | --- |
| `requests-AAAA-MM.csv` | `ts, method, route, status, duration_ms, uptime_s, in_maintenance` |
| `probes-AAAA-MM.csv` | `ts, target, status, duration_ms, content_ok, cold_start` (`cold_start` es una columna adicional para D-04) |
| `incidents-AAAA-MM.csv` | `id, severidad, recibido, acuse, resuelto, causa, atribuible` |
| `operations-AAAA-MM.csv` | `fecha, tipo, resultado, responsable, detalle` |

La bitácora («Bitácora SLA») registra ventanas de mantenimiento, incidentes de
proveedor y de soporte, respaldos, simulacros, depuraciones, mediciones de
almacenamiento (botón «Medir almacenamiento», `pg_database_size`), pruebas de
carga, envíos del reporte y despliegues. La retención de logs en PostgreSQL
sube a 62 días para que el mes anterior esté completo al generar el reporte.
**Los CSV se descargan al menos cada 7 días y se archivan 12 meses fuera de
Render y Supabase** (SLA §8.1): ese archivo es una tarea del operador.

### 18.4 Sondeo externo

Diagnóstico del 26-nov-2026 (T, `gh run list` y artefacto
`synthetic-45810978156-1`): el monitor está activo y las 14 comprobaciones
pasan en producción, pero GitHub solo disparó 2 de las ~160 ejecuciones
programadas entre el 25-nov 22:08 UTC y el 26-nov 11:29 UTC. Cada turno de 5
minutos perdido se registra como `SCHEDULE_SLOT_MISSED` y la cola de ingesta
crecía más rápido de lo que se vaciaba (86 lotes pendientes, 20 por corrida),
así que el workflow terminaba en rojo aunque los sondeos pasaran. En esa
corrida `GET /api/health` tardó 17,4 s: un arranque en frío real.

Cambios: intervalo de 30 minutos (SLA P-3; también respeta el reposo de Render
Free), hasta 100 lotes por corrida, D-01 en `/api/ready`, D-03 en `/api/health`
vía Vercel y marca `phase=cold_start` cuando el `uptimeS` de la respuesta es
menor o igual a su duración más 1 s. Como el programador de GitHub no
garantiza la frecuencia, `synthetic.yml` acepta `repository_dispatch`
(`event_type: synthetic-probe`) para que un servicio de cron externo lo
dispare cada 30 minutos con un token de grano fino (Contents: read & write).
El disparador de 5 minutos se conserva: `--respect-schedule` omite los turnos
que no corresponden.

### 18.5 Respaldos, restauración y depuración

`.github/workflows/operations.yml` contiene tres trabajos **desactivados hasta
que el propietario los configure**:

| Trabajo | Activación | Qué hace |
| --- | --- | --- |
| `backup` | `BACKUP_ENABLED=true`; secretos `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` | 03:00 h de Ciudad de México: `pg_dump` 17 en formato *custom*, cifrado AES-256 (PBKDF2, 200 000 iteraciones) y artefacto con 7 días de retención; registra R-01 |
| `access-cleanup` | `ACCESS_CLEANUP_ENABLED=true`; secreto `ACCESS_CLEANUP_DATABASE_URL` | `db:cleanup:access` diario; registra R-03 |
| `deploy-verify` | `SYNTHETIC_API_URL` (y los secretos de `synthetic.yml`) | Tras un *push* a `main` espera a que `/api/health` reporte el commit, ejecuta el monitor y registra O-05 |

Los tres registran su resultado con `scripts/quality/report-operation.mjs` en
`POST /api/observability/operations` (token de ingesta, idempotente por
`externalId`). El repositorio es público: cualquiera con cuenta de GitHub puede
descargar artefactos, por eso el respaldo **solo** se publica cifrado; la
frase de cifrado nunca sale de los secretos. `BACKUP_DATABASE_URL` necesita un
rol que pueda leer todo el esquema sin RLS (propietario); el rol de runtime no
sirve.

**Simulacro de restauración (R-02, trimestral, ≤ 4 h).** Contra una base local
o de pruebas, nunca contra producción:

1. Descargar el artefacto `backup-<run_id>-<attempt>` y descifrarlo:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in backup.dump.enc -out backup.dump`.
2. Crear una base vacía, aplicar `npm --prefix apps/api run db:migrate` (las
   migraciones recrean esquema, roles y permisos) y restaurar los datos con
   `pg_restore --data-only --disable-triggers --schema=private -d <base> backup.dump`
   (el respaldo solo contiene los esquemas `private` y `migrations`; el
   historial de migraciones se compara, no se restaura).
3. Comprobar roles y permisos, conteos por tabla frente al origen,
   restricciones (`pg_constraint` validadas), versiones de migración en
   `migrations.history` y relaciones (claves foráneas sin huérfanos), más un
   inicio de sesión y una consulta de cartera.
4. Registrar el simulacro en la bitácora (tipo «Simulacro de restauración»,
   inicio, fin y resultado). Mientras no exista uno aprobado, R-02 se muestra
   «Sin comprobar» y el RTO es un objetivo sin comprobar (SLA §14).

### 18.6 Condiciones de entrada en vigor (SLA §15)

| ID | Condición | Estado al 26-nov-2026 |
| --- | --- | --- |
| P-1 | Registro por petición y exportación | Implementado en el repositorio (T); falta desplegar y aplicar la migración en Supabase |
| P-2 | `GET /api/ready` con BD | Implementado (T); producción responde 404 hasta el despliegue |
| P-3 | Sondeo externo cada 30 min | Monitor activo; intervalo 30 min y `repository_dispatch` listos; falta configurar el disparador externo |
| P-4 | Respaldo diario y primer simulacro | Trabajo `backup` y procedimiento listos; faltan secretos y el simulacro |
| P-5 | Bitácoras activas | Bitácora en la pestaña SLA v3.0; falta empezar a registrar |
| P-6 | Confirmar planes de Render, Supabase y Vercel | Pendiente (paneles de los proveedores) |
| P-7 | Web vigente en `https://ferkxo.tech/` con `/api` reenviado | Pendiente: los sondeos actuales apuntan a `couchonefit-web.vercel.app` |

### 18.7 Resultados de validación (T)

Máquina local, PostgreSQL local exclusivo; nada se ejecutó contra Supabase ni
producción. Evidencia en [`evidencia-calidad/`](evidencia-calidad/).

| Corrida / comprobación | Resultado |
| --- | --- |
| `20261126T162326Z-1cb5ca`, cinco suites | **Aprobada**: 673 casos, 671 aprobados, 0 fallidos, 2 omitidos (C-02 con 20 s: muestra insuficiente, n = 50 < 500, por diseño). quality 51/51, api 298/298, web 189/189, mobile 129/129, load 4 + 2 omitidas |
| Pruebas nuevas dentro de esa corrida | `sla-v3` 18/18, `sla-v3-api` 5/5, `sla-compliance-web` 7/7, `report-operation` 5/5, `external-monitor` 9/9, `load-test` 9/9 |
| `20261126T161241Z-64a828`, suite `load` con `QUALITY_LOAD_C02_DURATION_S=300` | **C-02 cumple**: 15 concurrentes, 5,00 rps durante 300 s, 750 muestras por tipo, 0 errores; p95 lectura 38,12 ms (≤ 800) y escritura 25,09 ms (≤ 1500). Mide la máquina local, no Render + Supabase |
| Migración `202611260001` | Instalación limpia y actualización con filas existentes (`migrations.test.ts`); aplicada además a la base local de desarrollo |
| Compilación y estáticas | `tsc` de API, build Web, Oxlint, Prettier de los archivos Web tocados, sintaxis YAML de los dos *workflows*, `git diff --check` |
| API local en ejecución | `GET /api/ready` y `/api/health` responden 200 con `uptimeS`; el reporte SLA sin sesión responde 401; `/api/observability/operations` sin secreto configurado responde 503 igual que `/ingest` |

No se hizo el recorrido visual de la pestaña en el navegador: requiere una
sesión de administrador local y su alta es operación del custodio
(`db:seed:admin`). La pestaña queda cubierta por las pruebas jsdom.

### 18.8 Limitaciones

- El reporte carga el mes completo en memoria (marcado como atajo en el
  código); con más de ~1 millón de peticiones al mes conviene agregar en SQL.
- Los SLI de operación (R, O, C-01, C-02) dependen de que la bitácora se llene;
  sin registros se muestran «Sin datos», nunca como cumplidos. R-01 sin
  respaldos registrados se muestra 0 % (incumplido).
- D-04 solo cuenta los sondeos que despertaron el proceso; con tráfico real
  constante puede quedar en «muestra insuficiente».
- El valor atribuible depende de registrar a mano los incidentes de proveedor
  con su enlace a la página de estado.
- El catálogo dinámico de §17.3 conserva sus objetivos internos (p. ej. 99 %);
  el SLA se evalúa solo en la pestaña SLA v3.0.
