# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Arquitectura

Sigue una arquitectura modular por funcionalidad (*Feature-Based + Component-Based*) según la especificación oficial en `docs/architecture/README.md`.

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
