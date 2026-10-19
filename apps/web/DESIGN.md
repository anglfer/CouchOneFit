---
name: CouchOne Fit Marketing
colors:
  primary: '#4037F7'
  primary-hover: '#3128D9'
  secondary: '#6344DC'
  ink: '#090918'
  muted: '#434771'
  text-muted: '#6C74A1'
  canvas: '#F8F9FD'
  surface: '#FFFFFF'
  surface-secondary: '#F3F4FA'
  surface-accent: '#F1F0FF'
  primary-soft: '#EAE8FF'
  border: '#E3E5FC'
  border-strong: '#D0D2FA'
  dark-primary: '#6259FF'
  dark-primary-hover: '#756EFF'
  dark-secondary: '#8067F5'
  dark-canvas: '#050A1A'
  dark-surface: '#0C152C'
  dark-surface-secondary: '#121F43'
  dark-surface-accent: '#162467'
  dark-ink: '#EFF0F4'
  dark-muted: '#BBBFD3'
  dark-text-muted: '#8F97AF'
  dark-border: '#21305B'
  dark-border-strong: '#293A70'
  dark-primary-soft: '#1A1D5A'
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

Actualización aprobada el 16 de octubre de 2026. Marca, seis paletas y estados comunes en [DESIGN.md raíz](../../DESIGN.md). Primario `#4037F7`, azul corporativo `#3046EB` y violeta `#6344DC`. Degradado de marca: `linear-gradient(135deg, #3046EB 0%, #4037F7 48%, #6344DC 100%)`. Un botón de sol/luna en la cabecera alterna claro/oscuro y guarda la elección entre páginas y recargas, incluido acceso y registro. Sin elección guardada sigue al sistema. No usar rosa/naranja como acción principal.

## Typography

Tipografía del sistema sin descargas externas. Titulares breves, texto de lectura de 16px y detalles de 12px como mínimo. Escala fluida en móvil.

## Layout

Contenedor de 1200px, navegación de 76px, hero asimétrico y vista conceptual interactiva. Reflujo explícito a 1024px y 768px; teléfono junto al panel en escritorio y después de él en móvil, nunca una captura ilegible reducida.

## Elevation & Depth

Sombras suaves solo en las vistas de producto. Degradado de marca en el énfasis del hero claro; en oscuro, texto de énfasis claro y superficies azul nocturno para conservar legibilidad. Sin glassmorphism ni movimiento continuo.

## Shapes

Botones de 12px, tarjetas de 20–24px e indicadores circulares. El panel profesional usa un layout independiente con navegación izquierda y radios de 6/8px; no hereda los componentes comerciales. Los radios del marco de dispositivo son una excepción representativa del hardware.

## Components

Navegación mediante anclas; menú móvil con Escape y retorno de foco. «Contratar plan» abre `/registro` con plan de interés; «Contáctanos» abre registro sin plan. Registro conectado a API/PostgreSQL; acceso profesional disponible en `/acceso`; pagos se integran en su módulo correspondiente.

## Do's and Don'ts

- Basar el contenido en docs/requirements. Diferenciar alcance previsto de disponibilidad actual.
- Usar los precios y límites acordados: Básico $299 MXN/10 activos, Pro $599 MXN/30 y Élite $999 MXN/ilimitados. Crear cuenta no cobra ni activa la suscripción. No añadir pruebas gratis, testimonios o integraciones sin requerimiento.
- La vista interactiva explica el producto; las pantallas funcionales usan datos del backend y sus estados de carga, vacío y error.
- Mantener expedientes y prescripciones bajo control profesional. El código vincula una cuenta con un expediente existente una sola vez.
- Foco visible, objetivos táctiles de al menos 44px, contraste AA y respeto a movimiento reducido.
