# Recorrido manual breve — HU-016

Preparación y casos propuestos, **sin resultados humanos acreditados todavía**. Reutilizar la fixture sintética local existente; no ejecutar la limpieza de HU-015 ni crear duplicados. Las pruebas automatizadas usan otras bases/roles temporales locales que eliminan al finalizar, no esta fixture.

## Preparación concreta de esta computadora — 28/10/2026

Acuerdo vigente: commits por HU y próximo PR al completar EP-03, sin PR separado de HU-016 ni cambios al PR #22. La rama activa es `feature/api-client-portfolio`; API y Web se recompilaron desde su código. Se identificó la API antigua del asistente de reanudación y se reinició exclusivamente ese proceso para cargar el build HU-016; Vite permaneció activo. Las conexiones runtime verificadas usan solo `127.0.0.1:5432/CouchOneFit_test`, sin superusuario/BYPASSRLS. Vite escucha en 127.0.0.1:5000, sirve el módulo de cartera HU-016 y usa `/api` del mismo origen hacia 127.0.0.1:3000. Health directo/proxy y catálogo: 200.

Se añadieron únicamente fixtures identificables: **24 expedientes propios `HU016 QA`**, 2 activos y 22 inactivos, y un profesional/expediente ajeno `HU016 QA AJENO`. Todos son sintéticos; no se entregan credenciales de la cuenta ajena, que no hacen falta para intentar la lectura desde la cuenta propia. La cuenta existente `qa.hu015.web`, su contraseña y sus tres expedientes anteriores se conservaron. Sus filas completas se compararon por hash antes/después y siguen idénticas. El cupo activo pasó de 3 a 5 de 10 sin cambiar suscripción, plan o registros anteriores; las altas inactivas permiten probar páginas sin exceder cupo.

Los nuevos expedientes tienen nacimiento 1990-05-20, estatura 170.5 cm, peso 70.2 kg y objetivo marcado como fixture; el primero tiene grasa 20.2 %, el resto NULL; cintura/cadera permanecen NULL. No son datos reales ni nuevas pruebas humanas de HU-015. El asistente local `.env.hu016-manual.cjs` y el marcador `.env.hu016-fixture.json` están ignorados por Git (`git check-ignore` comprobado). El modo prepare reutiliza una fixture marcada existente, sin duplicar ni restablecer registros; ante datos sin marcador se detiene. No contiene una limpieza automática.

Comprobación adicional del agente por HTTP, **no manual**: usando una sesión temporal de la cuenta sintética, creada y eliminada por su UUID exacto, el listado a través de Vite devolvió 20+4 IDs propios sin repetidos y la ficha propia 200/ajena 404. No se modificaron sesiones anteriores. No se usó Supabase. Los 97 tests API y 11 Web anteriores siguen siendo evidencia automática; esta preparación no se presenta como repetición de esas suites.

El recorrido vigente queda reducido a estos casos de HU-016:

| Paso | Acción concreta | Resultado esperado |
| --- | --- | --- |
| Acceso | Abrir `http://127.0.0.1:5000/acceso`, usar `qa.hu015.web` con la contraseña sintética existente y visitar `/app/clientes`. No hace falta arrancar otro servidor mientras los actuales respondan. | Cartera propia; no copiar contraseña/cookies/tokens. |
| Páginas | Estado Todos, tamaño 20, buscar `HU016 QA`. Anotar nombres de Página 1, ir a Siguiente y volver a Anterior. | 20 resultados y luego 4; Siguiente deshabilitado en la segunda. Al volver, los mismos 20 en el mismo orden. Ningún `HU016 QA AJENO`. El orden es creación/UUID, no alfabético por número. |
| Estado | Mantener `HU016 QA`; elegir Activos y después Inactivos. | Activos: 2, sin segunda página. Inactivos: 22, páginas de 20+2. Cambiar filtro/tamaño reinicia Página 1. |
| Literales | Con Todos, buscar `%`, luego `_`, luego `O'Connor`, luego `😀`, luego `\`. | Una coincidencia propia en cada caso: `HU016 QA 01 Literal %`, `02 Literal _`, `03 O'Connor`, `04 Ana 😀`, `05 Barra \ literal`, respectivamente. Los signos no expanden la búsqueda como comodines. |
| Cero coincidencias | Buscar `HU016 QA NO EXISTE`. | «No hay resultados para estos filtros», sin confundirlo con cartera vacía o error de red. No borrar registros para provocar cartera vacía; ya está automatizada. |
| Ficha propia | Volver a buscar `HU016 QA 01` y pulsar su nombre. | Ficha de lectura con nombre, estado activo, fecha 1990-05-20, estatura 170.5, peso 70.2 y grasa 20.2; cintura/cadera «Sin registrar». Sin edición, planes o evaluaciones. Volver a cartera. |

**Acceso ajeno:** la suite API ya prueba dos carteras con rol ordinario, RLS y mismo 404 para ajeno/inexistente; la comprobación HTTP local también obtuvo 404 para la nueva fixture ajena. Para confirmar opcionalmente su presentación en navegador, obtener `foreignUrl` con `node apps/api/.env.hu016-manual.cjs status` y abrirla manteniendo la sesión propia: esperar error genérico, nunca nombre ni medidas ajenas. El agente no acredita esa observación humana ni requiere entrar con una cuenta ajena.

**Respuestas antiguas:** la prueba Web determinista ya resuelve peticiones en orden inverso y exige ignorar el resultado viejo. Opcionalmente, con Slow 3G en DevTools, buscar `HU016 QA` y enseguida `HU016 QA NO EXISTE`; al terminar debe prevalecer la última consulta. Si no se observa inversión real del orden de respuestas, registrar solo la observación de la última búsqueda, no afirmar que se reprodujo ese caso de carrera. No repetir Offline/Online, altas o invitaciones de HU-015.

Para verificar datos y servicios sin mutar fixtures:

```powershell
node apps/api/.env.hu016-manual.cjs status
node apps/api/.env.resume-hu015-web.cjs status
```

Mantener las fixtures y procesos al finalizar; no ejecutar cleanup. Las instrucciones generales anteriores a esta preparación se conservan abajo como referencia y no requieren repetir casos ya reportados ni crear más clientes.

Desde la raíz del repositorio:

```powershell
node apps/api/.env.run-local-check.cjs verify
npm.cmd --prefix apps/api run build
node apps/api/.env.resume-hu015-web.cjs status
```

El verificador carga explícitamente `.env.test.local`, restringe URL e identidad SQL a `127.0.0.1:5432/CouchOneFit_test` y no muestra credenciales. Si la API sigue encendida con un build anterior, detener únicamente su asistente de reanudación, que conserva los datos, y arrancarlo de nuevo. No usar el antiguo `.env.start-hu015-web.ps1`, cuyo cierre puede limpiar su fixture. Si hay otro proceso no identificado en 3000, detenerse y diagnosticar; no matar procesos indiscriminadamente.

Terminal API, si falta o requiere cargar el build nuevo:

```powershell
node apps/api/.env.resume-hu015-web.cjs serve
```

Terminal Web, si falta:

```powershell
$env:VITE_API_URL = ''
npm.cmd --prefix apps/web run dev -- --host 127.0.0.1 --port 5000 --strictPort
```

Abrir `http://127.0.0.1:5000/acceso`, entrar con `qa.hu015.web` y la contraseña sintética ya elegida localmente. No copiarla al chat. Usar `/app/clientes`. El proxy `/api` debe seguir apuntando a 127.0.0.1:3000; no usar destinos publicados.

1. Buscar un fragmento de un nombre sintético existente; cambiar Todos/Activos/Inactivos y comprobar nombres/estados. Buscar un término inexistente: «No hay resultados para estos filtros», sin confundirlo con error. El caso de cartera realmente vacía está automatizado; no borrar la fixture para provocarlo.
2. Si existe un nombre con `%`, `_`, comilla o Unicode, buscar ese carácter o fragmento y comprobar coincidencia literal. No crear masivamente clientes para este recorrido. Las dos carteras y las páginas de 1/20/100, empates, microsegundos y caracteres especiales ya tienen pruebas API ordinarias.
3. Con más de 20 resultados, Siguiente/Anterior deben conservar filtros y orden; al cambiar filtro/tamaño se vuelve a Página 1. Si la fixture tiene menos, Siguiente debe estar deshabilitado; no se acredita navegación multipágina manual sin datos suficientes. Las páginas límite están automatizadas con datos sintéticos aislados.
4. Pulsar el nombre de un cliente: ver únicamente sus datos base, estado y NULL como «Sin registrar». Volver a cartera. No debe haber edición, planes ni evaluaciones. Un ID ajeno/no disponible debe mostrar error genérico y nunca datos de otra cartera; no inventar acceso a cuentas reales para probarlo.
5. Para revisar carga/error, aplicar limitación de red o bloquear temporalmente solo la petición de listado/ficha en DevTools. Reintentar al desbloquear; no debe mostrarse un resultado antiguo como respuesta de la nueva búsqueda. La recuperación completa de sesión Offline/Online ya tiene pruebas de regresión; no hace falta repetir todo HU-015.

Registrar navegador, caso y resultado observado. No atribuir a la persona usuaria la evidencia automatizada de dos carteras, SQL/RLS o mediciones exactas. No se exige crear altas/invitaciones nuevas para revisar esta historia; sus regresiones API/Web ya están automatizadas. No limpiar datos ni cerrar la fixture al acabar salvo instrucción expresa.
