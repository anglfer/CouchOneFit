# HU-021 — Registrar y evaluar composición corporal multimétodo fechada

> Guía integral y estado operativo: [HANDOFF](COUCHONEFIT_HU021_HANDOFF.md). Las referencias posteriores a sesiones/bloqueos conservan la cronología; la sección final de integración indica el estado actual.

## Alcance autorizado

La instrucción de Pukzil en esta sesión amplía formalmente HU-021. Sustituye la limitación anterior de registro manual: se autorizan Perímetros, Pliegues y Bioimpedancia, pestaña propia dentro del expediente. No cambia las reglas de otras épicas. Navy y Jackson–Pollock/Siri permanecen **deshabilitados**, por autorización expresa, hasta cotejo documental. DEC-007 conserva su gate técnico; no se declara aprobación científica por transcribir fórmulas.

`waistCm` mantiene su significado histórico. `abdomenUmbilicalCm` es una entrada independiente autorizada. No se usa abdomen umbilical como cintura para ICC/ICE. No se infiere método de una evaluación antigua.

## Arquitectura y compatibilidad

- Se conserva `private.client_evaluations` y sus columnas anteriores; cada registro sigue siendo independiente e inmutable para el runtime.
- Migración `202611090001_multimethod_evaluations.sql`, posteriormente aplicada a desarrollo junto con `202611100001` tras restauración verificada; las referencias a preparación de sesiones previas son históricas. Agrega un snapshot JSONB `assessment` nullable con método, protocolo, identidad derivada de sesión, fecha efectiva, nacimiento/edad de referencia, entradas, resultados, versión, estado y procedencia. Evita columnas nulas para cada salida y preserva el snapshot sin recalcular al leer. No crea tabla paralela ni roles nuevos.
- Persistencia usa los valores ingleses `circumference`, `skinfolds`, `bioimpedance`; DTO usa `perimetros`, `pliegues`, `bioimpedancia` por instrucción explícita. Repositorio mapea la frontera.
- Entradas antiguas sin `method` conservan su validador/contrato. Respuesta heredada no incorpora un método inventado. El código de lectura usa JSON de fila para tolerar el esquema anterior a esta migración; alta multimétodo devuelve 503 `EVALUATION_UPGRADE_REQUIRED` si la columna aún no existe.
- Se conservan las políticas de lectura/alta y grants previos. Una política restrictiva adicional liga `assessment.ownerId` al sujeto de transacción. Se concede únicamente INSERT sobre la nueva columna, sin UPDATE/DELETE.
- La API deriva propietario, fecha de creación y snapshot de nacimiento/edad. Peso y altura de la evaluación son entradas explícitas: el perfil base no se copia ni se modifica silenciosamente.

## Contrato

POST `/api/clients/{clientId}/evaluations` acepta la entrada anterior o una entrada discriminada:

```json
{"method":"bioimpedancia","equation":"not_applicable","effectiveDate":null,"measurements":{"weightKg":80,"measuredBodyFatPercentage":25,"waterLitres":40}}
```

`equation`: `male`, `female`, `not_applicable`; es un selector del método, no un cambio del perfil. Todos los campos de medición son opcionales individualmente; debe existir al menos una medición del método distinta de peso/estatura. Esto permite capturar datos parciales mientras las estimaciones están deshabilitadas. No se aceptan resultados, edad, propietario ni asociaciones del cliente en el body.

GET conserva `{evaluations:[]}` y 20 registros por página. `?offset=N` permite consultar páginas anteriores en el módulo. Orden: fecha efectiva (o fecha antigua para heredadas), instante de creación e ID descendentes. La composición del expediente conserva 20 recientes y enlaza al módulo completo. Paginación por desplazamiento puede moverse ante altas concurrentes; la Web evita mostrar IDs duplicados, pero no ofrece una instantánea de toda la serie.

## Datos y validación

- DEC-006 existente: peso 30–300 kg; altura 100–250 cm; cintura 40–250 cm; cadera 50–250 cm; grasa medida 2–60%; cada pliegue 1–80 mm. Máximo un decimal; finitos, sin coerción de texto/booleanos. Vacíos omitidos/null no producen cero.
- Nuevas mediciones: cuello y abdomen umbilical en cm; bíceps y subescapular en mm (mismo límite de pliegue). Masa muscular en kg; agua en L; grasa visceral **solo índice del equipo**, sin clasificación ni conversión. No hay un rango clínico universal aprobado para estos nuevos valores: se exige positivo/finito/un decimal y coherencia de masas con el peso cuando está disponible.
- Segmentos opcionales: brazo izquierdo/derecho, tronco, pierna izquierda/derecha. Este incremento admite masas homogéneas en kg, tipo `muscle_mass` o `fat_mass`, explícitos. No se suman ni se admiten porcentajes/índices con una etiqueta de kg. Otros tipos/unidades y procedencia específica del equipo requieren ampliar el contrato; no se inventan.
- La fecha efectiva puede ser retroactiva, nunca futura ni anterior al nacimiento conocido. Si se omite, el servidor usa su día UTC de aceptación. `created_at` y la fecha técnica existente siguen siendo del servidor. Edad en años cumplidos, sin recalcular historia al editar el perfil. Falta de nacimiento conserva edad null.

## Cálculos habilitados

Funciones puras API en `domain/assessment.ts`; frontend previsualiza y backend recalcula siempre. Versión `composition-arithmetic-v1`.

- ICC = cintura/cadera, solo si existen ambas.
- ICE = cintura/altura, solo si existen ambas.
- Grasa de bioimpedancia = porcentaje informado por el equipo (no estimación).
- Masa grasa = peso × porcentaje / 100; masa libre de grasa = peso − masa grasa.
- Agua aproximada = litros/peso × 100, bajo aproximación explícita 1 L ≈ 1 kg.
- No se infiere masa muscular de masa libre de grasa ni se calcula porcentaje a partir de grasa visceral.
- Referencia aritmética independiente: 80 kg, grasa 25%, agua 40 L → 20 kg grasa, 60 kg libres, agua 50%; cintura 80/cadera 100/altura 200 → ICC 0.8, ICE 0.4. Se presenta redondeado, sin redondear resultados intermedios almacenados.

## Interfaz y offline

`/app/clientes/{clientId}/evaluacion` es la tercera pestaña del expediente: Resumen → Entrenamiento → Evaluación. No existe opción Evaluaciones en el menú principal ni selector adicional de clientes. La captura vive en `/app/clientes/{clientId}/evaluacion/nueva`, sin modal ni formularios duplicados. Cambiar de método conserva su borrador; descartar/navegar con cambios requiere confirmación común.

Dona solo para porcentaje existente/válido; barras segmentales comparan masas homogéneas. Sin semáforos ni interpretación clínica. SVG original orientativo anterior/posterior y alternativa textual/botones por sitio. **No constituye un protocolo anatómico validado**: las ayudas de sitio precisas siguen sujetas al cotejo técnico de las fuentes.

Se reutilizan sesión, CSRF, outbox cifrada por cuenta, idempotencia y caché de lecturas. La cola guarda entradas, nunca resultados autoritativos; al sincronizar el servidor recalcula y asigna creación/fecha efectiva omitida. Lo pendiente no aparece como registro confirmado. El módulo refresca al recibir la notificación común de sincronización.

## Fuentes y gates

- RDF0501–0503, DEC-006/007 y HU-021 del plan: alcance anterior y restricciones mantenidas salvo ampliación expresamente autorizada en esta sesión.
- Hodgdon/Beckett, informes Navy 84-11 y 84-29: https://apps.dtic.mil/sti/tr/pdf/ADA143890.pdf y https://apps.dtic.mil/sti/tr/pdf/ADA146456.pdf. No pudieron abrirse durante la investigación; **no se declaran verificados**.
- Jackson/Pollock/Ward 1980: https://pubmed.ncbi.nlm.nih.gov/7402053/ . El resumen no acredita los coeficientes completos. Gate DEC-007 pendiente.
- National Academies, tabla 2-1: https://www.nationalacademies.org/read/6104/chapter/4 . Distingue abdomen II umbilical y cintura natural; fuente de contraste, no sustituto del cotejo de originales. No se copió su ecuación femenina sin verificar.

## Preparación original de despliegue (histórica; ver cierre local al final)

No aplicar a `CouchOneFit_dev` hasta prueba aislada y autorización explícita. No usar runtime con CREATEDB/CREATEROLE. El arnés de API crea/elimina bases y roles temporales: falta verificar una conexión de preparación autorizada. Se mantienen pruebas de instalación limpia/snapshot/actualización; se añade regresión multimétodo al arnés de aislamiento.

El módulo requiere revisión visual humana y pruebas PostgreSQL/RLS antes del cierre. No se declara aceptación D0. Navy y Jackson-Pollock/Siri deshabilitados no bloquean por sí mismos el cierre del registro de la HU-021 original; pertenecen a la capacidad adicional de cálculo pendiente. Los tres métodos ofrecidos para captura sí requieren demostrar persistencia real antes de publicarse como operativos.

## Reestructuración UX y diagnóstico del guardado

La captura se realiza en `/app/clientes/{clientId}/evaluacion/nueva`, dentro del expediente. La pestaña Evaluación muestra historial confirmado y operaciones locales por separado. Resumen conserva solo un dato informativo de última evaluación si existe; no tiene botones ni gestión duplicada. No hay enlace circular «Abrir módulo».

El formulario ocupa una vista amplia; fecha y cliente preceden al método, datos generales y mediciones están agrupados, y la guía/resultados forman una columna secundaria en escritorio. Los borradores por método se conservan al alternar; la navegación con cambios exige confirmación. La vista permanece abierta tras guardar o encolar y muestra el resultado antes de volver al historial.

**Causa comprobada por inspección y pruebas:** `EVALUATION_UPGRADE_REQUIRED` usa HTTP 503. La clasificación anterior de todo 503 como fallo transitorio lo enviaba a la outbox y lo reintentaba indefinidamente. Ese código se excluye ahora de fallos de conectividad; la solicitud directa permanece en formulario como «Migración pendiente», y una operación antigua que recibe ese rechazo queda `failed`, conservando ID/payload y sin eliminación ni reintentos automáticos.

El transporte común no tenía deadline de fetch. Se añadió una opción opt-in a `submitWrite`, utilizada por evaluaciones con 20 segundos conforme a DEC-013 (plan §3.4 y despliegue.md). El resto de módulos conserva su comportamiento anterior. El plazo comprende la espera de sesión/CSRF y envío; no equivale a medir latencia SQL ni demuestra rollback. No se cancela ciegamente una escritura iniciada: el resultado incierto conserva la misma clave de idempotencia y se guarda en outbox si está disponible. Una respuesta tardía/replay no crea una evaluación distinta. Sin almacenamiento local, el formulario conserva el intento y bloquea cambios para permitir reintentar esa misma operación.

Estados: validando, guardando con progreso, confirmado por servidor, pendiente local con ID, error conservando entradas, migración pendiente y resultado incierto. Las respuestas inválidas tampoco se presentan como éxito. No se borran pendientes para resolver el bloqueo.

No se midieron tiempos reales de PostgreSQL ni se realizaron escrituras en bases para este diagnóstico. La persistencia multimétodo real sigue bloqueada por la migración no aplicada y las pruebas PostgreSQL/RLS pendientes.

Otra causa del bloqueo visual fue corregida en el formulario: `main.tsx` activa StrictMode y el efecto anterior marcaba mounted=false durante su limpieza sin restablecerlo en el segundo montaje. Esto podía ignorar una confirmación/error y omitir la salida del estado Guardando. Una regresión específica bajo React.StrictMode acredita ahora el procesamiento de la confirmación y la eliminación del progreso. No se modificó StrictMode ni configuración global para evitar la prueba.


## Decisión definitiva de navegación — 10-nov-2026

Pukzil comunica la decisión aprobada del supervisor: Evaluación es la tercera pestaña del expediente, inmediatamente después de Entrenamiento. Se reutiliza ClientHeader tanto en historial como en captura; clientId procede de la ruta del expediente y se valida/autorizada en API como antes. No cambia contratos ni endpoints ni esquema.

La página EvaluationsPage se conserva como área de trabajo del cliente, retirando su selector/listado de cartera y la navegación independiente. EvaluationSummary se conserva únicamente como dato informativo de última evaluación confirmada, sin enlace ni acciones. Las correcciones StrictMode, idempotencia, plazo de confirmación de 20 segundos, migración pendiente y cola offline no cambian.

Compatibilidad: `/app/evaluaciones/{uuid}` redirige con reemplazo de historial a `/app/clientes/{uuid}/evaluacion`; el sufijo `/nueva` se conserva. `/app/evaluaciones` o un identificador inválido redirigen a Clientes. Se valida/normaliza el UUID antes de construir la URL y la sesión conserva su guardia habitual. La página anterior no consumía parámetros de búsqueda seguros definidos: se descartan query/hash, incluidos destinos externos, en lugar de propagar parámetros arbitrarios. API y caché cifrada conservan sus rutas existentes.


## Integridad PostgreSQL validada — 10-nov-2026

Se preparó `202611100001_evaluation_measurement_integrity.sql`, sin alterar migraciones previas. Alinea las mediciones JSONB con los límites/precisión/campos del método y las columnas originales; incluye coherencia de masas y segmentos. No duplica el motor de resultados ni introduce criterios clínicos. Los snapshots heredados NULL no cambian; un snapshot previo inválido bloquea el despliegue con rollback para revisión, sin corrección automática de historia.

Las dos suites autorizadas pasaron **39/39** en bases/roles temporales de PostgreSQL 17.11: prueba de migraciones y aislamiento/integración. Recursos limpiados y roles globales intactos. Las notas anteriores de bloqueo de esas dos suites son históricas; aplicación a desarrollo, revisión funcional actual y aceptación independiente D0 siguen pendientes. Ver [evidencia final](revision-final.md).


## Preflight y respaldo anteriores a la integración final (histórico)

SQL READ ONLY confirmó PG17.11/127.0.0.1:5433/CouchOneFit_dev, preparador separado y 27 checksums aplicados compatibles. La migración inicial ya existe; solo faltan 202611090001 y 202611100001. Respaldo custom externo de snapshot consistente generado y recorrido completo con pg_restore; recuperación efectiva pendiente de permiso para un destino temporal nuevo. No se han aplicado migraciones ni hecho altas QA en desarrollo en este encargo. La autorización para migrar desarrollo no elimina la condición previa de respaldo recuperable. Ver guía integral antes de continuar.


## Integración local final completada — estado vigente

La autorización posterior permitió la única temporal cof_hu021_restore_6dcaeb29a803. Restauración custom completada, comparación de huellas/historial/catálogos y CHECK normalizados por PostgreSQL aprobada; temporal eliminada y dump original intacto. Se aplicaron solo 202611090001 y 202611100001 mediante migrador oficial en PG17.11/127.0.0.1:5433/CouchOneFit_dev. Historial 29, 14 restricciones validadas de evaluaciones, RLS y tres políticas, permisos mínimos y roles compartidos idénticos.

Los 2 clientes y las 3 evaluaciones anteriores se preservaron por huellas completas. Smoke QA real añadió exactamente una por método: total 6, sin sobrescritura; replay y doble envío no duplican. API unitarias 21/21, Web 94/94, builds/lint/formato aprobados en esta ejecución; PG 39/39 permanece evidencia anterior. Sin navegador visual disponible ni segunda cartera QA para repetir su caso HTTP en desarrollo; aislamiento de dos profesionales acreditado en las pruebas temporales anteriores. Ver [HANDOFF §M](COUCHONEFIT_HU021_HANDOFF.md#m-evidencia-de-integración-local-final--11-nov-2026-utc--10-nov-local). D0/revisión y publicación pendientes.
