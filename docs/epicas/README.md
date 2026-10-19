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
```

| Épica | Historias documentadas |
| --- | --- |
| [EP-01 — Identidad y acceso](ep-01-identidad-y-acceso/README.md) | [HU-001 — Registro profesional](ep-01-identidad-y-acceso/hu-001/README.md), [HU-002 — Acceso profesional](ep-01-identidad-y-acceso/hu-002/README.md), [HU-003 — Acceso administrativo](ep-01-identidad-y-acceso/hu-003/README.md) |

Cada HU documenta propósito, alcance, dependencias, contrato HTTP, recorrido, funciones y persistencia involucradas, errores, pruebas y estado real. Su plan de implementación y evidencia local viven dentro de la misma carpeta. Las nuevas épicas/historias se añaden cuando se trabajen, sin crear carpetas vacías para todo el backlog.

La asignación a sprints permanece en [el plan de trabajo](../../PLAN_TRABAJO_V2.md). Las reglas transversales están en [convenciones de BD](../database/convenciones.md), el [modelo de identidad y acceso](../database/modelo-identidad-acceso.md) y las guías de [arquitectura](../architecture/README.md).
