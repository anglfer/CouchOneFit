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

EP-01 incorpora también [HU-005](ep-01-identidad-y-acceso/hu-005/README.md), [HU-006](ep-01-identidad-y-acceso/hu-006/README.md) y [HU-009](ep-01-identidad-y-acceso/hu-009/README.md). [Evidencia conjunta HU-006–009](ep-01-identidad-y-acceso/evidencia-hu-006-009.md), que conserva también la de HU-007/008.

**Regla de dependencias:** cada épica depende solo de épicas anteriores y de sus propias HU. Por eso, el 02/nov/2026 HU-007 (invitación) y HU-008 (activación) se reubicaron de EP-01 a EP-03: necesitan el expediente HU-015 y el cupo HU-013. Conservan ID, responsables y evidencia.

La asignación a sprints permanece en [el plan de trabajo](../../plan/PLAN_TRABAJO_V2.md). Las reglas transversales están en [convenciones de BD](../database/convenciones.md), el [modelo de identidad y acceso](../database/modelo-identidad-acceso.md) y las guías de [arquitectura](../architecture/README.md).

EP-02 incorpora [SaaS y administración — HU-010 a HU-014](ep-02-saas-y-administracion/README.md), con contratos, matriz de cumplimiento y evidencia.

EP-03 incorpora [Cartera y expediente](ep-03-cartera-y-expediente/README.md): [HU-015](ep-03-cartera-y-expediente/hu-015/README.md), [HU-007 — Invitación](ep-03-cartera-y-expediente/hu-007/README.md), [HU-008 — Activación móvil](ep-03-cartera-y-expediente/hu-008/README.md), [HU-016](ep-03-cartera-y-expediente/hu-016/README.md), [HU-017](ep-03-cartera-y-expediente/hu-017/README.md), [HU-018](ep-03-cartera-y-expediente/hu-018/README.md), [HU-019 (parcial)](ep-03-cartera-y-expediente/hu-019/README.md) y [HU-020 (perfil base)](ep-03-cartera-y-expediente/hu-020/README.md), con [estado e integración](ep-03-cartera-y-expediente/estado-e-integracion.md). Las historias de otras épicas no se crean hasta que entren en alcance.

EP-06 incorpora [Entrenamiento](ep-06-entrenamiento/README.md): HU-028 a HU-031 (rutina, historial, activación móvil y registro por serie con RPE/RIR), con la decisión del usuario del 04-nov-2026 que amplía DEC-006.
