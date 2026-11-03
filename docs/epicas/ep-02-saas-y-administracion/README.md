# EP-02 — SaaS, autoservicio y pago simulado (HU-010 a HU-014)

> **Acuerdo de visión 30-oct-2026 ([DEC-017](../../../plan/PLAN_TRABAJO_V2.md#dec-017--acuerdos-de-visión-del-30-de-octubre-de-2026)) — implementado el 02-nov-2026** (migraciones `202611020001`–`202611020003`, ver [ciclo de vida de la suscripción](#ciclo-de-vida-dec-017)): renovación automática simulada con 7 días de gracia, cancelación al final del periodo pagado, bajar de plan eligiendo qué clientes inactivar, y soporte de lectura del administrador con bitácora. Pendientes por depender de un proveedor externo: envío real de correos y notificaciones push, e invitación por correo (requiere el correo del cliente en el expediente). El resto de este documento conserva el acuerdo del 25-oct, que sigue vigente salvo donde esta sección lo amplía.

## Ciclo de vida (DEC-017)

- **Renovación simulada y perezosa:** el API no tiene programador de tareas (Render Free se duerme, DEC-013). `private.renew_subscription` se ejecuta al leer la suscripción, al listar/leer la cartera y antes de cada operación que valida cupo. Si el periodo venció y el método simulado es `test_approved`, cobra el precio completo del plan vigente (registro `simulated_payments.kind='renewal'`) y avanza `expires_at` un mes por periodo vencido. Una ausencia larga cobra los periodos transcurridos. Un cron externo autorizado podría invocarla por profesional; no hay uno hoy.
- **Cobro fallido y gracia:** con `test_declined`/`test_error` se registra un cobro `failed` y `grace_until = expires_at + 7 días`. Durante la gracia (`status: "grace"`) el acceso es completo; cambiar el método a `test_approved` recupera el plan en el siguiente acceso. Pasada la gracia, `expired`: clientes solo leen (DEC-004).
- **Cancelar:** `PATCH /api/me/subscription {cancelAtPeriodEnd}` rige hasta el final del periodo pagado, no renueva y se puede revertir mientras haya acceso. Un checkout aprobado limpia cancelación y gracia.
- **Bajar de plan:** `POST /api/me/subscription/downgrade {planId, inactivateClientIds}`. Decisión de producto no especificada por DEC-017: **aplica de inmediato, sin devolución, conserva el periodo pagado y el precio menor rige desde la siguiente renovación**. Atómico: inactiva (con versión y auditoría) los expedientes elegidos y cambia el plan; si aún quedan más activos que el nuevo límite (`DOWNGRADE_EXCESS`) o el plan no es menor (`DOWNGRADE_NOT_LOWER`) no cambia nada.
- **Soporte del administrador:** `GET /api/admin/support/clients`, `POST /api/admin/support/clients/:id/view {reason}`, `GET /api/admin/support/log` y restablecimiento de un cliente vinculado vía `POST /api/accounts/:userId/recovery` con `reason`. Todo por funciones `SECURITY DEFINER` (el runtime no lee expedientes), siempre con motivo y bitácora `private.support_log` visible solo para administradores. No edita expedientes ni suscripciones, no da de baja cuentas ni mueve clientes. Proyección: datos básicos, sin grasa/cintura/cadera.
- **Evidencia:** `tests/subscription-lifecycle.test.ts` (renovación, gracia, cancelación, bajada atómica), `tests/admin-support.test.ts` (roles, motivo, bitácora, sin edición) y UI en `SubscriptionLifecycle.tsx` / `SupportPanel.tsx` (**T/E**, sin recorrido humano **R**). Las pruebas de expiración existentes fijan `cancel_at_period_end` para modelar un plan vencido sin renovación.

## Regla vigente — acuerdo explícito del usuario 25-oct-2026

El profesional contrata su primer plan y sube de nivel desde `/app/suscripcion`. Paga **el precio completo del nuevo plan** mediante simulación y comienza **un nuevo mes calendario UTC desde la aprobación**, ajustando el último día al mes destino. Sin prorrateo ni devolución del periodo previo. El administrador **solo consulta suscripciones**: no cambia plan, vigencia ni estado. Conserva gestión del catálogo HU-010.

Esto sustituye DEC-005/014 y la gestión administrativa anterior de HU-012. HU-039 no contenía un checkout posterior: se amplía la ruta de acceso al autoservicio tras registro/login. Registrar cuenta no activa ni reserva capacidad.

Fuentes: [plan de trabajo](../../../plan/PLAN_TRABAJO_V2.md), [acuerdo de requisitos](../../requirements/README.md), [diseño confirmado](../../superpowers/specs/2026-10-25-autoservicio-pago-simulado-design.md), [plan de implementación](../../superpowers/plans/2026-10-25-autoservicio-pago-simulado.md). No cargos bancarios, proveedor externo, claves de pasarela, datos financieros reales ni renovación automática.

## Matriz de cumplimiento

| HU | Comportamiento vigente |
| --- | --- |
| HU-010 | Catálogo administrativo con límites enteros, ilimitado explícito/null, precios finitos, duplicados normalizados, confirmación de impacto y auditoría transaccional. Catálogo inicial Básico10/$299, Pro30/$599, Élite ilimitado/$999 MXN/mes. |
| HU-011 | Plan/estado/uso/restante/exceso/vigencia propios. Sin plan: 0 plazas, ilimitado false. Mi suscripción permite contratar y mejorar sin intervención administrativa. |
| HU-012 | Checkout del profesional con cotización, precio completo, tarjetas ficticias, procesamiento y resultado persistidos, comprobante e historial. Aprobación + activación + auditoría en una transacción. Admin solo lectura. |
| HU-013 | Creación/reactivación reservan capacidad bajo bloqueo por profesional. Invitar/canjear activos no reserva otra plaza. Cuenta/expediente independientes. Exceso histórico o cambio de catálogo bloquea solo consumidores nuevos. |
| HU-014 | Directorio paginado, filtro/búsqueda, estado de cuenta separado de suscripción, activos/inactivos/vigencia. Sin controles de edición ni datos físicos/nutricionales. |

## Checkout y simulador

1. Consultar catálogo real y elegir primera contratación o plan de mayor capacidad si el actual está activo y vigente.
2. Crear cotización propietaria válida 10 minutos. Guarda snapshot de catálogo/suscripción y precio MXN en centavos.
3. Mostrar total, regla del nuevo periodo y un formulario de pago con lenguaje de producto. Métodos preconfigurados `test_approved`, `test_declined`, `test_error`; no PAN/CVV ni datos bancarios reales.
4. Confirmar con CSRF. Servidor registra `processing` durante dos segundos; la UI consulta el resultado, sin decidirlo por una animación.
5. Aprobado: `succeeded`, plan activo, nuevo mes y comprobante. Rechazo/error: `failed`; cancelación: `cancelled`. Plan anterior intacto si no se aprueba.
6. Recargar recupera operación/historial. Idempotencia por profesional evita duplicación; una operación abierta por cuenta. Repetir confirmación/finalización no cambia dos veces la suscripción.

Estados cerrados inmutables por las rutas de producto. El historial muestra las últimas 50 operaciones; un ID recuperado puede consultarse directamente si pertenece al profesional. Cotización vencida/obsoleta exige nueva operación. Si el catálogo o la suscripción cambian durante el proceso, la operación falla sin activar. Una suspensión antigua sigue representada en lecturas; una cuenta activa puede contratar un periodo nuevo, dado que ya no existe suspensión administrativa en este alcance.

## Contratos HTTP

Sesión privada, autorización por rol/ownership y `Cache-Control: no-store`. Mutaciones Web requieren Origin/token CSRF. Error `{error:{code,message}}`.

| Método/ruta | Rol | Contrato |
| --- | --- | --- |
| GET `/api/admin/plans` | admin | Catálogo administrativo. |
| POST `/api/admin/plans`; PUT `/api/admin/plans/:id` | admin | `{name,maxClients,isUnlimited,priceMxn,isActive?}`; catálogo auditado. |
| GET `/api/admin/professionals` | admin | `page`, `pageSize`, `search`, `status`; directorio mínimo paginado. |
| Cualquier método `/api/admin/professionals/:id/subscription` | admin | 403 `SUBSCRIPTION_READ_ONLY`; no modificación de suscripciones. |
| GET `/api/me/subscription` | profesional | `{subscription:{planId,planName,status,limit,isUnlimited,used,remaining,excess,expiresAt}}`. |
| GET `/api/me/plans` | profesional | Planes disponibles persistidos. |
| POST `/api/me/payments` | profesional | `{planId,idempotencyKey}` UUID; 201 `{payment}` propietario. Repetir clave/plan recupera misma operación. |
| GET `/api/me/payments` | profesional | `{payments}` historial propio. |
| GET `/api/me/payments/:id` | profesional | `{payment}` y resolución del procesamiento ya autorizado al cumplirse el plazo. |
| POST `/api/me/payments/:id/confirm` | profesional | `{instrument:test_approved/test_declined/test_error}`; inicia procesamiento sin tarjeta real. |
| POST `/api/me/payments/:id/cancel` | profesional | `{}`; cancela antes de completarse. Si ya terminó, devuelve su resultado definitivo. |
| POST `/api/clients`; PATCH `/api/clients/:id/status` | profesional dueño | Alta/reactivación consumen cupo; inactivar libera. HU-018 exige status/version para cambiar estado, audita transiciones y reconoce repeticiones sin efectos, conservando cuenta/suscripción independientes. |

Pago: `id`, `planId`, `planName`, `limit`, `isUnlimited`, `amountCents`, `currency`, `status`, `failureCode`, `instrument`, `createdAt`, `quoteExpiresAt`, `processingAfter`, `completedAt`, `periodStart`, `periodEnd`, `simulated:true`. No secretos financieros. Errores relevantes `PAYMENT_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `UPGRADE_REQUIRED`, `CHECKOUT_STALE`, `QUOTE_EXPIRED`, `PAYMENT_CLOSED`; resultado fallido `PAYMENT_DECLINED`/`PROCESSOR_ERROR`.

## Persistencia y seguridad

Migraciones previas inmutables; `202610260001_saas_integrity.sql` conserva correcciones anteriores. Nueva `202610260002_simulated_checkout.sql`: operaciones propias con RLS/idempotencia, retiro de INSERT/UPDATE de suscripciones del runtime y función `private.apply_simulated_payment(uuid)` de privilegios restringidos. La función verifica actor profesional/cuenta activa, operación propia aprobable, plazo y snapshots antes de cambiar plan y auditar atómicamente. No EXECUTE público. El runtime conserva solo UPDATE(id) para locks del canje existente.

Diez migraciones reflejadas en esquema integrado. Reutilización del bloqueo por profesional y sesión de identidad; API calcula y valida importes. Regresión cuenta/expediente: reactivar cuenta no activa expediente ni consume cupo. No edición de migraciones aplicadas ni pérdida de clientes/historial.

## Validación y límites

Pruebas con PostgreSQL local aislado y runtime restringido: catálogo/permisos/cupos, contratos de checkout, éxito y nuevo periodo, rechazo/error/cancelación, duplicación concurrente, propiedad, importe/instrumento manipulado, cotización vencida/obsoleta y rollback ante fallo de auditoría. Suite previa de identidad y comparación migraciones/esquema se ejecutan con el incremento. Build API/Web, typecheck, lint/formato Web y recorrido en navegador se verifican antes del cierre.

Sin despliegue ni migraciones en producción. La captura previa [cupo agotado](artifacts/cupo-agotado.png) documenta la protección de plazas; la evidencia de checkout se añade tras el recorrido actual. Las credenciales retiradas de `.env.example` requieren rotación externa: quitarlas no revoca el secreto ni borra el historial Git.

### Evidencia local — revisión 25-oct-2026

Suite API completa: **75/75 pruebas**, sin omisiones, con PostgreSQL local y runtime restringido; incluye las cinco pruebas agrupadas del checkout y regresiones de identidad/cupos. Compilación/typecheck API y Web, lint Web y formato de archivos afectados satisfactorios. Revisión adicional sin bloqueantes; se corrigieron textos de autoservicio y título de pantalla.

Navegador con datos sintéticos: primera contratación Básico por $299, upgrade Pro rechazado sin cambiar Básico, nuevo intento aprobado por $599 íntegros y nuevo mes, recarga con recuperación de la misma referencia y comprobante, cupo actualizado a 30 e historial conservado. Admin consulta Pro/vigencia/uso sin botones de edición. [Comprobante de upgrade simulado](artifacts/checkout-pro-aprobado.png). No se realizó ningún cargo ni operación cloud.

## Presentación de pagos y catálogo unificado — acuerdo 25-oct-2026

Por instrucción posterior del usuario, la GUI usa «Pago», «Procesando tu pago», «Comprobante de pago» e «Historial de pagos», sin avisos de modo de prueba ni etiquetas de simulación. La implementación interna sigue siendo ficticia: instrumentos preconfigurados, sin cobros reales ni datos bancarios introducidos por el usuario. Esta presentación sustituye la exigencia anterior de mostrar una advertencia visible; no modifica el motor ni sus garantías transaccionales.

Portada, registro y checkout usan el catálogo activo persistido a través de `GET /api/plans` (público, proyección mínima, `no-store`). Se retiran nombres/precios/límites fijos del frontend. Las vistas abiertas refrescan al recuperar foco/visibilidad y cada 60 segundos en primer plano. Catálogo/directorio administrativo y resumen profesional se actualizan con la misma cadencia. Los planes desactivados dejan de ofrecerse; las cotizaciones obsoletas se rechazan y los comprobantes históricos conservan sus importes originales.

El registro acepta `planInterestId` UUID opcional para cualquier plan del catálogo, lo valida y conserva en `professionals.plan_interest_id`; mantiene `planInterest` histórico para compatibilidad, sin admitir ambos simultáneamente. Migración incremental `202610260003_live_plan_catalog.sql`; diez migraciones en esquema integrado. No activa suscripción por registrar interés.

Validación actual: **76/76 pruebas API**, compilación/typecheck API/Web, lint y formato de los archivos afectados. Prueba adicional: cambio de nombre/precio/capacidad, reflejo público/profesional/administrativo, interés de registro para plan personalizado y rechazo de cotización/plan retirado. Navegador: edición administrativa de Élite a Élite Plus por 1,199 MXN, reflejo en portada y registro, checkout con el mismo importe y comprobante con los nuevos textos. [Evidencia visual](artifacts/pago-catalogo-actualizado.png).
