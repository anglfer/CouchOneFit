# HU-015 — Crear el cliente y su expediente inicial

## Alcance implementado

Un profesional autenticado con suscripción activa crea un solo expediente en `private.clients`. La propiedad se obtiene de su sesión y nunca de un campo del payload; no se crean credenciales de cliente, otra cuenta ni un segundo expediente. La creación y la reserva de cupo comparten la misma transacción y bloqueo por profesional de HU-013.

El formulario Web captura nombre, fecha de nacimiento, estatura, peso base, objetivo y medidas opcionales. La confirmación se muestra solo tras recibir `201`; los errores de validación del servidor se muestran junto al campo correspondiente.

## Contrato

`POST /api/clients` requiere sesión Web de profesional, CSRF y el siguiente JSON estricto:

| Campo API / SQL | Obligatorio en alta | Unidad y validación |
| --- | --- | --- |
| `fullName` / `full_name` | Sí | Texto recortado, 2–150 caracteres. |
| `birthDate` / `birth_date` | Sí | Fecha calendario válida de una persona de 18 años o más. |
| `heightCm` / `height_cm` | Sí | cm, 100–250, incrementos de 0,1. |
| `weightKg` / `weight_kg` | Sí | kg, 30–300, incrementos de 0,1. |
| `goal` / `goal` | No | Texto 1–500 o `null`. |
| `bodyFatPercentage` / `body_fat_percentage` | No | %, 2–60, incrementos de 0,1; medición, no cálculo. |
| `waistCm` / `waist_cm` | No | cm, 40–250, incrementos de 0,1. |
| `hipCm` / `hip_cm` | No | cm, 50–250, incrementos de 0,1. |

Campos no declarados, incluido `professionalId`, se rechazan. La respuesta `201` devuelve `{client}` con las mismas medidas, `id` y `status: "active"`. Los errores de validación usan `400 INVALID_INPUT` y pueden incluir `error.fields`; falta de rol/plan/suscripción conserva los errores de autenticación y capacidad existentes.

## Persistencia y compatibilidad

La migración `202610270001_client_initial_record.sql` agrega columnas anulables a `private.clients` y controles SQL de rangos, precisión y conjunto base consistente. Un trigger rechaza fechas que no correspondan a una persona adulta cuando el valor está presente. No actualiza filas existentes ni fabrica datos.

Por ello, un expediente anterior puede tener los campos nuevos en `NULL`; se conserva para cartera, invitación y activación, pero no se presenta como un expediente completo HU-015. Las nuevas altas API siempre incluyen fecha, estatura y peso. No se añade selector de cálculo de grasa: DEC-007 lo reserva para el trabajo posterior de HU-023.

## Seguridad, transacciones y pruebas

`requireProfessional`, CSRF, `lockActor`, el bloqueo de `private.professionals`, `requireCapacity` y la transacción compartida se reutilizan sin aceptar propiedad en JSON. El rol runtime conserva permisos mínimos sobre la misma tabla y RLS verifica que su contexto de profesional sea el dueño al insertar o actualizar. La política de lectura técnica existente no se amplía en esta historia; el aislamiento de lectura de cartera lo hace la API con el profesional autenticado.

Las pruebas locales cubren alta válida, obligatorios/rangos/precisión, rol/plan/cupo, payload de propietario manipulado, aislamiento entre dos profesionales por API y RLS de escritura runtime, carrera por el último cupo y rollback tras un trigger de fallo posterior al `INSERT`. La prueba de migraciones comprueba instalación limpia, paridad con `schemas/identity_access.sql` y actualización de un expediente antiguo sin valores fabricados.

## Fuentes y límites

Reglas de captura: `plan/PLAN_TRABAJO_V2.md`, DEC-006. Flujo de expediente y credenciales: RDF0301, RDF0306 y RDF0401–RDF0403 de la hoja V2 de requerimientos. Contrato HTTP: `docs/api/identity-lifecycle.openapi.json`. Esta entrega no cierra D0: requiere revisión independiente, ejecución local de las verificaciones documentadas y la aprobación del corte coordinado antes de cualquier migración o despliegue compartido.
