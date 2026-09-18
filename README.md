# CouchOne Fit

> **Nombre del proyecto:** CouchOne Fit
> **Periodo:** Septiembre – Diciembre 2026
> **Estado:** Planeación y definición inicial

## Descripción

Este repositorio contiene el desarrollo del **Proyecto Integrador** correspondiente al cuatrimestre Septiembre–Diciembre 2026.

El proyecto estará enfocado principalmente en integrar las materias:

* **Web Integral**
* **Móvil Integral**

Existe la posibilidad de integrar una tercera materia dependiendo de los requerimientos académicos del cuatrimestre.

La idea general del proyecto consiste en desarrollar una plataforma relacionada con la gestión y seguimiento de entrenamiento físico, utilizando una aplicación web y una aplicación móvil Android conectadas a un mismo sistema.

El alcance funcional definitivo todavía se encuentra en proceso de definición por parte del equipo.

---

# Equipo

El equipo está conformado por:

* **Maythe Francella Balleza Solis**
* **Ángel Fernando Oñate Reyes**
* **Itzel Yutzil Sánchez López**

---

# Objetivo general

Desarrollar una plataforma que permita integrar una aplicación web y una aplicación móvil Android dentro de un mismo sistema.

Actualmente se contempla que ambas aplicaciones trabajen con información relacionada con entrenamiento, seguimiento y gestión de usuarios, aunque las funciones específicas deberán ser definidas y aprobadas posteriormente por el equipo.

---

# Estructura del repositorio

La decisión técnica confirmada es utilizar un **monorepo**, permitiendo mantener dentro del mismo repositorio los diferentes componentes del proyecto.

La estructura inicial será:

```text
/
├── apps/
│   ├── web/
│   ├── android/
│   └── api/
│
├── docs/
│   ├── requirements/
│   ├── architecture/
│   ├── database/
│   └── api/
│
├── .github/
│
├── .gitignore
└── README.md
```

Cada apartado tendrá una responsabilidad independiente dentro del sistema.

---

## `apps/web`

Contendrá la aplicación correspondiente a **Web Integral**.

Actualmente se contempla desarrollar una aplicación web que pueda funcionar como PWA.

La arquitectura definida para esta aplicación será:

**Feature-Based + Component-Based Architecture**

Esto permitirá organizar la aplicación principalmente por funcionalidades, manteniendo dentro de cada una los componentes necesarios para su funcionamiento.

La tecnología específica todavía deberá ser definida por el equipo.

Opciones que podrán evaluarse posteriormente incluyen:

* React
* TypeScript
* Otras tecnologías compatibles con los requerimientos de la materia

El manejo de estado, librerías y organización técnica específica todavía se encuentran pendientes de definición.

---

## `apps/android`

Contendrá la aplicación correspondiente a **Móvil Integral**.

La aplicación deberá ejecutarse en Android.

La arquitectura definida para esta aplicación será:

**Feature-Based + Component-Based Architecture**

Esto permitirá organizar la aplicación por funcionalidades y dividir cada una de ellas en componentes reutilizables y responsables de tareas específicas.

Todavía deberá definirse por el equipo:

* Lenguaje principal
* Librerías
* Manejo de datos
* Comunicación con el backend
* Navegación
* Persistencia local
* Requerimientos específicos de la materia

Actualmente se contempla evaluar Kotlin como tecnología principal, pero todavía no se considera una decisión definitiva.

---

## `apps/api`

Este directorio estará destinado al backend o API encargado de centralizar la lógica del sistema y permitir la comunicación con las diferentes aplicaciones.

La arquitectura definida para el backend será:

**Feature-Based + Layered Architecture**

El backend se organizará principalmente por funcionalidades o módulos del sistema, manteniendo dentro de cada funcionalidad una separación por capas de responsabilidades.

Todavía deberá determinarse:

* Tecnología del backend
* Framework
* Tipo de API
* Autenticación
* Autorización
* Validaciones
* Manejo de errores
* Comunicación con la base de datos
* Forma de despliegue

---

# Arquitectura

La arquitectura general del proyecto estará basada en la separación de las tres aplicaciones principales:

```text
CouchOne Fit
│
├── Web / PWA
├── Android
└── Backend / API
```

Cada aplicación tendrá una arquitectura interna adaptada a sus necesidades.

## Backend

Se utilizará:

**Feature-Based + Layered Architecture**

La organización principal se realizará por funcionalidades del sistema, mientras que internamente cada funcionalidad mantendrá una separación por capas.

De forma conceptual:

```text
feature/
├── presentation/
├── application/
├── domain/
└── infrastructure/
```

La estructura definitiva podrá ajustarse dependiendo de la tecnología seleccionada para el backend.

---

## Frontend Web / PWA

Se utilizará:

**Feature-Based + Component-Based Architecture**

La aplicación estará organizada principalmente por funcionalidades.

Cada funcionalidad podrá contener sus propios componentes, vistas, servicios, modelos y demás elementos necesarios.

De forma conceptual:

```text
feature/
├── components/
├── pages/
├── services/
└── models/
```

La estructura definitiva podrá ajustarse dependiendo de la tecnología seleccionada.

---

## Aplicación móvil

Se utilizará:

**Feature-Based + Component-Based Architecture**

La aplicación móvil estará organizada principalmente por funcionalidades, manteniendo dentro de cada una los componentes y elementos necesarios para su funcionamiento.

De forma conceptual:

```text
feature/
├── components/
├── screens/
├── services/
└── models/
```

La estructura definitiva podrá ajustarse dependiendo de la tecnología móvil seleccionada.

---

# Base de datos

La tecnología y estructura de la base de datos todavía están pendientes de definición.

El equipo deberá determinar:

* Motor de base de datos
* Modelo de datos
* Relaciones
* Estrategia de acceso
* Hosting
* Respaldos
* Seguridad
* Manejo de migraciones

La documentación relacionada se almacenará posteriormente en:

```text
docs/database/
```

---

# Comunicación entre aplicaciones

Todavía se debe definir formalmente el tipo de API y los mecanismos específicos de comunicación entre Web, Android y Backend.

La estructura general contempla un backend central al que se conectarán ambas aplicaciones:

```text
Web / PWA ─────┐
               │
               ▼
          Backend / API
               ▲
               │
Android ───────┘
```

Esta estructura permitirá que Web y Android trabajen con la misma información sin depender de encontrarse conectados a una misma red local.

Todavía deberán definirse aspectos como:

* Tipo de API
* Protocolos de comunicación
* Autenticación
* Autorización
* Formato de respuestas
* Manejo de errores

---

# Despliegue

El despliegue todavía no ha sido definido.

Se deberá decidir posteriormente dónde se alojará cada componente:

```text
Web
API
Base de datos
Aplicación Android
```

Una de las opciones a evaluar para Web y Backend es Vercel, pero todavía no se considera una decisión definitiva del proyecto.

También deberá definirse:

* Dominio
* Variables de entorno
* Base de datos remota
* Ambientes de desarrollo
* Ambiente de producción
* Configuración de seguridad
* Proceso de actualización

---

# Documentación

La documentación se mantendrá dentro del mismo repositorio.

```text
docs/
│
├── requirements/
│
├── architecture/
│
├── database/
│
└── api/
```

## `requirements`

Contendrá los requerimientos funcionales y no funcionales del sistema.

## `architecture`

Contendrá diagramas y decisiones relacionadas con la arquitectura.

## `database`

Contendrá la documentación del modelo de datos.

## `api`

Contendrá la documentación relacionada con la comunicación entre aplicaciones y sus endpoints y contratos una vez que estos sean definidos.

---

# Metodología de trabajo

La metodología de desarrollo definida para **CouchOne Fit** será **Scrum**.

El proyecto comenzará con una fase inicial enfocada en conocer y comprender el producto, identificar la problemática y recopilar los requerimientos necesarios antes de iniciar el desarrollo funcional.

Después de esta etapa se trabajará mediante Sprints.

## Fase inicial — Conocimiento del producto y requerimientos

Antes del desarrollo se realizará una fase inicial enfocada en:

* Comprender el producto.
* Identificar la problemática.
* Analizar las necesidades de los usuarios.
* Recopilar requerimientos.
* Identificar restricciones académicas y técnicas.
* Establecer una visión general del proyecto.

Esta fase permitirá generar la información necesaria para comenzar formalmente la organización del proyecto mediante Scrum.

## Sprint 1 — Definición del proyecto

El primer Sprint estará enfocado principalmente en la definición del proyecto.

Entre las actividades contempladas se encuentran:

* Definir el alcance inicial.
* Definir la problemática.
* Definir los objetivos del proyecto.
* Identificar tipos de usuario.
* Identificar funcionalidades principales.
* Organizar y priorizar requerimientos.
* Documentar decisiones técnicas iniciales.
* Definir las bases necesarias para comenzar el desarrollo.

Los siguientes Sprints estarán orientados al desarrollo incremental de las funcionalidades definidas y priorizadas en el Product Backlog.

La duración, cantidad de Sprints, ceremonias específicas y organización interna de Scrum podrán ajustarse posteriormente según la duración del cuatrimestre y los requerimientos académicos.

---

# Gestión del proyecto

Se contempla utilizar GitHub para centralizar el desarrollo.

Posteriormente deberá definirse si se utilizarán herramientas como:

* GitHub Issues
* GitHub Projects
* Pull Requests
* Milestones
* Releases

También deberá establecerse el flujo de trabajo de Git que utilizará el equipo.

---

# Git

El repositorio utilizará Git para control de versiones.

Todavía deberán definirse las reglas internas del equipo relacionadas con:

* Creación de ramas
* Pull Requests
* Revisiones
* Convención de commits
* Integración hacia `main`
* Resolución de conflictos

---

# Variables de entorno y seguridad

Las credenciales y datos sensibles no deberán almacenarse directamente dentro del repositorio.

Dependiendo de las tecnologías seleccionadas posteriormente se podrán utilizar archivos como:

```text
.env
.env.local
```

Estos deberán permanecer fuera del control de versiones.

También podrá crearse un archivo:

```text
.env.example
```

que contenga únicamente los nombres de las variables necesarias, sin incluir información sensible.

---

# Estado actual del proyecto

## Confirmado

Actualmente se encuentra confirmado:

* Nombre oficial: **CouchOne Fit**.
* Proyecto Integrador Sep–Dic 2026.
* Participación principal de Web Integral.
* Participación principal de Móvil Integral.
* Existirá una aplicación Web/PWA.
* Existirá una aplicación Android.
* Existirá un Backend/API central.
* Se utilizará un **monorepo**.
* El equipo estará conformado por:

  * **Maythe Francella Balleza Solis**
  * **Ángel Fernando Oñate Reyes**
  * **Itzel Yutzil Sánchez López**
* Arquitectura Backend:

  * **Feature-Based + Layered Architecture**
* Arquitectura Web/PWA:

  * **Feature-Based + Component-Based Architecture**
* Arquitectura móvil:

  * **Feature-Based + Component-Based Architecture**
* Metodología de desarrollo:

  * **Scrum**
* Se realizará una fase inicial para conocer el producto y recopilar requerimientos.
* El **Sprint 1** estará enfocado en la definición del proyecto.
* El repositorio estará dividido inicialmente en:

```text
apps/web
apps/android
apps/api
docs
```

---

## Por definir por el equipo

Antes de comenzar el desarrollo completo, el equipo todavía deberá definir:

* Alcance funcional.
* Problemática definitiva.
* Objetivo específico.
* Tipos de usuario.
* Roles.
* Funciones de cada usuario.
* Funciones de la aplicación Web.
* Funciones de la aplicación Android.
* Funciones del Backend.
* Tecnología Web.
* Tecnología Android.
* Tecnología Backend.
* Tipo de API.
* Base de datos.
* Modelo de datos.
* Autenticación.
* Autorización.
* Hosting.
* Despliegue.
* Servicios externos.
* Diseño visual.
* Gestión del estado.
* Manejo de archivos.
* Flujo de trabajo con Git.
* Convención de commits.
* Estrategia de pruebas.
* Integración de una posible tercera materia.
* Requerimientos adicionales solicitados por los profesores.

---

# Principios iniciales

Aunque varias decisiones todavía están pendientes, el equipo buscará mantener los siguientes principios durante el desarrollo:

1. Mantener todo el proyecto organizado dentro del mismo repositorio.
2. Separar claramente Web, Android y Backend.
3. Organizar cada aplicación principalmente por funcionalidades.
4. Mantener una separación clara de responsabilidades dentro de cada aplicación.
5. Documentar las decisiones importantes antes de implementarlas.
6. Evitar asumir funcionalidades que todavía no hayan sido aprobadas.
7. Mantener sincronizados los requerimientos con el desarrollo.
8. Evitar duplicar innecesariamente lógica entre aplicaciones.
9. Mantener una estructura que permita trabajar a varios integrantes sin mezclar responsabilidades.
10. Ajustar la arquitectura al alcance real del proyecto.
11. Evitar agregar complejidad técnica que no sea necesaria.
12. Mantener el proyecto alineado con los requerimientos de las materias involucradas.

---

# Nombre del proyecto

El nombre oficial del proyecto es:

# **CouchOne Fit**

Este nombre será utilizado para identificar el proyecto durante su desarrollo y documentación correspondiente al Proyecto Integrador Septiembre–Diciembre 2026.
