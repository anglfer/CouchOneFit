# EP-01 — Identidad y acceso

Identidades, registro, autenticación y ciclo de sesión. La API controla privilegios y estado; Web consume la API del mismo origen. PostgreSQL en Supabase almacena identidad propia de la aplicación, no Supabase Auth.

| Historia | Documentación | Estado |
| --- | --- | --- |
| HU-001 — Registrar cuenta profesional | [Contrato, flujo y pruebas](hu-001/README.md), [plan de implementación](hu-001/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |
| HU-002 — Iniciar sesión profesional | [Contrato, flujo y pruebas](hu-002/README.md), [plan de implementación](hu-002/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |
| HU-003 — Acceso administrativo separado | [Contrato, provisión y pruebas](hu-003/README.md) | Implementada; migración y seed aplicadas en Supabase, HTTP/navegador local verificados; revisión independiente y despliegue pendientes. |
| HU-004 — Acceder posteriormente como cliente | [Contrato, flujo y pruebas](hu-004/README.md), [plan de implementación](hu-004/plan-implementacion.md) | Implementada y probada localmente en BD, API y Móvil; revisión independiente y despliegue pendientes. |
| HU-005 — Cerrar sesión, expirar y renovar de forma segura | [Contrato, flujo y pruebas](hu-005/README.md), [plan de implementación](hu-005/plan-implementacion.md) | Implementada y probada localmente en BD, API, Web y Móvil; revisión independiente y despliegue pendientes. |

HU-002 depende de HU-001. HU-003 amplía su autenticación común con autorización separada y provisión administrativa. HU-004 incorpora la tabla `private.clients`, autenticación móvil con tokens `Bearer` y restauración segura del expediente para clientes vinculados (usando fixture para desarrollo mientras HU-008 implementa el consumo de invitación). HU-005 consolida el cierre inmediato en servidor, la expiración de JWT a 15 minutos y absoluta a 30 días, la rotación segura con revocación de familia ante replay, la invalidación por inactivación de cuenta y la limpieza de estado/almacenamiento seguro en Web y móvil.

Modelo compartido: [tablas, relaciones, índices, permisos, transacciones y funciones](../../database/modelo-identidad-acceso.md). Inicial consolidada: `202610150001_inicial_identidad_acceso.sql`. [Esquema integrado](../../database/schemas/README.md), actualizado con cada módulo.
