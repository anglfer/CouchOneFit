# CouchOne Fit

<p align="center"><img src="apps/web/public/logo.png" alt="Logo de CouchOne Fit" width="360"></p>

> **Nombre oficial:** CouchOne Fit
> **Tipo de producto:** Plataforma SaaS de entrenamiento, nutrición y seguimiento
> **Estado:** producto SaaS en desarrollo incremental. Registro y acceso profesional Web/API/PostgreSQL disponibles localmente; cartera y demás módulos se integran por funcionalidad. Ver documentación y evidencia HU-001.

---

## Equipo

- **Maythe Francella Balleza Solis**
- **Ángel Fernando Oñate Reyes**
- **Itzel Yutzil Sánchez López**
- **Michel Omar Nava Oliva**

> 📌 **Antes de programar:** empieza por la [Guía de programación](DEVELOPMENT.md), las [convenciones de base de datos y contratos](docs/database/convenciones.md), y el [glosario de identidad y acceso](docs/architecture/domain-glossary.md). Para ramas, commits y manejo de archivos compartidos, consulta la [Guía de Trabajo con Git](CONTRIBUTING.md).

---

# Contexto general

**CouchOne Fit** es una plataforma SaaS orientada a entrenadores, coaches y nutriólogos deportivos para administrar a sus clientes y dar seguimiento a su entrenamiento, nutrición y progreso físico.

El sistema está compuesto por tres partes principales:

- **Aplicación Web / PWA:** profesionales, administración y portal público; catálogo con precios y registro desde los planes, sin cobros reales (acuerdo 15-oct).
- **Aplicación móvil:** enfocada en los clientes (atletas) para su uso diario.
- **Backend / API central:** conecta ambas aplicaciones, administra la lógica de negocio, autenticación, seguridad y persistencia de datos.

## Modelo general del sistema

1. El profesional contrata Básico (10), Pro (30) o Élite (ilimitado) y sube de nivel mediante checkout simulado. El portal permite elegir un plan e iniciar el registro; el registro no activa la suscripción; el checkout autenticado la activa únicamente tras aprobar el pago simulado. Sin plan, el profesional solo consulta perfil/suscripción y panel vacío.
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

### Parte pública (Portal público)

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

1. Desde «Contáctanos» o «Contratar plan», crea su cuenta en `/registro`; inicia sesión en `/acceso` y entra a `/app/`.
2. Consulta su suscripción y contrata/sube de nivel mediante pago simulado: precio completo y un nuevo mes desde aprobación, con comprobante e historial. El administrador solo consulta suscripciones.
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
- La baja lógica conserva relaciones e historial. Retención y eliminación por categoría requieren una política definida; no se eliminan cuentas por hitos de entrega. Los datos de pruebas se mantienen aislados.
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
    ├── layouts/                # Estructuras de páginas compartidas
    ├── hooks/                  # Hooks React transversales
    ├── services/               # HTTP, tema y PWA
    ├── utils/                  # Navegación y funciones compartidas
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
- Plataforma SaaS con Web/PWA profesional y aplicación móvil para clientes.
- Repositorio monorepo con aplicaciones desacopladas.
- Tecnologías base: Node.js/Express (API), React/Vite (Web), Flutter (Móvil).
- Arquitecturas: Feature-Based + Layered (Backend) y Feature-Based + Component-Based (Web y Móvil).
- Persistencia elegida **PostgreSQL en Supabase Cloud**, SQL `pg` parametrizado/migraciones versionadas/RLS contexto confiable; conexión negocio no demostrada por auditoría8-oct.
- Registro de clientes subordinado a código de vinculación único.
- Acceso directo al expediente preexistente sin recaptura de datos personales.
- Baja lógica y conservación de historial DEC-011; retención y eliminación autorizada por categoría de dato.
- Catálogo de requerimientos formalizado en Google Sheets (V2).

### Decisiones resueltas; implementación y gates pendientes

- Ninguna pregunta de producto DEC-001–016 abierta: reglas vigentes en §3.4 del plan;41HU/21TT preservadas, sin puntos inventados para refinamientos.
- REST `/api`, auth API/PostgreSQL; usuarioASCII3–30 lower/trim sin@ o correo obligatorio lower/trim; contraseña15–128Unicode sin trim/composición, Argon2id mínimo19MiB/t2/p1. JWT15min+sid/estadoBD cada request, refresh rotativo absoluto30d; logout/replay revoca servidor.
- Web proxy mismo origen Vercel→RenderHTTPS, cookie host-only HttpOnly/Secure/SameSiteStrict/no-cache y Origin+tokenCSRF; Vite proxy local, móvil Bearer secure store/directoRenderTLS. HU-009 recuperación asistida incluida identidad fuera banda/reset separado32bytes/hash/TTL30min/revoca todas, no SMTP.
- HU-023 incluida Jackson–Pollock3/Siri con **gate técnico originales completos/fixtures**, no certificación por abstracts. HU-025 pospuesta excepciónRDF0605/0606; HU-038 fuera V2. HU-041 información de registro versionada y confirmación antes primer uso incluidos, no waiver/certificación legal.
- Implementar contratos/DDL/DTO TT-003/009, migraciones/RLS/features/tests/CI/deploy/restore/APK; rutas y DDL sugeridos, no implementados. Android mínimaAPI24 política sujeta gate dependency/build/emuladores24/36; matriz browser/PWA aún por ejecutar. Mantener locks sin upgrades en esta edición.
- Gates externos: horas/fecha oficial, límites/permisos cloud/custodia firma. Política de privacidad y conservación del producto: responsable, contacto, finalidades y plazos por definir; la documentación técnica no acredita revisión legal.

---

# Idea central

> **El profesional administra y configura desde la Web/PWA.**
> **El cliente ejecuta, consulta y registra desde la aplicación móvil.**
> **La API central mantiene sincronizadas ambas aplicaciones, controla permisos, relaciones, autenticación y reglas de negocio.**
>
> El profesional es propietario de su cartera de clientes y cada cliente debe estar vinculado obligatoriamente a un profesional. El objetivo principal de **CouchOne Fit** es centralizar en un solo sistema la administración de clientes, entrenamiento, nutrición y seguimiento del progreso físico.


## Incremento HU-001 — registro Web (15-oct-2026)

Formulario `/registro`, API `POST /api/auth/professionals` y migración incremental para cuenta/perfil/aceptación. Cuenta profesional activa, sin sesión, cupo ni suscripción automática. «Contáctanos» abre registro; planes Básico $299 MXN/10, Pro $599 MXN/30 y Élite $999 MXN/ilimitado conducen al formulario con interés preseleccionado. Este acuerdo reemplaza las condiciones anteriores del catálogo; no introduce cobros reales.

Contrato, reglas, límites y recorrido: [Registro profesional](docs/epicas/ep-01-identidad-y-acceso/hu-001/README.md). Aplicación y evolución de tablas para login: [Base de datos](docs/database/README.md). Auth propia API/PostgreSQL; no Supabase Auth. Ampliar el perfil después requiere nuevas migraciones, conservando cuentas existentes.

Para ejecutar: en `apps/api`, configurar `DATABASE_URL`/`CORS_ORIGIN` y aplicar `npm run db:migrate` con usuario de migraciones; iniciar con usuario de servidor dedicado mediante `npm run dev`. En `apps/web`, dejar `VITE_API_URL` vacío y ejecutar `npm run dev` (proxy `/api`). `/acceso` permite iniciar sesión y `/app/*` verifica la sesión antes de mostrar contenido privado. Configurar `AUTH_JWT_SECRET` solo en API y conceder `couchone_authentication` al usuario runtime para HU-002. Ver instrucciones de permisos, pruebas y TLS en BD.

La configuración de ejemplo ya no incluye claves Supabase. Las claves anteriormente publicadas requieren rotación por el responsable: retirarlas del archivo actual no las revoca ni elimina el historial.


## HU-002 — acceso profesional

Login por usuario o correo en `/acceso`, sesión revocable PostgreSQL y guard de `/app/*`. Cada consulta privada comprueba cuenta/rol/estado/sesión; `/api/professional/profile` usa esa identidad para leer solo el perfil propio. Cuenta sin plan muestra perfil y estado vacío, sin cartera ni métricas de ejemplo. Cookies HttpOnly/Strict, Secure en producción; JWT de 15 minutos, refresh rotativo con límite absoluto de 30 días y cierre con revocación inmediata. No se guardan tokens en localStorage.

Aplicar todas las migraciones pendientes con el ejecutor versionado y el usuario de migraciones; usar `couchone_authentication` como membresía del runtime y configurar `AUTH_JWT_SECRET` aleatorio de al menos 32 bytes fuera de Git. La inicial conserva su contenido histórico; el esquema vigente requiere también las migraciones posteriores de provisión, nombres en inglés, expedientes y ciclo de acceso. [Contrato y operación de acceso](docs/epicas/ep-01-identidad-y-acceso/hu-002/README.md), [proceso de BD](docs/database/README.md). HU-005 conserva integración completa con móvil y futuros módulos; HU-002 no asigna plan ni implementa cobros.


## Documentación por épica e historia

**Entornos:** la API de producción existente en Render es
[https://api.ferkxo.tech](https://api.ferkxo.tech). Web publicada accede por su
proxy `/api`; móvil de distribución usa ese dominio. Para desarrollar, Web y
móvil conservan la API local en puerto3000. El despliegue automático de Render
publica los cambios enviados a su rama conectada cuando termina correctamente;
un commit local no despliega. [Configuración y comprobaciones del entorno](docs/architecture/despliegue.md).

HU-006–009 incorpora cambio seguro de credenciales móvil, invitaciones privadas desde `/app/clientes`, activación anónima atómica con aviso versionado y recuperación asistida desde Web/móvil. La recuperación de profesionales/admins se autoriza en el panel; el último admin usa el comando local del custodio. No hay recuperación automática por correo ni cobros. [Contratos y evidencia](docs/epicas/ep-01-identidad-y-acceso/evidencia-hu-006-009.md), [migración/modelo incremental](docs/database/modelo-ciclo-acceso.md), [OpenAPI](docs/api/identity-lifecycle.openapi.json).

Contratos, flujos y evidencia de cada HU están en [docs/epicas](docs/epicas/README.md), dentro de su épica y carpeta de historia. HU-001/002 pertenecen a [EP-01 — Identidad y acceso](docs/epicas/ep-01-identidad-y-acceso/README.md). No se atan las rutas documentales a sprints. [Convenciones de BD/código](docs/database/convenciones.md) y [modelo detallado con tablas y funciones](docs/database/modelo-identidad-acceso.md). La migración inicial consolidada crea las tablas en español y [schemas](docs/database/schemas/README.md) conserva la definición integrada; API/Web se actualizan a los campos camelCase descritos en sus contratos.

## Autoservicio y checkout simulado — 25-oct-2026

Acuerdo vigente: `/app/suscripcion` permite al profesional contratar y mejorar su plan mediante checkout simulado completo. Precio íntegro del plan nuevo, nuevo mes calendario tras aprobar; sin prorrateo ni cobro real. Incluye tarjetas ficticias, procesamiento persistido, aprobación/rechazo/error/cancelación, comprobante e historial. Admin solo consulta suscripciones y no cambia plan/estado/vigencia. Sustituye menciones anteriores de asignación administrativa/no checkout. Aplicar migración incremental `202610260002_simulated_checkout.sql` antes de API/Web. [Contrato y evidencia](docs/epicas/ep-02-saas-y-administracion/README.md).
