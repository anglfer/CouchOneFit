# Estándar y Guía de Formateo de Código (Web / PWA)

Este documento define la configuración y el flujo de formateo de código para la aplicación **Web / PWA** (`apps/web`), garantizando coherencia de estilo entre todos los desarrolladores del equipo.

---

## 1. Herramienta y Enfoque

- **Herramienta principal**: [Prettier](https://prettier.io/) como formateador dogmático.
- **Linter complementario**: [Oxlint](https://oxc.rs/docs/guide/usage/linter) para detección de errores y calidad de código (sin solapamiento con reglas de estilo visual).
- **Alcance**: TypeScript (`.ts`), React JSX (`.tsx`), CSS (`.css`), HTML (`.html`), JSON (`.json`) y Markdown (`.md`).

---

## 2. Configuración en `apps/web/.prettierrc`

La configuración establecida sigue las convenciones estándar del ecosistema React + TypeScript:

```json
{
  "semi": true,
  "singleQuote": true,
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 80,
  "endOfLine": "lf",
  "bracketSameLine": false
}
```

### Justificación de las reglas:

| Parámetro         | Valor   | Motivo / Beneficio                                                                                                  |
| :---------------- | :------ | :------------------------------------------------------------------------------------------------------------------ |
| `semi`            | `true`  | Evita errores de ASI (_Automatic Semicolon Insertion_) en TypeScript/JavaScript.                                    |
| `singleQuote`     | `true`  | Comillas simples para código JS/TS general (estándar de la comunidad).                                              |
| `jsxSingleQuote`  | `false` | Comillas dobles en atributos JSX (`<div className="container">`), alineado con la especificación JSX y HTML nativo. |
| `trailingComma`   | `"es5"` | Comas finales en objetos y arrays multilínea para minimizar diffs ruidosos en Git.                                  |
| `tabWidth`        | `2`     | Indentación consistente de 2 espacios (recomendado en interfaces React).                                            |
| `printWidth`      | `80`    | Límite de ancho de línea para legibilidad en pantallas divididas y revisiones de PRs.                               |
| `endOfLine`       | `"lf"`  | Saltos de línea Unix para evitar conflictos entre Windows, macOS y Linux en Git.                                    |
| `bracketSameLine` | `false` | Cierre `>` en línea separada para elementos JSX multilínea, facilitando la adición de propiedades.                  |

---

## 3. Integración con el Editor (VS Code)

Para asegurar que el formateo ocurra sin intervención manual, el repositorio incluye ajustes compartidos:

1. **`.vscode/extensions.json`**:
   - Recomienda automáticamente la extensión oficial `esbenp.prettier-vscode` (_Prettier - Code Formatter_).
2. **`.vscode/settings.json`**:
   - `editor.formatOnSave: true`: autoformatea el archivo al guardar (`Ctrl + S` / `Cmd + S`).
   - `editor.defaultFormatter: "esbenp.prettier-vscode"`: asigna Prettier como formateador por defecto para TypeScript, TSX, JS, JSX, JSON, CSS y HTML.
   - `prettier.configPath`: vincula la ruta de [apps/web/.prettierrc](apps/web/.prettierrc).
   - `prettier.ignorePath`: vincula [apps/web/.prettierignore](apps/web/.prettierignore) (omite `node_modules`, `dist`, `dev-dist`, `.vercel`).

---

## 4. Scripts y Comandos de Terminal

Desde la raíz o dentro de `apps/web`:

```bash
# Formatear todos los archivos del proyecto web
npm --prefix apps/web run format

# Verificar si hay archivos sin formatear (ideal para CI/CD)
npm --prefix apps/web run format:check
```

---

## 5. Validación en CI / Control de Versiones

Antes de enviar un Pull Request o en el pipeline de Integración Continua (CI), se recomienda verificar que el código cumpla con el estándar:

```bash
npm --prefix apps/web run format:check
npm --prefix apps/web run lint
npm --prefix apps/web run build
```
