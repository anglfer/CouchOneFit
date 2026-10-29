# Recorrido pendiente — Perfil base HU-020

No ejecutado por la persona usuaria ni por el asistente en Android. API vertical real aprobada según evidencia; no equivale al recorrido móvil.

## Preparación local

Conservar fixtures y procesos anteriores. Desde raíz interior: `node apps/api/.env.run-local-check.cjs verify`, `npm.cmd --prefix apps/api run build`. El proceso API existente puede tener cargada la versión anterior: identificarlo por puerto/command line y reiniciar exclusivamente el asistente `.env.resume-hu015-web.cjs serve`, sin cleanup. Reutilizar Vite 5000. Nunca arrancar otro servidor sobre el puerto ocupado ni finalizar procesos desconocidos. API objetivo local 3000, PostgreSQL 127.0.0.1:5432/CouchOneFit_test verificado. No usar URL productiva del README móvil.

Fixture nueva: `qa.hu020.1b16b463` y dos expedientes HU020 QA A/B; IDs en evidencia. Para elegir clave inicial antes de su primer login, ejecutar localmente `powershell -NoProfile -ExecutionPolicy Bypass -File apps/api/.env.hu020-password.ps1`: entrada oculta, solo esta fixture, valida servidor/rol/marcador y se detiene si ya hay sesiones. No muestra credenciales ni toca otras fixtures. Helpers y archivo de credenciales comprobados ignorados por Git. Después del primer uso cambiar credenciales por el flujo normal; no resetear fixtures arbitrariamente.

En otra copia, el preparador versionado `apps/api/scripts/prepare-client-record-e2e.ts` requiere DATABASE_URL=TEST_DATABASE_URL exclusivamente locales y QA_PROFESSIONAL_USERNAME nuevo `qa.hu020.*`/QA_PROFESSIONAL_PASSWORD proporcionada localmente sin log/versionado; no ejecutar de nuevo el preparador anterior de HU-006–009, que puede restablecer su fixture existente. El preparador HU020 colisiona en lugar de sobrescribir. No reproducir contraseñas en comandos compartidos/chat.

## Entorno Flutter requerido

Localizar o instalar bajo control de la persona usuaria un Flutter compatible con pubspec.lock (Dart >=3.11.0-0), sin cambiar lockfile para acomodar un SDK viejo. No instalado por el agente. Usar ruta completa a flutter.bat o PATH solo de la terminal; no requiere modificar PATH global. Ejecutar `flutter --version`, `flutter doctor -v`, `flutter devices`; comprobar toolchain Android/Java, sin actualizar automáticamente dependencias ni aceptar instalaciones globales.

Desde apps/mobile, una vez disponible:

```powershell
flutter pub get --enforce-lockfile
flutter analyze
dart format --output=none --set-exit-if-changed lib/features/client lib/routes/client_session_gate.dart test/client_record_test.dart test/client_login_test.dart test/widget_test.dart
flutter test
flutter run -d <id-del-emulador> --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Si el SDK no soporta enforce-lockfile, comprobar su opción antes de ejecutar; no regenerar lockfile como solución. No se distribuye un build con HTTP ni se acredita iOS desde Windows. Configuración de prueba pública, sin URL de BD en móvil. Base local comprobada desde API, no solo por la URL Android.

## Casos mínimos

1. Web `http://127.0.0.1:5000/app/clientes`, profesional HU020 nuevo: localizar A y anotar ID/objetivo/medidas; emitir invitación. En Android activar con nuevas credenciales sintéticas propias y aviso vigente, sin recapturar datos base. Comprobar nombre/objetivo/nacimiento/medidas/unidades idénticos; cadera «Sin registrar», progreso «todavía no está disponible». No existe edición del expediente desde móvil.
2. Profesional modifica objetivo o peso base de A y guarda. En Android actualizar: ver cambio en el mismo expediente, no crear uno nuevo ni pedir recaptura. La prueba API comprueba además la igualdad exacta de IDs antes/después; no inventar esa observación manual si solo se miró el nombre.
3. Activar B con otras credenciales sintéticas; cerrar sesión de A y entrar como B. No mostrar A. Alterar clientId en query del GET debe dar 400 sin datos ajenos. Consultar sin sesión/revocada debe rechazar; un fallo temporal de consulta debe mostrar error y reintento, no «sin datos» ni login falso. No requiere volver a ejecutar todo HU-015–018.

El registro profesional real → alta → invitación → activación → lectura/edición está automatizado en API con nuevas fixtures temporales. El aprovisionamiento manual ya preparado es sintético; no se presenta como registro/pago ejecutados en la interfaz. Para repetir el registro humano completo usar otra identidad QA nueva y aprovisionar explícitamente su suscripción de pruebas, sin modificar suscripciones previas.

Registrar solo resultados observados como reportados por la persona usuaria. No borrar fixtures ni históricos al terminar. Progreso autorizado/retirada de permisos se probarán cuando existan artefactos HU-036; no se sustituyen por mocks para declarar HU-020/D0 completos.
