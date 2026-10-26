# Autoservicio de planes y checkout simulado

Fecha de referencia: 25-oct-2026. Estado: alcance confirmado por el usuario en chat; implementación y validación local completadas. Revisión de constructor completada sin preguntas adicionales.

## Intención confirmada por el usuario

El profesional con cuenta debe contratar y subir de nivel por sí mismo. El administrador no puede cambiarle el plan. El pago debe ofrecer un recorrido completo y convincente de checkout y procesamiento, aunque siempre sea una simulación sin movimiento de dinero.

Esta instrucción sustituye las decisiones anteriores que daban la asignación al administrador y excluían el checkout. La revisión encontró:

- Plan §3.4 DEC-005: cambio inmediato por administrador y solicitud asistida del profesional.
- HU-012: gestión administrativa de estado y cambio de plan.
- DEC-014 y HU-039: portal hacia registro sin pago ni activación.
- RF09/RF10, RDF0903/RDF1003: facultades administrativas anteriores.
- No hay otra HU posterior que entregue el autoservicio y el procesamiento solicitado.

Se actualizarán esas secciones y los contratos de EP-02 conservando las decisiones anteriores como antecedentes fechados, sin inventar IDs RF/RDF ni puntos. HU-011/012 recibirán el autoservicio/checkout; HU-039 conservará acceso público a catálogo/registro y el retorno al plan elegido después del acceso.

## Decisiones confirmadas por el usuario

1. Upgrade vigente: precio completo del nuevo plan y nuevo periodo mensual desde la aprobación. Sin prorrateo, devolución ni saldo a favor.
2. Administrador: solo consulta de suscripciones; no puede modificar plan, vigencia ni estado. Administración del catálogo permanece en HU-010.

No habrá nuevas modificaciones administrativas de estado. Una cuenta activa con suscripción histórica suspendida puede contratar un periodo nuevo; una cuenta inactiva no puede acceder ni contratar.

## Recorrido propuesto

- Área profesional `Mi suscripción`: plan actual, capacidad, vigencia, catálogo elegible y acceso a contratar/subir de nivel. Primera contratación disponible sin plan. No se agrega downgrade de autoservicio a un pedido de upgrades.
- Elegir un plan disponible con mayor capacidad. Se mantiene el catálogo persistido como fuente de verdad; no se copian precios a otro catálogo privado.
- Resumen previo calculado por servidor: plan actual/destino, importe MXN, regla de cálculo y efecto sobre vigencia/cupo. Sin cargos ni impuestos inventados.
- Checkout con instrumentos exclusivamente ficticios y predefinidos. No se envían, guardan ni registran números de tarjeta, CVV o datos bancarios reales. La interfaz indica `Modo de prueba — no se realizará ningún cargo`.
- Confirmación, estado de procesamiento persistido, resultado aprobado/rechazado/error y posibilidad de cancelar o reintentar según el estado. El tiempo de procesamiento es una simulación de servidor; la animación por sí sola no decide el resultado.
- Aprobado: comprobante de simulación con referencia, fecha, importe y plan, historial de operaciones y actualización de la suscripción/cupo.
- Rechazado, cancelado o fallido: el plan y su vigencia permanecen iguales; se muestra un error útil y se puede iniciar otro intento.
- Recargar o volver a entrar recupera el estado de la operación. Doble clic/reintento de red no genera otra operación ni otra activación.

La presentación será coherente con los componentes y estilos de la aplicación. No se usará marca de un proveedor que no esté integrado ni se emitirá un comprobante que aparente un cargo bancario real.

## Invariantes de implementación

- Identidad, rol y ownership derivados de la sesión persistida; el profesional opera solo sobre su suscripción y sus pagos simulados.
- La API calcula importe y elegibilidad. No acepta precio final, estado aprobado, actor o profesional enviados por el navegador.
- Estados persistidos `pending`, `processing`, `succeeded`, `failed`, `cancelled` con transiciones controladas. La aprobación simulada es un resultado del simulador del servidor para un instrumento de prueba admitido.
- Instantánea de la cotización y del plan; si cambian catálogo/suscripción antes de la confirmación, se exige una nueva cotización. Importes en centavos para evitar errores de coma flotante.
- Aprobación, cambio de suscripción y auditoría en una sola transacción. Error en cualquier etapa revierte la activación.
- Idempotencia y bloqueo por profesional reutilizan el control de concurrencia actual; ningún reintento duplica la mejora ni extiende dos veces el vencimiento.
- El administrador no puede suspender/reactivar ni editar la suscripción. Las cuentas activas pueden contratar un periodo nuevo ante suscripción histórica suspendida; una cuenta inactiva no puede comprar. Cuenta/expediente/suscripción conservan sus estados independientes.
- Catálogo, operaciones e historial preservados por migraciones incrementales; no editar las ya aplicadas. Cambios de permisos se validan en API y BD además de retirar botones.
- API sin caché privada, sesiones/CSRF existentes, SQL parametrizado, runtime restringido, errores públicos sin detalles internos ni secretos.

## Límites y decisiones de implementación propuestas

Simulador propio dentro de API/BD existentes; sin SDK de proveedor, cuenta externa, llaves de pasarela, webhooks externos, cobros reales, cargos automáticos recurrentes, reembolsos reales ni nueva infraestructura. Los escenarios de aprobación, rechazo y error se reproducen con instrumentos de prueba documentados. La elección mensual ya aparece en el portal; el periodo nuevo es de un mes calendario UTC desde aprobación, ajustando al último día válido del mes siguiente. No se conserva el año automático anterior.

## Capas y artefactos afectados

- `features/saas`: cotizaciones, operaciones simuladas y finalización transaccional; reutiliza suscripción/cupo.
- Área profesional: ruta de suscripción, checkout, resultado e historial usando el cliente de sesión existente.
- Área administrativa: retirar asignación de plan/vigencia y limitar estado conforme a la respuesta del usuario; prohibirlo también en servidor.
- Catálogo público/registro: conservar interés de plan y enlazar con el checkout después de autenticar, sin conceder cupo por registrarse.
- Migración incremental y esquema integrado; contratos, glosario, plan y requisitos complementarios actualizados conjuntamente.

## Criterios verificables

1. Profesional sin plan contrata mediante aprobación simulada y obtiene exactamente la capacidad elegida.
2. Profesional con plan vigente sube de nivel con importe/vigencia conformes a la regla acordada.
3. Manipular plan ajeno, importe, instrumento, estado, quote vencida o campos extra se rechaza.
4. Rechazo/error/cancelación no cambia suscripción ni consume un segundo intento aprobado.
5. Reintentos, doble clic, dos pestañas y recarga conservan una sola operación/activación.
6. Un fallo de auditoría/BD revierte el cambio; historial y cupos anteriores permanecen íntegros.
7. Administrador no cambia plan/vigencia por pantalla ni por petición HTTP directa.
8. Aislamiento y restricciones de cuenta/suscripción se mantienen con sesiones abiertas.
9. Flujo completo en navegador y suite API/BD con rol restringido; build/typecheck/lint/formato y regresiones existentes.

Decisión de implementación: periodo de un mes de calendario en UTC, ajustando el día al último válido del mes siguiente; la aprobación inicia el periodo y conserva hora/minutos. Una suscripción previamente suspendida sin cuenta bloqueada puede contratar un periodo nuevo; ya no existe suspensión administrativa en este alcance. Se persiste la cotización pendiente durante 10 minutos y se procesa durante 2 segundos en servidor, sin proveedor externo.
