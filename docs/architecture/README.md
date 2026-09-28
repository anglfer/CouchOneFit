# Arquitectura de las Aplicaciones

## Resumen técnico

| Aplicación | Tecnología | Arquitectura | Hosting / Despliegue |
| :--- | :--- | :--- | :--- |
| **API** | Node.js + Express + TypeScript | Feature-Based + Layered Architecture | Render (Web Service) |
| **Web / PWA** | React + Vite + TypeScript | Feature-Based + Component-Based Architecture | Vercel (SPA) |
| **Móvil** | Flutter + Dart | Feature-Based + Component-Based Architecture | APK / App Bundle |
| **Base de Datos** | PostgreSQL (Supabase) | Relacional / RLS | Supabase Cloud |

---

## 1. API (Backend)

**Tecnología:** Node.js + Express + TypeScript  
**Patrón:** Feature-Based + Layered Architecture

Organización modular por funcionalidad (*Feature-Based*), donde cada funcionalidad implementa internamente una separación por capas (*Layered*):

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

### Estructura base

```text
api/
└── src/
    ├── features/
    │   └── [feature]/
    │       ├── controllers/
    │       ├── services/
    │       ├── repositories/
    │       ├── routes/
    │       ├── validators/
    │       └── types/
    │
    ├── shared/
    │   ├── middleware/
    │   ├── utils/
    │   └── errors/
    │
    ├── config/
    └── app.ts
```

---

## 2. Web / PWA (Frontend)

**Tecnología:** React + Vite + TypeScript  
**Patrón:** Feature-Based + Component-Based Architecture

Organización principal por funcionalidad (*Feature-Based*), donde cada funcionalidad encapsula sus componentes, vistas, hooks y servicios locales (*Component-Based*), apoyada por recursos transversales globales.

### Estructura base

```text
web/
└── src/
    ├── features/
    │   └── [feature]/
    │       ├── components/
    │       ├── pages/
    │       ├── hooks/
    │       ├── services/
    │       └── types/
    │
    ├── components/
    ├── layouts/
    ├── services/
    ├── hooks/
    ├── utils/
    ├── routes/
    └── app/
```

---

## 3. Móvil

**Tecnología:** Flutter + Dart  
**Patrón:** Feature-Based + Component-Based Architecture

Organización por funcionalidad (*Feature-Based*) compuesta por pantallas y widgets modulares (*Component-Based*), separando la interfaz de usuario de sus servicios y modelos de datos.

### Estructura base

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

---

## 4. Infraestructura y Despliegue

La especificación completa de plataformas, configuración por entorno y variables requeridas para producción se encuentra documentada en:
👉 **[Estrategia de Infraestructura y Despliegue](despliegue.md)**.
