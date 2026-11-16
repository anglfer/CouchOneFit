# HU-023 — Condiciones de desbloqueo

**Documento 3 de 3 · Contrato y trazabilidad de las etapas documentales y técnicas.**

**Estado vigente: cálculo candidato autorizado exclusivamente para desarrollo y pruebas locales, desactivado por defecto.** La última
sección registra la autorización de candidatos locales y prevalece sobre la
restricción anterior de persistir únicamente indisponibilidad. Se conserva también
la referencia técnica pendiente sin cálculo. No constituye aprobación científica, publicación ni D0. Las secciones
anteriores conservan su contexto histórico; los otros dos documentos permanecen
intactos por restricción del alcance.

[Verificación científica](README.md) ·
[Casos candidatos](casos-patron-candidatos.md).

## Decisiones y evidencias pendientes

| Tema                                 | Lo confirmado                                                         | Lo que falta y quién debe revisarlo                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Método                               | DEC-007 elige JP3 + Siri                                              | Completar gate técnico, no volver a elegir fórmula por conveniencia. Pukzil y revisión independiente.                                                                           |
| Original masculino                   | Coeficientes de ec. 5 cotejados con texto completo                    | Revisión independiente y protocolo anatómico exacto; no inferirlo del SVG actual.                                                                                               |
| Original femenino                    | Referencia identificada; transcripción candidata del plan             | Copia completa legible, tabla/ecuación/página exactas y cotejo de cada coeficiente, sitios y unidades. Bloqueante para esa variante.                                            |
| Siri                                 | Original 1961 localizado; p. 230/ec. 10 cotejada visualmente          | Revisión completa de supuestos y límites; discrepancia del ejemplo de densidad 1.050; revisión independiente.                                                                   |
| Dominio de aplicación                | Intervalo masculino estudiado; femenino recogido por DEC-007/abstract | Aprobar política exacta y condiciones no cubiertas. No extrapolar a 16–17 años, edades mayores ni situaciones particulares sin respaldo. Supervisor con revisión de dominio.    |
| Cautela femenina >40                 | El plan exige atenderla                                               | Original y política aprobada; no inventar ni prohibición a partir de 41 ni permiso automático hasta 55.                                                                         |
| Identificador/versiones              | Historia debe identificar método y versión                            | Propuesta para revisión: `jackson-pollock-3-siri-v1`, con variante y protocolo explícitos. No es nombre ni contrato aprobado. No reutilizar `composition-arithmetic-v1`.        |
| Casos oficiales                      | Matriz candidata preparada                                            | Otro integrante reproduce y firma referencias, entradas, resultados y tolerancias. Decimal/Fraction del mismo agente no basta.                                                  |
| Precisión                            | 0,1 mm de captura, sin redondeo prematuro y un decimal UI             | Aprobar representación y precisión de persistencia, tolerancias y regla de empates. No imponer numeric(4,1) a densidad/resultados.                                              |
| Motivos de indisponibilidad          | Faltantes, fuera de dominio, no finitos, D≤0, porcentaje≤0 o ≥100     | Concretar códigos/DTO y distinguir cálculo no disponible de evaluación inválida. No modificar HU-021 para exigir cálculo.                                                       |
| Historia                             | Entradas, versión y resultado inmutables                              | Definir si se calcula solo en evaluaciones nuevas. Para antiguas, no actualización silenciosa: cualquier resultado añadido requeriría diseño append-only y autorización propia. |
| Masas derivadas                      | No son obligatorias en descripción original HU-023                    | Supervisor decide alcance. Peso no es obligatorio para porcentaje JP3; grasa estimada no es medición de dispositivo.                                                            |
| Uso clínico/poblaciones no cubiertas | DEC-007 remite al bloqueo de uso clínico real DEC-015                 | No declarar validación clínica, diagnóstico ni cumplimiento legal por aprobar el software.                                                                                      |

## Dependencias técnicas inspeccionadas, sin modificaciones

- [Dominio de evaluaciones](../../../../apps/api/src/features/evaluations/domain/assessment.ts):
  `calculate()` solo ratios y aritmética de bioimpedancia; JP3 no implementado.
- [Validador multimétodo](../../../../apps/api/src/features/evaluations/validators/assessment.ts):
  siete sitios de pliegues disponibles, selector explícito y valores finitos con
  precisión DEC-006; permite captura parcial significativa.
- [Repositorio](../../../../apps/api/src/features/evaluations/repositories/evaluation.ts):
  obtiene propietario y nacimiento de contexto autorizado; conserva fecha efectiva,
  nacimiento/edad snapshot y protocolo `jp3-sites-pending`. Los registros antiguos
  pueden carecer de metadatos suficientes.
- [Proyección HU-022](../../../../apps/api/src/features/evaluations/domain/evolution.ts):
  solo mediciones persistidas, sin completar desde perfil ni leer resultados
  calculados. No ampliar su catálogo para cerrar HU-023 sin autorización separada.
- [Migración multimétodo aplicada](../../../database/migrations/202611090001_multimethod_evaluations.sql):
  exige versión `composition-arithmetic-v1`; bloquea grasa/densidad/masas en
  métodos distintos de bioimpedancia. Habilitar el cálculo persistido requerirá
  **nueva** migración, no editar esta.
- [Integridad de mediciones](../../../database/migrations/202611100001_evaluation_measurement_integrity.sql):
  conservar restricciones, semántica y snapshots anteriores.

No se requiere otra tabla solo para calcular en evaluaciones nuevas si se conserva
el snapshot actual con versiones compatibles. Esta es una alternativa de diseño,
no DDL autorizado. Si el alcance incluye resultados añadidos sobre evaluaciones
viejas, evaluar otra relación append-only antes de comprometer persistencia.

## Archivos compartidos: aviso previo y autorización futura

Esta etapa **no modifica ninguno**. Se documentan los posibles puntos para
solicitar autorización específica, sin asumir que pertenecer a una integración
de EP-04 permite modificar automáticamente un archivo transversal.

| Ruta exacta desde raíz                      | Motivo y cambio mínimo futuro                            | Riesgo para otras historias   | Alternativa / condición                                                                                                            |
| ------------------------------------------- | -------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/api/identity-lifecycle.openapi.json`  | Documentar snapshot versionado y motivos de no cálculo   | Contrato compartido API/Web   | Reutilizar endpoints; cambios aditivos y consumidores revisados. No evitar documentar el contrato real. Autorización previa.       |
| `docs/database/schemas/identity_access.sql` | Reflejar una nueva restricción versionada                | Esquema integrado común       | Nueva migración exclusivamente de evaluaciones; actualizar esta copia es requisito del repo y necesita autorización previa.        |
| `apps/api/tests/migrations.test.ts`         | Instalación limpia y actualización conservando snapshots | Arnés común de pruebas        | Reutilizar arnés; estudiar test dedicado si ofrece igual cobertura. No modificar preparación global ni roles. Autorización previa. |
| `plan/PLAN_TRABAJO_V2.md`                   | Registrar gate cuando realmente se cumpla                | Estado común de HU/decisiones | Mantener evidencia en esta carpeta hasta revisión; el responsable actualiza/autoriza el plan.                                      |

No se identifica necesidad de modificar autenticación, clientes, nutrición,
entrenamiento, planes, pagos, móvil ni sus reglas. Si aparece, detener ese cambio
y solicitar autorización con ruta, motivo, riesgo y alternativa. No enviar avisos
al equipo automáticamente; la persona usuaria coordina conforme a CONTRIBUTING.

## Riesgos y medidas para HU-021/HU-022

| Riesgo                                                | Prevención y evidencia futura                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Romper captura con un pliegue o peso opcional         | Separar validación de registro de elegibilidad del cálculo; regresiones HU-021.                      |
| Cambiar significado de una versión o sitio            | Nuevo método/protocolo versionado; no relabel de snapshots ni reinterpretación de muslo/waist.       |
| Recalcular al editar perfil, edad o desplegar fórmula | Resultado, entradas y fecha efectivos inmutables; pruebas de edición/inactivación/reactivación.      |
| Mezclar grasa medida/estimada en evolución            | No cambiar la proyección de HU-022 ni su métrica de grasa medida.                                    |
| Confiar en preview Web o payload offline              | Backend autoritativo al aceptar; conservar idempotencia y semántica histórica.                       |
| Rechazar snapshots antiguos al migrar                 | Restricciones por versión con compatibilidad anterior; instalación limpia y actualización con filas. |
| Tomar un ejemplo discrepante como oráculo             | S-01 documentado; revisión y decisión explícita antes de oficializar casos.                          |

## Secuencia propuesta para la siguiente autorización

1. Obtener original femenino completo legible por editor, biblioteca o copia
   autorizada; cotejar su tabla y el protocolo. No sortear barreras de acceso.
2. Revisar completo Siri pp. 223–244 y resolver cómo documentar S-01. La fórmula
   y el ejemplo impreso no coinciden exactamente; no ocultar el hallazgo.
3. Otro integrante revisa los originales y reproduce casos, aprobando o corrigiendo
   la matriz con evidencia; aprobar dominio, versión y precisiones.
4. Con autorización, definir contrato compatible y persistencia de resultados
   nuevos; solicitar permiso para los archivos compartidos identificados.
5. Solo entonces autorizar API1 (motor puro/backend), persistencia incremental,
   WEB1 (estimación y motivos) y QA1. Aplicar `ui-ux-pro-max` en la fase visual;
   no hubo tarea visual en esta etapa.
6. Pruebas de referencia, fronteras, propiedad/RLS, inmutabilidad, idempotencia,
   offline y regresiones, con PostgreSQL temporal únicamente si se autoriza.
7. Revisión D0 de otro integrante y recorrido real; corregir observaciones.
   Publicación/merge/despliegue tienen autorizaciones separadas.

No basta con aceptar un nombre de fórmula o esta documentación para levantar el
gate. Si solo se verifica una variante, no habilitar parcialmente el producto
sin una decisión de alcance explícita del supervisor.

## Condiciones de salida verificables

- [ ] Original femenino legible y transcripción completa cotejada.
- [ ] Protocolos anatómicos y supuestos de Siri revisados con fuentes originales.
- [ ] Discrepancia S-01 tratada explícitamente, sin tolerancias artificiales.
- [ ] Dominio y tratamiento de poblaciones no cubiertas aprobados.
- [ ] Método/variante/protocolo/versiones y precisión definidos.
- [ ] Casos patrón y tolerancias reproducidos y revisados independientemente.
- [ ] Tratamiento de historia y alcance de masas derivados acordados.
- [ ] Autorización de la siguiente etapa y de cualquier archivo compartido.

**Resultado actual: HU-023 sigue Bloq.** No se declara Ready, implementación,
aceptación científica integral ni D0 aprobado. No se ejecutaron suites, escrituras
SQL, migraciones, instalación de dependencias, cambios de rama, staging, commits,
push o PR. No se modificaron HU-021, HU-022 ni otras épicas.

## Verificación documental de etapa 1 — evidencia previa

**T, resultados de esta ejecución:** Prettier local aprobado en los tres Markdown;
17 enlaces locales comprobados; 9/9 filas numéricas coherentes en suma, edad,
densidad, fracción exacta, decimal y UI candidata; revisión de espacios finales y
LF aprobada en 3/3 documentos; `git diff --check` limpio. Como los documentos aún
no están rastreados, también se revisó su whitespace directamente, sin staging.
Escaneo de patrones de claves privadas y URLs PostgreSQL con credenciales sin
hallazgos, más revisión del contenido sintético. Índice vacío, HEAD sin cambios y
únicamente estos tres archivos nuevos en el inventario. Esas comprobaciones no
sustituyen pruebas del futuro motor ni validación científica independiente.
Las consultas externas incluyeron fallos de acceso del editor femenino y OCR
ilegible; quedan expuestos en el Documento 1. La fuente de Siri de 1956 no se
confunde con el original de 1961. No se almacenaron copias de artículos ni imágenes,
credenciales, datos personales reales o archivos fuera de esta carpeta.

## Etapa 1B — Paquete concreto para revisión independiente

**Destinatario:** supervisor o integrante técnico distinto del autor del trabajo.
El supervisor debe identificar quién revisará evidencia científica y dominio; la
revisión del paquete documental no satisface por sí sola el futuro D0 de la
implementación. No se ha enviado ningún mensaje ni solicitud de aprobación.

### Material y orden de revisión

1. `README.md`: referencias completas/localizadores, matriz de coeficientes,
   original masculino, nueva lectura de pasajes de Siri y limitación femenina.
2. `casos-patron-candidatos.md`: nueve ejercicios con resultados/fracciones,
   tolerancias propuestas, N01–N20, G01–G06 y contraste discrepante S-01.
3. Este documento: decisiones, riesgos HU-021/022 y autorizaciones técnicas futuras.

No se incorporan copias de artículos de terceros al repositorio. El revisor debe
consultar originales por los enlaces identificados o acceso legítimo de biblioteca.
Los coeficientes femeninos permanecen **no cotejados**, aunque sus ejercicios sean
aritméticamente reproducibles. El cotejo de una fuente por Codex es evidencia T,
no revisión independiente ni aprobación de producto.

### Preguntas que requieren respuesta explícita

| ID  | Pregunta para el revisor/supervisor                                                            | Evidencia mínima y decisión pendiente                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | ¿Puede aportar una copia femenina completa y legible obtenida legítimamente?                   | DOI/PMID, edición/paginación y localizador exacto de ecuación de tres sitios. Sin ella no aprobar variante femenina.                                      |
| R02 | ¿Coinciden los cuatro coeficientes femeninos y sus signos con el original?                     | Cotejo dígito a dígito, tabla/ecuación/página y conclusión; no aceptar OCR corrupto ni cita secundaria.                                                   |
| R03 | ¿Qué protocolo exacto corresponde a cada sitio y variante?                                     | Páginas/referencias de técnica, unidades y suma correcta; no inferirlo del SVG ni sumar los siete sitios.                                                 |
| R04 | ¿Qué dominio y precauciones se aprobarán para la aplicación?                                   | Originales y decisión explícita para fronteras de edad, 16–17 años, edades mayores y cautela femenina >40. No extensión automática.                       |
| R05 | ¿Cómo se tratarán supuestos que no pueden confirmarse con las entradas actuales?               | Revisar restricciones de Siri documentadas y definir alcance/indisponibilidad. Cualquier nuevo dato clínico o cambio funcional exige autorización aparte. |
| R06 | ¿Acepta la ec. (10) cotejada y la exclusión de S-01 como oráculo exacto?                       | Revisar p. 230 y 150/7; conservar diferencia y causa desconocida, o aportar evidencia nueva. No cambiar constantes.                                       |
| R07 | ¿Reproduce los nueve casos sin usar el código del producto?                                    | Herramienta elegida por otro integrante, precisión, valores, tolerancias y observaciones por ID. F sigue condicional hasta R01/R02.                       |
| R08 | ¿Aprueba negativos, guardas, precisión de almacenamiento y redondeo UI?                        | Revisar N/G, distinguir límites software de dominio, aprobar/corregir tolerancias y empates; no tolerancia clínica inventada.                             |
| R09 | ¿Qué identificador, versión y variante/protocolo quedarán registrados?                         | Aprobar o sustituir propuesta; conservar significado de versión anterior y resultados históricos.                                                         |
| R10 | ¿Se limita el cálculo a evaluaciones nuevas y se excluyen masas derivadas del cierre original? | Decisión explícita de alcance. Si incluye historia existente o masas, aprobar diseño adicional sin sobrescritura.                                         |
| R11 | ¿Autoriza preparar la siguiente etapa y los cambios compartidos identificados?                 | Alcance de archivos y contrato autorizado; no implica migración, D0, publicación ni despliegue.                                                           |

Las respuestas pueden ser «aprobado», «requiere cambios» o «pendiente de evidencia»,
con justificación. Un «aprobado» general sin resolver R01–R08 no cierra el gate.

### Registro de decisión preparado, sin aprobación atribuida

| Campo                                                     | Estado                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| Revisor independiente e integrante responsable de dominio | Pendiente de designación/confirmación        |
| Fecha y herramienta de reproducción independiente         | No reportadas                                |
| Original femenino completo cotejado                       | Pendiente                                    |
| Protocolos, dominio y supuestos aceptados                 | Pendiente                                    |
| IDs de casos aceptados/rechazados y motivo                | Ninguno aprobado todavía                     |
| Tolerancias, versión, persistencia y alcance aceptados    | Pendiente                                    |
| Discrepancia S-01                                         | Conservada; exclusión propuesta, no aprobada |
| Dictamen Ready                                            | **Bloq**                                     |
| Revisión independiente D0 del producto                    | Pendiente; no hay implementación HU-023      |

### Qué avanzó y qué no

Se amplió el cotejo de Siri con facsímiles de pasajes sobre composición de
referencia, incertidumbre y restricciones. No se obtuvo un original femenino
legible ni evidencia para explicar S-01. Se revisó la clasificación de los 35
grupos de casos candidatos, conservando sus valores y su estado no aprobado.
No se implementó cálculo ni se actualizó un contrato o una política del producto.

**Siguiente paso recomendado:** el supervisor obtiene la copia femenina y designa
al revisor para responder R01–R10. Con sus observaciones resueltas, solicitar
autorización de implementación y de archivos compartidos. No declarar desbloqueo
por cerrar solamente la lectura de Siri. Mantener HU-023 Bloq y D0 pendiente.

### Verificaciones de esta etapa 1B

**T:** 9/9 filas numéricas nuevamente comprobadas como aritmética documental
(suma, edad, densidad, fracción, decimal y UI candidata); identificadores N01–N20
y G01–G06 conservados; 17 enlaces locales válidos; formato Prettier local y
LF/whitespace comprobados en los tres documentos. Escaneo de patrones de claves
privadas y conexiones PostgreSQL con credenciales sin hallazgos. Las verificaciones
no son pruebas del futuro motor ni reproducción independiente.

El inventario Git contiene exclusivamente los mismos tres Markdown sin seguimiento;
no hay cambios en archivos rastreados ni en el índice. HEAD y rama permanecen
iguales. Se cerró el lector temporal de páginas en memoria; no se guardaron
artículos/imágenes ni se dejaron procesos de investigación en ejecución. No hubo
pruebas de producto, instalaciones, consultas PostgreSQL, migraciones, staging,
commits o publicaciones. Solo se actualizaron los tres archivos autorizados.

## Etapa 2 — Decisiones aprobadas y contrato técnico mínimo propuesto

### A. Decisiones funcionales vigentes

La responsable aprobó expresamente en la petición de etapa 2:

1. Jackson–Pollock 3P + Siri según DEC-007, sin equiparar selección con aprobación
   científica definitiva.
2. Cálculo solo en evaluaciones nuevas elegibles que identifiquen protocolo aprobado.
3. No modificar ni recalcular evaluaciones históricas.
4. Mostrar resultado en el detalle de evaluación.
5. No modificar gráficas ni proyecciones de HU-022.
6. No calcular masas derivadas en HU-023. La aritmética existente de bioimpedancia
   de HU-021 tampoco se elimina ni cambia.
7. Distinguir grasa estimada de medida/informada.
8. Endpoints actuales exclusivamente profesionales; visibilidad al cliente futura
   mediante HU-036/DEC-009, sin conceder permisos nuevos en esta historia.
9. Mantener captura parcial aunque el cálculo no sea posible.
10. Conservar entradas y metadatos suficientes para reproducir el resultado histórico.

**R10 de etapa 1B queda resuelta** en cuanto a nuevas evaluaciones y exclusión de
masas. La ampliación de HU-022 y la implementación de visibilidad al cliente no
son decisiones pendientes de esta entrega: quedan fuera. R01–R08 conservan sus
pendientes científicos/independientes aplicables. R09 se concreta abajo como
propuesta técnica; R11 no constituye autorización para programar ni tocar archivos
compartidos.

### B. Extensión aditiva de la solicitud existente

Se reutiliza `POST /api/clients/{clientId}/evaluations`. No se propone otro endpoint
de cálculo, actualización de evaluaciones ni acción de recálculo.

En el DTO multimétodo se propone un campo **opcional**:

```text
estimationRequest?: {
  methodId: "jackson-pollock-3-siri",
  protocolId: string,
  protocolVersion: string
}
```

- Solo puede acompañar `method: "pliegues"`. `equation` conserva sus valores y
  significado actuales; no se añade un segundo selector de variante.
- Los tres campos del objeto son requeridos si se solicita estimación. No se
  admite objeto vacío, `null`, claves desconocidas ni referencias arbitrarias.
- `protocolId` y `protocolVersion` deben resolver una entrada aprobada en el
  registro inmutable del servidor y corresponder a la variante seleccionada
  cuando esta exista. Referencia desconocida/no aprobada o combinación estructural
  inválida: 400 `INVALID_EVALUATION`, con campo específico; sin escritura.
- **No hay en esta etapa un protocolo/versionado aprobado disponible para usar.**
  No se inventa un identificador científico ni se habilita el formulario para
  solicitarlo. El literal `methodId` es una propuesta de identificador técnico.
- El navegador no envía edad, nacimiento, propietario, fecha de creación,
  resultados, versión de fórmula ni política de dominio como autoridad.
- Sin `estimationRequest`, la ruta mantiene exactamente los contratos HU-021
  anteriores, incluido body heredado. Tener tres pliegues por sí solo no activa
  automáticamente HU-023.

El protocolo permite distinguir una captura nueva que solicita el cálculo de
una solicitud antigua reintentada o pendiente offline. No se deduce que una
captura siguió el protocolo aprobado solo por tener los mismos nombres de campos.

### C. Snapshot de respuesta y persistencia propuesto

Se conserva `assessment` como snapshot de la misma fila de
`private.client_evaluations`. Se propone una **segunda forma versionada**, sin
actualizar filas anteriores:

- Forma actual: `assessment.version = "composition-arithmetic-v1"`, sin
  `assessment.estimation`; interpretación y validaciones originales conservadas.
- Forma nueva: nombre técnico propuesto `"composition-estimation-v1"`, únicamente
  para solicitudes de estimación aceptadas; añade `assessment.estimation`.
- Ese nombre identifica el esquema/comportamiento del snapshot, **no** una fórmula
  ni un protocolo científicamente aprobados. No está aceptado por el SQL/API actual.
- `assessment.results` mantiene la semántica existente: no se introduce allí el
  porcentaje JP3 ni se renombra `bodyFatPercentage` de bioimpedancia.
- `assessment.protocol` identifica el protocolo registrado; en la forma nueva se
  propone serializar `protocolId + "@" + protocolVersion`, con identificadores sin
  `@`. La referencia estructurada autoritativa se conserva en `estimation.protocol`.

Contrato del objeto nuevo, generado **solo por backend**:

| Campo                 | Tipo propuesto                        | Significado/invariantes                                                                                                                                               |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`       | Literal `1`                           | Versión técnica del objeto, propuesta; no aprobación científica.                                                                                                      |
| `methodId`            | Literal `jackson-pollock-3-siri`      | Método compuesto seleccionado; no otra ecuación automática.                                                                                                           |
| `variant`             | `male`, `female` o `null`             | Derivada de `assessment.equation`; `not_applicable` produce `null`.                                                                                                   |
| `formulaVersion`      | `string` o `null`                     | Referencia inmutable de implementación/coeficientes y conversión Siri. Backend la asigna; nunca una etiqueta provisional presentada como aprobada.                    |
| `domainPolicyVersion` | `string` o `null`                     | Reglas de aplicabilidad efectivamente evaluadas. No inferirlas de la versión más reciente al leer historia.                                                           |
| `protocol`            | `{ id: string, version: string }`     | Referencia validada del protocolo de captura identificado en la solicitud.                                                                                            |
| `provenance`          | Literal propuesto `server_estimation` | Evaluación del cálculo realizada por backend sobre mediciones profesionales; no dato de dispositivo. En indisponibilidad no implica que exista un resultado numérico. |
| `inputs`              | Objeto descrito abajo                 | Entradas usadas o faltantes en el intento, sin completar desde valores actuales al consultar.                                                                         |
| `status`              | `available` o `unavailable`           | Unión discriminada; determina forma de resultado y motivos.                                                                                                           |
| `result`              | Objeto numérico o `null`              | Solo existe para `available`. No ceros de relleno ni resultados parciales utilizables.                                                                                |
| `reasons`             | Array de motivos                      | Vacío para `available`; al menos uno para `unavailable`.                                                                                                              |

`inputs` contiene:

| Campo           | Tipo y procedencia                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effectiveDate` | `YYYY-MM-DD`, idéntica a `assessment.effectiveDate`, resuelta en servidor.                                                                                                                           |
| `ageYears`      | Entero en años cumplidos o `null`, idéntico al snapshot de edad; no edad actual.                                                                                                                     |
| `unit`          | Literal `mm`.                                                                                                                                                                                        |
| `skinfolds`     | Objeto de campos existentes `*SkinfoldMm` y números finitos presentes: solo los sitios de la variante, con ausencias omitidas. Si no se selecciona variante, `{}`; no escoger sitios por inferencia. |

Los valores incluidos en `inputs.skinfolds` deben coincidir con los mismos campos
de `assessment.measurements`. Se conserva una copia explícita de las entradas del
intento dentro del mismo snapshot, no otra tabla histórica. Backend y restricciones
de persistencia deberán impedir inconsistencias entre ambas representaciones.
Nacimiento permanece en `assessment.birthDate`; no se exige duplicarlo aquí.

Para `available`, `result` contiene exclusivamente:

```text
{
  sumSkinfoldMm: number,
  bodyDensityGPerMl: number,
  estimatedBodyFatPercentage: number
}
```

Unidades: mm, g/ml y %, respectivamente. Requiere variante conocida, tres sitios,
edad y fecha válidas, protocolo/fórmula/dominio aprobados y versiones no nulas.
Densidad >0 y porcentaje estrictamente entre 0 y 100, además del dominio aprobado.
No se incluyen masas grasa/libre de grasa, clasificaciones ni diagnósticos.

Para `unavailable`, `result` es **`null` completo**: no se expone una densidad
intermedia que pueda confundirse con un cálculo aceptado. Las entradas se conservan.
`formulaVersion`/`domainPolicyVersion` pueden ser nulas si aún no existe definición
aprobada aplicable; un valor no nulo siempre referencia una definición real del
registro del servidor, no una versión ficticia.

Se reutilizan el ID de evaluación y `createdAt` de la fila; no se crea otra fecha
de evaluación ni se sustituye la fecha técnica por la efectiva. Fecha y resultado
se consultan desde el mismo registro. No se reevalúa elegibilidad al leerlo.

### D. Estados, motivos y comportamiento

Motivo propuesto: `{ code: EstimationReasonCode, fields: string[] }`. `fields`
usa únicamente rutas conocidas del contrato, no identificadores SQL ni información
de otros expedientes. Los textos visibles se mapean en español en Web.

| Código propuesto                  | Cuándo aplica                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `equation_not_selected`           | Selector `not_applicable`; no elegir otra variante.                                                                                                                               |
| `missing_measurements`            | Falta uno o más sitios requeridos; listar sus campos.                                                                                                                             |
| `age_unavailable`                 | No hay edad snapshot válida suficiente para el método.                                                                                                                            |
| `outside_approved_domain`         | Las entradas no cumplen la política aprobada aplicable. No se inventan rangos aquí.                                                                                               |
| `scientific_verification_pending` | Salvaguarda si el método no está habilitado por el gate, aun habiendo referencia de protocolo válida. Sin ejecutar fórmula. No sustituye aprobar el gate para liberar la función. |
| `non_finite_calculation`          | Un intermedio/resultado no es finito.                                                                                                                                             |
| `invalid_density`                 | Densidad ≤0.                                                                                                                                                                      |
| `invalid_estimated_percentage`    | Porcentaje ≤0 o ≥100.                                                                                                                                                             |

Reglas propuestas:

1. Se aplican primero validaciones estructurales y de captura HU-021: números,
   unidades, precisión y al menos una medición significativa, sin relajar reglas.
2. Se autentica y autoriza con el flujo vigente. Dentro de la transacción se
   resuelven cliente, fecha efectiva, nacimiento y edad. El motor puro recibe ese
   contexto; no consulta BD, sesión ni fecha actual por su cuenta.
3. Sin solicitud explícita, no se ejecuta el motor y se persiste la forma actual.
4. Con solicitud válida se evalúan gate, variante, entradas y dominio antes de
   ejecutar aritmética. Se devuelven motivos de precondiciones en orden estable;
   no calcular si falta alguna. Con variante conocida se pueden informar todos
   los sitios faltantes, sin sustituirlos por cero.
5. Una evaluación parcialmente capturada puede guardarse con respuesta **201** y
   estimación `unavailable`. Es éxito del registro, no éxito del cálculo. El UI
   debe distinguir ambos. No se exigen tres sitios para guardar HU-021.
6. Datos de captura inválidos, protocolo desconocido o solicitud malformada:
   400 `INVALID_EVALUATION` con `Error.fields` conforme al contrato existente.
   Autenticación, propiedad y errores de persistencia conservan su comportamiento;
   no se convierten en `unavailable`. Un fallo inesperado hace rollback, no éxito.
7. Para la forma nueva, `assessment.calculationStatus` se proyecta como `available`
   si la estimación está disponible; `partial` si no lo está, o
   `pending_verification` cuando ese sea el motivo. El detalle usa el objeto
   `estimation`, no deduce motivos de este estado general. Forma anterior intacta.
8. GET/listado/expediente serializan el resultado persistido y sus versiones sin
   llamar al motor. Editar perfil, reactivar o desplegar otra fórmula no altera
   evaluaciones anteriores. No hay endpoint ni proceso de recálculo.

La falta de selector en el DTO multimétodo continúa siendo error estructural;
`not_applicable` sigue siendo un selector válido para capturar. No confundirlos.

### E. Precisión propuesta y reproducibilidad

**Propuesta técnica pendiente de aceptación:** cálculo con `number` binario de
64 bits de JavaScript, operaciones/versiones deterministas y controles de finitud.
No `toFixed`, redondeo a escala fija ni truncamiento de suma/densidad/porcentaje
durante el cálculo o antes de persistir. Serialización JSON con representación
de ida/vuelta del valor `number`, almacenamiento JSONB sin imponer `numeric(4,1)`.
Esto conserva el valor computado, **no promete decimal matemático exacto**.

El registro inmutable de `formulaVersion` debe retener coeficientes cotejados,
conversión Siri, orden de operaciones y política numérica; `domainPolicyVersion`
y protocolo retienen reglas y sitios. Ninguna lectura utiliza implícitamente una
definición nueva para reinterpretar ese identificador histórico.

Solo la presentación HU-023 se propone con un decimal en español y redondeo al
más próximo, empates alejándose de cero para valores positivos (half-up). No
se cambian formateadores HU-021/HU-022. Las tolerancias de los casos candidatos
siguen **propuestas**, sujetas a reproducción independiente y aprobación; esta
elección técnica no las valida científicamente.

### F. Idempotencia y operaciones offline

- Se conservan ruta, `evaluation.create`, middleware, CSRF, almacenamiento cifrado,
  timeout y misma clave por intento. La solicitud incluye protocolo/versionado en
  su payload, por lo que un cambio de payload con la misma clave sigue el conflicto
  existente. No se aceptan resultados calculados por el navegador.
- Creación y snapshot del cálculo se confirman juntos. Un replay devuelve la
  respuesta original con sus valores/versiones, no calcula con el registro actual
  de fórmulas. Se respeta la vigencia de idempotencia existente; no se promete
  deduplicación eterna ni se modifica infraestructura global.
- Una operación antigua sin `estimationRequest` conserva su body y comportamiento,
  aunque se sincronice después del despliegue. No se le añade el objeto ni se
  reetiqueta su protocolo; tampoco se cambia una respuesta ya registrada.
- Una solicitud nueva con protocolo que no pueda aceptarse recibe error de
  validación, no un 503 transitorio inventado. No se reencola indefinidamente un
  protocolo inválido ni se borra una operación pendiente.
- Pendiente local no es resultado confirmado. La UI solo muestra estimación
  definitiva después de confirmación; el cálculo depende del backend al aceptar
  la operación y de su fecha efectiva resuelta, nunca de una edad inventada offline.
- Hasta completar gate y autorizaciones no se ofrece solicitud activa de HU-023.

### G. Persistencia incremental y OpenAPI, solo propuesta

Archivo SQL propuesto, **no creado**:
`docs/database/migrations/202611130001_evaluation_estimation_snapshots.sql`.
Antes de crearlo se deberá revalidar orden/identificador disponible en ese momento.

La migración ampliaría la restricción de snapshot por versiones: conservaría
íntegra la rama `composition-arithmetic-v1` y permitiría la forma nueva con
`estimation`. Validaría tipos, claves, referencias internas de fecha/edad/sitios,
unidades, estados mutuamente excluyentes, ausencia de números en indisponibilidad
y límites técnicos del resultado. No copiaría el polinomio clínico a SQL.
No añade otra tabla, no transforma filas, no toca columnas base, grants ni RLS.
La aritmética autoritativa sigue en API. Nunca editar las tres migraciones aplicadas.

OpenAPI propuesto: extensión de entrada con `estimationRequest`, rama adicional
de snapshot y esquemas `EstimationRequest`, `BodyFatEstimationSnapshot`,
`BodyFatEstimationAvailable`, `BodyFatEstimationUnavailable`,
`EstimationReason` e `EstimationInputs`. Los nombres son propuestas técnicas.
Usar `oneOf`/discriminación para impedir combinaciones de estado y resultado;
mantener intactas las ramas heredadas y la ausencia de `estimation` en ellas.
Documentar 201 con cálculo disponible/no disponible, 400 con campos y errores
existentes de sesión/propiedad/idempotencia. No añadir accesos del cliente ni
nuevas rutas. GET de evaluaciones y expediente incluyen el snapshot persistido;
`evaluation-history` y sus respuestas **no cambian**.

### H. Inventario mínimo futuro, sin autorización de modificación

Todas estas rutas son propuestas. En esta etapa se modifica únicamente este
documento. Archivos EP-04 reutilizados de HU-021 necesitarán autorización de
implementación; archivos transversales necesitan además autorización expresa
y coordinación. No se interpreta el contrato como permiso para editarlos.

| Ruta exacta                                                                 | Acción futura y motivo                                                                  | Clasificación                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/api/src/features/evaluations/types/estimation.ts`                     | Nuevo: solicitud, unión de resultados, entradas y motivos                               | Propio EP-04/HU-023                                                         |
| `apps/api/src/features/evaluations/domain/body-fat-estimation.ts`           | Nuevo: motor puro y definiciones inmutables aprobadas                                   | Propio EP-04/HU-023; fórmula bloqueada por gate                             |
| `apps/api/tests/body-fat-estimation.test.ts`                                | Nuevo: contrato y casos del motor una vez aprobados                                     | Propio EP-04/HU-023                                                         |
| `apps/api/src/features/evaluations/domain/assessment.ts`                    | Ampliar tipos/versiones sin cambiar aritmética anterior                                 | EP-04 compartido con HU-021                                                 |
| `apps/api/src/features/evaluations/validators/assessment.ts`                | Campo opt-in validado, preservando captura actual                                       | EP-04 compartido con HU-021                                                 |
| `apps/api/src/features/evaluations/services/evaluation.ts`                  | Coordinar la solicitud normalizada con persistencia existente                           | EP-04 compartido con HU-021                                                 |
| `apps/api/src/features/evaluations/repositories/evaluation.ts`              | Construir contexto confiable y persistir snapshot nuevo en la misma transacción         | EP-04 compartido con HU-021                                                 |
| `apps/api/tests/assessment.test.ts`                                         | Regresión de captura, opcionales y versión anterior                                     | EP-04/HU-021, cambio solo de pruebas                                        |
| `apps/api/tests/evaluations.test.ts`                                        | Alta/listado/idempotencia y contrato nuevo/antiguo                                      | EP-04/HU-021, cambio solo de pruebas                                        |
| `apps/web/src/features/evaluations/types/assessment.ts`                     | Tipos de solicitud/snapshot; conservar preview actual, sin implementar JP3 en navegador | EP-04 compartido con HU-021                                                 |
| `apps/web/src/features/evaluations/types/evaluation.ts`                     | Validación de ambas formas de respuesta y estados                                       | EP-04 compartido con HU-021                                                 |
| `apps/web/src/features/evaluations/components/AssessmentForm.tsx`           | Identificar protocolo de nueva solicitud y conservar guardado parcial/borradores        | EP-04 compartido con HU-021                                                 |
| `apps/web/src/features/evaluations/components/CompositionResults.tsx`       | Presentar estimación diferenciada, precisión UI y motivos, sin alterar bioimpedancia    | EP-04 compartido con HU-021                                                 |
| `apps/web/src/features/evaluations/components/EvaluationsSection.tsx`       | Mostrar resultado histórico, fecha/método/versión y advertencia no diagnóstica          | EP-04 compartido con HU-021                                                 |
| `apps/web/tests/estimation-web.test.mjs`                                    | Nuevo: detalle, contrato, parcial y estados sin duplicar formularios                    | Propio EP-04/HU-023                                                         |
| `docs/database/migrations/202611130001_evaluation_estimation_snapshots.sql` | Nueva migración incremental propuesta, sin ejecutarla                                   | Cambio SQL EP-04 en infraestructura compartida; autorización expresa        |
| `docs/database/schemas/identity_access.sql`                                 | Actualizar esquema integrado conforme a migración                                       | Compartido; autorización expresa                                            |
| `apps/api/tests/migrations.test.ts`                                         | Instalación limpia/actualización con snapshots anteriores                               | Arnés compartido; autorización expresa                                      |
| `apps/api/tests/client-read-isolation.test.ts`                              | Prueba física de persistencia y RLS reutilizando arnés                                  | Arnés compartido; autorización expresa y entorno físico separado autorizado |
| `docs/api/identity-lifecycle.openapi.json`                                  | Extensión aditiva coordinada                                                            | Contrato compartido; autorización expresa                                   |
| `docs/epicas/ep-04-antropometria/hu-023/README.md`                          | Estado/contrato y evidencia futura                                                      | Propio HU-023; no autorizado modificarlo en esta etapa                      |
| `docs/epicas/ep-04-antropometria/hu-023/casos-patron-candidatos.md`         | Registrar decisiones independientes cuando existan                                      | Propio HU-023; no autorizado modificarlo en esta etapa                      |
| `docs/epicas/ep-04-antropometria/hu-023/condiciones-desbloqueo.md`          | Contrato propuesto y decisiones aprobadas                                               | Único archivo autorizado ahora                                              |

No se prevén cambios en rutas/controladores principales, cartera, autenticación,
móvil, infraestructura offline, dependencias ni código de evolución HU-022.
Si el protocolo aprobado exige corregir la ayuda anatómica existente, habrá que
solicitar alcance para `AnatomicalGuide.tsx` antes de ofrecerlo: no se asume que
el SVG actual acredita la técnica. La necesidad exacta depende del cotejo pendiente.

### I. Verificación futura por capas

| Conjunto             | Comprobaciones requeridas, todavía no ejecutadas                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato puro        | Opt-in ausente/presente, desconocidos, protocolo/variante, ambas versiones, unión disponible/no disponible y rechazo de resultados del navegador                                                                     |
| Motor                | Casos aprobados, tres sitios correctos, edad efectiva, faltantes/null, dominio, no finitos, D y porcentaje inválidos, sin redondeo intermedio ni masas                                                               |
| Integración API      | 201 con disponible/no disponible; captura parcial antigua; listado/expediente leen sin invocar motor; errores de sesión/propiedad no se convierten en motivos                                                        |
| Idempotencia/offline | Replay preserva respuesta/versión, conflicto por payload distinto, doble envío, operaciones antiguas intactas y pendientes sin éxito ficticio                                                                        |
| SQL/migraciones      | Limpia y actualización con filas heredadas/v1; v2 coherente; rechazar estados/inputs/resultados incoherentes; demostrar que no se reescribió historia                                                                |
| RLS física           | Dos carteras, propietario/ajeno, cliente/admin no autorizados, lectura de inactivos y alta denegada según reglas actuales; sin UPDATE/DELETE nuevos                                                                  |
| Web                  | Etiqueta estimada frente a medida, método/fecha/versión, un decimal, advertencia no diagnóstica, motivo visible, formulario parcial, error/carga/pendiente                                                           |
| HU-021               | Repetir sus casos de captura/listado/historia y resultados de bioimpedancia; editar base/inactivar/reactivar sin modificar snapshots                                                                                 |
| HU-022               | Ejecutar `evolution.test.ts`, `evolution-api.test.ts` y `evolution-web.test.mjs` junto a suites seguras; mismos samples, métricas, fechas, filtros, cursores y gráfica después de nuevas evaluaciones con estimación |

No se añaden columnas/series a HU-022: su prueba debe demostrar que ignora
`estimation` y conserva mediciones reales, nunca que incorpora el porcentaje
estimado como `measuredBodyFatPercentage`. Pruebas físicas solo con autorización
adicional del arnés y PostgreSQL local aislado, nunca sobre datos existentes.

### J. Estado y siguientes autorizaciones

**Cerrado funcionalmente por la responsable:** alcance de nuevas evaluaciones,
detalle profesional, sin recálculo, gráficas, masas ni acceso del cliente.
**Propuesto técnicamente:** nombres de DTO/versiones, estados/motivos, precisión,
solicitud explícita, persistencia y lista de archivos de esta sección.

**Siguen bloqueantes científicos:** original femenino legible cotejado, aprobación
del dominio/restricciones/protocolos, reproducción independiente de casos y
aceptación de tolerancias/criterios científicos; revisión de S-01 según etapa 1B.
No existen versiones científicas aprobadas nuevas por redactar este contrato.

Después de aprobar el contrato y autorizar archivos, podrían prepararse tipos,
validaciones, ramas compatibles y pruebas estructurales **sin habilitar fórmula**.
Implementar/activar la aritmética clínica, asignar versiones científicas activas
o afirmar resultados válidos sigue bloqueado. No se solicita una nueva elección
del método ni se convierte su aprobación funcional en cotejo científico.

Preparar/aplicar migración, ejecutar pruebas físicas, publicar y completar D0
requieren sus autorizaciones/revisiones correspondientes. Esta etapa no ejecuta
ninguna de esas acciones. **HU-023 permanece Bloq**.

### K. Comprobaciones documentales de etapa 2

**T:** Prettier local aprobado para este archivo; ocho enlaces locales comprobados;
LF/whitespace y escaneo de patrones de secretos sin hallazgos; `git diff --check`
limpio. Se revisó también whitespace del archivo sin seguimiento, sin staging.
SHA-256 de `README.md` y `casos-patron-candidatos.md` idénticos al inicio de etapa 2:
no se alteraron sus valores ni evidencia. No se ejecutaron pruebas del producto,
instalaciones, búsquedas científicas, SQL ni operaciones de publicación.

Rama `feature/ep04-antropometria`, HEAD
`f26447f58a04afc144dc46913d501dc51e88b729`, índice vacío, sin cambios rastreados.
Permanecen exactamente los tres documentos previos sin seguimiento; en esta etapa
se modificó únicamente `condiciones-desbloqueo.md`. HU-021, HU-022 y demás módulos
sin modificaciones. Esperar autorización antes de programar.

## Etapa 5 — Integración de referencia técnica pendiente

### Autorización vigente y diferencia con un protocolo aprobado

La responsable autorizó expresamente reconocer una referencia técnica pendiente
definida por el servidor. Esta excepción reemplaza, exclusivamente para este
estado, la exigencia anterior de disponer de un protocolo científico aprobado.
No aprueba científicamente DEC-007, las ecuaciones candidatas ni sus casos patrón.

| Elemento              | Valor implementado                                  | Significado                                                             |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Solicitud opcional    | `estimationRequest`                                 | Solo en `pliegues`; omitirlo conserva el flujo anterior                 |
| Método                | `jackson-pollock-3-siri`                            | Método seleccionado funcionalmente, todavía deshabilitado               |
| Referencia reconocida | `protocolId: jp3-sites-pending`                     | Identificador técnico cerrado; no acredita sitios ni técnica científica |
| Versión de referencia | `protocolVersion: technical-reference-v1`           | Versión del contrato técnico, no de una fórmula aprobada                |
| Versión de snapshot   | `composition-estimation-v1`                         | Nueva forma aditiva; no transforma snapshots anteriores                 |
| Estado permitido      | `unavailable`                                       | Nunca `available` ni `candidate_only` en POST o persistencia nueva      |
| Resultado             | `null`                                              | Sin densidad, suma, porcentaje ni masas calculadas                      |
| Motivo único          | `scientific_verification_pending`                   | Lista de un elemento, `fields: []`                                      |
| Versiones científicas | `formulaVersion: null`, `domainPolicyVersion: null` | No existen autorizaciones científicas implícitas                        |
| Procedencia           | `server_estimation`                                 | Estado generado por servidor, sin afirmar que se haya calculado         |

Solicitud reconocida, siempre acompañada por al menos una medición propia de
pliegues según las validaciones anteriores:

```json
{
  "method": "pliegues",
  "equation": "male",
  "measurements": { "pectoralSkinfoldMm": 10.1 },
  "estimationRequest": {
    "methodId": "jackson-pollock-3-siri",
    "protocolId": "jp3-sites-pending",
    "protocolVersion": "technical-reference-v1"
  }
}
```

El servidor rechaza identificadores o versiones desconocidos, valores nulos de
solicitud, claves extra, `activationAllowed`, resultados enviados por el navegador
y el uso de esta solicitud en otros métodos: HTTP 400 `INVALID_EVALUATION`.
El parser preparatorio genérico sigue siendo estructural: el validador real de
POST aplica además la lista cerrada de referencias del servidor.

### Entradas, persistencia y compatibilidad

- Se reutilizan fecha efectiva, nacimiento y edad de la evaluación, obtenidos
  según HU-021. No se consulta la edad actual para interpretar el historial.
- En esta referencia pendiente no hay selección certificada de tres sitios:
  `inputs.skinfolds` conserva los pliegues presentes si existe variante seleccionada.
  Con `not_applicable`, la variante es `null` y esa copia es `{}`; las mediciones
  originales permanecen íntegramente en `assessment.measurements`.
- Se conserva `inputs.unit: mm`; peso y estatura no se copian como pliegues.
  No hay valores sustituidos por cero ni redondeos de resultados inexistentes.
- `pending-estimation.ts` construye solo metadatos y no importa el motor candidato.
  Las pruebas inspeccionan que ningún consumidor de producción importe ese motor.
- Sin `estimationRequest`, el snapshot sigue usando `composition-arithmetic-v1`
  y los payloads heredados/offline no adquieren campos nuevos. No hay recálculo
  ni cambios en gráficas, catálogo, proyecciones o rutas de HU-022.
- Se mantienen la transacción, propiedad, contexto RLS e idempotencia existentes.
  No se modifican roles, grants, políticas, autenticación ni visibilidad al cliente.

Migración preparada: `docs/database/migrations/202611130001_evaluation_estimation_snapshots.sql`,
posterior a `202611100001_evaluation_measurement_integrity.sql`.
Amplía el CHECK de versiones y agrega `ck_client_evaluations_pending_estimation`
con igualdad exacta del objeto permitido, coherente con entradas/fecha/edad del
snapshot. Mantiene las versiones previas, sin UPDATE, DELETE ni transformación
de filas. El esquema integrado contiene las mismas restricciones.

**No aplicada ni verificada físicamente en esta ejecución.** Antes de optar por
la nueva forma, el repositorio comprueba la presencia de su restricción. Si falta,
responde 503 `EVALUATION_UPGRADE_REQUIRED`; no devuelve éxito ni convierte el bloqueo
en una operación de conectividad para reintentar indefinidamente. Sigue siendo
posible registrar mediciones sin solicitar estimación. La comprobación de presencia
no sustituye la verificación de checksums por el migrador autorizado.

### Web y contrato público

La captura de pliegues ofrece una casilla opcional, inicialmente desmarcada, que
explica que solo solicita registrar el estado pendiente. Se preserva al cambiar
de método y únicamente se envía en pliegues. No activa el cálculo.
El detalle muestra «Grasa corporal estimada · no disponible», fecha, método,
motivo y advertencia no diagnóstica, sin porcentajes candidatos ni gráficos falsos.
Los resultados de bioimpedancia conservan su funcionamiento y se etiquetan como
grasa informada. No se cambia la navegación dentro del expediente.

OpenAPI añade `PendingEstimationRequest`, `PendingBodyFatEstimation` y la rama
condicional del snapshot, sin nuevas rutas ni cambios en contratos de otras épicas.
La igualdad entre entradas/metadatos del snapshot requiere validación adicional
del servidor/SQL y del consumidor; no se afirma que JSON Schema exprese esas
comparaciones dinámicas.

### Evidencia técnica de etapa 5

**T — Ejecutado con datos sintéticos, sin conexiones a PostgreSQL:**

```bash
cd apps/api
node --import tsx --test --test-concurrency=1 tests/pending-estimation-api.test.ts tests/estimation.test.ts tests/body-fat-estimation.test.ts tests/assessment.test.ts tests/evaluations.test.ts tests/evolution.test.ts tests/evolution-api.test.ts
cd ../web
node --test tests/estimation-web.test.mjs
npm test
```

- API: **74/74**, incluyendo 6 pruebas nuevas de HTTP/repositorio con dobles SQL,
  contratos, motor candidato aislado y regresiones puras de HU-021/HU-022.
  Los casos con todos los pliegues siguen produciendo exclusivamente `unavailable`.
  Referencias desconocidas y resultados/activaciones del navegador se rechazan.
  Replay idempotente no inserta de nuevo; payload diferente produce 422.
  Sesión/CSRF reales y RLS física **no** se demuestran con identidad/dobles inyectados.
- Web específica: **7/7**. Suite Web completa: **141/141**, incluidas regresiones
  del expediente, captura, sincronización, caché y evolución. La prueba de formulario
  comprueba la casilla desactivada por defecto y su conservación entre métodos.
  Hubo avisos de los servidores Vite de pruebas sobre HMR/escaneo de un módulo
  virtual PWA; no falló ninguna prueba y no se alteró la configuración global.
- Contrato: Ajv **8.20.0**, dialecto JSON Schema **2020-12** instalado en Web:
  **35 componentes compilados, 20 casos positivos/negativos aprobados,
  119 referencias resueltas, 26 operationId únicos**. No se instalaron dependencias.
  En esta comprobación no se afirmaron los formatos `date`, `date-time`, `uuid`
  y `email`; los calendarios/entradas se cubren en pruebas de validadores.
  No es una certificación integral del documento OpenAPI 3.1.
- Builds API y Web, lint Web y Prettier de los 19 archivos de implementación,
  pruebas nuevas/propias, contrato y documentación seleccionados: aprobados.
  Los dos archivos históricos de pruebas compartidas conservan su formato previo;
  se limitó su cambio al caso nuevo y a la inclusión de la migración.
  El build Web advierte de un paquete mayor a 500 kB; no bloqueó la compilación.
- `git diff --check` limpio. Escaneo de claves privadas, tokens conocidos y URLs
  con credenciales sin hallazgos; revisión del inventario sin `.env`, cachés,
  respaldos ni compilados candidatos. No sustituye una auditoría exhaustiva externa.

**E — Inspección estática:** cambios compartidos limitados a OpenAPI, esquema
integrado y pruebas de migración/aislamiento, exclusivamente para evaluaciones.
No hay cambios en políticas, grants, rutas, autenticación, HU-022 ni otras épicas.
Las migraciones anteriores no se modificaron. El motor candidato permanece aislado.
Se compararon las 29 migraciones previas con HEAD: idénticas. OpenAPI conserva
todos sus paths; solo cambian los dos esquemas de evaluaciones y se agregan los
dos esquemas pendientes. El inventario final contiene 12 archivos rastreados
modificados y 14 sin seguimiento (26 en total, incluidos los 8 previos de HU-023).
Índice vacío, misma rama y HEAD `f26447f58a04afc144dc46913d501dc51e88b729`.

**Pendiente:** pruebas físicas de instalación limpia/actualización/RLS. Se preparó
un caso en `client-read-isolation.test.ts` y se incluyó la nueva migración en la
prueba del migrador, pero no se ejecutaron. No hay `TEST_DATABASE_URL` configurada;
el arnés necesita preparación de recursos/permisos con alcance adicional verificado.
No se utilizó `DATABASE_URL` como alternativa ni se tocó ninguna base existente.
Antes de ejecutarlas deben verificarse conexión local, recursos, roles globales,
limpieza y autorización concreta. Tampoco se hizo una revisión visual real nueva.

### Bloqueos y siguiente paso

Continúan pendientes el cotejo femenino legible, dominio/restricciones aprobados,
reproducción independiente de casos patrón y tolerancias/criterios científicos.
La aritmética candidata no equivale a validación independiente y esta excepción
no desbloquea su activación. No se autoriza cálculo disponible, masas, recálculos
históricos ni acceso del cliente. D0 requiere revisión independiente.

La integración local es preparatoria: falta probar y aplicar la migración por el
procedimiento autorizado, verificar persistencia/RLS físicas y revisar visualmente
el nuevo estado. No hubo commits, push, PR, cambios de rama ni publicaciones.

## Etapa 6 — Diagnóstico PostgreSQL previo a escrituras

**T — Consultas SQL ejecutadas exclusivamente en modo de solo lectura.** Se usó
`default_transaction_read_only=on`, transacciones `BEGIN READ ONLY` y `ROLLBACK`.
No se ejecutaron migraciones, fixtures, CREATE, ALTER, DROP ni GRANT.

| Comprobación                    | Resultado real                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Servidor                        | `127.0.0.1:5433`, PostgreSQL **17.11 (Homebrew)**                                                    |
| Conexión de diagnóstico         | Rol local `yutzilsanchez`; administrador con superuser/CREATEDB/CREATEROLE; solo se usó para lectura |
| Runtime                         | `couchone_api` sin superuser, BYPASSRLS, CREATEDB ni CREATEROLE                                      |
| Bases visibles                  | `postgres`, `CouchOneFit_dev`, `CouchOneFit_test`; ninguna base temporal nueva                       |
| Base denominada de pruebas      | `CouchOneFit_test`, UTF8, 28 tablas en `private`                                                     |
| Datos preexistentes en esa base | **15 cuentas, 0 clientes, 0 evaluaciones**; no se consultaron identidades ni datos personales        |
| Procedencia de esas cuentas     | No verificada; el nombre de la base no acredita que todos sus datos sean sintéticos                  |
| Configuración de pruebas        | `TEST_DATABASE_URL` ausente tanto en el proceso como en `apps/api/.env`                              |
| Historial de pruebas            | **27 migraciones aplicadas**, sin divergencias de checksum entre LF/CRLF y los archivos locales      |
| Archivos SQL actuales           | **30 migraciones**                                                                                   |

La conexión de diagnóstico se indicó explícitamente por host, puerto, base y rol;
no se tomó `DATABASE_URL` como sustituto de `TEST_DATABASE_URL`. No se consultó ni
modificó el contenido de `CouchOneFit_dev`, PostgreSQL 16 ni Supabase.

Pendientes exclusivamente en la base de pruebas inspeccionada:

1. `202611090001_multimethod_evaluations.sql`.
2. `202611100001_evaluation_measurement_integrity.sql`.
3. `202611130001_evaluation_estimation_snapshots.sql`.

La base no tiene todavía `assessment` ni su restricción pendiente. Estos resultados
no describen el estado de desarrollo ni de ningún entorno compartido.
La lectura de catálogo confirmó RLS habilitada (sin FORCE) y dos políticas
existentes de SELECT/INSERT para `couchone_authentication`. No se ejecutaron
pruebas de acceso entre carteras: inspeccionar políticas no demuestra su resultado.

### Alcance de los arneses y bloqueo de fase B

| Arnés                                          | Recursos y operaciones previstas                                                                                                                                                                                                    | Límite identificado                                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/tests/migrations.test.ts`            | Cuatro bases nuevas `CouchOneFit_{migration,schema,legacy,evaluation_upgrade}_test_<hex>` y un rol nuevo `cof_migration_<hex>`; migrador oficial, SQL integrado, fixtures, ALTER de historial para comprobar checksums y DROP final | Ejecuta también sentencias de creación/renombrado de roles técnicos y GRANT de membresías globales de las migraciones históricas; no quedan aisladas solo por elegir otra base |
| `apps/api/tests/client-read-isolation.test.ts` | Una base y rol nuevos `cof_read_<hex>`, esquema integrado, sesiones/fixtures sintéticos, DML/DDL de inyección de fallos y limpieza final                                                                                            | El esquema incluye administración global de roles y GRANT de registration a authentication; requiere adaptar o autorizar ese alcance antes de ejecutarlo                       |
| `apps/api/tests/evolution-postgres.test.ts`    | Una base/rol nuevos `cof_hu022_<hex>`, conexión de preparación separada, omisión en memoria de dos bloques de roles y una membresía global; limpieza por nombre/OID y comparación final de roles existentes                         | Es una alternativa de aislamiento ya documentada para HU-022; no prueba por sí sola la cadena completa de migraciones ni los casos nuevos de HU-023                            |

Los roles técnicos ingleses y los dos roles históricos españoles ya existen en
el clúster. Se observaron las membresías registration → authentication y
authentication → runtime, y la pareja histórica española. No se alteraron.
No se asumió que un GRANT sobre un rol preexistente queda autorizado por ser
idempotente ni que esos recursos pertenecen exclusivamente a una base temporal.

**Fase B no ejecutada.** Para continuar se recomienda preparar y autorizar un
arnés HU-023 confinado a bases/roles nuevos, con verificación de no existencia,
identificación por OID, fixtures sintéticos y limpieza incluso ante fallos. Debe
resolver expresamente los bloques globales del migrador histórico sin editar
migraciones originales ni cambiar roles compartidos. La estrategia de omisión
en memoria del arnés HU-022 sirve como precedente para el esquema integrado;
la instalación de toda la cadena requiere acordar su aislamiento adicional.
No se migrará ni vaciará la base preexistente para sortear este bloqueo.

### Defecto de prueba corregido y verificación local

Se corrigieron únicamente dos expectativas de `apps/api/tests/migrations.test.ts`:
el total después de instalar/actualizar debe ser **30**, no 29, por la nueva
migración de HU-023. No se eliminaron aserciones ni se cambió ninguna migración,
política, contrato o funcionalidad HU-021/HU-022. El defecto se confirmó por
enumeración de los 30 archivos y lectura de la prueba; la suite física sigue
sin ejecutar y esta corrección no acredita su aprobación.
Comprobación estática ejecutada: 30 archivos y dos expectativas actualizadas,
transpilación sintáctica TypeScript de la prueba sin errores, Prettier del documento
y `git diff --check` aprobados. No se ejecutó el build como sustituto de una prueba
física ni se cambió comportamiento funcional.

En esta etapa no se repitieron los 74/74 de API, 141/141 Web ni las validaciones
de etapa 5: conservan su fecha/contexto anterior. Las lecturas SQL y los checksums
son evidencia física de diagnóstico; **no** son pruebas físicas aprobadas de
registro, historial, idempotencia o RLS. No hubo revisión visual nueva ni D0.

### Comandos de continuación, todavía condicionados

Diagnóstico de solo lectura, sin secretos:

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql -X -w -h 127.0.0.1 -p 5433 -d postgres -c 'SELECT inet_server_addr(), inet_server_port(), current_database(), current_user, version();'
```

Los comandos de suites existentes son los siguientes, pero **no deben ejecutarse
hasta resolver/autorizar los recursos y los bloques globales anteriores**, con una
`TEST_DATABASE_URL` de preparación local explícita y verificada:

```bash
cd apps/api
node --import tsx --test --test-concurrency=1 tests/migrations.test.ts
node --import tsx --test --test-concurrency=1 tests/client-read-isolation.test.ts
```

El migrador consume `DATABASE_URL`, no `TEST_DATABASE_URL`; solo un arnés revisado
debe asignar al proceso hijo el destino temporal recién creado. Nunca heredar la
URL runtime ni apuntar a una base preexistente con datos para estas pruebas.

**Estado:** coherencia de la integración pendiente de verificación física, cálculo
todavía deshabilitado, bloqueos científicos y D0 intactos; sin publicación.

## Extensión autorizada — Cálculos candidatos exclusivamente locales

Esta decisión sustituye únicamente la prohibición de ejecutar/visualizar candidatos.
No aprueba científicamente DEC-007 ni autoriza uso clínico, resultados `available`,
acceso del cliente, masas derivadas o recálculo histórico.

### Variantes, protocolos y estados

| Caso                               | Protocolo / versión                               | Comportamiento                                                                                                    |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Referencia pendiente anterior      | `jp3-sites-pending` / `technical-reference-v1`    | Sin motor; `unavailable`, `result: null`, motivo científico pendiente                                             |
| Candidato masculino local          | `jp3-male-candidate` / `technical-candidate-v1`   | Pecho/pectoral, abdomen y muslo; edad efectiva provisional 18–61                                                  |
| Candidato femenino local           | `jp3-female-candidate` / `technical-candidate-v1` | Tríceps, suprailiaco y muslo; edad efectiva provisional 18–55; cotejo original pendiente y cautela >40 conservada |
| Resultado científicamente aprobado | Ninguno registrado                                | No habilitado ni aceptado en respuestas o snapshots nuevos de HU-023                                              |

Se reutiliza el motor existente sin cambiar sus coeficientes, guardas ni aritmética.
El adaptador `domain/candidate-estimation.ts` es el único consumidor de producción
que puede llamarlo. Solo calcula ante solicitud explícita con referencia cerrada,
variante compatible, fecha de nacimiento/efectiva y tres sitios válidos.
La captura parcial sigue disponible. Datos insuficientes o fuera del intervalo
provisional conservan mediciones y producen `unavailable` con motivo, nunca cero.
Los límites 18–61/18–55 son una autorización técnica provisional, no un dominio
clínico aprobado. No se completa ningún pliegue desde otros sitios o desde el perfil.

La nueva versión `composition-candidate-v1` conserva:

- `status: candidate_only` únicamente cuando hubo aritmética candidata válida;
  `result` contiene suma, densidad g/mL y porcentaje, sin redondeo intermedio.
- `technicalFormulaVersion: jp3-siri-arithmetic-candidate-v1` y
  `technicalDomainVersion: jp3-reference-ranges-candidate-v1`.
- `formulaVersion: null`, `domainPolicyVersion: null`,
  `scientificStatus: not_validated` y `activationAllowed: false`.
  Este último campo se refiere a activación científica/clínica, no a ejecutar una
  prueba técnica autorizada. No se acepta ninguna bandera de aprobación del navegador.
- Variante, protocolo técnico, fecha, edad efectiva, procedencia del servidor,
  tres entradas utilizadas y bloqueos científicos explícitos. En indisponibilidad
  se conservan las entradas capturadas pertinentes; no se inventa resultado.

La migración **aún preparada y no aplicada por estas ejecuciones**
`202611130001_evaluation_estimation_snapshots.sql` se amplió, junto al esquema
integrado, para distinguir los tres formatos. Añade el CHECK candidato sin cambiar
filas, roles, políticas ni grants. No se editó ninguna migración histórica aplicada.
El CHECK rechaza aprobación/activación ficticias, status disponible, metadatos
incompatibles, variantes/sitios/edades inválidos y resultados fuera de sus guardas
estructurales. El cálculo autoritativo permanece en API; SQL no duplica las fórmulas.

### Habilitación del servidor, apagada por defecto

Deben cumplirse **todas** estas condiciones:

1. `HU023_LOCAL_CANDIDATES_ENABLED=true`, literal exacto, en el entorno del servidor.
2. `NODE_ENV=development` o `NODE_ENV=test`, explícito. Producción y valor ausente
   quedan bloqueados aunque la bandera esté encendida.
3. `DATABASE_URL` debe señalar loopback (`127.0.0.1`, `localhost` o `::1`) y
   una base identificada distinta de `postgres`. No hay puerto fijo de HU-023:
   se toma el puerto efectivo de la URI, su parámetro `port`, `PGPORT` o el
   predeterminado de `pg`, siguiendo la precedencia del controlador.
4. Antes de calcular, SQL comprueba la conexión real: dirección loopback, puerto
   efectivo y nombre de base coincidentes con la configuración. Se rechazan
   puertos inválidos y overrides de host remoto; no se abre conexión desde el gate.
5. Debe existir la restricción nueva `ck_client_evaluations_candidate_estimation`;
   si falta, HTTP 503 `EVALUATION_UPGRADE_REQUIRED`, sin éxito ficticio ni cola infinita.

No se modifican `.env`, configuración global ni dependencias. La configuración
local verificada de API sigue siendo responsabilidad de quien la inicia.
Cuando la habilitación se apaga, las lecturas de candidatos se redactan a
`unavailable` y `result: null`; los registros persistidos permanecen intactos.
El middleware propio de evaluaciones se instala **antes** de idempotencia para
aplicar esa protección también al replay de una confirmación antigua. Se conserva
el ID, la evaluación y la clave; no se inserta otro registro ni se reescribe la fila.
Los clientes antiguos y operaciones offline sin solicitud mantienen su formato.
Una operación candidata sincronizada con habilitación apagada confirma únicamente
su estado no disponible, sin afirmar que se calculó.

### Web y uso local

Se conserva Clientes → Expediente → Evaluación y el mismo formulario amplio.
En desarrollo servido por loopback aparece una solicitud candidata separada de la
casilla pendiente; ambas son mutuamente excluyentes y comienzan desmarcadas.
Es necesario seleccionar una variante para marcar la candidata. La interfaz no
sustituye la habilitación del servidor ni calcula un porcentaje autoritativo.

El detalle y la confirmación muestran «Grasa corporal estimada — resultado candidato
para pruebas», porcentaje con **un decimal**, método, fecha, versiones técnicas,
suma y densidad almacenadas. La advertencia indica que no está validado
científicamente ni constituye diagnóstico; la variante femenina muestra su cotejo
pendiente y la cautela >40 cuando corresponde. Los bundles de producción y las
vistas fuera de loopback no dibujan números candidatos. Nunca se convierten en
`measuredBodyFatPercentage` ni en resultados de bioimpedancia/HU-022.

Para iniciar API local, **solo después de aplicar la migración mediante una
operación aparte autorizada**, y teniendo ya configurada una conexión runtime local:

```bash
NODE_ENV=development HU023_LOCAL_CANDIDATES_ENABLED=true npm --prefix apps/api run dev
npm --prefix apps/web run dev
```

Abrir `http://127.0.0.1:5000`, iniciar sesión profesional, seleccionar el cliente
sintético de QA y entrar a Evaluación. Elegir pliegues, variante y solicitud candidata.
La edad procede del nacimiento real del fixture a la fecha efectiva; no de un campo
editable de edad. Capturar los tres sitios, guardar y revisar el detalle. No usar
expedientes reales para estas pruebas. Reiniciar API sin la bandera desactiva los
cálculos y la visualización numérica en respuestas, sin tocar la historia guardada.

### Archivos y alcance de esta extensión

- Nuevos: `apps/api/src/features/evaluations/domain/candidate-estimation.ts` y
  `controllers/candidate-visibility.ts` dentro de la misma feature.
- API: tipos de estimación/assessment, validador de entrada, repositorio y router
  de evaluaciones. El motor solo cambia su comentario de integración; aritmética
  intacta. No se modificó autenticación ni el middleware global de idempotencia.
- Web: tipos/guardas de evaluaciones, formulario y detalle de estimación; se pasa
  el snapshot al detalle existente. No hay cambios en gráfica, tabla o API de HU-022.
- Compartidos imprescindibles: OpenAPI y esquema integrado, solo para snapshots
  de evaluaciones. La migración preparada y sus pruebas conservan RLS y permisos.
- Se amplían las pruebas específicas API/Web y el caso físico ya preparado de
  aislamiento; no se crea ningún arnés, base ni rol y no se ejecuta SQL.

Los bloqueos científicos, la persistencia física y D0 siguen pendientes. Este
avance completa el flujo **técnico candidato**, sin declarar la HU científicamente
aprobada ni apta para producción. Las verificaciones concretas de esta extensión
se registran a continuación al ejecutarse; no reutilizan cifras históricas como
si fueran una ejecución nueva.

### Evidencia de la extensión candidata

**T — Ejecutado en esta extensión, sin acceso a PostgreSQL:**

- API: **79/79**, con el comando seguro de etapa 5 (los mismos siete archivos).
  Incluye cinco pruebas nuevas: bandera apagada/entornos, candidatos masculino y
  femenino, restricciones/faltantes/target remoto, producción/replay redactado y
  rechazos de protocolo/forja/migración ausente. Las 18 pruebas del motor conservan
  su carácter aritmético candidato, no de aprobación científica independiente.
- Web: **143/143**; subconjunto HU-023 **9/9**, incluido envío del formulario con
  HTTP simulado, solicitud candidata explícita, confirmación visible y prevención
  de doble envío. Pruebas de ambas variantes, una cifra decimal, versiones, cautela
  femenina, rechazo de aprobación falsa y ocultamiento fuera de loopback.
- Regresiones HU-021/HU-022: aprobadas dentro de las suites anteriores. No se
  cambiaron sus gráficas, tablas, catálogo o resultados históricos. Una primera
  ejecución Web falló por el texto del aviso esperado por HU-021; se corrigió el
  mensaje del producto, sin reducir cobertura ni cambiar esa aserción, y la suite
  completa posterior aprobó 143/143. La guía anatómica aclara el uso candidato sin
  modificar sus coordenadas ni presentar el dibujo como protocolo certificado.
- Builds API/Web y lint Web: aprobados. El build conserva el aviso de tamaño de
  bundle >500 kB; los arneses Web emiten avisos HMR/escaneo del módulo virtual PWA,
  sin fallos en la ejecución final. No se alteró infraestructura para ocultarlos.
- Ajv 8.20.0 / JSON Schema 2020-12 instalado: **37 componentes compilados,
  38 casos positivos/negativos, 123 referencias resueltas y 26 operationId únicos**.
  La prueba cubre solicitudes antiguas/pendientes/candidatas, referencias y variantes,
  respuestas candidatas/no disponibles y aprobación/activación/números inválidos.
  No se afirmaron formatos ni una certificación integral de OpenAPI 3.1.

**E — Revisión estática:** los 29 archivos SQL anteriores siguen idénticos a HEAD;
solo se ajustó la migración nueva aún preparada. No cambian paths de OpenAPI,
permisos, RLS, autenticación, móvil ni otras épicas. El inventario contiene **14
rastreados modificados y 16 sin seguimiento (30 total)**, incluidos trabajos de
etapas anteriores. No se encontraron patrones de claves privadas, tokens vivos o
URLs con credenciales en candidatos; `.env`, `.vite`, compilados y respaldos no
aparecen entre ellos. Este escaneo no sustituye revisión externa.

**Pendiente:** pruebas físicas SQL/migrador/RLS, aplicación autorizada de la
migración y revisión visual manual real del flujo nuevo. Se amplió el caso físico
existente en `client-read-isolation.test.ts` para candidatos y forjas, pero **no se
lo ejecutó** ni se prepararon bases, roles o arneses nuevos. La política provisional
permite pruebas candidatas; continúan pendientes cotejo femenino, validación de
protocolo/dominio, casos patrón independientes y tolerancias, aceptación humana y D0.

La responsable autorizó añadir exclusivamente `HU023_LOCAL_CANDIDATES_ENABLED=false`
y un comentario de uso candidato local/no aprobación científica en
`apps/api/.env.example`, conforme a AGENTS.md. La plantilla queda actualizada;
no se modifican sus otras opciones ni ningún `.env` real. La ausencia de la bandera
mantiene el servidor apagado por defecto. No hubo commits, staging, push, PR ni
cambios de rama.

## Revisión final — Plantilla y puerto configurable

La responsable autorizó la modificación acotada de `apps/api/.env.example`.
Se añadieron únicamente la bandera apagada `HU023_LOCAL_CANDIDATES_ENABLED=false`
y un comentario que limita su uso a candidatos locales sin aprobación científica.
No se modificó ningún `.env` real ni otra opción de la plantilla.

Se confirmó y eliminó la dependencia fija de 5433 en las dos comprobaciones de
`domain/candidate-estimation.ts`. El puerto efectivo sigue la configuración normal
que consume `pg`: parámetro `port` de la URI, puerto explícito de la URI, `PGPORT`
y finalmente `pg.defaults.port`. El gate no abre ninguna conexión. Sigue exigiendo
loopback y una base identificada distinta de `postgres`; rechaza puertos inválidos
y parámetros de host remoto. La comprobación contra la conexión real conserva la
igualdad de puerto y base. No se eliminó la verificación de dirección local.

Permanecen las demás condiciones: opt-in del servidor apagado por defecto,
`NODE_ENV` explícitamente development/test, producción bloqueada aunque la bandera
esté encendida, solicitud válida por variante y ninguna bandera de activación del
navegador. Las respuestas —incluido replay idempotente— redactan números cuando
se apaga la habilitación, sin modificar snapshots ni duplicar evaluaciones.

**E — Revisión funcional:** mismos sitios masculinos (pectoral/pecho, abdomen,
muslo) y femeninos (tríceps, suprailiaco, muslo); edad cumplida a la fecha efectiva,
aritmética sin redondeos intermedios y porcentaje presentado con un decimal.
Se mantienen etiquetas y versiones técnicas candidatas, advertencias científicas,
captura parcial y compatibilidad de solicitudes antiguas/offline. No se cambió el
motor, Web, migraciones, RLS, HU-021 ni HU-022 en esta revisión.

**T — Verificaciones de esta revisión:**

- Suite API segura: **81/81**, incluidos cálculos, validadores, HU-021/HU-022 y
  nuevos casos de puerto configurable. Se simulan URI, puerto omitido, PGPORT,
  parámetro de puerto, IPv6, discrepancias reales/configuradas y puertos inválidos;
  no son conexiones físicas a esos puertos. Se prueba desarrollo habilitado,
  ausencia/desactivación de bandera, producción y replay/lectura sin valores
  candidatos cuando se apaga. Dos pruebas nuevas respecto de los 79 casos previos.
- Suite Web completa: **143/143**, sin modificar sus pruebas ni componentes.
- Builds API/Web y lint Web: aprobados. Permanecen los avisos no bloqueantes del
  build por bundle >500 kB y de los servidores Vite/HMR/escaneo de PWA en pruebas.
- OpenAPI: descripción alineada con puerto configurable; JSON analizable,
  **123 referencias resueltas y 26 operationId únicos**. No se repite ni atribuye
  aquí una certificación integral OpenAPI; los 38 casos 2020-12 anteriores siguen
  siendo evidencia histórica de los esquemas, cuya estructura no se cambió.

No se ejecutaron pruebas físicas PostgreSQL, migraciones, creación de recursos ni
operaciones SQL. Persistencia/RLS reales, revisión visual nueva, evidencia científica
independiente y D0 siguen pendientes; no se presentan como aprobados por compilar.
La implementación candidata queda preparada para revisión de código y propuesta de
commits, conservando explícitos esos pendientes antes de aceptación/producción.
