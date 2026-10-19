# Plan y trazabilidad — HU-008

| Tarea | Entregable | Verificación |
| --- | --- | --- |
| HU-008-BD1 | Una conexión y transacción para cuenta/vínculo/aviso/DELETE; bloqueos y fila vinculada exigida. | Fallos inyectados por etapa y runtime restringido. |
| HU-008-API1 | Validación estricta, prevalidación mínima y activación anónima. | HTTP real con datos/código válidos e inválidos. |
| HU-008-API2 | Revalidación de estados/TTL, concurrencia/replay y sesión posterior al commit. | Dos canjes simultáneos, vencimiento exacto y fallo posterior al commit. |
| HU-008-MOV1 | Pantalla completa, aviso versionado, confirmaciones, estados y expediente propio. | Flutter y recorrido de la app. |
| HU-008-QA1 | BD/HTTP con cuenta única, rollback íntegro y cero invitaciones residuales. | `account-lifecycle.test.ts`, `account_access_test.dart` y suite previa HU-004/005. |

Dependencias concretadas: invitación HU-007, cliente preexistente HU-004/015, `subscriptions` mínima para verificar el estado de HU-013 y sesiones existentes. El incremento no declara cerrados los demás módulos de la cartera/SaaS. [Contrato](README.md), [evidencia](../evidencia-hu-006-009.md).
