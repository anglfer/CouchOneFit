# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Diseño visual aprobado

**UI-001 actualizada el 16 de octubre de 2026:** misma marca azul/violeta que Web, con interacción táctil y radios 10/12/16 px. Los temas mobile-light y mobile-dark siguen inicialmente al dispositivo y permiten alternar con un botón de sol/luna en la cabecera durante la sesión. Al volver a abrir la app se usa nuevamente el tema del dispositivo. Ya están conectados a la pantalla inicial mediante `lib/shared/theme/app_theme.dart`.

La fuente visual es [DESIGN.md de la raíz](../../DESIGN.md): seis paletas exactas, colores semánticos, componentes y criterios de validación. Inicio/Planes/Progreso/Cuenta y las tarjetas de entrenamiento/alimentación/check-in siguen siendo composición prevista por sus HU; esta actualización no implementa esas pantallas. No agrega agenda, chat, notificaciones, rachas o fotografías.

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

Validación posterior con SDK local Flutter estable 3.47.5/Dart 3.13.4: análisis sin incidencias, formato de Dart HU-020 correcto y **39/39 pruebas** aprobadas. **APK debug compilado** tras instalar plataforma 36/NDK autorizados y aceptar licencias personalmente; manifiesto y URL local empaquetados verificados. Arranque, conectividad real desde Android y recorrido siguen pendientes: ni widgets ni APK equivalen a dispositivo real. El lockfile exige Dart >=3.11.0-0 aunque el mínimo declarado del manifiesto sea anterior; no se actualizaron dependencias/lockfile para acomodar otro SDK. [Contrato y evidencia](../../docs/epicas/ep-03-cartera-y-expediente/hu-020/README.md), [recorrido local pendiente](../../docs/epicas/ep-03-cartera-y-expediente/hu-020/prueba-integracion.md). HU-020 y D0 no están completos.

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
- Teléfono físico: la IP de tu computadora en la misma red, por ejemplo
  `http://192.168.1.100:3000`; `localhost` en el teléfono apunta al propio teléfono.
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
