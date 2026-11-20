# EP-05 — Alimentación y prescripción nutricional (`HU-024` a `HU-027`)

Épica de prescripción nutricional asistida, versionado inmutable y lectura móvil para cliente. Mantiene la regla central del producto: **el profesional siempre revisa, ajusta y activa; ninguna fórmula o plantilla escribe ni activa planes automáticamente**.

## Historias implementadas y decisión vigente (`19-nov-2026`)

| Historia | Alcance | Estado local |
| --- | --- | --- |
| **HU-024** — Prescripción rica por tiempos de comida | Constructor Web enriquecido con catálogo curado (`foodCatalog.ts`), 7 plantillas de comida con multiplicador de porción, búsqueda insensible a acentos/sinónimos, 8 grupos, equivalencias/sustituciones por alimento, horarios y categorías por comida, reordenamiento/duplicación, barra proporcional de macros (P/C/G vs meta) y secciones colapsables opcionales (día de descanso y peri-entreno). | Implementado (Web/API/BD compatible) |
| **HU-025** — Motor de sugerencia inicial (`RDF0605` / `RDF0606`) | **Reactivada el 19-nov-2026** tomando las fórmulas de cálculo de `fitnextfy` (`domain/suggestion-engine.ts`) como apoyo clínico en el asistente modal: `Mifflin-St Jeor` y `Katch-McArdle` (requiere `% grasa`), factor actividad × NEAT (`1.2–2.2`), ajuste calórico y proteína por composición corporal o fallback sin `% grasa`, pisos de déficit (`1500 kcal` hombre / `1200 kcal` mujer, máx. `25%`/`30%`, `>= 50 g` carbohidratos), reparto exacto `P*4 + C*4 + G*9` con grasas `20–35%`, ciclado de carbohidratos opcional, fibra, hidratación, umbral de leucina (`0.045 g/kg`), pre-cama, peri-entreno y plantilla sugerida de comidas. Pre-carga peso/talla/edad/`% grasa`/objetivo desde el expediente (`ProfessionalRecord`) sin tocar BD ni activar versiones hasta que el profesional guarda. | Implementado (API/Web; pendiente QA humana y revisión independiente) |
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
