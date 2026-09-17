# Proyecto Integrador

> **Nombre del proyecto:** Por definir
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

Integrantes confirmados hasta el momento:

* **Maythe Francella Balleza Solis**
* **Ángel Fernando Oñate Reyes**
* **Itzel Yutzil Sánchez López**

El equipo todavía puede incorporar algún integrante adicional.

---

# Objetivo general

Desarrollar una plataforma que permita integrar una aplicación web y una aplicación móvil Android dentro de un mismo sistema.

Actualmente se contempla que ambas aplicaciones trabajen con información relacionada con entrenamiento, seguimiento y gestión de usuarios, aunque las funciones específicas deberán ser definidas y aprobadas posteriormente por el equipo.

---

# Estructura del repositorio

La decisión técnica confirmada hasta el momento es utilizar un **monorepo**, permitiendo mantener dentro del mismo repositorio los diferentes componentes del proyecto.

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

La tecnología específica todavía deberá ser definida por el equipo.

Opciones que podrán evaluarse posteriormente incluyen:

* React
* TypeScript
* Otras tecnologías compatibles con los requerimientos de la materia

La arquitectura interna, manejo de estado, librerías y organización definitiva del proyecto también se encuentran pendientes de definición.

---

## `apps/android`

Contendrá la aplicación correspondiente a **Móvil Integral**.

La aplicación deberá ejecutarse en Android.

Todavía deberá definirse por el equipo:

* Lenguaje principal
* Arquitectura
* Librerías
* Manejo de datos
* Comunicación con el backend
* Navegación
* Persistencia local
* Requerimientos específicos de la materia

Actualmente se contempla evaluar Kotlin como tecnología principal, pero todavía no se considera una decisión definitiva.

---

## `apps/api`

Este directorio está reservado para el backend o API que permita comunicar las aplicaciones del sistema.

La decisión de utilizar una API central está contemplada dentro de la estructura inicial, pero su implementación definitiva deberá ser definida por el equipo.

Todavía deberá determinarse:

* Tecnología del backend
* Framework
* Arquitectura
* Tipo de API
* Autenticación
* Autorización
* Validaciones
* Manejo de errores
* Comunicación con la base de datos
* Forma de despliegue

---

# Arquitectura

La arquitectura definitiva del sistema **todavía no ha sido definida por el equipo**.

De manera preliminar, el repositorio contempla tres aplicaciones principales:

```text
Proyecto Integrador
│
├── Web
├── Android
└── API
```

La forma en la que estas aplicaciones se comunicarán y organizarán internamente deberá discutirse y aprobarse posteriormente.

Dentro de las opciones que podrán evaluarse se encuentran:

* API REST
* Backend centralizado
* Arquitectura por módulos
* MVVM para Android
* Arquitectura basada en funcionalidades para Web

Estas alternativas todavía no representan decisiones definitivas.

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

Todavía se debe definir formalmente cómo se comunicarán Web, Android y Backend.

Una posibilidad a evaluar es utilizar una API centralizada accesible mediante internet:

```text
Web ───────┐
           │
           ▼
          API
           ▲
           │
Android ───┘
```

Esta propuesta permitiría que Web y Android trabajen con la misma información sin depender de encontrarse conectados a una misma red local.

Sin embargo, el mecanismo definitivo deberá ser aprobado por el equipo.

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

Contendrá la documentación relacionada con la comunicación entre aplicaciones y, si se decide utilizar una API, sus endpoints y contratos.

---

# Metodología de trabajo

La metodología de desarrollo todavía deberá ser definida por el equipo.

Se podrán evaluar alternativas como:

* Scrum
* Kanban
* Metodología híbrida
* Otra metodología solicitada por alguna de las materias

La decisión deberá considerar:

* Número de integrantes
* Duración del cuatrimestre
* Entregables
* Requerimientos de los profesores
* Forma de organizar tareas
* Frecuencia de entregas

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

* Proyecto Integrador Sep–Dic 2026.
* Participación principal de Web Integral.
* Participación principal de Móvil Integral.
* Existirá una aplicación Web.
* Existirá una aplicación Android.
* Se utilizará un **monorepo**.
* El repositorio estará dividido inicialmente en:

```text
apps/web
apps/android
apps/api
docs
```

* El nombre oficial del proyecto todavía no ha sido definido.

---

## Por definir por el equipo

Antes de comenzar el desarrollo completo, el equipo deberá definir:

* Nombre oficial del proyecto.
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
* Arquitectura Web.
* Arquitectura Android.
* Arquitectura Backend.
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
* Metodología de desarrollo.
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
3. Documentar las decisiones importantes antes de implementarlas.
4. Evitar asumir funcionalidades que todavía no hayan sido aprobadas.
5. Mantener sincronizados los requerimientos con el desarrollo.
6. Evitar duplicar innecesariamente lógica entre aplicaciones.
7. Mantener una estructura que permita trabajar a varios integrantes sin mezclar responsabilidades.
8. Ajustar la arquitectura al alcance real del proyecto.
9. Evitar agregar complejidad técnica que no sea necesaria.
10. Mantener el proyecto alineado con los requerimientos de las materias involucradas.

---

# Nombre del proyecto

El nombre definitivo todavía se encuentra **por definir por el equipo**.

Cualquier nombre utilizado durante la fase inicial deberá considerarse únicamente temporal.
