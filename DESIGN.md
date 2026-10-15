---
name: CouchOne Fit — Aplicaciones privadas
colors:
  primary: '#2563EB'
  primary-hover: '#1D4ED8'
  primary-light: '#DBEAFE'
  secondary: '#10B981'
  secondary-light: '#D1FAE5'
  accent: '#F59E0B'
  accent-light: '#FEF3C7'
  background: '#F8FAFC'
  surface: '#FFFFFF'
  text-primary: '#1E293B'
  text-secondary: '#64748B'
  text-muted: '#94A3B8'
  border: '#E2E8F0'
  border-strong: '#CBD5E1'
typography:
  heading:
    {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 24px,
      fontWeight: 600,
      lineHeight: 1.25,
    }
  body:
    {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16px,
      fontWeight: 400,
      lineHeight: 1.5,
    }
  label:
    {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14px,
      fontWeight: 500,
      lineHeight: 1.5,
    }
rounded: { sm: 8px, md: 12px, lg: 16px, full: 999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px }
components:
  button-primary:
    {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.surface}',
      rounded: '{rounded.md}',
      height: 48px,
    }
  card:
    {
      backgroundColor: '{colors.surface}',
      textColor: '{colors.text-primary}',
      rounded: '{rounded.lg}',
      padding: 16px,
    }
---

## Overview

**UI-001 — APROBADA por el usuario el 14 de octubre de 2026.** Estilo **Moderna y Profesional** para el panel interno Web/PWA y la aplicación móvil del cliente. Este documento es su fuente visual compartida; **no sustituye ni modifica el diseño de marketing** definido en `apps/web/DESIGN.md`.

La imagen aportada en el chat del 14-oct-2026 es referencia de composición: panel central con navegación lateral, tarjetas de indicadores, listas y gráficas; móvil con cabecera, tarjetas de entrenamiento/alimentación/check-in y navegación inferior. Se adopta una apariencia similar, no reproducción exacta, ni copia de imágenes, personas, textos o recursos ajenos. La imagen no está guardada en el repositorio: esta descripción conserva la decisión, no pretende ser una captura o mockup implementado.

## Colors

Los HEX del front matter son exactos y prevalecen sobre el azul/violeta de la referencia. Azul para acciones principales, enlaces y selección; esmeralda para estados completados/progreso registrado; ámbar para pendientes y avisos suaves. Fondo blanco azulado, tarjetas blancas y texto azul grisáceo oscuro.

Los nombres se trasladarán a variables CSS y tokens de tema Dart equivalentes, sin imponer igual sintaxis entre tecnologías. Tokens privados separados del marketing: no reemplazar variables globales que cambien la landing. No interpretar verde como diagnóstico, ni todas las variaciones de peso como mejoras. Toda semántica debe acompañarse de texto/icono.

Mantener los colores elegidos sin asumir que todas sus combinaciones son legibles. Sobre fondos esmeralda/ámbar usar texto oscuro y verificar contraste; `text-muted` se reserva para información prescindible o decoración, no etiquetas/instrucciones críticas. Los errores y acciones destructivas deben identificarse explícitamente, no confundirse con avisos ámbar; cualquier token adicional se verificará y documentará al implementar.

## Typography

Tipografía sans-serif del sistema, sin descargar fuentes. En Web usar la pila del sistema; en Flutter su equivalente nativo, no el literal CSS `system-ui`. Texto habitual 16 px o equivalente lógico, detalles 14 y títulos de sección 24; aceptar escalado del usuario sin recortes. Los titulares gigantes del marketing no se reutilizan en formularios o dashboard.

## Layout

**Panel profesional:** sidebar con logo y accesos a Inicio, Clientes, Planes (Entrenamiento/Alimentación), Seguimiento y Configuración (cuenta/suscripción). Cabecera contextual con título, perfil y acciones del módulo; búsqueda solo donde exista contrato funcional. Dashboard con tarjetas de clientes activos/cupo, check-ins recientes/pendientes e indicadores separados de adherencia/cobertura. Listas y gráficas llevan al expediente o periodo correspondiente. Expediente por secciones/pestañas de perfil, evaluaciones, planes y seguimiento. Administración separada por rol, con la misma identidad visual y solo sus módulos aprobados.

En escritorio distribuir tarjetas en varias columnas; en tablet reducir columnas y en ancho estrecho usar una columna y menú accesible. Validar 320/390/768/1280 px; tablas extensas con adaptación o desplazamiento localizado, nunca desbordamiento de toda la página.

**Móvil cliente:** navegación inferior con cuatro destinos, Inicio, Planes, Progreso y Cuenta. Inicio muestra fecha y tarjetas de entrenamiento, alimentación y check-in; acceso a la captura única del peso dentro del check-in, sin formulario paralelo. Planes distingue entrenamiento y alimentación. Entrenamiento muestra ejercicios y detalle por serie; nutrición comidas/cantidades/instrucciones. Progreso muestra únicamente historial y gráficos autorizados; Cuenta reúne perfil de solo lectura, credenciales, información de registro y cierre de sesión. Los formularios/detalles usan navegación de regreso y una acción principal clara.

Respetar áreas seguras, teclado, scroll, escalado de texto y controles táctiles cómodos. No fabricar métricas cuando no existan datos; mostrar estados independientes sin plan, sin registros, sin permiso y acceso suspendido según DEC-004/009.

## Elevation & Depth

Tarjetas blancas con borde tenue y sombra discreta solo cuando aporte separación. Interfaz clara de trabajo, sin glassmorphism, fondos fotográficos, degradados protagonistas ni animaciones continuas. Tema claro para V2; no se agrega modo oscuro por aparecer tokens oscuros en el diseño de marketing.

## Shapes

Controles de 12 px de radio y tarjetas de 16 px; chips pequeños de 8 px y círculos solo para indicadores/iconos apropiados. Espaciado base 4/8/16/24/32. Mantener estas proporciones entre Web y móvil, adaptándolas al espacio disponible.

## Components

Botón azul para acción principal; secundarias neutras o tonales, con jerarquía clara. Formularios con etiqueta visible, ayuda, unidad y error junto al campo. Listas con estados textuales; badges de completado/pendiente sin depender del color. Gráficas con fechas, unidad, origen y alternativa tabular; adherencia observada y cobertura separadas, nunca un score global inventado.

Toda pantalla debe especificar carga, vacío, error, éxito y denegación cuando corresponda. Guardar no muestra éxito antes de confirmar servidor; confirmar acciones de baja/cambio de plan y preservar formularios ante errores. Feedback y transiciones discretas, respetando movimiento reducido. Iconos coherentes con etiqueta accesible, no emojis como único control.

## Do's and Don'ts

- Conservar marketing terminado y su paleta propia; compartir marca, no forzar un único tema global.
- Seguir HU y DEC vigentes: la referencia **no aprueba citas/agenda, chat, notificaciones, reportes nuevos, fotos de progreso, fotografías de alimentos/ejercicios ni bibliotecas multimedia**.
- No agregar rachas/streaks, recordatorios o calificación global por estar sugeridos en la imagen/paleta.
- No copiar sus métricas de ejemplo a pantallas funcionales, ni representar ausencia de datos como incumplimiento.
- Permisos, suscripción y estados se validan en API; el diseño no cambia reglas de negocio.
- Objetivo de aceptación: contraste AA verificado por combinación, foco visible, teclado, objetivos táctiles mínimos de 44 px Web/48 unidades lógicas móvil y gráficos no dependientes solo de color. Son validaciones pendientes, no accesibilidad certificada.
- Decisión visual aprobada; implementación de pantallas, temas, iconos y pruebas sigue pendiente dentro de cada HU y TT-013, sin nuevas estimaciones o funcionalidades.
