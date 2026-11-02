# Revisión final — HU-017

Comparación completa desde `d6e7e20` hasta la entrega HU-017; no se atribuyen cambios HU-015/016 a esta historia. T = pruebas/herramientas, E = revisión estática del implementador, R = reporte de la persona usuaria. Esta revisión no sustituye D0.8.

## Regla aplicable al caso manual de transporte

Fuente: `plan/PLAN_TRABAJO_V2.md` §5.2:

- D0.5: «Criterios de aceptación y casos negativos automatizados en el nivel adecuado; prueba de integración de la feature».
- D0.10: «Validación desde una app real: una pantalla sola o un endpoint aislado no cierra una feature vertical».
- D0.8: «Revisión de código por otro integrante y corrección de observaciones antes de merge».

Ni D0 ni HU-017-API1/WEB1/QA1 requieren Protocol Monitor o ejecutar cada caso negativo manualmente. La prueba de componente del error de transporte y el recorrido real reportado de edición/persistencia/conflicto/sesión cubren esos aspectos; la prueba manual adicional propuesta no es una puerta obligatoria de publicación. Se corrige esa exigencia inferida en la documentación previa, sin inventar resultados ni declarar D0 cerrado.

Permanece explícito: no se observó manualmente un fallo durante PATCH ni el mensaje incierto; tampoco se provocó una pérdida real de respuesta posterior al COMMIT. La prueba Web simula TypeError y luego un GET con datos que representan un guardado ya realizado; no equivale a una prueba de red/BD extremo a extremo. La guía de Protocol Monitor se conserva únicamente como opción.

## Matriz final

| Requisito | Fuente | Evidencia | Estado |
| --- | --- | --- | --- |
| Modificar solo expediente propio, sin escritura cliente/admin | HU-017, RDF0304/0306, RS02/RS19 | E: identidad persistida, filtro de propietario, RLS y whitelist. T: dos carteras, Bearer de cliente/admin válidos, sin sesión/CSRF y campos manipulados; runtime SQL ordinario. | Cumple |
| Validación y PATCH parcial | DEC-006 §3.4; HU-015; convenciones | E/T: validador reutilizado en capa validators; rangos/precisión, calendario, Unicode, NULL y omitidos. No normaliza textos omitidos ni vacía el conjunto base completo. R: edición, rechazo de 70.25, corrección y persistencia. | Cumple |
| Legado incompleto | Migración HU-015 y contrato de compatibilidad | T: mantiene el grupo NULL hasta completarlo de forma válida; no fabrica valores. E: distingue la excepción histórica del texto general de nacimiento requerido. | Cumple |
| Suscripción, estado y cupo independientes | DEC-004/005 | E: profesional/suscripción vigentes, consume=false; ni estado ni cuenta se editan. T: edición activa/inactiva y con exceso, conteo invariable; sin plan/suspendida/vencida rechaza sin escritura. | Cumple |
| Versión BD y conflicto atómico | Aceptación HU-017 | E: trigger ante cambios efectivos, UPDATE por ID/propietario/versión y locks compatibles. T: concurrencia con varias conexiones, una respuesta 200/otra 409; no-op, estado, activación, INSERT/version forzada y UPDATE de versión denegado. R: conflicto, borrador y reaplicación explícita correctos. | Cumple |
| Conservación y rollback | HU-017-QA1; D0.6 | E: solo UPDATE de ocho columnas y metadato versión; sin DELETE ni módulos históricos nuevos. T: falla posterior al UPDATE revierte fila/versión; edición válida preserva invitación/evento de acceso no vacíos y vínculo existente. Evaluaciones/planes/registros históricos aún no tienen tablas: no se acredita una prueba inexistente. | Cumple en el alcance implementado |
| Borrador y recuperación segura | HU-017-WEB1; D0.4/5 | T: incertidumbre simulada sin replay, comparación y reaplicación explícitas, 403 de negocio/CSRF, renovación sin repetir PATCH, descarte de otra identidad. R: Offline → Online durante comprobación de sesión conserva; logout descarta y mantiene guardados anteriores. Sin almacenamiento sensible persistente ni autosave. | Cumple con límites de evidencia explícitos |
| Contrato, arquitectura y textos | DEVELOPMENT; OpenAPI; glosario | E/T: controlador/servicio/repositorio/validadores, SQL parametrizado, DTO y ClientBaseRecord.version, PATCH estricto, errores por campo/409 y no-store; 34 referencias OpenAPI resueltas. Textos visibles españoles y nombres ingleses. Sin nuevas dependencias. | Cumple |
| Migración y permisos | Convenciones BD; RS19 | E/T: solo migración nueva 202610280004, catorce históricas intactas; sin UPDATE de versión/propietario/user_id ni lectura general nueva. Instalación limpia/actualización, checksums y paridad de permisos/RLS/funciones/triggers. T: preparación local conservó 28 filas salvo nueva versión, sin limpiar fixture. | Cumple |
| Regresiones | HU-015/016 y flujos de identidad | T: API 107/107 y Web 22/22; alta/cupo/estado, invitación/canje/recuperación/autenticación, búsqueda literal/filtros/tamaños/cursor/respuestas antiguas. Código idéntico al probado: no se repiten suites por cambios documentales. | Cumple según ejecuciones registradas |
| Verificaciones y publicación | CONTRIBUTING §1.3/1.4/4; acuerdo EP-03 | R: aviso HU-017 confirmado previamente. T: builds API/Web, lint, formato Web modificado, OpenAPI, diff y escaneo de secretos. Fetch: main 27a7df7 ya es ancestro, sin merge necesario. Única rama feature/api-client-portfolio; HU-015/PR #22 intactos. | Cumple para publicar avances |
| Formato global | D0.7; evidencia de referencia | format:check conserva 53 archivos previos ajenos. No se presenta como verde ni se atribuye a HU-017; los archivos modificados cumplen su formato aplicable. | Pendiente transversal |
| Revisión independiente y aceptación de dependencias | D0.8; HU-015/TT-010 | No consta revisión por otro integrante. El arreglo específico de lectura está probado, pero TT-010 transversal y aceptación de dependencias siguen abiertos. | Pendiente antes de integración/cierre |

## Resultado y límites

No se detectaron incumplimientos funcionales propios pendientes que impidan publicar avances. La corrección de esta revisión es documental: elimina un requisito manual inferido y separa D0.10 de D0.8 en la matriz. No se modifican aplicación, migraciones, fixtures ni evidencia humana.

Se autoriza publicar exclusivamente la rama común; no crear PR hasta completar EP-03, no integrar ni desplegar. Una publicación para revisión no constituye aprobación de HU-017, de sus dependencias o cierre de D0/TT-010. Se conserva la deuda previa de formato y la limitación de transporte post-COMMIT para revisión independiente.
