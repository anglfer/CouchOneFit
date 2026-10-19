# CouchOne Fit — Sistema visual

**UI-001 actualizada por instrucción del usuario el 16 de octubre de 2026.** Esta versión sustituye la paleta azul/esmeralda y el criterio de tema exclusivamente claro aprobados el 14 de octubre. Es la fuente maestra para marketing Web, panel profesional/administración y móvil. La composición pública se detalla en [apps/web/DESIGN.md](apps/web/DESIGN.md).

## Identidad de marca

| Token | Color | Uso |
|---|---|---|
| Brand Primary | `#4037F7` | Acción principal |
| Brand Blue | `#3046EB` | Azul corporativo |
| Brand Violet | `#6344DC` | Secundario / énfasis |
| Primary Hover | `#3128D9` | Hover de botones claros |
| Primary Soft | `#EAE8FF` | Selección clara |
| Primary Subtle | `#F1F0FF` | Cards / tags suaves |
| Ink | `#090918` | Texto muy oscuro de marketing |
| White | `#FFFFFF` | Superficies claras |

```css
background: linear-gradient(135deg, #3046EB 0%, #4037F7 48%, #6344DC 100%);
```

El degradado identifica marca y énfasis comercial. La acción principal conserva su color sólido. Rosa y naranja son semánticos, nunca colores principales de CouchOne Fit.

## Temas por superficie

Los seis conjuntos son exactos. Web incluye un botón de sol/luna en las cabeceras de marketing, acceso, registro, panel y administración. Guarda la elección claro/oscuro en `localStorage` (`couchonefit-theme`) y la aplica entre páginas y recargas mediante `data-theme` en la raíz. Sin elección guardada sigue `prefers-color-scheme`, incluidos sus cambios; con almacenamiento bloqueado el botón funciona durante la página. Flutter sigue al dispositivo inicialmente y ofrece un botón de sol/luna en la cabecera para alternar el tema durante la sesión; al volver a abrir la app usa de nuevo la preferencia del dispositivo. Los tokens globales de marca/estado se comparten; las superficies mantienen tokens propios para evitar que la landing imponga su estilo al sistema interno.

### marketing-light

```yaml
marketing-light:
  primary: "#4037F7"
  primary-hover: "#3128D9"
  secondary: "#6344DC"
  canvas: "#F8F9FD"
  surface: "#FFFFFF"
  surface-secondary: "#F3F4FA"
  surface-accent: "#F1F0FF"
  text-primary: "#090918"
  text-secondary: "#434771"
  text-muted: "#6C74A1"
  border: "#E3E5FC"
  border-strong: "#D0D2FA"
  primary-soft: "#EAE8FF"
```

### marketing-dark

```yaml
marketing-dark:
  primary: "#6259FF"
  primary-hover: "#756EFF"
  secondary: "#8067F5"
  canvas: "#050A1A"
  surface: "#0C152C"
  surface-secondary: "#121F43"
  surface-accent: "#162467"
  text-primary: "#EFF0F4"
  text-secondary: "#BBBFD3"
  text-muted: "#8F97AF"
  border: "#21305B"
  border-strong: "#293A70"
  primary-soft: "#1A1D5A"
```

### professional-light

```yaml
professional-light:
  primary: "#4037F7"
  primary-hover: "#3128D9"
  secondary: "#6344DC"
  app-background: "#EAEFFD"
  sidebar: "#F6F8FF"
  topbar: "#FFFFFF"
  surface: "#FFFFFF"
  surface-secondary: "#F5F7FD"
  surface-selected: "#EAE8FF"
  text-primary: "#070C21"
  text-secondary: "#222F64"
  text-muted: "#626A90"
  border: "#D9DFF6"
  border-subtle: "#E8EBF7"
  icon: "#626A90"
  icon-active: "#4037F7"
```

### professional-dark

```yaml
professional-dark:
  primary: "#4037F7"
  primary-hover: "#6259FF"
  secondary: "#6344DC"
  app-background: "#050A1A"
  sidebar: "#081126"
  topbar: "#0C152C"
  surface: "#0C152C"
  surface-secondary: "#121F43"
  surface-tertiary: "#162467"
  surface-selected: "#1B2162"
  text-primary: "#EFF0F4"
  text-secondary: "#BBBFD3"
  text-muted: "#8F97AF"
  border: "#1E2C50"
  border-strong: "#293A70"
  icon: "#8F97AF"
  icon-active: "#756EFF"
```

### mobile-light

```yaml
mobile-light:
  primary: "#4037F7"
  primary-hover: "#3128D9"
  secondary: "#6344DC"
  background: "#FBFBFD"
  surface: "#FFFFFF"
  surface-secondary: "#EAEFFD"
  surface-selected: "#EAE8FF"
  text-primary: "#070C21"
  text-secondary: "#222F64"
  text-muted: "#626A90"
  border: "#D9DFF6"
  navigation-background: "#FFFFFF"
  navigation-active: "#4037F7"
  navigation-inactive: "#8D99C0"
```

### mobile-dark

```yaml
mobile-dark:
  primary: "#4B40FF"
  primary-hover: "#6259FF"
  secondary: "#756EFF"
  background: "#050A1A"
  surface: "#0C152C"
  surface-secondary: "#121F43"
  surface-selected: "#162467"
  text-primary: "#EFF0F4"
  text-secondary: "#BBBFD3"
  text-muted: "#8F97AF"
  border: "#21305B"
  navigation-background: "#081126"
  navigation-active: "#756EFF"
  navigation-inactive: "#8F97AF"
```

## Estados compartidos

| Estado | Principal | Fondo Light | Fondo Dark |
|---|---|---|---|
| Success | `#1FCC92` | `#E5FAF3` | `#0C382F` |
| Warning | `#F59E0B` | `#FFF5DB` | `#3B2B0B` |
| Error | `#DC5861` | `#FDEBEC` | `#411A21` |
| Info | `#3046EB` | `#E8EDFF` | `#14225B` |
| Highlight | `#FD4080` | `#FFE8F1` | `#48152B` |

Entrenamiento completado usa Success; check-in pendiente, Warning; error o incumplimiento importante, Error; información, Info; indicador secundario, Highlight. Ausencia de datos no equivale a incumplimiento. Acompañar siempre con texto o icono y usar texto del tema sobre fondos suaves: los colores principales de estado no garantizan contraste como texto pequeño. No interpretar verde como diagnóstico ni toda variación de peso como mejora.

## Tipografía, forma y densidad

Tipografía del sistema (Segoe UI en Web y fuente nativa en Flutter), sin descargas. Marketing: lectura 16 px, títulos amplios y escala fluida. Panel: texto habitual 14–16 px, títulos de sección 20–24 px, densidad compacta y jerarquía técnica. Móvil: texto escalable y objetivos táctiles de al menos 48 unidades lógicas.

| Elemento | Marketing | Panel profesional | Móvil |
|---|---|---|---|
| Input | 10 px | 6 px | 10 px |
| Botón | 12 px | 6 px | 10 px |
| Card | 20–24 px | 8 px | 12 px |
| Dropdown | 10 px | 6 px | 10 px |
| Modal / card grande | 24 px | 10 px | 16 px |
| Pill | 999 px | Solo estados que lo necesiten | 999 px |

Marcos de dispositivos son excepciones ilustrativas. Espaciado base 4/8/16/24/32; marketing añade separación amplia entre secciones. Sombras discretas, sin animaciones continuas; respetar movimiento reducido.

## Layout y experiencia

**Marketing:** claro, amplio, comercial y más redondeado. Navegación superior, hero asimétrico, contenido orientado al producto y vistas conceptuales identificadas como ejemplo. Su modo oscuro usa azul nocturno, nunca negro absoluto.

**Panel profesional:** herramienta de trabajo visualmente distinta del sitio público. Navegación izquierda con marca, cabecera contextual y contenido compacto; fondos, sidebar y topbar separados. Inspiración Fluent mediante jerarquía, espaciado y radios; la implementación usa React/CSS existente, no la biblioteca oficial Fluent UI. En anchos estrechos la navegación se reordena arriba y permanece accesible sin desbordar.

Destinos previstos por las HU: Inicio, Clientes, Planes (Entrenamiento/Alimentación), Seguimiento y Configuración (cuenta/suscripción). Mostrar solo destinos con implementación funcional. El panel actual ofrece Inicio y Mi perfil, datos de cuenta y estado sin plan asignado. Administración comparte estructura y tokens, con navegación y permisos propios. No fabricar métricas, gráficas ni accesos a módulos pendientes.

**Móvil cliente:** misma identidad con controles más táctiles y amigables. Destinos previstos: Inicio, Planes, Progreso y Cuenta; tarjetas de entrenamiento/alimentación/check-in, detalle por serie/comida, historial autorizado y perfil de solo lectura. La captura única de peso pertenece al check-in. Esta actualización aplica los temas a la pantalla inicial y configura controles Material; no implementa esos módulos pendientes.

## Componentes y accesibilidad

Formularios con etiqueta, unidad, ayuda y error junto al campo; mantener validación y datos ante fallos. Guardar confirma éxito solo tras respuesta del servidor. Estados independientes de carga, vacío, error, éxito y denegación según corresponda. No comunicar estado solo por color. Foco visible, teclado, áreas seguras, scroll y escalado sin recortes. Objetivos Web de al menos 44 px y móvil de 48 unidades lógicas.

Validar contraste por combinación y tamaño; los HEX por sí solos no certifican AA. Textos secundarios claros sobre fondos oscuros, texto oscuro sobre estados claros. Las gráficas futuras deben incluir fechas, unidad, origen y alternativa tabular, separando adherencia de cobertura. Verificar a 320/390/768/1280 px; tablas extensas con desplazamiento localizado.

## Alcance implementado y fuentes

- Web: marca y estados en `apps/web/src/index.css`; marketing claro/oscuro en `apps/web/src/features/marketing/marketing.css`; acceso/registro en `apps/web/src/features/auth/registration.css`.
- Panel y administración: estructura compartida `apps/web/src/layouts/WorkspaceLayout.tsx`, componentes en `apps/web/src/components/` y tokens globales en `apps/web/src/index.css`, sin dependencia visual del marketing.
- Flutter: marca, estados y temas en `apps/mobile/lib/shared/theme/app_theme.dart`, conectados a `main.dart`. Los radios para componentes aún inexistentes son especificación, no prueba de pantallas implementadas.
- Las vistas conceptuales de marketing conservan su contenido de ejemplo. Las pantallas reales usan la API y conservan comprobación de sesión, redirección por rol, reintento y cierre de sesión.
- Esta decisión no añade agenda, chat, notificaciones, rachas, fotografías, reportes, bibliotecas multimedia ni reglas comerciales. Permisos y suscripciones siguen las HU/DEC y la API.
