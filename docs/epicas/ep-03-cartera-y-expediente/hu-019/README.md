# HU-019 — Expediente profesional consolidado: incremento parcial

29/10/2026. Implementación parcial del perfil real y composición extensible. HU-019 no está completa: las dependencias de otros módulos todavía no están integradas. D0, revisión independiente y TT-010 transversal permanecen abiertos.

## Fuentes y alcance

[Plan vigente](../../../../plan/PLAN_TRABAJO_V2.md), HU-019 (RDF0404, RNF07/13/18), DEC-004/006/009 y D0 §5.2; [requerimientos](../../../requirements/sistema-interno.md), RDF0404; DEVELOPMENT y convenciones BD. Perfil/objetivo/medidas base reutilizan HU-015/016/017/018. No se implementan las épicas de alimentación, entrenamiento, evaluaciones o seguimiento.

La persona usuaria reportó aviso previo al equipo para los cambios compartidos HU-019. No se acredita aprobación ni revisión de otro integrante. La implementación fue realizada por el asistente por autorización de la persona usuaria; Franela conserva integración/coordinación. Única rama: feature/api-client-portfolio; commits por HU, sin nuevo PR ni publicación en este paso. PR #22 y su rama se conservan intactos.

## Contrato implementado

GET /api/clients/:clientId/record devuelve { record: { profile, sections } }. [OpenAPI](../../../api/identity-lifecycle.openapi.json) define el contrato. profile es la misma proyección explícita ClientBaseRecord de GET /api/clients/:clientId, que permanece compatible. La composición invoca readPortfolioRecord una sola vez, conserva sesión persistida, propiedad, elegibilidad profesional DEC-004, transacción/contexto RLS y rol runtime ordinario. No acepta filtros ni identidades adicionales por query. No requiere nuevos permisos, tablas o migraciones.

sections contiene nutritionPlan, trainingPlan, evaluations, progress y bodyWeightHistory. En producción todas devuelven únicamente { status: 'not_integrated' }, sin registros ficticios. El sobre reserva empty para ausencia confirmada por un lector real autorizado y error/QUERY_FAILED para un fallo recuperable de una sección real futura. Son estados de composición, no contratos de datos aprobados para módulos ajenos; no existe todavía un estado con payload de esos módulos.

La consulta del perfil disponible falla de forma global: 400 UUID/query inválidos, 401 sesión, 403 rol, 404 ajeno/inexistente/no disponible indistinguibles y 503 fallo SQL seguro. Nunca se convierte una denegación o error del perfil en expediente vacío o parcial. Cache-Control: no-store. No se altera invitación, activación, cuenta, suscripción, cupo, editor ni transiciones existentes.

## Web y semántica

La ficha /app/clientes/:clientId carga el agregador una sola vez y reutiliza editor y cambio de estado anteriores. Permite actualizar la lectura explícitamente. Clave por cuenta/cliente y descarte de respuestas obsoletas impiden conservar el expediente de A al abrir B. Carga, error recuperable y módulos no disponibles son distintos. «Sin registrar» corresponde a campos base null; «Sin registros» no se muestra para un módulo ausente.

DEC-006: peso base en kg y medidas iniciales son datos reales del perfil, separados de peso corporal histórico, evaluación y carga por serie. No existe fecha de medición base: no se usa created_at ni fecha de edición para inventarla. DEC-009 mantiene separadas medidas iniciales y progreso con permisos; este incremento no implementa ni concede permisos de progreso. No se acreditan conservación de tablas históricas inexistentes ni versiones de planes todavía no implementadas. DEC-011/015 para datos reales siguen vigentes; las pruebas usan datos sintéticos locales.

## Dependencias pendientes

| Integración | Artefactos necesarios del módulo responsable | Estado actual |
| --- | --- | --- |
| Evaluaciones HU-021 | Servicio autorizado, proyección y fechas reales | No integrado |
| Evolución HU-022 | Series por periodo, origen/unidad/fechas y permisos | No integrado |
| Alimentación HU-026 | Lectura real del plan activo/versionado y conservación histórica | No integrado |
| Entrenamiento HU-030 | Lectura real de rutina activa/versionada y conservación histórica | No integrado |
| Seguimiento HU-033 | Fuentes HU-031/032, consulta y proyección autorizadas | No integrado |
| Peso HU-037 | Eventos con origen, instante/fecha local/zona y unidad propios | No integrado |

Los catálogos y planes SaaS existentes no son prescripciones ni evaluaciones. No se implementan servicios vacíos, tablas históricas o datos de ejemplo para aparentar integración. Ver [guía de integración](integracion.md), [evidencia](validacion-local.md) y recorrido manual allí descrito.
