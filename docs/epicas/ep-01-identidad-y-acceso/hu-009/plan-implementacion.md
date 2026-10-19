# Plan y trazabilidad — HU-009

| Tarea | Entregable | Verificación |
| --- | --- | --- |
| HU-009-API1 | Emisión autorizada/reautenticada, reset separado/TTL/una vigencia, consumo/revocación atómicos y custodia local. | Casos legítimo/ajeno, estados/roles, expiración, replay, carrera, rollback y comando. |
| HU-009-WEB1 | Procedimiento público sin enumeración, canje privado y panel de autorización. | Compilación/lint y recorrido navegador. |
| HU-009-MOV1 | Recuperación desde login con mismo expediente y guía para nuevo dispositivo. | Pruebas Flutter y recorrido de acceso. |
| HU-009-QA1 | Identidad estable, permisos, consumos, expiración y revocación. | `account-lifecycle.test.ts`, `account_access_test.dart`, suites previas. |

No SMTP, SMS, recuperación por conocer correo ni nueva cuenta. La clave la introduce el titular, sin pasar por el operador. [Contrato y runbook](README.md), [evidencia](../evidencia-hu-006-009.md).
