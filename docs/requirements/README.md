# Requerimientos de CouchOne Fit

## Fuente oficial de requerimientos

- **Documento vigente:** [REQUERIMIENTOS - COUCHONEFIT](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289).
- **Ubicación:** Google Sheets, hoja `V2` (con historial previo en hoja `V1`).
- **Estado:** fuente oficial vigente del catálogo de requerimientos. No se conservan copias Excel en este repositorio.
- **Última actualización de esta nota:** 28 de septiembre de 2026.

Esta carpeta organiza los requerimientos en documentos modulares por categoría y registra los acuerdos complementarios del equipo sobre baja de cuentas, registro del cliente y decisiones pendientes.

---

## Catálogo modular de requerimientos

Para facilitar la lectura y evitar mezclas, el catálogo oficial se encuentra dividido en los siguientes módulos:

| Documento | Prefijos | Alcance |
| :--- | :--- | :--- |
| **[1. Requerimientos del Sistema Interno](sistema-interno.md)** | `RF01`–`RF10`<br>`RDF0101`–`RDF1004` | Funcionalidades para el profesional (entrenador/nutriólogo) y el panel de administración central: expedientes, antropometría, planes de alimentación, rutinas, seguimiento y suscripciones SaaS. |
| **[2. Requerimientos del Cliente](cliente.md)** | `RC01`–`RC07`<br>`RDC0101`–`RDC0702` | Funcionalidades de la aplicación móvil del cliente (atleta): activación con credenciales, visualización de expediente, consulta de planes y registro diario de check-ins. |
| **[3. Requerimientos No Funcionales](no-funcionales.md)** | `RNF01`–`RNF20` | Estándares de arquitectura centralizada, PWA, adaptabilidad responsive, consistencia de datos, rendimiento y mantenibilidad. |
| **[4. Requerimientos de Seguridad](seguridad.md)** | `RS01`–`RS24` | Control de acceso por roles, aislamiento entre profesionales, hashing de contraseñas, ciclo de vida de sesiones y uso único de códigos. |

---

## Acuerdo confirmado: baja lógica de cuentas

**Referencias relacionadas:** `RF03` y `RDF0305` (inactivación de clientes), `RDF0903` y `RDF1003` (gestión de suscripciones).

La aclaración del 28 de septiembre de 2026 establece que el borrado de cuentas será lógico, no permanente. La regla no se limita a las cuentas de profesionales.

- La baja cambiará el estado de la cuenta sin eliminar físicamente sus datos ni el historial asociado.
- Este acuerdo no establece conservación indefinida, un plazo de retención ni entrega de una copia de los datos al profesional.
- La suspensión de una suscripción y la baja de una cuenta son operaciones distintas. Sigue pendiente precisar su relación y el efecto sobre los permisos de acceso del profesional y sus clientes.

La conservación del historial del cliente también está contemplada por `RF03` y `RDF0305`.

---

## Acuerdo confirmado: registro y acceso del cliente

**Referencias afectadas:** `RDF0306`, `RDF0307`, `RC01` y `RDC0101`–`RDC0106`. Se mantienen los requisitos de protección de credenciales y sesiones (`RS05`, `RS06`, `RS07`, `RS08`).

El flujo distingue dos partes: **crear la cuenta de acceso** y **acceder al expediente previamente registrado por el profesional**. No se trata de autenticación de dos factores ni de acceso únicamente mediante código.

### 1. Crear la cuenta y asociarla al profesional

El cliente completa un formulario básico con los siguientes campos obligatorios:

- Usuario.
- Contraseña y confirmación de contraseña.
- Correo electrónico y confirmación de correo electrónico.
- Código de referido o código del profesional: un único campo que recibe un código individual de vinculación, válido para un solo registro, no un código compartido reutilizable.

Las confirmaciones deben coincidir con sus respectivos campos. La confirmación de correo se refiere aquí al campo repetido del formulario; no se ha definido una verificación mediante enlace o código enviado por correo.

El servidor debe validar el código y la asociación con el profesional antes de completar el registro. Sin código, con un código inválido o sin poder asociar un profesional, el sistema no permitirá registrar la cuenta. El código es obligatorio, pero no sustituye los demás campos ni sus validaciones.

### 2. Acceder al expediente existente

El profesional registra previamente el expediente: nombre, peso y demás datos personales, físicos y parámetros necesarios para seguir el progreso del cliente (`RDF0306`).

Tras completar correctamente el registro y la vinculación, el sistema llevará al cliente directamente a su propio expediente, dentro de una sesión autenticada. El cliente no vuelve a capturar esos datos ni se crea un segundo expediente. La cuenta contiene las credenciales de acceso; el expediente contiene la información de seguimiento administrada por el profesional.

La vinculación debe identificar el expediente correcto, no únicamente al profesional. El código individual debe estar asociado en el servidor al profesional y al expediente preexistente que corresponden al cliente. No se debe permitir consultar expedientes de otros clientes.

### 3. Canjear el código una sola vez

El código es una invitación temporal para vincular la cuenta, no una credencial para iniciar sesión ni la relación permanente entre cliente y profesional.

1. El sistema genera un código individual asociado al profesional y al expediente previamente registrado.
2. El cliente proporciona el código junto con sus datos de registro. El servidor valida el formulario, el código y que el expediente pueda vincularse a esa cuenta.
3. Al completar el registro, el sistema guarda la relación entre la cuenta del cliente, su expediente y el profesional, y elimina el registro temporal del código.
4. Cualquier intento posterior de usar ese código debe rechazarse, incluso desde otra cuenta. Los accesos posteriores utilizan las credenciales del cliente y la relación guardada, sin volver a solicitar el código.

Crear la cuenta, guardar la vinculación y consumir el código deben completarse como una única operación: o se guardan todos esos cambios o no se aplica ninguno. Validar el código de forma preliminar no debe consumirlo; si falla el registro, no debe quedar una cuenta sin vincular ni perderse el código por ese fallo. Dos solicitudes simultáneas no deben poder canjearlo dos veces.

Después del canje no se conserva el código ni su registro temporal como parte de la relación. La eliminación del código consumido es distinta del borrado lógico de cuentas: se mantienen la cuenta, el expediente, su historial y la asociación con el profesional.

**Tecnología pendiente:** JWT se mencionó como una posibilidad, no como una decisión técnica. El requisito confirmado es la vinculación de un solo uso y su persistencia sin conservar el código consumido. El formato del token y su almacenamiento temporal se definirán durante el diseño técnico, separados del mecanismo de sesión.

### Accesos posteriores y relación con el documento vigente

La cuenta del cliente contará con usuario, correo y contraseña. En el Google Sheets vigente (`V2`), `RC01`, `RDC0104` y `RDC0105` formalizan la creación y modificación de usuario y contraseña; el acuerdo del equipo ratifica que el correo electrónico y sus confirmaciones forman parte obligatoria del formulario de registro. Queda pendiente precisar si el inicio de sesión aceptará usuario, correo o ambos como identificador, además de la duración, renovación y recuperación de sesión. Se mantienen expiración e invalidación de sesiones (`RS05`, `RS07`); no se acuerda una sesión permanente.

El documento vigente exige el código para validar la vinculación durante la activación (`RDC0102`), vincula las credenciales creadas con el perfil y expediente existentes (`RDC0103`), contempla la creación de credenciales (`RDC0104`), permite su modificación posterior (`RDC0105`) e impide reutilizar el código (`RDC0106`, `RS08`). Esta aclaración concreta esa opción: código individual de un solo uso, eliminado después del registro y la vinculación exitosos.

---

## Decisiones pendientes

| Tema | Definición que falta | Referencias |
| :--- | :--- | :--- |
| Retención de datos | Plazo y condiciones de conservación después de la baja lógica de cuentas; tratamiento posterior de los datos. | `RDF0305`, `RDF0903`, `RDF1003`, `RNF07`, `RS23` |
| Acceso durante la suspensión | Qué podrán consultar o modificar el profesional y sus clientes; condiciones de reactivación. | `RDF0903`, `RDF1003`, `RS01` |
| Entrega de datos al profesional | Si se ofrecerá exportación o copia al dar de baja. Los respaldos del sistema previstos en `RNF17` no definen esa entrega. | `RDF0903`, `RNF17` |
| Implementación del código individual | Formato y almacenamiento temporal del token, plazo de validez y procedimiento para reemplazar códigos vencidos o extraviados. El uso único y la relación con el profesional y el expediente ya están definidos. | `RDF0307`, `RC01`, `RDC0101`, `RDC0103`, `RDC0104`, `RDC0106`, `RS08` |
| Inicio de sesión y recuperación | Si se utilizará usuario, correo o ambos como identificador; duración y renovación de sesión, cierre de sesión y recuperación tras reinstalar o cambiar/perder el dispositivo. La existencia de correo y contraseña ya está confirmada. | `RC01`, `RS05`, `RS07` |
| Requisitos que no se implementarán | Identificar IDs, motivo y si se descartan o se posponen. Los mensajes compartidos no identifican ningún requisito concreto como descartado. | Por identificar |

---

## Actualizaciones del alcance

Para registrar un cambio acordado por el equipo, indicar el ID original, la decisión (modificado, descartado o pospuesto), el motivo y la fecha de confirmación. Conservar los IDs para mantener trazabilidad.

No se marca ningún requisito como descartado en esta actualización. El borrado lógico aclara el comportamiento de la baja; no elimina `RDF0903` ni `RDF1003` del alcance. El registro con credenciales y código obligatorio sustituye la duda anterior sobre acceso sin correo ni contraseña, sin duplicar el expediente del cliente.
