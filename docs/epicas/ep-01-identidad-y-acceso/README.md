# EP-01 — Identidad y acceso

Identidades, registro, autenticación y ciclo de sesión. La API controla privilegios y estado; Web consume la API del mismo origen. PostgreSQL en Supabase almacena identidad propia de la aplicación, no Supabase Auth.

| Historia | Documentación | Estado |
| --- | --- | --- |
| HU-001 — Registrar cuenta profesional | [Contrato, flujo y pruebas](hu-001/README.md), [plan de implementación](hu-001/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |
| HU-002 — Iniciar sesión profesional | [Contrato, flujo y pruebas](hu-002/README.md), [plan de implementación](hu-002/plan-implementacion.md) | Implementada y probada localmente; revisión independiente y despliegue no acreditados. |

HU-002 depende de HU-001. La base de refresh/logout ya permite una sesión revocable; HU-005 conserva integración móvil y transversal. Bootstrap administrativo, activación del cliente y recuperación mantienen sus historias: no se dan por implementados al tener las tablas de usuarios/sesiones.

Modelo compartido: [tablas, relaciones, índices, permisos, transacciones y funciones](../../database/modelo-identidad-acceso.md). Inicial consolidada: `202610150001_inicial_identidad_acceso.sql`. [Esquema integrado](../../database/schemas/README.md), actualizado con cada módulo.
