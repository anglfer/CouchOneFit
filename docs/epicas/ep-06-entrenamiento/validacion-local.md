# Validación después de integrar PR #24

Fecha local: 07-nov-2026. Checkout principal en `main`, commit `feb6ba6`.
Evidencia del asistente (T/E); no representa aceptación humana (R).

| Tipo | Comprobación | Resultado |
| --- | --- | --- |
| E | `git diff --quiet HEAD^2 HEAD` | El árbol integrado coincide con el de la rama del PR. |
| T | `npm --prefix apps/api run build` | Correcto. |
| T | Suite API con `node --import tsx --test --test-concurrency=1 tests/*.test.ts`, desde `apps/api` | 144/144; incluye entrenamiento, aislamiento, sesiones y migraciones. |
| T | `npm --prefix apps/web run build` y `npm --prefix apps/web run lint` | Correctos. |
| T | `node --test --test-concurrency=1 tests/*.test.mjs`, desde `apps/web` | 70/70. Advertencia de Vite en pruebas sobre `virtual:pwa-register`; build correcto. Una ejecución inicial desde la raíz falló por rutas SSR relativas; se repitió desde la app. |
| T | `flutter analyze` y `flutter test`, desde `apps/mobile` | Sin incidencias; 64/64. |
| T | HTTP API y proxy Web | Salud y planes: 200 en 3000 y mediante 5000. Historial propio y plantillas sin sesión: 401. |
| T | HTTP Web | `/`, `/acceso` y `/app/entrenamiento`: 200 con HTML de la app; no acredita renderizado ni autenticación visual. |
| T | `flutter devices` | Ningún Android conectado. |
| T | Disponibilidad de automatización visual | Host de navegador y canal nativo no disponibles. No se realizó recorrido visual. |

Para API se comprobó explícitamente `127.0.0.1/CouchOneFit_test`; tanto
`DATABASE_URL` como `TEST_DATABASE_URL` se fijaron a ese destino solo en los
procesos de validación. No se ejecutaron migraciones ni pruebas contra Supabase.
API y Web se dejaron iniciadas en 3000 y 5000 para revisión local.

Documentación consultada: `DEVELOPMENT.md`, `CONTRIBUTING.md`, README de EP-06
y README de Web/móvil. No se cambió código del producto.

Pendientes: recorrido visual autenticado, integración Android en dispositivo y
aceptación humana. Persisten las diferencias de formato Web documentadas en el
PR. La ejecución inicial generó `.vite/` en la raíz; la política automática
bloqueó su limpieza, por lo que permanece como caché local sin versionar.

## Corrección de la bandeja offline de rutinas (07-nov-2026)

Síntoma reportado (R): en «Pendientes de enviar» se acumulaban «Activar rutina» /
«Guardar rutina» fallidos con «El entrenamiento no está disponible» o «Se descartó
un cambio necesario», y capturas nuevas quedaban «Por enviar» sin enviarse nunca.

Causa (E): descartar una operación dejaba a sus dependientes en «fallido»; al
reintentarlos apuntaban a una versión que el servidor nunca creó (404
`TRAINING_NOT_FOUND`) o a una revisión inexistente (409). Además
`trainingWrite` seguía encolando cambios nuevos detrás de operaciones bloqueadas.

Cambio: `services/offline/sync.ts` descarta en cascada los dependientes tras
confirmar; `features/training/services/training.ts` rechaza encolar sobre una
rutina con un cambio fallido o en conflicto (la captura queda en el editor).

| Tipo | Comprobación | Resultado |
| --- | --- | --- |
| T | `npm --prefix apps/web run build` y `run lint` | Correctos. |
| T | `node --test --test-concurrency=1 tests/*.test.mjs` y `npm test`, desde `apps/web` | 71/71 en ambos; incluye la regresión nueva de cascada y bloqueo. |
| T | Prettier de los archivos tocados | Correcto. |
| E | `offline-read.test.mjs` | Fallaba de forma intermitente al correr la suite (espera fija de 20 ms a un guardado en segundo plano); ahora espera hasta 2 s. |

Pendiente: recorrido visual en navegador con la bandeja real de la persona usuaria.

## Envío lento y acciones duplicadas en la bandeja (07-nov-2026)

Síntoma reportado (R): con internet, «Guardar rutina» y dos «Activar rutina» quedaban
«Por enviar · Se enviará en unos segundos» sin salir, y se podía activar la misma
rutina varias veces.

Causa (E): `flushOutbox` reutilizaba la pasada en curso, que no ve lo encolado
después: lo nuevo esperaba al ciclo de 30 s. `trainingWrite` solo fusionaba
guardados; cada «Activar» creaba otra operación (la segunda nunca recibía la
revisión corregida). La pantalla decía «Sin conexión» y «en unos segundos» aunque
hubiera red o el cambio esperara a otro.

Cambio: `sync.ts` repite la pasada si se pidió otra durante el envío;
`training.ts` rechaza la misma acción (tipo + endpoint) ya pendiente;
`PendingOperations.tsx` muestra el estado real.

| Tipo | Comprobación | Resultado |
| --- | --- | --- |
| T | `offline-write.test.mjs`: 2 regresiones nuevas (fallaban antes del cambio) | 20/20. |
| T | `npm --prefix apps/web test`, `run build`, `run lint`, Prettier de lo tocado | 73/73; correctos. |

Pendiente: recorrido en navegador con API real.

### Causa del «Por enviar» permanente (07-nov-2026)

- **R** La tarjeta mostraba «No se pudo enviar (503: No pudimos completar la solicitud.)».
- **T** Con el registro nuevo del manejador de errores (`apps/api/src/app.ts`), la API
  reportó `42703: no existe la columna «kind» en la relación «training_sets»` en
  `storeVersion`.
- **T** `pg_attribute` (solo lectura) confirma que las bases locales `CouchOneFit` y
  `CouchOneFit_test` no tienen aplicada `202611050001_training_set_kind.sql`.
- **E** La API convierte toda excepción no prevista en 503 y la web trata el 503 como
  falta de conexión: un fallo del servidor queda en «Por enviar» y se reintenta
  indefinidamente. Ahora el motivo se muestra en la tarjeta y queda en el log.
- Pendiente: aplicar la migración con el rol propietario (no el de ejecución) y
  confirmar que la bandeja se vacía.
