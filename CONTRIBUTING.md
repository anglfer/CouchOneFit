# Guía de Trabajo con Git y Versionado

Esta guía establece las reglas y el flujo de trabajo con Git para el equipo de desarrollo de **CouchOne Fit** (franela, ferchito y puczil). El objetivo es mantener el repositorio ordenado, evitar pérdidas de código y prevenir conflictos destructivos al integrar.

---

## 1. Reglas Obligatorias del Equipo

1. **PROHIBIDO hacer `push` directo a la rama `main`:**
   La rama `main` siempre debe ser estable y funcional. Todo cambio debe hacerse mediante ramas individuales y Pull Requests (PR).
2. **Trabaja únicamente en el módulo que te corresponde:**
   Si estás asignado al módulo de clientes, concéntrate en `features/clients`. No modifiques carpetas de otros compañeros sin previa coordinación.
3. **AVISO OBLIGATORIO al tocar archivos compartidos:**
   Si por alguna razón necesitas modificar archivos transversales:
   - Carpetas `shared/` (middleware, utilerías, errores, widgets comunes).
   - Enrutadores principales (`routes/`, `AppRoutes.tsx`, `app.ts`).
   - Dependencias (`package.json`, `pubspec.yaml`) o configuraciones globales (`vite.config.ts`, `tsconfig.json`).
     👉 **Debes avisar al equipo en el grupo antes de tocar esos archivos**, explicar qué vas a cambiar y coordinar el merge para evitar conflictos al juntar el trabajo.
4. **Verificación previa antes de subir:**
   Antes de hacer `push` de tu rama, asegúrate de que el proyecto compila localmente (`npm run build` en Web/API o `flutter analyze` en Móvil). No subas código roto.

---

## 2. Nomenclatura de Ramas (Branching)

Toda rama debe crearse a partir de `main` actualizado y seguir la estructura:

```text
<tipo>/<aplicación>-<nombre-corto-de-la-tarea>
```

### Tipos de rama:

- `feature/`: Para nuevas funcionalidades, pantallas o endpoints.
- `fix/`: Para corrección de errores o bugs.
- `docs/`: Para cambios exclusivamente de documentación.
- `refactor/`: Mejoras internas de código sin cambiar funcionalidad.

### Ejemplos reales:

| Tarea                                    | Nombre de la rama               |
| :--------------------------------------- | :------------------------------ |
| Crear pantalla de registro en web        | `feature/web-auth-register`     |
| Endpoint para vincular código único      | `feature/api-token-link`        |
| Pantalla de check-in en la app móvil     | `feature/mobile-checkin-screen` |
| Corregir error de CORS en la API         | `fix/api-cors-origin`           |
| Corregir padding en formulario móvil     | `fix/mobile-login-padding`      |
| Actualizar requerimientos o arquitectura | `docs/update-architecture`      |

---

## 3. Formato de Commits (Conventional Commits)

Usa mensajes claros, en minúsculas y descriptivos. No uses mensajes como _"cambios"_, _"avances"_ o _"arreglado"_.

### Estructura:

```text
<tipo>(<alcance>): <descripción concisa en presente>
```

- `feat`: Nueva característica.
- `fix`: Corrección de bug.
- `docs`: Documentación.
- `style`: Ajustes visuales, formato o CSS.
- `refactor`: Limpieza o reorganización de código.
- `test`: Pruebas unitarias o de integración.

### Ejemplos:

```bash
git commit -m "feat(web): add client registration form with code validation"
git commit -m "feat(api): implement single-use token consumption endpoint"
git commit -m "fix(mobile): resolve keyboard overflow on check-in screen"
git commit -m "style(web): adjust dashboard sidebar colors"
git commit -m "docs(api): document environment variables for render"
```

---

## 4. El Flujo de Trabajo Paso a Paso (El Ciclo Diario)

Sigue estos 7 pasos cada vez que vayas a trabajar en una nueva tarea:

### Paso 1: Actualizar tu `main` local

Asegúrate de tener los últimos cambios que subieron tus compañeros:

```bash
git checkout main
git pull origin main
```

### Paso 2: Crear tu rama de trabajo

Crea y muévete a tu nueva rama:

```bash
git checkout -b feature/web-client-expediente
```

### Paso 3: Trabajar y hacer commits atómicos

Haz cambios en pequeños bloques lógicos:

```bash
git add .
git commit -m "feat(web): create client physical evaluation tab"
```

### Paso 4: Probar antes de subir

Verifica que no haya errores de compilación ni de sintaxis:

- En Web: `npm run build`
- En API: `npm run build`
- En Móvil: `flutter analyze`

### Paso 5: Sincronizar con `main` antes del Push

Para garantizar que tu rama esté al día con lo que otros hayan subido mientras programabas:

```bash
git fetch origin
git merge origin/main
```

_(Si hay algún conflicto, resuélvelo aquí en tu máquina local antes de subir)._

### Paso 6: Subir tu rama a GitHub

```bash
git push origin feature/web-client-expediente
```

### Paso 7: Crear el Pull Request (PR) en GitHub

1. Ve al repositorio en GitHub.
2. Verás el botón verde **Compare & pull request**.
3. Escribe qué hiciste en la descripción del PR.
4. Asigname a mi fechito [anglfer] como revisor.
5. Una vez aprobado, se realiza el **Merge pull request** hacia `main`.
6. En tu computadora regresas a `main` y borras tu rama local terminada:
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/web-client-expediente
   ```

---

## 5. ¿Qué hacer si hay un Conflicto de Merge?

Un conflicto ocurre cuando dos personas editaron exactamente la misma línea de código en un archivo.

1. Al hacer `git merge origin/main`, Git te dirá qué archivos tienen conflicto:
   ```text
   CONFLICT (content): Merge conflict in src/routes/AppRoutes.tsx
   ```
2. Abre el archivo en tu editor (VS Code). Verás las marcas de Git:
   ```tsx
   <<<<<<< HEAD (Tus cambios)
   <Route path="/expedientes" element={<ExpedientesPage />} />
   =======
   <Route path="/planes" element={<PlanesPage />} />
   >>>>>>> origin/main (Los cambios de tu compañero)
   ```
3. **Habla con tu compañero** para decidir cómo integrar ambas partes (generalmente se conservan ambas rutas).
4. Borra las marcas (`<<<<<<<`, `=======`, `>>>>>>>`) y deja el código limpio.
5. Verifica que compile:
   ```bash
   npm run build
   ```
6. Guarda el archivo, haz commit y push:
   ```bash
   git add src/routes/AppRoutes.tsx
   git commit -m "fix: resolve merge conflict in AppRoutes"
   git push origin feature/tu-rama
   ```

---

## 6. Archivos Prohibidos en Git (Seguridad)

- **NUNCA subas archivos `.env`** con contraseñas, URLs reales con credenciales o llaves privadas.
- Si agregas una nueva variable de entorno, agrégala en el archivo `.env.example` correspondiente como plantilla sin datos sensibles.
- Las carpetas pesadas (`node_modules/`, `build/`, `dist/`, `.dart_tool/`) están ignoradas por el `.gitignore`; nunca intentes forzar su inclusión con `git add -f`.
