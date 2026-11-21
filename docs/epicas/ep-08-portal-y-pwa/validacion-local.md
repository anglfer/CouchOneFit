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

## 4. Rediseño del portal y del acceso (`HU-039`, 21-nov-2026)

Petición de la persona usuaria: el acceso Web se veía poco profesional y la landing era muy básica; pidió capturas reales del sistema (panel y móvil). Decisiones suyas en esta sesión: reemplazar por completo el mundo visual público (no solo recomponer), aplicarlo a acceso, registro y recuperación, sembrar datos de demostración en la BD local de desarrollo y la dirección «Señalética deportiva mexicana».

### Alcance

- **Web:** nueva landing (`features/marketing/*`, `Hero` con pestañas de módulos que cambian la captura real), marco de acceso (`AuthShell`), registro, recuperación, privacidad y 404 en el mismo mundo (`src/signage.css`, tokens `--sg-*`, re-skin de `ws-auth-*` por tokens). Se eliminó la demo simulada `ProductPreview.tsx`. Fuente display Unbounded (OFL) autoalojada en `public/fonts/` (50 KB). `formatPlanPrice` omite centavos en precios enteros.
- **Capturas:** 9 WebP en `public/marketing/` (~800 KB, diferidas salvo el hero), tomadas del panel local con Chrome sin ventana y de la app Flutter en el emulador Android, con la procedencia incrustada en cada archivo. Contienen solo datos sintéticos.
- **Datos de demostración (BD local `CouchOneFit_dev`, sin tocar Supabase):** profesional «Valeria Montes» (plan Pro), 8 clientes ficticios (6 con cuenta activada por invitación real), evaluaciones cada dos semanas, rutina y plan de alimentación activos, 132 check-ins y 84 sesiones en 4 semanas. Identidades por SQL como los scripts `prepare-*-e2e`; el resto por la API con su validación. Usuarios `demo.*` y correos `@example.com`.
- **Sin cambios** en API, BD (esquema), contratos, móvil ni panel interno.

### Evidencia

- **T.** `npx prettier --check` sobre los 24 archivos Web tocados: aprobado (`apps/web/README.md` ya no cumplía Prettier antes de este cambio y no se reformateó).
- **T.** `npm --prefix apps/web run lint` (oxlint): exit 0, sin hallazgos.
- **T.** `npm --prefix apps/web run build` (`tsc -b && vite build`): exit 0; el precache del SW sigue en 28 entradas (las capturas WebP y la fuente no se precachean). Aviso de chunk > 500 kB preexistente.
- **T.** `npm --prefix apps/web test`: 163 pruebas, 163 aprobadas.
- **T.** Capturas de página completa con Chrome sin ventana a 1440 y 390 px de `/`, `/acceso`, `/registro`, `/recuperar` y `/privacidad`: sin desbordamiento horizontal.
- **T.** Navegador integrado: las pestañas del hero responden a clic y a flechas/Inicio/Fin con `aria-selected`, foco itinerante y `aria-labelledby` correctos.
- **T.** Detector de Impeccable: solo «fuente fuera de DESIGN.md» (resuelto al documentar) y un falso positivo de borde sobre tarjeta redondeada (`border-radius: 0` en la misma regla).
- **E.** Contraste: texto blanco sobre rosa 4,5:1 y sobre cobalto 8,7:1; texto negro sobre naranja 7,3:1 y sobre verde 6,4:1.
- **E.** Revisión final independiente de Impeccable (agente sin contexto de la construcción, sobre capturas y código):
  - Primera ronda (`fix`): 8 hallazgos materiales, todos corregidos:
    - título de registro en tres líneas;
    - foco blanco sobre campos de color;
    - recorte móvil de capturas;
    - controles nativos de registro;
    - pictogramas de módulo en toda la landing;
    - «Cómo funciona» como ruta numerada;
    - aviso de datos de demostración;
    - «Contáctanos», resuelto citando la HU-039.
  - Segunda ronda: 2 regresiones (orden de anillos del hero y final de la ruta), corregidas.
  - Veredicto final: `ship`.
- **E.** Documentación del sistema: `apps/web/DESIGN.md` se sobrescribió (describía el mundo índigo descartado) y se generó `apps/web/.impeccable/design.json`. Al documentar aparecieron 4 detalles, ya corregidos:
  - la etiqueta de la pestaña activa pasa a tinta negra sobre naranja y verde;
  - `theme-color` público en blanco (`theme.ts` e `index.html`);
  - una sola pila de fuentes;
  - esqueleto de planes sin animación con movimiento reducido.

  Tras esas correcciones se repitieron Prettier, oxlint, build y pruebas, con el mismo resultado.

### Pendiente

- **R.** Aceptación visual de la persona usuaria en navegador y móvil reales.
- Revisión de pares y PR coordinada (`CONTRIBUTING.md`); nada se ha confirmado ni publicado.
- Si se publica, revisar que las capturas sigan reflejando el producto cuando cambie la UI del panel o del móvil.
