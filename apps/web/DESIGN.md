---
name: CouchOne Fit · superficies públicas
description: Señalética deportiva mexicana para la landing, el acceso, el registro, la recuperación, la privacidad y la página 404.
colors:
  action: '#E5007D'
  action-hover: '#B80064'
  cobalt: '#2335C9'
  orange: '#FF6A13'
  green: '#00A35C'
  paper: '#FFFFFF'
  ink: '#000000'
  ink-secondary: '#3D3D3D'
  ink-muted: '#555555'
  paper-pressed: '#F2F2F2'
  action-wash: '#FDE3F0'
typography:
  display:
    fontFamily: "Unbounded, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: 'clamp(2.6rem, 4.3vw, 4rem)'
    fontWeight: 800
    lineHeight: 1.16
    letterSpacing: '0.01em'
  headline:
    fontFamily: "Unbounded, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: 'clamp(1.85rem, 3.6vw, 3rem)'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  title:
    fontFamily: "Unbounded, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '-0.02em'
  figure:
    fontFamily: "Unbounded, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: '2.6rem'
    fontWeight: 700
    lineHeight: 1
    letterSpacing: '-0.02em'
  label:
    fontFamily: "Unbounded, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: '12.5px'
    fontWeight: 700
    letterSpacing: '-0.02em'
  body-lead:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '1.125rem'
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.625
  nav:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '15px'
    fontWeight: 600
  caption:
    fontFamily: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
rounded:
  none: '0px'
  device: '34px'
  full: '999px'
spacing:
  control: '2px'
  rule: '3px'
  ring-mobile: '4px'
  ring: '8px'
  gutter: '16px'
  gutter-wide: '32px'
  block: '56px'
  section: '96px'
  section-wide: '128px'
  container: '1360px'
components:
  button-action:
    backgroundColor: '{colors.action}'
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '12px 24px'
    height: '48px'
  button-action-hover:
    backgroundColor: '{colors.action-hover}'
    textColor: '{colors.paper}'
  button-line:
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '12px 24px'
    height: '48px'
  button-line-hover:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
  button-line-white:
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    padding: '12px 24px'
    height: '48px'
  button-line-white-hover:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
  module-chip:
    textColor: '{colors.paper}'
    rounded: '{rounded.none}'
    size: '40px'
  module-tab:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    padding: '12px'
    height: '104px'
  module-tab-hover:
    backgroundColor: '{colors.paper-pressed}'
  plan-cell:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '32px'
  plan-cell-flooded:
    backgroundColor: '{colors.action}'
    textColor: '{colors.paper}'
  route-stop:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.full}'
    size: '64px'
  phone-frame:
    backgroundColor: '{colors.ink}'
    rounded: '{rounded.device}'
  auth-input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: '10px 14px'
    height: '48px'
  nav-bar:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.nav}'
    height: '73px'
---

# Design System: CouchOne Fit · superficies públicas

Alcance: landing `/`, `/acceso`, `/registro`, `/recuperar`, `/privacidad` y la página 404. Decidido por el usuario el 21-nov-2026; sustituye al marketing índigo/violeta anterior. El panel profesional (`/app`), la administración (`/admin`) y la app móvil conservan su propio sistema ([DESIGN.md raíz](../../DESIGN.md), `src/workspace.css`) y quedan fuera de este documento. Fuentes: tokens y piezas en `src/signage.css`; componentes en `src/components/SignTitle.tsx`, `src/components/ProductShot.tsx`, `src/components/Brand.tsx`, `src/features/marketing/` y `src/features/auth/`.

## Overview

**Creative North Star: "Señalética deportiva mexicana"**

Las superficies públicas se leen como la señalética de un recinto deportivo: tinta plana sobre papel blanco, un color y un pictograma por disciplina, y líneas concéntricas de 8px que enmarcan lo importante. Cada módulo del producto (Evaluación, Alimentación, Entrenamiento, Seguimiento) es una disciplina que se reconoce por su color en toda la página, y el producto real, con capturas del panel y de la app con datos de demostración, aparece dentro de anillos como la pieza central de una señal.

La densidad es baja y la voz, directa: titulares en Unbounded, cortos y con punto final; lectura en la tipografía del sistema; secciones que son campos de color completos (cobalto y rosa partidos a la mitad, un campo naranja, una única banda negra de cierre) separadas sobre blanco por reglas de tinta de 3px. No hay sombras difusas, degradados suaves ni esquinas redondeadas; la profundidad la dan los anillos y el teléfono que se superpone al panel.

Las superficies públicas son siempre claras (`src/services/theme.ts`): no hay tema oscuro ni conmutador. Este mundo rechaza de forma explícita el hero SaaS índigo con filas de tarjetas iguales que lo precedió.

**Key Characteristics:**

- Papel blanco y tinta negra absolutos; cuatro tintas de disciplina saturadas con un trabajo fijo cada una.
- Unbounded autoalojada como rotulación; pila del sistema para leer.
- Anillos concéntricos de 8px alrededor de capturas reales, y el mismo contorno en las letras del titular principal.
- Esquinas rectas, reglas de 3px, controles de 2px; solo el teléfono y las paradas de la ruta son curvos.
- Secciones como campos de color a sangre; una sola banda negra, la del cierre.
- Movimiento breve y único: el barrido de la captura al cambiar de módulo y el cambio de color de sus anillos, nada en bucle.

## Colors

Paleta de señal: cuatro tintas saturadas sobre blanco y negro absolutos, y cada color con un trabajo que no comparte.

### Primary

- **Rosa mexicano** (#E5007D): la acción. Rellena el botón de conversión de cada zona («Crear mi cuenta», «Crear cuenta», el envío de acceso y registro), inunda la celda de plan con puntero o foco, pinta la selección de texto y el cursor de escritura. También es el color de Seguimiento y del campo «Tu cliente registra». Blanco encima: 4,54:1 (AA).
- **Rosa profundo** (#B80064): hover del botón de acción y del botón primario de formularios. Blanco encima: 6,5:1.

### Secondary

- **Cobalto estadio** (#2335C9): Entrenamiento; campo de marca (mitad «Tú prescribes», aside de acceso y recuperación, cabeceras de registro y privacidad en todo el ancho); anillo de foco por defecto; enlaces de texto en formularios («Mostrar», «¿Olvidaste tu contraseña…?», «Ver todos los planes»). Blanco encima y cobalto sobre blanco: 8,66:1.

### Tertiary

- **Naranja pista** (#FF6A13): Evaluación; campo completo de «Una app para tus clientes»; anillo exterior del marco del hero con Seguimiento activo y segundo anillo del marco del expediente. Negro encima: 7,32:1.
- **Verde cancha** (#00A35C): Alimentación. Negro encima: 6,39:1.

### Neutral

- **Papel** (#FFFFFF): fondo de todas las superficies públicas y hueco entre anillos.
- **Tinta** (#000000): texto principal, reglas, bisel del teléfono, tramos de la ruta y la banda de cierre.
- **Tinta secundaria** (#3D3D3D): párrafos de apoyo, notas legales y pie (10,9:1 sobre papel).
- **Tinta apagada** (#555555): subtítulos y ayudas dentro de los formularios de acceso (7,5:1).
- **Papel presionado** (#F2F2F2): hover de las pestañas de módulo inactivas y de los botones secundarios de formulario.
- **Lavado rosa** (#FDE3F0): hover del conmutador «Mostrar» de las contraseñas en acceso y registro.

### Named Rules

**La regla de una disciplina, un color.** Evaluación naranja, Alimentación verde, Entrenamiento cobalto, Seguimiento rosa (`src/features/marketing/modules.tsx`). El mapeo no cambia entre secciones ni superficies, y un color de módulo nunca representa a otro módulo.

**La regla de tinta por campo.** Sobre rosa, cobalto o negro el texto es blanco; sobre naranja o verde el texto es negro. El blanco sobre naranja (2,87:1) o sobre verde (3,28:1) no alcanza AA para texto. El pictograma blanco del cuadro de módulo es la única excepción: es decorativo (`aria-hidden`) y siempre lleva su nombre escrito al lado.

**La regla del rosa que actúa.** El relleno rosa es la acción de conversión de su zona; cualquier otra acción de la misma zona es un botón de línea. Un rosa que no es botón es campo o disciplina, nunca adorno.

## Typography

**Display Font:** Unbounded variable (400–900, licencia OFL), autoalojada en `public/fonts/unbounded-latin-var.woff2` con subconjunto latino y `font-display: swap`; respaldo Segoe UI Variable Display, Segoe UI, system-ui.
**Body Font:** pila del sistema (Segoe UI Variable / Segoe UI en Windows, system-ui en el resto).

**Character:** Unbounded, ancha y de remates redondos, hace de rotulación de recinto y carga el peso de la marca; la pila del sistema lleva la lectura sin descarga extra y sin competir con ella.

### Hierarchy

- **Display** (800, clamp(2.6rem, 4.3vw, 4rem) en escritorio y clamp(2.4rem, 9.4vw, 3.6rem) en móvil; cierre hasta 4.2rem; interlínea 1.16, +0.01em): el titular de líneas paralelas. Solo en la primera afirmación de una superficie y en la banda de cierre.
- **Headline** (700, clamp(1.85rem, 3.6vw, 3rem), 1.1, −0.02em): títulos de sección, planos y sin anillos. Los h1 de los formularios de acceso usan 1.85rem; privacidad, clamp(1.8rem, 5vw, 2.6rem).
- **Title** (700, 1.25rem, 1.4, −0.02em): nombre del plan, pasos de la ruta, columnas «Tú prescribes» / «Tu cliente registra», recuadro de plan en registro.
- **Figure** (700, 2.6rem, 1): precio del plan. Los numerales de la ruta usan 1.5rem dentro del círculo.
- **Label** (Unbounded 700, 12.5px a 18px): nombre del módulo en la tira de pestañas, términos del resumen del panel (15px), encabezados de columna del pie (14px), destinos del menú móvil (18px).
- **Body lead** (400, 1.125rem, 1.625; 34–38rem de ancho): párrafo del hero y de cada sección.
- **Body** (400, 1rem, 1.625; ≤62ch en preguntas y ≤68ch en privacidad): descripciones, respuestas y leyendas de captura.
- **Nav** (600, 15px): enlaces de la barra de escritorio, subrayado rosa de 3px al pasar el puntero.
- **Caption** (400, 0.875rem): «Crear tu cuenta no realiza cobros…», «Capturas reales del producto con datos de demostración», pie.

### Named Rules

**La regla de rotulación.** Unbounded solo en señales: titulares, títulos, precios, numerales, nombres de módulo, encabezados de columna y destinos del menú móvil. Párrafos, etiquetas de campo, botones y la navegación de escritorio van en la pila del sistema.

**La regla del contorno de entrada y salida.** El titular de líneas paralelas aparece en la primera afirmación de la superficie (hero, aside de acceso, registro) y en la banda de cierre. Los títulos intermedios son planos.

**La regla del punto final.** Los titulares de afirmación son cortos y cierran con punto: «Tus planes. Su progreso.», «Antes de empezar.», «Qué bueno verte de nuevo.».

## Layout

Contenedor de 1360px con canal de 16px que pasa a 32px desde 640px. Las secciones respiran 96px en vertical y 128px desde 1024px; entre un título de sección y su contenido hay 56px. Los campos de color van a sangre completa y alinean su texto con el contenedor (`max(2rem, (100vw − 1360px) / 2 + 2rem)`).

- **Hero:** dos columnas desde 1024px (texto 1fr, producto 1.25fr). A la izquierda, titular, párrafo, acciones y, al pie de la columna, la tira de cuatro pestañas de módulo (2×2 en móvil, 4 en fila desde 640px). A la derecha, la captura del panel con anillos y el teléfono superpuesto abajo a la izquierda (−64px / −80px); en móvil el teléfono va debajo, centrado, al 62%, y la captura del panel pasa a formato cuadrado anclada al contenido.
- **Campos:** «Un expediente. Dos lados.» parte el ancho en cobalto y rosa; la captura que sigue continúa el corte con un `linear-gradient` de parada dura al 50% (no es un degradado). «Una app para tus clientes» es un campo naranja con tres teléfonos; en móvil se desplazan en horizontal con `scroll-snap`.
- **Secciones blancas:** separadas por reglas de tinta de 3px a todo el ancho.
- **Acceso y recuperación:** dos columnas desde 1024px (aside cobalto 5fr, formulario 6fr); en móvil el aside desaparece y queda una cabecera cobalto. Registro y privacidad usan cabecera cobalto a todo el ancho y contenido en `max-w-6xl` / `max-w-4xl`.
- **Puntos de quiebre:** 640px (canal ancho, pestañas en fila), 768px (anillos a 8px, ruta horizontal, tablero de planes en tres columnas, capturas 16:10), 1024px (navegación de escritorio, hero y acceso en dos columnas, secciones de 128px).

### Named Rules

**La regla de la banda negra única.** El campo negro existe una sola vez por superficie: el cierre «Empieza con tu primer cliente.». Ninguna otra sección usa fondo negro.

**La regla del espacio para los anillos.** Todo elemento con anillos deja libre a su alrededor el grosor de la pila: 24px en móvil y 48px desde 640px (`p-6 sm:p-12`), para que ningún anillo quede recortado.

## Elevation & Depth

El sistema es plano. No hay sombras con desenfoque ni con desplazamiento, ni capas translúcidas. La profundidad se expresa con anillos concéntricos dibujados como `box-shadow` de radio cero alrededor de las capturas, y con la superposición del teléfono sobre el panel.

### Shadow Vocabulary

- **Pila de anillos** (`box-shadow: 0 0 0 8px paper, 0 0 0 16px ring-1, 0 0 0 24px paper, 0 0 0 32px ring-2, 0 0 0 40px paper, 0 0 0 48px ring-3`; paso de 4px por debajo de 768px): marco de capturas del panel y del teléfono del aside de acceso. El primer anillo toma el color del módulo activo; el hueco puede tomar el color del campo (cobalto en el aside de acceso).
- **Filo de pictograma** (`box-shadow: inset 0 0 0 2px #fff`): borde blanco interno del cuadro de módulo cuando se apoya sobre un campo de color o en la pestaña activa.

### Named Rules

**La regla sin sombra.** Ningún desenfoque ni desplazamiento: las únicas `box-shadow` son la pila de anillos de radio cero y el filo blanco interno del pictograma.

## Shapes

Ángulo recto en todo: botones, campos, casillas, celdas de plan, pestañas, pictogramas, recuadros y tarjeta de formulario tienen radio 0. Las líneas tienen tres grosores con oficio propio: 3px para reglas, bordes de botón y marcos de tablero; 8px para anillos y tramos de la ruta; 2px para campos, casillas, botones de formulario y divisores sobre color. La tarjeta de formulario no tiene marco: solo una regla superior de tinta de 6px.

Solo dos formas son curvas y ambas representan algo físico: el teléfono, con bisel de tinta de 7px y radio de 34px como el hardware, y las paradas de la ruta, círculos de 64px con aro de tinta de 8px.

### Named Rules

**La regla del ángulo recto.** Si no es un teléfono ni una parada de ruta, no tiene radio.

## Components

### Buttons

Rótulos rectangulares de tinta: firmes, de una sola línea, con flecha SVG cuando llevan a otra pantalla.

- **Shape:** esquinas rectas (0); altura mínima de 48px; relleno de 12px × 24px; borde de 3px; texto del sistema 700 a 16px.
- **Acción:** rosa mexicano con texto blanco; hover a rosa profundo.
- **Línea:** transparente, texto y borde en el color actual; hover se rellena de tinta con texto blanco.
- **Línea blanca:** para campos cobalto o negro; borde y texto blancos, hover a relleno blanco con texto de tinta.
- **Transición:** fondo, color y borde en 0.15s; sin transición con movimiento reducido.
- **Variantes compactas:** «Crear cuenta» en la barra baja a 44px. En los formularios de acceso el botón primario (`ws-btn`) toma el rosa con borde de 2px.

### Pestañas de módulo (firma)

Tira de cuatro pestañas en un marco de tinta de 3px, divididas por reglas de 3px; cada celda mide al menos 104px de alto con el pictograma arriba y el nombre en Unbounded 12.5px abajo.

- **Inactiva:** papel, texto de tinta; hover a papel presionado.
- **Activa:** se rellena con el color del módulo; el pictograma gana su filo blanco interno.
- **Comportamiento:** `role="tablist"` con flechas, Inicio y Fin; al cambiar, la captura del panel y la del teléfono entran con un barrido de izquierda a derecha (`clip-path`, 0.5s, `cubic-bezier(0.16, 1, 0.3, 1)`) y el primer anillo toma el color del módulo. Sin barrido con movimiento reducido. Por defecto está activa Seguimiento.
- **Foco:** contorno de tinta de 3px hacia dentro (−8px); blanco en la pestaña activa.

### Pictograma de módulo

Cuadro de color de 40px (34px en listas sobre color, 30px en el resumen del panel) con un icono SVG blanco al 55% y trazo de 2.2: portapapeles (Evaluación), tazón (Alimentación), mancuerna (Entrenamiento), gráfica (Seguimiento). Decorativo, siempre junto a su texto.

### Titular de líneas paralelas (firma)

`SignTitle` apila cinco capas del mismo texto: cuatro con trazo (`-webkit-text-stroke`) de 8, 6, 4 y 2 veces 0.042em que alternan cobalto, papel, rosa y papel, y encima la capa de tinta. Las capas de anillo son `aria-hidden` y no se seleccionan. Los colores se pasan por campo: sobre cobalto, relleno blanco, hueco cobalto y anillos rosa y naranja; sobre negro, relleno blanco, hueco negro y anillos rosa y naranja.

### Marco de captura

`PanelShot` y `PhoneShot` muestran capturas reales en `public/marketing/*.webp` (panel 2160×1350, teléfono 720×1600), con `alt` que describe la pantalla y la nota de datos de demostración cerca. El panel lleva la pila de anillos (rosa, cobalto, naranja por defecto, reordenados según el módulo activo o el campo); el teléfono lleva bisel de tinta de 7px y radio de 34px.

### Tablero de planes

Una sola rejilla en marco de tinta de 3px, celdas separadas por reglas de 3px (apiladas en móvil, tres columnas desde 768px), relleno de 32px. Nombre en Title, precio en Figure con «MXN al mes» y capacidad del plan. Con puntero o foco dentro, la celda se inunda de rosa en 0.2s: el texto pasa a blanco y su botón de línea se vuelve un rótulo blanco con texto de tinta. Carga con tres bloques grises pulsantes en la misma rejilla; error en recuadro de 3px con «Reintentar» en cobalto; vacío con texto que permite crear la cuenta y elegir después.

### Ruta

Pasos numerados como paradas: círculos de 64px con aro de tinta de 8px y numeral en Unbounded, unidos por un tramo de tinta de 8px (vertical en móvil, horizontal desde 768px). El número es `aria-hidden`; el título lleva «Paso N» solo para lectores de pantalla.

### Preguntas frecuentes

`details` nativos entre reglas de tinta de 3px; resumen de 56px de alto mínimo en texto del sistema 700 a 17px y un signo más SVG que gira 45° al abrir.

### Navigation

- **Barra:** fija arriba, papel, 73px de alto y regla inferior de tinta de 3px. Marca a la izquierda, anclas al centro (15px, 600) con subrayado rosa de 3px al pasar el puntero, y a la derecha «Iniciar sesión» como enlace y «Crear cuenta» como botón de acción.
- **Móvil (por debajo de 1024px):** botón cuadrado de 44px con borde de 3px que abre una lista de destinos en Unbounded 18px separados por reglas de 2px, más «Iniciar sesión» (línea) y «Crear cuenta» (acción). Escape cierra y devuelve el foco al botón.
- **Marca:** isotipo C1 de 38px y «CouchOne Fit» en Unbounded 17px 700; tinta sobre papel, blanca sobre cobalto.
- **Pie:** papel, marca con una línea de descripción y dos columnas de enlaces («Producto», «Tu cuenta») subrayados en rosa de 2px al pasar el puntero; regla de tinta de 3px y la nota de capturas al final.

### Inputs / Fields

- **Estilo:** papel, borde de tinta de 2px, radio 0, alto mínimo de 48px, relleno de 10px × 14px y texto de 16px.
- **Hover:** borde cobalto.
- **Focus:** contorno cobalto de 3px separado 2px; el borde vuelve a tinta.
- **Select:** sin apariencia nativa, con flecha SVG de tinta a 14px del borde derecho.
- **Casilla:** cuadro de 22px con borde de tinta de 2px; marcada, se rellena de rosa con palomita SVG blanca.
- **Error:** borde y mensajes en el tono de error compartido del sistema (`ws-alert`), con esquinas rectas.

### Marco de acceso

`AuthShell` (acceso, recuperación): aside cobalto con marca blanca, titular de líneas paralelas, párrafo y un teléfono con anillos blanco, rosa y naranja que sale por el borde inferior; formulario sobre papel en una tarjeta sin marco con regla superior de 6px. Registro y privacidad: cabecera cobalto a todo el ancho con «Volver al inicio». La 404 usa el mismo papel y la misma tarjeta.

## Do's and Don'ts

### Do:

- **Do** usa los tokens `--sg-*` de `src/signage.css` y respeta el mapeo de disciplinas: Evaluación #FF6A13, Alimentación #00A35C, Entrenamiento #2335C9, Seguimiento #E5007D.
- **Do** muestra el producto con capturas reales de `public/marketing/` (datos de demostración), con `alt` descriptivo y la nota «Capturas reales del producto con datos de demostración» cerca.
- **Do** toma precios y límites de la API (`/api/plans`): Básico $299 MXN / 10 clientes activos, Pro $599 MXN / 30, Élite $999 MXN / ilimitados.
- **Do** deja claro junto al registro (hero, planes, formulario) que crear la cuenta no realiza cobros ni activa una suscripción.
- **Do** enlaza «Contáctanos» a `/registro` (HU-039); «Elegir plan» abre `/registro?plan=<id>` e «Iniciar sesión» abre `/acceso`.
- **Do** mantén expedientes y prescripciones bajo control del profesional: el cliente registra, nunca modifica lo prescrito, y el código de invitación vincula una cuenta con un expediente existente una sola vez.
- **Do** mantén el foco visible: contorno cobalto de 3px separado 3px; añade `.sg-on-color` a campos cobalto, rosa o negro para que pase a blanco.
- **Do** asegura objetivos táctiles de al menos 44px, contraste AA y respeto a `prefers-reduced-motion` (sin barrido ni transiciones).
- **Do** confirma acciones destructivas o la pérdida de cambios con `confirmDialog()` (`src/services/confirm.ts`), y solo cuando de verdad se pierde algo.
- **Do** deja las superficies públicas siempre en tema claro.

### Don't:

- **Don't** inventes testimonios, logos de clientes, métricas de uso, pruebas gratis ni integraciones.
- **Don't** pongas texto blanco sobre naranja (2,87:1) ni sobre verde (3,28:1); ahí el texto va en tinta.
- **Don't** uses degradados suaves, transparencias tipo vidrio, sombras con desenfoque o desplazamiento, ni esquinas redondeadas fuera del teléfono y las paradas de la ruta.
- **Don't** pongas etiquetas ni antetítulos sobre los títulos.
- **Don't** repitas filas de tarjetas iguales con sombra ni vuelvas al índigo/violeta o al conmutador sol/luna del marketing anterior.
- **Don't** uses el titular de líneas paralelas en títulos intermedios ni un segundo campo negro.
- **Don't** cargues fuentes desde un CDN externo: Unbounded se sirve desde `public/fonts/`.
- **Don't** uses `window.confirm` ni `window.alert`.
