# Validación local de HU-023

## Arranque de `feature/ep04-antropometria` — 14 de noviembre de 2026

- **T** PostgreSQL 18.6 devolvió `22P02` al evaluar la expresión original de la restricción `ck_client_evaluations_candidate_estimation`. Agrupar la extracción de `result` antes de restar las claves resolvió el error. La migración y el esquema integrado usan la misma expresión corregida.
- **T** `tests/migrations.test.ts` pasó en PostgreSQL local. Verifica instalación limpia, equivalencia con el esquema integrado y actualización desde una versión con evaluaciones existentes.
- **T** El migrador aplicó las cuatro migraciones de antropometría pendientes en `CouchOneFit_dev`. Las compilaciones de API y Web terminaron correctamente.
- **T** La pantalla de acceso cargó en el navegador en `http://127.0.0.1:5173/acceso`. El proxy de Vite devolvió HTTP 200 para `/api/health` y `/api/plans`.

Queda pendiente la comprobación del flujo autenticado de evaluación en el navegador.

## Evolución del cálculo candidato

- **T:** se comprobó el recorrido autenticado con datos sintéticos, evaluaciones fechadas, registros recuperados y series independientes para candidatos y grasa medida. Evidencia en [validación HU-022](../hu-022/validacion-local.md).
- **T:** PostgreSQL 18.6 verificó la instalación limpia y la actualización que preserva una evaluación anterior. Se mantuvo la corrección local de agrupación JSONB. La prueba de catálogos ahora compara los permisos del esquema en orden estable y conserva las diferencias reales de permisos.
- **T:** la suite física comprobó porcentaje candidato persistido, replay idempotente, ausencia con pliegues incompletos y redacción al deshabilitar candidatos o pasar a producción.
- **E:** DEC-007 conserva el bloqueo de producción y la revisión independiente. Se consultó la ficha del [artículo de Jackson, Pollock y Ward](https://pubmed.ncbi.nlm.nih.gov/7402053/) y no se obtuvo el original completo desde el DOI editorial en esta revisión.

## Textos de publicación y cotejo de las ecuaciones

- **E.** La ecuación masculina implementada coincide con la tabla 4, ecuación 5, del [original de Jackson y Pollock (1978)](https://doi.org/10.1079/BJN19780152). La tabla 8 del [informe del NCHS](https://www.cdc.gov/nchs/data/misc/assessphacc.pdf) reproduce los cuatro coeficientes y los sitios en milímetros de la variante femenina implementada, con referencia a Pollock, Schmidt y Jackson (1980). La sección de métodos del [estudio TIGER](https://doi.org/10.1017/S0007114508047764) confirma los sitios de ambas variantes y la conversión de Siri. Su comparación frente a DXA encontró diferencias según el grupo estudiado. El [original femenino](https://pubmed.ncbi.nlm.nih.gov/7402053/) sigue pendiente de cotejo en texto completo. La revisión independiente del protocolo y del dominio prevista en DEC-007 permanece pendiente.
- **E.** Fuera del entorno de desarrollo, la captura Web muestra un aviso breve de indisponibilidad al elegir pliegues y conserva el guardado de mediciones. Los resultados que solo pueden consultarse en desarrollo se identifican como preliminares. Los identificadores de protocolo y versión se conservan en los detalles de la evaluación. El servidor y sus restricciones de publicación conservan el comportamiento anterior.
- **T.** Chrome con la compilación de producción y respuestas sintéticas verificó el aviso en Pliegues y el campo de grasa en Bioimpedancia. Suite Web 146/146 y pruebas de aritmética y API con dobles 33/33. Compilación Web, lint y formato de los archivos modificados aprobados.

## Pliegues requeridos al solicitar la estimación

- **E.** Si el profesional activa «Calcular grasa corporal estimada», el formulario exige pecho, abdomen y muslo para la ecuación masculina, o tríceps, suprailiaco y muslo para la femenina. Peso, estatura y pliegues que la ecuación no utiliza son opcionales. Al guardar sin estimación sigue disponible la captura parcial.
- **T.** La regresión Web verifica las dos selecciones de ecuación, impide enviar la solicitud con un pliegue requerido vacío y permite guardar tras completarlo. Al elegir «No aplica», desaparece la obligatoriedad y se conservan los valores.

## Activación oficial de JP3 + Siri — 20 de noviembre de 2026

Decisión de producto registrada en el [README de HU-023](README.md) (**R**: la persona usuaria eligió «activarlo oficial» y «calcular al mostrar» las históricas).

- **E.** API: `skinfoldResults` deriva `% grasa`, masa grasa/libre, suma de pliegues y densidad al leer cada evaluación de pliegues; `mapEvaluation` entrega `composition-skinfold-v1` sin `estimation` y no reescribe filas. Evolución reutiliza `candidateBodyFat` (versiones `jp3-siri-v1`/`jp3-reference-ranges-v1`) y el progreso móvil del cliente recibe el valor a un decimal. La fecha efectiva por omisión usa la zona horaria del cliente en lugar de UTC.
- **E.** Web: el formulario ofrece siempre la ecuación en Pliegues, marca sus tres sitios como obligatorios, previsualiza el resultado con la edad a la fecha de medición y explica faltantes, edad fuera de 18–61/18–55 o ausencia de fecha de nacimiento; aviso de cautela en mujeres mayores de 40. Se eliminaron las casillas de candidato y `EstimationDetails`.
- **T.** `npm --prefix apps/api run build` sin errores. Suite API completa contra `127.0.0.1/CouchOneFit_test`: **245 de 246**; persiste solo el fallo previo de `session-lifecycle.test.ts`. Se añadió una regresión del cálculo (S = 60 mm, 30 años → 17,945 %) y una prueba de la vista oficial con replay idempotente sin reescribir el snapshot.
- **T.** Web: `build`, `lint` (0 avisos), Prettier de archivos tocados y `npm test` **159 de 159**.
- **T.** Navegador integrado (Web `127.0.0.1:5000`, API `:3000`, BD local de desarrollo, cuenta QA): una evaluación de pliegues masculina (12/18/15 mm, 36 años) mostró 14,3 % en la vista previa y el servidor confirmó 14,3 %, masa libre 66,2 kg y densidad 1,0662 g/mL; el expediente muestra «Grasa corporal actual» y el asistente nutricional la precarga con su origen.
- **Pendiente.** La columna `evaluation_date` (fecha de registro) conserva su DEFAULT UTC y el rol de runtime no puede escribirla; corregirla requiere una migración. Revisión científica independiente y cotejo del original femenino siguen sin hacerse (riesgo aceptado). No hubo QA humana (**R**) ni prueba en dispositivo Android.
