@echo off
rem Abre la app Movil de CouchOne Fit en el CELULAR conectado por USB, con la API de produccion.
rem No abre el emulador ni arranca API, Web o PostgreSQL locales.
rem Requisito: depuracion USB activada en el celular y la huella de esta PC aceptada.
setlocal
cd /d "%~dp0apps\mobile"

rem ===== CONFIGURACION =====
set "API_URL=https://api.ferkxo.tech"
rem ===== FIN CONFIGURACION =====

set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"

curl -fsS -m 10 "%API_URL%/api/health" >nul 2>&1 || echo AVISO: %API_URL%/api/health no responde. La app no podra conectar.

echo Conecta el celular por USB y acepta "Permitir depuracion USB" si aparece...
"%ADB%" -d wait-for-device

set "MOBILE_DEVICE="
for /f %%s in ('""%ADB%" -d get-serialno 2^>nul"') do set "MOBILE_DEVICE=%%s"
if "%MOBILE_DEVICE%"=="" (
  echo ERROR: hay mas de un celular USB conectado o no se pudo leer su id. Deja solo uno.
  pause
  exit /b 1
)

echo Movil (celular %MOBILE_DEVICE%) con API_BASE_URL=%API_URL%
call flutter run -d %MOBILE_DEVICE% --dart-define=API_BASE_URL=%API_URL%
rem Deja la ventana abierta para leer errores de compilacion o conexion.
pause
endlocal
