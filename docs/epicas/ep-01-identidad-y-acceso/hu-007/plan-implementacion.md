# Plan y trazabilidad — HU-007

| Tarea | Entregable | Verificación |
| --- | --- | --- |
| HU-007-BD1 | Tabla temporal con FK, unicidad por expediente, hash, TTL y contexto RLS. | Migraciones limpia/actualizada vs esquema integrado; runtime restringido. |
| HU-007-API1 | POST con propiedad/estado, reemplazo atómico y DELETE para revocación. | Pruebas HTTP de propietarios, estados, expiración y reemplazo. |
| HU-007-WEB1 | Cartera propia y entrega/copiar/ocultar/revocar en `/app/clientes`. | Build/lint y recorrido navegador de la feature. |
| HU-007-QA1 | Casos ajeno/vinculado, reserva existente y no divulgación en listados/auditoría. | `account-lifecycle.test.ts`, canje real en HU-008. |

El canje no es prerrequisito circular de emitir la invitación. La prevalidación permite verificarla sin consumirla. [Contrato](README.md), [evidencia](../evidencia-hu-006-009.md).
