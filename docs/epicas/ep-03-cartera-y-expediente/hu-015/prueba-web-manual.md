# Recorrido Web manual local de HU-015

Preparado el 28 de octubre de 2026 para esta computadora. El recorrido fue realizado y reportado por la persona usuaria; el agente no lo ejecutó ni observó en Chrome. La automatización se había detenido porque no pudo verificar la URL y no volvió a intentarse.

Se comprobó el asistente de arranque por HTTP local: login `200` y cartera `200` con su rol SQL restringido; después se limpiaron la fixture y el rol temporales. Esta comprobación valida la preparación, no sustituye los casos de navegador siguientes.

## Resultados reportados por la persona usuaria

Fuente: confirmación explícita en esta conversación. No se dispone del identificador del build usado en el recorrido; las correcciones posteriores de precisión, Unicode y fechas requieren las repeticiones dirigidas indicadas abajo.

| Caso | Resultado reportado | Autor y alcance |
| --- | --- | --- |
| Login local | Pudo acceder. | Reportado por la persona usuaria. |
| Alta mínima válida y persistencia | Correcto; el cliente permaneció tras recargar. | Reportado por la persona usuaria; no se atribuye inspección SQL ni código HTTP. |
| Menor de edad | Rechazo correcto. | Reportado por la persona usuaria. |
| Estatura fuera de rango | Rechazo correcto. | Reportado por la persona usuaria. |
| Peso con precisión inválida | Rechazo correcto. | Reportado por la persona usuaria, antes de la corrección posterior de precisión. |
| Alta completa con opcionales | Correcto. | Reportado por la persona usuaria; no se afirma inspección de tipos/NULL en BD. |
| Doble clic y persistencia | Sin duplicación y persistencia tras recargar. | Reportado por la persona usuaria. |
| Guardado con Vite detenido | Al reiniciar y recargar, el cliente no apareció. | Reportado por la persona usuaria. No acredita el mensaje de error, la conservación de campos ni rollback de una transacción SQL. |

El mensaje de error y la conservación de campos durante el fallo de conexión **no están confirmados**. Tampoco se atribuyen al usuario las comprobaciones HTTP automatizadas realizadas por el agente.

## Repeticiones dirigidas por las correcciones posteriores

Usar una API arrancada desde el build actualizado. Recompilar no recarga la API ya encendida; conservar la fixture y su evidencia al planear el reinicio. No se reinició ni limpió el recorrido existente para actualizar estos documentos.

| Corrección | Caso manual concreto que se debe repetir | Resultado esperado |
| --- | --- | --- |
| Precisión exacta de 0,1 | Una alta con peso `70.2`, estatura `170.5` y grasa opcional `20.2`; después intentar peso `70.20000000001` y, por separado, grasa `20.20000000001`. | La primera alta se guarda; las otras se rechazan sin una alta nueva. Si HTML bloquea el envío, registrar ese nivel: la validación servidor de estos números ya tiene pruebas automatizadas. |
| Conteo Unicode coherente con SQL | Nombre de un solo símbolo `😀`; después nombre válido `Ana 😀`, con las demás medidas válidas. | El primero se rechaza junto al campo; el segundo se guarda y conserva el nombre al recargar. Los límites máximos Unicode se cubren en unitarias; no hace falta llenar manualmente 150/500 símbolos. |
| Fechas/año y calendario de mayoría de edad | Nacimiento exactamente 18 años antes de la fecha actual de Ciudad de México y otro un día posterior. Si el control permite año `0000`, intentar ese valor. | El cumpleaños exacto se acepta; un día menor y año cero se rechazan. Si HTML no permite año cero, anotarlo; la API ya lo rechaza por prueba HTTP. La frontera UTC/México y la restitución de zona SQL están cubiertas con reloj controlado y conexión UTC, sin exigir esperar a medianoche. |

Una sola recarga de las nuevas altas válidas de este bloque permite comprobar persistencia tras las correcciones. No hace falta repetir por estos cambios el doble clic, la estatura fuera de rango, el login o que el cliente no apareció tras detener Vite: sus rutas/algoritmos relevantes no cambiaron.

**Completar evidencia pendiente, no repetir un resultado ya confirmado:** con la página cargada, cambiar Red a Offline, intentar guardar y comprobar el mensaje visible y que los campos sigan presentes. Volver a Online. Estos dos resultados continúan pendientes; no se infieren del caso con Vite detenido. Teclado y vista estrecha siguen sin resultado reportado.

## Arranque

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
