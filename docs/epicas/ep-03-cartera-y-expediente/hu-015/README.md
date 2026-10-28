# HU-015 — Crear el cliente y su expediente inicial

## Alcance implementado

Un profesional autenticado con suscripción activa crea un solo expediente en `private.clients`. La propiedad se obtiene de su sesión y nunca de un campo del payload; no se crean credenciales de cliente, otra cuenta ni un segundo expediente. La creación y la reserva de cupo comparten la misma transacción y bloqueo por profesional de HU-013.

El formulario Web captura nombre, fecha de nacimiento, estatura, peso base, objetivo y medidas opcionales. La confirmación se muestra solo tras recibir `201`; los errores de validación del servidor se muestran junto al campo correspondiente.

## Contrato

`POST /api/clients` requiere sesión Web de profesional, CSRF y el siguiente JSON estricto:

| Campo API / SQL | Obligatorio en alta | Unidad y validación |
| --- | --- | --- |
| `fullName` / `full_name` | Sí | Texto recortado, 2–150 caracteres. |
| `birthDate` / `birth_date` | Sí | Fecha calendario válida, años 0001–9999, de una persona de 18 años o más; edad a la fecha de `America/Mexico_City`. |
| `heightCm` / `height_cm` | Sí | cm, 100–250, incrementos de 0,1. |
| `baseWeightKg` / `base_weight_kg` | Sí | kg, 30–300, incrementos de 0,1; peso base, no registro histórico. |
| `goal` / `goal` | No | Texto 1–500 o `null`. |
| `baseBodyFatPercentage` / `base_body_fat_percentage` | No | %, 2–60, incrementos de 0,1; medición base, no cálculo ni registro histórico. |
| `waistCm` / `waist_cm` | No | cm, 40–250, incrementos de 0,1. |
| `hipCm` / `hip_cm` | No | cm, 50–250, incrementos de 0,1. |

Campos no declarados, incluido `professionalId`, se rechazan. La respuesta `201` devuelve `{client}` con las mismas medidas, `id` y `status: "active"`. Los errores de validación usan `400 INVALID_INPUT` y pueden incluir `error.fields`; falta de rol/plan/suscripción conserva los errores de autenticación y capacidad existentes.

## Persistencia y compatibilidad

La migración `202610270001_client_initial_record.sql` agrega columnas anulables a `private.clients` y controles SQL de rangos, precisión y conjunto base consistente. Un trigger rechaza fechas que no correspondan a una persona adulta cuando el valor está presente. No actualiza filas existentes ni fabrica datos.

Por ello, un expediente anterior puede tener los campos nuevos en `NULL`; se conserva para cartera, invitación y activación, pero no se presenta como un expediente completo HU-015. Las nuevas altas API siempre incluyen fecha, estatura y peso. No se añade selector de cálculo de grasa: DEC-007 lo reserva para el trabajo posterior de HU-023.

## Seguridad, transacciones y pruebas

`requireProfessional`, CSRF, `lockActor`, el bloqueo de `private.professionals`, `requireCapacity` y la transacción compartida se reutilizan sin aceptar propiedad en JSON. RLS verifica que el contexto de profesional sea el dueño al insertar o actualizar. La API filtra la lectura por profesional, pero el rol técnico conserva un permiso de lectura excesivo sobre la tabla, incluidas las nuevas columnas; no se acredita mínimo privilegio de lectura.

Hallazgo transversal P0 confirmado y corregido técnicamente: el SELECT de tabla y `select_clients USING (true)` permitían leer filas ajenas, incluidas las seis columnas físicas de HU-015. Una comprobación local con rol ordinario y contexto A leyó B; se revirtió íntegramente. Incumplía TT-010-2/4 y la aceptación «profesional A nunca lee/escribe cartera B». Las migraciones nuevas sustituyen esa política por propiedad y los consumidores establecen contexto transaccional; cuatro pruebas específicas comprueban el aislamiento. No se descarta el impacto por ser heredado ni se atribuye la solución solo al filtro HTTP. [Diseño, excepciones y evidencia](tt-010-client-read-isolation.md). Quedan revisión independiente y alcance transversal restante de TT-010/D0.

Las pruebas locales cubren alta válida, obligatorios/rangos/precisión, rol/plan/cupo, payload de propietario manipulado, aislamiento entre dos profesionales por API y RLS de escritura runtime, carrera por el último cupo y rollback tras un trigger de fallo posterior al `INSERT`. La prueba de migraciones comprueba instalación limpia, paridad con `schemas/identity_access.sql` y actualización de un expediente antiguo sin valores fabricados.

## Verificación local — 28 de octubre de 2026

La revisión del traslado confirmó la rama `feature/api-client-initial-record`, HEAD `50fec49`, los cuatro commits locales esperados y los once archivos con correcciones sin commit. `git fsck --full` no reportó daños; se conservaron los cambios y se revisó el diff contra `origin/main` local (`27a7df7`), sin actualizar aún la referencia remota.

Entorno comprobado: Windows, Node 24.22.0, npm 11.19.1 y PostgreSQL 18.6, servicio `postgresql-x64-18` activo. El lockfile Web exige Node `^20.19.0 || >=22.12.0`. Las dependencias API y Web se instalaron con `npm ci`, sin modificar manifiestos ni lockfiles. Pasaron las compilaciones API y Web, el lint Web, el parseo JSON de OpenAPI y `git diff --check`.

Se corrigió el formato del formulario de esta historia. La comprobación de formato del conjunto Web sigue bloqueada por 59 archivos: 57 difieren solo en CRLF frente al LF configurado; `apps/web/README.md` y `AdminPage.tsx` ya incumplen el formato en `origin/main`, incluso normalizando saltos de línea. No se reformatearon archivos ajenos. La auditoría de instalación informó 2 vulnerabilidades en API (1 moderada, 1 alta) y 8 en Web (5 bajas, 1 moderada, 2 altas). Los manifiestos y lockfiles coinciden con `origin/main`; son dependencias previas, sin actualización automática. El informe API identifica `body-parser` y `qs`.

La configuración local se completó mediante entrada oculta y archivo ignorado `.env.test.local`, con permisos limitados a la cuenta Windows. El asistente corrigió la comparación textual de la dirección mediante `host(inet_server_addr())` y validación JSON de dirección, puerto y base administrativa. Antes de migrar y probar se cargó explícitamente ese archivo, se exigieron URLs coincidentes sin parámetros adicionales a `127.0.0.1:5432/CouchOneFit_test` y se consultó la identidad efectiva del servidor/base. No se conectó al Supabase compartido.

Se aplicaron correctamente las once migraciones sobre `CouchOneFit_test`. La primera ejecución completa API ejecutó 80 pruebas: 58 aprobadas, 22 fallidas, ninguna omitida. Pasaron instalación limpia, paridad del esquema integrado y actualización de expediente anterior sin datos fabricados; también alta completa, validación por campo, rechazo SQL de precisión excesiva, propietario manipulado, aislamiento HTTP/RLS de escritura, rollback ante trigger de fallo y carreras por cupo. Las compilaciones API/Web y el lint Web volvieron a pasar.

Fallos previos o de compatibilidad local detectados:

- Los 18 casos de `account-lifecycle.test.ts` fallaron durante el login de preparación con `503`: la fixture crea un rol `LOGIN` sin contraseña y borra la contraseña de su URL de conexión. Esta preparación es incompatible con la autenticación por contraseña del servidor local. No se debilitó la autenticación ni se cambiaron permisos para sortearlo.
- `admin.test.ts` y `login.test.ts` esperaban el texto inglés `permission denied`; PostgreSQL local devuelve `permiso denegado`. `registration.test.ts` esperaba `row-level security`, pero recibe el mensaje español correspondiente. Antes de las correcciones, esos archivos y la fixture de ciclo de acceso coincidían con `origin/main` local.
- El caso previo de downgrade en `saas.test.ts` espera SQLSTATE `23503` al borrar un plan referenciado. PostgreSQL 18 devuelve `23001` por la restricción `RESTRICT`, conservando el rechazo de la operación. La aserción no fue introducida por HU-015.

Primer intento automatizado Web no acreditado: se preparó una fixture sintética en la base local y se inició la API con rol efectivo `couchone_authentication`, pero la herramienta de control de computadora detuvo el acceso porque no pudo determinar con suficiente confianza la URL actual de Chrome. No se continuó la interacción. Se detuvieron los procesos de ese intento y se limpió únicamente su fixture. Los resultados manuales posteriores reportados por la persona usuaria se registran más abajo y en el documento de recorrido; no son ejecuciones del agente.

La revisión posterior ejecutó `origin/main` (`27a7df7`) en un checkout separado y una base local temporal exclusiva: 54/76 aprobadas y los mismos 22 fallos, acreditando que eran previos. Tras corregir las credenciales en memoria de roles temporales y las aserciones SQL, la suite actual pasó **80/80**, sin omisiones. Compilaciones API/Web y lint aprobados; `format:check` sigue reportando 59 archivos frente a 60 de la referencia, por deuda previa y CRLF. [Pruebas afectadas, causas, equivalencia de RESTRICT y resultados](validacion-local.md).

Se prepararon [comandos, acceso sintético local y casos de recorrido Web manual](prueba-web-manual.md). No se volvió a controlar Chrome. La corrección HU-015 quedó en `8e38cad` y TT-010 en un commit separado; no se sincronizó con el remoto ni publicó la rama, conforme a la instrucción de no hacer push. HU-015 y D0 permanecen abiertos hasta los casos pendientes y la revisión independiente; TT-010 conserva su alcance transversal por revisar.

La [revisión final del diff y matriz de cumplimiento](revision-final.md) encontró y corrigió validaciones propias: precisión decimal casi válida, año cero, conteo Unicode y calendario de mayoría de edad API/SQL. Resultado final: **87/87 pruebas API aprobadas**, ninguna omitida, más builds API/Web y lint aprobados. No se modificó SQL ya aplicado; el calendario SQL se limita a la transacción de alta. Después, la persona usuaria reportó correctas las altas mínima/completa, opcionales, persistencia, doble clic sin duplicación y rechazos de menor/estatura/peso. Con Vite detenido, reportó que el cliente no apareció al reiniciar/recargar; no confirmó mensaje de error ni conservación de campos. Son resultados reportados, no ejecutados por el agente. [Detalle y repeticiones limitadas a precisión, Unicode y fechas](prueba-web-manual.md).

La corrección posterior de la exposición de lectura TT-010 incorpora dos migraciones nuevas, contexto transaccional en los consumidores y funciones especiales limitadas. Resultado: **91/91 pruebas aprobadas**, sin fallos ni omisiones, incluidas instalación limpia/actualización y regresiones. [Inventario, permisos, límites y evidencia](tt-010-client-read-isolation.md). La corrección HU-015 quedó separada en `8e38cad`; TT-010 se conserva en otro commit.

El formato aplicable de los dos archivos Web modificados pasa Prettier, tras normalizar LF en `src/services/api.ts`; el diff completo pasa comprobación de espacios. API/SQL/Markdown/OpenAPI no tienen un formateador de repositorio configurado y se revisan según sus convenciones. El formato global aún falla en 58 archivos no modificados: 56 por CRLF y dos defectos previos de main. El aviso de archivos compartidos carece de evidencia y falta sincronización antes de una publicación autorizada para revisión. Permanecen pendientes las repeticiones dirigidas, la revisión independiente del arreglo y el alcance transversal restante de TT-010; D0 sigue abierto. No hay autorización de push en esta actualización.

## Fuentes y límites

Reglas de captura: `plan/PLAN_TRABAJO_V2.md`, DEC-006. Flujo de expediente y credenciales: RDF0301, RDF0306 y RDF0401–RDF0403 de la hoja V2 de requerimientos. Contrato HTTP: `docs/api/identity-lifecycle.openapi.json`. Esta entrega no cierra D0: requiere revisión independiente, ejecución local de las verificaciones documentadas y la aprobación del corte coordinado antes de cualquier migración o despliegue compartido.
