# EP-03 — Cartera y expediente

## Acuerdo de commits y revisión

Por acuerdo del equipo incorporado por la persona usuaria: los commits se organizan por historia de usuario y el próximo PR se abrirá cuando esté completa EP-03. No se crea un PR independiente para HU-016. El PR #22 existente de HU-015 se conserva tal como está. Los bloques API/Web/documentación de HU-016 siguen identificados como esa historia; no se reescriben commits ya creados para imponer un único commit por HU.

La rama actual sigue dependiendo de HU-015. No se ejecutan automáticamente rebase, cherry-pick, force-push o cambios de base cuando se integre esa dependencia: primero se revisa cómo se integró y se elige cómo preservar commits y revisión. La base y rama de presentación del futuro PR de épica se resolverán en ese momento, sin inferir autorización para publicar, integrar o desplegar ahora.

Esta épica conserva un único expediente por cliente dentro de la cartera de su profesional. [HU-015 — Crear el cliente y su expediente inicial](hu-015/README.md) permanece en revisión. [HU-016 — Listar y buscar la cartera propia](hu-016/README.md) incorpora búsqueda literal, estado, cursores y ficha mínima de lectura en una rama dependiente separada, sin cerrar dependencias ni D0. No incluye edición HU-017, evaluaciones, mediciones históricas, cálculo de grasa, nutrición, prescripciones ni expediente consolidado.
