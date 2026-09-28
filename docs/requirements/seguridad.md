# Requerimientos de Seguridad (RS)

> **Fuente oficial:** [REQUERIMIENTOS - COUCHONEFIT (Hoja V2)](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289)  
> **Regresar al índice general:** [README de Requerimientos](README.md)

Estándares y requerimientos de seguridad, control de acceso por roles, protección de credenciales, tokens, validación y auditoría.

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RS01` | Control de acceso por rol | Las rutas, servicios y funcionalidades privadas deberán validar autenticación y autorización de acuerdo con el rol del usuario antes de permitir el acceso. |
| `RS02` | Aislamiento entre profesionales | Los datos pertenecientes a un profesional no deberán ser visibles ni modificables por otro profesional. |
| `RS04` | Autorización en backend | Las reglas de autorización deberán validarse en el backend independientemente de las restricciones mostradas en la interfaz. |
| `RS05` | Protección de rutas privadas | Las rutas privadas deberán requerir una sesión autenticada y permisos suficientes antes de devolver información. |
| `RS06` | Hash seguro de contraseñas | Las contraseñas deberán almacenarse mediante mecanismos seguros de hash y nunca en texto plano. |
| `RS07` | Gestión segura de sesiones | Las sesiones deberán utilizar mecanismos seguros de autenticación, expiración e invalidación al cerrar sesión o cuando corresponda. |
| `RS08` | Protección de códigos de activación | Los códigos de activación deberán ser únicos o suficientemente impredecibles, deberán validarse en el servidor y deberán expirar o quedar invalidados después de su uso. |
| `RS10` | Protección de información sensible | Los datos sensibles y secretos de configuración no deberán almacenarse en texto plano dentro del repositorio del proyecto. |
| `RS11` | Validación de entradas | El backend deberá validar y sanitizar los datos recibidos desde web y móvil antes de procesarlos o almacenarlos. |
| `RS12` | Prevención de inyección | Las operaciones de base de datos deberán utilizar consultas parametrizadas, ORM o mecanismos equivalentes para evitar inyección. |
| `RS14` | Protección de API | La API deberá validar autenticación, autorización y parámetros de entrada en cada operación protegida. |
| `RS15` | Protección contra abuso | Los servicios sensibles, incluyendo autenticación y activación de cuentas, deberán contar con controles de frecuencia o mecanismos equivalentes para reducir intentos automatizados y abuso. |
| `RS16` | Registro de eventos de seguridad | El sistema deberá registrar eventos relevantes de seguridad, como accesos inválidos, cambios de permisos, activaciones y operaciones administrativas críticas. |
| `RS17` | Manejo seguro de errores | Los errores mostrados al usuario no deberán exponer rutas internas, variables, credenciales, consultas, trazas o detalles de infraestructura. |
| `RS18` | Configuración segura | El entorno de producción no deberá utilizar configuraciones de depuración que expongan información interna del sistema. |
| `RS19` | Mínimo privilegio | Las cuentas de aplicación, base de datos y servicios deberán operar con únicamente los permisos necesarios para cumplir sus funciones. |
| `RS20` | Protección de comunicaciones | Las comunicaciones entre clientes web/móvil y el backend deberán utilizar canales seguros en los entornos donde se manejen datos reales. |
| `RS21` | Gestión de dependencias | Las dependencias del sistema deberán mantenerse identificadas y revisarse periódicamente para detectar vulnerabilidades conocidas. |
| `RS22` | Auditoría de acciones críticas | El sistema deberá permitir identificar, cuando corresponda, quién realizó una acción crítica, cuándo la realizó y qué operación o módulo fue afectado. |
| `RS23` | Privacidad de datos del cliente | La información personal, física, nutricional, de entrenamiento y seguimiento deberá tratarse como información privada y su acceso deberá limitarse según las funciones del sistema. |
| `RS24` | Separación del administrador | Las funciones administrativas de CouchOne Fit deberán mantenerse separadas de las funciones operativas del profesional y del cliente. |
