# Features (API)

Estructura modular por funcionalidad (*Feature-Based*) con separación por capas (*Layered Architecture*), según lo definido en `docs/architecture/README.md`.

Flujo por capas:
```text
Feature-Based
      ↓
  [feature]
      ↓
  Controller
      ↓
   Service
      ↓
  Repository
```

Cada módulo dentro de esta carpeta debe estructurarse con sus propias capas:

```text
features/
└── [feature]/
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── routes/
    ├── validators/
    └── types/
```
