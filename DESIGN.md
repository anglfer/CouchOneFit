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

## Logotipo y piezas de marca

El isotipo C1 está vectorizado a partir del logo principal. Fuentes en `apps/web/public/brand/`: `logomark.svg` (color), `logomark-white.svg` (una tinta, para fondos de marca u oscuros), `app-icon.svg` (cuadrado con degradado de marca y favicon), `loader.svg` (animado, sin movimiento con `prefers-reduced-motion`). En React: `components/LogoMark.tsx` (variantes `color`, `white`, `ink`, y `animated`) y `components/LoadingScreen.tsx`; `index.html` muestra el loader antes de que cargue la app. No se usan emojis ni flechas tipográficas como iconos: los iconos son SVG de `components/Icon.tsx`.

## Temas por superficie

Los seis conjuntos son exactos. Web ofrece el selector claro/oscuro/sistema en el menú de cuenta del panel y de administración (sin botón suelto en la cabecera) y el botón de sol/luna en marketing, acceso y registro. Guarda la elección claro/oscuro en `localStorage` (`couchonefit-theme`) y la aplica entre páginas y recargas mediante `data-theme` en la raíz. Sin elección guardada sigue `prefers-color-scheme`, incluidos sus cambios; con almacenamiento bloqueado el botón funciona durante la página. Flutter sigue al dispositivo inicialmente; antes de entrar ofrece el botón de sol/luna y, ya dentro, el tema (sistema/claro/oscuro) se elige en Cuenta → Preferencias → Apariencia y se recuerda en el teléfono (decisión del usuario del 04-nov-2026, ver EP-06). Los tokens globales de marca/estado se comparten; las superficies mantienen tokens propios para evitar que la landing imponga su estilo al sistema interno.

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

Desde el 05-nov-2026 el panel comparte el tema nocturno violeta profundo del
móvil (decisión del usuario, ver EP-06). Tokens implementados como `--ws-*` en
`apps/web/src/workspace.css`; blanco sobre `primary` 4,6:1 y sobre
`primary-hover` 5,6:1 (el hover oscurece para no perder contraste).

```yaml
professional-dark:
  primary: "#7357FF"
  primary-hover: "#6346F5"
  accent-text: "#B3A5FF"
  app-background: "#07050F"
  sidebar: "#0B0817"
  topbar: "#0B0817CC"
  surface: "#120E20"
  surface-secondary: "#1C1733"
  surface-selected: "#2D2360"
  text-primary: "#F4F1FF"
  text-secondary: "#CBC3E6"
  text-muted: "#A39BC2"
  border: "#2A2347"
  border-subtle: "#1D1834"
  glow: "#7357FF2E"
  backdrop: "#07050FB3"
```

Ambos temas del panel llevan un brillo radial suave de marca arriba del
contenido (`--ws-glow`). Jerarquía de acciones: en cada fila de cliente solo
«Abrir ficha» es primaria; invitar, revocar e inactivar son secundarias y
«Dar de baja la cuenta» usa la variante de peligro.

### mobile-light

```yaml
mobile-light:
  primary: "#4037F7"
  primary-hover: "#3128D9"
  secondary: "#6344DC"
  background: "#F6F6FB"
  surface: "#FFFFFF"
  surface-secondary: "#EEF0FB"
  surface-selected: "#EAE8FF"
  text-primary: "#070C21"
  text-secondary: "#222F64"
  text-muted: "#626A90"
  border: "#E1E4F3"
  navigation-background: "#FFFFFF"
  navigation-active: "#4037F7"
  navigation-inactive: "#626A90"
```

`navigation-inactive` pasó de `#8D99C0` a `#626A90` el 08-nov-2026: la barra lleva
texto de 11,5 unidades y el tono anterior no alcanzaba AA sobre blanco.

### mobile-dark

Tema nocturno violeta profundo (decisión del usuario del 05-nov-2026, ver
EP-06): sustituye al azul nocturno en el móvil. Blanco sobre `primary`
4,6:1; `secondary` es el color de texto de acento y navegación activa.

```yaml
mobile-dark:
  primary: "#7357FF"
  primary-hover: "#8A72FF"
  secondary: "#A594FF"
  background: "#07050F"
  surface: "#120E20"
  surface-secondary: "#1C1733"
  surface-selected: "#2D2360"
  text-primary: "#F4F1FF"
  text-secondary: "#CBC3E6"
  text-muted: "#958CB5"
  border: "#241D40"
  navigation-background: "#0B0817"
  navigation-active: "#A594FF"
  navigation-inactive: "#8A82A8"
```

**Diferencia pendiente de decidir (08-nov-2026):** `app_theme.dart` y
`test/widget_test.dart` fijan el tema nocturno en `primary #7C5CFF`, `background
#06040C` y `surface #110D1C`, no en los valores de esta tabla. Blanco sobre
`#7C5CFF` da 4,3:1; por eso todo fondo con texto blanco en oscuro usa
`nightAction #6A4CF0` (5,6:1), que es el mismo tono un paso más oscuro.

Las pestañas del cliente llevan un brillo radial suave de `primary` en la
parte superior (26 % de opacidad en oscuro, 7 % en claro).

### Lenguaje visual móvil

Vigente desde el 08-nov-2026. Se aplica en todas las pantallas de Flutter:

- **Superficie de pista (`JourneySurface`):** la firma de la marca. Es un fondo
  violeta nocturno con líneas de pista que se trazan una vez. Solo la lleva lo
  principal de cada pantalla: bienvenida, entrenamiento del día, objetivo y
  entrenamiento en curso. Conserva su color en ambos temas.
- **Una sola acción principal:** `GradientActionButton` usa un único tono de
  arriba abajo. Sobre la superficie de pista se invierte a blanco (`inverse`). El
  degradado de marca no se usa en controles ni en selecciones.
- **Sin tarjetas anidadas:** lo relacionado va en una tarjeta con filas separadas
  por líneas (`GroupCard`) y las métricas en `StatPanel`.
- **Títulos de sección en frase normal (`SectionTitle`):** no se usan etiquetas en
  mayúsculas sobre un título. Las mayúsculas quedan solo para encabezados de
  columna de una tabla.
- **Estado:** `TonePill` para etiquetas y `statusInk` para texto de estado; el
  tema claro usa una tinta más oscura para alcanzar AA. Sobre `success` el texto
  es `onSuccess #052E22`, no blanco.
- **Navegación:** barra inferior con línea de acento sobre el destino activo y
  «Entrenar» como botón circular acoplado al borde superior.
- **Movimiento:** cada pantalla tiene un solo momento propio: el trazo de la pista,
  el avance de la barra de series o el pequeño rebote al marcar una serie. Todo se
  desactiva con movimiento reducido.

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
| Input | 10 px | 8 px | 12 px |
| Botón | 12 px | 8 px | 14 px |
| Card | 20–24 px | 12 px | 18 px |
| Dropdown | 10 px | 6 px | 12 px |
| Modal / card grande | 24 px | 10 px | 24 px (hoja inferior 28 px) |
| Pill | 999 px | Solo estados que lo necesiten | 999 px |

Marcos de dispositivos son excepciones ilustrativas. Espaciado base 4/8/16/24/32; marketing añade separación amplia entre secciones. Sombras discretas, sin animaciones continuas; respetar movimiento reducido.

## Layout y experiencia

**Marketing:** claro, amplio, comercial y más redondeado. Navegación superior, hero asimétrico, contenido orientado al producto y vistas conceptuales identificadas como ejemplo. Su modo oscuro usa azul nocturno, nunca negro absoluto.

**Panel profesional:** herramienta de trabajo visualmente distinta del sitio público. Navegación izquierda con marca, cabecera contextual y contenido compacto; fondos, sidebar y topbar separados. Inspiración Fluent mediante jerarquía, espaciado y radios; la implementación usa React/CSS existente, no la biblioteca oficial Fluent UI. En anchos estrechos la navegación se reordena arriba y permanece accesible sin desbordar. **Navegación (ajuste de noviembre de 2026):** la barra lateral solo lleva destinos de uso diario (profesional: Inicio, Clientes y Rutinas; cada cliente tiene una ficha única con pestañas Resumen y Entrenamiento, y la sección del menú queda activa en sus subpáginas; administración: Inicio, Profesionales y Planes). Mi perfil, Mi suscripción, Apariencia, Instalar app, Sitio público y Cerrar sesión viven en un menú de cuenta sobre el nombre de la persona; la Recuperación asistida se abre desde Clientes (profesional) o desde el menú de cuenta (administración). En móvil la barra inferior muestra los mismos destinos diarios y el menú de cuenta se abre desde el avatar de la cabecera.

Destinos previstos por las HU: Inicio, Clientes, Planes (Entrenamiento/Alimentación), Seguimiento y Configuración (cuenta/suscripción). Mostrar solo destinos con implementación funcional. El panel actual ofrece Inicio y Mi perfil, datos de cuenta y estado sin plan asignado. Administración comparte estructura y tokens, con navegación y permisos propios. No fabricar métricas, gráficas ni accesos a módulos pendientes.

**Móvil cliente:** misma identidad con controles más táctiles y amigables. Destinos: Inicio, Planes, Progreso y Cuenta con un botón central «Entrenar» (implementados en EP-06 el 04-nov-2026; los módulos pendientes se muestran como «Próximamente» sin datos de ejemplo); tarjetas de entrenamiento/alimentación/check-in, detalle por serie/comida, historial autorizado y perfil de solo lectura. La captura única de peso pertenece al check-in. Esta actualización aplica los temas a la pantalla inicial y configura controles Material; no implementa esos módulos pendientes.

## Componentes y accesibilidad

Formularios con etiqueta, unidad, ayuda y error junto al campo; mantener validación y datos ante fallos. Guardar confirma éxito solo tras respuesta del servidor. Estados independientes de carga, vacío, error, éxito y denegación según corresponda. No comunicar estado solo por color. Foco visible, teclado, áreas seguras, scroll y escalado sin recortes. Objetivos Web de al menos 44 px y móvil de 48 unidades lógicas.

Validar contraste por combinación y tamaño; los HEX por sí solos no certifican AA. Textos secundarios claros sobre fondos oscuros, texto oscuro sobre estados claros. Las gráficas futuras deben incluir fechas, unidad, origen y alternativa tabular, separando adherencia de cobertura. Verificar a 320/390/768/1280 px; tablas extensas con desplazamiento localizado.

## Alcance implementado y fuentes

- Web: marca y estados en `apps/web/src/index.css`; marketing claro/oscuro en `apps/web/src/features/marketing/marketing.css`; acceso/registro en `apps/web/src/features/auth/registration.css`.
- Panel y administración: estructura compartida `apps/web/src/layouts/WorkspaceLayout.tsx`, componentes en `apps/web/src/components/` (incluido `ui.tsx`: PageHeader, Card, Badge, Meter), tokens `--ws-*` y clases `ws-*` en `apps/web/src/workspace.css` y tokens globales en `apps/web/src/index.css`, sin dependencia visual del marketing.
- Flutter: marca, estados y temas en `apps/mobile/lib/shared/theme/app_theme.dart`, conectados a `main.dart`. Los radios para componentes aún inexistentes son especificación, no prueba de pantallas implementadas. Componentes compartidos en `apps/mobile/lib/shared/widgets/` (`NoticeBanner`, `StatusView`, `SheetHeader`/`SheetOption`, `IconBadge`, `GradientActionButton`, `JourneySurface`, `GroupCard`, `SectionTitle`, `TonePill`, `DetailScaffold`) y en `features/training/screens/training_views.dart` (`ChoiceBar`, `CardTitle`, `StatTile`, `StatPanel`, `ScreenHeader`).
- Las vistas conceptuales de marketing conservan su contenido de ejemplo. Las pantallas reales usan la API y conservan comprobación de sesión, redirección por rol, reintento y cierre de sesión.
- Esta decisión no añade agenda, chat, notificaciones (las rachas de entrenamiento se activaron en móvil por decisión del usuario del 04-nov-2026, ver EP-06), fotografías, reportes, bibliotecas multimedia ni reglas comerciales. Permisos y suscripciones siguen las HU/DEC y la API.
