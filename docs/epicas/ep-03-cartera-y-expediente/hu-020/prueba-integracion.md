# Recorrido y límites — Perfil base HU-020

Recorrido base realizado en OPPO físico y reportado por la persona usuaria: A activado sin recaptura, actualización de objetivo/peso a 71.3 kg, cierre de A y activación de B con credenciales distintas; B muestra su objetivo base sin conservar el objetivo actualizado de A. No se acredita comprobación visual de todos los campos de B ni manipulación manual de IDs. Las instrucciones siguientes son referencia para integración y repetición, no una solicitud de repetir lo ya reportado. API vertical/IDs y permisos están automatizados; progreso HU-036, revisión independiente y D0 siguen pendientes. Véase la evidencia vigente, que sustituye los bloqueos históricos descritos durante la preparación.

## Preparación local

Conservar fixtures y procesos anteriores. Desde raíz interior: `node apps/api/.env.run-local-check.cjs verify`, `npm.cmd --prefix apps/api run build`. El proceso API existente puede tener cargada la versión anterior: identificarlo por puerto/command line y reiniciar exclusivamente el asistente `.env.resume-hu015-web.cjs serve`, sin cleanup. Reutilizar Vite 5000. Nunca arrancar otro servidor sobre el puerto ocupado ni finalizar procesos desconocidos. API objetivo local 3000, PostgreSQL 127.0.0.1:5432/CouchOneFit_test verificado. No usar URL productiva del README móvil.

Fixture `qa.hu020.1b16b463` y dos expedientes HU020 QA A/B; IDs en evidencia. **Estado actual tras el recorrido: ambas cuentas activadas y vinculadas; invitaciones consumidas. No emitir otras ni ejecutar de nuevo el preparador o el asistente de contraseña inicial.** Conservar credenciales existentes y usar login ordinario para revisar. El asistente de entrada oculta `.env.hu020-password.ps1` fue solo preparación antes del primer login y se detiene cuando ya hay sesiones; no es un mecanismo de reset. Helpers y credenciales están ignorados por Git. Para futuras repeticiones completas usar nuevas fixtures sintéticas identificables, conservando estas.

En otra copia, el preparador versionado `apps/api/scripts/prepare-client-record-e2e.ts` requiere DATABASE_URL=TEST_DATABASE_URL exclusivamente locales y QA_PROFESSIONAL_USERNAME nuevo `qa.hu020.*`/QA_PROFESSIONAL_PASSWORD proporcionada localmente sin log/versionado; no ejecutar de nuevo el preparador anterior de HU-006–009, que puede restablecer su fixture existente. El preparador HU020 colisiona en lugar de sobrescribir. No reproducir contraseñas en comandos compartidos/chat.

## Entorno Flutter requerido

SDK ya disponible: `C:\Users\mayth\dev\flutter`, **Flutter 3.47.5 estable/Dart 3.13.4**, ZIP oficial/SHA256 en evidencia, sin cambio de PATH permanente. No volver a instalar ni actualizar dependencias. Configuración solo de la terminal:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\mayth\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "C:\Users\mayth\dev\flutter\bin;$env:JAVA_HOME\bin;$env:Path"
```

Command-line Tools **22.0**, plataforma **36 revisión 2**, NDK **28.2.13676358** y Build Tools **36.0.0** ya están instalados en el SDK existente. La persona usuaria confirmó revisión/aceptación personal y sdkmanager la verificó antes de instalar los dos paquetes pendientes. No repetir la instalación ni aceptar acuerdos automáticamente. Para comprobar licencias en otra sesión:

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$env:ANDROID_HOME" --licenses
```

Leer cada acuerdo pendiente y responder y solo si se acepta; el agente no lo hace ni escribe hashes. Comando de referencia para otra computadora que requiera los dos componentes, no necesario repetir aquí:

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="$env:ANDROID_HOME" 'platforms;android-36' 'ndk;28.2.13676358'
```

No usar --update ni agregar paquetes distintos. Luego repetir APK y revisar manifest resultante. AVD API37 x86_64 existente no requiere recreación: falta aceleración Windows. Revisar opciones con el usuario/administrador antes de cualquier característica/controlador/reinicio; no autorizado ni realizado en este paso. Una alternativa es un Android físico autorizado, sin afirmar que esté conectado.

La API del recorrido debe permanecer en **127.0.0.1:3000** mediante el asistente local, no el launcher general de server.ts que no fija host. Debug permite HTTP; profile no lo habilita y release exige HTTPS. Solo cuando haya emulador arrancado se comprobará health en `http://10.0.2.2:3000/api/health` desde Android y las consultas de la app debug. Health desde Windows y lectura de manifest no equivalen a esa conexión real. No cambiar a 0.0.0.0 ni abrir firewall indiscriminadamente si falla.

Análisis, formato HU-020 y 39/39 widget/unit tests ya aprobados. Posteriormente **APK debug también aprobado**, assembleDebug 281.4 s, con manifiesto mínimo24/target36/HTTP debug y recurso API local inspeccionados. Arranque/dispositivo/recorrido no se acreditan por ello. Visual Studio C++ no se necesita para Android. `flutter doctor -v` y `flutter devices` permiten comprobar el estado una vez resuelta la aceleración o conectado un dispositivo autorizado.

El **primer** intento real de `flutter build apk --debug --no-pub` falló con «NDK not configured… 28.2.13676358». Tras la aceptación personal e instalación autorizada, el mismo comando **pasó**; la descarga automática sigue deshabilitada mediante `GRADLE_OPTS=-Dorg.gradle.project.android.builder.sdkDownload=false` solo en ese proceso. No se cambiaron versiones/lockfiles. APK en `build/app/outputs/flutter-apk/app-debug.apk` desde apps/mobile. No instalar ni iniciar el recorrido hasta disponer de dispositivo y verificar conectividad.

Opciones de arranque a explicar/autorizar antes de cualquier cambio de Windows: **Windows Hypervisor Platform (WHPX)**, recomendada por [Android Developers](https://developer.android.com/studio/run/emulator-acceleration#vm-windows), con posible administrador y reinicio, reutilizando el AVD API37 existente; o **Android físico ya reconocido por ADB**, con depuración/trust autorizados por su propietario. No habilitar VirtualMachinePlatform innecesariamente ni instalar AEHD/controladores dentro de este alcance. En un teléfono real, 10.0.2.2 no es el alias del host: se puede usar redirección USB temporal `adb -s <id> reverse tcp:3000 tcp:3000` y API_BASE_URL `http://127.0.0.1:3000` para debug, solo después de elegir/autorizar ese dispositivo. Mantener API en loopback, sin exposición LAN. Ninguna de estas opciones se ejecutó todavía.

Desde apps/mobile, una vez disponible:

```powershell
flutter pub get --enforce-lockfile
flutter analyze
dart format --output=none --set-exit-if-changed lib/features/client lib/routes/client_session_gate.dart test/client_record_test.dart test/client_login_test.dart test/widget_test.dart
flutter test
flutter run -d <id-del-emulador> --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Si el SDK no soporta enforce-lockfile, comprobar su opción antes de ejecutar; no regenerar lockfile como solución. No se distribuye un build con HTTP ni se acredita iOS desde Windows. Configuración de prueba pública, sin URL de BD en móvil. Base local comprobada desde API, no solo por la URL Android.

## Ruta vigente para el OPPO físico por USB

El emulador se abandonó por lentitud sin recorrido funcional humano. Usar el OPPO CPH2695/Android16/API36/ARM64 ya autorizado; no reinstalar controladores, recrear fixtures ni usar el APK configurado para 10.0.2.2. Se compiló e instaló específicamente ARM64 con API_BASE_URL=http://127.0.0.1:3000, manteniendo la API del host en loopback.

Antes de cada intento después de reconectar USB o reiniciar ADB, comprobar el dispositivo y la redirección temporal; una autorización ADB válida no implica que el mapeo siga existiendo:

```powershell
$adb = 'C:\Users\mayth\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb devices -l
# Sustituir <telefono> por el ID devuelto para el OPPO, no por un emulador.
& $adb -s <telefono> reverse --list
# Si falta tcp:3000, restablecer únicamente ese mapeo:
& $adb -s <telefono> reverse tcp:3000 tcp:3000
& $adb -s <telefono> reverse --list
```

Comprobar además respuesta health desde Android (no solo desde Windows) antes de activar. Mantener el cable conectado durante el recorrido; no activar depuración inalámbrica ni abrir firewall. El asistente puede hacer GET /api/health desde el UID de la app sin credenciales. Un POST vacío de diagnóstico produce 400/INVALID_INPUT y no comprueba la validez del formulario humano ni consume invitación.

Ante un error de activación no reenviar automáticamente: comprobar vínculo del expediente, invitación, cuenta y auditoría. Una pérdida de respuesta puede ocurrir después de COMMIT; si existe vínculo, usar login ordinario. Si no hay efectos y la conexión está restablecida, comprobar primero el mismo código con «Comprobar código» y después realizar un único envío explícito. No regenerar una invitación vigente ni restablecer credenciales por un fallo de transporte. No registrar cuerpos, contraseñas, tokens ni códigos. El código HTTP de un intento anterior sin observabilidad no se inventa a partir del texto genérico de Flutter. Esta incidencia quedó seguida por activación A/B reportada; no volver a canjear esos códigos consumidos.

## Casos mínimos

1. Web `http://127.0.0.1:5000/app/clientes`, profesional HU020 nuevo: localizar A y anotar ID/objetivo/medidas; emitir invitación. En Android activar con nuevas credenciales sintéticas propias y aviso vigente, sin recapturar datos base. Comprobar nombre/objetivo/nacimiento/medidas/unidades idénticos; cadera «Sin registrar», progreso «todavía no está disponible». No existe edición del expediente desde móvil.
2. Profesional modifica objetivo o peso base de A y guarda. En Android actualizar: ver cambio en el mismo expediente, no crear uno nuevo ni pedir recaptura. La prueba API comprueba además la igualdad exacta de IDs antes/después; no inventar esa observación manual si solo se miró el nombre.
3. Activar B con otras credenciales sintéticas; cerrar sesión de A y entrar como B. No mostrar A. Alterar clientId en query del GET debe dar 400 sin datos ajenos. Consultar sin sesión/revocada debe rechazar; un fallo temporal de consulta debe mostrar error y reintento, no «sin datos» ni login falso. No requiere volver a ejecutar todo HU-015–018.

El registro profesional real → alta → invitación → activación → lectura/edición está automatizado en API con nuevas fixtures temporales. El aprovisionamiento manual ya preparado es sintético; no se presenta como registro/pago ejecutados en la interfaz. Para repetir el registro humano completo usar otra identidad QA nueva y aprovisionar explícitamente su suscripción de pruebas, sin modificar suscripciones previas.

Registrar solo resultados observados como reportados por la persona usuaria. No borrar fixtures ni históricos al terminar. Progreso autorizado/retirada de permisos se probarán cuando existan artefactos HU-036; no se sustituyen por mocks para declarar HU-020/D0 completos.
