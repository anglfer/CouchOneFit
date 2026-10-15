# HU-002 — Acceso profesional

Implementar la historia solicitada usando las decisiones vigentes DEC-001/002/004. HU-001 y HU-002 comparten una única migración inicial consolidada antes de la primera aplicación del proyecto.

- [x] Pruebas HTTP/BD antes de código: usuario o correo, fallo genérico, estado/rol, acceso privado, sesión utilizada en consulta, cookies, CSRF, renovación, revocación y fallo de infraestructura.
- [x] Migración inicial compartida `202610150001_inicial_identidad_acceso.sql`: sesiones de 30 días absolutos, refresh hash-only con rotación/replay y rol servidor sin permisos DDL.
- [x] API `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/csrf`; protección JWT/sesión vigente y consulta propia `/api/professional/profile`.
- [x] Web `/acceso`: formulario, mensajes españoles, carga y retorno solo a rutas locales de `/app`. Guard de `/app/*`, recuperación de sesión desde servidor y renovación serializada, sin tokens en storage.
- [x] Espacio privado mínimo: perfil obtenido de API y estado sin plan; no cartera/dashboard ficticios. Acceso marketing y registro enlazados al login real.
- [x] Documentar conexión `CouchOneFit`/entornos, permisos, clave JWT fuera de Git, contrato/estado por HU y límites de pruebas locales.
- [x] Verificar suites con PostgreSQL local, builds, lint, navegador, aislamiento entre cuentas, caducidad y logout; revisar diff sin modificar cambios staged ajenos.

No se implementan recuperación, administración, cartera, pagos o asignación de suscripciones. Refresh/logout son parte de la base común necesaria para una sesión revocable; HU-005 conserva integración y validación completa Web/móvil.


## Evidencia local

- 24 tests API/PostgreSQL correctos (registro, login, permisos, estado, claims, cookies Secure/CSRF, rollback, caducidad, carreras/replay, revocación y migraciones entre bases del mismo clúster).
- API y Web compilan; lint Web correcto, sin advertencias.
- Navegador Edge: guard directo `/app/perfil`, fallo/válido por usuario/correo, perfil propio, refresh al vencer cookie access, dos pestañas, retorno externo rechazado, baja de cuenta y logout con fallo de red/revocación.
- Sin tokens en localStorage; cookies HttpOnly comprobadas. Sin errores JavaScript ni overflow 320/390/768/1440 en espacio privado; login 320/390/1440. Capturas inspeccionadas.
- Inicial consolidada validada en una base local vacía; repetir no reaplica. La suite compara el catálogo contra el SQL integrado en otra base temporal.
- No cambios remotos, despliegue, rotación de claves históricas ni cierre de D0/revisión independiente. Servicios de prueba temporales se detienen al terminar.


## Convenciones y organización vigentes

La documentación de esta HU vive dentro de su épica, sin depender de sprints. La inicial consolidada crea usuarios, perfiles, aceptaciones, sesiones y tokens en español snake_case, con id propio en cada entidad. [schemas](../../../database/schemas/README.md) conserva el SQL completo acumulado. API/Web usan DTO camelCase. El modelo y funciones detallados están en [modelo de identidad/acceso](../../../database/modelo-identidad-acceso.md); las reglas compartidas en [convenciones](../../../database/convenciones.md). La evidencia previa de este plan corresponde a su incremento original; la consolidación actual se valida con instalación limpia y comparación del esquema integrado.
