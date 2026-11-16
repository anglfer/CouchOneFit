# HU-023 — Casos patrón candidatos

**Documento 2 de 3 · No aprobados · No fixtures de producción ni pruebas ejecutadas
del producto.** [Fuentes y límites](README.md) ·
[Decisiones y desbloqueo](condiciones-desbloqueo.md).

## Método de preparación y límites de independencia

Los números siguientes son **cálculos documentales candidatos**, no resultados
del motor actual. Se calcularon en una ejecución efímera de Python estándar,
`decimal.Decimal` con 60 dígitos, desde literales decimales; se contrastaron con
`fractions.Fraction` racional exacto. No se creó un script persistente ni se
importó API/Web, conectó PostgreSQL o habilitó JP3.

El acuerdo Decimal/Fraction detecta errores de aritmética o transcripción del
ejercicio, pero **ambos cálculos fueron preparados por el mismo agente**. No son
validación independiente del método, de sus coeficientes ni de su dominio.

Fuente independiente del resultado de cada caso M/F: **ninguna todavía**.
Se requiere que otro integrante compruebe entradas y fórmulas contra los originales
y reproduzca los valores con una herramienta distinta elegida por él, conservando
su evidencia. Una calculadora comercial sin fórmula/versionado no cierra el gate.
El ejemplo publicado de Siri se analiza por separado por su discrepancia.

## Convenciones de la matriz

- Todos los datos son sintéticos y **solo están en esta documentación**.
- Fecha efectiva común: **2026-11-13**. La fecha técnica de creación no se simula.
- Edad en años cumplidos calculada desde el nacimiento de cada fila.
- M: orden de entradas **pectoral, abdominal, muslo**, todos en mm.
- F: orden candidato **tríceps, suprailiaco, muslo**, todos en mm; original pendiente.
- `S = p1 + p2 + p3`; se aplica la ecuación de [Documento 1](README.md), después
  `495/D − 450`. F es **condicional a coeficientes todavía no cotejados**.
- Peso, estatura y otros pliegues ausentes; no se inventan ni participan.
- Los puntos suspensivos indican decimal periódico/no terminado, no truncamiento
  durante el cálculo. La fracción de la tabla siguiente define el valor exacto.
- UI candidata: un decimal, redondeo decimal `ROUND_HALF_UP`. Un decimal está
  aprobado; la regla de empates propuesta aún necesita aprobación. Ninguna fila
  de esta matriz decide un empate exacto.

## Casos numéricos candidatos

| ID  | Ecuación               | Nacimiento | Edad | Tres entradas mm   | S mm |      D g/ml | 495/D − 450, % candidato | UI candidata % |
| --- | ---------------------- | ---------- | ---: | ------------------ | ---: | ----------: | -----------------------: | -------------: |
| M01 | JP3 masculina          | 1996-11-13 |   30 | 10 / 15 / 20       |   45 |   1.0676965 |   13.614894307511544713… |           13.6 |
| M02 | JP3 masculina          | 2008-11-13 |   18 | 10 / 10 / 10       |   30 |   1.0813858 |    7.745977430071672847… |            7.7 |
| M03 | JP3 masculina          | 1965-11-13 |   61 | 10 / 20 / 30       |   60 |   1.0498366 |   21.501946112375964030… |           21.5 |
| M04 | JP3 masculina          | 1991-11-13 |   35 | 10.1 / 15.2 / 20.3 | 45.6 | 1.066000456 |   14.352521815431568633… |           14.4 |
| F01 | JP3 femenina candidata | 1996-11-13 |   30 | 20 / 15 / 25       |   60 |   1.0440221 |   24.127894419093235670… |           24.1 |
| F02 | JP3 femenina candidata | 2008-11-13 |   18 | 10 / 15 / 20       |   45 |   1.0569635 |   18.322699885095369896… |           18.3 |
| F03 | JP3 femenina candidata | 1986-11-13 |   40 | 20 / 20 / 20       |   60 |   1.0426301 |   24.760895546752390900… |           24.8 |
| F04 | JP3 femenina candidata | 1985-11-13 |   41 | 20 / 20 / 20       |   60 |   1.0424909 |   24.824288634078244711… |           24.8 |
| F05 | JP3 femenina candidata | 1971-11-13 |   55 | 20 / 20 / 20       |   60 |   1.0405421 |   25.713572761736406436… |           25.7 |

**Estado de todas las filas: pendiente de aprobación independiente.** M02/M03
exploran edades extremas estudiadas, no certifican elegibilidad individual.
F04/F05 no autorizan cálculo para mayores de 40; su resultado aritmético no decide
la política de aplicación ni supera el bloqueo de la fuente femenina.

### Resultado exacto y tolerancia propuesta

| Caso | Porcentaje como fracción exacta del ejercicio | Tolerancia propuesta de D | Tolerancia propuesta del porcentaje |
| ---- | --------------------------------------------- | ------------------------- | ----------------------------------- |
| M01  | 29073150 / 2135393                            | Absoluta ≤ 1e-12 g/ml     | Absoluta ≤ 1e-9 puntos porcentuales |
| M02  | 3807450 / 491539                              | Igual                     | Igual                               |
| M03  | 112867650 / 5249183                           | Igual                     | Igual                               |
| M04  | 1912474350 / 133250057                        | Igual                     | Igual                               |
| F01  | 22900050 / 949111                             | Igual, condicional        | Igual, condicional                  |
| F02  | 38732850 / 2113927                            | Igual, condicional        | Igual, condicional                  |
| F03  | 258164550 / 10426301                          | Igual, condicional        | Igual, condicional                  |
| F04  | 23526450 / 947719                             | Igual, condicional        | Igual, condicional                  |
| F05  | 267560550 / 10405421                          | Igual, condicional        | Igual, condicional                  |

Estas tolerancias son propuestas para regresión **computacional**, no exactitud
clínica. La representación decimal almacenada debe fijarse antes de convertirlas
en aserciones de persistencia. Para UI, comparación exacta del texto esperado
después de aprobar formato/empates y separador localizado.

### Desarrollo reproducible M01

```text
Fecha efectiva = 2026-11-13; nacimiento = 1996-11-13; edad = 30
S = 10 + 15 + 20 = 45 mm; S² = 2025 mm²
D = 1.10938 − 0.0372015 + 0.00324 − 0.007722 = 1.0676965 g/ml
Porcentaje = 495 / 1.0676965 − 450 = 29073150 / 2135393
           = 13.614894307511544713315066594299… %
UI candidata = 13.6 %
```

Para reproducir cada fila con calculadora de precisión suficiente, introducir
primero el polinomio completo con los coeficientes del Documento 1 y **sin**
redondear D; después dividir 495 por ese valor y restar 450. Comparar con la
fracción exacta. La comprobación independiente deberá transcribir los coeficientes
directamente de la fuente, no copiarlos de esta matriz.

## S-01 — Contraste con un ejemplo publicado, no patrón aprobado

Fuente independiente: Siri 1961, p. 230, ejemplo después de ec. (10),
[facsímil original](https://nap.nationalacademies.org/books/21603/gif/230.gif).

- Entrada de la conversión aislada: `D = 1.050 g/ml`.
- El ejemplo no proporciona fecha efectiva, edad ni sitios: **no aplica**; no
  inventarlos. Tampoco es una evaluación JP3 completa.
- Esperado **publicado**: 21,5 %.
- Resultado de la ecuación impresa con esa entrada exacta: `150/7 %`,
  `21.428571428571… %`; UI candidata 21,4 %.
- Diferencia: aproximadamente 0,0714285714 puntos porcentuales. Causa pendiente:
  no se atribuye a redondeo, errata u otro motivo sin evidencia adicional.
- **No hay tolerancia aprobada que reconcilie el ejemplo.** No ampliar la
  tolerancia de 1e-9 para ocultarlo ni modificar la fórmula para obtener 21,5.
- Estado: evidencia de discrepancia; requiere revisión independiente antes de
  considerar este ejemplo como referencia numérica.

## Casos negativos y de indisponibilidad candidatos

Salvo indicación, tomar fecha/nacimiento/ecuación/entradas de M01. No se ejecutó
el futuro motor ni se probaron respuestas HTTP. `—` significa **no calcular**,
no cero. Los nombres de motivos son semánticos; no son códigos de DTO aprobados.

| ID  | Cambio respecto de M01 / entrada de prueba        | S / D / Siri / UI esperados                                   | Regla y estado                                                                                                         |
| --- | ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| N01 | Omitir pectoral                                   | — / — / — / —                                                 | Falta sitio obligatorio del cálculo; DEC-006/007. Captura parcial HU-021 sigue siendo válida.                          |
| N02 | Abdominal `null`                                  | — / — / — / —                                                 | Ausencia, nunca cero; DEC-006/007.                                                                                     |
| N03 | Los tres sitios ausentes o `null`                 | — / — / — / —                                                 | No inventar una suma cero ni resultado. La validez de la evaluación se decide por HU-021.                              |
| N04 | Pectoral 0                                        | — / — / — / —                                                 | Rechazo de captura por límite 1 mm.                                                                                    |
| N05 | Pectoral −1                                       | — / — / — / —                                                 | Rechazo de captura.                                                                                                    |
| N06 | Pectoral 0.9 o 80.1                               | — / — / — / —                                                 | Fuera de DEC-006; probar cada valor por separado.                                                                      |
| N07 | Pectoral 10.25                                    | — / — / — / —                                                 | Más de un decimal; no redondear para aceptarlo.                                                                        |
| N08 | Pectoral 1.0 o 80.0                               | Evaluar dominio antes de calcular                             | Fronteras de captura válidas; no equivalen a fronteras científicas. Resultado completo pendiente del dominio aprobado. |
| N09 | Pectoral NaN o Infinity                           | — / — / — / —                                                 | Guarda pura; estos valores no son números JSON válidos.                                                                |
| N10 | Selector `not_applicable` o falta selector        | — / — / — / —                                                 | No elegir ecuación por inferencia. El DTO actual ya exige selector; futura semántica de no cálculo por aprobar.        |
| N11 | Nacimiento/edad no disponibles                    | — / — / — / —                                                 | No usar edad de ejemplo, perfil actual ni año aproximado.                                                              |
| N12 | Nacimiento 2009-11-13, edad 17                    | — / — / — / — propuesto                                       | Fuera del intervalo masculino estudiado; no extrapolar. Política de producto pendiente.                                |
| N13 | Nacimiento 1964-11-13, edad 62                    | — / — / — / — propuesto                                       | Igual, extremo superior masculino.                                                                                     |
| N14 | Nacimiento 1996-11-14: edad 29 el día efectivo    | Usar 29; resultado numérico por reproducir independientemente | Prueba de cumpleaños; no restar solo años de calendario.                                                               |
| N15 | Fecha efectiva anterior a nacimiento              | — / — / — / —                                                 | Fecha no corresponde al cliente; no fabricar edad.                                                                     |
| N16 | Ecuación femenina, edad 17 o 56, sitios F01       | — / — / — / — propuesto                                       | Intervalo de DEC-007 pendiente de cotejo original; probar cada extremo.                                                |
| N17 | Tres sitios = 1 mm, masculino, edad 18            | S=3; D=1.1022811; bruto ≈−0.93124612224595 %; UI —            | Captura dentro de límites; grasa ≤0 activa guarda DEC-007. No clamp a cero.                                            |
| N18 | Añadir bíceps/subescapular/tríceps a M01          | S/D/%/UI iguales a M01                                        | Los sitios adicionales no entran en suma masculina 3P.                                                                 |
| N19 | Ecuación femenina con solo pectoral/abdomen/muslo | — / — / — / —                                                 | No sustituir sitios requeridos por otros; original femenino aún pendiente.                                             |
| N20 | Registros heredados sin protocolo/ecuación/edad   | — / — / — / — propuesto                                       | No atribuir método ni completar retrospectivamente; política histórica pendiente.                                      |

### Guardas aisladas de conversión y resultado

No son fixtures antropométricos ni entradas que se enviarán en un body de API.
Se proponen para la futura función pura de conversión, sin fabricar pliegues
imposibles para llegar a una densidad inválida. Fecha/edad/sitios/S: no aplican.

| ID  | D inyectada g/ml | Resultado aritmético | Esperado de producto candidato            |
| --- | ---------------- | -------------------- | ----------------------------------------- |
| G01 | 0                | División indefinida  | No dividir; sin resultado ni UI.          |
| G02 | −1               | No aplicable         | D≤0; sin resultado.                       |
| G03 | NaN / Infinity   | No finito            | Rechazar antes de convertir.              |
| G04 | 1.1              | 0 % exacto           | Guarda ≤0; sin resultado, no mostrar 0 %. |
| G05 | 0.9              | 100 % exacto         | Guarda ≥100; sin resultado.               |
| G06 | 0.8              | 168.75 %             | Guarda ≥100; sin clamp a 100.             |

## Aprobación pendiente

Ninguno de los casos tiene todavía firma/decisión de otro integrante. No se
ha probado su integración ni almacenamiento. Para oficializarlos se requieren
originales legibles, dominio y protocolos aprobados, reproducción independiente,
tolerancias justificadas y resolución explícita de S-01. No trasladar estas
tablas a tests como si ya fueran patrones científicos validados.

## Etapa 1B — Revisión de cobertura y clasificación

Se conservan los nueve casos numéricos, los veinte grupos N y las seis guardas G:
no se cambia ninguna entrada, coeficiente, resultado, fracción ni tolerancia por
la búsqueda documental nueva. La distinción siguiente **no aprueba** ningún caso.

| Casos                        | Sustento disponible                                             | Qué falta para oficializarlos                                                                                     |
| ---------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| M01, M04                     | Ecuación masculina y conversión cotejadas; aritmética candidata | Dominio/protocolo y reproducción independiente de cada resultado.                                                 |
| M02, M03                     | Igual, edades extremas del estudio                              | Aprobación expresa de fronteras y aplicabilidad; reproducción independiente.                                      |
| F01, F02                     | Transcripción femenina archivada, sin cotejo original legible   | Original, todos los coeficientes/sitios/unidades, dominio y reproducción independiente.                           |
| F03, F04, F05                | Igual; edades 40, 41 y 55                                       | Además, decisión fundamentada sobre la cautela >40. No forman una autorización clínica.                           |
| N01, N02, N03, N11           | Faltantes/ausencia y no invención, DEC-006/007                  | Revisar motivos y distinguir no cálculo de registro inválido; no fabricar edad.                                   |
| N04, N05, N06, N07, N09      | Límites/precisión/no finitos de DEC-006                         | Revisar especificación de casos negativos; estos límites son software, no evidencia clínica.                      |
| N08                          | Fronteras válidas de captura, sin dominio científico aprobado   | El revisor debe decidir aplicabilidad y completar el esperado; no asumir cálculo por aceptar el campo.            |
| N10                          | Selector explícito, sin inferencias                             | Separar `not_applicable` (no selección) de omisión (DTO actual inválido); precisar futura respuesta de cálculo.   |
| N12, N13, N16                | Fuera de intervalos nominales de referencia                     | Política de dominio aprobada; femenino además pendiente de original.                                              |
| N14, N15                     | Semántica de fecha/edad de DEC-006                              | Reproducir cumpleaños y caso de fecha imposible; N14 aún no tiene resultado numérico oficial.                     |
| N17                          | Guarda DEC-007 y ejercicio masculino candidato                  | Reproducir S, D y resultado negativo; no mostrarlo como estimación utilizable.                                    |
| N18                          | Tres sitios masculinos cotejados                                | Reproducción independiente que confirme exclusión de sitios adicionales.                                          |
| N19                          | Tres sitios femeninos propuestos                                | Original femenino y esperado de indisponibilidad; no oficializar desde el plan archivado.                         |
| N20                          | Inmutabilidad y no atribución de procedencia                    | Decisión de tratamiento histórico y revisión de indisponibilidad.                                                 |
| G01, G02, G03, G04, G05, G06 | Guardas técnicas DEC-007 y conversión cotejada                  | Revisión independiente de límites exactos y no finitos. Son pruebas aisladas propuestas, no evaluaciones físicas. |

**Cobertura revisada:** 9 identificadores M/F, 20 identificadores N y 6 G.
Algunas filas contienen alternativas que deberán separarse en subcasos de tests
cuando se autorice implementarlos; no son 35 pruebas de producto ejecutadas.
S-01 es un contraste documental adicional, no una décima evaluación candidata.

### Criterios para la comprobación independiente

1. Obtener coeficientes directamente de cada original, sin copiar el polinomio
   de estas tablas; registrar página/tabla/ecuación y documento consultado.
2. Reproducir todas las filas numéricas sin redondear D; contrastar fracción y
   decimal. Registrar herramienta, precisión, resultados y tolerancias aceptadas.
3. Revisar guardas y fronteras por separado de la elegibilidad científica. No
   mezclar tolerancia de cómputo con error de medición o incertidumbre del modelo.
4. Para S-01, emitir decisión explícita: referencia discrepante excluida como
   oráculo, o evidencia adicional que permita otra conclusión. No ampliar epsilon
   para hacer coincidir 21,5 con 21,428571… ni afirmar una causa no demostrada.
5. Revisar los tres sitios y las fechas de cada caso, la regla de empates de UI y
   la precisión propuesta; distinguir esperado matemático de resultado aplicable.

**Revisor y evidencia externa de reproducción: pendientes.** Ningún resultado
candidato cambió de estado a fixture aprobada durante esta etapa.
