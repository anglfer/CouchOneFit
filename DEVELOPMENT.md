# Guía de desarrollo — CouchOne Fit

Léela antes de crear o modificar código. Si una historia de usuario, decisión aprobada o contrato existente exige algo distinto, gana esa regla y documentas el mapeo.

## 1. Tres reglas que resumen todo

1. **Código nuevo en inglés, textos visibles en español.** (`loadWorkspace`, pero el botón dice "Guardar").
2. **Lo que ya existe en contratos o BD no se renombra.** (`nombreCompleto`, `contrasena`, tablas, rutas, roles, códigos de error). Si el nombre interno es distinto, se mapea en la frontera (repositorio o consulta).
3. **Cada cosa va en su capa.** Si dudas, mira la sección 3.

## 2. Nombres de un vistazo

| Qué                           | Convención                                                                                            | Ejemplo                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Variables y funciones (TS/JS) | `lowerCamelCase`, verbo + concepto                                                                    | `registerProfessional`                |
| Booleanos                     | `is` / `has` / `can` / `should`                                                                       | `isLoading`, `canRetry`               |
| Componentes, clases, tipos    | `PascalCase`                                                                                          | `WorkspaceLayout`                     |
| Constantes de configuración   | `UPPER_SNAKE_CASE`                                                                                    | `API_BASE_URL`                        |
| `const` locales               | `lowerCamelCase`                                                                                      | `selectedPlan`                        |
| Handlers de eventos (Web)     | `handle` + acción                                                                                     | `handleSubmit`                        |
| Clases y variables CSS        | `kebab-case` / `--kebab-case`                                                                         | `workspace-sidebar`                   |
| Dart                          | Clases `PascalCase`, miembros y constantes `lowerCamelCase`, privados `_`, archivos `snake_case.dart` | `TrainingSession`, `home_screen.dart` |

Evita nombres vagos: `processData`, `doAction`, `handleStuff`.

### Archivos

| Dónde                  | Convención                                                 | Ejemplo                   |
| ---------------------- | ---------------------------------------------------------- | ------------------------- |
| Web, componente `.tsx` | `PascalCase` igual al componente; sufijo `Page` o `Layout` | `ProfessionalPage.tsx`    |
| Web, módulo `.ts`      | `lowerCamelCase`                                           | `useThemePreference.ts`   |
| API, módulo `.ts`      | `kebab-case`                                               | `professional-profile.ts` |

No traduzcas ni muevas las carpetas de la arquitectura (`features/`, `services/`, `repositories/`, etc.). En API no repitas la carpeta en el nombre: `services/registration.ts`, no `registration-service.ts`.

## 3. API: ¿dónde va mi código?

| Capa           | Qué hace                                                                                   | Qué NO hace                               |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Route**      | Declara método, ruta, middleware y controller                                              | SQL o reglas de negocio                   |
| **Controller** | Lee `params`/`query`/`body`, llama al service, responde o propaga el error                 | Validar reglas de negocio ni tocar la BD  |
| **Service**    | Coordina el caso de uso: llama al validator y al repository                                | Usar `req`, `res`, headers o códigos HTTP |
| **Validator**  | Recibe `unknown`, revisa estructura y reglas, devuelve un tipo válido o el error de la app | Consultar la BD                           |
| **Repository** | Consultas parametrizadas; mapea SQL → tipos de la app                                      | Lógica HTTP                               |

Flujo de escritura:

```text
Route → Controller → Service → Validator
                           └──→ Repository → PostgreSQL
```

El validator lo llama el **service**, no el controller.

Si varios cambios en BD forman una sola operación, usa transacción: `COMMIT` al terminar, `ROLLBACK` si hay error y libera la conexión siempre (`finally`).

## 4. Ejemplo completo: registrar un profesional

```ts
// routes/registration.ts
router.post('/professionals', registrationController.registerProfessional);

// controllers/registration.ts
export async function registerProfessional(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await registrationService.registerProfessional(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

// services/registration.ts
export async function registerProfessional(input: unknown) {
  const registration = validateRegistration(input); // validator
  const passwordHash = await hashPassword(registration.password);
  return registrationRepository.insertProfessional({
    ...registration,
    passwordHash,
  });
}

// validators/registration.ts
export function validateRegistration(input: unknown): Registration {
  // revisa estructura y reglas; lanza el error de aplicación existente si falla
}

// repositories/registration.ts
export async function insertProfessional(data: NewProfessional) {
  const { rows } = await pool.query(
    'INSERT INTO profesionales (nombre_completo, correo) VALUES ($1, $2) RETURNING id, nombre_completo',
    [data.fullName, data.email]
  );
  return { id: rows[0].id, fullName: rows[0].nombre_completo }; // mapeo explícito SQL → app
}
```

Nota: el JSON de entrada puede traer `nombreCompleto` y `contrasena` (contrato protegido); el validator los convierte a `fullName` y `password` para el resto del código.

## 5. Web / PWA

- Organiza por funcionalidad. Lo que usa una sola feature vive en ella; lo global va en las carpetas compartidas.
- Operaciones: verbo + dominio (`readProfessionalProfile`).
- Tipos explícitos en contratos, servicios, funciones exportadas y respuestas de API. Dentro de una función, deja que TypeScript infiera lo simple.
- Nada de `any` para datos externos: usa `unknown` y valida.
- Tailwind: usa sus utilidades con su nombre oficial. CSS propio solo si no existe la utilidad.

## 6. Móvil (Flutter)

- Sigue las convenciones de Dart (tabla de la sección 2). No uses `UPPER_SNAKE_CASE` en Dart.
- La estructura de carpetas sale de la arquitectura y de la historia de usuario; esta guía solo fija nombres.

## 7. Base de datos y cambios de contrato

- Consultas parametrizadas, siempre.
- Nunca edites una migración ya aplicada en un entorno compartido: crea una nueva.
- No crees funciones SQL/RPC solo para mover lógica de negocio fuera de la app.
- Si cambias un contrato, actualiza **todo junto**: esquema o consulta, repositorio, tipos, API, Web/móvil, pruebas y docs.

Detalles en [Convenciones de PostgreSQL](docs/database/convenciones.md).

## 8. Checklist antes de cada cambio

- [ ] Leí la historia de usuario y las decisiones vigentes
- [ ] Busqué una feature parecida ya hecha y seguí su patrón
- [ ] Cada cosa quedó en su capa
- [ ] No renombré contratos, columnas, rutas ni carpetas
- [ ] Cambié solo lo necesario (sin refactors ajenos)
- [ ] Actualicé docs si cambió una regla o contrato
- [ ] Corrí las comprobaciones:
  - Web: `npm --prefix apps/web run build` (incluye TypeScript), Prettier y Oxlint
  - API: TypeScript estricto
  - Móvil: formateador y analizador de Dart en `apps/mobile`

## Documentación relacionada

- [Convenciones de PostgreSQL](docs/database/convenciones.md)
- [Modelo de identidad y acceso](docs/database/modelo-identidad-acceso.md)
- [Arquitectura y capas](docs/architecture/README.md)
- [Formato Web](docs/architecture/formato-codigo-web.md)
- [Guía de Git](CONTRIBUTING.md)
- [Plan y decisiones vigentes](plan/PLAN_TRABAJO_V2.md)
