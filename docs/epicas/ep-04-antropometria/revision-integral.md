# Revisión integral de EP-04 — 14 de noviembre de 2026

Revisión de `feature/ep04-antropometria` en `8246d8b` y de la corrección SQL que ya estaba en el área de trabajo. Los criterios son [HU-021 a HU-023 en el plan](../../../plan/PLAN_TRABAJO_V2.md#ep-04--antropometría), D0, DEC-006/007/018 y RDF0501–0505.

| Historia | Resultado de la revisión |
| --- | --- |
| [HU-021](hu-021/multimethod.md) | Implementada. Los tres métodos guardan evaluaciones independientes en el expediente. La fecha efectiva opcional, la fecha técnica del servidor, las validaciones de captura y la conservación tras editar, inactivar y reactivar se comprobaron en PostgreSQL. |
| [HU-022](hu-022/README.md) | Implementada para las mediciones de evaluaciones profesionales. Tabla, gráfica, filtros, orden y paginación están conectados al expediente. La serie expone grasa medida y otras mediciones. El porcentaje estimado queda en el detalle de cada evaluación y no se ofrece como serie. |
| [HU-023](hu-023/condiciones-desbloqueo.md) | Bloqueada para producción. La prueba local guarda entradas, versiones, resultado candidato o motivo de indisponibilidad. DEC-007 exige completar cotejo de originales, protocolo, dominio y casos patrón con revisión independiente. |
| [HU-036 y HU-037](../../../plan/PLAN_TRABAJO_V2.md#hu-036--habilitar-y-consultar-historial-propio-autorizado) | La publicación al cliente y la incorporación del peso diario desde móvil corresponden a EP-07. |

## Hallazgos

- **T — Migración HU-023.** PostgreSQL 18.6 devuelve `22P02` con la expresión original de la [migración](../../database/migrations/202611130001_evaluation_estimation_snapshots.sql). La corrección local agrupa la extracción JSON antes de quitar las claves y funcionó en el esquema y las pruebas. La corrección estaba sin commit al iniciar la revisión.
- **T — Prueba de migraciones sensible al orden de permisos.** En un clúster vacío, la prueba comparó `nspacl::text` y falló con el mismo conjunto de permisos en distinto orden. La repetición, con los roles ya creados, pasó. La instalación y la actualización de una base con una evaluación previa alcanzaron las comprobaciones de conservación antes de esa comparación en la primera ejecución. Véase [la prueba](../../../apps/api/tests/migrations.test.ts).
- **T — Detalle de páginas anteriores sin conexión, verificación posterior.** La [vista](../../../apps/web/src/features/evaluations/pages/EvaluationsPage.tsx) usa `sessionRequest` y la caché admite la ruta con `offset`. La prueba confirma que la cuenta puede reabrir una página previamente consultada sin conexión y que otra cuenta no puede recuperarla. Una página sin consultar requiere conexión. Falta comprobar el recorrido completo en un dispositivo sin red.

## Evidencia de esta ejecución

- **T — Web:** compilación, lint y 144/144 pruebas. **T — API:** compilación y 83/83 pruebas acotadas a captura, evolución y estimación. Los avisos de Vite sobre el tamaño del paquete y el entorno de pruebas no causaron fallos.
- **T — PostgreSQL 18.6 aislado:** 9/9 comprobaciones físicas en una copia temporal del arnés HU-022 adaptada al puerto y versión locales. Incluye los ocho casos del arnés (más de 20 filas, fechas empatadas, permisos de dos carteras, cursores, invariancia del historial, tres métodos e idempotencia) y un caso adicional para cálculo candidato, ausencia de datos, persistencia y repetición idempotente.
- **T — Navegador con datos sintéticos:** acceso profesional, expediente vacío, registro de tres evaluaciones por pliegues, reapertura de una fecha efectiva anterior con porcentaje candidato guardado, gráfica y tabla de peso, y filtro de 30 días. Una entrada de fecha mediante el teclado conservó el día elegido. El llenado automatizado del selector de fecha no actualizó el estado de React inicialmente, por lo que esas dos altas usaron la fecha UTC del servidor. La consola no mostró errores ni advertencias durante la comprobación final.
- **E — Límites:** queda pendiente la aceptación D0 por otro integrante. La comprobación se limita a esta copia local y a datos sintéticos. No se usaron bases compartidas ni se desplegaron cambios.

La [validación de las correcciones](hu-022/validacion-local.md) registra el estado posterior de la gráfica para el porcentaje candidato, las pruebas de caché y la comparación de permisos de migraciones.
