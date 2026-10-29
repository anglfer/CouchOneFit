# Recorrido manual breve — HU-016

Preparación y casos propuestos, **sin resultados humanos acreditados todavía**. Reutilizar la fixture sintética local existente; no ejecutar la limpieza de HU-015 ni crear duplicados. Las pruebas automatizadas usan otras bases/roles temporales locales que eliminan al finalizar, no esta fixture.

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
