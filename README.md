# CouchOne Fit

> **Nombre oficial:** CouchOne Fit  
> **Periodo:** Septiembre – Diciembre 2026  
> **Tipo de proyecto:** Proyecto Integrador (Web Integral & Móvil Integral)  
> **Estado:** Fase de definición y planeación  

---

## Equipo

- **Maythe Francella Balleza Solis**
- **Ángel Fernando Oñate Reyes**
- **Itzel Yutzil Sánchez López**

---

# Contexto general

**CouchOne Fit** es una plataforma SaaS orientada a entrenadores, coaches y nutriólogos deportivos para administrar a sus clientes y dar seguimiento a su entrenamiento, nutrición y progreso físico.

El sistema está compuesto por tres partes principales:

- **Aplicación Web / PWA:** dirigida a los profesionales y al portal comercial del SaaS.
- **Aplicación móvil:** enfocada en los clientes (atletas) para su uso diario.
- **Backend / API central:** conecta ambas aplicaciones, administra la lógica de negocio, autenticación, seguridad y persistencia de datos.

## Modelo general del sistema

1. El profesional adquiere acceso a CouchOne Fit mediante un plan de suscripción que le permite administrar una cantidad determinada de clientes activos.
2. Desde la aplicación web, el profesional registra a sus clientes, prepara sus expedientes individuales, asigna planes de entrenamiento y nutrición, y da seguimiento a su evolución.
3. El cliente utiliza principalmente la aplicación móvil para consultar las prescripciones de su profesional y registrar sus entrenamientos, peso, adherencia y check-ins diarios.

> **Idea clave:** La aplicación no pretende sustituir al entrenador o nutriólogo, sino servir como la herramienta central que profesionaliza y agiliza la relación y el seguimiento entre el profesional y sus clientes.

---

# Aplicaciones del sistema

```text
CouchOne Fit
│
├── Web / PWA ──────────── [Profesionales y Portal Comercial]
│        │
│        ▼
├── Backend / API ──────── [Lógica central, seguridad y base de datos]
│        ▲
│        │
└── Móvil ──────────────── [Clientes / Atletas]
```

## 1. Aplicación Web / PWA

Desarrollada principalmente para el **profesional**, dividida en dos secciones:

### Parte pública (Portal comercial)
- Qué es CouchOne Fit y sus beneficios principales.
- Planes disponibles y límites de clientes por plan.
- Registro e inicio de sesión del profesional.

### Panel del profesional
- **Gestión de clientes:** registrar clientes, consultar activos/inactivos, editar datos y desactivación (baja lógica).
- **Expediente del cliente:** registrar datos iniciales, medidas corporales, pliegues antropométricos y objetivos.
- **Planificación:** crear y activar planes de entrenamiento (ejercicios, series, repeticiones, descansos) y planes de alimentación (comidas, porciones, calorías, macronutrientes).
- **Seguimiento histórico:** consultar check-ins periódicos, evolución del peso, fotos de progreso y adherencia.
- **Vinculación:** generación de códigos temporales de acceso para nuevos clientes.

## 2. Aplicación móvil

Diseñada para el **cliente del entrenador o nutriólogo** como herramienta diaria:

- **Consulta:** perfil personal, plan de entrenamiento activo (ejercicios, series, pesos objetivo, instrucciones) y plan de alimentación vigente.
- **Registro diario:** entrenamientos realizados, peso utilizado, repeticiones logradas, cumplimiento nutricional, peso corporal y fotografías de progreso.
- **Check-ins:** registro periódico de indicadores de sueño, estrés, energía y comentarios para su profesional.
- **Historial:** consulta de progreso longitudinal autorizado por el profesional.

El cliente no tiene que volver a capturar su nombre, peso inicial ni parámetros base; al registrarse accede directamente al expediente que su profesional ya preparó.

---

# Vinculación entre profesional y cliente

Para garantizar que toda cuenta de cliente pertenezca a la cartera de un profesional, el acceso se realiza mediante un **código o token de vinculación individual de un solo uso**:

```text
[ Profesional ] ──( Registra expediente inicial )──> Genera Código Único
                                                            │
                                                            ▼ Entrega código
[ Cliente ]     ──( Formulario de registro móvil )──<───────┘
  • Usuario
  • Contraseña y confirmación
  • Correo y confirmación
  • Código obligatorio
        │
        ▼ Valida en Backend
  1. Valida validez y unicidad del código.
  2. Crea la cuenta del cliente con sus credenciales.
  3. Establece la relación permanente Cliente ↔ Profesional.
  4. Vincula la cuenta directamente con el expediente preexistente.
  5. Invalida y elimina el código temporal (un solo uso).
```

- Sin un código válido no se permite crear la cuenta de cliente.
- El código temporal se destruye tras el canje exitoso; los accesos posteriores utilizan exclusivamente las credenciales del cliente.

---

# Flujo general del sistema

### Flujo del Profesional (Web / PWA)
1. El profesional crea su cuenta o inicia sesión.
2. Selecciona o administra su plan de suscripción.
3. Entra al panel de administración y registra un nuevo cliente.
4. Crea su expediente con datos físicos y parámetros iniciales.
5. Diseña y asigna el plan de entrenamiento y/o nutrición.
6. Genera un código individual de vinculación y se lo entrega al cliente.

### Flujo del Cliente (Aplicación móvil)
1. Descarga la aplicación e inicia el registro.
2. Ingresa usuario, contraseña, correo (con sus confirmaciones) y el código entregado.
3. El backend valida el código y crea la cuenta autenticada.
4. Se enlaza automáticamente al expediente preparado por su profesional.
5. El código se consume e invalida.
6. El cliente accede directamente a su información, rutinas y comidas asignadas.
7. Comienza a registrar su progreso y check-ins diarios, visibles para su profesional en tiempo real.

---

# Roles del sistema

| Rol | Plataforma principal | Responsabilidades |
| :--- | :--- | :--- |
| **Profesional** | Web / PWA | Gestiona su cartera de clientes, crea expedientes, prescribe entrenamientos y dietas, revisa check-ins y analiza la evolución histórica. |
| **Cliente** | Móvil | Consulta sus planes asignados, ejecuta sus rutinas y registra métricas diarias de seguimiento y progreso. Acceso restringido exclusivamente a su propia información. |
| **Administrador** | Web | Gestiona la plataforma global, cuentas de profesionales, catálogo de planes y estados de suscripciones SaaS (separado de la operación técnica de los clientes). |

---

# Política de eliminación de cuentas (Baja lógica)

El sistema **no realiza eliminación física** de cuentas ni de información histórica en la base de datos:

- La baja cambia el estado de la cuenta a inactiva.
- Se inhabilita el inicio de sesión del usuario dado de baja.
- Se conservan íntegras las relaciones, expedientes, evaluaciones y registros históricos para garantizar consistencia y trazabilidad longitudinal.

---

# Tecnologías y arquitectura

El proyecto se gestiona como un **monorepo**:

| Aplicación | Tecnología confirmada | Arquitectura |
| :--- | :--- | :--- |
| **API / Backend** | Node.js + Express + TypeScript | Feature-Based + Layered Architecture |
| **Web / PWA** | React + Vite + TypeScript | Feature-Based + Component-Based Architecture |
| **Móvil** | Flutter + Dart | Feature-Based + Component-Based Architecture |

Documentación completa de la estructura de capas y carpetas en: [docs/architecture/README.md](docs/architecture/README.md).

### Estructura base de carpetas por aplicación

#### Backend (`api/src/`)
```text
api/
└── src/
    ├── features/
    │   └── [feature]/          # controllers, services, repositories, routes, validators, types
    ├── shared/                 # middleware, utils, errors
    ├── config/
    └── app.ts
```

#### Frontend (`web/src/`)
```text
web/
└── src/
    ├── features/
    │   └── [feature]/          # components, pages, hooks, services, types
    ├── components/             # UI compartida global
    ├── layouts/
    ├── routes/
    └── app/
```

#### Móvil (`mobile/lib/`)
```text
mobile/
└── lib/
    ├── features/
    │   └── [feature]/          # screens, widgets, services, models
    ├── shared/                 # widgets y utils compartidos
    ├── routes/
    └── main.dart
```

---

# Estructura del repositorio

```text
/
├── apps/
│   ├── web/                    # Frontend React + Vite + TS (PWA)
│   ├── mobile/                 # App móvil Flutter + Dart
│   └── api/                    # Backend Node.js + Express + TS
│
├── docs/
│   ├── requirements/           # Requerimientos y acuerdos
│   ├── architecture/           # Documentación arquitectónica
│   ├── database/               # Modelo y esquemas de base de datos
│   └── api/                    # Contratos y documentación de endpoints
│
├── .gitignore
└── README.md
```

---

# Documentación del proyecto

La documentación oficial del proyecto se organiza de manera modular dentro de la carpeta `docs/`:

- **Requerimientos del sistema:** [docs/requirements/README.md](docs/requirements/README.md)
  - [Requerimientos del Sistema Interno (RF / RDF)](docs/requirements/sistema-interno.md)
  - [Requerimientos del Cliente (RC / RDC)](docs/requirements/cliente.md)
  - [Requerimientos No Funcionales (RNF)](docs/requirements/no-funcionales.md)
  - [Requerimientos de Seguridad (RS)](docs/requirements/seguridad.md)
  - [Catálogo oficial vigente — Google Sheets (Hoja V2)](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289)
- **Arquitectura de aplicaciones:** [docs/architecture/README.md](docs/architecture/README.md)
- **Base de datos:** [docs/database/](docs/database/)
- **API y Contratos:** [docs/api/](docs/api/)

---

# Metodología de trabajo

Se utilizará **Scrum** como marco ágil de desarrollo.

- **Fase inicial:** definición del producto, recopilación de requerimientos, diseño arquitectónico y configuración base del monorepo.
- **Sprint 1:** definición del proyecto, refinamiento de alcance, diseño del modelo de datos y preparación de entornos.
- **Sprints sucesivos:** desarrollo incremental e iterativo por features priorizadas en el Product Backlog.

---

# Estado actual del proyecto

### Decisiones confirmadas
- Nombre oficial: **CouchOne Fit**.
- Proyecto Integrador Sep–Dic 2026 (Web Integral + Móvil Integral).
- Repositorio monorepo con aplicaciones desacopladas.
- Tecnologías base: Node.js/Express (API), React/Vite (Web), Flutter (Móvil).
- Arquitecturas: Feature-Based + Layered (Backend) y Feature-Based + Component-Based (Web y Móvil).
- Registro de clientes subordinado a código de vinculación único.
- Acceso directo al expediente preexistente sin recaptura de datos personales.
- Baja lógica de cuentas sin eliminación física de registros.
- Catálogo de requerimientos formalizado en Google Sheets (V2).

### Decisiones pendientes por definir
- Ajustes al alcance funcional vigente e identificación de requisitos que no se implementarán.
- Problemática definitiva y objetivo específico formal.
- Motor de base de datos (PostgreSQL, MySQL, etc.) y modelo entidad-relación.
- Tipo y protocolo de API (REST, GraphQL).
- Estrategia de autenticación y autorización (JWT, sesiones, OAuth).
- Formato técnico, expiración y mecanismo de reposición del código de vinculación.
- Política de retención de datos tras la baja lógica y condiciones de suspensión de suscripciones.
- Identificador definitivo para login (usuario, correo o ambos) y manejo de sesión móvil.
- Plataformas de hosting y estrategia de despliegue continuo (CI/CD).
- Diseño visual, sistema de diseño y paleta de componentes.
- Estrategia de pruebas (unitarias, integración, E2E).

---

# Idea central

> **El profesional administra y configura desde la Web/PWA.**  
> **El cliente ejecuta, consulta y registra desde la aplicación móvil.**  
> **La API central mantiene sincronizadas ambas aplicaciones, controla permisos, relaciones, autenticación y reglas de negocio.**  
> 
> El profesional es propietario de su cartera de clientes y cada cliente debe estar vinculado obligatoriamente a un profesional. El objetivo principal de **CouchOne Fit** es centralizar en un solo sistema la administración de clientes, entrenamiento, nutrición y seguimiento del progreso físico.
