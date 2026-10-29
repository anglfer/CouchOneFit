# HU-019 — Evidencia del incremento parcial

29/10/2026. T = prueba ejecutada por el asistente; E = revisión estática; R = reporte de la persona usuaria. No hay recorrido humano HU-019 reportado todavía. Los resultados humanos HU-015/016/017/018/020 no se convierten en resultados de esta historia.

## Verificaciones locales

Destino validado antes de pruebas: 127.0.0.1:5432/CouchOneFit_test, cargando explícitamente .env.test.local sin imprimir credenciales. Suite de aislamiento usa base temporal y rol LOGIN ordinario sin BYPASSRLS; la inyección de fallo SQL afecta únicamente esa base temporal. Se conservan fixtures manuales: no se ejecutan asistentes de preparación, activaciones, reemplazos de invitaciones ni escrituras sobre ellas. La suite completa también contiene pruebas de registro con datos sintéticos propios en la base exclusiva local.

- API build: correcto. Suite API: **120/120**, incluidos tres casos HU-019; también migración limpia/actualización, aislamiento, alta, invitación, activación, edición, estado, cupo y auditoría existentes.
- Web build y lint: correctos. Suite Web: **36/36**, incluidos ocho casos HU-019 y regresiones anteriores.
- Formato: archivos Web modificados por HU-019 formateados. format:check global continúa con **53 archivos previos**, ajenos al diff HU-019. Ya estaban identificados en la referencia de main; no se reformatea código ajeno. Esto sigue siendo un fallo global conocido, no un resultado global aprobado.
- Sin cambio SQL de comportamiento, migraciones, permisos, dependencias o lockfiles. La única modificación del repositorio SQL es tipar su proyección existente.

## Matriz de aceptación y límites

| Requisito / fuente | Evidencia | Estado |
| --- | --- | --- |
| Perfil real/objetivo/medidas, HU-019/RDF0404 | T API compara composición con GET base, valores reales y null; T Web lectura única y unidades; E reutilización de servicio | Cumple incremento base |
| Propiedad/rol y RLS, RNF07/18 | T API anónimo/cliente/admin/otro profesional y suite runtime ordinario; sin payload ajeno | Cumple incremento |
| Sin fuga al cambiar cliente/cuenta, D0/seguridad | T Web respuestas invertidas, cambio de cuenta y respuesta con ID incorrecto | Cumple automatizado; recorrido humano pendiente |
| Carga/error/ausentes diferenciados | T Web; T fallo SQL503 en lector disponible, recuperación200 sin vacío/parcial | Cumple |
| Módulo no integrado distinto de vacío, HU-019 | T API cinco not_integrated sin registros; T Web empty/error solo con dobles de prueba | Cumple incremento; no acredita servicios futuros |
| Peso base separado de eventos/cargas y fecha real, DEC-006/HU-037 | E proyección sin fecha inventada; T sin createdAt/measuredAt, texto y kg | Cumple incremento; histórico pendiente |
| Progreso autorizado, DEC-009 | E no hay datos ni permisos nuevos de progreso; cinco secciones sin payload | Pendiente integración real |
| Planes/evaluaciones/progreso integrales y versiones históricas, HU-021/022/026/030/033/037 | E módulos ausentes; guía de integración propuesta | Pendiente obligatorio para completar HU-019 |
| Contratos previos y regresiones | E nueva ruta GET aislada; T suites completas alta/invitación/activación/edición/estado/cupo | Cumple automatizado |
| Aviso compartidos, CONTRIBUTING §1.3 | R aviso previo confirmado por la persona usuaria; no aprobación ajena acreditada | Cumple aviso reportado |
| D0/revisión independiente | Sin revisión independiente ni recorrido humano de composición; dependencias ausentes | Pendiente; no cerrado |
| TT-010 transversal | Se reutiliza aislamiento de lectura corregido; no auditoría completa transversal | Pendiente transversal |

## Recorrido manual breve pendiente

Sin repetir activaciones ni pruebas de alta: usar sesión profesional sintética existente en http://127.0.0.1:5000, con API local actualizada y Vite hacia 127.0.0.1:3000. No introducir credenciales en documentos o registros.

1. Abrir A desde la cartera. Deben aparecer su perfil real, objetivo y medidas base; peso en kg y opcionales ausentes como «Sin registrar». La lectura no modifica versión ni datos. La consistencia HU-020 actual está cerrada con su evidencia propia; no se reabre la discrepancia anterior.
2. Comprobar Planes (alimentación/entrenamiento), Evaluaciones y Progreso (seguimiento/peso): «Esta sección todavía no está disponible», sin listas ficticias ni «Sin registros» para esos módulos.
3. Volver a cartera y abrir B. Durante carga no debe quedar visible A; después debe mostrarse B. Actualizar expediente solo repite la lectura. Respuestas fuera de orden ya tienen prueba automática, no se atribuye comprobación manual.
4. Opcional: bloquear solo GET /api/clients/:clientId/record en DevTools, mantener sesión operativa y actualizar. Debe mostrarse error recuperable sin expediente vacío/parcial. Desbloquear y reintentar lectura. Acceso ajeno y fallo SQL están cubiertos automáticamente; no se exige manipular datos ni activar cuentas para repetirlos.

Este incremento queda listo para revisión técnica tras sus verificaciones; no equivale a integración consolidada completa ni a D0 cerrado. No se publica en este paso. PR #22 intacto.

## Diagnóstico del primer intento manual: proceso API anterior

La persona usuaria reportó «No pudimos consultar el expediente». El recorrido no se registra como aprobado. El conector de navegador no estuvo disponible: el asistente no reprodujo el clic desde la cartera ni inspeccionó la sesión exacta de Chrome. Se reprodujo la consulta por HTTP directo y por el proxy Vite con la identidad profesional de la fixture, usando una sesión persistida vigente y credencial únicamente en memoria, sin crear sesión/cuenta ni imprimir tokens.

SQL confirmó A = ab04ad1f-3857-4b68-a4da-e9456b97f78e, profesional e0abfc12-8878-4f66-aef2-3b5dcc6ae76c, cuenta profesional f18c0f69-b24c-4b8e-bbb2-c92400d2a211 (qa.hu020.1b16b463, active/professional). No se acredita con ello haber leído la identidad exacta del navegador. Versión4, objetivo «Objetivo verificado HU020» y peso71.3 permanecieron iguales antes/después.

Antes del reinicio, GET /api/clients/:id devolvió200; GET /api/clients/:id/record devolvió403 CSRF_INVALID tanto en127.0.0.1:3000 como en127.0.0.1:5000. El proceso API identificado había arrancado antes de compilar HU-019 y carga dist una sola vez. Sin la ruta nueva, la consulta continuaba hasta capacityRoutes y su middleware CSRF existente. No era prueba de rechazo RLS ni fallo de conexión y no se modificó ese middleware.

Se recompiló la rama y se reinició únicamente el proceso del asistente local verificado, manteniendo bind127.0.0.1:3000 y base127.0.0.1:5432/CouchOneFit_test. Después, GET base y GET compuesto devolvieron200 en ambos puertos, con la misma proyección e ID/versión/objetivo/peso; las cinco secciones devolvieron not_integrated. El montaje /api + /clients/:clientId/record, servicio readProfessionalRecord y reutilización readPortfolioRecord/readAsSubject fueron revisados. La consulta real pasó por el runtime ordinario y RLS existentes. No se cambiaron fuentes, permisos, propietarios, cuentas o fixtures; no se necesitó corregir lógica de módulos ausentes.

Repetición humana pendiente: recargar Web, confirmar el profesional sintético y abrir A desde la cartera; revisar perfil y disponibilidad de secciones. Si el error persiste, comprobar únicamente HTTP/error de ese GET sin copiar encabezados o credenciales. Las consultas HTTP anteriores son evidencia ejecutada por el asistente, no aprobación del recorrido humano.

Regresiones repetidas tras el diagnóstico: API build correcto, API120/120 y Web36/36. No hubo cambios de código que requirieran otra compilación Web o cambios de permisos.
