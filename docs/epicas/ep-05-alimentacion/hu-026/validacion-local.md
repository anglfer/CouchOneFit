# Validación local de acceso a nutrición — HU-024, HU-026 y HU-027

## Permisos del rol de ejecución

**E.** La migración `202611190001_nutrition_runtime_access.sql` concede a `couchone_authentication` los permisos que usan las consultas de nutrición y conserva RLS. El profesional puede escribir para expedientes activos de su cartera cuando su suscripción permite prescribir. El cliente puede leer exclusivamente su versión activa publicada. Las activaciones se insertan en el historial y los documentos de versiones publicadas quedan protegidos de edición.

La migración anterior conserva su suma de verificación. El cambio no ejecuta escrituras sobre prescripciones ni transforma los datos existentes. Para revertir después del commit de la base, usar una migración inversa revisada que retire los permisos añadidos y restablezca las políticas anteriores, conservando las filas.

## Evidencia en PostgreSQL 18 local

- **T.** La regresión reprodujo `42501` al listar los planes con el rol restringido antes de aplicar la corrección.
- **T.** `npm run db:migrate` aplicó la migración en dos bases locales ya migradas. `migrations.test.ts` cubre instalación limpia, equivalencia con el esquema integrado, actualización con un plan activo e historial existentes y acceso con el rol restringido.
- **T.** El recorrido HTTP con dos carteras y credenciales sintéticas comprobó crear y editar un borrador, mantenerlo invisible para el cliente, activar V1 y V2, consultar la versión activa en el endpoint móvil y conservar las dos versiones. El profesional de otra cartera recibió `404` al listar o activar y el cliente recibió `403` al intentar escribir.
- **T.** Una prueba temporal de integración Flutter en el emulador Android inició sesión con el cliente sintético. En Planes → Alimentación apareció V2 con su alimento y cantidad. V1 ya no apareció en esa vista.
- **T.** `npm run build` de API completó correctamente. `npm test` aprobó 232 de 233 pruebas. Sigue fallando el caso de revocación de sesiones al desactivar a un profesional, observado antes de esta migración.

Esta evidencia cubre la corrección de permisos. Quedan pendientes la revisión independiente y la validación de las historias completas.

## Ampliación EP-05 (`HU-024`, `HU-025`, `HU-026`, `HU-027`) — 19-nov-2026

- **T.** API (`apps/api`): `npm run build` (`tsc`) sin errores. Con PostgreSQL local (`127.0.0.1/CouchOneFit_test`), `npx tsx --test tests/nutrition-suggestion.test.ts tests/nutrition-integration.test.ts tests/client-read-isolation.test.ts` aprobó **45 de 45** pruebas (5 unitarias del motor HU-025 en `nutrition-suggestion.test.ts`, 1 recorrido HTTP/RLS completo en `nutrition-integration.test.ts` sin persistencia automática en `/suggestion`, con borradores V1/V2 enriquecidos, `sections.nutritionPlan` y `/api/me/nutrition-plan` bajo `couchone_authentication`, y 39 en `client-read-isolation.test.ts`). La suite completa `npm test` aprobó **238 de 239** pruebas, persistiendo únicamente el fallo previo de `tests/session-lifecycle.test.ts` sobre revocación de sesiones al desactivar a un profesional.
- **T.** Web (`apps/web`): `prettier --check` en los 18 archivos tocados sin advertencias; `npm run build` (`tsc -b && vite build`) correcto; `npm run lint` (`oxlint`) con **0 errores y 0 advertencias** en 135 archivos; y `npm test` aprobó **153 de 153** pruebas (incluidas las 6 de `tests/nutrition-web.test.mjs`).
- **T.** Móvil (`apps/mobile`): `dart format --output=none --set-exit-if-changed` limpio en los 7 archivos tocados y `flutter analyze` con `No issues found!`. `flutter test test/nutrition_test.dart test/training_test.dart` aprobó **33 de 33** pruebas. La ejecución completa de `flutter test` obtuvo **84 aprobadas y 2 fallidas preexistentes** en `test/client_login_test.dart` debidas a tokens simulados con expiración fija `2026-11-18T12:00:00.000Z` frente a la fecha actual (`2026-11-19`).

Pendiente de verificación humana (**R**) en navegador Web, emulador/dispositivo Android para el rediseño HU-027 y revisión independiente antes de cierre.

## Segunda iteración EP-05 (evaluación obligatoria, motor de comidas y UI) — 19-nov-2026

- **T.** API: `npm run build` sin errores. `npm test` contra PostgreSQL local (`127.0.0.1/CouchOneFit_test`) aprobó **238 de 239**; persiste solo el fallo previo de `session-lifecycle.test.ts`. `nutrition-integration.test.ts` comprueba `409 NUTRITION_EVALUATION_REQUIRED` en sugerencia y creación de borrador antes de insertar una evaluación; `migrations.test.ts` registra una evaluación en cada cartera sintética.
- **T.** Web: `prettier --check` de los archivos tocados, `npm run build`, `npm run lint` (0 avisos) y `npm test` **154 de 154**. Nueva prueba del motor: una comida de 40/60/15 g queda dentro de ±6/±8/±5 g y una variante `Vegano + Sin gluten` no contiene ingredientes de origen animal.
- **T.** Recorrido en navegador integrado (API de QA local en `127.0.0.1:3000` con base `cof_e2e_ep05_e287687_qa`, cuenta y cliente sintéticos): sin evaluación se muestra el bloqueo; tras registrar una bioimpedancia el asistente precarga peso, estatura y `% grasa` con su origen, pide el sexo de referencia, calcula en vivo y aplica 5 comidas con alimentos cuyos macros quedan en verde frente a la guía; se guardó y activó la versión. A 375 px no hay desplazamiento horizontal (`scrollWidth = 375`).
- **T.** Móvil: `flutter analyze` sin problemas y `flutter test test/nutrition_test.dart test/training_test.dart` **33 de 33**. Revisión visual mediante captura de widget (claro y oscuro), no en dispositivo.

Pendiente: QA humana (**R**) en navegador y en dispositivo Android, y revisión independiente.

## Edad y % de grasa en el asistente — 20-nov-2026

- **E.** La edad ya no es editable cuando el cliente tiene fecha de nacimiento; además, `generateSuggestion` la recalcula en el servidor desde `clients.birth_date` en la zona horaria del cliente e ignora la enviada. Peso, estatura y `% grasa` se toman de la evaluación más reciente que tenga cada dato (incluida la estimación oficial por pliegues) con su origen y fecha. El aviso de «Actualización disponible» también detecta un cambio de grasa ≥ 2 puntos frente al plan activo y muestra fechas legibles.
- **T.** Recorrido en navegador integrado con la cuenta QA local: el asistente mostró «Edad 36 años · Según su fecha de nacimiento» sin campo editable y precargó 77,2 kg y 14,3 % («Pliegues · 21 nov 2026»).
- **R.** La persona usuaria aprobó ajustar los factores de actividad de HU-025: las bandas anteriores (`moderate` 1,8–2,0, máximo 2,2) sobrestimaban el mantenimiento ≈20 % frente a las tablas habituales. Nuevas bandas: sedentario 1,2–1,3; leve 1,375–1,45; moderado 1,55–1,65; muy activo 1,725–1,9 (NEAT elige mínimo/medio/máximo). `ENGINE_VERSION` pasa a `hu025-fitnextfy-v2`; los planes guardados conservan su metadato v1 y no se recalculan.
