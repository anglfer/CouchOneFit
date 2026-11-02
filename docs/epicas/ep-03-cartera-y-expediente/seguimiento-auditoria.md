# EP-03 — Seguimiento de auditoría, 31/oct/2026

Rama: `feature/api-client-portfolio`. Parte de la [auditoría inicial](auditoria-2026-10-31.md), sobre el commit `3739ab4ae7caadaa00bc2470e162a8b8adc5afd8`. La persona usuaria autorizó corregir lo propio de EP-03 y dejar las dependencias de otras HU en sus sprints, sin implementar esas épicas aquí. No se cambia el alcance V2, los responsables ni los SP, y no se acredita revisión independiente.

## Correcciones del incremento actual

- [x] Reproducir la búsqueda fallida `😀 ána` → `Literal 😀 Ána` en PostgreSQL 17.6, locale C: falla antes de la corrección.
- [x] Aplicar `lower(... COLLATE pg_catalog.pg_c_utf8)` a ambos operandos en `professional/repositories/portfolio.ts`. Solo cambia la comparación de nombres: no modifica esquema, datos, índices, cursores, permisos o cupo. Requiere PostgreSQL 17+ / UTF8, compatible con la plataforma documentada. No depende de ICU ni del locale de la base. `á` y `a` siguen siendo distintos; no se agrega búsqueda sin acentos, por correo ni normalización Unicode adicional.
- [x] Agregar regresión que fuerza columna C y prueba mayúsculas acentuadas, emoji, acentos distintos y dos propietarios. Suite de aislamiento posterior: **33/33** en locale C; incluye las pruebas de paginación, propiedad, edición, estados y perfil propio existentes.
- [x] Normalizar finales de línea de nueve archivos Web de expediente y pruebas; su contenido versionado ya tenía el formato esperado. Añadir reglas LF exactas en `apps/web/.gitattributes` para conservar el resultado en futuros checkouts Windows. No se reformatean archivos de otras features ni se cambia el comportamiento React.
- [x] Actualizar contrato de búsqueda en OpenAPI, HU-016 y guía BD con requisito PostgreSQL/UTF8 y consulta de comprobación. No se cambian migraciones aplicadas ni se crea una migración de datos innecesaria.
- [x] Actualizar plan, referencias de HU afectadas y relevo con entregables, responsables, sprints y condiciones de aceptación.
- [x] Reparar enlaces locales del plan que apuntaban a rutas de la raíz como si estuvieran dentro de `plan/`; se mantienen las fuentes y el texto histórico.

## Redistribución vigente por instrucción de la persona usuaria

La [matriz del plan §10](../../../plan/PLAN_TRABAJO_V2.md#seguimiento-ep03) sustituye la asignación anterior a S3–S5/Franela. El orden es EP-04 → EP-05 → EP-06 → EP-07 → EP-08. Cada HU fuente entrega su conexión y pruebas como parte de esa misma épica; no deja un servicio pendiente de integración en EP-03.

| Pendiente de producto trasladado | Destino y ejecutor de módulo + conexión | Criterio de entrega |
| --- | --- | --- |
| Evaluaciones/evolución del expediente | EP-04, HU-021/022, Pukzil | API/contrato/UI conectados, datos/vacío/error, origen/fechas/unidades y conservación; sin depender aún de peso móvil. |
| Alimentación del expediente | EP-05, HU-026, Pukzil | Plan activo/versionado visible en expediente, V1/V2 y permisos probados. |
| Entrenamiento del expediente | EP-06, HU-030, Ferxxo | Rutina activa/versionada visible en expediente y móvil, descanso, aislamiento e historia intacta. |
| Seguimiento y peso del expediente | EP-07, HU-033/037, Ferxxo | Fuentes reales conectadas, peso/carga separados y peso móvil incorporado a los consumidores de evolución existentes. |
| Progreso autorizado del perfil móvil, RDC0204 | EP-07, HU-036, Pukzil | Conexión al perfil existente, permisos default off, categoría/periodo y revocación efectiva; API/móvil/contrato/tests juntos. |
| Históricos reales y fixture integral | QA de cada HU fuente; HU-033-QA1 coordina regresión con secciones previas en EP-07 | Edición/inactivación/reactivación/cambio de versión conserva registros no vacíos; no basta probar el lector aislado. |
| Deuda global de formato | TT-013/019 y dueños de archivos | Coordinación y comprobación global; 60 avisos documentados fuera de los nueve archivos atendidos. |

**Qué queda propio de EP-03:** la auditoría no identificó otro defecto funcional base pendiente tras corregir Unicode. HU-015–018 y la base implementada de HU-019/020 conservan sus pruebas/evidencia y requieren revisión independiente/aceptación D0 aplicable. No se acredita esa revisión por mover tareas. TT-010 transversal y DEC-011/015 mantienen sus responsables y condiciones; no se presentan como funcionalidades faltantes del expediente base.

**Cambio de alcance de entrega:** HU-019 queda acotada a base del expediente/disponibilidad de secciones y HU-020 a perfil base propio; las conexiones futuras antes incluidas en su cierre pasan explícitamente a las HU de la tabla. RDF0404/RDC0204 siguen pendientes como requisitos del producto hasta sus entregas fuente. No se afirma que estén implementados ni se eliminan del backlog; EP-03 ya no espera su implementación para aceptar su alcance base. Franela puede revisar puntos compartidos sin ser ejecutora obligatoria de una etapa posterior.

Hasta cada entrega se conserva el estado no integrado; no se inventan datos, tablas, vacíos consultados ni permisos anticipados. Cada módulo modifica los archivos compartidos necesarios en su propia entrega coordinada. No se altera D0 general: se redistribuyen criterios/tareas concretos y se conserva trazabilidad, sin duplicar HU/SP; el esfuerzo se revisa al comprometer cada épica.

## Verificación posterior a la corrección

La redistribución posterior solo modifica documentación: se comprobaron siete documentos, 97 enlaces locales sin destinos faltantes y siete notas de integración con IDs de tareas válidos. No se repiten suites de producto por este cambio documental; los resultados siguientes pertenecen a la corrección funcional anterior.

| Comprobación | Resultado |
| --- | --- |
| API build | Aprobado. |
| API aislamiento, base C y regresión columna C | 33/33 aprobadas. |
| API suite completa en base C | 121/121 aprobadas (113.6 s), incluida migración limpia/actualización, aislamiento, cupo, concurrencia, atomicidad y sesiones. |
| Web build + PWA | Aprobado. |
| Web tests | 36/36 aprobadas. |
| Web lint | Aprobado. |
| Formato de los nueve archivos EP-03 | Aprobado; reglas Git LF comprobadas. |
| Formato global Web | 60 avisos fuera de los nueve archivos atendidos; asignados a S6. |
| OpenAPI/referencias y enlaces documentales | 56 referencias OpenAPI y 107 enlaces locales de los ocho documentos revisados, sin destinos faltantes; ancla de seguimiento comprobada. No equivale a validar semánticamente todas las respuestas HTTP futuras. |

Solo se usan bases temporales locales en loopback. Una ejecución de la suite completa se interrumpió por `ECONNRESET`: faltaban archivos auxiliares del paquete PostgreSQL temporal (`share/timezonesets`). Se restauraron archivos locales faltantes del paquete ya disponible y se repite la suite; esa ejecución interrumpida no se acredita como regresión funcional ni como prueba aprobada.

Móvil no cambia en este incremento: la auditoría previa registró 41/41 y análisis sin incidencias; no son ejecuciones nuevas. No se repite recorrido humano de navegador/Android, no se modifican datos compartidos ni se realizan commit/push/PR/merge/despliegue. La aceptación de cada HU fuente exige su conexión y pruebas futuras; la aceptación de la base EP-03 exige su propia revisión independiente, sin esperar a implementar las fuentes trasladadas.
