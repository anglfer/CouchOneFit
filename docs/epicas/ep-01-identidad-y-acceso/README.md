# EP-01 — Identidad y acceso

> **Acuerdo de visión 30-oct-2026 ([DEC-017](../../../plan/PLAN_TRABAJO_V2.md#dec-017--acuerdos-de-visión-del-30-de-octubre-de-2026)):** pendientes de implementar en esta épica: el administrador podrá generar el reseteo de contraseña de clientes como soporte (HU-009 hoy solo cubre profesionales y admins), y correos y push. El envío de la invitación por correo se trasladó con HU-007 a [EP-03](../ep-03-cartera-y-expediente/README.md). Sin verificación de correo por enlace. Hasta entonces rigen los contratos de abajo.

Identidades, registro, autenticación y ciclo de sesión. La API controla privilegios y estado; Web consume la API del mismo origen. PostgreSQL en Supabase almacena identidad propia de la aplicación, no Supabase Auth.

| Historia | Documentación | Estado |
| --- | --- | --- |
| HU-001 — Registrar cuenta profesional | [Contrato, flujo y pruebas](hu-001/README.md), [plan de implementación](hu-001/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |
| HU-002 — Iniciar sesión profesional | [Contrato, flujo y pruebas](hu-002/README.md), [plan de implementación](hu-002/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |
| HU-003 — Acceso administrativo separado | [Contrato, provisión y pruebas](hu-003/README.md) | Implementada; migración y seed aplicadas en Supabase, HTTP/navegador local verificados; revisión independiente y despliegue pendientes. |
| HU-004 — Acceder posteriormente como cliente | [Contrato, flujo y pruebas](hu-004/README.md), [plan de implementación](hu-004/plan-implementacion.md) | Implementada y probada localmente en BD, API y Móvil; revisión independiente y despliegue pendientes. |
| HU-005 — Cerrar sesión, expirar y renovar de forma segura | [Contrato, flujo y pruebas](hu-005/README.md), [plan de implementación](hu-005/plan-implementacion.md) | Implementada y probada localmente en BD, API, Web y Móvil; revisión independiente y despliegue pendientes. |
| HU-006 — Modificar credenciales cliente | [Contrato y pruebas](hu-006/README.md), [trazabilidad](hu-006/plan-implementacion.md) | Implementación local; [evidencia y gates D0](evidencia-hu-006-009.md). |
| HU-009 — Recuperación asistida | [Contrato y runbook](hu-009/README.md), [trazabilidad](hu-009/plan-implementacion.md) | Implementación local; [evidencia y gates D0](evidencia-hu-006-009.md). |

**Reubicación 02/nov/2026:** HU-007 (invitación) y HU-008 (activación móvil) pasaron a [EP-03](../ep-03-cartera-y-expediente/README.md) porque dependen del expediente HU-015 y del cupo HU-013; EP-01 ya no depende de épicas posteriores. Su evidencia histórica sigue en [evidencia HU-006–009](evidencia-hu-006-009.md).

HU-002 depende de HU-001. HU-003 amplía su autenticación común con autorización separada y provisión administrativa. HU-004 incorpora la tabla `private.clients`, autenticación móvil con tokens `Bearer` y restauración segura del expediente para clientes vinculados (con cuenta vinculada fixture; HU-008 en EP-03 comprueba el acceso tras una activación real). HU-005 consolida el cierre inmediato en servidor, la expiración de JWT a 15 minutos y absoluta a 30 días, la rotación segura con revocación de familia ante replay, la invalidación por inactivación de cuenta y la limpieza de estado/almacenamiento seguro en Web y móvil.

Modelo compartido: [tablas, relaciones, índices, permisos, transacciones y funciones](../../database/modelo-identidad-acceso.md). Inicial consolidada: `202610150001_inicial_identidad_acceso.sql`. [Esquema integrado](../../database/schemas/README.md), actualizado con cada módulo.
