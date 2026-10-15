# Requerimientos de CouchOne Fit

## Fuente oficial de requerimientos

- **Documento vigente:** [REQUERIMIENTOS - COUCHONEFIT](https://docs.google.com/spreadsheets/d/16OH3_0umowtMeH30iO8FQ0PrUxi-f1PjxIDSh2fqzrQ/edit?pli=1&gid=1483946289#gid=1483946289).
- **Ubicación:** Google Sheets, hoja `V2` (con historial previo en hoja `V1`).
- **Estado:** fuente oficial vigente del catálogo de requerimientos. No se conservan copias Excel en este repositorio.
- **Última actualización documental:**14 de octubre de 2026; decisiones adoptadas por **delegación explícita usuario**, no ratificación/revisión equipo inferida ni implementación/certificación médica/legal. Acuerdo28-sept conservado como antecedente.

Esta carpeta conserva catálogo histórico V2 (139IDs) y acuerdos complementarios. Reglas actuales: [plan §3.3/3.4](../../PLAN_TRABAJO_V2.md); DEC-001–016 resueltas para demo académica no comercial exclusivamente sintética. No se reescriben IDs ni se afirma revisión remota del Sheets en esta edición.

---

## Catálogo modular de requerimientos

Para facilitar la lectura y evitar mezclas, el catálogo oficial se encuentra dividido en los siguientes módulos:

| Documento                                                       | Prefijos                             | Alcance                                                                                                                                                                                          |
| :-------------------------------------------------------------- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[1. Requerimientos del Sistema Interno](sistema-interno.md)** | `RF01`–`RF10`<br>`RDF0101`–`RDF1004` | Funcionalidades para el profesional (entrenador/nutriólogo) y el panel de administración central: expedientes, antropometría, planes de alimentación, rutinas, seguimiento y suscripciones SaaS. |
| **[2. Requerimientos del Cliente](cliente.md)**                 | `RC01`–`RC07`<br>`RDC0101`–`RDC0702` | Funcionalidades de la aplicación móvil del cliente (atleta): activación con credenciales, visualización de expediente, consulta de planes y registro diario de check-ins.                        |
| **[3. Requerimientos No Funcionales](no-funcionales.md)**       | `RNF01`–`RNF20`                      | Estándares de arquitectura centralizada, PWA, adaptabilidad responsive, consistencia de datos, rendimiento y mantenibilidad.                                                                     |
| **[4. Requerimientos de Seguridad](seguridad.md)**              | `RS01`–`RS24`                        | Control de acceso por roles, aislamiento entre profesionales, hashing de contraseñas, ciclo de vida de sesiones y uso único de códigos.                                                          |

---

## Acuerdo confirmado: baja lógica de cuentas

**Referencias relacionadas:** `RF03` y `RDF0305` (inactivación de clientes), `RDF0903` y `RDF1003` (gestión de suscripciones).

La aclaración del 28 de septiembre de 2026 establece que el borrado de cuentas será lógico, no permanente. La regla no se limita a las cuentas de profesionales.

- La baja cambiará el estado de la cuenta sin eliminar físicamente sus datos ni el historial asociado.
- Este acuerdo no establece conservación indefinida, un plazo de retención ni entrega de una copia de los datos al profesional.
- DEC-004 resuelta14-oct: suspensión, cuenta y expediente son estados distintos. Profesional activo sin plan/suspendido solo perfil/suscripción; inactivo no login/revoca sin cascada cliente. Cliente cuenta activa mantiene perfil/planes publicados/historial propio autorizado cuando profesional/sub/expediente bloqueados, sin nuevas escrituras check-in/peso/series. Cuenta cliente inactiva no login/revoca; profesional dueño debe dar baja explícita, no inferir de expediente inactivo. Admin no opera expedientes/último admin protegido.
- Reactivar expediente exige profesional/sub activos y cupo; cuenta reactivada no activa expediente automáticamente. Sin autoeliminaciónUI. Baja lógica conserva en ventana demo; dataset sintético/auditoría purga30d tras aceptación final, fixtures tras runs; backups expiran≤7d tras purga/restore reaplica manifest (DEC-011). No plazo legal para reales inventado.

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

**Tecnología resuelta DEC-002/003:** identidad propia API/PostgreSQL, JWT15min+sid/estadoBD cada request fail-closed, refresh hash rotativo absoluto30d desde login; logout/replay revoca servidor. Invitación distinta:32bytesCSPRNG/base64url43/hash SHA-256/TTL7d exactos, una pendiente/expediente, reemplazo/revocación transaccionales, entrega manual. Expediente activo ya reserva plaza; invitar/canjear no consume segunda. `pg` SQL parametrizado, conexión única/locks/cuenta+vínculo+aviso+DELETE temporal atómicos, sesión después COMMIT. Contratos/DDL aún TT-003/009, no implementados.

### Accesos posteriores y relación con el documento vigente

Cliente tiene usuario/correo/contraseña, confirmaciones obligatorias por campo (no SMTP). RC01/RDC0104/0105 conservados. Login usuario **o** correo; usuarioASCII `[a-z0-9._]`3–30 lower/trim sin@, correo lower/trim política app/unicidad índiceexpresión, password15–128Unicode sin trim/normalización/composición; Argon2id mínimo19MiB/t2/p1 sujeto benchmark. Supersede borrador8chars por acceso sinMFA. HU-009 recuperación asistida **incluida P1/3SP**, reset32bytes/hash/TTL30min/una vigencia/revoca todas, identidad fuera banda por relación conocida nunca correo/ID solo, sin cuenta/vínculo nuevo; profesional cliente propio/admin autorizado, último admin emergencia local controlada.

El documento vigente exige el código para validar la vinculación durante la activación (`RDC0102`), vincula las credenciales creadas con el perfil y expediente existentes (`RDC0103`), contempla la creación de credenciales (`RDC0104`), permite su modificación posterior (`RDC0105`) e impide reutilizar el código (`RDC0106`, `RS08`). Esta aclaración concreta esa opción: código individual de un solo uso, eliminado después del registro y la vinculación exitosos.

---

## Resoluciones vigentes — ninguna pregunta de producto pendiente

| Tema                 | Regla vigente14-oct / referencia plan                                                                                                                                                                                                                                                                                                                                           | Requisitos afectados                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Retención/entrega    | DEC-011 demo sintética30d tras aceptación, backups≤7d tras purga; sin exportación/transferencia/anominización automatizada, soporte asistido contacto conocido. Datos reales gate externo, no política legal inventada.                                                                                                                                                         | RDF0305/RDF0903/RDF1003/RNF07/17/RS23     |
| Estado/cupo          | DEC-004/005 matriz anterior; Básico10/Pro30/Élite ilimitado explícito/null, sin precios ni cobro real; portal permite pago simulado sin activar suscripción real. Admin cambio inmediato auditado; downgrade exceso bloquea solo nuevas altas/reactivaciones, activo reservado sigue prescripción/lectura/invitación.409CUPO_AGOTADO vs403PLAN_REQUIRED/SUBSCRIPTION_SUSPENDED. | RDF0901–04/RDF1003/RS01                   |
| Auth/transporte      | DEC-001/002: JWT/sid/BD/refresh/logout y reset asistido incluidos; Web `/api`proxy mismo origen Vercel→RenderHTTPS cookie host-only HttpOnly/Secure/SameSiteStrict, Origin+tokenCSRF/no-cache; móvilBearer secure store/directoRenderTLS.                                                                                                                                       | RC01/RS05–08/RS19                         |
| Captura              | DEC-006 diccionario completo §3.4: adultos18+ sintéticos/nacimiento requerido, selector método opcional no binario obligatorio, kg/cm/mm/horas/%; sueño0–24 paso0,5, peso diario opcional y al menos un campo real. RPE solo intensidad prescripción, nutrición manual sin conciliación automática.                                                                             | HU-015/017/021/024/028/031/032/037        |
| Fechas/adherencia    | DEC-008 zonaIANA cliente defaultAmerica/Mexico_City, snapshotUTC/local/zona, hoy/dos fechas locales anteriores (no48h), correcciónauditada/version409/idempotencia. Sesiónborrador/finalizada única porfecha/slot, todas series explícitas; adherencia observada con cobertura, ausente≠fallo/descansoexcluido, sin scoreglobal.                                                | RDC0505/RC06/RDF0801–05/0807              |
| Visibilidad          | DEC-009 flags porcliente defaultoff, historial no grantglobal; agregado200 omite/dedicado403, derivaciones no filtran entradas ocultas; revoca próxima consulta/no cache, no borra descargas. Perfilbase/planesactivos mantienen consulta.                                                                                                                                      | RDC0204/RC07/RS23                         |
| Fórmulas/excepciones | DEC-007 HU-023 incluida3SP JP3+Siri, gate **originales completos/fixtures** antesReady; no verificación fórmula completa desde abstracts. HU-025 pospuesta5SP excepciónRDF0605/0606, manualcontinúa; DEC-010 HU-038 fueraV2/nofotos8SP.                                                                                                                                         | RDF0504/0605/0606; sin IDs nuevos         |
| Aviso académico      | DEC-015 HU-041 incluida3SP: Omarredacta/Ferxxoproducto delegado; mismo avisoWeb/móvil versión/timestamp confirmado porprofesional/cliente antesprimeruso/altaatómica. Alias/emailsejemplo sinPIIreal, no atención médica ni certificación legal, no waiver.                                                                                                                     | HU-001/008/041/RS23                       |
| Entrega/operación    | DEC-012/013/014 APKAndroidfirmado/APImínima24 política gatebuild/emuladores24/36, noAAB/tiendas/iOS/Windowsnativo; warm/cold/backup/restore objetivosporprobar, disponibilidadobservada sinSLA99%/keepalive.                                                                                                                                                                    | RNF09/10/12/13/17; TT-008/013/015–018/021 |
| Calendario           | DEC-016 cuatroquincenas19-oct–13-dicTARGET, S0–S7incrementos; WIP1/reserva30%/horas×0,7sinSP→horas/review1-nov. Horas/fechaoficial/accesos/firma externosnoacreditados.                                                                                                                                                                                                         | §10/13plan                                |

Validaciones por ID y alternativas descartadas en §3.4 del plan. **Gates externos**, no elecciones V2: datos reales requieren jurisdicción/institución/responsable/política aprobada por competentes; confirmarhoras/fechaoficial, permisos/límitescloud/custodiafirma. No implementación, disponibilidad ni aceptación legal inferidas de este cierre documental.

---

## Actualizaciones del alcance

Para registrar un cambio acordado por el equipo, indicar el ID original, la decisión (modificado, descartado o pospuesto), el motivo y la fecha de confirmación. Conservar los IDs para mantener trazabilidad.

Histórico28-sept no descartaba IDs. Al14-oct se registra **RDF0605/0606 pospuestos por HU-025**, HU-038 fueraV2 sinfotos;139IDs conservados/41HU/21TT preservadas. HU-023/009/041 incluidas,271SP activos+13excluidos=284históricos. Baja lógica no eliminaRDF0903/RDF1003; credenciales+código/aviso no duplican expediente ni acreditan implementación.
