# Revisión final — HU-016

28/10/2026. Comparación completa con `feature/api-client-initial-record` en `6b2c0a0`, para revisar únicamente HU-016 sin atribuirle cambios de su dependencia. T = prueba/herramienta; E = revisión estática; R = reporte de la persona usuaria. Esta revisión del implementador no sustituye revisión independiente.

| Requisito | Fuente | Evidencia | Estado |
| --- | --- | --- | --- |
| Listar/buscar cartera propia y ambos estados | PLAN_TRABAJO_V2 §HU-016; sistema-interno RDF0302/0303 | T: suite API, dos carteras y estados. R: 27 propios, búsqueda 24, 2 activos/22 inactivos. E: filtro parametrizado en servidor. | Cumple |
| Literales y consultas seguras | HU-016-API1/QA1; DEVELOPMENT | T: signos, comillas, barra, emoji y texto de inyección. R: coincidencias literales indicadas. E: `position(lower($3) in lower(c.full_name))`; identidad no aceptada del query. | Cumple |
| Páginas estables y límites | Aceptación HU-016 | T: microsegundos, empates UUID, 1/20/100, firma/cuenta/filtros de cursor y ausencia de omisiones/duplicados en conjunto estable. R: 20+7, 20+4 y 20+2. E: límites de concurrencia documentados, sin promesa de instantánea congelada. | Cumple |
| Carga, vacío, cero resultados y error | HU-016-WEB1; D0.4 | T: componentes reales, carga/error/reintento, vacío distinto de sin coincidencias. R: mensaje de cero resultados. No se atribuyen los demás estados manuales. | Cumple |
| Respuestas antiguas | Acuerdo de implementación; D0 | T: promesas resueltas en orden inverso no sustituyen el resultado vigente. No hubo prueba manual reportada de esta carrera. | Cumple |
| Ficha mínima autorizada | Contrato auxiliar autorizado; OpenAPI | T: propia/ajena/inexistente, 401/403, NULL históricos y unidades; 26 referencias OpenAPI resueltas. R: ficha propia y error genérico en URL ajena. E: sin edición, planes ni evaluaciones. | Cumple |
| Propiedad y lectura BD | RS02/RS19; TT-010; convenciones BD | T: LOGIN ordinario con RLS, dos profesionales, expediente propio del cliente y ausencia de contexto; API exige identidad profesional persistida. E: `readAsSubject`, propietario y suscripción conservados; sin grants nuevos. | Cumple en este alcance |
| Datos base, NULL y diccionario | DEC-006 y reglas vigentes de HU-015; glosario | E/T: lectura de las mismas columnas/unidades, NULL no se convierte en cero; sin cambiar validación de captura, fechas, precisión o reglas clínicas. Límite de búsqueda Unicode alineado en Web/API y regresión de 150/151 puntos de código. | Cumple |
| Alta, cupo, estado, sesión e invitaciones | HU-015; flujos de identidad vigentes | T: 97 API y 12 Web aprobadas, incluidas atomicidad/concurrencia, activación/recuperación, rechazo de sesión y borrador. E: se conserva autorización/suscripción; mutación bloquea filtros/páginas para mantener destinatario. | Cumple |
| Migraciones y conservación | Convenciones BD; CONTRIBUTING | T: instalación limpia, actualización, catálogo/checksums y EXPLAIN ordinario. E: único índice nuevo, histórico y migración HU-015 intactos; sin transformación/borrado de datos. | Cumple |
| Nombres, capas y textos | DEVELOPMENT; glosario | E: validación/servicio/repositorio separados; identificadores ingleses, textos visibles españoles, DTO/SQL/Web/OpenAPI consistentes. | Cumple |
| Compilación y formato propio | CONTRIBUTING §1.4/§5; formato Web | T: builds API/Web, Oxlint, Prettier de los cinco archivos Web cambiados y diff sin errores. `format:check` global falla en 55 archivos previos ajenos; deuda visible, no se presenta como éxito. | Cumple en archivos de entrega |
| Secretos y alcance | CONTRIBUTING §6 | T: escaneo de archivos publicables sin secretos locales conocidos/patrones de credenciales/temporales; `git check-ignore` confirma asistentes, marcador y credenciales. E: no cambios móvil/config global, sin dependencias nuevas. | Cumple |
| Ramas y coordinación | CONTRIBUTING; excepción y acuerdo del equipo reportados por la persona usuaria | T: fetch de origin; `origin/main` en `27a7df7` ya es ancestro. HU-015 local/remota en `6b2c0a0`. R: aviso previo HU-016. Solo rama dependiente; commits por HU, próximo PR al completar EP-03, PR #22 intacto. | Cumple con excepción explícita |
| Aprobación independiente y D0 | D0; dependencias HU-015/TT-010 | Aún no hay aprobación independiente ni aceptación de la dependencia; TT-010 transversal no se cierra. | Pendiente |
| Edición/expediente consolidado, móvil, producción | Alcance autorizado HU-016 | No se implementan ni despliegan. Sin operaciones en Supabase compartido. | No aplica |

## Corrección de esta revisión

El límite HTML de búsqueda contaba unidades UTF-16 y truncaba búsquedas Unicode válidas. Se sustituye por validación nativa y guardia de envío que cuentan puntos de código tras recortar extremos, igual que la API. La regresión permite 150 emoji, rechaza 151 caracteres sin petición y permite corregir el texto. No cambia el contrato ni la búsqueda literal.

## Publicación y pendientes

No se identifican bloqueos propios de HU-016 para publicar **solo** `feature/api-client-portfolio` para revisión. No hace falta integrar commits de main: ya están contenidos; no se ejecuta merge, rebase, cherry-pick ni cambio de base. No se crea PR hasta completar EP-03 ni se toca PR #22.

Para aprobar la integración/cerrar D0 siguen pendientes revisión independiente y aceptación de HU-015 y del alcance exigible de TT-010. La exposición concreta de SELECT sobre clientes/medidas fue corregida y probada en la dependencia; no equivale a resolver el inventario transversal completo de permisos/aislamiento TT-010. La deuda global de formato de 55 archivos permanece separada. Los casos no reportados manualmente no se acreditan por inferencia; respuestas antiguas conservan evidencia automática.
