# HU-007 — Generar una invitación individual para el expediente

Como profesional quiero generar y entregar un código para vincular a mi cliente al expediente preparado. Referencias: RDF0307, RDC0101, RS08, DEC-003/004/005. Responsable del backlog: Franela Whaite.

## Contrato y recorrido Web

`POST /api/clients/:clientId/invitations` genera o reemplaza una invitación; respuesta `201 { code, expiresAt }`. `DELETE` en la misma ruta revoca mediante eliminación; responde `204`. Requieren sesión profesional persistida, propiedad, Origin permitido y `X-CSRF-Token`. No se aceptan identidades en el cuerpo para autorizar.

En `/app/clientes`, el profesional consulta su cartera preparada, estado de vinculación y expiración. Puede generar/reemplazar, copiar/seleccionar y entregar de forma privada el código, u ocultarlo. Un reemplazo invalida el anterior al confirmar la transacción. Se ofrece revocación. Estados: carga, cartera vacía, error/reintento, envío bloqueado y entrega exitosa. El código solo permanece en memoria mientras se muestra la entrega: no se guarda en navegador ni reaparece en listados. Refrescar obliga a reemplazarlo si se perdió.

`GET /api/clients` devuelve únicamente expedientes propios con suscripción vigente: `id`, `userId`, `fullName`, `goal`, `status`, `invitationExpiresAt`; sin token/hash. No hay listado público. Sin plan o con suspensión, la cartera resulta vacía y no se permite invitar.

## Política y transacción

32 bytes CSPRNG, base64url sin padding (43 caracteres), solo SHA-256 en `private.invitations`. TTL de siete días de reloj servidor; `expires_at <= now` inválido. Una fila por expediente (`UNIQUE(client_id)`), asociación por FK al expediente y, a través de este, al profesional.

La API bloquea expediente, cuenta profesional y suscripción, revalida estado activo del expediente, ausencia de `user_id`, profesional activo y suscripción activa/no vencida. Comprueba propiedad con el usuario de sesión, no con entrada del navegador. Reemplaza mediante UPSERT en la misma transacción y audita sin token ni hash. Revocar borra el temporal y conserva el historial del expediente.

Un expediente activo **ya reservó su plaza**: invitar/canjear no incrementa el recuento ni exige otra plaza. DEC-005 permite invitar esa reserva incluso tras downgrade con exceso; el bloqueo de nuevas altas/reactivaciones pertenece a HU-013. Se introduce la tabla mínima `private.subscriptions` para revalidar ese estado real, sin activar planes automáticamente ni implementar contratación/cobros.

## Prevalidación

`POST /api/auth/activation/prevalidate { code }` es anónimo, devuelve exclusivamente `{ valid: true }` y no revela ID, nombre, profesional o parámetros físicos. Revalida en servidor pero no consume, reserva ni promete validez futura. La activación vuelve a comprobar todo. Un código sustituido, revocado, vencido, ajeno a una reserva válida o ya utilizado devuelve el mismo `400 INVITATION_UNAVAILABLE`.

## Persistencia, errores y pruebas

Migración incremental `202610190003_account_lifecycle.sql`, esquema integrado y [diccionario](../../../database/modelo-ciclo-acceso.md). RLS y permisos privados; contexto `app.client_id` transaccional derivado de sesión o búsqueda privada del hash. Runtime sin DDL ni BYPASSRLS.

`400 INVALID_INPUT` para UUID/código mal formado; `400 INVITATION_UNAVAILABLE` para expediente/código no habilitado; `401` sesión, `403` rol/CSRF, `429` frecuencia y `503` fallo seguro. No se incluyen códigos/contraseñas en errores ni auditoría. La entrega explícita del código en `201` es el único retorno del secreto de invitación.

QA1: expediente ajeno/vinculado/inactivo; profesional/suscripción inactivos; reemplazo/revocación; prevalidación repetible; expiración exacta; código ausente en listado y auditoría; canje real HU-008. Limpieza operativa diaria: `npm run db:cleanup:access` elimina temporales vencidos; no elimina cuentas ni eventos de auditoría.

Dependencias: HU-015 prepara expedientes y HU-013 controla altas/reactivaciones. Esta historia usa sus contratos mínimos persistidos, sin declarar completadas esas historias. Fixtures locales preparan expedientes/suscripciones reales. Estado y gates: [evidencia conjunta](../evidencia-hu-006-009.md).
