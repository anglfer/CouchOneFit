# Requerimientos del Sistema Interno (RF / RDF)

> **Fuente oficial:** [REQUERIMIENTOS - COUCHONEFIT (Hoja V2)](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289)  
> **Regresar al índice general:** [README de Requerimientos](README.md)

Requerimientos funcionales orientados al profesional (entrenador/nutriólogo) y al panel de administración central de la plataforma CouchOne Fit.

---

## `RF01`: Autenticación del profesional

**Definición general:** El sistema deberá permitir al profesional iniciar sesión mediante credenciales válidas y, antes de conceder acceso, validar la identidad de la cuenta profesional y establecer una sesión autenticada.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0101` | Iniciar sesión | Permitirá ingresar las credenciales requeridas y acceder únicamente cuando la autenticación sea válida. |
| `RDF0102` | Identificar cuenta profesional | Después de una autenticación válida, el sistema deberá identificar de forma inequívoca la cuenta profesional que ejecutará las operaciones. |
| `RDF0103` | Cerrar sesión | Permitirá al profesional finalizar su sesión y deberá invalidar las credenciales o tokens de sesión correspondientes. |

---

## `RF02`: Dashboard del profesional

**Definición general:** El sistema deberá proporcionar un panel que permita al profesional consultar rápidamente el estado de sus clientes y los principales indicadores de seguimiento.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0201` | Consultar clientes activos | Mostrará el número de clientes activos asociados a la cuenta profesional. |
| `RDF0202` | Consultar capacidad disponible | Mostrará la cantidad de clientes que aún puede administrar el profesional de acuerdo con el límite de su plan. |
| `RDF0203` | Consultar check-ins recientes | Mostrará clientes que hayan realizado seguimiento recientemente. |
| `RDF0204` | Consultar check-ins pendientes | Mostrará clientes que tengan seguimiento pendiente de acuerdo con la información disponible. |
| `RDF0205` | Consultar indicadores de seguimiento | Permitirá acceder a información relacionada con evolución, entrenamiento y adherencia alimenticia de los clientes. |

---

## `RF03`: Gestión de clientes

**Definición general:** El sistema deberá permitir al profesional registrar, consultar, buscar, modificar y administrar el estado de sus clientes, conservando su historial cuando sean inactivados.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0301` | Registrar cliente | Permitirá crear un expediente individual para un nuevo cliente y asociarlo con la cuenta del profesional que lo registra. |
| `RDF0302` | Consultar listado de clientes | Mostrará los clientes asociados al profesional y su estado activo o inactivo. |
| `RDF0303` | Buscar cliente | Permitirá localizar clientes mediante los datos disponibles en su expediente. |
| `RDF0304` | Modificar cliente | Permitirá actualizar la información del expediente del cliente sin eliminar su historial. |
| `RDF0305` | Activar o inactivar cliente | Permitirá cambiar el estado operativo del cliente. La inactivación no deberá eliminar su información histórica. |
| `RDF0306` | Registrar datos del cliente | El profesional deberá capturar y mantener los datos personales y de perfil del cliente antes de entregar el código de activación. El cliente no deberá capturar nuevamente estos datos. |
| `RDF0307` | Generar acceso al perfil existente | El sistema deberá generar el mecanismo de acceso para que el código entregado al cliente abra el perfil previamente registrado, sin crear un segundo expediente. |

---

## `RF04`: Expediente del cliente

**Definición general:** Cada cliente deberá contar con un expediente individual donde se concentre su información personal, física, planes y evolución.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0401` | Registrar datos personales y físicos | Permitirá registrar nombre, fecha de nacimiento o edad, estatura, peso y otros datos definidos para el seguimiento. |
| `RDF0402` | Registrar medidas corporales | Permitirá registrar cintura, cadera, otras medidas y porcentaje de grasa cuando se disponga de ellos. |
| `RDF0403` | Registrar objetivo | Permitirá registrar el objetivo de seguimiento definido para el cliente. |
| `RDF0404` | Consultar expediente consolidado | Permitirá consultar desde el perfil del cliente su información, planes, evaluaciones y evolución. |

---

## `RF05`: Evaluaciones antropométricas

**Definición general:** El sistema deberá permitir registrar evaluaciones físicas fechadas y conservar sus resultados dentro del historial del cliente.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0501` | Registrar evaluación | Permitirá crear una evaluación asociada a un cliente y registrar automáticamente la fecha correspondiente. |
| `RDF0502` | Registrar peso y medidas | Permitirá capturar peso y medidas corporales de la evaluación. |
| `RDF0503` | Registrar pliegues cutáneos | Permitirá registrar mediciones de pliegues cutáneos cuando el profesional las utilice. |
| `RDF0504` | Calcular grasa estimada | Podrá calcular un porcentaje estimado de grasa corporal a partir de los datos ingresados mediante una fórmula definida por el sistema. |
| `RDF0505` | Consultar evolución antropométrica | Permitirá consultar las evaluaciones anteriores y observar cambios a través del tiempo. |

---

## `RF06`: Plan de alimentación

**Definición general:** El sistema deberá permitir al profesional crear, modificar, versionar y activar planes de alimentación para sus clientes.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0601` | Crear plan de alimentación | Permitirá crear un plan asociado a un cliente y definir la estructura de comidas del día. |
| `RDF0602` | Configurar comidas | Permitirá definir la cantidad de comidas y los alimentos o preparaciones incluidos en cada una. |
| `RDF0603` | Definir cantidades | Permitirá establecer las cantidades correspondientes a cada alimento o preparación. |
| `RDF0604` | Definir objetivos nutricionales | Permitirá definir calorías y distribución de macronutrientes cuando el profesional lo requiera. |
| `RDF0605` | Generar sugerencia nutricional | Podrá generar una sugerencia inicial de calorías o macronutrientes usando la información registrada del cliente. |
| `RDF0606` | Revisar y modificar sugerencia | La sugerencia generada deberá requerir revisión del profesional y podrá ser modificada antes de asignarse. |
| `RDF0607` | Guardar versión del plan | Cada nueva planificación deberá conservar las versiones anteriores sin eliminar el historial. |
| `RDF0608` | Activar plan | Permitirá al profesional activar un plan para hacerlo visible al cliente en la aplicación móvil. |

---

## `RF07`: Plan de entrenamiento

**Definición general:** El sistema deberá permitir al profesional crear, modificar y activar rutinas de entrenamiento asociadas a cada cliente.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0701` | Crear rutina | Permitirá crear una rutina para un cliente y establecer su programación. |
| `RDF0702` | Configurar días | Permitirá determinar días de entrenamiento y días de descanso. |
| `RDF0703` | Agregar ejercicios | Permitirá agregar uno o varios ejercicios a cada día de entrenamiento. |
| `RDF0704` | Configurar series y repeticiones | Permitirá definir el número de series y las repeticiones objetivo de cada ejercicio. |
| `RDF0705` | Configurar intensidad e instrucciones | Permitirá especificar parámetros de intensidad e instrucciones adicionales para cada ejercicio. |
| `RDF0706` | Modificar rutina | Permitirá modificar posteriormente una rutina conservando el historial de versiones anteriores. |
| `RDF0707` | Activar rutina | La versión activa será la que el cliente pueda consultar desde la aplicación móvil. |

---

## `RF08`: Seguimiento del cliente

**Definición general:** El sistema deberá permitir al profesional consultar de forma histórica el progreso, adherencia y registros realizados por cada cliente.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0801` | Consultar check-ins | Permitirá consultar los check-ins registrados por el cliente. |
| `RDF0802` | Consultar peso | Permitirá consultar los registros históricos de peso. |
| `RDF0803` | Consultar adherencia alimenticia | Permitirá consultar los registros utilizados para determinar la adherencia al plan de alimentación. |
| `RDF0804` | Consultar adherencia al entrenamiento | Permitirá consultar el cumplimiento de las rutinas y sesiones registradas. |
| `RDF0805` | Consultar sueño y estrés | Permitirá consultar los indicadores de sueño, estrés, energía u otros que hayan sido registrados. |
| `RDF0807` | Consultar evolución histórica | Presentará información histórica para identificar cambios del cliente a través del tiempo. |

---

## `RF09`: Gestión de planes y suscripciones SaaS

**Definición general:** El sistema deberá controlar los planes de contratación y la capacidad máxima de clientes activos permitida a cada profesional.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF0901` | Consultar plan contratado | Permitirá identificar el plan asociado a cada cuenta profesional. |
| `RDF0902` | Controlar capacidad | El sistema deberá impedir que un profesional mantenga más clientes activos de los permitidos por su plan. |
| `RDF0903` | Activar o suspender suscripción | El administrador podrá modificar el estado de la suscripción de un profesional. |
| `RDF0904` | Administrar planes | El administrador podrá administrar los planes disponibles y sus límites. |

---

## `RF10`: Panel administrativo

**Definición general:** El administrador deberá contar con funciones específicas para administrar profesionales, planes y suscripciones de CouchOne Fit.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDF1001` | Consultar profesionales | Permitirá consultar los profesionales registrados en la plataforma. |
| `RDF1002` | Consultar clientes por profesional | Permitirá conocer cuántos clientes utiliza cada cuenta profesional. |
| `RDF1003` | Gestionar suscripciones | Permitirá activar, suspender o modificar una suscripción. |
| `RDF1004` | Separar funciones administrativas | El administrador no deberá utilizar las funciones normales del entrenador como si fueran clientes propios. |

