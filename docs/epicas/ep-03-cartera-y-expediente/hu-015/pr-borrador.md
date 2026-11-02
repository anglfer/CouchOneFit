# feat(ep03): capture initial client records and isolate client reads

Destino previsto: `main` desde `feature/api-client-initial-record`. Revisor previsto: `anglfer`. Preparado como **PR en borrador / no listo para aprobación**; este archivo no acredita PR remoto creado ni aviso al equipo.

## Problema y resultado

El alta anterior solo capturaba nombre y objetivo. HU-015 permite registrar nacimiento, estatura, peso y medidas base opcionales de un cliente adulto, con validación coherente API/SQL/Web. Las altas usan la propiedad de sesión y la transacción existente de cupo, sin crear credenciales del cliente ni rellenar retrospectivamente sus medidas.

La política heredada permitía al rol técnico leer clientes de otras carteras, incluidas las nuevas columnas físicas. Dos migraciones nuevas restringen SELECT por sujeto activo/propiedad y preservan activación, agregados administrativos y limpieza mediante funciones de capacidad limitada. No se editan migraciones ya aplicadas ni se concede lectura general al runtime. El arreglo TT-010 se mantiene separado en `2782bb8`.

La recuperación de red de la comprobación de sesión desmontaba el formulario y perdía su contenido. `3a3e42b` conserva el subárbol en memoria, oculto e inerte hasta revalidar la misma cuenta; un rechazo definitivo, cierre o cambio de cuenta lo descarta. No guarda datos del expediente en almacenamiento del navegador ni implementa captura offline o reenvío automático.

## Verificación

- API: última ejecución documentada 91/91, sin fallos ni omisiones; incluye aislamiento con LOGIN ordinario, instalación limpia/actualización, paridad de esquema, cupo, concurrencia, atomicidad, invitación, activación y recuperación. No se presenta como nueva ejecución posterior al cambio exclusivamente Web.
- Recuperación Web: 7/7 pruebas del componente real con React DOM/JSDOM y HTTP simulado. Campos con valores, ausencia de persistencia/envíos automáticos, rechazo de autenticación, cambio de cuenta, cierre concurrente y guardado fallido/reintento explícito.
- Preparación final: builds API/Web, lint Web y Prettier de todos los archivos Web modificados aprobados. `git diff --check` aprobado.
- Referencia de 22 fallos anteriores reproducida en checkout separado de origin/main y bases locales exclusivas; causas y correcciones de preparación/SQLSTATE documentadas en validacion-local.md.
- Evidencia humana, **reportada por la persona usuaria**: recorrido original de altas/rechazos/persistencia/doble clic; tras corregir la sesión, Offline → Online recuperó los campos llenados con opcionales vacíos y cerrar/iniciar sesión dejó el formulario vacío. No se acredita conservación manual de opcionales con valores ni reintento de guardado.

## Pendientes antes de publicar

- R: la persona usuaria reportó aviso al grupo el 28/10/2026, posterior a la implementación, y que nadie más trabaja actualmente en esos archivos. Autorizó continuar con la publicación para revisión. Se conserva el desfase respecto al aviso previo exigido por CONTRIBUTING.md §1.3; no se acredita como previo ni se afirma verificación independiente o mensaje enviado por el agente.
- Fetch completado; origin/main ya está contenido en HEAD y no requirió integración adicional. Publicar solamente la rama indicada cuando corresponda; nunca main.

## Pendientes de aprobación / D0

- Revisión independiente por otro integrante, incluyendo el arreglo acotado de TT-010 y su alcance transversal restante. D0 abierto; no se considera completa toda TT-010.
- Casos manuales dirigidos de precisión casi válida, Unicode y cumpleaños exacto que no hayan sido reportados. No repetir el recorrido completo ni atribuir resultados nuevos. Opcionales con valores y reintento tienen cobertura automática; no confirmación manual.
- `format:check` global continúa fallando en 55 archivos ajenos. Los archivos modificados cumplen el formato aplicable; la deuda previa requiere tratamiento explícito en revisión, sin atribuirla a este cambio ni declarar el comando verde.
- Sin trabajo HU-016, merge, despliegue ni operaciones contra Supabase compartido. La actualización BD/API debe coordinarse cuando se autorice su despliegue, pues las consultas antiguas no establecen todos los contextos RLS nuevos.

Evidencia completa: [matriz de revisión](revision-final.md), [pruebas y referencia](validacion-local.md), [evidencia manual](prueba-web-manual.md) y [diseño TT-010](tt-010-client-read-isolation.md).
