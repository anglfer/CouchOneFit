# Recorrido manual y caso pendiente — HU-017

Resultados parciales reportados por la persona usuaria, registrados abajo. Los casos propuestos no se consideran ejecutados por su mera presencia en esta guía. Mantener fixtures existentes y usar solo datos sintéticos propios. No repetir altas, invitaciones ni el recorrido completo de HU-016. URL: `http://127.0.0.1:5000/app/clientes`; acceso sintético existente `qa.hu015.web` y contraseña elegida localmente, sin publicarla.

Preparación ya comprobada por herramientas: migración aplicada conservando 28 filas, API/Web activas en 3000/5000, proxy y base local verificados. No son resultados humanos. Los siguientes comandos quedan para reanudar si se cierran los procesos; si siguen activos, reutilizarlos. Verificar destino, aplicar solo migraciones pendientes y compilar API/Web desde `feature/api-client-portfolio`:

```powershell
node apps/api/.env.run-local-check.cjs verify
node apps/api/.env.run-local-check.cjs migrate
npm.cmd --prefix apps/api run build
npm.cmd --prefix apps/web run build
node apps/api/.env.resume-hu015-web.cjs status
```

El verificador carga `.env.test.local` explícitamente y exige `127.0.0.1:5432/CouchOneFit_test`, también por identidad SQL. No usar el launcher antiguo con limpieza automática. Si la API sigue ejecutando el build anterior, detener únicamente el asistente de reanudación identificado y reiniciarlo con `node apps/api/.env.resume-hu015-web.cjs serve`; su cierre conserva datos. No terminar procesos desconocidos. Vite existente puede reutilizarse; si falta, iniciar con `VITE_API_URL` vacío y `npm.cmd --prefix apps/web run dev -- --host 127.0.0.1 --port 5000 --strictPort`. El proxy debe apuntar a 127.0.0.1:3000; compilar por sí solo no recarga una API ya encendida.

| Caso | Pasos y resultado esperado |
| --- | --- |
| Guardado y validación | Abrir una ficha propia sintética y Editar. Cambiar nombre con Unicode, objetivo, peso y una medida opcional. Probar 70.25 o una medida opcional con dos decimales: rechazo sin perder el resto. Corregir, guardar explícitamente y recargar: persisten valores y unidades. Vaciar un opcional no se convierte en cero. |
| Dos editores | Abrir la misma ficha en dos pestañas antes de guardar. Cambiar objetivo en A y guardar. Cambiar otro dato en B y guardar: conflicto, sin sobrescribir A ni perder B. Consultar estado actual, comparar, aceptar reaplicar y pulsar Guardar: se aplica lo editado conservando campos remotos no editados. |
| Fallo durante PATCH, pendiente | Usar la comprobación aislada de PATCH descrita abajo; no repetir Offline global, que puede ocultar el editor por comprobación de sesión antes de poder pulsar Guardar. No se acredita pérdida real de respuesta después de COMMIT. |
| Sesión | Con otro borrador, cerrar sesión y volver a entrar: no debe reaparecer el editor anterior. El rechazo definitivo y cambio de cuenta también tienen pruebas automáticas. |
| Legado, si ya hay ficha sintética incompleta | Cambiar solo objetivo: nacimiento/estatura/peso siguen «Sin registrar». Completar uno exige los tres; no se fabrican valores. No modificar fixtures anteriores indiscriminadamente para crear este caso: está cubierto automáticamente si no hay una ficha adecuada. |

Registrar solamente resultados observados. No atribuir al recorrido manual pruebas SQL, concurrencia de activación, rollback, conservación de tablas históricas inexistentes o respuestas antiguas no reproducidas. No limpiar datos ni crear otra cuenta para este recorrido.

## Resultados reportados por la persona usuaria (R)

- Edición válida, rechazo de 70.25, corrección y persistencia tras recargar: correcto.
- Dos editores: conflicto sin sobrescribir, borrador conservado, consulta de versión actual y reaplicación explícita: correcto.
- Offline → Online: editor oculto por comprobación de sesión y recuperado con borrador intacto.
- Cerrar sesión y volver a abrir la ficha: borrador descartado y cambios previamente guardados conservados.

No se pulsó Guardar estando Offline. El fallo durante PATCH, su mensaje de resultado incierto y una respuesta perdida después de COMMIT no se consideran comprobados manualmente. No repetir los casos ya reportados. El caso automatizado y sus límites están descritos en [evidencia local](validacion-local.md#cobertura-automática-del-caso-no-realizado-manualmente).

## Comprobación adicional aislada de PATCH

Pendiente; no modifica código, configuración de la aplicación, autenticación ni datos de prueba. Mantener Network en Online/No throttling. Para distinguir método HTTP se propone [Protocol monitor de Chrome](https://developer.chrome.com/docs/devtools/protocol-monitor), con [Fetch.requestPaused / failRequest](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/). No usar Offline global ni bloquear `/api/*`. El bloqueo ordinario por URL no distingue por sí solo GET de PATCH sobre la misma ficha; aquí se pausa esa URL y se rechaza únicamente el evento cuyo método se comprueba como PATCH.

1. Antes de llenar el editor, habilitar Protocol Monitor en DevTools → Settings → Experiments, si hace falta; abrirlo desde More tools o el menú Ctrl+Shift+P. Seleccionar como target la página local `http://127.0.0.1:5000`, no otra pestaña. Abrir la ficha propia y Editar; cambiar un dato sintético sin guardar.
2. Sustituir `UUID_PROPIO` por el ID de la ficha y enviar en la entrada de comandos del monitor:

```json
{"cmd":"Fetch.enable","args":{"patterns":[{"urlPattern":"http://127.0.0.1:5000/api/clients/UUID_PROPIO","requestStage":"Request"}]}}
```

3. Pulsar Guardar una vez. Buscar el evento `Fetch.requestPaused`: comprobar URL exacta y `request.method: "PATCH"`; copiar únicamente su `requestId` dentro de DevTools. No exportar registros ni copiar cookies, headers, tokens o cuerpos al chat. Si aparece otro método, continuarlo con `Fetch.continueRequest` y su ID; no rechazarlo.
4. Para el PATCH verificado enviar, reemplazando el identificador:

```json
{"cmd":"Fetch.failRequest","args":{"requestId":"ID_DEL_PATCH","errorReason":"Failed"}}
```

5. Desactivar inmediatamente la interceptación enviando `Fetch.disable`. Si se abandona el intento, desactivarla también para no dejar una petición pendiente. En Network comprobar que las consultas `/api/auth/session`, perfil y suscripción siguen funcionando cuando se ejecuten; nunca añadirlas al patrón.
6. Observar: no debe aparecer éxito; debe mostrarse el mensaje de resultado incierto y mantenerse el borrador. Esperar y comprobar que no se genera otro PATCH. Pulsar «Consultar estado actual»: GET debe funcionar y no guardar. Comparar y, solo si se desea guardar, aceptar reaplicar y pulsar Guardar explícitamente.

Este bloqueo ocurre antes de llegar al servidor: permite observar el manejo real del fallo PATCH en la UI, pero no demuestra pérdida de respuesta después de un COMMIT. No atribuir ese resultado a la prueba. Si Protocol Monitor no está disponible o no se puede verificar target/método, detener este intento sin sustituirlo por Offline global ni introducir parches de fetch en la aplicación.
