---
name: CouchOne Fit Marketing
colors:
  primary: '#3046eb'
  primary-hover: '#2336c7'
  secondary: '#6344dc'
  ink: '#141630'
  muted: '#626479'
  canvas: '#fdfdff'
  surface: '#f3f4fa'
  border: '#dddfea'
  dark-canvas: '#111322'
  dark-surface: '#1b1e33'
  dark-ink: '#f1f2fb'
  dark-muted: '#b6b9cf'
typography:
  display:
    {
      fontFamily: 'Segoe UI Variable, Segoe UI, system-ui, sans-serif',
      fontSize: 80px,
      fontWeight: 650,
      lineHeight: 1.04,
      letterSpacing: -0.055em,
    }
  heading:
    {
      fontFamily: 'Segoe UI Variable, Segoe UI, system-ui, sans-serif',
      fontSize: 48px,
      fontWeight: 650,
      lineHeight: 1.12,
      letterSpacing: -0.04em,
    }
  body:
    {
      fontFamily: 'Segoe UI Variable, Segoe UI, system-ui, sans-serif',
      fontSize: 16px,
      fontWeight: 400,
      lineHeight: 1.65,
    }
rounded: { sm: 8px, md: 12px, lg: 24px, full: 999px }
spacing: { xs: 8px, sm: 16px, md: 24px, lg: 40px, section: 104px }
components:
  button-primary:
    {
      backgroundColor: '{colors.primary}',
      textColor: '#ffffff',
      rounded: '{rounded.md}',
      height: 48px,
    }
---

## Overview

Marketing público para entrenadores y nutriólogos. Referencia de composición: Sketch, sin reutilizar sus assets, textos o identidad. Variación 7/10, movimiento 3/10, densidad 3/10.

## Colors

Azul y violeta derivados del logo existente; azul para acciones, violeta para énfasis secundario. Superficies neutras frías. El tema sigue la preferencia del sistema en toda la página.

## Typography

Tipografía del sistema sin descargas externas. Titulares breves, texto de lectura de 16px y detalles de 12px como mínimo. Escala fluida en móvil.

## Layout

Contenedor de 1200px, navegación de 76px, hero asimétrico y vista conceptual interactiva. Reflujo explícito a 1024px y 768px; teléfono junto al panel en escritorio y después de él en móvil, nunca una captura ilegible reducida.

## Elevation & Depth

Sombras suaves solo en las vistas de producto. Un degradado azul/violeta tenue en el hero. Sin glassmorphism ni movimiento continuo.

## Shapes

Botones de 12px, paneles de 24px e indicadores circulares. Los radios del marco de dispositivo son una excepción representativa del hardware.

## Components

Navegación nativa mediante anclas; menú móvil con Escape y foco de retorno. Diálogo nativo para disponibilidad. Vistas de ejemplo con controles reales y estado local; no persisten datos ni llaman a APIs.

## Do's and Don'ts

- Basar el contenido en docs/requirements. Diferenciar alcance previsto de disponibilidad actual.
- No inventar precios, cuotas, pruebas gratis, fechas, usuarios, testimonios, chat ni integraciones.
- Identificar los datos ficticios y la vista conceptual; no presentar prototipos como capturas del producto disponible.
- Mantener expedientes y prescripciones bajo control profesional. El código vincula una cuenta con un expediente existente una sola vez.
- Foco visible, objetivos táctiles de al menos 44px, contraste AA y respeto a movimiento reducido.
