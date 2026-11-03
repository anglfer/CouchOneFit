# Requerimientos No Funcionales (RNF)

> **Fuente oficial:** [REQUERIMIENTOS - COUCHONEFIT (Hoja V2)](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289)  
> **Regresar al índice general:** [README de Requerimientos](README.md)

Requisitos de arquitectura, rendimiento, disponibilidad, usabilidad, mantenibilidad y calidad técnica de la solución CouchOne Fit.

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RNF01` | Arquitectura centralizada | La aplicación web profesional y la aplicación móvil del cliente deberán consumir un backend centralizado y utilizar el mismo origen de información. |
| `RNF02` | API del sistema | El backend deberá exponer una API para las funcionalidades que requieran comunicación entre las aplicaciones y el servidor. |
| `RNF03` | PWA | La aplicación web orientada al profesional deberá desarrollarse como PWA y ser instalable en dispositivos compatibles. |
| `RNF04` | Diseño responsive | La PWA deberá adaptarse correctamente a computadoras, tablets y dispositivos móviles. |
| `RNF05` | Autenticación y autorización por roles | La arquitectura deberá soportar autenticación y autorización diferenciando, como mínimo, administrador, profesional y cliente. |
| `RNF06` | Aislamiento lógico de datos | La arquitectura deberá mantener aislados lógicamente los datos pertenecientes a cada profesional. |
| `RNF07` | Persistencia histórica | El sistema deberá conservar el historial necesario para realizar seguimiento longitudinal del cliente. |
| `RNF08` | Escalabilidad modular | La arquitectura deberá permitir incorporar nuevas herramientas para el profesional sin modificar completamente el sistema existente. |
| `RNF09` | Rendimiento | Las operaciones habituales deberán ejecutarse dentro de tiempos de respuesta aceptables bajo la carga definida para el proyecto. El documento fuente no establece todavía un umbral numérico; este deberá definirse y validarse durante las pruebas. |
| `RNF10` | Disponibilidad | La plataforma deberá permanecer disponible de acuerdo con el nivel de servicio definido para el proyecto y deberá contemplar mantenimiento controlado. |
| `RNF11` | Usabilidad | Las funciones principales deberán poder ejecutarse mediante una interfaz clara, consistente y comprensible para profesionales y clientes. |
| `RNF12` | Compatibilidad multiplataforma | El sitio comercial y la PWA deberán funcionar en los dispositivos y navegadores compatibles definidos para el proyecto, manteniendo una presentación responsive. |
| `RNF13` | Consistencia de datos | Las operaciones realizadas desde web o móvil deberán mantener consistencia entre la información mostrada y la almacenada en el backend. |
| `RNF14` | Mantenibilidad | El sistema deberá estar organizado de forma modular para facilitar correcciones, mantenimiento y ampliaciones posteriores. |
| `RNF15` | Manejo de errores | Los errores deberán gestionarse de forma controlada, mostrando al usuario mensajes comprensibles sin exponer detalles técnicos internos. |
| `RNF16` | Configuración por entorno | Las configuraciones específicas de desarrollo, pruebas y producción deberán mantenerse separadas y las variables sensibles no deberán formar parte del código fuente. |
| `RNF17` | Respaldo y recuperación | La solución deberá contemplar mecanismos de respaldo y recuperación de la información almacenada. La frecuencia y tiempo objetivo de recuperación deberán definirse como parte del despliegue. |
| `RNF18` | Integridad de registros históricos | Las modificaciones de planes, rutinas, evaluaciones y seguimientos no deberán provocar pérdida de información histórica requerida por el sistema. |
| `RNF19` | Internacionalización inicial | La interfaz del sistema deberá utilizar el idioma español, de acuerdo con el alcance actual de CouchOne Fit. |
| `RNF20` | Evolución del producto | La solución deberá poder extenderse posteriormente con funcionalidades como pagos recurrentes, notificaciones avanzadas, chat, integraciones de salud o wearables sin reconstruir completamente el sistema. |

> **Propuestos el 3 de noviembre de 2026** por instrucción de la persona responsable del producto en chat (decisión [DEC-018](../../plan/PLAN_TRABAJO_V2.md)). No están en la hoja fuente: deben añadirse allí y aprobarse. Detalle y alcance en [PWA con uso sin conexión](../architecture/pwa-offline.md).

| ID | Requerimiento | Descripción |
| :--- | :--- | :--- |
| `RNF21` | Uso sin conexión | La PWA del profesional deberá abrir y poder usarse sin conexión a internet en casi toda su funcionalidad, la actual y la de cada módulo futuro: consultar la información ya vista y registrar cambios que se conservarán y se sincronizarán al volver la conexión. Solo requieren conexión las acciones de autenticación, secretos de un solo uso (invitaciones y códigos), pagos y suscripción, alta/baja de cuentas y las acciones auditadas de administración. |
| `RNF22` | Sincronización segura | Los cambios hechos sin conexión se enviarán sin duplicarse ni sobrescribir en silencio cambios más recientes del servidor. Nunca se mostrará como guardado algo que el servidor no confirmó, y la persona verá siempre qué está pendiente, fallido o en conflicto. |
| `RNF23` | Privacidad de los datos locales | Los datos guardados en el dispositivo para el uso sin conexión se cifrarán, caducarán y se borrarán al cerrar sesión o cambiar de cuenta. No se guardarán localmente contraseñas, tokens, códigos de invitación ni de recuperación. |
| `RNF24` | Consulta sin conexión en móvil | La aplicación móvil del cliente deberá permitir consultar sin conexión su plan de entrenamiento, su plan de alimentación, su historial de pesos y su perfil, mostrando la antigüedad de los datos y sin permitir registros que el servidor no confirme. |
