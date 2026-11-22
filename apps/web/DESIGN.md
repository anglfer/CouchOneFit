---
name: CouchOne Fit Público
colors:
  primary: '#4037F7'
  primary-hover: '#3128D9'
  secondary: '#6344DC'
  brand-blue: '#3046EB'
  ink: '#090918'
  muted: '#434771'
  text-muted: '#5B6388'
  canvas: '#F8F9FD'
  surface: '#FFFFFF'
  surface-secondary: '#F3F4FA'
  surface-accent: '#F1F0FF'
  primary-soft: '#EAE8FF'
  selection: '#DCD9FF'
  border: '#E3E5FC'
  border-strong: '#D0D2FA'
  border-hover: '#A9A4FF'
  border-input: '#8A8FB3'
  on-color: '#EEF2FF'
  night: '#050A1A'
  night-2: '#0C152C'
  night-text: '#E6E7F0'
  night-muted: '#BBBFD3'
  night-subtle: '#8F97AF'
  night-label: '#A9A4FF'
  device-bezel: '#15131F'
typography:
  display:
    fontFamily: Segoe UI Variable Display
    fontSize: 70px
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: -0.032em
  heading:
    fontFamily: Segoe UI Variable Display
    fontSize: 54px
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: -0.03em
  title:
    fontFamily: Segoe UI Variable Display
    fontSize: 2.6rem
    fontWeight: 600
    lineHeight: 1.05
  subtitle:
    fontFamily: Segoe UI Variable Display
    fontSize: 2.1rem
    fontWeight: 600
    lineHeight: 1.2
  lead:
    fontFamily: Segoe UI Variable
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: Segoe UI Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: Segoe UI Variable
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Segoe UI Variable
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: Segoe UI Variable
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
rounded: { sm: 10px, md: 12px, lg: 16px, xl: 28px, full: 999px }
spacing: { xs: 8px, sm: 16px, md: 24px, lg: 56px, section: 128px }
components:
  button-primary:
    {
      backgroundColor: '{colors.primary}',
      textColor: '#ffffff',
      rounded: '{rounded.md}',
      height: 48px,
    }
  button-secondary:
    {
      backgroundColor: '{colors.surface}',
      textColor: '{colors.ink}',
      borderColor: '{colors.border-input}',
      rounded: '{rounded.md}',
      height: 48px,
    }
  input:
    {
      backgroundColor: '{colors.surface}',
      borderColor: '{colors.border-input}',
      rounded: '{rounded.sm}',
      height: 48px,
      fontSize: 16px,
    }
---

## Overview

Superficies públicas (landing `/`, `/acceso`, `/recuperar`, `/registro`) para entrenadores y nutriólogos. La página es el producto trabajando: capturas reales del panel y de la app móvil, enmarcadas como navegador y teléfono, bajo titulares llanos y recorridos interactivos para evaluar el producto antes de registrarse. El mundo es el del propio panel (marca índigo del [DESIGN.md raíz](../../DESIGN.md)) para que lo público y lo privado se sientan un mismo producto, incorporando de forma sutil la firma de curvas de pista de `JourneySurface` del móvil (`TrackBackdrop`). Un intento con estética de señalética/brutalista quedó descartado (rama `brutalista`, 21-nov-2026). Variación 5/10, movimiento 3/10, densidad 4/10.

## Colors

Restringido con un campo comprometido: fondos blanco y `#F8F9FD`, tinta `#090918`, índigo `#4037F7` para acciones. El degradado de marca (`linear-gradient(135deg, #3046EB 0%, #4037F7 48%, #6344DC 100%)`) solo como campo de superficie: la losa del escenario del hero, el panel derecho del acceso y la banda de cierre; nunca en texto. Azul noche `#050A1A`/`#0C152C` para el pasaje "dos lados". Sobre color, el texto secundario es `#EEF2FF`/indigo-50 y el foco pasa a blanco (`.mk-on-color`). Siempre claro: `theme.ts` fuerza tema claro fuera de `/app` y `/admin`; `theme-color` blanco.

## Typography

Sans del sistema sin descargas: `Segoe UI Variable Display` (utilidad `font-display`) en titulares a 600 con tracking −0.03em, `Segoe UI Variable` en texto; en macOS/iOS resuelve a SF. Es la misma letra de las capturas del panel. Cuerpo de 17–18px, detalles de 14px como mínimo, cifras de precio con `tabular-nums`. Sin etiquetas/kickers sobre los titulares.

## Layout

Contenedor de 1240px con 16px de margen lateral en móvil y 32px desde `sm`, navegación fija de 68px y `scroll-mt-16` en las anclas. Encabezados de sección en fila de 12 columnas (titular 7, texto 5). Ritmo vertical de 96px en móvil y 128px en escritorio. El pasaje "dos lados" divide a sangre en dos mitades con el teléfono sobre el eje; "Cómo funciona" es una línea continua entre pasos numerados (vertical en móvil). Reflujo a 1280, 1024, 640 y 390px sin desbordamiento horizontal.

## Elevation & Depth

Una sola elevación por elemento: los marcos de producto (`.mk-browser`, `.mk-phone`) llevan sombra con desplazamiento y sin borde; tarjetas de plan y tabla usan solo borde. Sin glass ni movimiento continuo.

## Shapes

Botones de 12px, campos de 10px, tarjetas de 16px, losas y bandas de 28px. El bisel del teléfono usa radios en porcentaje para escalar con su ancho.

## Components

- **ProductShot** (`src/components/ProductShot.tsx`): `BrowserFrame`/`PanelShot` y `PhoneFrame`/`PhoneShot` alrededor de `public/marketing/*.webp`. El recorte se ajusta por breakpoint con `--crop-x`, `--crop-y` y `--crop-w` (en % de la captura) y `aspect-*` en `viewClassName`; en móvil se recorta a una zona legible en lugar de reducir la pantalla completa.
- **Navegación y progreso (`MarketingNavigation` + `marketing.css`)**: cabecera fija con `@container scroll-state(stuck: top)`, resaltado de sección activa mediante `IntersectionObserver`, barra de progreso de lectura por CSS Scroll-Driven Animations (`scroll(root block)` con `prefers-reduced-motion`) y menú móvil bajo 1024px con `Escape` y retorno de foco.
- **Firma de pista (`TrackBackdrop`)**: tres curvas paralelas suaves inspiradas en `JourneySurface` de la app móvil (`aria-hidden="true"`), con trazo de entrada único cuando `prefers-reduced-motion: no-preference`.
- **Escaparate del hero (`Hero`)**: un solo bloque inmersivo oscuro/índigo (`.mk-hero-stage`, azul noche profundo `#070b22`–`#0d1647` con iluminación índigo y `TrackBackdrop`) que integra en una misma escena el titular centrado, subtítulo, botones inversos, nota de tranquilidad y el escaparate interactivo de cinco módulos reales (**Inicio**, **Expediente**, **Entrenamiento**, **Alimentación**, **Seguimiento**). La barra `.mk-tablist` mantiene las pestañas en una sola fila desplazable con indicador inferior estructural para WCAG 1.4.1, flechas, Inicio/Fin y foco itinerante. Incluye puente de sincronización en vivo, enfoque interactivo «En tu panel» / «En su app» y botón «Ampliar capturas». El teléfono se monta ~6% sobre el marco del navegador; en móvil las capturas van primero (dentro del pliegue de 390×844) y las pestañas debajo. Bajo la escena inmersiva, la nota «Capturas reales del producto con datos de demostración».
- **Inspector modal (`ProductLightbox`)**: `<dialog>` nativo (`showModal()`, `closedby="any"` con fallback de puntero en Safari, `overscroll-behavior: contain` en `:modal` y `::backdrop`) para inspeccionar cada captura real en tamaño completo alternando entre Panel web y App móvil y navegando entre módulos.
- **Pasaje «dos lados» (`TwoSides`)**: recorrido interactivo de tres escenas reales (**Check-in diario**, **Sesión entrenada**, **Visibilidad controlada**) sobre fondo azul noche `#050A1A`/`#0C152C`. En «Visibilidad controlada» incluye un simulador de permisos cliente (`DEC-009`) para alternar medidas evaluadas y adherencia compartida.
- **Expediente y comparativa (`RecordCoverage`)**: las cuatro áreas (**Alimentación**, **Evaluación**, **Entrenamiento**, **Seguimiento**) actualizan en vivo la captura real superior en `BrowserFrame` y enlazan al inspector modal; debajo, un selector de cuatro momentos diarios compara operar con chats/hojas sueltas frente a CouchOne Fit.
- **Cómo funciona (`HowItWorks`)**: línea continua numerada con etiqueta de resultado tangible por paso y franja de garantías operativas (sin edición de prescripciones por el cliente, baja lógica y PWA instalable).
- **Planes (`Plans`)**: catálogo dinámico desde `/api/plans` con selector interactivo de cartera activa (1 a 60+ clientes y accesos rápidos, apoyado en `utils/planRecommendation.ts`) que resalta el plan sugerido con borde `#4037F7`, muestra lugares libres/ocupación y estima el costo aproximado por cliente sin alterar los precios oficiales.
- **Preguntas frecuentes (`FrequentlyAskedQuestions`)**: acordeón nativo no exclusivo en `<details>` con transición progresiva en `::details-content` e `interpolate-size: allow-keywords` cuando no hay preferencia de movimiento reducido.
- **Botones** `.mk-btn` con `data-variant` `primary`, `secondary`, `inverse` y `outline-inverse`, 48px de alto.
- **Acceso** (`AuthShell`): formulario a la izquierda (máx. 400px) y, desde 1024px, panel de marca con la captura real del inicio del panel a sangre. Campos blancos de 48px a 16px (`.mk-auth .ws-auth-input`).
- Enlaces públicos: «Elegir plan» abre `/registro?plan=<id>`; «Crear cuenta», «Crear mi cuenta» y «Contáctanos» abren `/registro` sin plan (HU-039); «Iniciar sesión» abre `/acceso`; «Privacidad y condiciones» abre `/privacidad`.

## Do's and Don'ts

- Mostrar el producto real: cada imagen es una captura con datos de demostración y su procedencia en `.webp.json`. Si cambia la UI del panel o del móvil, recapturar con la misma cuenta demo, nunca con datos reales.
- Usar los precios y límites acordados desde la API: Básico $299 MXN/10 activos, Pro $599 MXN/30 y Élite $999 MXN/ilimitados. Crear cuenta no cobra ni activa la suscripción. No añadir pruebas gratis, testimonios, métricas ni integraciones.
- Mantener expedientes y prescripciones bajo control profesional; el cliente registra, no modifica lo prescrito.
- Foco visible (blanco sobre color), objetivos táctiles de al menos 44px, contraste AA y respeto a movimiento reducido.
- Confirmar acciones destructivas o la pérdida de cambios con `confirmDialog()` (`src/services/confirm.ts`); nunca `window.confirm`/`window.alert`.
- No: texto con degradado, kickers sobre titulares, rejillas de tarjetas con ícono como estructura, borde + sombra amplia en el mismo elemento.
