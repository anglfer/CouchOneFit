# Evidencia HU-020 — Perfil base

29/10/2026, America/Mexico_City. Base Git `11aea9f`, rama `feature/api-client-portfolio`, inicialmente limpia. T = herramienta/prueba, E = inspección estática del implementador, R = reporte humano. **No hay resultados manuales HU-020 reportados.** Ni las pruebas API ni la inspección equivalen a ejecutar Flutter.

| Requisito/fuente | Evidencia | Estado |
| --- | --- | --- |
| Registro → preparación → invitación → activación → mismo expediente (HU-008/020) | T: prueba nueva HTTP real con LOGIN runtime ordinario sobre BD temporal; registro profesional real, suscripción sintética aprovisionada explícitamente, alta y canje API; ID activado igual al creado y leído. No se acredita pago ni Android por esta prueba. | Cumple en API |
| Edición profesional reflejada al consultar (HU-017/020) | T: PATCH profesional con versión de BD, GET cliente conserva ID y refleja nuevo objetivo/peso base; no recaptura. | Cumple en API |
| Proyección y base vs progreso (DEC-009) | T: conjunto exacto de campos, valores SQL y opcionales nulos; sin propietario, progreso, flags ni históricos. E: autorización base contrastada en README, no basada solo en existencia física. | Cumple en este incremento |
| Propiedad/API/RLS (TT-010) | T: dos clientes, query ID manipulado 400, cliente/profesional/admin/anónimo, contexto limpio, runtime sin superuser/BYPASSRLS/DDL; pruebas anteriores de SELECT/UPDATE propio/ajeno. | Cumple en este alcance, TT-010 transversal abierto |
| Estados DEC-004 | T: lectura de expediente inactivo con profesional inactivo y sin suscripción; nulos anteriores; sesión revocada/cuenta inactiva denegadas. Sin consumo/cupo para GET. | Cumple en API |
| Compatibilidad | T: perfil anterior conserva campos, checkout profesional GET plans 200/cliente 403; suite de pagos, invitación, activación, cupo y HU-015–018. E: guard solo en ruta record. | Cumple en API |
| Suite API/migraciones | T: **117/117**, 0 fallidas/omitidas, **92781 ms**. Incluye tres casos nuevos y migración limpia/actualización anterior; sin nueva migración. Build TypeScript aprobado. | Cumple |
| Flutter lectura/estados/unidades | E: modelo, servicio, pantalla de datos base y gate adaptados; cinco pruebas nuevas preparadas, mocks anteriores actualizados al contrato nuevo. **Sin flutter analyze/test/build ni formateador Dart ejecutados.** | Pendiente de SDK y ejecución |
| Regresiones Web | T: **28/28**, 0 fallidas/omitidas, **4398 ms**; build y Oxlint aprobados. No se modifica Web en este incremento. | Cumple |
| Formato | T: git diff --check correcto. format:check Web conserva los 53 fallos previos en archivos ajenos; no se reformatean. Dart formatter no ejecutado por SDK ausente. | Deuda previa Web / verificación Dart pendiente |
| Contrato/secretos | T/E: OpenAPI parseado y referencias resueltas; esquema nuevo y perfil anterior documentados. Revisión de archivos publicables sin claves locales conocidas, clave de fixture nueva ni temporales; helpers/credenciales ignorados con git check-ignore. Sin cambios a lockfiles/dependencias/SQL históricos. | Cumple |
| Progreso/históricos | E: HU-036 no implementada; no se inventan servicios, flags, filas ni arrays vacíos. No hay tablas históricas que acreditar conservadas. | Pendiente integración, no vacío real |
| Revisión independiente/D0 | Sin otro integrante revisor, sin recorrido Android de esta versión. Evidencia anterior de HU-004/008 es antecedente, no ejecución actual. | Pendiente |

## Incidencia propia corregida

Primera ejecución API: 116/117. La prueba nueva esperaba cintura 80.2 aunque HU-017 había dejado NULL en esa misma fixture aislada. Se corrigió para comparar con la fila persistida actual, manteniendo exactitud del comportamiento y sin modificar datos previos; suite completa posterior 117/117. Al revisar OpenAPI se corrigió `ClientBaseRecord.status`, antes const active, a enum active/inactive coherente con fichas/estado existentes; no cambia reglas funcionales.

## Entorno y fixtures

Se carga explícitamente `.env.test.local` mediante el verificador ignorado. Comprueba URLs idénticas postgres local sin parámetros y servidor efectivo **127.0.0.1:5432/CouchOneFit_test** antes de probar. Los casos HU-020 se ejecutan en BD/rol temporales propios de client-read-isolation, que se eliminan al terminar; la suite heredada también incluye pruebas que agregan identidades sintéticas únicas a la base exclusiva CouchOneFit_test, como registration.test.ts. No se presenta toda la suite como si utilizara exclusivamente BD efímeras ni se ejecuta limpieza indiscriminada de fixtures manuales. Sin Supabase compartido.

Preparación manual aditiva: profesional `qa.hu020.1b16b463`, expediente A `ab04ad1f-3857-4b68-a4da-e9456b97f78e`, B `ed9020c7-3019-4094-9a90-eafbf84d6c22`, nombres prefijados HU020 QA. Ambos no vinculados, activos, con datos base sintéticos y cadera NULL. El preparador `scripts/prepare-client-record-e2e.ts` solo inserta nuevas filas; duplicados abortan sin restablecer claves ni sobrescribir existentes. La suscripción es aprovisionamiento QA, no compra simulada acreditada. Comparación por ID/hash de filas completas en clients/users/professionals/subscriptions/invitations/access_events/notice_acceptances confirmó que **todas las filas anteriores permanecieron intactas**. No se borran al terminar. Clave inicial aleatoria solo en archivo local ignorado, nunca en chat/Git; se ofrece entrada oculta para elegirla antes del primer uso.

Android Studio y SDK local existen en `C:\Program Files\Android\Android Studio` y `C:\Users\mayth\AppData\Local\Android\Sdk`; AVD instalado `Medium_Phone_API_37.0`. Java integrado observado **25.0.3**. No se arrancó emulador ni se acredita dispositivo conectado/build Gradle compatible por enumerarlo.

Tras compilar se identificó exclusivamente el asistente API anterior por puerto 3000 y command line esperada, y se reinició con el build HU020/runtime ordinario local. Su comprobación conserva qa.hu015.web, 27 clientes propios/5 activos y suscripción anterior; Vite se mantiene. No se acredita Android por dejar API preparada. No se imprimieron credenciales.

Flutter y Dart no están en PATH ni se localizaron en rutas habituales C:\src, C:\tools, C:\flutter, carpetas de desarrollo de usuario, descargas, documentos, OneDrive o caché revisadas. No se afirma inexistencia absoluta en otros discos. `pubspec.yaml`: Dart >=3.0.0 <4.0.0 / Flutter >=3.10.0; **lockfile**: Dart >=3.11.0-0 <4.0.0 y Flutter >=3.18.0-18.0.pre.54. Se necesita Flutter estable compatible con el Dart fijado, sin actualizar dependencias/lockfile. Java/AGP/Gradle se deberán comprobar con doctor/build una vez localizado SDK; no se prescriben cambios globales ni se instala software. Revisión/programación Flutter no acredita validación.

Sin push, otra rama/PR, merge, despliegue o cierre de D0/HU-020. PR #22 y HU-015 intactos. Aviso específico de archivos compartidos no acreditado; autorización de implementación registrada, sin inventar coordinación.

Commits locales por bloque: `7e24268` API/contrato/pruebas/preparador aditivo y `3a6f549` código Flutter/pruebas aún sin SDK. Esta documentación registra explícitamente esas limitaciones; un commit no acredita compilación ni aprobación de Flutter.
