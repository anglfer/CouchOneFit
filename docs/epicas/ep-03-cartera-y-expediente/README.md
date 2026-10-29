# EP-03 — Cartera y expediente

## Acuerdo de integración vigente

Por acuerdo confirmado por la persona usuaria, `feature/api-client-portfolio` es la única rama de trabajo para toda EP-03 y sus historias restantes. Contiene íntegros los commits de HU-015 y HU-016; no hace falta un merge para consolidarlos. Los commits se mantienen separados y descriptivos por HU, con los bloques coherentes que cada historia requiera. Los avances se publican en esta misma rama tras las verificaciones correspondientes. No se crean ramas ni PR adicionales por historia; el próximo PR se abrirá al completar EP-03.

`feature/api-client-initial-record` y el PR #22 existente se conservan intactos como excepción histórica. No se reescribe el historial ni se usa force-push. Si se integra HU-015, primero se revisará cómo se integró y cómo preservar los commits y la revisión, sin rebase, cherry-pick o cambio de base automáticos. Este acuerdo no autoriza merge ni despliegues y no cierra D0, la revisión independiente ni los pendientes transversales.

## Antecedente del flujo

HU-015 se publicó primero en su propia rama y PR #22. Con autorización explícita, HU-016 se desarrolló después en una rama dependiente desde HU-015; inicialmente se planteó un PR por HU. Ese plan fue sustituido por commits por historia y un PR al completar la épica. La confirmación vigente conserva la rama de HU-016 como única rama de EP-03; el antecedente no implica crear otra rama para HU-017.

## Alcance implementado

Esta épica conserva un único expediente por cliente dentro de la cartera de su profesional. [HU-015 — Crear el cliente y su expediente inicial](hu-015/README.md) permanece en revisión. [HU-016 — Listar y buscar la cartera propia](hu-016/README.md) incorpora búsqueda literal, estado, cursores y ficha mínima. [HU-017 — Editar datos base y objetivo](hu-017/README.md) añade edición propia con versión BD, conflicto explícito y borrador en memoria. Las historias están contenidas en la rama común, sin cerrar dependencias ni D0. HU-017 tiene recorrido manual parcial reportado y conserva pendiente la revisión independiente; el caso manual de fallo durante PATCH queda opcional con cobertura automática existente y no bloquea publicar avances; su implementación local no acredita cierre. Todavía no se implementan evaluaciones, mediciones históricas, cálculo de grasa, nutrición, prescripciones ni expediente consolidado.

[HU-018 — Estado operativo del expediente](hu-018/README.md) añade confirmación, control de versión/reintentos y auditoría transaccional sin cambiar cuentas/suscripciones ni revocar sesiones por inactivación. Se conserva la asignación de Omar como ejecutor API1 en el plan; esta implementación técnica fue realizada por el asistente por autorización explícita de la persona usuaria, sin acreditar revisión o aprobación de Omar ni aviso al grupo. No se publica todavía; recorrido humano HU-018 y revisión independiente pendientes.
