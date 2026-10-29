# HU-020 — Incremento de perfil base propio

29/10/2026. Responsable: Franela Whaite. Implementado por el asistente por autorización de la persona usuaria en `feature/api-client-portfolio`, sin otra rama/PR, push, merge ni despliegue. Se conserva PR #22 y su rama. No se acredita aviso al grupo ni revisión independiente por esta autorización. Fuentes: plan §HU-020/036, DEC-004/009, HU-004/008/017, RC02/RDC0201–0204, DEVELOPMENT y convenciones BD.

## Alcance y autorización de medidas

DEC-009 §3.4 dice: «Perfil base/peso inicial y planes activos conservan consulta base». No enumera por nombre todas las columnas. La clasificación se contrasta con HU-015/017, DEC-006 y el diccionario: grasa **medida base** opcional, cintura y cadera iniciales forman parte de la captura base del expediente. Los comentarios SQL de HU-015 las distinguen de resultados calculados, evaluaciones y medidas históricas. Se autoriza su consulta como parte de ese perfil base, no por el mero hecho de existir columnas ni como permiso de progreso. UI las etiqueta como iniciales; no calcula grasa ni deriva evolución.

DEC-009 exige flags individuales por cliente, default off, para progreso de peso, medidas, check-ins, entrenamiento, adherencia, calculados y evolución. Historial no es grant global; categoría y profundidad temporal son independientes. Una derivación requiere permiso de categoría y entradas; agregado 200 omite ocultas y dedicado 403 no devuelve registros. Revocar afecta próxima consulta y limpieza del estado. Nada de ello se implementa con flags inventados en esta historia.

HU-036 no aporta todavía tablas, configuración de visibilidad, servicios ni `/api/me/history` en este checkout. Por eso el endpoint solo devuelve perfil base; no incluye `progress: []`, históricos, permisos ficticios o datos a ocultar en móvil. Pantalla: «La consulta de progreso todavía no está disponible. Puedes consultar aquí tus datos iniciales y tu objetivo». No afirma que exista un módulo sin registros ni expone IDs de historias.

## Contrato y persistencia

`GET /api/me/record`: sesión persistida de cliente activo, vínculo propio, sin query parameters ni ID elegible. `200 { record }`, campos explícitos: `id`, `fullName`, `goal`, `status`, `username`, `email`, `birthDate`, `heightCm`, `baseWeightKg`, `baseBodyFatPercentage`, `waistCm`, `hipCm`. Fecha calendario YYYY-MM-DD, medidas numéricas en cm/kg/porcentaje; columnas anteriores incompletas y opcionales ausentes conservan null. No versión de escritura, propietario, userId, códigos ni hashes. Estado active/inactive. `Cache-Control: no-store`, también en errores seguros.

401: sesión inválida/revocada, cuenta inactiva o sin vínculo; 403 ROLE_FORBIDDEN: rol incorrecto; 400 INVALID_INPUT: query parameters; 503: consulta no disponible, no rechazo definitivo de autenticación. Repositorio consulta cuenta/rol/sesión persistidos, `clients.user_id` y contexto transaccional `app.subject_id`; RLS existente bloquea lectura general y otras identidades. DEC-004 conserva lectura propia con expediente/profesional inactivo o suscripción ausente/suspendida: no se consulta cupo para leer.

`GET /api/client/profile` conserva cuerpo `{ profile }` y campos anteriores, sin añadir medidas. Nuevo router `/api/me/record` usa guard de ruta específico antes de checkout: no captura `/plans`/`payments` ni debilita su rol profesional. No hay migraciones ni grants nuevos. No se modifican SQL históricos ni fixtures existentes.

## Flutter

Modelo y servicio leen el contrato nuevo. Pantalla solo lectura: identidad, objetivo, nacimiento, estatura, peso/grasa/cintura/cadera base, unidades y «Sin registrar». No formulario ni recaptura. Mantiene acciones separadas de credenciales/logout. Carga inicial/restauración/actualización, error de consulta con reintento explícito y rechazo definitivo de sesión son estados distintos. Un payload mal formado es 503 de consulta, no logout. 403 de negocio no se equipara a ROLE_FORBIDDEN.

La restauración y login resuelven el clientId de la sesión, y solo se muestra una respuesta con ese mismo ID. Un contador invalida respuestas antiguas al iniciar otra consulta/logout. No se persiste perfil ni progreso en almacenamiento local; únicamente se conserva el mecanismo anterior de tokens. Al fallar una consulta se oculta la ficha y se ofrece reintentar, sin fingir vacío. Cambiar cuenta o recibir rechazo definitivo elimina el perfil anterior. La renovación existente solo repite lecturas y no añade escrituras.

## Límites y dependencias

API verificada; código y pruebas Flutter preparados, **no ejecutados ni compilados en esta computadora** por SDK Flutter/Dart no localizado. [Evidencia](validacion-local.md), [recorrido y entorno](prueba-integracion.md). Incremento base no equivale a HU-020 completa: progreso/RDC0204 depende de HU-036 y de sus permisos reales. HU-019 sigue pendiente de HU-021/022/026/030/033 y fuentes HU-037 aplicables; no se crean módulos para aparentar expediente consolidado. D0, revisión independiente y TT-010 transversal siguen abiertos, así como condiciones DEC-011/015 para datos reales.
