# CouchOne Fit — Frontend Web / PWA (`apps/web`)

Aplicación web desarrollada en **React 19 + TypeScript + Vite**.

En producción cumple dos propósitos con límites arquitectónicos definidos:

1. **Capa pública (`/`)**: Presentación de CouchOne Fit, catálogo de planes, registro y vista interactiva (sitio web estándar, sin PWA invasiva).
2. **Capa privada profesional / PWA (`/app/` o `/dashboard/`)**: Espacio de trabajo del entrenador o nutriólogo (expedientes, planes, seguimiento y check-ins) con capacidades de instalación PWA (`RNF03`, `RNF04`).

---

## Estado Actual de Implementación

| Módulo / Capa                        | Estado                      | Descripción técnica                                                                                                                                                                                   |
| :----------------------------------- | :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing público (`/`)**          | **Completado (v1)**         | Landing responsive, temática fija clara/blanca, narrativa guiada por `/docs`, showcase interactivo del producto (panel profesional + app cliente sincronizada) y diálogo de estado de acceso.         |
| **Enrutamiento base**                | **Funcional**               | `AppRoutes.tsx` incluye `/`, `/registro` y `/acceso` y guard de `/app/*`; rutas privadas desconocidas se resuelven después de comprobar sesión.                                                       |
| **Autenticación profesional**        | **Implementada localmente** | Registro y login por API/PostgreSQL; cookies protegidas, renovación serializada, revocación y perfil propio. Ver contrato HU-002.                                                                     |
| **Sistema interno / Dashboard**      | **Pendiente**               | HU-015/016/017 implementan localmente alta, cartera y edición de datos base con versión; recorrido HU-017 y revisión pendientes. Evaluaciones e integración completa del dashboard siguen pendientes. |
| **Planes de alimentación y rutinas** | **Pendiente**               | No existe el configurador ni la activación de planes.                                                                                                                                                 |
| **PWA acotada a la app privada**     | **Pendiente**               | El manifiesto y service worker deben delimitarse a `/app/` para no registrar PWA en la landing comercial.                                                                                             |

---

## Hoja de Ruta: Qué falta por implementar

### 1. Sistema Interno y Autenticación del Profesional (`RF01`, `RF02`, `RS01`, `RS05`, `RS07`)

- [x] **Módulo `features/auth/` — registro/acceso profesional**:
  - Pantalla y formulario de inicio de sesión (`/acceso`) para entrenadores y nutriólogos con validación de credenciales.
  - Cierre de sesión e invalidación de token (`RDF0103`).
  - Cookies HttpOnly de sesión y manejo de caducidad/refresh; sin tokens en almacenamiento Web.
  - Guardia de rutas (`PrivateRoute` / `AuthGuard`) para proteger todo el subárbol `/app/*`.
- [ ] **Dashboard del Profesional (`RF02`)**:
  - Resumen inicial: contador de clientes activos, capacidad disponible según el plan contratado (`RDF0201`, `RDF0202`).
  - Bandeja de check-ins recientes recibidos y pendientes de revisión (`RDF0203`, `RDF0204`).
- [ ] **Gestión de Clientes y Expedientes (`RF03`, `RF04`, `RF05`)**:
  - Listado, búsqueda y filtrado de clientes (activos/inactivos) con borrado lógico (`RDF0301`–`RDF0305`).
  - Captura y edición del expediente inicial (datos personales, objetivos, medidas corporales).
  - Generación del código individual de activación de un solo uso para vincular al cliente con su expediente preexistente (`RDF0306`, `RDF0307`, `RS08`).
  - Módulo de evaluaciones antropométricas fechadas: registro de peso, pliegues cutáneos, cálculo de grasa estimada y gráficos de evolución histórica (`RDF0501`–`RDF0505`).

---

### 2. Definición y Prescripción de Planes (`RF06`, `RF07`)

- [ ] **Planes de Alimentación (`RF06`)**:
  - Creador de planes nutricionales asociados a cada cliente: estructura de comidas del día (`RDF0601`).
  - Selector de alimentos, cantidades e instrucciones de preparación (`RDF0602`, `RDF0603`).
  - Objetivos de calorías y macronutrientes (`RDF0604`), sugerencias asistidas (`RDF0605`) y versionado histórico sin sobrescribir (`RDF0607`).
  - Acción de **activar plan** (`RDF0608`) para sincronizarlo hacia la app móvil del cliente.
- [ ] **Planes de Entrenamiento / Rutinas (`RF07`)**:
  - Creador de rutinas semanales: días de entrenamiento y días de descanso (`RDF0701`, `RDF0702`).
  - Asignación de ejercicios por día, series objetivo, repeticiones e intensidad/RPE (`RDF0703`–`RDF0705`).
  - Versionado de rutinas y acción de **activar rutina** para consumo en la aplicación móvil (`RDF0707`).
- [ ] **Seguimiento y Adherencia (`RF08`)**:
  - Visualización del histórico de check-ins diarios enviados por el cliente desde la app móvil (cumplimiento, sueño, estrés, energía y comentarios).

---

### 3. Delimitación de PWA para la zona privada (`RNF03`)

- [ ] **Acotación del Web App Manifest en `vite.config.ts`**:
  - Cambiar `scope: '/'` y `start_url: '/'` hacia `scope: '/app/'` y `start_url: '/app/'`.
  - Nombrar el acceso directo instalado como **CouchOne Fit Pro**.
- [ ] **Registro condicional del Service Worker**:
  - Mover `registerSW` desde `main.tsx` hacia el layout privado de la app o diferirlo a cuando el usuario inicie sesión, evitando que la landing de marketing se instale como PWA o guarde cachés agresivas innecesarias.

---

### 4. Qué falta dentro del Módulo de Marketing (`features/marketing`)

La versión actual de Marketing cubre completamente la narrativa de producto, la vista interactiva, la propuesta de valor y las preguntas frecuentes. Los elementos pendientes para futuras etapas son:

- [x] **CTA de registro:** «Contáctanos» → `/registro`; «Contratar plan» → `/registro?plan=basic|pro|elite`. «Acceso profesional» enlaza a `/acceso`; `/app/*` verifica sesión en API.
- [ ] **Páginas de términos legales y privacidad (`RNF12`, `RNF19`, `RS23`)**:
  - Enlaces de pie de página para Política de Privacidad y Términos de Servicio cuando se formalice la entidad legal del SaaS.
- [x] **Catálogo y registro (acuerdo 15-oct)**: Básico $299 MXN/10 activos, Pro $599 MXN/30, Élite $999 MXN/ilimitados; precios. Reemplaza recorrido anterior de contratación por registro sin cobro ni activación de suscripción.

**Configuración local:** dejar `VITE_API_URL` vacío en `.env` para usar proxy Vite `/api` → puerto 3000. El backend debe permitir el Origin real con su puerto en `CORS_ORIGIN`. En producción, Vercel mantiene `/api` mediante rewrite a **https://api.ferkxo.tech**, API existente en Render. El desarrollo conserva la API local. [Estado comprobado y despliegue automático](../../docs/architecture/despliegue.md). Nunca poner credenciales de PostgreSQL en variables VITE.

**HU-001:** formulario accesible con confirmaciones, información de registro, plan opcional, carga/error/duplicado/éxito. No persiste credenciales en el navegador. [Contrato](../../docs/epicas/ep-01-identidad-y-acceso/hu-001/README.md), [tablas y migraciones](../../docs/database/README.md). Perfil ampliable mediante nuevas migraciones.

---

## Scripts Disponibles

Ejecutar desde el directorio `apps/web`:

```bash
npm run dev       # Inicia el servidor de desarrollo en http://127.0.0.1:5000
npm run build     # Ejecuta typecheck (tsc -b) y compilación de producción con Vite
npm run lint      # Ejecuta oxlint sobre el código fuente
npm run preview   # Previsualiza la compilación de producción
```

**HU-002:** `/acceso` usa usuario o correo y contraseña; `/app/` y `/app/perfil` consultan sesión/perfil propio. Retorno limitado a rutas locales de la app, validación ante navegación directa y mensajes de sesión/caducidad en español. [Contrato y pruebas](../../docs/epicas/ep-01-identidad-y-acceso/hu-002/README.md). El dashboard/cartera conservan sus HU; el estado sin plan no muestra datos de ejemplo.

## Arranque local de registro y acceso

Se necesitan **dos procesos encendidos**: Vite sirve la web y Express atiende `/api`. Desde la raíz del repositorio, abrir dos terminales:

```powershell
# Terminal 1
cd apps/api
npm run dev
```

```powershell
# Terminal 2
cd apps/web
npm run dev
```

Usar `http://localhost:5000` o `http://127.0.0.1:5000`. En `apps/web/.env`, dejar `VITE_API_URL=` vacío para usar el proxy del mismo origen. En `apps/api/.env`, configurar `CORS_ORIGIN=http://localhost:5000,http://127.0.0.1:5000`, `PORT=3000`, la conexión PostgreSQL con TLS verificado y `AUTH_JWT_SECRET`. Si se modifica el entorno, reiniciar el proceso correspondiente. No usar el puerto 5173 como Origin si la web se ejecuta en 5000.

Verificado el 15 de octubre de 2026 en Edge con Supabase real: registro 201 y confirmación, duplicado 409 visible, login y perfil propio, persistencia al recargar, logout, redirección de rutas privadas sin sesión y acceso por ambos hosts locales. La cuenta de prueba y sus datos relacionados fueron eliminados. El fallo reproducido antes de corregir el entorno era `ERR_CONNECTION_REFUSED` al llamar al puerto 3000 sin API activa; la URL directa antigua de Vite y el Origin 5173 también estaban desalineados. No fue necesario cambiar el formulario ni las migraciones.

# Acceso HU-006–009

`/app/clientes` muestra expedientes preparados propios y permite generar/reemplazar, copiar/ocultar y revocar invitaciones. `/app/recuperacion` y `/admin/recuperacion` autorizan recuperación solo para las cuentas permitidas tras corroboración fuera de banda y contraseña del operador. `/recuperar`, accesible desde login, explica el procedimiento y permite al titular introducir su nueva clave en privado. El código no se guarda en navegador. Las mutaciones usan sesión persistida, mismo origen y CSRF, con renovación al vencer el access.

[Contratos y evidencia HU-006–009](../../docs/epicas/ep-01-identidad-y-acceso/evidencia-hu-006-009.md). Se requieren la migración incremental y suscripción/expedientes preparados por sus módulos; no se activan planes ni se recaptura el cliente en el flujo de invitación.
