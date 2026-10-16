# Guía de programación — CouchOne Fit

Lee esta guía antes de crear o modificar código. Resume cómo nombrar y estructurar el código en las tres aplicaciones, y enlaza a la regla detallada de PostgreSQL. Si una HU, una decisión de producto o una convención específica contradice una recomendación general de esta guía, prevalece la fuente específica documentada.

## Fuente de verdad de los nombres y contratos

La norma compartida es [Convenciones de base de datos](docs/database/convenciones.md). Sus reglas también describen los límites entre PostgreSQL, TypeScript y JSON; no se debe usar un nombre SQL como nombre de propiedad de la aplicación.

| Capa | Forma | Ejemplos |
| --- | --- | --- |
| PostgreSQL | Español `snake_case`; tablas en plural y columnas precisas | `privado.usuarios`, `nombre_completo`, `usuario_id` |
| Funciones SQL propias, si hay una necesidad aprobada | Español `snake_case` | `crear_sesion` |
| TypeScript / JavaScript / JSON | `camelCase` | `nombreCompleto`, `confirmacionCorreo` |
| Funciones, variables y métodos de aplicación | `camelCase` | `registerProfessional`, `mobileTheme`, `sessionRequest` |
| Tipos, clases y componentes React | `PascalCase` | `Registration`, `ProfessionalIdentity`, `ProfessionalApp` |
| CSS | `kebab-case` | `workspace-sidebar`, `--brand-primary` |
| Clases Dart | `PascalCase`; miembros públicos `lowerCamelCase`; privados con `_` | `CouchOneFitApp`, `mobileTheme`, `_themeMode` |

Los identificadores de aplicación pueden conservar el inglés: la convención de CouchOne Fit fija el español para la base de datos y `camelCase`/`PascalCase` para la aplicación. Cuando una consulta lee SQL, asigna alias en el `SELECT` o transforma el resultado en el repositorio. Las respuestas API y los objetos JavaScript usan `camelCase`; nombres SQL como `nombre_completo` no pasan al JSON.

Los valores persistidos de rol y estado se escriben según el vocabulario español de la base (`profesional`, `activo`). Si un contrato HTTP existente utiliza valores como `professional` o `active`, mapéalos explícitamente en la frontera API; no cambies el contrato de red solo por la traducción SQL.

## Funciones y responsabilidades

No agregues procedimientos de negocio o RPC solo para mover lógica a PostgreSQL. La regla actual es implementar el dominio en funciones de aplicación y consultas parametrizadas; una función SQL propia necesita una necesidad funcional concreta y documentación de nombre, parámetros, resultado, permisos y transacción.

En la API, conserva la separación que utiliza el módulo de identidad y acceso:

1. **Ruta/controlador:** recibe la solicitud y conecta la entrada HTTP con la operación.
2. **Validador:** trata la entrada externa como `unknown`, revisa estructura y reglas antes de convertirla al tipo del dominio. Devuelve errores de validación mediante el error de aplicación existente.
3. **Servicio:** coordina la operación y contiene su flujo de negocio; recibe y devuelve tipos explícitos cuando el contrato ya está definido.
4. **Repositorio:** ejecuta consultas SQL parametrizadas y mapea columnas a tipos de aplicación. Una operación de escritura con varios pasos conserva su transacción, `ROLLBACK` ante error y liberación del cliente.

La firma `validateRegistration(input: unknown): Registration` ejemplifica la frontera de confianza; `insertProfessional(...): Promise<string>` ejemplifica una escritura con retorno explícito. Usa el patrón del módulo correspondiente antes de introducir una capa nueva. No dupliques validación entre API y cliente para sustituir la validación del servidor.

En Web, los componentes y tipos usan `PascalCase`; sus manejadores, hooks propios y funciones usan `camelCase`. En móvil, sigue Dart: clases `PascalCase`, miembros `lowerCamelCase` y estado privado con `_`. Conserva los tipos de entrada y retorno que exige el compilador de cada lenguaje.

## Persistencia y cambios de contrato

- Consulta primero [las convenciones completas de PostgreSQL](docs/database/convenciones.md), la HU del módulo y el [modelo de identidad y acceso](docs/database/modelo-identidad-acceso.md).
- Integra cambios de esquema en una migración funcional y en su HU. Nunca edites una migración aplicada; conserva su checksum y corrige con una migración nueva que preserve los datos.
- Usa parámetros de consulta, expresa nulabilidad y claves foráneas con claridad, y concede solo los permisos de la función que necesita cada rol.
- Documenta y actualiza juntos los mapeos BD ↔ API ↔ Web/móvil, sus tipos y pruebas cuando cambie un contrato.
- Valida la instalación limpia y el esquema integrado. En migraciones posteriores, valida también la actualización con datos existentes.

## Formato y comprobaciones disponibles

Usa las configuraciones existentes en cada aplicación; no inventes un formato paralelo:

- **Web:** Prettier y Oxlint. La [guía de formato Web](docs/architecture/formato-codigo-web.md) describe la configuración y los comandos.
- **Móvil:** formato y reglas del analizador configurados en `apps/mobile`.
- **API:** conserva TypeScript y los patrones del módulo existente.

## Documentación relacionada

- [Convenciones de PostgreSQL y mapeos de contrato](docs/database/convenciones.md)
- [Arquitectura y límites de las capas](docs/architecture/README.md)
- [Guía de trabajo con Git](CONTRIBUTING.md)
- [Plan y decisiones vigentes](PLAN_TRABAJO_V2.md)
