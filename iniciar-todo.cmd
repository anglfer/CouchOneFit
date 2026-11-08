@echo off
rem Arranca API, Web y Movil de CouchOne Fit y los conecta.
rem Edita solo la seccion CONFIGURACION. Ejecutar: doble clic o desde cmd.
setlocal
cd /d "%~dp0"

rem ===== CONFIGURACION =====
set "API_PORT=3000"
rem Emulador a lanzar (flutter emulators). Vacio = no lanzar ninguno.
set "ANDROID_EMULATOR=Medium_Phone"
rem Id del dispositivo (flutter devices). El emulador suele ser emulator-5554.
set "MOBILE_DEVICE=emulator-5554"
rem 0 = emulador (API en 10.0.2.2). 1 = telefono por USB (adb reverse, API en 127.0.0.1).
set "MOBILE_PHYSICAL=0"
rem ===== FIN CONFIGURACION =====

set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
set "API_URL=http://10.0.2.2:%API_PORT%"

sc query postgresql-x64-18 | findstr /C:"RUNNING" >nul || echo AVISO: PostgreSQL (postgresql-x64-18) no esta corriendo. La API no conectara.

if "%MOBILE_PHYSICAL%"=="1" (
  "%ADB%" -s %MOBILE_DEVICE% reverse tcp:%API_PORT% tcp:%API_PORT%
  set "API_URL=http://127.0.0.1:%API_PORT%"
)

echo [1/3] API   en http://127.0.0.1:%API_PORT%
start "CouchOne API" cmd /k "cd /d "%~dp0apps\api" && npm run dev"

echo [2/3] Web   en http://127.0.0.1:5000 (proxy /api hacia la API)
start "CouchOne Web" cmd /k "cd /d "%~dp0apps\web" && npm run dev"

echo [3/3] Movil con API_BASE_URL=%API_URL%
if "%ANDROID_EMULATOR%"=="" (
  set "MOBILE_CMD=flutter run -d %MOBILE_DEVICE% --device-timeout=60"
) else (
  set "MOBILE_CMD=flutter emulators --launch %ANDROID_EMULATOR% && flutter run -d %MOBILE_DEVICE% --device-timeout=180"
)
start "CouchOne Movil" cmd /k "cd /d "%~dp0apps\mobile" && %MOBILE_CMD% --dart-define=API_BASE_URL=%API_URL%"

echo.
echo Listo. Se abrieron 3 ventanas: API, Web y Movil. Cierra cada una para parar su app.
endlocal
