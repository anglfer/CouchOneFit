@echo off
rem Abre la app Movil de CouchOne Fit en el EMULADOR, conectada a la API de produccion.
rem No arranca API, Web ni PostgreSQL locales. Para telefono USB usa iniciar-movil-produccion-celular.cmd.
setlocal
cd /d "%~dp0apps\mobile"

rem ===== CONFIGURACION =====
set "API_URL=https://api.ferkxo.tech"
rem Emulador a lanzar (flutter emulators). Si ya esta abierto, se reutiliza.
set "ANDROID_EMULATOR=Medium_Phone"
rem ===== FIN CONFIGURACION =====

set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"

curl -fsS -m 10 "%API_URL%/api/health" >nul 2>&1 || echo AVISO: %API_URL%/api/health no responde. La app no podra conectar.

"%ADB%" -e get-state >nul 2>&1 || call flutter emulators --launch %ANDROID_EMULATOR%

echo Esperando a que el emulador termine de arrancar...
"%ADB%" -e wait-for-device shell "while [ -z $(getprop sys.boot_completed) ]; do sleep 1; done"

echo Movil (emulador) con API_BASE_URL=%API_URL%
rem "-d emulator" toma el emulador sea cual sea su puerto (emulator-5554, emulator-5556...).
call flutter run -d emulator --dart-define=API_BASE_URL=%API_URL%
rem Deja la ventana abierta para leer errores de compilacion o conexion.
pause
endlocal
