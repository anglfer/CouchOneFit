# CouchOne Fit - Móvil

Aplicación móvil orientada a los clientes y atletas de CouchOne Fit, desarrollada con **Flutter + Dart**.

## Diseño visual aprobado

**UI-001, 14 de octubre de 2026:** estilo Moderna y Profesional y composición inspirada en la imagen aprobada por el usuario: cabecera, tarjetas del día, detalles de entrenamiento/alimentación, progreso autorizado y navegación inferior Inicio/Planes/Progreso/Cuenta.

La fuente visual compartida con el panel profesional es [DESIGN.md de la raíz](../../DESIGN.md): contiene la paleta exacta, neutros, componentes, distribución y criterios de validación. No se usa la paleta del marketing ni se modifica la landing. La referencia no agrega agenda, chat, notificaciones, rachas o fotografías; se implementan únicamente las HU vigentes. Esta decisión documenta el diseño, no acredita pantallas ni tema Flutter implementados.

## Arquitectura

Sigue una arquitectura modular por funcionalidad (_Feature-Based + Component-Based_) según la especificación oficial en `docs/architecture/README.md`.

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
