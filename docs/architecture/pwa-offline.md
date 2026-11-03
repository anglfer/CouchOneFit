# PWA con uso sin conexión

**Estado:** decidido en [DEC-018](../../plan/PLAN_TRABAJO_V2.md) y aceptado por la persona responsable del producto el 3 de noviembre de 2026 (respuestas en §8). **Fases 1 (lectura) y 2 (escritura y sincronización) implementadas localmente el 3-nov; fase 3 pendiente** (ver §11).
**Origen:** instrucción de la persona responsable del producto en chat: la PWA debe poder usarse sin internet en **casi toda** la aplicación, no solo en lo que ya existe. Alcance elegido: **leer y escribir sin conexión, con sincronización**.
**Sustituye** la regla transversal 9 de V2 (_no cachear respuestas privadas; instalable no significa offline_) y las frases «sin escrituras offline». Esos textos ya se corrigieron en el plan.

## 1. Intención

El profesional trabaja con clientes en gimnasios, parques o consultorios donde la conexión falla. La PWA debe abrir, mostrarle lo que ya consultó y permitirle capturar cambios sin internet, sin perder nada y sin duplicar ni pisar datos al volver la conexión.

## 2. Principio: una capacidad de la plataforma

El uso sin conexión **no se programa pantalla por pantalla**. La plataforma ofrece dos piezas reutilizables y cada módulo (el actual y los futuros) las usa:

1. **Caché de lectura:** guarda, por cuenta, las respuestas que el profesional ya vio.
2. **Bandeja de salida (outbox):** guarda las escrituras hechas sin conexión y las envía al volver.

Todo módulo del panel profesional debe funcionar con ambas, salvo las excepciones de §2.2. Esto vale para lo ya implementado y para cada módulo que se agregue después.

### 2.1 Qué cubre hoy y qué cubrirá cada módulo

| Módulo | Lectura sin conexión | Escritura en cola | Estado |
| --- | --- | --- | --- |
| Carcasa y rutas `/app/*` | Sí | — | Fase 1 |
| Inicio, perfil, cupo y vigencia | Sí | — | Fase 1 |
| Cartera y expedientes (EP-03) | Sí | Crear expediente; editar datos base; activar/inactivar | Fases 1–2 |
| Evaluaciones físicas (EP-04) | Sí | Registrar evaluación (solo-añadir) | Al construir el módulo |
| Planes de alimentación (EP-05) | Sí | Crear/editar plan y versión activa (con `version`) | Al construir el módulo |
| Rutinas y entrenamiento (EP-06) | Sí | Crear/editar rutina y versión activa (con `version`) | Al construir el módulo |
| Seguimiento y check-ins (EP-07) | Sí | Marcar revisado y notas (solo-añadir o con `version`) | Al construir el módulo |
| Administración: directorio y planes | Sí (solo lectura) | No (ver §2.2) | Fase 1 |

### 2.2 Excepciones que siempre exigen conexión

Por seguridad, dinero o auditoría: iniciar sesión, registro, cambio de contraseña y recuperación asistida; **invitaciones y códigos** (secretos de un solo uso); **pagos y cambios de suscripción**; alta/baja de la **cuenta** de un cliente; en administración, las **acciones de soporte** (quedan auditadas) y los **cambios al catálogo de planes** (afectan a todas las suscripciones). Estas acciones se ven deshabilitadas con el texto «Requiere conexión», nunca ocultas. Toda excepción nueva debe justificarse con una de esas tres razones.

### 2.3 Contrato offline de cada módulo

Cada HU del panel profesional declara en su README, antes de cerrarse (D0, punto 11 del plan):

- **Lecturas** que se guardan y por cuánto tiempo.
- **Escrituras** que entran en cola, con su tipo: _solo-añadir_ (no hay conflicto posible, p. ej. una evaluación nueva) o _versionada_ (se edita algo que tiene `version`).
- **Estrategia de conflicto** de cada escritura versionada.
- **Acciones que exigen conexión** y por qué.
- Pruebas: lectura sin conexión, escritura en cola, repetición sin duplicar y conflicto.

### 2.4 Metas, no metas, anti-metas

- **Metas:** abrir sin conexión; consultar lo ya visto; capturar sin perder datos; sincronizar solo y con seguridad; que la persona vea siempre qué está pendiente.
- **No metas:** funcionar la primera vez sin haber abierto la app con conexión; sincronización en tiempo real entre dispositivos; escrituras sin conexión en la app móvil del cliente (ver §10).
- **Anti-metas (fallaría aunque «funcione»):** mostrar como guardado algo que no llegó al servidor; duplicar un registro al reintentar; pisar en silencio un cambio más nuevo del servidor; dejar datos de una persona visibles tras cerrar sesión o cambiar de cuenta.

## 3. Lo que ya existe y se reutiliza

- Service worker de Workbox con precache de la carcasa (`vite.config.ts`), `registerType: 'prompt'` y aviso de nueva versión (`services/pwa.ts`).
- `sessionRequest` / `sessionMutation` (`features/auth/services/session.ts`): único punto por el que pasa toda llamada autenticada. Ahí se coloca la capa offline, de modo que **un módulo nuevo la hereda sin código propio** salvo declarar su contrato (§2.3).
- La API ya protege contra cambios concurrentes con `version` en la edición de datos base y en el cambio de estado de un expediente (`PATCH /api/clients/:id` y `/status`).
- Hay patrón de idempotencia en pagos (`simulated_payments.idempotency_key`).
- Sesión: acceso de 15 minutos y cookie de refresco HttpOnly; el cliente web no guarda tokens.

## 4. Diseño técnico

### 4.1 Carcasa

Se mantiene el precache. Se añade `navigateFallback` a `index.html` para `/app/*` y `/admin/*`, de modo que un enlace directo o una recarga sin conexión abra la SPA. `/api/*` sigue excluido de cualquier caché del service worker: los datos privados **no** pasan por Workbox, los controla la app (§4.2).

### 4.2 Lectura: caché de datos propia

- **IndexedDB** con envoltorio propio pequeño (sin dependencias nuevas) y tres tiendas: `readCache`, `outbox`, `meta`.
- Estrategia _red primero, caché si falla_ dentro de `sessionRequest` para todo `GET` que un módulo registre como cacheable. Cada entrada guarda `accountId`, endpoint normalizado, respuesta y `fetchedAt`.
- Si se responde desde la caché, la pantalla muestra «Datos de hace X · sin conexión». Nunca se presenta como actual.
- Listas: se pueden buscar y filtrar localmente sobre lo guardado.

### 4.3 Escritura: bandeja de salida

Un elemento es `{ id (uuid, también su Idempotency-Key), accountId, módulo, tipo (solo-añadir | versionada), endpoint, método, cuerpo, versionBase, creadoEn, estado }` con estado `pendiente | enviando | fallido | conflicto | hecho`.

- Orden FIFO por entidad. Las ediciones de algo aún no sincronizado se **fusionan** en su elemento de creación.
- Disparadores: evento `online`, volver a enfocar o abrir la app, botón «Sincronizar ahora» y Background Sync donde exista. Safari no lo soporta: ahí se sincroniza al abrir o volver la conexión.
- Reintentos con espera creciente solo ante errores de red o 5xx. Un 4xx **no** se reintenta solo: queda `fallido` con el mensaje del servidor.
- Tras sincronizar se refrescan la caché afectada y el cupo.

### 4.4 Cambios en la API

1. **Idempotencia general:** un middleware común acepta `Idempotency-Key` (uuid) en **toda escritura del profesional** que no sea excepción (§2.2). Tabla `private.idempotency_keys (professional_id, key, método, ruta, status_code, response, created_at)` con unicidad `(professional_id, key)`; una repetición devuelve la respuesta original sin volver a escribir; una clave reutilizada con otro cuerpo responde error. Retención mínima: la caducidad local de la cola (§6). Los módulos futuros la heredan por usar el middleware.
2. **Conflictos:** se conserva el 409 por `version`. Si el servidor ya tiene lo que el elemento pretendía, el cliente lo marca `hecho` sin pedir nada.
3. **Cupo:** si al sincronizar una creación supera el plan (`CUPO_AGOTADO`), el elemento queda `fallido` y se explica.

Migración: archivo nuevo `docs/database/migrations/YYYYMMDDHHMM_idempotency_keys.sql` (nunca se edita una aplicada), con `schemas/identity_access.sql` y la prueba de migraciones actualizados.

### 4.5 Sesión sin conexión

- Sin conexión no se puede validar la sesión. Si hay una identidad verificada guardada localmente, la app entra en **modo sin conexión** con esa identidad. No se guardan tokens: siguen en cookies HttpOnly.
- Al volver la conexión se revalida. Si el refresco falla (sesión vencida): la cola se conserva cifrada, se pide iniciar sesión y se sincroniza **solo si es la misma cuenta**.
- **Nunca se descarta una cola en silencio.** Cada cuenta conserva su propia cola cifrada y separada de las demás. Si inicia sesión otra cuenta, la cola anterior se queda guardada hasta que esa cuenta vuelva y se sincronice, o hasta que caduque (§6). Cerrar sesión **con pendientes** primero intenta sincronizar si hay conexión; si no la hay, avisa «tienes N cambios sin enviar; si cierras sesión se perderán» y pide confirmar. Solo así se borran.

### 4.6 Interfaz

- Indicador de conexión y de pendientes en la barra superior y en el menú de cuenta.
- Aviso actual de «Sin conexión» reescrito: _«Estás sin conexión. Puedes seguir consultando y registrando; se enviará al volver la conexión.»_
- Pantalla **Pendientes de enviar** (`/app/pendientes`): elementos con su estado, reintentar, descartar y resolver conflictos.
- Etiqueta «Pendiente de enviar» en lo creado o editado sin conexión.
- Conflicto de versión: se muestra lo del servidor frente a lo capturado; la persona elige **conservar el del servidor** o **reaplicar el suyo sobre la versión nueva**. Por defecto no se sobrescribe nada.

### 4.7 Dos dispositivos con la misma cuenta

Caso: la persona hace cambios en una computadora **sin conexión** y después hace lo mismo en otra computadora **con conexión**, o abre la misma cuenta en ambas.

- **Editar algo que ya existe:** la otra computadora ya subió su cambio y subió la `version` del registro. Cuando la primera computadora se conecta, su cambio llega con la versión vieja y el servidor responde conflicto. No se pisa nada: queda en **Pendientes** como «conflicto» y la persona elige conservar lo del servidor o reaplicar lo suyo sobre la versión nueva (§4.6).
- **Crear lo mismo en ambas** (p. ej. el mismo cliente): cada creación lleva su propia clave de idempotencia, así que el servidor las ve como dos operaciones distintas y no las une solas. Para no duplicar sin darse cuenta: al sincronizar una creación, si el servidor ya tiene un expediente del mismo profesional con el **mismo nombre y fecha de nacimiento**, el elemento queda en **«posible duplicado»** y la persona decide: _es el mismo (descartar el pendiente)_ o _es otra persona (crear)_.
- **Mismo cambio enviado dos veces desde el mismo equipo** (se cortó la señal a mitad de envío): la misma clave de idempotencia evita duplicar.
- **Cupo del plan:** si entre las dos computadoras se supera el cupo, la creación pendiente queda «fallida» con la explicación.
- **Orden:** cada dispositivo sincroniza en el orden en que capturó. No se intenta adivinar la hora exacta entre dispositivos.

## 5. Plan por fases (cada una en su propio cambio)

| Fase | Contenido | Toca API |
| ---- | --------- | -------- |
| 1. Lectura | `navigateFallback`, almacén IndexedDB, caché de lectura en `sessionRequest`, avisos, borrado al cerrar sesión/cambiar de cuenta, almacenamiento persistente; aplicar a todo lo implementado (incluido admin de solo lectura) | No |
| 2. Escritura | Middleware de idempotencia + migración, outbox, sincronización, pantalla de pendientes, conflictos; aplicar a crear/editar/estado de expedientes | Sí |
| 3. Endurecimiento | Cifrado en reposo, caducidad, pruebas, matriz de dispositivos, documentación | No |
| Continua | Cada módulo nuevo (EP-04–07) cumple su contrato offline (§2.3) dentro de su propia HU | Según módulo |

## 6. Seguridad y privacidad

- Se guardan datos personales y de salud. Por eso:
  - **Cifrado en reposo** con WebCrypto (AES‑GCM) y clave no extraíble por cuenta. Limitación honesta: protege frente a leer la base cruda del disco, **no** frente a XSS ni a alguien con la sesión del navegador abierta.
  - **Caducidad** de datos locales (propuesta: 30 días desde la última conexión) y borrado inmediato al cerrar sesión, cambiar de cuenta o recibir un cierre forzado. Se limpian IndexedDB y Cache Storage; `clearSessionState` se amplía para ello.
- Nunca se guardan localmente: códigos de invitación, códigos de recuperación, contraseñas, tokens.
- CSRF: al sincronizar se obtiene un token fresco; no se reutiliza uno guardado.
- Aislamiento: toda entrada lleva `accountId`; una cuenta nunca lee la caché de otra.

## 7. Pruebas

Automáticas (sin dependencias nuevas: el almacén se abstrae y las pruebas usan una implementación en memoria): lectura con fallo de red, creación/edición en cola, repetición idempotente sin duplicar, conflicto de versión, cupo agotado, 401 y reanudación, cierre de sesión y cambio de cuenta borran todo, enlace directo sin conexión, aviso de nueva versión con cola pendiente. En la API: el middleware de idempotencia (repetición, clave reutilizada, aislamiento entre profesionales).
Manuales: Chrome en modo sin conexión, teléfono real en modo avión (Android/Chrome y iPhone/Safari), app instalada y en pestaña, desinstalación y reinstalación.

## 8. Decisiones tomadas (3 de noviembre de 2026)

| # | Tema | Resolución |
| - | ---- | ---------- |
| 1 | Alta/baja de cuenta, invitaciones, pagos y soporte de administración | Solo con conexión. **Aceptado.** |
| 2 | Administración | Solo lectura sin conexión. **Aceptado.** |
| 3 | Datos locales y cambios pendientes | Cifrados y con caducidad de 30 días. La persona planteó el caso de **dos computadoras con la misma cuenta**: se resuelve en §4.7 (conflicto por versión y aviso de posible duplicado). Para cuentas distintas o cierre de sesión con pendientes: nunca se descarta en silencio (§4.5). |
| 4 | Migración `idempotency_keys` | **Aceptada.** |
| 5 | iPhone/Safari: sin sincronización en segundo plano y posible borrado de datos de sitios poco usados | **Aceptada** como limitación. |
| 6 | App móvil del cliente | Parcialmente: **consulta** sin conexión de algunas cosas, no todo (§10). |

Pendiente de decidir más adelante: si la app móvil podrá **registrar** (peso, series, check-in) sin conexión. Hoy el plan exige que sin conexión no se muestre falso éxito y no se asuma escritura offline.

## 10. App móvil del cliente (Flutter): consulta sin conexión

Decisión: **solo lectura** de lo esencial, no todo. La persona pidió poder ver sin conexión:

| Contenido | Sin conexión | Estado del módulo |
| --------- | ------------ | ----------------- |
| Plan de entrenamiento (rutina activa) | Ver | Por construir (EP-06) |
| Plan de alimentación | Ver | Por construir (EP-05) |
| Registro de pesos (historial) | Ver | Por construir (EP-07, captura única en check-in) |
| Perfil y datos base ya visibles | Ver | Implementado |

Reglas:

- La app guarda localmente, **por cuenta**, la última respuesta de esos contenidos, cifrada con el almacenamiento seguro nativo, y la muestra con «Datos de hace X · sin conexión».
- Se borra al cerrar sesión o cambiar de cuenta, y caduca como la PWA (§6).
- **No** hay escrituras sin conexión en móvil por ahora: registrar peso, series o check-in sigue exigiendo conexión y nunca muestra falso éxito (regla vigente de HU-032).
- No se guardan localmente tokens ni contraseñas; el almacenamiento seguro nativo ya existente (`session_storage.dart`) no se toca.
- Cada HU móvil de esos módulos declara su contrato de lectura sin conexión (§2.3).

## 11. Estado de implementación

### Fase 1 — lectura sin conexión (implementada localmente, 3-nov-2026)

| Pieza | Dónde |
| ----- | ----- |
| Almacén IndexedDB (o memoria en pruebas); sin IndexedDB queda desactivado, nunca guarda en claro | `apps/web/src/services/offline/store.ts` |
| Cifrado AES-GCM por cuenta con clave no extraíble; nombres de entrada con huella SHA-256 | `services/offline/crypto.ts` |
| Caché de lectura: lista permitida, caducidad de 30 días, aislamiento por cuenta, borrado al cambiar de cuenta, búsqueda y filtro de la cartera con lo guardado | `services/offline/readCache.ts` |
| Precarga en segundo plano de los primeros 25 expedientes de la cartera | `services/offline/prefetch.ts` |
| Integración: `sessionRequest` sirve lo guardado solo ante fallo de red o 502/503/504 (nunca ante 401, 403 ni 500); `clearSessionState` borra todo | `features/auth/services/session.ts` |
| Aviso «Sin conexión… datos guardados hace X» | `layouts/WorkspaceLayout.tsx`, `hooks/useOfflineData.ts` |
| Carcasa y enlaces directos sin conexión | Ya existía: precache de Workbox y `NavigationRoute` a `index.html` (verificado en `dist/sw.js`) |

Lecturas guardadas: sesión (identidad), perfil, suscripción, cartera, ficha y expediente de cada cliente, y —en administración— sesión, planes y directorio. **No** se guardan soporte de administración, recuperación asistida, pagos ni invitaciones (§2.2).

Evidencia (convención del repositorio: **T** prueba/herramienta, **R** reporte humano, **E** inspección estática):

- **T** `apps/web/tests/offline-read.test.mjs` (9 pruebas): cifrado, lista permitida, aislamiento y cambio de cuenta, caducidad, búsqueda local, cierre de sesión, servir solo ante fallo de red, marca de dato guardado. Suite web completa 47/47, `build` y `lint` limpios.
- **T** Recorrido en navegador (Chrome integrado, API local de pruebas): con la API respondiendo, la caché se llena (6 entradas cifradas) y los expedientes se precargan; al hacer fallar toda llamada de red, Inicio, Cartera y Expediente se muestran desde lo guardado con el aviso y, al volver la conexión, el aviso desaparece.
- **No verificado:** recarga completa sin conexión con el service worker activo (el modo desarrollo no lo registra; falta probar con `build` + `preview` y red real apagada), teléfonos reales, Safari/iPhone y la expiración real de 30 días en un dispositivo.

Atajos conocidos de la fase 1: la búsqueda sin conexión usa la primera página guardada de la cartera (si había más páginas no las ve).

### Fase 2 — escritura y sincronización (implementada localmente, 3-nov-2026)

| Pieza | Dónde |
| ----- | ----- |
| Migración `private.idempotency_keys` (RLS por cuenta, retención 35 días) y esquema integrado | `docs/database/migrations/202611030001_idempotency_keys.sql`, `schemas/identity_access.sql` |
| Middleware `Idempotency-Key`: reclamo, respuesta guardada antes de contestar, 422 si se reutiliza con otro cuerpo, 409 si sigue en curso, reclamo abandonado a los 2 min, solo se conservan 2xx | `apps/api/src/features/idempotency/` |
| Aplicado a crear, editar y cambiar de estado un expediente (no a invitaciones, cuentas ni pagos) | `apps/api/src/features/saas/routes/clients.ts` |
| Bandeja de salida cifrada por cuenta, con caducidad de 30 días; el `id` del cambio es su clave de idempotencia | `apps/web/src/services/offline/outbox.ts` |
| Escritura «primero en línea»: se envía de inmediato y, si no hay conexión, queda en cola con **la misma clave** | `services/offline/writes.ts` |
| Motor de sincronización: orden FIFO, una pestaña a la vez, para al caer la red, conflicto, posible duplicado, fallido, reintento, descarte | `services/offline/sync.ts` |
| Cierre de sesión con pendientes: intenta enviar; si no puede, avisa y solo descarta si se confirma | `services/offline/leave.ts` |
| Pantalla **Pendientes de enviar** (`/app/pendientes`), contador en la barra superior, etiqueta «Pendiente de enviar» en la cartera, aviso en el expediente | `features/professional/components/PendingOperations.tsx`, `ClientAccessPanel.tsx`, `ClientRecordView.tsx`, `layouts/WorkspaceLayout.tsx` |
| Contrato OpenAPI | `docs/api/identity-lifecycle.openapi.json` (parámetro `IdempotencyKey`) |

Reglas aplicadas: cerrar sesión **conserva** la cola cifrada (borra solo las lecturas); otra cuenta no ve ni envía la cola ajena; un 401, un 5xx o un «en curso» conservan el cambio y se reintenta; un rechazo del servidor deja el cambio «fallido» con su mensaje; un conflicto de versión muestra lo capturado frente a lo del servidor.

Evidencia:

- **T** API: `apps/api/tests/idempotency.test.ts` (9 pruebas contra la base local de pruebas): repetición sin duplicar, sin encabezado igual que antes, misma clave con otro cuerpo, clave inválida, fallo que no consume la clave, aislamiento entre profesionales, edición y estado, reclamo abandonado frente a en curso, purga de 35 días. `migrations.test.ts` actualizado (22 migraciones, 16 tablas, esquema = migraciones). Suite API 109/109 (la prueba `client-read-isolation` exige `TEST_DATABASE_URL` con `127.0.0.1` y se ejecutó así).
- **T** Web: `apps/web/tests/offline-write.test.mjs` (15 pruebas): clave idéntica en el primer intento y en la cola, cifrado, orden, corte de red a la mitad, conflicto (aplicar lo mío / conservar el servidor), posible duplicado sin acentos ni mayúsculas, cupo agotado y reintento, 401/5xx, aislamiento por cuenta, confirmación al cerrar sesión, caducidad. Suite web 62/62, `build` y `lint` limpios.
- **T** Recorrido en navegador con la API local: sin red se creó un expediente, quedó «Por enviar» con contador y etiqueta; al volver la red se envió solo y el servidor tiene exactamente un expediente (sin duplicado). Se repitió con un segundo.
- **No verificado:** pruebas con dos computadoras reales; teléfonos reales y Safari/iPhone; Background Sync del navegador (no se usa; se sincroniza al volver la conexión, al enfocar y cada 30 s); la API en un despliegue distinto del local.

Atajos conocidos de la fase 2: no se puede **editar** un expediente creado sin conexión que aún no se envió (se descarta y se vuelve a crear); un expediente con cambios pendientes no admite otra edición hasta enviarse o descartarse (evita conflictos con uno mismo); el aviso de posible duplicado compara solo el nombre (la lista del servidor no incluye fecha de nacimiento); el detalle del cambio pendiente muestra los campos, no una vista previa completa del expediente.

## 9. Referencias

[DEC-018 en el plan](../../plan/PLAN_TRABAJO_V2.md) · [RNF21–RNF24](../requirements/no-funcionales.md) · [apps/web/README.md](../../apps/web/README.md) · [Arquitectura](README.md)
