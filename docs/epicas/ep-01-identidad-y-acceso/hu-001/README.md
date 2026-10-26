# HU-001 — Registrar una cuenta profesional

**Épica:** EP-01, identidad y acceso. **Responsable:** Ferxxo. **Capas:** Web, API y BD. **Referencias:** RF01, RNF05, RS06/11, DEC-001/002/005. **Depende de:** TT-003/004/009/010. **Habilita:** HU-002 y posterior asignación de plan/cartera.

Como profesional, quiero crear mi cuenta desde Web para administrar mi cartera con una identidad propia. El alta no concede administración, sesión automática, suscripción ni capacidad; elegir un plan guarda interés, no realiza un cargo.

## Flujo y alcance

`/` → «Contáctanos» → `/registro`, o «Contratar plan» → `/registro?plan=basic|pro|elite`. Se validan datos y confirmaciones; API crea usuario, perfil y aceptación en una transacción. Web muestra carga, error/duplicado o éxito y enlace a `/acceso`. Login se implementa en [HU-002](../hu-002/README.md).

Formulario: nombre, usuario, correo y confirmación, contraseña y confirmación, teléfono opcional, plan de interés opcional e información de registro versionada. Precios actuales: Básico $299 MXN/10 activos, Pro $599 MXN/30, Élite $999 MXN/ilimitados. No se añade periodicidad o cobro no implementado. Campos de especialidad/consultorio/biografía se incorporarán cuando exista su funcionalidad.

## Contrato HTTP vigente

`POST /api/auth/professionals`, JSON con identificadores en inglés **camelCase**, hasta 16 KiB. PostgreSQL usa los mismos términos en inglés `snake_case`; no se aceptan campos traducidos ni alias del contrato anterior.

```json
{
  "fullName": "Persona de Ejemplo",
  "username": "persona.ejemplo",
  "email": "persona@example.com",
  "emailConfirmation": "persona@example.com",
  "password": "una frase suficientemente larga",
  "passwordConfirmation": "una frase suficientemente larga",
  "phone": "5512345678",
  "planInterest": "pro",
  "noticeVersion": "2026-10-15.1",
  "acceptsNotice": true
}
```

Respuesta 201:

```json
{"account":{"id":"UUID_DEL_USUARIO","role":"professional","status":"active","subscription":null}}
```

No devuelve hash, contraseña, access, refresh ni cookie de sesión. `account.id` es la identidad de usuario; `professionals.id` es la identidad propia del perfil. API y BD conservan los mismos valores de rol/estado: `professional` y `active`, sin traducirlos entre capas.

Los campos camelCase en español del contrato anterior se sustituyeron por los nombres en inglés de este ejemplo; no se aceptan alias duplicados. API y Web deben desplegarse coordinados. Las rutas HTTP, códigos de error y versión del texto informativo se conservan; cambiar nombres de campos no reescribe aceptaciones.

## Validación

- Nombre trim, 3–120 puntos de código Unicode.
- Usuario trim/lower, ASCII `[a-z0-9._]` y 3–30 caracteres; sin `@` para distinguir login por correo.
- Correo obligatorio, máximo 254, trim/lower completo por política de aplicación; confirmación normalizada coincidente. No verificación SMTP.
- Contraseña 15–128 puntos de código, sin composición obligatoria, trim, normalización o truncamiento. Confirmación exacta. Argon2id con salt generado por biblioteca, 19456 KiB/2 iteraciones/1 hilo.
- Teléfono opcional de 10–15 dígitos, texto; vacío se transforma en NULL.
- `planInterest`: null, `basic`, `pro`, `elite`; `acceptsNotice:true` y `noticeVersion` vigente obligatorios.
- Rechazar claves extra, incluidas rol/estado/suscripción. Los privilegios nunca proceden del cliente.

## Persistencia y funciones

1. `registrationController` entrega el payload al servicio.
2. `validateRegistration` produce `Registration` camelCase o 400.
3. `registerProfessional` genera Argon2id y llama a `insertProfessional`.
4. `insertProfessional` toma una conexión `pg`, abre transacción e inserta `private.users`, `private.professionals` y `private.notice_acceptances`; COMMIT solo tras las tres inserciones. Ante fallo, ROLLBACK y liberación de conexión.
5. Unicidad concurrente se resuelve con índices únicos normalizados; SQLSTATE 23505 se convierte a 409 seguro, sin identificar qué cuenta existe.

Rutas de código bajo `apps/api/src/features/auth/`: controller `controllers/registration.ts`, validación `validators/registration.ts`, servicio `services/registration.ts`, repositorio `repositories/registration.ts`, tipo `types/registration.ts`, ruta `routes/registration.ts`. Web: `apps/web/src/features/auth/pages/RegistrationPage.tsx`.

Diccionario completo, DDL y relaciones: [modelo de identidad/acceso](../../../database/modelo-identidad-acceso.md). La inicial consolidada crea registro y sesiones según [las convenciones](../../../database/convenciones.md); [schemas](../../../database/schemas/README.md) conserva el SQL integrado. No crear tablas paralelas.

## Errores, abuso y reintentos

| HTTP | Código | Comportamiento |
| --- | --- | --- |
| 400 | `INVALID_REGISTRATION` / `INVALID_JSON` | Validación, confirmaciones, campos extra o JSON inválido; sin alta parcial. |
| 403 | `ORIGIN_NOT_ALLOWED` | Origin presente fuera de lista permitida. |
| 409 | `IDENTIFIER_UNAVAILABLE` | Usuario o correo ocupado; conserva formulario para corregir. |
| 413 | `PAYLOAD_TOO_LARGE` | Cuerpo excede límite. |
| 429 | `TOO_MANY_REQUESTS` | 40 intentos/IP/15 min, antes del hash, con Retry-After. |
| 503 | `REGISTRATION_UNAVAILABLE` | Fallo de infraestructura/hash/transacción; sin SQL ni credenciales. |

Formato `{"error":{"code":"...","message":"..."}}`; respuestas no-store. Web evita doble envío y no guarda contraseñas en storage/URL/logs. Si se pierde la respuesta después del COMMIT, un reintento puede dar 409; no se elimina la cuenta ni se simula éxito por ello. Limitador por instancia; revisar IP/proxy y almacén compartido antes de escalar.

## Tareas, aceptación y evidencia

| Tarea | Resultado |
| --- | --- |
| HU-001-BD1 | Usuario/correo únicos normalizados, perfil 1:1 con id propio, relación de rol y aceptación versionada. |
| HU-001-API1 | Validación, servicio/repo transaccional, endpoint y protección de abuso. |
| HU-001-WEB1 | Formulario, confirmaciones, carga/duplicado/error/éxito y navegación al acceso. |
| HU-001-QA1 | Duplicados concurrentes, datos inválidos, rollback de perfil/aceptación, Unicode y rol malicioso. |

Aceptación: formulario válido crea una sola identidad; duplicados/datos inválidos no dejan alta parcial; payload admin no concede privilegio; infraestructura no revela detalles. DoD: D0, identidad profesional única y alta consistente; login se valida en HU-002 sin depender circularmente de su demostración.

Pruebas: `npm test` en API con PostgreSQL local exclusivo ya migrado; API build, Web build/lint y navegador. Se comprueba instalación limpia y equivalencia entre migración y esquema integrado. [Plan de implementación/evidencia histórica](plan-implementacion.md). Estado: implementada y validada localmente; revisión independiente, configuración remota y despliegue no acreditados por este documento.
