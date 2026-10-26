# Arquitectura de las Aplicaciones

## Resumen técnico

| Aplicación        | Tecnología                     | Arquitectura                                 | Hosting / Despliegue |
| :---------------- | :----------------------------- | :------------------------------------------- | :------------------- |
| **API**           | Node.js + Express + TypeScript | Feature-Based + Layered Architecture         | Render (Web Service) |
| **Web / PWA**     | React + Vite + TypeScript      | Feature-Based + Component-Based Architecture | Vercel (SPA)         |
| **Móvil**         | Flutter + Dart                 | Feature-Based + Component-Based Architecture | APK Android release firmado; sin AAB/tiendas/iOS/Windows nativo en V2 |
| **Base de Datos** | PostgreSQL (Supabase)          | Relacional / RLS                             | Supabase Cloud       |

---

## 1. API (Backend)

**Tecnología:** Node.js + Express + TypeScript
**Patrón:** Feature-Based + Layered Architecture

Organización modular por funcionalidad (_Feature-Based_), donde cada funcionalidad implementa internamente una separación por capas (_Layered_):

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

### Límites de implementación en API

`app.ts` compone middleware y routers. Los endpoints se declaran en `features/[feature]/routes/`, sus manejadores HTTP en `controllers/`, la coordinación en `services/` y las consultas SQL en `repositories/`. La validación de entrada pertenece a `validators/`.

Autenticación conserva sesiones, cookies y verificación de roles en `features/auth/`. Profesional contiene la lectura de su perfil; administración reutiliza el controlador de lectura de sesión autenticada. Los routers de ambas áreas aplican el rol antes de exponer sus endpoints, incluidas las rutas desconocidas.

Los repositorios de sesión conservan `BEGIN`, bloqueos, `COMMIT`, `ROLLBACK` y liberación de conexión. Reciben del servicio la función que firma el acceso para ejecutarla antes del commit: un fallo de firma debe revertir también las escrituras de sesión y renovación. Los repositorios no importan servicios.

---

## 2. Web / PWA (Frontend)

**Tecnología:** React + Vite + TypeScript
**Patrón:** Feature-Based + Component-Based Architecture
**Estándar de formato:** Prettier + Oxlint (ver [Guía de formato](formato-codigo-web.md))

Organización principal por funcionalidad (_Feature-Based_), donde cada funcionalidad encapsula sus componentes, vistas, hooks y servicios locales (_Component-Based_), apoyada por recursos transversales globales.

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

### Ubicación y nombres en Web

- `layouts/WorkspaceLayout.tsx`: estructura compartida del panel profesional y administrativo. Un layout compone navegación y contenido; no consulta perfiles ni decide permisos.
- `components/`: interfaz reutilizada entre funcionalidades (`Brand`, `Link`, `Icon`, apariencia e instalación). Una funcionalidad no importa componentes desde otra cuando su responsabilidad es global.
- `hooks/`: hooks React compartidos (`useLocation`, `useThemePreference`, `usePwa`). Los hooks exclusivos de una funcionalidad van en `features/[feature]/hooks/`.
- `services/`: cliente HTTP y estado del navegador compartido (tema y PWA), sin dependencias de React. La inicialización de tema/PWA se importa desde `main.tsx` para conservar los eventos previos al montaje.
- `utils/`: funciones compartidas de navegación y nombres de personas, sin componentes ni hooks.
- `features/auth/`: acceso y registro, sus servicios, contratos en `types/` y textos/valores en `constants/`.
- `features/professional/pages/ProfessionalPage.tsx` y `features/admin/pages/AdminPage.tsx`: vistas de cada área. `App.tsx` compone la aplicación; las vistas se nombran `*Page` y los layouts `*Layout`.
- `features/marketing/components/`: secciones de la página pública; cada sección exportada que se consume por separado tiene su archivo con el nombre del componente.

Los tipos de contrato se guardan en `types/` de su funcionalidad. Las props que solo describen un componente pueden permanecer junto a él. Los estilos locales reales pueden convivir con su funcionalidad; no se mantienen hojas vacías ni reexportaciones hacia ubicaciones anteriores.

---

## 3. Móvil

**Tecnología:** Flutter + Dart
**Patrón:** Feature-Based + Component-Based Architecture

Organización por funcionalidad (_Feature-Based_) compuesta por pantallas y widgets modulares (_Component-Based_), separando la interfaz de usuario de sus servicios y modelos de datos.

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

La pantalla inicial se encuentra en `features/home/screens/home_screen.dart`. `main.dart` inicia la aplicación y configura su tema; la pantalla recibe el cambio de tema mediante callback y conserva su interfaz. El tema es un recurso transversal en `shared/theme/`.

---

## 4. Infraestructura y Despliegue

La especificación completa de plataformas, configuración por entorno y variables requeridas para producción se encuentra documentada en:
👉 **[Estrategia de Infraestructura y Despliegue](despliegue.md)**.


## Contratos por funcionalidad y persistencia

La documentación de historias se concentra en [épicas e historias](../epicas/README.md), sin carpetas por sprint. La [Guía de programación](../../DEVELOPMENT.md) resume las reglas para API, Web y móvil; las [convenciones compartidas de BD/código](../database/convenciones.md) son la fuente de verdad para PostgreSQL y mapeos de contrato. El [modelo de identidad y acceso](../database/modelo-identidad-acceso.md) documenta tablas, relaciones, índices, políticas y funciones reales de HU-001/002. Todos los identificadores del dominio usan inglés: PostgreSQL `snake_case`, TypeScript/JSON `camelCase` y clases/tipos/componentes `PascalCase`. Los repositorios mapean columnas explícitamente.
