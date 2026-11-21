# HU-023 — Verificación científica

**Documento 1 de 3 · EP-04 · Responsable: Pukzil · Etapas 1 y 1B documentales.**

> **Decisión de producto — 20-nov-2026 (R: Angel Fernando Oñate Reyes, en
> sesión con agente).** Jackson–Pollock 3 pliegues + Siri pasa a **resultado
> oficial** en todos los entornos, para hombre y mujer, sustituyendo el bloqueo
> científico de este documento. El API lo deriva **al leer** cada evaluación de
> pliegues (`skinfoldResults`, versión `composition-skinfold-v1`,
> `jp3-siri-v1`) con los pliegues, la ecuación y la fecha de nacimiento ya
> guardados; no reescribe filas ni requiere migración, por lo que las capturas
> anteriores con ecuación elegida también lo muestran. Se conservan las guardas
> técnicas: sin ecuación, sin uno de los tres sitios, sin fecha de nacimiento o
> fuera de 18–61 (H) / 18–55 (M) no se calcula y la Web explica el motivo; en
> mujeres mayores de 40 se muestra aviso de cautela. El resultado alimenta la
> gráfica de evolución, el perfil del expediente, el asistente nutricional y el
> progreso del cliente móvil. **Riesgo aceptado:** la ecuación femenina sigue sin
> cotejo con el artículo original (ver abajo) y no hubo revisión científica
> independiente. El texto siguiente se conserva como antecedente histórico.

**Estado anterior: implementación técnica candidata existente, sin aprobación
científica ni D0.** El cálculo local está desactivado por defecto y requiere
habilitación explícita del servidor; producción permanece bloqueada. No se
recalculan evaluaciones anteriores. La captura parcial y el historial de HU-021/022
se conservan. La [guía técnica y evidencia](condiciones-desbloqueo.md) distingue
referencia pendiente, resultado candidato y resultado aprobado aún no habilitado.

Se ejecutaron pruebas automáticas de API y Web, builds y lint; los resultados se
registran en la guía y en el cierre de esta revisión al final de este documento.
**Persistencia PostgreSQL/RLS físicas, revisión visual del flujo candidato nuevo,
validación científica independiente y revisión independiente D0 siguen pendientes.**
La implementación candidata no declara cerrados esos requisitos de aceptación.

**Antecedentes de las etapas documentales 1 y 1B:** consulta de fuentes realizada
el 13-nov-2026. Rama `feature/ep04-antropometria`, HEAD de
partida `f26447f58a04afc144dc46913d501dc51e88b729`; árbol e índice inicialmente
limpios en etapa 1. En etapa 1B se conservan y actualizan únicamente esos tres
documentos, todavía sin seguimiento en Git; no se crean archivos adicionales.

- [Casos patrón candidatos](casos-patron-candidatos.md).
- [Condiciones de desbloqueo y decisiones](condiciones-desbloqueo.md).
- [HU-023, DEC-006/007 y D0](../../../../plan/PLAN_TRABAJO_V2.md).
- [RDF0504](../../../requirements/sistema-interno.md).
- [HU-021 y ampliación multimétodo](../hu-021/multimethod.md).
- [HU-022](../hu-022/README.md).

## Alcance, reglas y evidencia

Como profesional, obtener una estimación reproducible para complementar una
evaluación con un cálculo identificable. DEC-007 **elige** Jackson–Pollock de tres
pliegues + Siri; no declara cotejadas todas las ecuaciones. §3.4 prevalece sobre
las propuestas archivadas de §3.5. HU-023 no bloquea la captura manual de HU-021.

Se leyeron `AGENTS.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, los apartados
aplicables del plan y documentos de HU-021/022. Codebase Memory MCP no está
disponible: se usaron lectura directa y búsquedas. La autorización original de esas etapas limitaba
las escrituras a esta carpeta; no autorizaba cambios compartidos, API, Web o BD.

Convención: **T** = herramienta ejecutada; **E** = inspección estática;
**R** = reporte humano. Las secciones científicas siguientes conservan consultas
documentales T e inspección E de las etapas 1/1B; no constituyen aprobación humana
de casos ni revisión independiente. No se reescribe esa evidencia histórica.

## Fuentes y calidad del cotejo

### JP-M-1978 — Fuente primaria masculina

Jackson AS, Pollock ML. _Generalized equations for predicting body density of
men_. British Journal of Nutrition. 1978;40(3):497–504.
DOI: `10.1079/BJN19780152`; PMID: `718832`.

[Artículo completo del editor, ocho páginas](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/EAB21B1CF3A8360E5F5D43FDB8D4DD17/S0007114578000689a.pdf/div-class-title-generalized-equations-for-predicting-body-density-of-men-div.pdf).

Cotejo T del texto completo: p. 501, tabla 4, ecuación 5 y nota de variables;
p. 498, métodos; pp. 503–504, discusión. Define suma de pecho, abdomen y muslo
en mm, edad en años y densidad en g/ml. Estudió 403 hombres de 18–61 años:
308 para desarrollo y 95 para validación. No demuestra aplicación universal a
poblaciones diferentes. La técnica anatómica remite a otras referencias; este
documento no añade orientación ni localización de sitios no cotejadas.

### JP-F-1980 — Cotejo numérico pendiente

Jackson AS, Pollock ML, Ward A. _Generalized equations for predicting body
density of women_. Medicine & Science in Sports & Exercise. 1980;12(3).
DOI: `10.1249/00005768-198023000-00009`; PMID: `7402053`.

- [Registro bibliográfico](https://pubmed.ncbi.nlm.nih.gov/7402053/).
- [Editor original](https://journals.lww.com/acsm-msse/abstract/1980/23000/generalized_equations_for_predicting_body_density.9.aspx): el acceso consultado devolvió 402; no se sorteó la restricción.
- [Ficha que reproduce el abstract del editor](https://www.tandfonline.com/servlet/linkout?type=Scholix&url=https%3A%2F%2Fdx.doi.org%2F10.1249%252F00005768-198023000-00009): informa pp. 175–182, población de 18–55 y cautela para mayores de 40. **Abstract: insuficiente para verificar ecuaciones**.
- [Copia de ocho páginas alojada por un tercero](https://www.scribd.com/document/652192263/jackson1980-pdf): el OCR accesible de la tabla 4 está deteriorado; no permite cotejar cada dígito. Su existencia no acredita el gate.

**Pendiente:** original completo legible y cotejo visual de la tabla de
ecuaciones, sitios, unidades, población y limitaciones. La localización candidata
es tabla 4, alrededor de p. 178 según el OCR; no se certifica la página exacta ni
el número de ecuación. Hay citas con final 181 y ficha editorial con 182: resolver
la paginación con una copia legible, sin cambiar coeficientes por ese desacuerdo.

### S-1961 — Original localizado; cotejo puntual de ecuación

Siri WE. _Body composition from fluid spaces and density: analysis of methods_.
En: Brožek J, Henschel A, eds. _Techniques for Measuring Body Composition_.
Washington, DC: National Academy of Sciences–National Research Council;
1961:223–244. DOI del libro: `10.17226/21603`.

- [Libro original del editor](https://www.nationalacademies.org/publications/21603).
- [Sección que contiene el capítulo completo, pp. 223–244](https://www.nationalacademies.org/read/21603/chapter/5).
- [Facsímil editorial de p. 230](https://nap.nationalacademies.org/books/21603/gif/230.gif).

Se cotejó **visualmente** p. 230, ecuación (10), directamente en el facsímil del
editor, leído en memoria sin guardar imágenes. Expresa fracción grasa con
densidad en gm/cc y referencias de 1,1 para cuerpo libre de grasa y 0,90 para
grasa. Multiplicar la fracción por 100 da el porcentaje. Esto confirma constantes
y signo de esa ecuación; **no equivale a una revisión integral de todo el capítulo
ni a aprobar su dominio clínico**. Queda pendiente esa revisión independiente.

Contradicción numérica comprobada: el ejemplo de esa página publica 21,5 % para
`d = 1.050`, pero la ecuación impresa produce `150/7 = 21.428571… %`, es decir
21,4 % a un decimal. No se determinó la causa. No ajustar coeficientes ni convertir
ese ejemplo en un patrón exacto; ver S-01 en el documento de casos.

### S-1956 y reimpresión de 1993 — Documentos distintos

[Siri, informe UCRL-3349, 19-mar-1956](https://escholarship.org/uc/item/6mh9f4nf)
es un informe anterior: **no es la edición de 1961**.

[Reimpresión de 1993, con declaración de permiso y referencia de 1961](https://rminucleardocs.icaad.ngo/en/entity/uv2k8rp9c0f?file=1610604223371e9ln0x9csni.pdf&page=1)
se localizó como apoyo; conserva páginas originales. Su OCR tampoco debe usarse
para resolver signos dudosos. No se atribuye al original la introducción añadida
en 1993 ni se presenta esta reimpresión como publicación de 1956.

## Ecuaciones y matriz de trazabilidad

`S`: suma de los **tres** pliegues de la ecuación; `A`: edad en años cumplidos a
fecha efectiva; `D`: densidad corporal en g/ml, equivalente a g/cm³.

| Elemento                                             | Expresión o regla                                 | Fuente y localización               | Estado                                          |
| ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| Intercepto masculino                                 | `1.10938`                                         | JP-M-1978, p. 501, tabla 4, ec. 5   | Cotejado                                        |
| Coeficiente lineal masculino                         | `−0.0008267 × S`                                  | Misma ecuación                      | Cotejado                                        |
| Coeficiente cuadrático masculino                     | `+0.0000016 × S²`                                 | Misma ecuación                      | Cotejado                                        |
| Coeficiente de edad masculino                        | `−0.0002574 × A`                                  | Misma ecuación                      | Cotejado                                        |
| Sitios/unidades masculinos                           | Pecho + abdomen + muslo; mm, años                 | Nota de tabla 4; métodos p. 498     | Cotejado; protocolo detallado pendiente         |
| Población masculina estudiada                        | 18–61; no extensión automática                    | Métodos y discusión de JP-M-1978    | Cotejado; elegibilidad de producto por aprobar  |
| Intercepto femenino candidato                        | `1.0994921`                                       | Plan §3.5, transcripción archivada  | **No cotejado con original**                    |
| Coeficiente lineal femenino candidato                | `−0.0009929 × S`                                  | Mismo archivo histórico             | **No cotejado con original**                    |
| Coeficiente cuadrático femenino candidato            | `+0.0000023 × S²`                                 | Mismo archivo histórico             | **No cotejado con original**                    |
| Coeficiente de edad femenino candidato               | `−0.0001392 × A`                                  | Mismo archivo histórico             | **No cotejado con original**                    |
| Sitios femeninos candidatos                          | Tríceps + suprailiaco + muslo                     | DEC-006; cotejo JP-F-1980 pendiente | Pendiente                                       |
| Población/cautela femenina                           | 18–55; cautela >40                                | DEC-007 y abstract editorial        | Falta original legible y política de aplicación |
| Siri, fracción                                       | `f = 4.950 / D − 4.500`                           | S-1961, p. 230, ec. 10              | Cotejo puntual en original                      |
| Siri, porcentaje                                     | `100 × f = 495 / D − 450`                         | Conversión algebraica de ec. 10     | Derivación matemática explícita                 |
| Referencias de densidad de Siri                      | Cuerpo libre de grasa 1,1; grasa 0,90 gm/cc       | S-1961, p. 230, antes de ec. 10     | Cotejadas; supuestos, no datos personales       |
| Supuestos y restricciones completos de Siri          | Revisar constancia de composición e incertidumbre | S-1961, capítulo pp. 223–244        | Revisión integral pendiente                     |
| Pliegues 1–80, paso 0,1 mm                           | Límites de captura                                | DEC-006 vigente                     | **Decisión software**, no dominio científico    |
| No resultado con faltantes/no finitos/D≤0/%≤0 o ≥100 | Guardas técnicas                                  | DEC-007 §3.4                        | Aprobadas en repositorio                        |
| No redondeo intermedio; un decimal solo UI           | Presentación separada de cómputo                  | DEC-007 y DoD HU-023                | Aprobado; persistencia exacta por concretar     |
| Versión, entradas y resultado inmutables             | No recalcular historia                            | DEC-007 y HU-023                    | Aprobado                                        |

Ecuación masculina cotejada:

```text
D = 1.10938 − 0.0008267·S + 0.0000016·S² − 0.0002574·A
```

Ecuación femenina **solo candidata**, conservada aquí para revisión de la
transcripción existente; no se declara verificada ni se autoriza su ejecución:

```text
D = 1.0994921 − 0.0009929·S + 0.0000023·S² − 0.0001392·A
```

## Separación entre dominio científico y decisiones del producto

- Población del SaaS ≥16 (DEC-006/017) no autoriza extrapolar JP3 a 16–17 años.
- La edad máxima de una muestra no certifica por sí sola todos los sujetos dentro
  del intervalo. Falta aprobar la política de poblaciones no cubiertas, incluida
  la cautela femenina; no se inventan exclusiones clínicas particulares.
- El selector `male`/`female` es específico de ecuación, no identidad de género
  inferida del perfil. `not_applicable` no selecciona una fórmula alternativa.
- Las guardas 0–100 % de DEC-007 no son umbrales diagnósticos. El rango 2–60 % de
  **grasa medida** no se traslada automáticamente al resultado estimado.
- Peso/estatura no son entradas de la ecuación masculina cotejada. No hacerlos
  obligatorios para calcular porcentaje. Masas derivadas requieren decisión aparte.
- No confundir precisión computacional, precisión de captura y exactitud clínica.
- No se cambia el bloqueo vigente de uso clínico real referido por DEC-007/015.

## Balance de etapa 1 — evidencia previa

**T:** consulta de fuentes originales y copias identificadas; lectura visual de
Siri p. 230; aritmética documental Decimal/Fraction de los casos, sin importar el
código de CouchOneFit. **E:** contraste de plan, snapshots y restricciones
actuales. No se ejecutaron suites API/Web/PostgreSQL porque no hubo cambio de
producto. La fórmula femenina, los casos oficiales y la revisión independiente
siguen pendientes. No se actualiza el estado del plan ni se habilita cálculo.

## Etapa 1B — Cierre documental y preparación de revisión

### Resultado de la búsqueda femenina

Se repitió la consulta editorial: **402, acceso restringido**. La consulta del
agregador ScienceOpen devolvió 403; no se interpretó como acceso al artículo. Se
buscaron copias por título/autores en dominios académicos, bibliotecas y páginas
de autores. Los resultados disponibles remiten a referencias, abstracts u otros
trabajos; no se obtuvo una nueva copia completa y legible de JP-F-1980. No se
intentó sortear el acceso editorial ni se usó el OCR deteriorado para confirmar
coeficientes. La ecuación femenina y su localizador exacto permanecen pendientes.

El supervisor/revisor necesita obtener una copia legítima mediante biblioteca,
préstamo interbibliotecario o autor/editor usando el DOI/PMID anteriores. Debe
ser legible en **todas sus páginas**, especialmente métodos, tabla 4 y discusión.
Una reproducción de la fórmula en un manual o un estudio posterior no sustituye
este cotejo. La paginación 175–181/182 tampoco se cierra por contar citas.

### Siri 1961: supuestos y restricciones cotejados en etapa 1B

Se leyeron visualmente los facsímiles editoriales de las páginas 226, 228, 229,
231, 232 y 233. No se guardaron imágenes ni se utilizó el OCR como prueba única.
Se conserva el cotejo previo de p. 230/ec. (10). Alcance: pasajes relevantes de
la conversión densitométrica; **no se declara leído íntegramente el capítulo
223–244 ni revisados todos sus modelos o apéndices**.

| Evidencia                 | Localizador original verificable                                                                                                          | Alcance del hallazgo                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Composición de referencia | [p. 226](https://nap.nationalacademies.org/books/21603/gif/226.gif) y [p. 229](https://nap.nationalacademies.org/books/21603/gif/229.gif) | Supone relaciones constantes de agua, proteína y mineral; no demuestra identidad entre todos los adultos.          |
| Incertidumbre             | [p. 228](https://nap.nationalacademies.org/books/21603/gif/228.gif) y [p. 231](https://nap.nationalacademies.org/books/21603/gif/231.gif) | Distingue variabilidad biológica de error experimental; precisión numérica no equivale a exactitud de composición. |
| Restricción explícita     | [p. 232, cuarto punto](https://nap.nationalacademies.org/books/21603/gif/232.gif)                                                         | El original considera inválido el método ante hidratación anormal.                                                 |
| Comparación longitudinal  | [p. 232, quinto punto](https://nap.nationalacademies.org/books/21603/gif/232.gif)                                                         | Densidad por sí sola no identifica qué tejido se ganó o perdió si intervienen varios tejidos.                      |
| Otro modelo               | [p. 233](https://nap.nationalacademies.org/books/21603/gif/233.gif)                                                                       | El apartado de agua corporal es distinto; no autoriza sustituir la conversión elegida.                             |

Estas restricciones necesitan una política de aplicación revisada; no se añaden
preguntas clínicas, diagnósticos, campos ni contraindicaciones inventadas. El
porcentaje es una estimación bajo supuestos, no una medición directa.

**S-01 permanece abierto:** no se encontró evidencia que explique o corrija el
ejemplo impreso de 21,5 %. No se cambian constantes ni se atribuye la diferencia a
redondeo. Se propone al revisor conservar la ecuación cotejada y excluir ese
ejemplo de los oráculos numéricos; la decisión queda pendiente. No es necesario
inventar una errata ni descubrir su causa para documentar la inconsistencia.

### Paquete disponible

Los tres documentos forman un único paquete: este README identifica fuentes y
coeficientes; el documento de casos conserva entradas/resultados y añade una
clasificación de evidencia; condiciones de desbloqueo contiene la agenda de
preguntas y el registro de decisión que debe completar otro integrante. No se
solicitó ni atribuyó aprobación a ninguna persona. **HU-023 sigue Bloq**.

## Corrección de hallazgos previa a commits

**Implementación local:** `equation` exige una cadena antes del enumerado; arrays,
objetos y demás tipos incorrectos producen `INVALID_EVALUATION` sin llegar a la
persistencia de la evaluación. Se conservan `male`, `female` y `not_applicable`.
No cambian autorización, límites antropométricos ni fórmulas.

Al cambiar de una solicitud candidata marcada a «No aplica», el formulario la
desmarca y anuncia que no se realizará la estimación, manteniendo las mediciones.
Volver a una ecuación válida permite marcarla de nuevo explícitamente. El guardado
con «No aplica» no envía `estimationRequest`; no se cambia el historial de HU-022.

**T — Ejecutado después de estas correcciones:**

- Regresiones específicas API: **2/2**, para tipos sin coerción y HTTP 400 antes de
  insertar evaluaciones; controles positivos de captura válida conservados.
- Regresión específica Web: **1/1**, para cancelación de solicitud, aviso accesible,
  preservación de campos, reselección y envío final sin solicitud candidata inválida.
- Suite API segura: **83/83**, incluidos motor candidato y regresiones pertinentes
  HU-021/HU-022. HTTP y repositorio usan dobles SQL; no acreditan persistencia ni RLS
  reales. Comando desde `apps/api`:

  ```bash
  node --import tsx --test --test-concurrency=1 tests/pending-estimation-api.test.ts tests/body-fat-estimation.test.ts tests/estimation.test.ts tests/assessment.test.ts tests/evaluations.test.ts tests/evolution.test.ts tests/evolution-api.test.ts
  ```

- Suite Web completa: **144/144** mediante `npm --prefix apps/web test`.
- Builds API y Web, lint Web y Prettier de los cinco archivos tocados: aprobados.
  Se mantienen avisos no bloqueantes de Vite/HMR/escaneo PWA y bundle >500 kB.
- `git diff --check` limpio. No se modificó la evidencia científica anterior.

No se ejecutó PostgreSQL, migraciones ni preparación de infraestructura. No hay
revisión visual nueva ni aprobación científica o D0. La implementación técnica
candidata queda preparada para revisión y autorización separada de commits,
conservando los pendientes de persistencia física y aceptación independiente.

## Publicación para revisión: aceptación del riesgo residual

**R — Autorización expresa de la persona usuaria:** publicar los cuatro commits
locales de HU-023 y un commit documental en `feature/ep04-antropometria`, aceptando
el riesgo residual de automatizaciones externas no verificadas. Esta autorización
no permite modificar servicios externos, ejecutar migraciones, activar candidatos
en producción ni crear un PR. Este registro documenta la autorización; no acredita
que el push o un despliegue se hayan ejecutado.

**E — Hechos confirmados en archivos versionados:**

- La [documentación de despliegue](../../../architecture/despliegue.md) identifica
  la API productiva en Render y la Web en Vercel, y documenta auto-deploy desde Git.
- El [rewrite Web](../../../../apps/web/vercel.json) dirige `/api` hacia
  `https://api.ferkxo.tech/api/:path*`, sin separar Preview de Production.
- El cálculo candidato de HU-023 permanece desactivado por defecto y bloqueado
  en producción; la aceptación de este riesgo no cambia esos controles.

**Riesgos posibles, no ejecuciones confirmadas:** no se han verificado las ramas,
reglas de despliegue, variables ni comandos efectivos en los paneles externos.
Un push a `feature/ep04-antropometria` podría activar despliegues u otras
automatizaciones externas. Un preview Vercel podría dirigir solicitudes a la API
productiva por el rewrite `/api`, dependiendo de su configuración efectiva y de
`VITE_API_URL`. Crear un preview no demuestra por sí solo una escritura de datos;
utilizarlo podría enviar solicitudes a producción sujetas a sus controles.
No se afirma que los servicios estén seguros ni que haya ocurrido un despliegue.

**Verificaciones pendientes antes de habilitar HU-023 para usuarios reales:**

- Revisar en Render la rama conectada, Auto-Deploy y comandos de build,
  pre-deploy y arranque; en Vercel, la rama productiva, reglas de previews y
  destino efectivo de `/api`.
- Comprobar variables de entorno por entorno, manteniendo deshabilitados los
  candidatos en producción; revisar integraciones y webhooks externos.
- Verificar la migración incremental, persistencia física, restricciones, RLS,
  autorización y compatibilidad antes de cualquier aplicación compartida.
- Completar validaciones científicas, revisión visual y revisión independiente
  D0 documentadas en esta guía y en [condiciones de desbloqueo](condiciones-desbloqueo.md).

Publicar código para revisión no constituye aprobación científica de HU-023,
aceptación D0, autorización de despliegue ni permiso para habilitarlo a usuarios
reales. Se acepta la incertidumbre sobre efectos automáticos del push; no se
autoriza un despliegue manual ni se certifica la configuración externa.
