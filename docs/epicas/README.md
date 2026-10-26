# Épicas e historias de usuario

La documentación de cada historia se organiza por épica y por ID estable. No se organiza por sprint: la planificación puede cambiar sin mover contratos o referencias de implementación.

```text
docs/epicas/
  README.md
  ep-01-identidad-y-acceso/
    README.md
    hu-001/
      README.md
      plan-implementacion.md
    hu-002/
      README.md
      plan-implementacion.md
    hu-003/
      README.md
    hu-004/
      README.md
      plan-implementacion.md
```

| Épica | Historias documentadas |
| --- | --- |
| [EP-01 — Identidad y acceso](ep-01-identidad-y-acceso/README.md) | [HU-001 — Registro profesional](ep-01-identidad-y-acceso/hu-001/README.md), [HU-002 — Acceso profesional](ep-01-identidad-y-acceso/hu-002/README.md), [HU-003 — Acceso administrativo](ep-01-identidad-y-acceso/hu-003/README.md), [HU-004 — Acceso posterior cliente](ep-01-identidad-y-acceso/hu-004/README.md) |

Cada HU documenta propósito, alcance, dependencias, contrato HTTP, recorrido, funciones y persistencia involucradas, errores, pruebas y estado real. Su plan de implementación y evidencia local viven dentro de la misma carpeta. Las nuevas épicas/historias se añaden cuando se trabajen, sin crear carpetas vacías para todo el backlog.

EP-01 incorpora también [HU-005](ep-01-identidad-y-acceso/hu-005/README.md), [HU-006](ep-01-identidad-y-acceso/hu-006/README.md), [HU-007](ep-01-identidad-y-acceso/hu-007/README.md), [HU-008](ep-01-identidad-y-acceso/hu-008/README.md) y [HU-009](ep-01-identidad-y-acceso/hu-009/README.md). [Evidencia conjunta HU-006–009](ep-01-identidad-y-acceso/evidencia-hu-006-009.md).

La asignación a sprints permanece en [el plan de trabajo](../../plan/PLAN_TRABAJO_V2.md). Las reglas transversales están en [convenciones de BD](../database/convenciones.md), el [modelo de identidad y acceso](../database/modelo-identidad-acceso.md) y las guías de [arquitectura](../architecture/README.md).

EP-02 incorpora [SaaS y administración — HU-010 a HU-014](ep-02-saas-y-administracion/README.md), con contratos, matriz de cumplimiento y evidencia.
