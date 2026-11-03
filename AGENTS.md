# CouchOne Fit — instrucciones para agentes

Guía común para cualquier agente que trabaje en este repositorio. `CLAUDE.md`
importa este archivo; mantén las reglas compartidas aquí para evitar divergencias.
Aplica a todo el repositorio. Lee también cualquier `AGENTS.md` más específico
de la carpeta que vayas a modificar.

## Inicio rápido y alcance

1. Lee la petición y ejecuta `git status --short`, `git diff --stat` y
   `git diff --cached --stat`. Conserva cambios previos, incluidos los preparados
   en el índice; no hagas reset, limpieza, cambio de rama ni staging global.
2. Lee `DEVELOPMENT.md`, `CONTRIBUTING.md` y la HU afectada según §1.
   Los documentos definen el comportamiento esperado; el código actual muestra
   el implementado. Si discrepan, identifica la diferencia antes de cambiar un contrato.
3. Localiza la implementación y sus consumidores con el grafo (§ siguiente).
   Delimita archivos, pruebas, fixtures, configuración y documentación afectados.
4. Ejecuta el cambio mínimo completo y sus comprobaciones (§4). No necesitas
   un plan extenso para una corrección pequeña ni implementar futuras épicas.
5. Cierra con archivos cambiados, pruebas ejecutadas, pendientes y riesgos;
   diferencia trabajo local, commit, publicación y aceptación humana.

Las instrucciones actuales de la persona usuaria delimitan la tarea. Procede
con investigación, edición local y validación no destructiva dentro de ese alcance.
Pide autorización para operaciones destructivas, escrituras remotas, despliegues
o ampliaciones importantes si no están ya autorizadas. No envíes mensajes al
equipo por tu cuenta: cuando aplique la coordinación de `CONTRIBUTING.md`, informa
a la persona usuaria y respeta los acuerdos vigentes de la HU.

No copies secretos a respuestas, logs, fixtures ni documentación. No cambies
dependencias, lockfiles ni herramientas globales salvo que la tarea lo requiera.

## Codebase Memory: exploración del código (obligatorio)

Antes de explorar el código, usa las herramientas MCP de `codebase-memory-mcp` como primera opción:

1. Comprueba con `list_projects` que el proyecto corresponda a la ruta actual; si no está indexado, ejecuta `index_repository` para esa ruta. Si el grafo está desactualizado, vuelve a indexar antes de confiar en sus resultados. No supongas un nombre de proyecto ni reutilices el índice de otro checkout.
2. Usa `search_graph` para localizar funciones, clases, rutas y símbolos; `trace_path` para identificar sus llamadas y dependencias; y `get_code_snippet` para leer su implementación.
3. Usa `query_graph` para relaciones complejas y `get_architecture` para una vista general del proyecto.
4. Recurre a `Grep`/`Glob` o búsquedas de archivos para textos literales, errores, configuración y documentación, o cuando el grafo devuelva resultados insuficientes. Verifica el código actual antes de editarlo.
5. Si el MCP no está disponible o falla, indícalo y continúa con las herramientas de búsqueda disponibles. No afirmes haber consultado el grafo si no lo hiciste.

El grafo complementa la lectura de la HU y sus decisiones; no sustituye los requisitos ni las comprobaciones del código actual.

Monorepo SaaS de entrenamiento y nutrición. Tres apps + PostgreSQL:

| App       | Ruta                       | Stack                                                                      | Puerto local               |
| --------- | -------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| API       | `apps/api`                 | Node 24 + Express + TypeScript, `pg` parametrizado, Argon2id, JWT (`jose`) | 3000                       |
| Web / PWA | `apps/web`                 | React 19 + Vite + TypeScript + Tailwind 4, Prettier + Oxlint               | 5000 (proxy `/api` → 3000) |
| Móvil     | `apps/mobile`              | Flutter / Dart (solo cliente final; SDK compatible con `pubspec.lock`) | —                          |
| BD        | `docs/database/migrations` | PostgreSQL 17+ (Supabase en la nube, local para pruebas)                   | 5432                       |

Idioma: responde y documenta en **español**. Código, identificadores y commits en **inglés** (ver §3).

## Mapa para orientarse

| Necesitas cambiar | Empieza aquí | Comprueba también |
| --- | --- | --- |
| Endpoints y middleware global | `apps/api/src/app.ts`, `apps/api/src/features/` | Consumidores Web/móvil, contratos en `docs/api/` |
| Login, sesiones y recuperación | `apps/api/src/features/auth/` | EP-01, permisos, cookies/CSRF y sesión móvil |
| Cartera y expediente | `docs/epicas/ep-03-cartera-y-expediente/` | API y vistas de profesional/cliente, propiedad de datos |
| Navegación y paneles Web | `apps/web/src/routes/AppRoutes.tsx`, `apps/web/src/layouts/` | `features/`, roles y rutas protegidas |
| UI compartida | `apps/web/src/components/`, `apps/mobile/lib/shared/` | `DESIGN.md`, `apps/web/DESIGN.md`, accesibilidad |
| App móvil | `apps/mobile/lib/features/` | `apps/mobile/lib/shared/services/`, `test/`, `integration_test/` |
| Persistencia | `docs/database/migrations/`, `docs/database/schemas/` | Repositorios, RLS, pruebas y glosario |

Estas rutas son puntos de entrada, no un inventario exhaustivo. No uses un
recuento antiguo de pruebas o una nota de despliegue como evidencia del estado actual.

## 1. Antes de tocar nada: lee la documentación (obligatorio)

No empieces a implementar, corregir ni probar sin haber leído lo que aplica. Si una HU, decisión (`DEC-xxx`) o contrato dice algo distinto a lo que "parece razonable", **gana el documento** y documentas el mapeo.

1. **Siempre:** [DEVELOPMENT.md](DEVELOPMENT.md) (capas, nombres, checklist) y [CONTRIBUTING.md](CONTRIBUTING.md) (Git).
2. **La historia de usuario (HU) que tocas:** `docs/epicas/<epica>/hu-XXX/README.md` y los anexos de esa carpeta (`plan-implementacion.md`, `validacion-local.md`, `prueba-web-manual.md`, `revision-final.md`). Índice: [docs/epicas/README.md](docs/epicas/README.md). Estado por HU de EP-03: [estado-e-integracion.md](docs/epicas/ep-03-cartera-y-expediente/estado-e-integracion.md).
3. **Si tocas datos, SQL, contratos o nombres:** [docs/database/convenciones.md](docs/database/convenciones.md), [docs/database/README.md](docs/database/README.md), [modelo-identidad-acceso.md](docs/database/modelo-identidad-acceso.md), [modelo-ciclo-acceso.md](docs/database/modelo-ciclo-acceso.md), [glosario](docs/architecture/domain-glossary.md) y el OpenAPI en [docs/api/](docs/api/identity-lifecycle.openapi.json).
4. **Si tocas arquitectura, despliegue o entornos:** [docs/architecture/README.md](docs/architecture/README.md), [despliegue.md](docs/architecture/despliegue.md); Web además [formato-codigo-web.md](docs/architecture/formato-codigo-web.md) y [apps/web/DESIGN.md](apps/web/DESIGN.md) / [DESIGN.md](DESIGN.md) (UI, también móvil).
5. **Requisitos y decisiones:** busca la HU/ID en [plan/PLAN_TRABAJO_V2.md](plan/PLAN_TRABAJO_V2.md) (archivo de 2400+ líneas: usa `Grep` por `HU-0xx`, `DEC-0xx`, `TT-0xx`; no lo leas completo). Requisitos: [docs/requirements/](docs/requirements/README.md) (`RF/RDF`, `RC/RDC`, `RNF`, `RS`). DoD común: plan §5.2 (D0). Estrategia de pruebas: plan §11.
6. **READMEs por app:** [apps/web/README.md](apps/web/README.md), [apps/mobile/README.md](apps/mobile/README.md) (env, `adb reverse`, temas, estado real).
7. Busca una feature parecida ya implementada y **sigue su patrón** antes de inventar uno.

Cuando termines el cambio, confirma en tu respuesta qué documentos leíste y cuáles actualizaste.

## 2. Flujo de trabajo por cambio

1. Leer docs (§1) y resumir el contrato: request/response/errores, roles y propiedad, estados, validaciones.
2. Orden de implementación: **contrato → BD/migración → API → Web / móvil → pruebas → docs**. Las pruebas se escriben con cada capa, no al final.
3. Un cambio de contrato se actualiza **completo y junto**: esquema/consulta, repositorio, tipos, API, Web, móvil, pruebas, OpenAPI/glosario y docs de la HU (DEVELOPMENT §7).
4. Cambia solo lo necesario: sin refactors ajenos, sin renombrar contratos/columnas/rutas/carpetas, sin actualizar dependencias ni lockfiles.
5. Verifica con los comandos de §4 **de cada app afectada** (no solo la que editaste). Si un comando no se puede ejecutar aquí, dilo; no lo des por pasado.
6. Registra la evidencia en la carpeta de la HU (`validacion-local.md`) con la convención del repo: **T** = prueba/herramienta ejecutada, **R** = reporte humano de la persona usuaria, **E** = inspección estática. Nunca presentes una prueba automática como si la hubiera hecho una persona, ni una HU como "completa" si falta revisión independiente o D0.
7. Alcance: EP-03 (cartera/expediente) está implementada en su base. **No implementes módulos de EP-04–07** (evaluaciones, alimentación, entrenamiento, seguimiento) dentro de otra épica; cada épica fuente conecta su módulo al expediente.

## 3. Reglas de código (resumen de DEVELOPMENT.md)

- **Código en inglés, textos visibles en español.** Lo que ya existe en contratos/BD no se renombra (`nombreCompleto`, `contrasena` en entradas protegidas): se mapea en la frontera.
- BD: `snake_case` inglés (esquema `private`); TS/Dart/JSON: `camelCase`; tipos/componentes: `PascalCase`; Dart: archivos `snake_case.dart`, nada de `UPPER_SNAKE_CASE`.
- **API por capas** (`apps/api/src/features/<feature>/`): `routes` → `controllers` → `services` → `validators` / `repositories`. El validator lo llama el **service**; el controller no valida reglas ni toca BD; el repository no importa services ni hace HTTP. SQL siempre parametrizado, mapeo explícito SQL → tipos. Varias escrituras = una transacción (`COMMIT`/`ROLLBACK`/`finally` libera la conexión). Contexto RLS por transacción con sesión confiable; el runtime no tiene DDL ni `BYPASSRLS`.
- **Web:** por feature (`features/<f>/{components,pages,hooks,services,types}`), `*Page` / `*Layout`, sin `any` para datos externos (`unknown` + validar), sin tokens en `localStorage` (cookies HttpOnly). Componentes compartidos globales en `components/`, `hooks/`, `services/`, `utils/`.
- **Móvil:** por feature (`lib/features/<f>/{screens,widgets,services,models}`), tema en `lib/shared/theme/`, API solo vía `ApiClient` / `api_config.dart`; tokens en el almacenamiento seguro nativo; el cliente rechaza HTTP en release.
- Migraciones: nuevo archivo `docs/database/migrations/YYYYMMDDHHMM_nombre.sql`. **Nunca edites una migración ya aplicada** (hay checksums). Actualiza `docs/database/schemas/identity_access.sql` y la prueba de migraciones; valida instalación limpia **y** actualización con filas existentes.
- Reglas de negocio vigentes que se rompen fácil: baja lógica (no `DELETE` de cuentas/historial); expediente inactivo ≠ cuenta de baja; cliente solo ve lo suyo; profesional solo su cartera; cupos por plan (Básico 10 / Pro 30 / Élite ilimitado); sin cobros reales (checkout simulado); edad mínima del cliente 16.

## 4. Comandos y pruebas

Los ejemplos npm parten de la raíz. API y Web usan npm con su propio
`package-lock.json`; no hay un script npm raíz que coordine ambas. Para preparar
una copia nueva usa `npm --prefix apps/api ci` y `npm --prefix apps/web ci`.
Comprueba herramientas y versiones en la máquina actual; no presupongas rutas
del SDK Android, PostgreSQL ni disponibilidad de Flutter por notas históricas.
En PowerShell usa comandos compatibles con esa shell, sin copiar `&&` de Bash
si la versión instalada no lo admite. Revisa los scripts antes de ejecutarlos.

### API (`apps/api`)

```bash
npm --prefix apps/api run build        # tsc estricto (obligatorio antes de dar por bueno)
npm --prefix apps/api run dev          # tsx watch, puerto 3000
npm --prefix apps/api test             # tsx --test, serie; necesita BD local de pruebas
```

- Las pruebas exigen `TEST_DATABASE_URL` apuntando a una base **local exclusiva ya migrada** (`CouchOneFit_test`, PostgreSQL ≥ 17, UTF8, `pg_c_utf8`; permisos para `SET ROLE`, triggers y `CREATE DATABASE`). Antes de migrarla, revisa `apps/api/scripts/migrate.ts` y configura explícitamente el destino local en la variable que consume el migrador; no supongas que definir `TEST_DATABASE_URL` redirige `DATABASE_URL`.
- **Nunca** ejecutes pruebas, migraciones ni scripts `db:*` contra el proyecto Supabase compartido (`apps/api/.env` puede apuntar ahí; dev y producción comparten esa BD). Comprueba que la URL sea `localhost`/`127.0.0.1` antes de correr nada que escriba. `db:seed:admin`, `db:recover:admin` y `db:cleanup:access` son operaciones manuales del custodio: no las ejecutes.
- Variables: `apps/api/.env.example` (`PORT`, `CORS_ORIGIN` con `http://localhost:5000,http://127.0.0.1:5000`, `DATABASE_URL`, `TEST_DATABASE_URL`, `AUTH_JWT_SECRET` ≥ 32 bytes).

### Web (`apps/web`)

```bash
npm --prefix apps/web run build        # tsc -b + vite build (incluye typecheck)
npm --prefix apps/web run lint         # oxlint
npm --prefix apps/web test             # node --test tests/*.test.mjs
npm --prefix apps/web run dev          # http://127.0.0.1:5000, deja VITE_API_URL vacío
```

- Prettier: LF, comillas simples, 80 columnas. Desde `apps/web`, usa el Prettier instalado para comprobar solo los archivos tocados. `npm --prefix apps/web run format:check` revisa toda la app: distingue fallos previos de los introducidos; no ejecutes `format` global para corregir archivos ajenos.
- Para recorridos en navegador levanta API (3000) y Web (5000) y usa el navegador integrado; verifica consola y red.

### Móvil (`apps/mobile`)

```bash
cd apps/mobile
flutter pub get --enforce-lockfile     # no actualices dependencias ni pubspec.lock
dart format <archivos tocados>
flutter analyze
flutter test                           # suite de widgets/servicios; registra el resultado actual
flutter run                            # usa apps/mobile/.env.json
```

- `apps/mobile/.env.json` es un asset y está ignorado por Git: si falta, `flutter analyze`/`flutter test` fallan. Créalo desde `.env.example` (`API_BASE_URL`). Emulador: `http://10.0.2.2:3000`. Teléfono físico por USB: `adb -s <dispositivo> reverse tcp:3000 tcp:3000` + `--dart-define=API_BASE_URL=http://127.0.0.1:3000`; reverifica el mapeo tras reconectar USB. No uses `10.0.2.2` en un teléfono.
- Prueba de integración Android: `integration_test/account_lifecycle_test.dart` (necesita API local de pruebas, fixtures sintéticas y dispositivo; ver evidencia HU-006–009). El emulador es lento y requiere WHPX; si no hay dispositivo, dilo en vez de omitirla en silencio.
- Si Gradle falla en `cleanMergeDebugAssets` / `mergeDebugNativeLibs` por archivos de solo lectura en `build/`, elimina únicamente `apps/mobile/build/` (generado), nunca otra ruta.
- Comprueba las restricciones de SDK en `pubspec.yaml` y `pubspec.lock`; no actualices el lockfile para adaptar el proyecto a un SDK antiguo.
- Para login/perfil real existe también `integration_test/client_login_profile_test.dart`. Sigue `apps/mobile/README.md` para la cuenta sintética, configuración QA y solución documentada al error de loopback de Gradle en Windows. No distribuyas credenciales ni el APK de integración.

### Antes de dar un cambio por terminado

Escoge las comprobaciones de las capas afectadas. Para cambios exclusivamente
documentales comprueba enlaces, rutas, comandos y `git diff --check`; no hace
falta levantar servicios ni ejecutar suites de producto. Para comportamiento
nuevo o un bug, añade o ajusta una prueba de regresión pertinente.

- [ ] API: `build` + pruebas de lo afectado (o las que se pudieron correr, indicando cuáles no)
- [ ] Web: `build` + `lint` + `test` + Prettier de archivos tocados
- [ ] Móvil: `dart format` + `flutter analyze` + `flutter test`
- [ ] Casos negativos y de permisos/propiedad cubiertos (dos carteras, rol incorrecto, sesión caducada), no solo el camino feliz
- [ ] Documentación de la HU / contrato / glosario / OpenAPI actualizada
- [ ] `git diff --check` limpio y sin secretos en el diff
