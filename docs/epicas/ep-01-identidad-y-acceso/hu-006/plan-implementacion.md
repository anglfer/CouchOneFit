# Plan y trazabilidad — HU-006

| Tarea | Entregable | Verificación |
| --- | --- | --- |
| HU-006-API1 | PATCH propio, DTO estricto, reautenticación, hash y UPDATE transaccional, unicidad y revocación total. | Prueba `credentials require current password…` con runtime sin DDL/BYPASSRLS. |
| HU-006-MOV1 | Formulario accesible desde expediente; estados de envío, error y retorno a login. | Pruebas Flutter y recorrido documentado. |
| HU-006-QA1 | Casos positivos/negativos, preservación de datos y rechazo de sesiones antiguas. | `account-lifecycle.test.ts`, `account_access_test.dart`. |

Dependencias utilizadas: login/identidad de HU-004 y revocación/almacenamiento de HU-005. No hay edición del expediente por el cliente. [Contrato](README.md), [evidencia y gates D0](../evidencia-hu-006-009.md).
