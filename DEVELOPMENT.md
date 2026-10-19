# Guía de programación

## Idioma y nombres

Usa inglés para los identificadores del código, los nombres de la base de datos, los contratos de API, los nombres de pruebas y los valores legibles por máquina. Usa español para los textos que ve la persona usuaria, como mensajes de validación, correos y textos de accesibilidad.

Usa `snake_case` en SQL; `camelCase` en TypeScript, JavaScript, Dart y JSON; y `PascalCase` en tipos, clases y componentes. No traduzcas los campos entre capas: conserva el mismo término en inglés y aplica la convención de escritura correspondiente a cada capa. Antes de cambiar un contrato existente, consulta el [glosario de identidad y acceso](docs/architecture/domain-glossary.md).

## Estructura de la aplicación

Mantén las responsabilidades en las capas existentes:

1. **Rutas y controladores de API** conectan las solicitudes HTTP con las operaciones.
2. **Validadores** reciben los datos externos como `unknown` y devuelven los errores de validación ya definidos por la aplicación.
3. **Servicios** coordinan las operaciones del dominio con tipos explícitos.
4. **Repositorios** usan consultas SQL parametrizadas y conservan el comportamiento de transacciones, reversión y liberación de conexiones.
5. **Web y móvil** consumen directamente el contrato de API; los textos para la persona usuaria permanecen en español.

No agregues una capa de traducción o alias entre filas SQL y TypeScript cuando ambos puedan usar el mismo término del dominio. Mantén valores como `professional`, `admin`, `active` y `basic` consistentes desde PostgreSQL hasta JSON y las aplicaciones cliente.

## Cambios de base de datos y contratos

- Antes de cambiar la persistencia o los campos de API, consulta las [convenciones de PostgreSQL](docs/database/convenciones.md), la historia del módulo y el [glosario del dominio](docs/architecture/domain-glossary.md).
- No edites una migración ya aplicada. Agrega una nueva migración que conserve los datos y actualiza el esquema integrado.
- Actualiza API, Web, móvil, datos de prueba, pruebas y documentación del contrato en el mismo cambio.
- Los cambios de nombres en la base de datos requieren desplegar la migración y las versiones de API, Web y móvil como un corte coordinado. No ejecutes al mismo tiempo contratos viejos y nuevos contra el esquema renombrado.
- Basa la autorización en los roles persistidos en la base de datos, no en campos enviados por el cliente ni solo en declaraciones de un JWT.

## Formato y verificaciones

Usa la configuración existente en cada aplicación:

- **Web:** Prettier y Oxlint; consulta el [estilo de código Web](docs/architecture/formato-codigo-web.md).
- **API:** TypeScript y los patrones existentes del módulo.
- **Móvil:** el formateador de Dart y la configuración del analizador en `apps/mobile`.

Los puntos de inicio están en el [README raíz](README.md), la [guía de base de datos](docs/database/README.md) y la [guía de despliegue](docs/architecture/despliegue.md).
