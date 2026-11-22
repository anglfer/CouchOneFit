# Validación local — EP-08 (`HU-039`, `HU-040`, `HU-041`)

Registro de verificación del trabajo local correspondiente a [EP-08 — Portal, PWA con uso sin conexión y privacidad](README.md) (`21-nov-2026`).

Convención del repositorio:

- **T** = prueba o herramienta ejecutada.
- **E** = inspección estática del código o salida generada.
- **R** = aceptación o comprobación humana (no asumida ni sustituida por pruebas automáticas).

## 1. Evidencia por capa (T / E)

### API (`apps/api`)

- **T.** `npm --prefix apps/api run build` (`tsc` estricto): **exit 0**.
- **T.** Suite dirigida en PostgreSQL local (`CouchOneFit_test`): `npx tsx --test tests/idempotency.test.ts tests/nutrition-integration.test.ts tests/nutrition-suggestion.test.ts tests/follow-up.test.ts tests/training.test.ts` aprobó **25 de 25** pruebas, incluyendo el caso `HU-040: escrituras nutricionales del profesional soportan Idempotency-Key sin duplicar ni reescribir` (repetición `POST` con `201` y cabecera `idempotent-replayed: true`, `422 IDEMPOTENCY_KEY_REUSED` al cambiar cuerpo, repetición `PATCH` preservando revisión y repetición de activación `200`).
- **T.** Suite completa `npm test` (`tsx --test --test-concurrency=1 tests/*.test.ts`) contra `CouchOneFit_test`: **210 pruebas reportadas, 208 aprobadas, 2 fallidas, 0 canceladas, `skipped 0`** (con subprueba `HU-022 isolated physical PostgreSQL # SKIP` dentro del registro de salida):
  1. `tests/client-read-isolation.test.ts` abortó al inicio (`Error: Exclusive local test database required`) porque `TEST_DATABASE_URL` en `.env` local usa `localhost` en lugar de `127.0.0.1`. Ejecutada de forma dedicada sustituyendo el host a `127.0.0.1` aprobó **39 de 39** pruebas (`exit 0`).
  2. `tests/session-lifecycle.test.ts:232` (`deactivating a professional revokes all their sessions without deactivating linked client accounts, and protects last admin`) obtuvo `401 !== 200` en la línea `284`, fallo preexistente ya documentado en [EP-05](../../epicas/ep-05-alimentacion/hu-026/validacion-local.md) antes de EP-08.

### Web / PWA (`apps/web`)

- **T.** Prettier (`prettier --check` sobre los 22 archivos modificados/nuevos en `apps/web`): **aprobado** (`All matched files use Prettier code style!`).
- **T.** `npm --prefix apps/web run lint` (`oxlint`): **0 advertencias y 0 errores** en 143 archivos.
- **T.** `npm --prefix apps/web run build` (`tsc -b && vite build`): **exit 0**; generó `dist/sw.js` con 28 entradas precacheadas (`1374.80 KiB`).
- **E.** Inspección de `dist/sw.js`: `NavigationRoute` configurado con `allowlist:[/^\/app(\/|$)/,/^\/admin(\/|$)/]` y `denylist:[/^\/api\//]`, acotando el fallback de navegación al área autenticada/administrativa sin capturar `/` ni `/api/*`.
- **T.** `npm --prefix apps/web test` (`node --test tests/*.test.mjs`): **163 pruebas, 163 aprobadas, 0 fallidas**, cubriendo cacheabilidad de lecturas `EP-05`/`EP-06`/`EP-07` (`offline-read.test.mjs`) y colas/conflictos/sugerencia offline de `nutritionWrite`, activación nutricional, `followup.visibility` y demás casos (`offline-write.test.mjs`).

### Móvil (`apps/mobile`)

- **T.** `dart format` en los 9 archivos tocados: **0 cambios necesarios** (`Formatted 9 files (0 changed)`).
- **T.** `flutter analyze`: **0 errores y 0 advertencias** (solo 53 mensajes informativos preexistentes de `deprecated_member_use` sobre `package:flutter/material.dart` en la versión local de Flutter > 3.47).
- **T.** `flutter test`: **97 aprobadas y 2 fallidas preexistentes** en `test/client_login_test.dart` (`Cliente vinculado y activo inicia sesión sin pedir código...` y `Reiniciar la app restaura sesión válida...`). Todas las pruebas de EP-08 y módulos afectados aprobaron, incluidas `check_in_test.dart` (`RNF24 / DEC-009: Progreso caches own weight offline, never caches shared progress, and isolates accounts`) y `account_access_test.dart` (hoja de privacidad `v2026-10-15.1`). Nota operativa local: se creó `apps/mobile/.env.json` a partir de `.env.example` (ignorado por Git) para habilitar `flutter analyze` y `flutter test`.

## 2. Alcance implementado y trazabilidad

- **HU-039 (Portal público):** enlaces «Contáctanos» en cierre y pie de [MarketingPage](../../../apps/web/src/features/marketing/pages/MarketingPage.tsx) hacia `/registro` sin plan preseleccionado; CTAs de planes dinámicos hacia `/registro?plan=...` sin cobros ni activación al registrarse.
- **HU-040 (PWA offline y caché móvil `RNF24`):**
  - API: soporte de `Idempotency-Key` en rutas de escritura nutricional (`POST /clients/:clientId/nutrition-plans`, `POST .../versions`, `PATCH .../versions/:versionId` y `POST .../activate`, excluyendo `/suggestion`) más `id`/`versionId` deterministas desde cliente (`followup.visibility` y `training` ya utilizaban `mutate`).
  - Web: cacheo de lectura en `EP-05`/`EP-06`/`EP-07`, bandeja de salida/conflictos `409` (`nutrition.save`, `nutrition.activate`, `followup.visibility`), motor local equivalente de sugerencias `HU-025` (`utils/suggestionEngine.ts`), SW acotado a `/app/*` y `/admin/*` con registro condicional fuera de `/` (`ensurePwaRegistered`) y guarda `canNavigate()` al actualizar SW (`applyAppUpdate`).
  - Móvil: `CheckInCache` cifrado en almacenamiento seguro nativo (`30 días`, aislado por `clientId` y limpiado en `ClientSessionGate` al iniciar/cerrar sesión o ante `401`/`403`) sin cachear nunca `GET /api/me/progress` (`DEC-009`).
- **HU-041 (Privacidad y condiciones `v2026-10-15.1`):** página Web accesible `/privacidad` ([PrivacyPage](../../../apps/web/src/features/auth/pages/PrivacyPage.tsx)) enlazada desde portal, registro, acceso y menú del panel; hoja modal móvil ([PrivacyNoticeSheet](../../../apps/mobile/lib/features/auth/widgets/privacy_notice_sheet.dart)) accesible en activación y `Cuenta → Acerca de`.

## 3. Pendientes para cierre y coordinación (`D0` y `CONTRIBUTING.md`)

- **R — Aceptación humana:** validación funcional y visual por parte de la persona usuaria (portal `/`, `/privacidad`, flujo sin conexión en PWA, módulo móvil de privacidad y peso en caché).
- **T / R — Recorridos manuales en runtime real (no ejecutados en esta sesión):**
  - `vite build` + `vite preview` con red apagada verificando recarga directa en `/app/*`, no registro/intercepción del SW en `/` y descarga de actualización con cola pendiente o formulario sucio.
  - Pruebas en dispositivos físicos (Android/Chrome y matriz iPhone/Safari según [pwa-offline.md](../../architecture/pwa-offline.md) y `DEC-012`/`DEC-018`) y pruebas entre dos sesiones/equipos concurrentes para conflictos `409`.
- **Revisión independiente y coordinación de PR (`CONTRIBUTING.md`):**
  - Pendiente revisión de pares (incluyendo responsables originales: Omar para `HU-039`/`HU-041` y Franela Whaite para `HU-040`).
  - Existen cambios locales en archivos compartidos (`AppRoutes.tsx`, `WorkspaceLayout.tsx`, `vite.config.ts`, `pwa.ts`, `navigation.ts`, `ClientRecordView.tsx`, `PendingOperations.tsx`, `client_shell.dart`, `client_session_gate.dart`) que requieren revisión/PR coordinada antes de integrar o desplegar (`TT-016`/`TT-017` post-despliegue también pendiente).

## 4. Rediseño del portal y del acceso (`HU-039`, 21-nov-2026, segunda versión)

Petición de la persona usuaria: el acceso Web se veía poco profesional y la landing era muy básica; pidió capturas reales del sistema (panel y móvil) y libertad total sin consultas intermedias. Un intento previo del mismo día (estética de señalética/brutalista, rama `brutalista`) quedó descartado: la persona usuaria volvió a `main` y repitió la petición. Esta versión conserva la marca índigo del panel para que lo público y lo privado se sientan un mismo producto.

### Alcance

- **Landing (`features/marketing/*`):**
  - Hero con titular llano y escaparate por pestañas (Inicio, Expediente, Entrenamiento, Seguimiento) que cambia la captura real del panel y del teléfono.
  - Pasaje «dos lados»: lo que el cliente registra en la app ↔ lo que ve el profesional.
  - Ficha del expediente: captura del plan de alimentación más una tabla de áreas.
  - «Cómo funciona» en línea continua, planes desde `/api/plans` con barra de capacidad, preguntas frecuentes y cierre.
  - Se eliminaron la demo simulada `ProductPreview.tsx`, `ProductFeatures.tsx`, `ConnectedExperience.tsx` y `SectionHeading.tsx` (sin otros consumidores).
- **Acceso (`AuthShell`, `AccessPage`, `RecoveryPage`):**
  - Formulario a la izquierda y, desde 1024px, panel de marca con la captura real del inicio del panel.
  - Corregido el defecto que apilaba el panel de marca sobre el formulario en escritorio: `.ws-auth-shell` declaraba `display: flex` sin capa y anulaba `lg:grid`.
  - Campos blancos de 48px con borde ≥3:1.
  - Mismo flujo, validaciones y mensajes de sesión.
- **Registro:** misma piel (cabecera, titular, botón y campos) sin cambios de lógica.
- **Compartido:**
  - `components/ProductShot.tsx`: marcos de navegador y teléfono, recortes por breakpoint.
  - `index.css`: clases `mk-*`, `font-display` y colores `brand-night*`.
  - `formatPlanPrice` sin centavos en precios enteros.
  - `theme-color` público en blanco.
  - Meta descripción actualizada.
- **Capturas:**
  - 9 WebP en `public/marketing/` (~700 KB) con su procedencia en `.webp.json`.
  - Se tomaron del panel local y del emulador Android con datos sintéticos de `CouchOneFit_dev`: profesional «Valeria Montes», clienta «Mariana Ríos».
  - Se reutilizaron del intento anterior porque panel y móvil no cambiaron.
- **Documentos:** `apps/web/PRODUCT.md` (nuevo), `apps/web/DESIGN.md` (reescrito: describía un conmutador claro/oscuro y medidas que ya no existían), `apps/web/README.md` y este README de la épica.
- **Sin cambios:** API, BD, contratos, móvil y panel interno. «Contáctanos» y «Elegir plan» conservan sus destinos (`/registro`, `/registro?plan=<id>`).

### Evidencia

- **T.** `npx prettier --check` sobre los archivos Web tocados: aprobado.
- **T.** `npx oxlint`: exit 0.
- **T.** `npm --prefix apps/web run build`: exit 0; precache del SW en 28 entradas (las capturas no se precachean). El aviso de chunk > 500 kB ya existía.
- **T.** `npm --prefix apps/web test`: 163 de 163 aprobadas.
- **T.** `git diff --check`: limpio.
- **T.** Capturas por CDP (Chrome sin ventana) en `apps/web/.impeccable/review/`:
  - `/` a 1440 y 390 px, página completa y primer pantallazo;
  - `/acceso` a 1440 y 390 px;
  - `/recuperar` y `/registro` a 1440 px.
- **T.** Navegador integrado a 1440, 1024 y 375 px:
  - sin desbordamiento horizontal;
  - las pestañas del hero cambian con clic y con flechas, Inicio y Fin, con `aria-selected` y foco itinerante;
  - el foco sobre la losa índigo es blanco.
- **T.** Detector de Impeccable sobre landing, acceso, `ProductShot` e `index.css`: exit 0, sin hallazgos tras documentar la escala tipográfica y los colores en `DESIGN.md`.
- **E.** Revisión final independiente de Impeccable: un agente sin contexto de la construcción revisó capturas y código.
  - **Primera ronda (`fix`), 8 hallazgos materiales, todos corregidos:**
    - capturas fuera del pliegue móvil;
    - teléfono tangente al marco en escritorio;
    - bordes de campos con 1,5:1;
    - botón de recuperación distinto al de acceso;
    - recortes que cortaban texto;
    - aviso de datos de demostración solo en el pie;
    - etiquetas en mayúsculas;
    - `DESIGN.md` desactualizado.
  - **Segunda ronda (verificación de los arreglos):** los 8 quedaron `resolved`. Señaló 2 regresiones y 3 detalles de `/registro`:
    - el teléfono del hero casi tocaba el borde inferior de la losa;
    - la captura del cierre cortaba cifras en el borde derecho;
    - en `/registro`, un rótulo «A tu ritmo» sobre el título, borde y sombra a la vez en las tarjetas, y el marcador nativo ▶ en «Sobre tu registro».
  - Esas 5 correcciones se verificaron en nuevas capturas (**E**, propia). El presupuesto de dos rondas sin supervisión ya se había agotado, así que no pasaron por una tercera revisión independiente.
- **T.** `impeccable embed-prompt --scan public/marketing`: 9 imágenes, 0 sin procedencia.
- **E.** Contraste:
  - texto blanco sobre `#4037F7`: 6,8:1;
  - pestañas inactivas en indigo-50 sobre la losa: más de 5:1;
  - `#5B6388` sobre blanco: 5,9:1;
  - borde de campos `#8A8FB3` sobre blanco: 3,15:1.

### Pendiente

- **R.** Aceptación visual de la persona usuaria en navegador y teléfono reales.
- Revisión de pares y PR coordinada (`CONTRIBUTING.md`). No se ha hecho commit ni publicación.
- Si cambia la UI del panel o del móvil, recapturar con la misma cuenta demo.

## 5. Refinamiento comercial e interactivo del portal (`HU-039`, 21-nov-2026)

### Alcance

- **Nuevos archivos en `apps/web/src/features/marketing/`:**
  - `marketing.css`: `scroll-padding-top`, header sticky con `@container scroll-state(stuck: top)`, barra de progreso con CSS Scroll-Driven Animations (`scroll(root block)`), trazo único de entrada para curvas de pista, `.mk-tablist` desplazable en una sola fila, `<dialog>` modal (`:modal`, `::backdrop`, `overscroll-behavior: contain`), transición progresiva en `details::details-content`, slider `.mk-range` y escena inmersiva única `.mk-hero-stage` para el Hero.
  - `components/TrackBackdrop.tsx`: motivo gráfico de curvas de pista inspirado en `JourneySurface` de la app móvil.
  - `components/ProductLightbox.tsx`: inspector modal sobre `<dialog>` nativo (`showModal()`, `closedby="any"` con respaldo de puntero para Safari) para ampliar capturas reales y alternar entre Panel web y App móvil.
  - `utils/planRecommendation.ts`: lógica pura para sugerir plan según tamaño de cartera y estimar ocupación y costo aproximado por cliente.
  - `tests/marketing-plans.test.mjs`: pruebas unitarias de recomendación/formato y recorrido interactivo completo de `MarketingPage` en `jsdom`.
- **Archivos actualizados:** `MarketingNavigation.tsx` (progreso de lectura y sección activa con `IntersectionObserver`), `Hero.tsx` (un solo bloque inmersivo oscuro/índigo `.mk-hero-stage` con titular centrado «Un solo sistema para tu cartera. Una app real para cada cliente.», botones inversos, 5 módulos reales incluyendo **Alimentación**, puente de sincronización en vivo, enfoque interactivo panel/app y visor modal), `TwoSides.tsx` (3 escenas reales sincronizadas + simulador de visibilidad `DEC-009`), `RecordCoverage.tsx` (selector interactivo de las 4 áreas sobre la captura superior + comparativa de 4 momentos diarios frente a chats/hojas sueltas), `HowItWorks.tsx` (etiquetas de resultado por paso y franja de garantías operativas), `Plans.tsx` (selector interactivo de cartera de 1 a 60+ clientes y resaltado de plan sugerido desde `/api/plans`), `FrequentlyAskedQuestions.tsx` (acordeón fluido no exclusivo y 2 preguntas sobre PWA sin conexión y bajas lógicas), `MarketingPage.tsx` (`Closing` con panel + teléfono superpuesto y curvas de pista) y `apps/web/DESIGN.md`.
- **Sin cambios:** contratos de `HU-039` (`/registro`, `/registro?plan=<id>`, `/acceso`, `/recuperar`, `/privacidad`), las 9 capturas reales en `public/marketing/*.webp`, `package.json`, lockfiles, `AppRoutes.tsx`, `AuthShell.tsx`, `Icon.tsx`, `ProductShot.tsx`, `theme.ts`, API y BD.

### Evidencia (T / E)

- **T.** `npx --prefix apps/web prettier --check` sobre los archivos Web tocados/creados y `apps/web/DESIGN.md`: **aprobado** (`All matched files use Prettier code style!`).
- **T.** `npm --prefix apps/web run lint` (`oxlint`): **0 advertencias y 0 errores** en 147 archivos.
- **T.** `npm --prefix apps/web run build` (`tsc -b && vite build`): **exit 0** (`✓ built in 958ms`; `dist/sw.js` generado con 28 entradas precacheadas, `1405.86 KiB`).
- **T.** `npm --prefix apps/web test` (`node --test tests/*.test.mjs`): **167 de 167 aprobadas, 0 fallidas**, incluyendo 4 pruebas nuevas en `tests/marketing-plans.test.mjs` (recomendador de cartera, cálculo por cliente y recorrido completo en `jsdom`: titular unificado, 5 pestañas del hero + lightbox `<dialog>`, 3 escenas + simulador de visibilidad `DEC-009` en `TwoSides`, selector de áreas y comparativa en `RecordCoverage`, estimador de `Plans`, enlaces `HU-039` y 7 FAQs).
- **T.** `git diff --check`: limpio.
- **Bloqueado / No ejecutado en esta sesión:** inspección visual interactiva en Chrome real (el subagente `browser` falló al conectar por ausencia de `DevToolsActivePort` / no estar habilitado `chrome://inspect/#remote-debugging` en el equipo; `vite` dev server se inició temporalmente en `http://127.0.0.1:5001/` al estar ocupado el puerto `5000` y se detuvo después). A partir de la indicación de la persona usuaria se rediseñó el Hero en un único bloque inmersivo oscuro/índigo con titular comercial directo.

### Pendiente

- **T / R.** Inspección visual en navegador real (escritorio 1440px y móvil 390px) con API local de `/api/plans` activa y aceptación humana (**R**) por parte de la persona usuaria.
- Revisión de pares y PR coordinada (`CONTRIBUTING.md`). No se ha hecho commit ni publicación.

## 6. Coherencia del panel profesional al entrar (21-nov-2026)

Revisión de arquitectura de información del panel (`/app`) a petición de la persona usuaria: qué ve el profesional al entrar y si la selección de módulos es coherente. Se conserva el modelo centrado en el expediente (una ficha por cliente con sus pestañas; Rutinas como biblioteca de plantillas), porque es el contrato de EP-03 y la promesa del producto. El orden de pestañas Resumen → Entrenamiento → Evaluación no se cambia: es decisión aprobada en `HU-021` (`multimethod.md`).

### Alcance

- **Inicio** (`ProfessionalHome.tsx`): la cabecera ya no repite los destinos de la barra lateral («Rutinas», «Ir a clientes»); su única acción es **Nuevo expediente** (`/app/clientes?nuevo`) y solo aparece con suscripción activa. La tarjeta de check-ins abre en **Sin check-in hoy** cuando no hay recientes y sí hay pendientes; si la persona elige una vista, se respeta.
- **Indicadores de Inicio** (`workspace.css`, `.ws-stats-home`): máximo tres por fila; los seis indicadores forman dos filas completas en lugar de 4 + 2 con hueco. En 1024 px siguen siendo tres; en móvil, uno.
- **Ficha del cliente** (`ClientHeader.tsx`, `AssessmentForm.tsx`): la pestaña y el botón «Nutrición» pasan a **Alimentación**, el nombre que ya usan EP-05, la tarjeta del resumen, las insignias, Inicio y la app móvil. La ruta `/nutricion` no cambia.
- **Más acciones de la ficha** (`ClientRecordView.tsx`): «Gestionar acceso en Clientes» pasa a **Gestionar acceso a la app** y abre la lista ya filtrada por ese cliente (`/app/clientes?buscar=<nombre>`), donde están el código de invitación y la revocación. Antes llevaba a la lista completa.
- **Lista de clientes** (`ClientAccessPanel.tsx`): acepta `?buscar=` (búsqueda inicial, máximo 150 caracteres como el campo) y `?nuevo` (formulario de alta abierto).
- **Seguimiento** (`ClientFollowUp.tsx`): se quitó el botón «Ir a Entrenamiento» de la barra de periodo; repetía la pestaña que está justo encima y se leía como un filtro.
- **Sin cambios:** API, BD, contratos, rutas, móvil, dependencias y lockfiles.

### Evidencia (T / E)

- **T.** `npm --prefix apps/web run build`: exit 0. `oxlint`: exit 0. Prettier de los archivos tocados: aprobado. `git diff --check`: limpio.
- **T.** `npm --prefix apps/web test`: **169 de 169 aprobadas**, con 2 pruebas nuevas: Inicio abre «Sin check-in hoy» sin recientes y solo ofrece «Nuevo expediente» con plan activo (`follow-up-page.test.mjs`); Clientes entra filtrado con `?buscar` y con el alta abierta con `?nuevo` (`session-recovery.test.mjs`). Las aserciones de pestañas se actualizaron a «Alimentación».
- **T.** Navegador integrado contra la API y la base local (`127.0.0.1:5000`, cuenta QA ya abierta, solo lectura): Inicio a 1440, 1024 y 375 px sin desbordamiento; «Nuevo expediente» abre el alta; «Gestionar acceso a la app» abre la lista filtrada; pestaña «Alimentación» y barra de Seguimiento sin el botón repetido.
- **T.** `impeccable detect` sobre los componentes tocados: sin hallazgos.

### Pendiente

- Las capturas `public/marketing/panel-inicio.webp` y `panel-expediente.webp` muestran la cabecera anterior de Inicio y la pestaña «Nutrición»: recapturar con la cuenta demo (`apps/web/DESIGN.md`).
- **R.** Aceptación de la persona usuaria y revisión de pares (`CONTRIBUTING.md`). Sin commit ni publicación.
