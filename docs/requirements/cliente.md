# Requerimientos del Cliente (RC / RDC)

> **Fuente oficial:** [REQUERIMIENTOS - COUCHONEFIT (Hoja V2)](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289)  
> **Regresar al índice general:** [README de Requerimientos](README.md)

Requerimientos orientados a la aplicación móvil del cliente (atleta/usuario final), incluyendo activación mediante credenciales, consulta de planes y registro de progreso diario.

---

## `RC01`: Activación de cuenta del cliente

**Definición general:** El sistema deberá permitir que el profesional entregue al cliente un código de activación asociado previamente a un perfil ya registrado. Para activar su cuenta, el cliente deberá ingresar dicho código y crear sus credenciales de acceso, incluyendo usuario y contraseña. El cliente no deberá capturar nuevamente sus datos personales o físicos.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0101` | Generar código de activación | Al registrar al cliente, el profesional deberá generar o solicitar al sistema un código de activación asociado al perfil previamente creado. |
| `RDC0102` | Validar código | La aplicación del cliente deberá validar el código en el servidor durante el proceso de activación, antes de permitir la vinculación de la cuenta con el perfil correspondiente. |
| `RDC0103` | Vincular cuenta con perfil existente | Después de validar el código, el sistema deberá vincular las credenciales creadas por el cliente con el perfil y expediente que previamente registró el profesional. |
| `RDC0104` | Crear credenciales de acceso | El sistema deberá permitir al cliente crear un nombre de usuario y una contraseña durante el proceso de activación de su cuenta. |
| `RDC0105` | Modificar credenciales de acceso | El sistema deberá permitir al cliente modificar posteriormente su nombre de usuario y contraseña desde la configuración de su cuenta, de acuerdo con las reglas de seguridad establecidas. |
| `RDC0106` | Impedir reutilización del código | Un código utilizado correctamente deberá quedar invalidado o marcado como utilizado para impedir su reutilización no autorizada. |

---

## `RC02`: Visualización del perfil del cliente

**Definición general:** Al activar su acceso, el cliente deberá visualizar los datos que el profesional previamente registró en su perfil. El cliente no será responsable de capturar dichos datos.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0201` | Consultar datos personales | Permitirá al cliente visualizar sus datos personales previamente registrados por el profesional. |
| `RDC0202` | Consultar datos físicos | Permitirá al cliente visualizar sus datos físicos previamente registrados por el profesional, de acuerdo con los permisos definidos. |
| `RDC0203` | Consultar objetivo | Permitirá al cliente visualizar el objetivo de seguimiento registrado por el profesional. |
| `RDC0204` | Consultar información de progreso | Permitirá al cliente visualizar la información de progreso que el profesional haya puesto a su disposición. |

---

## `RC03`: Inicio del cliente

**Definición general:** La aplicación móvil deberá mostrar al cliente un resumen de su día con la información que el profesional haya configurado para su perfil.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0301` | Mostrar entrenamiento del día | Indicará el entrenamiento programado para el día, cuando exista. |
| `RDC0302` | Mostrar alimentación del día | Mostrará la información correspondiente al plan de alimentación activo. |
| `RDC0303` | Mostrar estado de seguimiento | Indicará la información de seguimiento que corresponda al día. |

---

## `RC04`: Plan de alimentación móvil

**Definición general:** La aplicación móvil deberá permitir al cliente consultar el plan de alimentación que previamente configuró y asignó el profesional.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0401` | Consultar plan activo | Mostrará únicamente el plan de alimentación activo asignado al cliente. |
| `RDC0402` | Consultar comidas | Mostrará las comidas y alimentos definidos por el profesional. |
| `RDC0403` | Consultar cantidades e instrucciones | Mostrará las cantidades e instrucciones registradas por el profesional. |

---

## `RC05`: Entrenamiento móvil

**Definición general:** La aplicación móvil deberá permitir al cliente consultar la rutina activa previamente configurada y asignada por el profesional.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0501` | Consultar rutina activa | Mostrará la rutina de entrenamiento asignada por el profesional. |
| `RDC0502` | Consultar programación | Indicará los días de entrenamiento y descanso configurados. |
| `RDC0503` | Consultar ejercicios | Mostrará los ejercicios definidos para cada sesión. |
| `RDC0504` | Consultar parámetros prescritos | Mostrará series, repeticiones, intensidad e instrucciones definidas por el profesional. |
| `RDC0505` | Registrar ejecución del entrenamiento | Permitirá registrar el cumplimiento o realización de la sesión conforme a las opciones definidas por el sistema, sin modificar la prescripción realizada por el profesional. |

---

## `RC06`: Check-in diario

**Definición general:** La aplicación móvil deberá permitir al cliente registrar únicamente la información diaria de seguimiento que el sistema requiera, mientras que los datos base del perfil y expediente permanecerán bajo control del profesional.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0601` | Registrar check-in | Permitirá registrar el check-in correspondiente a la fecha. |
| `RDC0602` | Registrar sueño | Permitirá registrar información diaria de sueño cuando el check-in contemple este dato. |
| `RDC0603` | Registrar estrés y energía | Permitirá indicar los valores diarios correspondientes cuando formen parte del check-in. |
| `RDC0604` | Registrar cumplimiento | Permitirá registrar el cumplimiento diario de alimentación y entrenamiento mediante las opciones definidas por el sistema. |
| `RDC0605` | Agregar comentario de seguimiento | Permitirá agregar comentarios al check-in cuando esta función sea requerida. |

---

## `RC07`: Consulta del historial del cliente

**Definición general:** El cliente podrá consultar la información histórica que el sistema haya habilitado para su visualización. Los registros base del expediente y los planes serán administrados por el profesional.

### Requerimientos detallados

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RDC0701` | Consultar historial propio | Permitirá consultar el historial disponible asociado a su perfil. |
| `RDC0702` | Consultar evolución | Permitirá visualizar la evolución registrada y autorizada por el profesional. |

