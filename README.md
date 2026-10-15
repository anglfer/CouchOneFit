# CouchOne Fit

<p align="center"><img src="apps/web/public/logo.png" alt="Logo de CouchOne Fit" width="360"></p>

> **Nombre oficial:** CouchOne Fit
> **Periodo:** Septiembre – Diciembre 2026
> **Tipo de proyecto:** Proyecto Integrador (Web Integral & Móvil Integral)
> **Estado:** Base técnica y demo; negocio pendiente (auditoría 8-oct-2026). DEC-001–016 cerradas documentalmente14-oct por delegación explícita usuario, no implementación ni certificación médica/legal.

---

## Equipo

- **Maythe Francella Balleza Solis**
- **Ángel Fernando Oñate Reyes**
- **Itzel Yutzil Sánchez López**
- **Michel Omar Nava Oliva**

Plan vigente: [PLAN_TRABAJO_V2.md](PLAN_TRABAJO_V2.md), §3.3/3.4. **V2 académica no comercial, exclusivamente sintética:**271SP activos,13excluidos,284históricos; nombres/roles no atribuyen responsabilidad legal.

> 📌 **Flujo de trabajo y ramas en Git:** Consulta la [Guía de Trabajo con Git](CONTRIBUTING.md) antes de comenzar a programar para conocer las reglas de ramas, commits y manejo de archivos compartidos.

---

# Contexto general

**CouchOne Fit** es una plataforma SaaS orientada a entrenadores, coaches y nutriólogos deportivos para administrar a sus clientes y dar seguimiento a su entrenamiento, nutrición y progreso físico.

El sistema está compuesto por tres partes principales:

- **Aplicación Web / PWA:** profesionales, administración y portal académico demostrativo; catálogo con checkout de pago simulado, sin precios ni cobros reales.
- **Aplicación móvil:** enfocada en los clientes (atletas) para su uso diario.
- **Backend / API central:** conecta ambas aplicaciones, administra la lógica de negocio, autenticación, seguridad y persistencia de datos.

## Modelo general del sistema

1. Admin asigna plan demo Básico10/Pro30/Élite ilimitado explícito; el portal permite simular la contratación, sin procesar pagos ni activar suscripciones reales. Sin plan profesional solo perfil/suscripción y panel vacío, sin operaciones de negocio.
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

### Parte pública (Portal académico demostrativo)

- Qué es CouchOne Fit y sus beneficios principales.
- Planes disponibles y límites de clientes por plan.
- Registro e inicio de sesión del profesional.

### Panel del profesional

- **Gestión de clientes:** registrar clientes, consultar activos/inactivos, editar datos y desactivación (baja lógica).
- **Expediente del cliente:** registrar datos iniciales, medidas corporales, pliegues antropométricos y objetivos.
- **Planificación:** entrenamiento versionado (series/reps, intensidad RPE prescripción, carga objetivo opcional) y alimentación manual (cantidades/instrucciones, calorías/macros opcionales).
- **Seguimiento histórico:** check-ins diarios/peso corporal distinto de carga por serie, evolución autorizada y adherencia observada/cobertura separadas; **sin fotos V2**.
- **Vinculación:** generación de códigos temporales de acceso para nuevos clientes.

## 2. Aplicación móvil

Diseñada para el **cliente del entrenador o nutriólogo** como herramienta diaria:

- **Consulta:** perfil personal, plan de entrenamiento activo (ejercicios, series, pesos objetivo, instrucciones) y plan de alimentación vigente.
- **Registro diario:** carga kg/reps reales/estado por serie, cumplimiento nutricional y peso corporal opcional; sin fotografías ni RPE ejecución.
- **Check-ins:** diarios, sueño en horas/estrés y energía1–5/comentario/peso opcionales, al menos un campo real; única captura/fuente HU-032/037 sin alterar base/evaluación.
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
- DEC-003:32bytes CSPRNG/base64url43/hash SHA-256/TTL7d servidor, una pendiente por expediente activo no vinculado, entrega manual. Cuenta+vínculo+confirmación aviso versionado+DELETE temporal en única conexión/transacción. Activo reserva cupo una vez, canje no cuenta segunda plaza.

---

# Flujo general del sistema

### Flujo del Profesional (Web / PWA)

1. El profesional crea su cuenta o inicia sesión.
2. Consulta plan demo asignado por admin; solicita cambios asistidamente, sin pantalla nueva/cobro.
3. Entra al panel profesional y registra cliente dentro del cupo, sin asumir administración SaaS.
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
7. Registra según reloj servidor/zonaIANA, hoy y dos fechas locales anteriores, corrección auditada/idempotente. Lectura inmediata tras COMMIT; dashboard foreground60s+latencia, móvil refresh manual warm objetivo5s, no WebSocket/keep-alive.

---

# Roles del sistema

| Rol               | Plataforma principal | Responsabilidades                                                                                                                                                    |
| :---------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Profesional**   | Web / PWA            | Gestiona su cartera de clientes, crea expedientes, prescribe entrenamientos y dietas, revisa check-ins y analiza la evolución histórica.                             |
| **Cliente**       | Móvil                | Consulta sus planes asignados, ejecuta sus rutinas y registra métricas diarias de seguimiento y progreso. Acceso restringido exclusivamente a su propia información. |
| **Administrador** | Web                  | Gestiona la plataforma global, cuentas de profesionales, catálogo de planes y estados de suscripciones SaaS (separado de la operación técnica de los clientes).      |

---

# Política de eliminación de cuentas (Baja lógica)

Las rutas ordinarias realizan **baja lógica**, no DELETE físico de cuentas/historial:

- La baja cambia el estado de la cuenta a inactiva.
- Se inhabilita el inicio de sesión del usuario dado de baja.
- Relaciones/historial dentro de ventana académica: purga controlada del dataset sintético aislado30d tras aceptación final; backups expiran≤7d tras purga, fixtures tras runs. No forever/exportación automática (DEC-011).
- Expediente inactivo ≠ cuenta de baja. Cliente cuenta activa conserva lectura propia de perfil/planes publicados/historial autorizado ante expediente inactivo, profesional inactivo o sub suspendida, sin check-in/peso/series. Profesional inactivo revoca/no login sin cascada cliente. Reactivar cuenta no activa expediente; expediente requiere profesional/sub activos y cupo. Último admin protegido.

---

# Tecnologías y arquitectura

El proyecto se gestiona como un **monorepo**:

| Aplicación        | Tecnología confirmada          | Arquitectura                                 | Hosting / Infraestructura                                  |
| :---------------- | :----------------------------- | :------------------------------------------- | :--------------------------------------------------------- |
| **API / Backend** | Node.js + Express + TypeScript | Feature-Based + Layered Architecture         | Render (Web Service)                                       |
| **Web / PWA**     | React + Vite + TypeScript      | Feature-Based + Component-Based Architecture | Vercel (SPA)                                               |
| **Móvil**         | Flutter + Dart                 | Feature-Based + Component-Based Architecture | APK Android firmado; sin AAB/tiendas/iOS/Windows nativo V2 |
| **Base de Datos** | PostgreSQL (Supabase)          | Relacional / RLS                             | Supabase Cloud                                             |

Documentación completa de arquitectura y despliegue en:

- [Arquitectura de capas y módulos](docs/architecture/README.md)
- [Estrategia de infraestructura y despliegue](docs/architecture/despliegue.md)

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
- **Base de datos:** [docs/database/README.md](docs/database/README.md)
- **API y Contratos:** [docs/api/](docs/api/)

---

# Metodología de trabajo

Se utilizará **Scrum** como marco ágil de desarrollo.

- **Fase inicial:** definición del producto, recopilación de requerimientos, diseño arquitectónico y configuración base del monorepo.
- **Sprints operativos quincenales2026:**19-oct–1-nov,2–15-nov,16–29-nov,30-nov–13-dic; S0–S7 del plan son incrementos/dependencias, no ocho quincenas ni numeración oficial.
- **Capacidad:** WIP1/dueño/reserva30%, horas brutas confirmadas×0,7 sin convertir SP a horas; reporte semanal/primer review1-nov. TARGET13-dic no fecha oficial/compromiso; confirmaciones externas de horas/accesos/firma.

---

# Estado actual del proyecto

### Decisiones confirmadas

- Nombre oficial: **CouchOne Fit**.
- Proyecto Integrador Sep–Dic 2026 (Web Integral + Móvil Integral).
- Repositorio monorepo con aplicaciones desacopladas.
- Tecnologías base: Node.js/Express (API), React/Vite (Web), Flutter (Móvil).
- Arquitecturas: Feature-Based + Layered (Backend) y Feature-Based + Component-Based (Web y Móvil).
- Persistencia elegida **PostgreSQL en Supabase Cloud**, SQL `pg` parametrizado/migraciones versionadas/RLS contexto confiable; conexión negocio no demostrada por auditoría8-oct.
- Registro de clientes subordinado a código de vinculación único.
- Acceso directo al expediente preexistente sin recaptura de datos personales.
- Baja lógica y conservación/purga sintética DEC-011, sin datos reales V2.
- Catálogo de requerimientos formalizado en Google Sheets (V2).

### Decisiones resueltas; implementación y gates pendientes

- Ninguna pregunta de producto DEC-001–016 abierta: reglas vigentes en §3.4 del plan;41HU/21TT preservadas, sin puntos inventados para refinamientos.
- REST `/api`, auth API/PostgreSQL; usuarioASCII3–30 lower/trim sin@ o correo obligatorio lower/trim; contraseña15–128Unicode sin trim/composición, Argon2id mínimo19MiB/t2/p1. JWT15min+sid/estadoBD cada request, refresh rotativo absoluto30d; logout/replay revoca servidor.
- Web proxy mismo origen Vercel→RenderHTTPS, cookie host-only HttpOnly/Secure/SameSiteStrict/no-cache y Origin+tokenCSRF; Vite proxy local, móvil Bearer secure store/directoRenderTLS. HU-009 recuperación asistida incluida identidad fuera banda/reset separado32bytes/hash/TTL30min/revoca todas, no SMTP.
- HU-023 incluida Jackson–Pollock3/Siri con **gate técnico originales completos/fixtures**, no certificación por abstracts. HU-025 pospuesta excepciónRDF0605/0606; HU-038 fuera V2. HU-041 aviso académico versionado y confirmación antes primer uso incluidos, no waiver/certificación legal.
- Implementar contratos/DDL/DTO TT-003/009, migraciones/RLS/features/tests/CI/deploy/restore/APK; rutas y DDL sugeridos, no implementados. Android mínimaAPI24 política sujeta gate dependency/build/emuladores24/36; matriz browser/PWA aún por ejecutar. Mantener locks sin upgrades en esta edición.
- Gates externos: horas/fecha oficial, límites/permisos cloud/custodia firma. Datos reales/comercial requieren institución/responsable/jurisdicción/política y aprobación competente separada; no autorizados ni certificados aquí.

---

# Idea central

> **El profesional administra y configura desde la Web/PWA.**
> **El cliente ejecuta, consulta y registra desde la aplicación móvil.**
> **La API central mantiene sincronizadas ambas aplicaciones, controla permisos, relaciones, autenticación y reglas de negocio.**
>
> El profesional es propietario de su cartera de clientes y cada cliente debe estar vinculado obligatoriamente a un profesional. El objetivo principal de **CouchOne Fit** es centralizar en un solo sistema la administración de clientes, entrenamiento, nutrición y seguimiento del progreso físico.
