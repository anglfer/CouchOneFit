# Auditoría de EP-03 — 31 de octubre de 2026

Rama examinada: `feature/api-client-portfolio`. Commit de producto: `3739ab4ae7caadaa00bc2470e162a8b8adc5afd8`.

**Informe histórico previo a correcciones.** La persona usuaria autorizó posteriormente corregir lo propio de EP-03 y asignar dependencias ajenas a sus HU/sprints. Consultar el [seguimiento vigente](seguimiento-auditoria.md): la búsqueda Unicode ya tiene corrección y la deuda de formato se atiende por alcance. Los hallazgos y resultados originales siguientes se conservan como evidencia del estado auditado, no como estado final del producto modificado.

## Dictamen

**EP-03 no está completa y no reúne todavía su Definition of Done.** HU-015–018 tienen implementación y cobertura automatizada sustancial. HU-019 es una composición parcial y HU-020 solo cubre el perfil base. La documentación local reconoce estas limitaciones; no hay fundamento para cambiar su estado a terminada.

Fuentes de aceptación: `plan/PLAN_TRABAJO_V2.md` §3.4, §4.4, §5.2 y HU-015–020; `docs/requirements/sistema-interno.md` RF03/RF04; `docs/requirements/cliente.md` RC02; README y estado de integración de EP-03. El inventario técnico del plan tiene corte histórico: sus afirmaciones de octubre sobre módulos inexistentes no describen por sí solas la rama actual.

## Hallazgos que impiden el cierre

1. **HU-019 / RDF0404: faltan los módulos consolidados reales.** `apps/api/src/features/professional/services/record.ts` devuelve siempre `not_integrated` para alimentación, entrenamiento, evaluaciones, progreso e historial de peso. No consulta esos módulos ni devuelve versiones activas o registros históricos. El tipo `RecordSection` tampoco tiene una variante con datos; el consumidor Web solo acepta `not_integrated`, `empty` y `error`. Por tanto, agregar posteriormente un lector de BD no bastará: habrá que completar conjuntamente contrato, validación, presentación y pruebas. Dependencias: HU-021/022/026/030/033/037. El DoD de HU-019 prohíbe cerrarla antes de esa integración.
2. **HU-020 / RDC0204: falta progreso autorizado por el profesional.** `apps/api/src/features/client/repositories/profile.ts` proyecta datos iniciales y objetivo; no integra categorías/permisos HU-036. `apps/mobile/lib/features/client/widgets/client_base_measurements.dart` muestra explícitamente progreso no disponible. Evitar devolver progreso oculto es correcto en este incremento, pero no satisface la consulta de progreso habilitado. Faltan casos reales de permisos activos, revocación y filtrado de todas las proyecciones conforme DEC-009.
3. **Conservación de históricos: prueba incompleta por dependencias ausentes.** Las pruebas existentes conservan campos, vínculo, invitaciones, sesiones y auditoría. Eso no prueba aún que editar/inactivar/cambiar versión activa preserve evaluaciones, planes, ejecución, seguimiento y eventos de peso reales. Debe repetirse con registros no vacíos de los módulos integrados; es criterio de HU-017/018/019.
4. **D0 y revisión independiente siguen pendientes.** El estado por historia reconoce que otro integrante no ha cerrado la revisión requerida. Una auditoría automática no sustituye esa revisión. También siguen visibles TT-010 transversal y las condiciones DEC-011/015 para datos reales.
5. **HU-016: búsqueda Unicode dependiente de la configuración de PostgreSQL.** La suite completa en PostgreSQL 17.6 con proveedor libc y locale `C` terminó 119/120: buscar `😀 ána` no encuentra `Literal 😀 Ána`. La consulta usa `lower` sin collation explícita. Reproducción SQL: `lower('Ána')` devuelve `Ána`, mientras `lower('Ána' COLLATE "und-x-icu")` devuelve `ána`. Con un clúster temporal ICU `und`, la misma suite de aislamiento pasó 32/32 sin cambios de producto. Es una dependencia de entorno comprobada: definir/verificar la collation Unicode soportada en provisionamiento y pruebas, o hacer explícita la comparación en una corrección compatible. No implica que falle el remoto: su configuración no se consultó.

## Matriz de tareas y aceptación

| Historia | Tareas contrastadas | Resultado y evidencia |
| --- | --- | --- |
| HU-015 | BD1, API1, WEB1, QA1 | Alta con datos personales, objetivo y medidas; validaciones de adulto/calendario/Unicode/rangos/precisión; SQL parametrizado, propietario derivado y cupo transaccional. Pruebas de alta inválida, manipulación, fallo y competencia de cupo. Implementación base presente; D0 pendiente. |
| HU-016 | API1, WEB1, QA1 | Cartera propia con búsqueda literal por nombre, filtro activo/inactivo, cursor firmado ligado a usuario/filtros/tamaño y orden por fecha/UUID. Pruebas de dos carteras, caracteres especiales, límites, microsegundos, empates y respuestas antiguas. Implementación presente; D0 pendiente. |
| HU-017 | API1, WEB1, QA1 | Whitelist, datos omitidos conservados, versión BD, rechazo de conflicto y reaplicación explícita; edición no consume plaza. Pruebas de roles, propiedad, CSRF, precisión, concurrencia, rollback, pérdida de respuesta y cambio de identidad. Históricos de módulos futuros aún no verificables. |
| HU-018 | API1, WEB1, QA1 | Confirmación, versión, cambio de estado operativo, cupo al reactivar y auditoría dentro de la transacción. Repetición sin efecto no duplica auditoría. Pruebas de cancelación/Escape, conflictos, competencia por última plaza, fallo de auditoría, sesión abierta e invitación conservada. Históricos futuros y D0 pendientes. |
| HU-019 | API1, WEB1, QA1 | Perfil real con propiedad comprobada, cinco indicadores de integración ausente, cambio de cliente y descarte de respuestas tardías. Parcial: no hay expediente completo con planes/evaluaciones/progreso/versiones, ni fixture integral real. |
| HU-020 | API1, MOV1, QA1 | GET propio sin selector de identidad, proyección explícita, lectura inicial sin recaptura y perfil móvil solo lectura. Pruebas de activación→vínculo original→edición→lectura, aislamiento A/B y limpieza por cambio de sesión. Parcial: falta progreso/visibilidad HU-036. |

## Coherencia de las reglas implementadas

- **Identidad y propiedad:** middleware verifica rol mediante sesión; consultas limitan cartera al profesional y perfil al cliente vinculado. El móvil no recibe un editor de datos base. Cursores no permiten cambiar cartera o filtros silenciosamente.
- **Cupo:** alta/reactivación efectiva consumen plaza; edición, consulta, invitación y activación de expediente ya reservado no consumen otra. Las operaciones de cupo comparten bloqueo del profesional. Esto coincide con DEC-004/005 y §4.4.
- **Estados:** inactivar expediente no da de baja la cuenta, no suspende la suscripción y no borra invitaciones. La cuenta cliente activa conserva lectura propia autorizada; cuenta/sesión revocadas se rechazan. Es el comportamiento acordado, aunque el expediente o profesional estén bloqueados operativamente.
- **Datos:** las medidas iniciales se identifican como base, con kg/cm/% y nulos distintos de cero. No se inventa fecha de medición desde la fecha de creación ni se transforma el peso inicial en un evento histórico. No se confunde peso corporal con carga de ejercicio.
- **Errores y concurrencia:** fallo de lectura no se presenta como vacío; integración ausente se distingue de módulo consultado sin filas. Versiones evitan sobrescritura silenciosa; errores de red no reenvían automáticamente escrituras y el cambio de identidad descarta datos anteriores.

Fuera de la dependencia Unicode reproducida, no se detectó una contradicción funcional adicional en esos comportamientos durante esta revisión. Esto no acredita módulos ausentes ni demuestra ausencia universal de defectos.

## Verificación ejecutada en esta auditoría

Las pruebas anteriores relatadas en los README no se contabilizan como ejecuciones nuevas.

| Comprobación | Resultado actual |
| --- | --- |
| API `npm run build` | Aprobado. |
| API validadores HU-015/HU-017/SaaS | 9/9 aprobadas. |
| Migración limpia local | 16 migraciones aplicadas correctamente. |
| API suite completa, locale C/libc | 119/120; falla búsqueda de mayúscula acentuada. |
| API aislamiento, locale ICU und | 32/32 aprobadas sin cambiar código; confirma dependencia de collation. |
| API suite completa, locale ICU und | 120/120 aprobadas (99.8 s), incluidas migraciones, autorización, concurrencia, cupo, atomicidad y sesiones. |
| Web `npm run build` | Aprobado, incluida generación PWA. |
| Web `npm test` | 36/36 aprobadas. |
| Web `npm run lint` | Aprobado. |
| Web `npm run format:check` | Falla: 69 archivos señalados en este checkout. No se atribuyen todos a esta rama ni se reformatean. |
| Móvil `flutter analyze` | Sin incidencias. |
| Móvil `flutter test` | 41/41 aprobadas. |
| OpenAPI: resolución de referencias internas | 56 referencias; ninguna sin resolver. Verifica estructura de referencias, no conformidad completa de respuestas. |
| `git diff --check` antes del informe | Aprobado. |

La primera ejecución Web no pudo cargar `jsdom`. Se restauraron dependencias locales con `npm install --ignore-scripts --no-save --package-lock=false`, sin editar manifiesto ni lockfile versionados, y se volvió a ejecutar la suite con éxito. El formato anterior documentaba 53 archivos; el resultado de hoy es 69 y no debe sustituirse por la cifra histórica ni atribuirse una regresión sin comparar archivos y finales de línea contra su base.

La configuración API existente apunta a Supabase. No se utilizó para pruebas. Se preparó un clúster PostgreSQL temporal exclusivo en loopback, puerto 55439, con base `cof_audit_test`, utilizando el paquete binario local previamente disponible. Las suites de aislamiento crean sus bases y roles ordinarios propios. No se modificó configuración remota ni fixtures humanas.

Después de diagnosticar la búsqueda, se repitieron migraciones y la suite completa en un segundo clúster temporal con proveedor ICU `und`: 120/120. El servidor temporal se detuvo al terminar. La repetición satisfactoria no elimina la dependencia de configuración encontrada en `C`.

El índice del grafo tiene archivos no rastreados/metadatos cambiados para el incremento EP-03; sus resultados no se trataron como inventario completo. Los archivos materiales de implementación y pruebas se leyeron directamente para suplir esa cobertura.

## Pruebas necesarias para aceptar el cierre futuro

1. Integrar los lectores reales y payloads de HU-019; probar expediente completo y vacío, fallos por sección, dos profesionales/dos clientes, versiones activas y conservación de históricos.
2. Integrar HU-036 en HU-020: categorías deshabilitadas por defecto, concesión/revocación efectiva en la siguiente consulta, respuesta agregada filtrada y denegación de rutas dedicadas conforme DEC-009. Probar API y móvil con datos reales sintéticos de progreso.
3. Repetir edición/inactivación/reactivación y cambios de plan con históricos no vacíos de todos los módulos implicados, acreditando su conservación.
4. Ejecutar recorrido integrado Web→API→BD→móvil en el mismo entorno; registrar lo observado separadamente de dobles de prueba. Esta auditoría no repitió un recorrido humano en Android ni un navegador real.
5. Resolver el gate de formato según su alcance y completar revisión independiente/D0 y pendientes transversales aplicables antes de declarar EP-03 completa.
6. Hacer reproducible la política Unicode de búsqueda y comprobarla en el entorno de despliegue; no omitir la regresión de nombres acentuados.

La auditoría no modifica código de producto, no marca historias como terminadas y no realiza commit, push, PR, merge ni despliegue.
