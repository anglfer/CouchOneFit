# Recorrido manual pendiente — HU-018

No ejecutado por el agente ni reportado por la persona usuaria. Usar únicamente la fixture sintética local existente, sin borrar clientes o inventar cuentas reales. API y Web deben servir el build actual y la migración 202610290001 en `127.0.0.1:5432/CouchOneFit_test`; el estado de preparación efectivo se registra en [evidencia](validacion-local.md).

URL: `http://127.0.0.1:5000/app/clientes`. Usuario sintético existente `qa.hu015.web`, contraseña elegida localmente: no copiarla al chat. Elegir un expediente propio sintético activo y anotar su nombre/estado y el cupo mostrado en Inicio.

1. **Cancelar:** pulsar Inactivar expediente. Debe mostrarse la confirmación del expediente con explicación de cuenta/sesiones/suscripción e invitaciones. Cancelar o Escape: no cambia estado ni cupo. Comprobar foco/teclado en el diálogo real; JSDOM no acredita por sí solo el foco modal nativo de todos los navegadores.
2. **Inactivar/reactivar:** confirmar una vez; sin éxito hasta respuesta. Con filtro Todos, ver estado Inactivo y ficha coincidente; en Inicio, usados baja uno. Los datos base permanecen. Reactivar y confirmar: estado Activo y usados vuelve al anterior; recargar para comprobar persistencia. No se cambia cuenta ni suscripción.
3. **Conflicto:** abrir la confirmación en A; editar/guardar datos base en otra pestaña B, o cambiar el estado allí. Confirmar en A: si requiere una transición con versión obsoleta, muestra conflicto sin sobrescribir. Consultar estado actual y decidir explícitamente. Si ya está en el estado deseado, actualizar vistas sin otra escritura ni inversión automática.
4. **Invitación y errores:** no es necesario crear/canjear otra invitación ni llenar el cupo manualmente: continuidad de invitación, cuenta/sesión cliente, última plaza, rollback y errores de negocio tienen pruebas API. Si se observa un error real, registrar exactamente mensaje/estado y no inferir pruebas SQL. La incertidumbre y ausencia de replay también tienen prueba Web determinista; no es obligatorio reproducir cada negativo manualmente según D0.5/10.

No repetir todo HU-015/016/017. Conservar al finalizar fixtures y procesos; reactivar el expediente sintético es una acción explícita del caso, no una limpieza indiscriminada. No acreditar revisión independiente ni cierre de D0 a partir del recorrido.

Si los servicios se cerraron, desde la raíz interior del repositorio:

```powershell
node apps/api/.env.run-local-check.cjs verify
node apps/api/.env.run-local-check.cjs migrate
npm.cmd --prefix apps/api run build
node apps/api/.env.resume-hu015-web.cjs status
```

Reutilizar Vite si responde en 5000. Si falta: `VITE_API_URL` vacío y `npm.cmd --prefix apps/web run dev -- --host 127.0.0.1 --port 5000 --strictPort`. La API necesita cargar el build nuevo: usar `node apps/api/.env.resume-hu015-web.cjs serve`, deteniendo antes exclusivamente el asistente anterior identificado, que conserva datos. No usar el launcher viejo con cleanup ni terminar procesos desconocidos. No apuntar a Supabase compartido.
