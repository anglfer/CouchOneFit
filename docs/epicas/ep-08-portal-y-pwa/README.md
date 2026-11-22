# EP-08 — Portal, PWA con uso sin conexión y privacidad (`HU-039` a `HU-041`)

Épica de cierre del portal público, capacidad sin conexión transversal en la PWA profesional (`DEC-018`, `RNF21–RNF23`), consulta offline cifrada de historial de peso propio en móvil (`RNF24`) e información versionada de privacidad y condiciones (`HU-041`).

Estado al 21-nov-2026: **implementado y validado localmente (T/E)** sobre el código actual. Quedan pendientes la aceptación humana (**R**), la revisión independiente (incluidos los tramos originales de Omar en `HU-039`/`HU-041` y Franela Whaite en `HU-040`), la matriz de dispositivos reales (Android/iPhone/Safari) y el despliegue/smoke postdeploy (`TT-016`/`TT-017`).

## Historias incluidas

| Historia | Alcance | Estado local |
| --- | --- | --- |
| **HU-039** — Portal público con acceso real al producto | Landing con capturas reales del panel y de la app móvil (datos de demostración; reemplazan la demo simulada desde el 21-nov-2026), catálogo dinámico desde API (`Básico 10` / `299 MXN`, `Pro 30` / `599 MXN`, `Élite ilimitado` / `999 MXN`), CTAs de contratación hacia `/registro?plan=...` y «Contáctanos» hacia `/registro` sin plan preseleccionado. Sin cobros ni activación al registrarse. | Implementado (Web/API) |
| **HU-040** — PWA instalable y uso sin conexión (`DEC-018`) | Service Worker acotado a `/app/*` y `/admin/*` (`navigateFallbackAllowlist`, sin invadir `/` ni cachear `/api/*`); actualización protegida con `canNavigate()` y aviso cuando hay cola pendiente; caché de lectura cifrada por cuenta (`30 días`) ampliada a `EP-05`, `EP-06` y `EP-07`; bandeja de salida (`outbox`), idempotencia (`Idempotency-Key`) y conflictos `409` conectados a Nutrición (`nutrition.save`, `nutrition.activate`), motor local offline de sugerencias nutricionales y visibilidad de Seguimiento (`followup.visibility`); caché cifrada de historial propio de peso/check-ins en móvil (`CheckInCache`, `RNF24`) sin cachear categorías compartidas (`DEC-009`). | Implementado (API/Web/Móvil) |
| **HU-041** — Privacidad y condiciones aprobadas | Ruta accesible `/privacidad` en Web y hoja modal en Móvil (`Cuenta → Acerca de` y `Activar mi cuenta`) con la versión vigente `2026-10-15.1` alineada con `DEC-009`, `DEC-011`, `DEC-014`, `DEC-015` y `DEC-018`, enlazada desde portal, registro, acceso y menú del panel, manteniendo aceptación atómica con `HU-001` y `HU-008` sin atribuir certificación jurídica ni médica. | Implementado (Web/Móvil/API) |

## Contratos offline de los módulos conectados (`pwa-offline.md §2.3`)

### EP-05 — Alimentación (`nutrition`)

- **Lecturas en caché (`30 días`, cifradas por `accountId`):**
  - `GET /api/clients/:clientId/nutrition-plans` (`{ versions, activeVersionId, activeRevision, canWrite }`).
  - `GET /api/clients/:clientId/record` (incluye `sections.nutritionPlan`).
- **Escrituras en cola (`Idempotency-Key` en `private.idempotency_keys`):**
  - `nutrition.save` (`POST /api/clients/:clientId/nutrition-plans`, `POST .../versions`, `PATCH .../versions/:versionId`): tipo **versionado** (`revision`). Ediciones repetidas mientras el pendiente sigue con `attempts === 0` se fusionan localmente conservando `id`/`versionId` (en `POST`) o `revision` base (en `PATCH`).
  - `nutrition.activate` (`POST /api/clients/:clientId/nutrition-plans/:planId/versions/:versionId/activate`): tipo **versionado** (`expectedActiveRevision`). Encadenado vía `dependsOn` cuando sigue a un borrador sin enviar; bloquea duplicados iguales en cola.
- **Estrategia de conflicto (`409 NUTRITION_CONFLICT`):**
  - En *Pendientes de enviar* se compara la captura local contra la copia actual del servidor (`serverCopy`) y el profesional elige **Conservar el del servidor** o **Aplicar el mío sobre la versión actual** (actualiza `revision` o `activeRevision` si el borrador sigue editable; si ya fue publicado solicita crear un borrador nuevo).
- **Cálculo asistido offline (`HU-025`):**
  - `POST /api/clients/:clientId/nutrition-plans/suggestion` no persiste datos. Si falla la red, `requestNutritionSuggestion` ejecuta en local el motor puro equivalente (`utils/suggestionEngine.ts`) sin bloquear el asistente.

### EP-07 — Seguimiento e Inicio profesional (`follow-up`)

- **Lecturas en caché (`30 días`, cifradas por `accountId`):**
  - `GET /api/clients/:clientId/follow-up` (`?days=` o `?from=&to=`).
  - `GET /api/follow-up/summary` (adherencia agregada a 7 días en *Inicio*).
  - `GET /api/training/clients` y `GET /api/clients/:clientId/training-sessions` (resumen diario de check-ins y sesiones).
- **Escrituras en cola (`Idempotency-Key` vía `mutate` en API):**
  - `followup.visibility` (`PATCH /api/clients/:clientId/visibility`): tipo **versionado** (`revision`).
- **Estrategia de conflicto (`409 CHECK_IN_CONFLICT`):**
  - Compara `measurements` y `adherence` frente a la configuración actual del servidor. Si ya coinciden, se resuelve sin reescribir; si difieren, la persona elige conservar servidor o reaplicar sobre la `revision` actual.

### Móvil cliente (`RNF24` / `DEC-009`)

- **Caché de lectura cifrada en almacenamiento seguro nativo (`30 días`, aislada por `clientId` y purgada al cerrar sesión o `401/403`):**
  - Rutina activa (`TrainingCache`), plan nutricional activo (`NutritionCache`) e historial propio de check-ins y peso corporal (`CheckInCache`, `GET /api/me/check-ins`).
- **Exclusiones estrictas:**
  - `GET /api/me/progress` (medidas evaluadas y adherencia compartida por el profesional) **no se cachea nunca**, garantizando revocación inmediata en la siguiente lectura (`DEC-009`).
  - Registrar check-ins, peso o series de entrenamiento **exige conexión** y nunca muestra falso éxito offline (`HU-032`).

## Acciones Web que siguen exigiendo conexión (`pwa-offline.md §2.2`)

- Autenticación, registro, cambio de contraseña y recuperación asistida (`/api/auth/*`, `/api/accounts/recovery-targets`).
- Invitaciones y códigos de un solo uso (`/api/clients/:id/invitations`).
- Pagos simulados y cambios de suscripción (`/api/me/payments*`).
- Baja de cuenta de cliente y acciones de administración (`/api/admin/support/*`, `/api/admin/plans`).
- Guardar y archivar alimentos propios (`/api/nutrition/foods`); su lectura sí queda en caché.

Sin red, estas acciones se ven deshabilitadas con el texto «Requiere conexión» (`components/RequiresConnection.tsx`).

## Evidencia

Ver [validacion-local.md](validacion-local.md).
