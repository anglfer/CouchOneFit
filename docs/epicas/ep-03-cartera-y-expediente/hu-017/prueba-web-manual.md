# Recorrido manual pendiente — HU-017

No ejecutado ni reportado aún. Mantener fixtures existentes y usar solo datos sintéticos propios. No repetir altas, invitaciones ni el recorrido completo de HU-016. URL: `http://127.0.0.1:5000/app/clientes`; acceso sintético existente `qa.hu015.web` y contraseña elegida localmente, sin publicarla.

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
| Fallo transitorio y resultado incierto | Con borrador, activar Offline y pulsar Guardar. No debe confirmarse éxito; el mensaje indica resultado incierto y permite consultar estado. Volver Online: campos conservados, ningún envío automático. Consultar, comparar y decidir explícitamente si reaplicar/guardar. Esta simulación no demuestra por sí sola una respuesta perdida después de COMMIT; ese caso tiene prueba Web determinista. |
| Sesión | Con otro borrador, cerrar sesión y volver a entrar: no debe reaparecer el editor anterior. El rechazo definitivo y cambio de cuenta también tienen pruebas automáticas. |
| Legado, si ya hay ficha sintética incompleta | Cambiar solo objetivo: nacimiento/estatura/peso siguen «Sin registrar». Completar uno exige los tres; no se fabrican valores. No modificar fixtures anteriores indiscriminadamente para crear este caso: está cubierto automáticamente si no hay una ficha adecuada. |

Registrar solamente resultados observados. No atribuir al recorrido manual pruebas SQL, concurrencia de activación, rollback, conservación de tablas históricas inexistentes o respuestas antiguas no reproducidas. No limpiar datos ni crear otra cuenta para este recorrido.
