# HU-001 — Registro desde Web

Diseño aprobado por el usuario el 15 de octubre de 2026. Ejecución en esta sesión.

**Objetivo:** precios visibles y CTA al registro; cuenta profesional consistente sin cobro, sesión ni activación de suscripción.

**Arquitectura:** Express con controller/service/repository/validator y PostgreSQL mediante `pg`; React conserva la identidad visual de marketing. Auth propia, no Supabase Auth.

## Alcance y comprobación

- [x] API: pruebas HTTP primero; DTO camelCase, normalización, confirmaciones, Argon2id (19456 KiB/2/1), rol fijo profesional, error seguro, límite de solicitudes.
- [x] BD: migración inicial consolidada de cuentas, perfil 1:1 y aceptación versionada en esquema privado; unicidad expresional; transacción única. Pruebas con PostgreSQL local, concurrencia y fallo del segundo/tercer insert.
- [x] Web: `/registro?plan=basic|pro|elite`, formulario accesible, estados de carga/error/éxito, CTA Contáctanos, precios 299/599/999 MXN, enlace de éxito al acceso con estado honesto de HU-002.
- [x] Integración: proxy `/api` en Vite/Vercel, cliente HTTP con errores tipados, no cache de auth.
- [x] Documentación: contrato HU-001, tablas y evolución HU-002, instrucciones de migración, ejemplos sin secretos, README y decisiones vigentes coherentes.
- [x] Validación: API tests/build, Web build/lint y comprobación de navegación/formulario responsive cuando haya navegador disponible; revisión final del diff.

Se conserva el PLAN_TRABAJO_V2.md preexistente; se actualizan únicamente las reglas afectadas. No se aplican migraciones remotas ni se rota ninguna credencial sin autorización externa. Sesiones/login y cobros quedan fuera de HU-001.


## Evidencia local — 15-oct-2026

- API: 9 tests HTTP/PostgreSQL correctos y build TypeScript correcto.
- Inicial consolidada aplicada a una base nueva temporal PostgreSQL 18.1; segunda ejecución sin reaplicar. Sin aplicación remota.
- Web: build y lint correctos.
- Navegador Edge mediante Playwright: selección de plan y cambio de Pro a Élite, validación de confirmación, alta real API/BD, éxito, navegación a acceso; duplicado 409 y desconexión conservan formulario. CTA Contáctanos móvil comprobado.
- Sin errores JavaScript ni overflow horizontal en 320, 390, 768 y 1440 px; capturas escritorio/móvil inspeccionadas.
- `git diff --check` correcto. No deploy, aplicación remota, rotación de claves ni revisión independiente; D0 sigue abierto.


## Convenciones y organización vigentes

La documentación de esta HU vive dentro de su épica, sin depender de sprints. La inicial consolidada crea usuarios, perfiles, aceptaciones, sesiones y tokens en español snake_case, con id propio en cada entidad. [schemas](../../../database/schemas/README.md) conserva el SQL completo acumulado. API/Web usan DTO camelCase. El modelo y funciones detallados están en [modelo de identidad/acceso](../../../database/modelo-identidad-acceso.md); las reglas compartidas en [convenciones](../../../database/convenciones.md). La evidencia previa de este plan corresponde a su incremento original; la consolidación actual se valida con instalación limpia y comparación del esquema integrado.
