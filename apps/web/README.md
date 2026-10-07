# CouchOne Fit — Frontend Web / PWA (`apps/web`)

Aplicación web desarrollada en **React 19 + TypeScript + Vite**.

En producción cumple dos propósitos con límites arquitectónicos definidos:

1. **Capa pública comercial / Marketing (`/`)**: Landing informativa, propuesta de valor y demostración visual interactiva (sitio web estándar, sin PWA invasiva).
2. **Capa privada profesional / PWA (`/app/` o `/dashboard/`)**: Espacio de trabajo del entrenador o nutriólogo (expedientes, planes, seguimiento y check-ins) con capacidades de instalación PWA (`RNF03`, `RNF04`).

---

## Estado Actual de Implementación

| Módulo / Capa                        | Estado              | Descripción técnica                                                                                                                                                                           |
| :----------------------------------- | :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Marketing público (`/`)**          | **Completado (v1)** | Landing responsive, temática fija clara/blanca, narrativa guiada por `/docs`, showcase interactivo del producto (panel profesional + app cliente sincronizada) y diálogo de estado de acceso. |
| **Enrutamiento base**                | **Funcional**       | `AppRoutes.tsx` aísla la capa pública en `/` y responde con 404 personalizado para rutas no existentes.                                                                                       |
| **Autenticación profesional**        | **Pendiente**       | No existe login, sesión ni conexión con Supabase Auth / API.                                                                                                                                  |
| **Sistema interno / Dashboard**      | **Pendiente**       | No existen pantallas para gestión de clientes, expedientes ni evaluaciones.                                                                                                                   |
| **Planes de alimentación y rutinas** | **Pendiente**       | No existe el configurador ni la activación de planes.                                                                                                                                         |
| **PWA acotada a la app privada**     | **Pendiente**       | El manifiesto y service worker deben delimitarse a `/app/` para no registrar PWA en la landing comercial.                                                                                     |

---

## Hoja de Ruta: Qué falta por implementar

### 1. Sistema Interno y Autenticación del Profesional (`RF01`, `RF02`, `RS01`, `RS05`, `RS07`)

- [ ] **Módulo `features/auth/`**:
  - Pantalla y formulario de inicio de sesión (`/login` o `/auth/login`) para entrenadores y nutriólogos con validación de credenciales.
  - Cierre de sesión e invalidación de token (`RDF0103`).
  - Almacenamiento seguro del token de sesión (JWT) y manejo de caducidad.
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

La versión actual de Marketing cubre completamente la narrativa de producto, la demostración interactiva, la propuesta de valor y las preguntas frecuentes. Los elementos pendientes para futuras etapas son:

- [ ] **Conexión de los CTAs a rutas reales**:
  - Enlazar el botón _"Acceso profesional ↗"_ y _"Consultar disponibilidad"_ hacia la ruta `/login` (o hacia un formulario de contacto / lista de espera en preventa) una vez esté programado el módulo de autenticación.
- [ ] **Páginas de términos legales y privacidad (`RNF12`, `RNF19`, `RS23`)**:
  - Enlaces de pie de página para Política de Privacidad y Términos de Servicio cuando se formalice la entidad legal del SaaS.
- [ ] **Publicación de precios y planes comerciales finales**:
  - Cuando el equipo de producto defina las tarifas oficiales (mensual/anual) y los límites de clientes activos por nivel, actualizar la sección `#planes` para mostrar las tarjetas con precios reales y botón de suscripción/checkout.

---

## Scripts Disponibles

Ejecutar desde el directorio `apps/web`:

```bash
npm run dev       # Inicia el servidor de desarrollo en http://127.0.0.1:5000
npm run build     # Ejecuta typecheck (tsc -b) y compilación de producción con Vite
npm run lint      # Ejecuta oxlint sobre el código fuente
npm run preview   # Previsualiza la compilación de producción
```
