# Revisión final de HU-015

## Alcance y evidencia

Revisión del diff completo contra `origin/main` local `27a7df7`, incluidos los cambios sin commit y los documentos nuevos no rastreados. No se actualizó el remoto, no se descartó trabajo ni se publicó la rama. Fuentes funcionales: secciones vigentes HU-015, DEC-006 cerrada y D0 de `plan/PLAN_TRABAJO_V2.md`; no se usó la DEC-006 histórica de rangos propuestos. Se mantienen las decisiones de una sola tabla, columnas anulables para expedientes anteriores, objetivo opcional y medidas base separadas de históricos.

**T**: ejecutado mediante pruebas/herramientas. **E**: inspección estática. **R**: reportado por la persona usuaria. Los estados pendientes siguen siendo requisitos abiertos aunque estén documentados.

Resultado final de esta revisión: **87 pruebas API aprobadas, 0 fallidas y 0 omitidas**, 69799 ms. Builds API/Web y lint aprobados; OpenAPI JSON válido. `git diff --check` sin errores. El escaneo de archivos publicables no encontró secretos locales conocidos, claves privadas ni URLs con credenciales, ni archivos temporales publicables. Su alcance es el diff y los documentos nuevos; no equivale a una auditoría exhaustiva de todo el historial del repositorio.

| Requisito | Fuente | Evidencia | Estado |
| --- | --- | --- | --- |
| Alta de expediente propio sin crear cuenta cliente | HU-015 aceptación, BD1/API1 | T: alta completa devuelve medidas; inserción única en `private.clients`. E: no alta en `users`, invitación independiente. | Cumple |
| Obligatoriedad, límites, unidades, 0,1, opcionales NULL | DEC-006 vigente; decisiones de compatibilidad | T: límites, coerción, no finitos, vacío/cero/NULL y precisión próxima a una décima; SQL rechaza exceso de precisión. E: kg/cm/% consistentes. | Cumple |
| Nacimiento válido y mayoría de edad | DEC-006; calendario por defecto DEC-008 | T: fechas imposibles, año cero, cumpleaños y salto de día UTC/México; contexto SQL coincide y se restablece. | Cumple |
| Identificadores, capas y textos | DEVELOPMENT.md; convenciones BD; glosario | E: inglés snake_case/camelCase/PascalCase; español visible; controlador → servicio/validación → repositorio, SQL parametrizado. Validación del alta permanece en el servicio del módulo, siguiendo su estructura. | Cumple |
| Sesión, rol profesional, CSRF y propiedad | HU-015 aceptación; D0.3; rutas existentes | T: roles denegados, sesión real/revocación, CSRF, propietario manipulado, aislamiento HTTP y RLS INSERT/UPDATE. E: `requireProfessional`, `lockActor` y propietario de sesión. | Cumple |
| Cupo y atomicidad | HU-013; HU-015 API1/QA1 | T: carreras por último cupo, reactivación, suspensión, downgrade, rollback ante trigger y posterior disponibilidad. E: misma transacción y bloqueo profesional. | Cumple |
| Invitaciones, estados y autenticación sin regresión | HU-015 DoD; HU-007/008; DEC-004 | T: suites de ciclo de acceso, login profesional/cliente, checkout y estados. E: cambios compartidos preservan errores sin `fields`, control de estado y flujos de invitación. | Cumple |
| Restricciones, permisos y conservación anterior | HU-015 BD1; convenciones BD | T: instalación limpia, paridad de columnas/constraints/índices/policies/permisos, actualización con expediente anterior sin fabricar datos. E: migraciones históricas intactas, sin grants nuevos. | Cumple |
| Contrato SQL/API/Web/OpenAPI coherente | D0.2/9; glosario | T: alta HTTP, JSON OpenAPI parseable y compilaciones. E: nombres base uniformes, respuesta `201`, errores por campo y opcionales. OpenAPI describe calendario y años admitidos. | Cumple |
| Formulario real, errores, confirmación y persistencia Web | HU-015 WEB1; D0.4/10 | R: altas mínima/completa, opcionales, persistencia, rechazo de menor/estatura/peso y doble clic sin duplicación correctos. R: con Vite detenido, el cliente no apareció tras reiniciar/recargar. Faltan repeticiones dirigidas de las correcciones posteriores y confirmar mensaje/conservación de campos; no se atribuye ejecución al agente. | Pendiente |
| QA completo de la historia | HU-015 QA1; D0.5 | T: 87 pruebas automatizadas aprobadas. R: recorrido parcial confirmado según detalle manual. Los resultados no se invalidan en bloque; quedan casos dirigidos y aspectos no confirmados. | Pendiente |
| Aislamiento de lectura SQL TT-010 | TT-010-2/4 y aceptación; convenciones BD/RLS | E + T: rol efectivo `couchone_authentication`, sin superusuario/BYPASSRLS y contexto A, leyó el expediente de B y las seis columnas nuevas. La transacción sintética se revirtió. El grant/policy heredados amplían su alcance de datos al agregar columnas; no se descarta por ser previo. | Pendiente |
| Build/lint/tests y formato aplicable de archivos modificados | CONTRIBUTING.md §1.4; DEVELOPMENT.md; D0.7 | T: builds API/Web, lint y suite aprobados; los dos archivos Web modificados pasan Prettier. `api.ts` requería normalizar LF y se corrigió. E/T: API/SQL/Markdown/OpenAPI no tienen un formateador de repositorio exigido; se revisaron sus convenciones y `git diff --check` pasó en todo el diff. | Cumple |
| Formato global previo de main | DEVELOPMENT.md; evidencia de referencia | T: `format:check` actual falla en 58 archivos no modificados, frente a 60 en referencia. 56 avisos son solo CRLF y dos son formato previo de README Web/AdminPage. No se afirma que el comando global esté verde. | Pendiente |
| Rama y mensajes de los cuatro commits existentes | CONTRIBUTING.md §§2–3 | T: `feature/api-client-initial-record`; cuatro commits feat/database, feat/api, feat/web y docs/ep03 con formato convencional. E: sin cambios hacia HU-016 ni otros módulos funcionales. | Cumple |
| Aviso y coordinación de archivos compartidos | CONTRIBUTING.md §1.3 | E: `apps/api/src/app.ts`, `auth/types/errors.ts`, `apps/web/src/services/api.ts` y repositorio de cupo son compartidos. No hay evidencia verificable en la sesión del aviso previo al equipo. La revisión técnica no sustituye ese aviso; debe acreditarse/regularizarse antes de publicar. No se enviaron mensajes al grupo. | Pendiente |
| Commit de corrección y sincronización previa | CONTRIBUTING.md §4 pasos 3/5; instrucción del usuario | T: correcciones siguen sin commit; referencia remota aún no actualizada. Debe integrarse con el trabajo vigente y repetir lo afectado antes del push autorizado. | Pendiente |
| Secretos, temporales y alcance del diff | CONTRIBUTING.md §6 | T: escaneo sin coincidencias con secretos locales conocidos ni patrones de credenciales/private keys; ningún `.env`, log, build o dependencia entre archivos publicables. Asistentes/credenciales siguen ignorados. E: cambios adicionales de tests documentados por 22 fallos reproducidos en referencia. | Cumple |
| Móvil, fórmulas, evaluaciones e históricos | Alcance HU-015; DEC-007; instrucción del usuario | E: no se agregaron campos de cálculo, tablas históricas, UI móvil ni trabajo HU-016. El perfil móvil actual no consume estas medidas. | No aplica |
| Revisión independiente y cierre D0 | D0.8; instrucción del usuario | No hay revisión de otro integrante acreditada. Esta revisión la realiza el mismo agente implementador. D0 permanece abierto. | Pendiente |

## Correcciones propias encontradas

1. La tolerancia `1e-9` aceptaba medidas apenas fuera de la décima que SQL rechaza. Se compara con su representación exacta a un decimal; valores válidos como `70.2` permanecen aceptados.
2. JavaScript acepta año `0000`, pero PostgreSQL no. Se rechaza con `400 INVALID_INPUT` antes de persistir y se expresa el rango en OpenAPI.
3. JavaScript contaba UTF-16 y PostgreSQL caracteres Unicode. Se alineó el conteo de nombre/objetivo; un nombre de un solo símbolo ya no termina como fallo de persistencia.
4. API calculaba la edad con el día UTC y SQL con la zona de la conexión. Se utiliza `America/Mexico_City` en la validación y `SET LOCAL TIME ZONE` exclusivamente dentro de la transacción de alta. No cambia timestamps absolutos ni la rama de cambio de estado; no modifica migraciones ya aplicadas. La prueba parte de una conexión UTC, exige la zona esperada durante el INSERT y comprueba que vuelve a UTC tras COMMIT.

Se añadieron cinco pruebas unitarias del contrato inicial, una prueba HTTP de rechazo sin filas parciales, una prueba de calendario/contexto SQL y una aserción adicional de UPDATE RLS entre profesionales. Las pruebas del cupo, invitaciones y autenticación continúan ejecutándose para los archivos compartidos.

## Regla incumplida y alcance de TT-010

El plan establece en TT-010: **«Bloquea: todas las rutas privadas»**; TT-010-2 exige **«roles/grants/RLS bajo el contexto de usuario/tenant elegido»**; TT-010-4 exige pruebas cruzadas de API y BD con roles ordinarios. Su aceptación dice **«profesional A nunca lee/escribe cartera B»**. Las convenciones BD exigen permisos mínimos y políticas alineadas con el rol persistido y la operación.

El esquema concede `GRANT SELECT ON private.users,private.clients TO couchone_authentication` y define `select_clients ... USING (true)`. SELECT de tabla abarca también las columnas añadidas después: `birth_date`, `height_cm`, `base_weight_kg`, `base_body_fat_percentage`, `waist_cm` e `hip_cm`. No hay restricción por propietario en esa política. Aunque el SQL de permisos no cambie, HU-015 aumenta la información legible mediante ese acceso técnico: es impacto de esta entrega, además de deuda heredada.

La comprobación local usó dos profesionales sintéticos dentro de una transacción. Tras `SET LOCAL ROLE couchone_authentication` y contexto `app.subject_id` del profesional A, se pudo consultar la fila del profesional B con las seis columnas no nulas. El rol efectivo tenía `rolsuper=false` y `rolbypassrls=false`. Se imprimieron solo indicadores y nombres de columnas, no medidas ni secretos; `ROLLBACK` eliminó todos los datos sintéticos del diagnóstico. No se tocó la fixture manual. Esto demuestra un incumplimiento, no una prueba de aislamiento aprobada. Los 87 tests verdes no resuelven este requisito: falta una prueba negativa que impida esa lectura y la corrección de roles/contexto/policies con revisión de sus consumidores.

## Puertas de publicación y aceptación

### 1. Publicar una rama exclusivamente para revisión

No se hace push por instrucción actual de la persona usuaria. Antes de una publicación autorizada siguen pendientes el aviso/coordinación de archivos compartidos de CONTRIBUTING.md y el commit de corrección/sincronización con origin/main, con repetición de lo afectado si cambia la integración. Builds, lint, tests y formato aplicable de archivos modificados están comprobados. No se detectaron secretos ni temporales publicables.

Publicar una rama para que otro integrante revise los hallazgos no equivale a aprobarla ni exige afirmar D0 cerrado. Las fuentes no establecen que la revisión independiente deba ocurrir antes de publicar la rama que se va a revisar. TT-010, repeticiones manuales y deuda global deben figurar como pendientes de un PR en borrador/no listo para aprobación; su publicación para revisión no los acepta ni habilita ejecución compartida. No se infiere autorización de push de esta distinción.

### 2. Aprobar el PR, integrar o cerrar D0

TT-010 P0 impide acreditar la aceptación de aislamiento y cerrar la dependencia de HU-015; debe corregirse y probarse, nunca darse por resuelto por documentarlo o declararlo previo. El riesgo se mantiene visible para las nuevas medidas y no se solicita ni presupone una excepción aprobada. También faltan las repeticiones manuales dirigidas de precisión/Unicode/fechas, confirmar mensaje y conservación de campos ante fallo de conexión, los aspectos Web no reportados y la revisión de otro integrante exigida por D0.8. La deuda global de formato sigue pendiente y requiere tratamiento explícito en la revisión; no se presenta el comando como aprobado ni se atribuye a HU-015. Las vulnerabilidades previas de dependencias siguen registradas, sin cambios automáticos de lockfiles.

Los resultados manuales se registran exclusivamente como **R: reportados por la persona usuaria** en [prueba-web-manual.md](prueba-web-manual.md), sin atribuir mensajes de error, campos conservados o comprobaciones SQL no confirmados. Las repeticiones se limitan a las rutas cambiadas; no se exige repetir login, doble clic ni rango de estatura por cambios ajenos a esos comportamientos.

La API encendida carga módulos compilados al arrancar; recompilar no recarga ese proceso. Antes de repetir los casos corregidos se necesita un proceso con el build actualizado y preservar la evidencia/fixture actual al planear el reinicio. No se detuvo ni limpió el recorrido existente para actualizar estos documentos.
