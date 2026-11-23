# EP-05 — Alimentación y prescripción nutricional (`HU-024` a `HU-027`)

Épica de prescripción nutricional asistida, versionado inmutable y lectura móvil para cliente. Mantiene la regla central del producto: **el profesional siempre revisa, ajusta y activa; ninguna fórmula o plantilla escribe ni activa planes automáticamente**.

## Historias implementadas y decisión vigente (`19-nov-2026`)

| Historia | Alcance | Estado local |
| --- | --- | --- |
| **HU-024** — Prescripción rica por tiempos de comida | Constructor Web enriquecido con catálogo curado (`foodCatalog.ts`), 7 plantillas de comida con multiplicador de porción, búsqueda insensible a acentos/sinónimos, 8 grupos, equivalencias/sustituciones por alimento, horarios y categorías por comida, reordenamiento/duplicación, barra proporcional de macros (P/C/G vs meta) y secciones colapsables opcionales (día de descanso y peri-entreno). | Implementado (Web/API/BD compatible) |
| **HU-025** — Motor de sugerencia inicial (`RDF0605` / `RDF0606`) | **Reactivada el 19-nov-2026** tomando las fórmulas de cálculo de `fitnextfy` (`domain/suggestion-engine.ts`) como apoyo clínico en el asistente modal: `Mifflin-St Jeor` y `Katch-McArdle` (requiere `% grasa`), factor actividad × NEAT (`1.2–1.9`; bandas sedentario 1.2–1.3, leve 1.375–1.45, moderado 1.55–1.65, muy activo 1.725–1.9 desde el 20-nov-2026, motor `hu025-fitnextfy-v2`), ajuste calórico y proteína por composición corporal o fallback sin `% grasa`, pisos de déficit (`1500 kcal` hombre / `1200 kcal` mujer, máx. `25%`/`30%`, `>= 50 g` carbohidratos), reparto exacto `P*4 + C*4 + G*9` con grasas `20–35%`, ciclado de carbohidratos opcional, fibra, hidratación, umbral de leucina (`0.045 g/kg`), pre-cama, peri-entreno y plantilla sugerida de comidas. Pre-carga peso/talla/edad/`% grasa`/objetivo desde el expediente (`ProfessionalRecord`) sin tocar BD ni activar versiones hasta que el profesional guarda. | Implementado (API/Web; pendiente QA humana y revisión independiente) |
| **HU-026** — Versionado, expediente y alertas de actualización | Versiones numeradas (`private.nutrition_plans`, `private.nutrition_versions`, `private.nutrition_active`, `private.nutrition_activations`), borradores mutables vía `PATCH` con `revision` optimista y versiones publicadas inmutables (`409` al intentar editar una publicada). Integración real de `sections.nutritionPlan` en `GET /api/clients/:clientId/record` y en el Resumen Web (`ClientRecordSections`). En `ClientNutrition.tsx` se detecta cambio de peso `>= 2.3 kg` respecto a `suggestionMeta.baselineWeightKg` o evaluación física más reciente que la versión activa para sugerir crear una nueva versión (conservando V1 histórica). | Implementado (API/Web) |
| **HU-027** — Lectura móvil del plan activo | Rediseño completo de `NutritionPlanView` (`JourneySurface`, barra proporcional de macros, selector **Entreno / Descanso** cuando existe `restDayTargets`, `StatPanel` con hidratación/fibra/comidas/alimentos, tarjetas `GroupCard` por tiempo de comida con horarios y equivalencias, hoja de detalle por comida y refresco manual). Tarjeta resumen **Alimentación de hoy** en `HomeTab` con acceso directo a `Planes → Alimentación`, y retiro de la tarjeta obsoleta de alimentación en `ComingSoonRow`. | Implementado (Flutter móvil; pruebas de widget OK, falta QA en dispositivo/emulador para la nueva UI) |

## Mejora de experiencia y motor de comidas (`19-nov-2026`, segunda iteración)

- **Evaluación obligatoria antes de prescribir.** `POST /suggestion`, crear borrador y editar borrador responden `409 NUTRITION_EVALUATION_REQUIRED` si el cliente no tiene ninguna fila en `private.client_evaluations`. La Web muestra «Primero registra una evaluación física» con acceso directo a Evaluación y oculta las acciones de crear. La lectura y la activación de versiones existentes no cambian.
- **Datos inferidos sin inventar.** El asistente toma peso, estatura y `% grasa` de la evaluación más reciente (medida directa o resultado del servidor) y, si faltan, del perfil base, mostrando el origen de cada dato. El sexo de referencia se toma de la ecuación de la evaluación (`male`/`female`); si no existe, se pide. Se eliminaron los valores por defecto (`72 kg`, `170 cm`, `28 años`, `masculino`). La estimación candidata JP3 (HU-023, bloqueada) no se usa.
- **Asistente con vista previa en vivo.** Recalcula automáticamente al cambiar cualquier dato; objetivo y ritmo como selectores rápidos; NEAT, experiencia, fórmula, duración y ajustes manuales en «Ajustes finos».
- **Motor de comidas (`apps/web/src/features/nutrition/utils/mealFiller.ts`).** Para cada tiempo de comida elige un plato base por categoría del catálogo curado y ajusta las porciones (Gauss-Seidel sobre P/C/G, redondeo a 5 g o piezas enteras) hasta cubrir la guía de la comida. Respeta restricciones (`Vegano`, `Vegetariano`, `Sin lácteos`, `Sin pescado`, `Sin gluten`) sustituyendo por el alimento del mismo grupo con mayor aporte del macro. Se usa al aplicar el asistente («Usar plan con N comidas y alimentos»), en «Sugerir alimentos» / «Volver a sugerir» por comida y en «Llenar comidas vacías». Sin guía propia, la comida usa la meta diaria dividida entre el número de comidas. Siempre queda como borrador editable.
- `suggestionMeta.restrictions` (opcional, ≤ 10 textos) persiste las restricciones para que las sugerencias por comida las respeten después.
- **Editor más claro.** Progreso por macro (`Proteína 30 / 29 g`) con color según cumplimiento, fila compacta por alimento (nota y sustituto plegados), etiquetas de columna solo en el primer alimento y `aria-label` en cada campo. Se corrigieron los botones de icono vacíos (faltaba `ws-plain`), las tarjetas de inicio comprimidas y el desbordamiento horizontal a 375 px.
- **Móvil.** Se retiraron las fichas redundantes «Comidas/Alimentos» del resumen y se aligeró el texto de equivalentes.

## Biblioteca de alimentos propios (`21-nov-2026`)

Ampliación pedida por la persona usuaria, **sin HU asignada todavía en `PLAN_TRABAJO_V2.md`**. Es el equivalente de Plantillas de rutina para alimentación: un destino diario **Alimentos** (`/app/alimentos`) en la barra lateral del profesional.

- **Qué guarda:** alimentos (`kind: food`, valores por 100 g/ml o por pieza, porción habitual, preparación, equivalencias) y recetas (`kind: recipe`, ingredientes tomados del catálogo, de la propia biblioteca o capturados a mano, y número de porciones). La API calcula los macros **por porción** de la receta; la Web muestra el mismo cálculo en vivo.
- **Dónde se usa:** los alimentos propios se suman al catálogo base en el selector del editor de planes (filtro «Mis alimentos», etiqueta «Mi alimento» / «Mi receta»), en el recálculo de macros al cambiar cantidades y en el motor de comidas (`mealFiller.ts`). Un alimento marcado para un tiempo de comida ocupa en «Sugerir alimentos» el lugar del alimento base de su mismo grupo y macro principal; una receta ocupa el lugar de su macro principal. Con restricciones activas solo se usan los alimentos propios marcados como aptos (vegano implica vegetariano, sin lácteos y sin pescado).
- **Catálogo base:** la página muestra también el catálogo curado (`foodCatalog.ts`) en solo lectura, con «Copiar a mis alimentos» para ajustarlo a una marca o preparación.
- **Reglas:** el plan guarda una copia del alimento, así que editar o archivar no cambia planes guardados ni publicados. Archivar es baja lógica (`archived_at`) y libera el nombre. Nombre único por profesional entre alimentos activos (sin distinguir mayúsculas). Sin fotos: requieren almacenamiento de archivos y una revisión de privacidad que este cambio no incluye.
- **BD:** migración `202611210001_professional_foods.sql` (tabla `private.professional_foods`, RLS `professional_foods_owner` con `private.nutrition_professional(owner_id)`, `UPDATE` por columnas sin `id`/`owner_id`/`created_at`). `identity_access.sql` actualizado igual.
- **Contrato (profesional, cookie HttpOnly + `Origin` + `X-CSRF-Token` en escrituras):**
  - `GET /api/nutrition/foods` → `{ foods: OwnFood[] }` (solo activos, por nombre). Cacheado para lectura sin conexión.
  - `POST /api/nutrition/foods` → `201 OwnFood`. Acepta `Idempotency-Key`.
  - `PATCH /api/nutrition/foods/:foodId` → `200 OwnFood` con `revision` vigente.
  - `POST /api/nutrition/foods/:foodId/archive` → `200 { archived: true }` con `{ revision }`.
  - Errores: `400 INVALID_NUTRITION` (campos, grupos, límites; en 100 g la suma P+C+G ≤ 100 y ≤ 900 kcal), `409 FOOD_NAME_TAKEN` (con `fields.name`), `409 FOOD_CONFLICT` (revisión vieja), `404 FOOD_NOT_FOUND` (ajeno, archivado o inexistente), `403 FOOD_LIBRARY_UNAVAILABLE` (sin suscripción vigente), `403 ROLE_FORBIDDEN` (cliente).
- **Móvil:** sin cambios; recibe el plan con los datos copiados como hasta ahora.

## Diferenciación de alimentos y recetas en planes y móvil (`23-nov-2026`)

- **Contrato (`NutritionItem`, compatible hacia atrás):** cada elemento del plan añade los campos opcionales `kind?: 'food' | 'recipe' | null` (normalizado a `'food'` cuando falta en documentos heredados) y `recipeIngredients?: { name, quantity, unit }[] | null` (solo permitido cuando `kind === 'recipe'`, máx. 40 ingredientes). El límite de `NutritionItem.instructions` sube de 1000 a 2000 caracteres para alinearse con `private.professional_foods.preparation`. Sin migración SQL: el documento completo sigue persistido en `private.nutrition_versions.document` (`jsonb`) y `private.nutrition_items.instructions` es `text`.
- **Biblioteca Web (`/app/alimentos`):** cabecera «Alimentos y recetas» con tres vistas separadas (`Mis alimentos`, `Mis recetas` y `Catálogo base`), columna de tipo (`Alimento` vs `Receta`), vista previa de ingredientes/porciones/pasos en `Mis recetas`, ayuda contextual en `OwnFoodEditor` según el tipo elegido y `FoodPickerModal` filtrado (`allowRecipes={false}`) al armar ingredientes para una receta.
- **Prescripción y vista Web:** `FoodPickerModal` ofrece filtros `Mis recetas` y `Mis alimentos` con tarjetas diferenciadas. Al agregar o escalar una receta (`createItemFromCatalogFood`, `mealFiller.ts` y `NutritionEditor`), sus `recipeIngredients` se escalan proporcionalmente a las porciones prescritas (y en recetas libres se pueden capturar o editar manualmente junto con los pasos de preparación). `NutritionEditor` y `NutritionView` muestran etiquetas `Receta` / `Alimento`, desglose de ingredientes, pasos multilínea y contadores combinados (`1 receta · 2 alimentos`).
- **Móvil (`NutritionPlanView`):** distingue cada receta con `IconBadge` y `TonePill('Receta')`, muestra un resumen de ingredientes/preparación en la fila y al tocarla abre una hoja inferior dedicada (`_openRecipeSheet`) con dos secciones claras: **Qué necesitas** (cantidades exactas para la porción prescrita) y **Cómo prepararla** (pasos completos), además de macros y equivalente cuando existen.

### Evidencia (`T` / `E`)

- **T.** `npm --prefix apps/api run build`: exit 0. `tests/nutrition-foods.test.ts` (nuevo): 3/3, sobre BD temporal local creada desde `identity_access.sql` y rol `couchone_authentication`. Cubre receta calculada en servidor, validaciones, nombre duplicado, conflicto de revisión, otra cartera (`404` y RLS directa), cliente `403`, sin CSRF `403`, archivado y suscripción vencida.
- **T.** `tests/migrations.test.ts`: aprobado con la nueva migración (instalación limpia, actualización con filas existentes y catálogo idéntico al esquema integrado; 34 migraciones, 38 tablas).
- **T.** Suite API completa: 211/213. Fallan dos pruebas ajenas al cambio: `client-read-isolation.test.ts` exige el host literal `127.0.0.1` (pasa al usarlo) y «deactivating a professional revokes all their sessions…» (`session-lifecycle.test.ts`) falla igual en `HEAD` limpio (`7a26975`) sin este cambio.
- **T.** Web: `build` exit 0, `oxlint` sin avisos, `npm test` 172/172 con `tests/food-library.test.mjs` (nuevo): búsqueda y reescalado de alimentos propios, preferencia por tiempo de comida y restricciones en «Sugerir alimentos», y página (lista, copiar del catálogo, guardar y archivar con confirmación). Prettier limpio en los archivos tocados.
- **T.** Navegador integrado contra una API y una BD temporales locales (`localhost:5002`/`3002`, cuenta sintética): crear alimento por pieza con aviso de kcal según macros, receta con ingredientes del catálogo y propios, reescalado por cantidad, macros por porción iguales a los del servidor, catálogo base, 1280 px y 375 px sin desbordamiento horizontal, y barra inferior móvil con 4 destinos.
- **T.** BD local de desarrollo (`CouchOneFit_dev`, 21-nov-2026): tenía aplicada la versión de `202611200001_daily_check_ins.sql` del commit `2c2bd72` (checksum coincidente). La única diferencia con la versión vigente era la restricción `check_ins_check` (un check-in con solo «No aplica» ya no cuenta como registro). Se comprobó que ninguno de los 284 check-ins existentes la incumplía; en una transacción se reemplazó la restricción con el mismo nombre y se actualizó el checksum. El migrador del proyecto aplicó después `202611210001_professional_foods.sql`, y una segunda pasada no encontró pendientes. Comparando con una BD limpia migrada, `CouchOneFit_dev` coincide en columnas, triggers, RLS, restricciones, índices, políticas, permisos de `couchone_authentication` y funciones.
- **T.** Panel local real (`127.0.0.1:5000`, API en modo `watch` contra `CouchOneFit_dev`, cuenta QA): alimento «Tortilla de nopal» creado y marcado para Desayuno y Cena. En una versión nueva sin guardar del plan de un cliente, «Volver a sugerir» en Desayuno usó la tortilla propia en lugar de la avena base (4 pza = 140 kcal, P 6 g, C 26 g, G 1.6 g). El borrador se descartó y el plan activo quedó igual (V2).
- **Pendiente.** Asignar HU en el plan. Aceptación humana (**R**) y revisión de pares.

## Recordatorios de comidas en móvil (`23-nov-2026`)

Decisión del usuario en el chat: avisar al cliente «poquito antes» de cada
comida con horario que fija el profesional. Solo móvil, sin cambios de API ni
de BD; decisión común con la notificación de entreno en
[EP-06](../ep-06-entrenamiento/README.md#decisión-del-usuario--23-nov-2026-notificaciones-locales).

- **Origen:** `scheduleTime` de cada comida del plan activo (texto libre ≤ 40).
  Se programan las horas de reloj (`08:00`, `1:30 p.m.`, `08:00 - 09:00`);
  las relativas (`60 min pre`, `al despertar`) se omiten y el panel indica
  cuántas quedaron sin hora fija. Máximo 12 comidas.
- **Aviso diario** a la hora menos la antelación elegida (15 min por omisión):
  «En 15 min: Comida principal (14:00)» con los dos primeros alimentos y las
  kcal. Al tocarlo abre Planes → Alimentación.
- **Sincronización:** se reprograman al cargar o refrescar el plan (también
  desde la caché sin conexión) y al cambiar las preferencias; se cancelan si
  el plan deja de ser accesible o se cierra la sesión. Android las conserva
  tras reiniciar, cambiar la hora o actualizar la app.
- **Puntualidad (Android 14+):** sin «Alarmas y recordatorios» Android puede
  retrasarlas hasta una hora. Cuenta → Preferencias → Notificaciones muestra
  un aviso con **Permitir**, que abre esa pantalla del sistema; al
  concederlo, las alarmas se reprograman como exactas.

## Contratos HTTP y esquema compatible

No se añadió una nueva migración SQL porque `private.nutrition_versions.document` ya almacena `jsonb` (`CHECK (jsonb_typeof(document) = 'object')`). Todos los campos nuevos de documento, comida y alimento son opcionales/anulables y `normalizeDocument` en `apps/api/src/features/nutrition/repositories/nutrition.ts` los rellena con `null` al leer filas heredadas.

- **Profesional (cookie HttpOnly + `Origin` + `X-CSRF-Token` en escrituras):**
  - `GET /api/clients/:clientId/nutrition-plans` → `{ versions, activeVersionId, activeRevision, canWrite }`
  - `POST /api/clients/:clientId/nutrition-plans/suggestion` → `200 { suggestion: NutritionSuggestionResult }` (solo calcula y devuelve sugerencia; nunca inserta planes ni versiones). `409 NUTRITION_EVALUATION_REQUIRED` sin evaluación física.
  - `POST /api/clients/:clientId/nutrition-plans` → `201 NutritionVersion` (crea plan y borrador V1). Crear y editar borradores también exigen evaluación (`409 NUTRITION_EVALUATION_REQUIRED`).
  - `POST /api/clients/:clientId/nutrition-plans/:planId/versions` → `201 NutritionVersion` (crea nuevo borrador V2+).
  - `PATCH /api/clients/:clientId/nutrition-plans/:planId/versions/:versionId` → `201 NutritionVersion` (requiere `revision` vigente).
  - `POST /api/clients/:clientId/nutrition-plans/:planId/versions/:versionId/activate` → `200 { version, activeRevision }` (acepta `{ expectedActiveRevision }`, valida concurrencia optimista y registra auditoría en `private.nutrition_activations`).
  - `GET /api/clients/:clientId/record` → incluye `record.sections.nutritionPlan` (`{ status: 'empty' }` o `{ status: 'available', plan, activeRevision }`).
- **Cliente móvil (`Authorization: Bearer`):**
  - `GET /api/me/nutrition-plan` → `200 { plan: NutritionVersion | null }` (exclusivamente la versión publicada y activa del propio cliente; si no hay plan activo devuelve `null`, nunca borradores ni datos de otro cliente).

En `apps/api/src/app.ts`, `nutritionRoutes` se monta en `/api` **antes** de `express.json({ limit: '16kb' })` para respetar el límite de `1mb` necesario en planes ricos. El aislamiento de lectura y escritura mantiene las políticas RLS bajo el rol restringido `couchone_authentication`: cartera ajena responde `404`, rol cliente intentando escribir o calcular sugerencias responde `403`, y expediente inactivo bloquea escrituras y cálculo (`403`, `canWrite: false`) preservando lectura histórica.

## Evidencia y validación

Ver el registro detallado en [hu-026/validacion-local.md](hu-026/validacion-local.md).
