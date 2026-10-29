# Evidencia local — HU-018

29/10/2026, America/Mexico_City. Rama `feature/api-client-portfolio`, base `861398b`; árbol inicialmente limpio. T = herramienta/prueba; E = revisión estática del implementador; R = reporte de la persona usuaria. No hay recorrido humano HU-018 acreditado. La autorización de implementar API1 además de Web/integración/QA consta como R; no equivale a aviso acreditado al grupo, aprobación/revisión ni ejecución de Omar. La asignación original del plan permanece intacta.

## Entorno y conservación

T: Node 24.22.0/npm 11.19.1/PostgreSQL local 18.6; sin instalación global ni cambios de dependencias. El verificador carga `.env.test.local` explícitamente, exige ambas URLs idénticas sin parámetros adicionales y consulta dirección/puerto/base efectivos: solo `127.0.0.1:5432/CouchOneFit_test`. Las suites usan bases/roles temporales locales aislados que eliminan al terminar; no utilizan Supabase compartido ni fixtures manuales.

T: se aplicó únicamente `202610290001_client_record_status_audit.sql` a la base manual exclusiva. Hashes agregados antes/después coinciden para filas completas de clients, invitations, access_events, subscriptions, users, professionals y notice_acceptances. Se conservaron las 28 filas actuales de clientes, incluidas todas sus versiones y los cambios manuales anteriores. No se restablecieron fixtures, datos o marcadores.

T: se identificó el proceso anterior en 3000 como el asistente que conserva la fixture; se detuvo solo ese proceso y se inició API desde el build HU-018 con runtime ordinario. Vite existente se reutilizó. Health directo 3000/5000, proxy de catálogo y conexión runtime local: correctos; mismo origen desde Vite a la API real en 3000. Cuenta sintética activa, 27 propios, 5 activos de 10. Esto prepara el recorrido, no acredita observaciones humanas.

## Resultados

| Comprobación | Evidencia | Estado |
| --- | --- | --- |
| Suite API completa | T: **114/114 aprobadas**, 0 fallidas/omitidas, 91545 ms; siete casos nuevos sobre 107. Incluye propiedad/cupo, auditoría, sesiones y regresiones. | Cumple |
| Migración limpia/actualización | T: dentro de la suite y repetición específica posterior **1/1 aprobada**, 11337 ms, con invitación/evento anteriores no vacíos. Dieciséis migraciones, paridad de esquema/constraints/índices/RLS/permisos/funciones/triggers, checksums y datos previos. E: quince SQL anteriores intactos. | Cumple |
| Suite Web | T: **28/28 aprobadas**, 0 fallidas/omitidas, 6324 ms; seis casos nuevos sobre 22. React real/JSDOM con HTTP simulado, no navegador humano. | Cumple |
| Compilaciones/lint/formato | T: API TypeScript y Web TypeScript/Vite compilan, Oxlint sin avisos tras corrección propia; Prettier de archivos Web modificados y diff sin errores. | Cumple |
| OpenAPI | T/E: parseo JSON, 42 referencias resueltas; cuerpo status/version estricto, respuesta ClientBaseRecord y errores diferenciados. Listado/cursor y editor base conservan contratos. | Cumple |
| Formato global previo | T: format:check conserva **53 archivos previos ajenos**. No se presenta como verde ni se reformatea esa deuda. | Pendiente transversal |

## Matriz final de alcance

| Requisito / fuente | Evidencia | Estado |
| --- | --- | --- |
| Alcance operativo — HU-018/DEC-004 | E: solo UPDATE de estado de clients, versión por trigger y evento; sin cambios de users/subscriptions ni revocación por expediente. T: cuenta/refresh/lectura/login cliente se mantienen; reactivar expediente no reactiva cuenta inactiva. | Cumple |
| Propiedad y permisos — RS02/RS19, TT-010 | T: dos propietarios con LOGIN runtime ordinario sin super/BYPASSRLS/DDL, rol cliente/admin denegado, anónimo/CSRF, propietario/cuenta manipulados y contexto limpiado. E: RLS y filtro de propietario; sin grants nuevos. | Cumple en este alcance |
| Cupo — HU-013/DEC-005 | T: dos reactivaciones compiten por última plaza, un éxito/otro CUPO_AGOTADO; no-op al límite sin otra reserva; inactivar libera. Regresiones de alta/reactivación, ilimitado y exceso incluidas. | Cumple |
| Versión y reintentos — HU-018, compatibilidad HU-017 | T: duplicados concurrentes generan un solo evento/incremento; repetición del estado actual con versión vieja no escribe; transición antigua no revierte la posterior; edición base y estado invalidan mutuamente sus versiones antiguas. E: versión futura rechazada, gestionada solo por BD. | Cumple |
| Atomicidad/auditoría — HU-018-API1 | T: trigger de fallo en INSERT de auditoría revierte estado/versión/plaza y no deja evento; éxito posterior funciona. E: siete acciones anteriores preservadas y dos nuevas diferenciadas de activación de cuenta, sin datos físicos ni secretos. | Cumple |
| Invitación e historial — HU-018/DEC-011 | T: invitación conservada íntegra al inactivar, emisión/prevalidación bloqueadas, elegibilidad recuperada al reactivar sin extender TTL; evento anterior conservado. Migración conserva filas previas. E: no existen tablas de evaluaciones, planes de cliente o medidas históricas; no se acredita su conservación mediante pruebas inexistentes. | Cumple con límite explícito |
| Confirmación/cancelación — HU-018-WEB1 | T: diálogo etiquetado, foco inicial en Cancelar, cancelar/Escape sin PATCH; doble confirmación produce un solo envío y ningún éxito adelantado. E: modalidad nativa y semántica accesible; comportamiento nativo real pendiente de recorrido. | Implementado; revisión humana pendiente |
| Conflicto/error/incertidumbre Web | T: error de negocio conserva diálogo; conflicto exige GET y confirmación explícita; pérdida de respuesta simulada no reenvía ni invierte intención, incluso si el GET inicial desde una lista vieja ya tiene el estado deseado. | Cumple automáticamente |
| Integración cartera/ficha/cupo | T: actualiza tras respuesta, conserva filtros/tamaño y vuelve a primera página; ficha refleja estado. Fallo de lectura de cupo avisa y su reintento hace solo GET. E: actualizar el resumen no desmonta el componente ni descarta el borrador de alta. | Cumple según componentes/pruebas |
| Sesión y regresiones | T: diálogo cerrado mientras la sesión es incierta, reaparece solo al recuperar misma cuenta sin PATCH, otra cuenta destruye; veintidós casos Web anteriores y regresiones API de HU-005/015/016/017 e invitación/activación/recuperación aprobados. | Cumple automáticamente |
| Coordinación y atribución | R: autorización explícita para implementar API1 sin esperar coordinación. E: asignación Omar conservada, implementación real del asistente documentada. No consta aviso de grupo §1.3 ni revisión independiente; no se inventan. | Desfase documentado, ejecución autorizada |
| Datos reales / privacidad — DEC-011/015 | E: baja lógica/conservación técnica preparadas; sin política legal, plazos, responsable/contacto o aprobación para datos reales inventados. Solo sintéticos locales. | Pendiente para uso real |
| D0 y TT-010 transversal | Recorrido real HU-018 y revisión por otro integrante aún pendientes; no se cierran HU-015/TT-010 ni la épica por esta implementación. La prueba manual de cada negativo automatizado no se añade como requisito nuevo. | Pendiente |

## Incidencias propias corregidas

Primera suite API: 113/114; la prueba nueva usaba una URL inexistente de prevalidación, obtuvo 404 y se corrigió a `/api/auth/activation/prevalidate`, sin cambiar la API ni debilitar sus controles. Primer lint Web señaló asignación de ref durante render; se trasladó a efecto y el lint final quedó sin avisos. No se atribuyen a main.

La revisión incorporó cierre explícito del diálogo mientras la sesión no está comprobada, evitando depender de cómo el navegador trate un modal nativo dentro del subárbol oculto. Conserva la confirmación en memoria y solo la recupera para la misma identidad. También se conserva la intención pulsada desde una lista vieja: el GET no puede convertir inadvertidamente Inactivar en Reactivar. Ambos tienen regresiones.

## Publicación y pendientes

Commits locales identificados por HU-018: `82ebb2f` (API/BD/contrato/pruebas), `9737fdd` (Web/integración/regresiones) y el commit de esta documentación; sin push por instrucción actual. Sin nueva rama/PR, merge, despliegues ni cambios en Supabase. `feature/api-client-initial-record` y PR #22 intactos. [Recorrido breve](prueba-web-manual.md) preparado, sin atribuir pruebas humanas. D0.8/10, revisión independiente, deuda previa de formato y TT-010 transversal siguen visibles.
