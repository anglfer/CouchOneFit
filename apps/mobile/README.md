# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Diseño visual aprobado

**UI-001 actualizada el 16 de octubre de 2026:** misma marca azul/violeta que Web, con interacción táctil y radios 10/12/16 px. Los temas mobile-light y mobile-dark siguen inicialmente al dispositivo y permiten alternar con un botón de sol/luna en la cabecera durante la sesión. Al volver a abrir la app se usa nuevamente el tema del dispositivo. Ya están conectados a la pantalla inicial mediante `lib/shared/theme/app_theme.dart`.

La fuente visual es [DESIGN.md de la raíz](../../DESIGN.md): seis paletas exactas, colores semánticos, componentes y criterios de validación. Inicio/Planes/Progreso/Cuenta y las tarjetas de entrenamiento/alimentación/check-in siguen siendo composición prevista por sus HU; esta actualización no implementa esas pantallas. No agrega agenda, chat, notificaciones, rachas o fotografías.

## Arquitectura

Sigue una arquitectura modular por funcionalidad (_Feature-Based + Component-Based_) según la especificación oficial en `docs/architecture/README.md`.

## Nombres de código y API

Usa `PascalCase` en los tipos de Dart y `lowerCamelCase` en sus miembros, las llaves JSON y los valores de roles o estados persistidos o enviados por API. Cuando una funcionalidad móvil empiece a consumir esos contratos, sigue el [glosario compartido de identidad y acceso](../../docs/architecture/domain-glossary.md). Conserva el español en los textos visibles de la aplicación. Las pantallas móviles actuales todavía no llaman a la API de identidad ni de perfil.

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
