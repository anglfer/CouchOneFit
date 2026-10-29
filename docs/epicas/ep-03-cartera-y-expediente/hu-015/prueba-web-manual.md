# Recorrido Web manual local de HU-015

Preparado el 28 de octubre de 2026 para esta computadora. El recorrido fue realizado y reportado por la persona usuaria; el agente no lo ejecutó ni observó en Chrome. La automatización se había detenido porque no pudo verificar la URL y no volvió a intentarse.

Se comprobó el asistente de arranque por HTTP local: login `200` y cartera `200` con su rol SQL restringido; después se limpiaron la fixture y el rol temporales. Esta comprobación valida la preparación, no sustituye los casos de navegador siguientes.

## Resultados reportados por la persona usuaria

Fuente: confirmación explícita y reiterada por la persona usuaria en esta conversación. No se dispone del identificador del build usado en el recorrido. No se repite el recorrido completo ni se atribuyen resultados posteriores; el bloque siguiente limita la comprobación pendiente a la integración visible de las correcciones y el fallo de conexión.

| Caso | Resultado reportado | Autor y alcance |
| --- | --- | --- |
| Login local | Pudo acceder. | Reportado por la persona usuaria. |
| Alta mínima válida y persistencia | Correcto; el cliente permaneció tras recargar. | Reportado por la persona usuaria; no se atribuye inspección SQL ni código HTTP. |
| Menor de edad | Rechazo correcto. | Reportado por la persona usuaria. |
| Estatura fuera de rango | Rechazo correcto. | Reportado por la persona usuaria. |
| Peso `70.25` | Rechazo correcto. | Reportado por la persona usuaria, antes de la corrección posterior de precisión. No acredita el caso casi válido `70.20000000001`. |
| Alta completa con opcionales | Correcto. | Reportado por la persona usuaria; no se afirma inspección de tipos/NULL en BD. |
| Doble clic y persistencia | Sin duplicación y persistencia tras recargar. | Reportado por la persona usuaria. |
| Guardado con Vite detenido | Al reiniciar y recargar, el cliente no apareció. | Reportado por la persona usuaria. No acredita el mensaje de error, la conservación de campos ni rollback de una transacción SQL. |
| Conexión Offline con formulario completo | Apareció «No pudimos comprobar tu sesión» y desapareció el formulario. Al volver a Online se recuperó la pantalla automáticamente, sin recarga manual, pero todos los campos estaban vacíos. **Conservación de campos: fallida.** | Reportado por la persona usuaria y acompañado por dos capturas del 28/10/2026. No se atribuye una prueba posterior aprobada. |
| Offline → Online después de la corrección | Los campos que había llenado reaparecieron intactos. Los opcionales estaban vacíos. | Reportado por la persona usuaria; no acredita conservación de opcionales con valores ni reintento de guardado. |
| Cierre de sesión y nuevo inicio después de la corrección | El formulario apareció vacío. | Reportado por la persona usuaria; no equivale a probar manualmente una revocación, vencimiento o cuenta distinta. |

El mensaje de error de comprobación de sesión está reportado; no equivale a confirmar el mensaje de un POST fallido. La conservación falló en el primer recorrido y luego fue confirmada manualmente para los campos llenados tras la corrección, con opcionales vacíos. No se acreditan opcionales con valores ni reintento de guardado; esos comportamientos tienen pruebas automatizadas y no un resultado manual nuevo. Tampoco se atribuyen al usuario las comprobaciones HTTP automatizadas realizadas por el agente.

## Corrección del fallo de sesión transitorio y repetición exclusiva

Diagnóstico estático y reproducido por regresión del componente real: `ProfessionalPage` borraba cuenta, perfil y suscripción ante cualquier excepción de comprobación de sesión, incluso `fetch` fallido por red. Su render condicional desmontaba `ClientAccessPanel`, cuyo formulario vive en estado React. Las comprobaciones por foco/visibilidad/intervalo de 60 segundos podían recuperar la pantalla y montar un formulario vacío sin recargar el documento. Las capturas son compatibles con esa secuencia; no demuestran por sí solas que no hubiera otra navegación. No se encontró una recarga por reconexión en PWA: la actualización espera confirmación explícita.

Corrección: ante fallo transitorio de comprobación se mantiene el subárbol en memoria, oculto e inerte hasta revalidar la misma cuenta. Reintentar y el evento Online solo comprueban sesión/perfil/suscripción; nunca reenvían el alta. Un rechazo definitivo 401/403, una notificación de cierre o cambio de cuenta descartan el subárbol anterior. Un resultado tardío no puede restaurarlo después del cierre. La identidad del perfil también debe coincidir con la cuenta verificada. No se guarda el formulario en localStorage, sessionStorage, caché ni otra persistencia, ni se ofrece edición/captura offline. Una expiración de access token recuperable por refresh válido no se confunde con una sesión definitivamente vencida/revocada.

Verificación ejecutada: **7/7 pruebas Web aprobadas** mediante `npm.cmd --prefix apps/web test`, con React DOM real y JSDOM, servicios de sesión reales, respuestas HTTP simuladas y sin conexiones de BD. Casos: fallo de red/reintento/reconexión conservando todos los campos sin POST; 401 y 403 definitivos; cambio de cuenta; cambio de cuenta con fallo posterior de perfil; fallo de guardado y reintento solo explícito; cierre concurrente con comprobación pendiente. Incluyen nombre Unicode, fecha, medidas y objetivo; ausencia de escritura del formulario en almacenamiento y ausencia de navegación durante recuperación de red. Solo se simula el registro del service worker; no se afirma prueba de navegador real. Se añadió JSDOM como dependencia de desarrollo y el script reproducible de pruebas. Build/typecheck Web, lint y Prettier de los archivos modificados pasan. `format:check` global conserva **55 avisos ajenos** (antes 58; los otros tres eran los archivos ahora modificados y normalizados: página profesional, package y lockfile). No se alteraron API, SQL, autenticación del servidor ni Supabase. Las 91 pruebas API verdes corresponden a la ejecución anterior, no a una nueva ejecución por este cambio Web.

Repetir **solo este caso**, manteniendo fixture y procesos:

1. Online, cargar una vez la versión corregida en `http://127.0.0.1:5000/app/clientes` antes de escribir. Completar todos los campos con datos sintéticos y anotarlos, sin guardar.
2. Activar Red → Offline y volver el foco a la página, o esperar la comprobación periódica hasta 60 segundos. Esperar el aviso de sesión. El formulario debe quedar oculto/bloqueado; no intentar capturar ni enviar datos offline. No recargar ni pulsar Actualizar de la PWA.
3. Volver a Online. Al verificar la misma sesión, el formulario debe reaparecer con **todos** los campos iguales, sin confirmación de alta ni nueva fila. Si es necesario, usar Reintentar. Anotar cualquier pérdida y el texto observado.
4. Si se quiere guardar, hacerlo únicamente con un clic explícito una vez Online; debe haber una sola alta. No es necesario repetir altas previas, precisión, Unicode o fechas para validar esta corrección.

Resultado posterior **reportado por la persona usuaria**: Offline → Online conserva los campos que había llenado; los opcionales estaban vacíos. Cerrar sesión e iniciar nuevamente deja el formulario vacío. No se confirmó un reintento de guardado ni la conservación de opcionales con valores. El fallo original se conserva como evidencia histórica y no se convierte retroactivamente en aprobado. Las comprobaciones negativas de sesiones inválidas/cuenta distinta y los opcionales con valores permanecen acreditadas solo por las pruebas automatizadas.

## Recorrido mínimo pendiente en la versión final

D0.3 exige validación cliente para UX y servidor autoritativo; D0.4 exige manejo de errores/estados; D0.5 permite negativos automatizados en el nivel adecuado; D0.10 exige validación desde una app real. No exige repetir manualmente todas las fronteras ni cada prueba automatizada. El recorrido anterior reportado sigue válido como evidencia de lo observado, con su alcance temporal.

Precisión, conteo Unicode y calendario ya están cubiertos automáticamente. La comprobación manual dirigida comprueba únicamente integración del formulario final: valores aceptados, asociación visible del error al campo y éxito/persistencia. No hay que repetir rangos generales, `70.25`, doble clic, alta mínima/completa ni esperar al cambio UTC/México. Año cero, máximos Unicode, precisión SQL y restitución de zona quedan en las pruebas automatizadas; no se agregan como obligaciones manuales independientes de D0.

Usar la sesión, fixture y servicios existentes en `http://127.0.0.1:5000/app/clientes`. Un solo formulario y una sola alta final:

1. Preparar nombre `Ana 😀 HU015 final`, nacimiento de 18 años exactos según el día de Ciudad de México (`2008-10-28` si es 28/10/2026), estatura `170.5`, peso `70.2`, grasa opcional `20.2` y objetivo sintético distintivo. No guardar todavía.
2. Sin salir del formulario, cambiar un campo por vez, intentar guardar y restaurarlo: nombre `😀`; nacimiento un día posterior (`2008-10-29` para esa fecha); peso `70.20000000001`; grasa opcional `20.20000000001`. Comprobar rechazo sin éxito/alta y mensaje asociado al campo correspondiente. Registrar si lo bloquea HTML o responde la API; no desactivar controles. Estos son casos dirigidos pendientes, no resultados atribuidos a la persona usuaria.
3. El caso de red ya tiene confirmación reportada para los campos llenados y opcionales vacíos según el bloque actualizado anterior. No repetirlo en su totalidad ni ampliar su alcance: opcionales con valores y reintento de guardado no están confirmados manualmente.
4. Volver a Online, reintentar el mismo formulario y comprobar una sola confirmación/alta. Recargar una vez: el nombre Unicode sigue intacto y hay una sola fila nueva. Así se comprueba el trayecto válido combinado de precisión, opcional y cumpleaños exacto sin tres altas separadas. La cartera no muestra medidas: no inferir de ella su valor exacto persistido; esa comprobación está automatizada y puede contrastarse mediante el lector sintético local si se necesita.

No detener servicios ni limpiar datos para estas comprobaciones. Registrar únicamente lo observado, navegador/versión y resultados. No copiar tokens/cookies. El recorrido no se da por aprobado hasta la confirmación de la persona usuaria. Teclado y vista estrecha no tienen resultado reportado; no se convierten en una repetición completa ni en requisitos manuales nuevos expresamente enumerados por D0.

## Arranque

### Reanudación sobre la versión final `2782bb8`

Preparación verificada por herramientas el 28 de octubre de 2026; los casos de navegador siguientes todavía no se ejecutaron ni fueron reportados para esta versión. Antes del arranque, los puertos 3000/5000 no respondían y la fixture existente tenía cuenta activa, rol profesional, perfil correcto, suscripción vigente y dos expedientes activos de diez plazas. Se conservaron cuenta, hash de contraseña, sesiones y expedientes. No se creó otra fixture ni se ejecutó limpieza.

Se arrancaron la API compilada final (build `2026-10-28T13:09:55.781Z`) y Vite en 5000 con `--strictPort`. Comprobaciones: health API directo y por Vite HTTP 200, catálogo por proxy HTTP 200, módulo Vite servido con API en el mismo origen y conexión del rol técnico a `127.0.0.1:5432/CouchOneFit_test`. Los dos cambios SQL de aislamiento están registrados. Estas comprobaciones no equivalen a repetir el login o los casos de navegador.

Abrir `http://127.0.0.1:5000/acceso` con `qa.hu015.web` y la contraseña sintética ya restablecida; después `http://127.0.0.1:5000/app/clientes`. No hace falta volver a arrancar servicios mientras sigan activos. Si se cierran, usar desde la raíz del repositorio, en terminales separadas:

```powershell
node apps/api/.env.resume-hu015-web.cjs serve
```

```powershell
$env:VITE_API_URL = ''
npm.cmd --prefix apps/web run dev -- --host 127.0.0.1 --port 5000 --strictPort
```

El asistente de reanudación está ignorado por Git, como las credenciales y el marcador (comprobado con `git check-ignore`). Carga explícitamente `.env.test.local`, verifica URL e identidad SQL y exige la fixture exacta y un rol ordinario. No guarda ni imprime contraseñas. Renueva únicamente la contraseña aleatoria del rol SQL temporal de esta fixture en memoria, después de reservar el puerto y descartar conexiones previas de ese rol; no cambia la contraseña de acceso de la persona usuaria. Al detenerse conserva todos los datos y el marcador. No usar el asistente antiguo `.env.start-hu015-web.ps1` sobre esta fixture existente.

Para verificar de nuevo el destino y los servicios, sin modificar datos:

```powershell
node apps/api/.env.resume-hu015-web.cjs status
```

El recorrido vigente es exclusivamente el bloque «Recorrido mínimo pendiente en la versión final» de arriba: un formulario y una sola alta. No repetir las altas ni los casos históricos de abajo.

La consulta `node apps/api/.env.web-smoke.cjs check` lee exclusivamente las medidas sintéticas de esta fixture, sin credenciales. Permite contrastar los valores de las nuevas altas y los dos expedientes anteriores; no sustituye la observación de mensajes/campos. Registrar por separado quién ejecutó cada comprobación, navegador y versión. No copiar cookies/tokens. La evidencia previa reportada por la persona usuaria se conserva; estos casos finales siguen pendientes hasta su confirmación.

Para terminar conservando evidencia, cerrar sesión y detener los procesos nuevos; no ejecutar `cleanup` ni el asistente antiguo. La sección histórica de limpieza al final describe una eliminación explícita de toda la fixture; no forma parte de este recorrido de reanudación.

### Creación inicial (histórico; no ejecutar si la fixture ya existe)

Los asistentes `.env.*` indicados abajo son archivos locales ignorados por Git, preparados en esta computadora. No contienen contraseñas fijadas. Cargan explícitamente `apps/api/.env.test.local` y comprueban servidor/base `127.0.0.1:5432/CouchOneFit_test` antes de usarla. No sirven para entornos compartidos.

Abre PowerShell en la raíz real del repositorio:

```powershell
Set-Location 'C:\Users\mayth\OneDrive\Documents\CouchOneFit\CouchOneFit'
node apps/api/.env.run-local-check.cjs verify
npm.cmd --prefix apps/api run build
powershell -NoProfile -ExecutionPolicy Bypass -File apps/api/.env.start-hu015-web.ps1
```

El último comando pide por entrada oculta una contraseña sintética nueva de 15–128 caracteres para la fixture Web. Elige una que recuerdes solo para este recorrido; no reutilices credenciales reales. La identidad es `qa.hu015.web`, profesional con suscripción local activa y cupo de diez clientes. El asistente se detiene si existe una fixture anterior; no sobrescribe cuentas. La API escucha en `127.0.0.1:3000` y usa una conexión SQL de rol temporal sin superusuario, con membresía `couchone_authentication`; su contraseña SQL aleatoria permanece en memoria. El archivo marcador solo guarda identificadores para la limpieza.

En otra terminal PowerShell, desde la misma raíz:

```powershell
$env:VITE_API_URL = ''
npm.cmd --prefix apps/web run dev -- --host 127.0.0.1 --port 5000 --strictPort
```

Abre manualmente `http://127.0.0.1:5000/acceso`. Entra con `qa.hu015.web` y la contraseña sintética que introdujiste localmente. Visita `http://127.0.0.1:5000/app/clientes`. El proxy `/api` apunta a la API local; no cambies variables a un servidor publicado. No guardes la contraseña en Chrome.

## Casos y resultados esperados

| Caso | Datos/acción | Resultado esperado |
| --- | --- | --- |
| Obligatorios | Enviar vacío o sin nombre, nacimiento, estatura o peso | El navegador bloquea el envío; no aparece confirmación ni alta en cartera. |
| Mayoría de edad | Nombre `Cliente QA menor`, nacimiento `2020-01-01`, estatura `170`, peso `70.2` | Error junto a nacimiento; formulario conserva los valores; sin alta ni éxito. |
| Rango/precisión | Estatura `99.9` o `170.05`; peso `29.9` o `70.25`; grasa `60.1` | Rechazo de la validación HTML o del servidor; sin alta ni éxito. |
| Alta mínima | Nombre `Cliente QA mínimo`, nacimiento `1990-05-20`, estatura `170.5`, peso `70.2`; objetivo y medidas opcionales vacíos | Confirmación después del `201`, formulario limpio y una sola fila nueva en cartera. Opcionales persistidos como `NULL`. |
| Alta completa | Nombre `Cliente QA completo`, nacimiento `1990-05-20`, estatura `175.2`, peso `80.3`, grasa `24.6`, cintura `81.3`, cadera `98.4`, objetivo `Mejorar fuerza` | Una sola alta, confirmación y valores persistidos iguales; sin redondeo adicional. |
| Persistencia | Recargar después de cada alta válida | Las filas siguen presentes; no aparecen duplicados por recargar. |
| Doble envío | Durante una alta, pulsar repetidamente Crear expediente | Botón deshabilitado durante la petición; comprobar una sola fila por envío efectivo. |
| Sin conexión | En herramientas del navegador, cambiar Red a Offline, intentar alta válida y volver a Online | Mensaje de error sin confirmación falsa; valores conservados. Tras recuperar la conexión se puede reintentar. No detener el asistente durante este caso para conservar su fixture. |
| Accesibilidad | Recorrer por Tab, enviar con teclado y revisar mensajes | Etiquetas/unidades claras, foco utilizable, error asociado al campo y confirmación anunciada como estado. |
| Vista estrecha | Usar herramientas del navegador a 390 px y 320 px | Campos y botón utilizables sin pérdida de contenido ni desplazamiento horizontal del formulario. |

Para comprobar las medidas persistidas de la fixture, desde una tercera terminal:

```powershell
node apps/api/.env.web-smoke.cjs check
```

Este comando devuelve únicamente los datos sintéticos de los clientes de esta fixture. Registra qué casos pasaron, navegador/versión y cualquier fallo; no copies cookies, tokens ni credenciales.

## Cierre y limpieza exclusiva de la fixture

Cierra sesión en Web y detén Vite y API con Ctrl+C en sus terminales. Si el asistente informa que limpió la fixture, no hace falta repetir la limpieza. Si Windows terminó el proceso sin ejecutar su manejador de cierre:

```powershell
node apps/api/.env.web-smoke.cjs cleanup
```

La limpieza verifica de nuevo servidor/base, el UUID y la identidad sintética esperada; elimina solo las sesiones, clientes y suscripción de esa fixture, su profesional/cuenta y su rol SQL temporal. No borra ni recrea la base. Si el marcador ya no existe, la limpieza se detiene. Este recorrido no acredita aislamiento de lectura SQL TT-010 ni cierra D0.
