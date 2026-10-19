# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Diseño visual aprobado

**UI-001 actualizada el 16 de octubre de 2026:** misma marca azul/violeta que Web, con interacción táctil y radios 10/12/16 px. Los temas mobile-light y mobile-dark siguen inicialmente al dispositivo y permiten alternar con un botón de sol/luna en la cabecera durante la sesión. Al volver a abrir la app se usa nuevamente el tema del dispositivo. Ya están conectados a la pantalla inicial mediante `lib/shared/theme/app_theme.dart`.

La fuente visual es [DESIGN.md de la raíz](../../DESIGN.md): seis paletas exactas, colores semánticos, componentes y criterios de validación. Inicio/Planes/Progreso/Cuenta y las tarjetas de entrenamiento/alimentación/check-in siguen siendo composición prevista por sus HU; esta actualización no implementa esas pantallas. No agrega agenda, chat, notificaciones, rachas o fotografías.

## Arquitectura

Sigue una arquitectura modular por funcionalidad (_Feature-Based + Component-Based_) según la especificación oficial en `docs/architecture/README.md`.

## Nombres de código y API

Usa `PascalCase` en los tipos de Dart y `lowerCamelCase` en sus miembros y las llaves JSON; roles/estados en inglés y minúsculas. Sigue el [glosario de identidad y acceso](../../docs/architecture/domain-glossary.md). Conserva el español en los textos visibles. Login, perfil propio, activación, credenciales y recuperación consumen la API de identidad propia.

## Activación y seguridad HU-006–009

Desde login: «Activar mi cuenta» y «Recuperar mi acceso». Desde expediente: «Cambiar mis credenciales». Confirmaciones/aviso versionado obligatorios y canje atómico en servidor; no se recapturan nombre ni datos físicos. Cambiar contraseña revoca todas las sesiones y guía al reingreso. [Contratos, tareas y evidencia](../../docs/epicas/ep-01-identidad-y-acceso/evidencia-hu-006-009.md).

Android guarda access/refresh/vencimiento mediante el canal `couchonefit/secure_session`: cifrado AES-256-GCM en preferencias privadas con clave no exportable de Android Keystore. No persiste contraseñas/códigos. Restaurar un cifrado inválido no revive una sesión. El fallback en memoria permite pruebas de widgets/plataformas sin canal nativo; iOS requiere integrar y verificar su almacenamiento nativo antes de distribución, no se acredita como validado desde Windows.

API local: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:35412` (HTTP solo manifest debug). Producción exige `--dart-define=API_BASE_URL=https://<host-api>`; el cliente rechaza HTTP en release. El manifest principal incluye INTERNET. Las peticiones tienen tiempos de espera y no exponen tokens en errores.

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
