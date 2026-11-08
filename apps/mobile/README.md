# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Diseño visual aprobado

**UI-001 actualizada el 16 de octubre de 2026:** misma marca azul/violeta que Web, con interacción táctil y radios 10/12/16 px. Los temas mobile-light y mobile-dark siguen inicialmente al dispositivo; antes de entrar se alternan con el botón de sol/luna y, ya dentro, en Cuenta → Preferencias → Apariencia. La elección se recuerda en el teléfono. Se definen en `lib/shared/theme/app_theme.dart`; las reglas de composición están en «Lenguaje visual móvil» de DESIGN.md.

La fuente visual es [DESIGN.md de la raíz](../../DESIGN.md): seis paletas exactas, colores semánticos, componentes y criterios de validación. El cliente navega por Inicio/Planes/Progreso/Cuenta (rediseño del 04-nov-2026, ver [EP-06](../../docs/epicas/ep-06-entrenamiento/README.md)); entrenamiento y progreso son reales, y alimentación, check-in, peso y evaluaciones aparecen como «Próximamente» hasta que sus HU los implementen. La racha semanal, el temporizador de descanso y las Preferencias en Cuenta (Apariencia; Entrenamiento: descanso, salto de carga, vibración; guardadas solo en el teléfono), la bitácora en lista continua estilo Hevy y la figura muscular de recuperación (05-nov-2026) se incorporaron por decisión del usuario. No agrega agenda, chat, notificaciones o fotografías.

## Interacción móvil

Bienvenida, acceso y expediente comparten respuestas táctiles y transiciones breves.
La cabecera compacta, la tipografía y las superficies siguen una misma composición;
las líneas de las tarjetas se dibujan una sola vez al entrar, sin movimiento continuo.
El expediente presenta identidad y objetivo en tarjetas, conserva sus acciones de
cuenta y permite actualizar deslizando hacia abajo. Los datos siguen viniendo de
la API; no se muestran métricas ni módulos pendientes.

La preferencia de movimiento reducido del teléfono desactiva entradas, el trazado
de las tarjetas y rebotes. Las pruebas cubren anchos de 320, 390 y 768 unidades,
texto ampliado, ambos temas, presión/cancelación y actualización por gesto.

## Arquitectura

Sigue una arquitectura modular por funcionalidad (_Feature-Based + Component-Based_) según la especificación oficial en `docs/architecture/README.md`.

## Nombres de código y API

Usa `PascalCase` en los tipos de Dart y `lowerCamelCase` en sus miembros y las llaves JSON; roles/estados en inglés y minúsculas. Sigue el [glosario de identidad y acceso](../../docs/architecture/domain-glossary.md). Conserva el español en los textos visibles. Login, perfil propio, activación, credenciales y recuperación consumen la API de identidad propia.

## Incremento HU-020 de perfil base (29/10/2026)

El perfil móvil ahora consume `GET /api/me/record`, conservando el endpoint API anterior `/api/client/profile` para compatibilidad. Presenta datos preparados y medidas iniciales de solo lectura; no recaptura ni modifica el expediente. Distingue carga, opcionales «Sin registrar», error de consulta recuperable y rechazo definitivo de sesión. El progreso todavía no está disponible: no se muestra como historial vacío ni se inventan permisos HU-036.

Validación con SDK local Flutter estable 3.47.5/Dart 3.13.4: análisis sin incidencias, diez archivos Dart HU-020 con formato correcto y **41/41 pruebas** aprobadas. **APK debug ARM64 compilado e instalado en OPPO físico Android16**, conectado a API local mediante USB; la persona usuaria reportó activación sin recaptura, actualización de A y cambio a B sin conservar el objetivo actualizado de A. SQL confirma vínculos a los expedientes originales sin duplicarlos. No se acredita revisión visual completa de B ni manipulación manual de IDs; permisos y consultas ajenas están automatizados. El lockfile exige Dart >=3.11.0-0 aunque el mínimo declarado del manifiesto sea anterior; no se actualizaron dependencias/lockfile para acomodar otro SDK. [Contrato y evidencia](../../docs/epicas/ep-03-cartera-y-expediente/hu-020/README.md), [recorrido local y límites](../../docs/epicas/ep-03-cartera-y-expediente/hu-020/prueba-integracion.md). Perfil base validado en este incremento; progreso HU-036 no integrado. HU-020, D0 y revisión independiente no están completos.

## Activación y seguridad HU-006–009

Desde login: «Activar mi cuenta» y «Recuperar mi acceso». Desde expediente: «Cambiar mis credenciales». Confirmaciones/aviso versionado obligatorios y canje atómico en servidor; no se recapturan nombre ni datos físicos. Cambiar contraseña revoca todas las sesiones y guía al reingreso. [Contratos, tareas y evidencia](../../docs/epicas/ep-01-identidad-y-acceso/evidencia-hu-006-009.md).

Android guarda access/refresh/vencimiento mediante el canal `couchonefit/secure_session`: cifrado AES-256-GCM en preferencias privadas con clave no exportable de Android Keystore. No persiste contraseñas/códigos. Restaurar un cifrado inválido no revive una sesión. El fallback en memoria permite pruebas de widgets/plataformas sin canal nativo; iOS requiere integrar y verificar su almacenamiento nativo antes de distribución, no se acredita como validado desde Windows.

La API se configura en el [archivo de entorno móvil](#url-de-la-api). El cliente rechaza HTTP en release. El manifest principal incluye INTERNET. Las peticiones tienen tiempos de espera y no exponen tokens en errores.

Pruebas: `flutter analyze`, `flutter test` y [recorrido Android real](integration_test/account_lifecycle_test.dart). La única dependencia nueva es `integration_test` del SDK en desarrollo y sus transitivas; no se actualizan versiones ya fijadas. Preparación/reproducción en la evidencia de las HU.

```text
mobile/
└── lib/
    ├── features/
    │   └── [feature]/
    │       ├── screens/
    │       ├── widgets/
    │       ├── services/
    │       └── models/
    │
    ├── shared/
    │   ├── widgets/
    │   ├── services/
    │   └── utils/
    │
    ├── routes/
    └── main.dart
```

## Requisitos de desarrollo

- Flutter SDK (versión >= 3.10.0)
- Dart SDK (versión >= 3.0.0 < 4.0.0)
- Emulador Android / iOS o dispositivo físico configurado

## Comandos habituales

- Instalar dependencias: `flutter pub get`
- Ejecutar en desarrollo: `flutter run`
- Análisis de código: `flutter analyze`

## URL de la API

Edita `apps/mobile/.env.json`; la app lo lee automáticamente al arrancar. No hace
falta pasar argumentos al ejecutar ni modificar código Dart. El archivo local
está ignorado por Git. En una copia nueva del repositorio, créalo desde el ejemplo:

```powershell
cd apps/mobile
Copy-Item .env.example .env.json
```

Contenido para el emulador Android y la API local habitual en el puerto3000:

```json
{
  "API_BASE_URL": "http://10.0.2.2:3000"
}
```

Después usa `flutter run` o el botón de ejecutar del editor. Al cambiar la URL,
detén y vuelve a ejecutar la app para incorporar el archivo actualizado.

- Emulador Android: `http://10.0.2.2:3000`.
- Teléfono físico por USB para HU-020: `adb -s <telefono> reverse tcp:3000 tcp:3000`
  y `--dart-define=API_BASE_URL=http://127.0.0.1:3000`. Verificar el mapeo tras
  reconectar USB o reiniciar ADB y comprobar health desde Android; mantener la
  API del host en loopback, sin exponerla a la LAN. Sin esa redirección,
  localhost en el teléfono apunta únicamente al propio teléfono.
- Distribución: `https://api.ferkxo.tech`, API productiva existente en Render.
  Cambia `API_BASE_URL` en el archivo de entorno del build de distribución;
  conserva la dirección local para desarrollar. HTTP solo está permitido en
  compilaciones debug de Android, y el cliente exige HTTPS en release.

`lib/shared/services/api_config.dart` centraliza la lectura y validación;
`ApiClient` consume esa configuración. Para automatización sigue disponible
`--dart-define=API_BASE_URL=...`, que tiene prioridad sobre el archivo; es opcional.
El recorrido Android de las HU usa su puerto de pruebas35412 mediante esa opción.
No hay cambio automático de una API local a producción ante errores de red.
El [estado del despliegue](../../docs/architecture/despliegue.md) distingue la
disponibilidad de la API productiva y las comprobaciones de sus endpoints.

El archivo se incluye como recurso en la app compilada usando el
[mecanismo de assets de Flutter](https://docs.flutter.dev/ui/assets/assets-and-images).
Solo debe contener configuración pública como la URL de la API: nunca
`DATABASE_URL`, contraseñas ni claves privadas de Supabase. No agrega dependencias.

## Gradle en Windows: conexión loopback

Si `flutter build apk` falla con `java.io.IOException: Unable to establish
loopback connection`, se comprobó localmente el 02/nov/2026 que una ruta corta
para los sockets temporales de Java permite compilar. En esta máquina,
`C:\pipetmp` funcionó; una carpeta bajo `%TEMP%` no evitó el error.

Desde `apps/mobile`, en PowerShell:

```powershell
New-Item -ItemType Directory -Path C:\pipetmp -Force | Out-Null
$previousJavaToolOptions = $env:JAVA_TOOL_OPTIONS
try {
  $env:JAVA_TOOL_OPTIONS = "$previousJavaToolOptions -Djdk.net.unixdomain.tmpdir=C:\pipetmp".Trim()
  flutter build apk --debug --target-platform android-x64
} finally {
  $env:JAVA_TOOL_OPTIONS = $previousJavaToolOptions
}
```

`android-x64` corresponde al emulador x86_64; para el teléfono ARM64 usa
`android-arm64`. La variable solo afecta a ese proceso y sus hijos; no requiere
cambiar la configuración global de Java, Gradle ni Windows. Mantén la carpeta
mientras haya procesos Java usándola. Compilar el APK no acredita el recorrido
de login/perfil: esa comprobación se registra por separado en el
[seguimiento de auditoría](../../docs/epicas/ep-03-cartera-y-expediente/seguimiento-auditoria.md).

## Emulador: «Lost connection to device» al iniciar sesión

Diagnosticado el 05/nov/2026 con el AVD `Medium_Phone` (API 37, imagen Play
Store de páginas de 16 KB, `hw.gpu.mode=auto`). No es un fallo de la app: con
`auto` el emulador eligió `lavapipe` (gráficos por software en la CPU). Con el
equipo cargado, Android se ahogaba antes de terminar el login: carga 33,
«System UI/Pixel Launcher isn't responding» y `lowmemorykiller` matando apps
del sistema. Al final el proceso `qemu` del emulador se cerró solo, incluso
sin tocar la app. La API respondía el login con 200.

Arranca el emulador con GPU por hardware (la Intel HD 630 cumple los
requisitos):

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone -gpu host
```

Con `-gpu host` el login y el Inicio funcionaron, la carga bajó a ~2 y no hubo
ANR del sistema ni cierre. Para que sea permanente, usa
`hw.gpu.mode=host` en el `config.ini` del AVD, o en Device Manager →
*Graphics acceleration: Hardware*. Si sigue lento, cierra programas pesados o
usa un teléfono por USB con `adb reverse`.

## Recorrido Android de login y expediente

`integration_test/client_login_profile_test.dart` usa una cuenta sintética ya
activada contra una API local. Requiere un dispositivo de pruebas: limpia su
sesión móvil al empezar y cierra sesión al terminar. No restablece contraseñas,
no edita expedientes y no crea pagos/suscripciones. La fixture A del preparador
`apps/api/scripts/prepare-client-record-e2e.ts` debe estar activada: nacimiento
15/06/1990, estatura 170.5 cm, peso base 70.2 kg y objetivo «Objetivo base HU020».

Prepara un archivo local ignorado `.env.qa-login.json` con las claves
`API_BASE_URL`, `QA_CLIENT_USERNAME`, `QA_CLIENT_PASSWORD`,
`QA_CLIENT_FULL_NAME` y `QA_CLIENT_GOAL`. La prueba rechaza destinos de API fuera
de loopback/alias del emulador; el operador debe comprobar también que la API
apunte a `CouchOneFit_test`. Usa una cuenta nueva sin alterar fixtures anteriores.

```powershell
flutter test integration_test/client_login_profile_test.dart -d <emulador> --dart-define-from-file=.env.qa-login.json
```

En el recorrido del 02/nov se usó un AVD aislado API 37, renderizador software y
`--no-enable-impeller` como configuración de diagnóstico; no se cambió el
renderizador en el código o los manifiestos de la app.

Comprueba login real, identidad/objetivo, medidas con unidades, actualización,
restauración de sesión desde el almacén nativo y cierre de sesión. Captura
`client-login-profile.png` y `client-base-measurements.png` en la caché privada
de la app de pruebas. Los archivos de credenciales y el APK de integración son
solo locales: no se versionan ni distribuyen. Esta prueba del asistente no
sustituye aceptación humana ni revisión independiente.
